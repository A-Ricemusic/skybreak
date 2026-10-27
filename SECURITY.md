# Security policy

## Reporting a vulnerability

Report vulnerabilities privately to the repository owner, [A-Ricemusic](https://github.com/A-Ricemusic), through [GitHub security advisories](https://github.com/A-Ricemusic/skybreak/security/advisories/new). Include affected components, reproduction steps, and the potential impact, with credentials and other sensitive data removed. Do not disclose vulnerabilities or credentials in public issues, pull requests, or CI logs. If private reporting is unavailable, the owner must enable it in the repository's security settings before a report is submitted.

## GitHub Actions secrets

The repository stores these names in GitHub Actions secrets (Settings → Secrets and variables → Actions):

| Name | Purpose |
| --- | --- |
| `ROBLOX_API_KEY` | Roblox Open Cloud authentication for publishing and the manually dispatched voice diagnostics and audio permission repair workflows. |
| `ROBLOX_UNIVERSE_ID` | Deployment universe identifier; workflows prefer the repository variable of the same name when present. |
| `ROBLOX_PLACE_ID` | Deployment place identifier; workflows prefer the repository variable of the same name when present. |

The identifiers are configuration, not authentication credentials. Keep API key values out of the repository, issues, pull requests, artifacts, and logs. Child agents and CI jobs must never print keys, dump secret-bearing environments or request headers, or enable shell tracing around credentials. GitHub's log masking is a fallback, not permission to print a key. Revoke and replace any exposed key and remove exposed copies.

## Least privilege and workflow boundaries

Scope the Roblox Open Cloud key to the official SKYBREAK experience and only the resources and operations needed. Publishing needs universe-places write access for the target experience. Voice metadata diagnostics need `asset:read` only for the relevant assets; executing audio permission repairs needs `asset-permissions:write` and authority over the affected assets and target universe. Do not add unrelated account-wide access or asset creation/upload permissions for these workflows. Review and remove diagnostic or repair permissions when no longer required.

GitHub Actions tokens use top-level `contents: read`; any future elevation must be justified and limited to the job that needs it. Checkouts must set `persist-credentials: false` unless a reviewed job explicitly requires authenticated Git operations. Pin external actions to full commit SHAs with version comments, keep job timeouts bounded, and serialize publishes with `cancel-in-progress: false` so a new run does not interrupt publication.

Pull-request validation, including fork PRs, must run without repository secrets or privileged tokens. Do not introduce `pull_request_target` execution of PR code. Pass untrusted event fields or dispatch inputs through environment variables and quote them in shell scripts instead of interpolating expressions into `run:`. Keep secrets scoped to the steps that use them. Publishing remains gated by validation on pushes to `main` or manual dispatch; diagnostics and permission repairs remain manual, and repair dry runs receive no API key.

## Blender-origin asset uploads

Blender-origin asset uploads require the independent review gate described in [AGENTS.md](AGENTS.md). Complete that review before uploading; CI success or the generating agent's own review does not replace the independent gate. If the gate is absent from your checkout, obtain the owner's independent review instructions before uploading.
