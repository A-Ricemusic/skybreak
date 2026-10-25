import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { chromium } from 'playwright';
import type { Browser, BrowserContext, Page } from 'playwright';
import { z } from 'zod';
import { appendFileSync, readFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const baseURL = process.env.TEST_APP_URL!;
const output = process.env.TEST_ARTIFACT_DIR!;
const checklist = JSON.parse(readFileSync(process.env.TEST_CHECKLIST!, 'utf8'));
if (!baseURL || !output || !baseURL.startsWith('http://127.0.0.1:')) throw new Error('Local runner configuration required');
mkdirSync(output, { recursive: true });
let browser: Browser | undefined;
let context: BrowserContext | undefined;
let page: Page | undefined;
let caseId = '';
let sequence = 0;
let actions = 0;
const server = new McpServer({ name: 'checklist-browser', version: '1.0.0' });
const roles = z.enum(['button', 'checkbox', 'textbox', 'combobox', 'status', 'alert', 'heading', 'list', 'listitem']);
const targetSchema = z.object({ role: roles, name: z.string().optional().describe('Exact accessible name from the snapshot; omit for unnamed status or alert') });
type Target = z.infer<typeof targetSchema>;
function target(t: Target) {
  if (!page) throw new Error('Call begin_case first');
  return page.getByRole(t.role, t.name === undefined ? {} : { name: t.name, exact: true });
}
async function snapshot() { return page ? await page.locator('body').ariaSnapshot() : 'No case started'; }
function record(data: Record<string, unknown>) {
  const entry = { sequence: ++sequence, time: new Date().toISOString(), caseId, ...data };
  appendFileSync(join(output, 'browser-events.jsonl'), JSON.stringify(entry) + '\n');
  return entry;
}
function result(data: unknown, isError = false) { return { content: [{ type: 'text' as const, text: JSON.stringify(data) }], isError }; }

server.registerTool('begin_case', {
  description: 'Start a checklist case in a fresh browser context with empty storage. Call once per case. Returns the current accessible UI snapshot.',
  inputSchema: { id: z.string() },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
}, async ({ id }) => {
  if (!checklist.cases.some((c: { id: string }) => c.id === id)) return result({ error: 'Unknown checklist case' }, true);
  if (caseId === id) return result({ error: 'Do not restart a case to erase a failure' }, true);
  await context?.close();
  browser ??= await chromium.launch({ headless: true });
  context = await browser.newContext({ viewport: { width: 1100, height: 1000 } });
  page = await context.newPage();
  caseId = id;
  await page.goto(baseURL);
  await page.getByRole('heading', { level: 1 }).waitFor();
  const state = await snapshot();
  record({ tool: 'begin_case', id, snapshot: state });
  return result({ snapshot: state });
});
server.registerTool('observe', {
  description: 'Read the current browser accessible UI. Use its roles and names to choose targets.', inputSchema: {},
  annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
}, async () => {
  const state = await snapshot(); record({ tool: 'observe', snapshot: state }); return result({ snapshot: state });
});
server.registerTool('act', {
  description: 'Perform one browser action on an observed role and accessible name. Reload requires no target. Returns a fresh snapshot. No application-specific actions or selectors are provided.',
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  inputSchema: { action: z.enum(['fill', 'click', 'check', 'select', 'reload']), target: targetSchema.optional(), value: z.string().optional() },
}, async args => {
  try {
    if (++actions > 80) throw new Error('Browser action budget exceeded');
    if (!page) throw new Error('Call begin_case first');
    if (args.action === 'reload') await page.reload();
    else {
      if (!args.target) throw new Error('Action requires a target');
      const locator = target(args.target);
      if (args.action === 'fill') await locator.fill(args.value ?? '', { timeout: 4000 });
      if (args.action === 'click') await locator.click({ timeout: 4000 });
      if (args.action === 'check') await locator.check({ timeout: 4000 });
      if (args.action === 'select') await locator.selectOption({ label: args.value ?? '' }, { timeout: 4000 });
    }
    const state = await snapshot();
    record({ tool: 'act', ...args, success: true, snapshot: state });
    return result({ success: true, snapshot: state });
  } catch (error) {
    const message = String(error);
    record({ tool: 'act', ...args, success: false, error: message, snapshot: await snapshot() });
    return result({ success: false, error: message, snapshot: await snapshot() }, true);
  }
});
server.registerTool('verify', {
  description: 'Record a deterministic browser assertion and screenshot as test evidence. Use for EVERY expected result. A failed check permanently fails its case. Do not replace it with a weaker check.',
  annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  inputSchema: { description: z.string(), target: targetSchema, condition: z.enum(['visible', 'checked', 'unchecked', 'text', 'count']), expectedText: z.string().optional(), expectedCount: z.number().int().nonnegative().optional() },
}, async args => {
  let passed = false;
  let actual: unknown;
  try {
    const locator = target(args.target);
    if (args.condition === 'visible') { actual = await locator.isVisible(); passed = actual === true; }
    if (args.condition === 'checked' || args.condition === 'unchecked') { actual = await locator.isChecked({ timeout: 4000 }); passed = actual === (args.condition === 'checked'); }
    if (args.condition === 'text') { actual = await locator.innerText({ timeout: 4000 }); passed = actual === args.expectedText; }
    if (args.condition === 'count') { actual = await locator.count(); passed = actual === args.expectedCount; }
  } catch (error) { actual = String(error); }
  const screenshot = `${String(sequence + 1).padStart(3, '0')}-${caseId}.png`;
  await page?.screenshot({ path: join(output, screenshot), fullPage: true });
  record({ tool: 'verify', ...args, passed, actual, screenshot, snapshot: await snapshot() });
  return result({ passed, actual, screenshot }, !passed);
});
async function close() { await browser?.close(); process.exit(0); }
process.on('SIGTERM', close);
process.on('SIGINT', close);
process.stdin.on('end', close);
await server.connect(new StdioServerTransport());
