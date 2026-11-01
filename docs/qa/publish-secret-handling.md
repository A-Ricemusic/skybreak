# Publish diagnostics and secret handling

Publication fails when CI publish configuration is missing; a successful build alone does not count as a successful publication. On failure the publish script reports only the HTTP status. On HTTP 200 it parses a positive integer `versionNumber` with isolated Python and prints that version; it never prints raw response text. The body stays in the private temp directory until cleanup. It disables curl user configuration and shell tracing, strips only trailing CR/LF from the API key, rejects interior controls, sends the API header through stdin, and bounds connection/request time.

Both voice freshness and asset authorization inspect the same private place snapshot. Every retry repeats asset authorization. Audio uploads remain disabled, and independent model approval and HALT checks remain mandatory.

Legacy ElevenLabs generation errors report status or a generic transport/format failure instead of remote response text. Retry-After remains available to the shared HTTP retry logic. No real uploads or credentials are required for the regression tests in `tools/tests/test_publish_secret_audit.py`.
