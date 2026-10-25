import { mkdir, mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { createServer } from 'node:net';
import { z } from 'zod';

const root = resolve(import.meta.dir, '..');
const broken = process.argv.includes('--broken');
const model = process.env.CODEX_TEST_MODEL || 'gpt-6.1-sol';
const checklistPath = join(root, 'checklists/todos.json');
const checklistSchema = z.object({
  title: z.string().min(1),
  cases: z.array(z.object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    name: z.string().min(1),
    steps: z.array(z.string().min(1)).min(1),
  })).min(1),
}).refine(value => new Set(value.cases.map(testCase => testCase.id)).size === value.cases.length, 'Case IDs must be unique');
const checklist = checklistSchema.parse(JSON.parse(await readFile(checklistPath, 'utf8')));
const runName = `${new Date().toISOString().replace(/[:.]/g, '-')}-${broken ? 'broken' : 'healthy'}`;
const output = join(root, 'artifacts', runName);
await mkdir(output, { recursive: true });

// Remove API-key overrides. Reuse Codex's existing subscription login; never read auth.json.
const env = { ...process.env };
delete env.OPENAI_API_KEY;
delete env.CODEX_API_KEY;
const auth = Bun.spawn(['codex', 'login', 'status'], { env, stdout: 'pipe', stderr: 'pipe' });
const authText = await new Response(auth.stdout).text() + await new Response(auth.stderr).text();
if (await auth.exited !== 0 || !authText.includes('ChatGPT')) {
  throw new Error('Subscription login required. Run codex login and sign in with ChatGPT, then retry.');
}
console.log(`Codex subscription login confirmed. Model: ${model}`);
console.log(`Checklist: ${checklist.title}. Mode: ${broken ? 'deliberate completion fault' : 'healthy'}`);
console.log(`Artifacts: ${output}`);

const workspace = await mkdtemp(join(tmpdir(), 'codex-checklist-'));
const schema = {
  type: 'object', additionalProperties: false,
  properties: { summary: { type: 'string' }, cases: { type: 'array', items: {
    type: 'object', additionalProperties: false,
    properties: { id: { type: 'string' }, status: { type: 'string', enum: ['passed', 'failed', 'blocked'] }, reason: { type: 'string' } },
    required: ['id', 'status', 'reason'],
  } } }, required: ['summary', 'cases'],
};
const schemaPath = join(workspace, 'schema.json');
await writeFile(schemaPath, JSON.stringify(schema));
const prompt = `You are an acceptance-test executor, not a code author. Execute the manual checklist below against a real browser using ONLY the checklist_browser MCP tools. Do not use shell commands, read application code, write code, or delegate. Each case starts with begin_case(id) in a fresh context. Inspect snapshots and choose roles/names yourself. For EVERY expected result use verify to record an explicit check. Use separate checks for separate expected facts. Do not merely infer success from action completion. If a step fails, record failure, continue with any useful verification of that failure, then move to the next independent case. Never change requirements, repair the app, retry a failed case, or weaken checks. A browser error or failed verification means that case cannot pass. Do not stop after the first case failure. Finish with JSON matching the schema, one result per checklist ID.\n\n${JSON.stringify(checklist, null, 2)}`;
await writeFile(join(output, 'prompt.txt'), prompt);
await writeFile(join(output, 'checklist.json'), JSON.stringify(checklist, null, 2));

const reservation = createServer();
await new Promise<void>(resolve => reservation.listen(0, '127.0.0.1', resolve));
const address = reservation.address();
if (!address || typeof address === 'string') throw new Error('Cannot reserve test port');
const port = address.port;
await new Promise<void>((resolve, reject) => reservation.close(error => error ? reject(error) : resolve()));
const url = `http://127.0.0.1:${port}`;
const serverLog = Bun.file(join(output, 'server.log'));
const server = Bun.spawn([process.execPath, join(root, 'node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { cwd: root, stdout: serverLog, stderr: serverLog });
let agent: ReturnType<typeof Bun.spawn> | undefined;
let timedOut = false;
let timer: ReturnType<typeof setTimeout> | undefined;
try {
  let ready = false;
  const startupDeadline = Date.now() + 10_000;
  while (Date.now() < startupDeadline) {
    if (server.exitCode !== null) throw new Error('Vite exited; inspect server.log');
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(500) });
      if (response.ok && (await response.text()).includes('Fieldnotes')) { ready = true; break; }
    } catch {}
    await Bun.sleep(100);
  }
  if (!ready) throw new Error('App failed to start within 10 seconds');
  const mcpEnv = {
    TEST_APP_URL: url + (broken ? '/?fault=completion' : '/'),
    TEST_ARTIFACT_DIR: output,
    TEST_CHECKLIST: checklistPath,
  };
  const toml = (value: string) => JSON.stringify(value);
  const mcpConfig = `mcp_servers.checklist_browser={command=${toml(process.execPath)},args=[${toml(join(root, 'tools/browser-mcp.ts'))}],env={${Object.entries(mcpEnv).map(([k,v]) => `${k}=${toml(v)}`).join(',')}},startup_timeout_sec=30,tool_timeout_sec=30}`;
  agent = Bun.spawn([
    'codex', 'exec', '--ignore-user-config', '--ephemeral', '--skip-git-repo-check',
    '--sandbox', 'read-only', '--model', model,
    '-c', 'forced_login_method="chatgpt"', '-c', 'model_reasoning_effort="low"',
    '-c', 'features.shell_tool=false', '-c', mcpConfig,
    '--json', '--output-schema', schemaPath, '--output-last-message', join(output, 'agent-summary.json'), '-',
  ], { cwd: workspace, env, stdin: 'pipe', stdout: 'pipe', stderr: Bun.file(join(output, 'codex-stderr.log')) });
  const input = agent.stdin;
  if (!input || typeof input === 'number') throw new Error('Codex stdin unavailable');
  input.write(prompt);
  input.end();
  timer = setTimeout(() => { timedOut = true; agent?.kill(); }, 300_000);
  const eventLog = Bun.file(join(output, 'codex-events.jsonl')).writer();
  const reader = agent.stdout as ReadableStream<Uint8Array>;
  let pending = '';
  for await (const chunk of reader) {
    const text = new TextDecoder().decode(chunk);
    eventLog.write(text);
    pending += text;
    const lines = pending.split('\n'); pending = lines.pop()!;
    for (const line of lines) {
      try {
        const event = JSON.parse(line);
        if (event.type === 'item.started' && event.item?.type === 'mcp_tool_call') console.log(`  agent → ${event.item.tool}`);
        if (event.type === 'error' || event.type === 'turn.failed') console.error(JSON.stringify(event));
      } catch {}
    }
  }
  await eventLog.end();
  const exitCode = await agent.exited;
  clearTimeout(timer);
  const rawEvents = await readFile(join(output, 'browser-events.jsonl'), 'utf8').catch(() => '');
  const events = rawEvents.trim() ? rawEvents.trim().split('\n').map(line => JSON.parse(line)) : [];
  let summary: any = null;
  try { summary = JSON.parse(await readFile(join(output, 'agent-summary.json'), 'utf8')); } catch {}
  const cases = checklist.cases.map(testCase => {
    const evidence = events.filter(event => event.caseId === testCase.id);
    const checks = evidence.filter(event => event.tool === 'verify');
    const failures = evidence.filter(event => event.passed === false || event.success === false);
    const agentResult = summary?.cases?.find((c: any) => c.id === testCase.id);
    const status = failures.length ? 'failed' : exitCode !== 0 || !agentResult || !checks.length || agentResult.status === 'blocked' ? 'blocked' : agentResult.status === 'passed' ? 'passed' : 'failed';
    return { id: testCase.id, name: testCase.name, status, checks: checks.length, failures: failures.length, reason: agentResult?.reason ?? 'No complete agent result. Inspect codex-stderr.log and events.', evidence };
  });
  const passed = !timedOut && exitCode === 0 && cases.every(testCase => testCase.status === 'passed');
  const report = { runName, model, authentication: 'ChatGPT subscription', broken, timedOut, codexExitCode: exitCode, passed, cases, agentSummary: summary };
  await writeFile(join(output, 'report.json'), JSON.stringify(report, null, 2));
  const escape = (value: unknown) => String(value).replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]!));
  const html = `<!doctype html><html lang="en"><meta charset="UTF-8"><title>Codex checklist report</title><style>body{font:16px system-ui;background:#f3f4ed;color:#24362f;max-width:1000px;margin:40px auto;padding:20px}article{background:white;padding:24px;border-radius:16px;margin:20px 0}img{width:100%;max-width:420px;border:1px solid #ddd}summary{cursor:pointer}pre{white-space:pre-wrap;font-size:12px}.passed{color:#267341}.failed,.blocked{color:#ad3939}</style><h1>Codex checklist report</h1><p>${escape(runName)} · ${escape(model)} · ChatGPT subscription login</p><h2 class="${passed ? 'passed' : 'failed'}">${passed ? 'PASS' : 'FAIL / BLOCKED'}</h2><p>${broken ? 'Deliberate checkbox fault enabled.' : 'Healthy application.'} Browser evidence determines the result; the agent cannot erase a failed check.</p>${cases.map(testCase => `<article><h2 class="${testCase.status}">${escape(testCase.status.toUpperCase())} · ${escape(testCase.name)}</h2><p>${escape(testCase.reason)}</p><p>${testCase.checks} checks · ${testCase.failures} failed operations/checks</p>${testCase.evidence.filter(event => event.tool === 'verify').map(event => `<details><summary>${event.passed ? '✓' : '✗'} ${escape(event.description)}</summary><p>Actual: ${escape(JSON.stringify(event.actual))}</p><a href="${escape(event.screenshot)}"><img src="${escape(event.screenshot)}" alt="Browser evidence"></a><pre>${escape(event.snapshot)}</pre></details>`).join('')}</article>`).join('')}<p>Raw evidence: <a href="report.json">report.json</a> · <a href="browser-events.jsonl">browser-events.jsonl</a> · <a href="codex-events.jsonl">Codex events</a></p></html>`;
  await writeFile(join(output, 'report.html'), html);
  await writeFile(join(root, 'artifacts', 'latest.json'), JSON.stringify({ runName, report: join(output, 'report.html'), passed }, null, 2));
  for (const testCase of cases) console.log(`${testCase.status.toUpperCase()}: ${testCase.name} (${testCase.checks} checks)`);
  console.log(`Review: ${join(output, 'report.html')}`);
  process.exitCode = passed ? 0 : 1;
} finally {
  if (timer) clearTimeout(timer);
  if (agent && agent.exitCode === null) { agent.kill(); await agent.exited; }
  server.kill(); await server.exited;
  await rm(workspace, { recursive: true, force: true });
}
