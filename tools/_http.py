"""Shared, TLS-verified HTTP helpers for scripts that send API keys.

Keyed requests never follow redirects. The JSON helper also bounds responses,
retries and elapsed time, and never puts remote text or credentials in errors.
"""
from __future__ import annotations

from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
import http.client
import json
import math
from pathlib import Path
import time
from typing import Any, Callable
import urllib.error
import urllib.request

MAX_RESPONSE_BYTES = 1_048_576
MAX_ATTEMPTS = 3
MAX_RETRY_DELAY = 30.0


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None  # Never forward the API key to another URL.


# Keep the default HTTPS handler: certificate/hostname verification stays on.
OPENER = urllib.request.build_opener(NoRedirect())


class HTTPFailure(RuntimeError):
    """Safe HTTP failure; deliberately retains no request, headers or body."""

    def __init__(self, message: str, status: int | None = None):
        super().__init__(message)
        self.status = status


def open(request: urllib.request.Request, timeout: float):
    try:
        return OPENER.open(request, timeout=timeout)
    except urllib.error.HTTPError as error:
        # Legacy generation callers also use open(). Keep retry status, but
        # discard remote reason/body/URL text before it reaches their logs.
        status = error.code
        retry_after = error.headers.get("Retry-After") if error.headers else None
        error.close()
        headers = {"Retry-After": retry_after} if retry_after else {}
        raise urllib.error.HTTPError(request.full_url, status, "HTTP request failed", headers, None) from None
    except (OSError, urllib.error.URLError, http.client.HTTPException, ValueError):
        raise HTTPFailure("HTTP transport failed") from None


def read_key_file(path: Path) -> str:
    """Read a small secret file without echoing its path or contents on failure."""
    try:
        with path.open("rb") as source:
            content = source.read(8193)
        key = content.decode("ascii").strip()
    except (OSError, UnicodeError, ValueError):
        raise RuntimeError("Unable to read API key file") from None
    if not key or len(content) > 8192 or any(not 33 <= ord(c) <= 126 for c in key):
        raise RuntimeError("API key file must contain a nonempty single-line key")
    return key


def remaining(deadline: float) -> float:
    seconds = deadline - time.monotonic()
    if seconds <= 0:
        raise HTTPFailure("Roblox request/poll deadline exceeded; re-run to resume") from None
    return seconds


def _retry_delay(value: str | None, attempt: int) -> float:
    delay = 2.0 ** attempt
    if value:
        try:
            retry_after = float(value)
            if not math.isfinite(retry_after) or retry_after < 0:
                raise ValueError
        except ValueError:
            try:
                date = parsedate_to_datetime(value)
                retry_after = (date - datetime.now(timezone.utc)).total_seconds()
            except (ValueError, TypeError, OverflowError):
                retry_after = 0.0
        delay = max(delay, retry_after)
    return delay


def request_json(request: urllib.request.Request, *, timeout: float = 90,
                 deadline: float | None = None,
                 before_attempt: Callable[[], None] | None = None) -> dict[str, Any]:
    """Fetch bounded JSON with safe errors and a finite retry/deadline budget.

    Only reads retry 5xx. A failed upload POST may already have created an asset;
    retrying it would bypass the caller's ambiguous-submission journal. A 429
    explicitly refuses the request, so all methods may retry that status.
    """
    if deadline is None:
        deadline = time.monotonic() + timeout * MAX_ATTEMPTS + MAX_RETRY_DELAY * (MAX_ATTEMPTS - 1)
    for attempt in range(MAX_ATTEMPTS):
        if before_attempt is not None:
            before_attempt()
        try:
            with open(request, timeout=min(timeout, remaining(deadline))) as response:
                chunks = []
                size = 0
                while True:
                    remaining(deadline)
                    # HTTPResponse.read1 returns after one buffered/socket read,
                    # allowing the deadline check even when a body trickles in.
                    read = getattr(response, "read1", response.read)
                    chunk = read(min(65536, MAX_RESPONSE_BYTES + 1 - size))
                    if not chunk:
                        break
                    chunks.append(chunk)
                    size += len(chunk)
                    if size > MAX_RESPONSE_BYTES:
                        raise HTTPFailure("Roblox JSON response exceeds size limit")
                remaining(deadline)
                result = json.loads(b"".join(chunks))
                if not isinstance(result, dict):
                    raise HTTPFailure("Roblox returned an invalid JSON object")
                return result
        except urllib.error.HTTPError as error:
            status = error.code
            delay = _retry_delay(error.headers.get("Retry-After") if error.headers else None, attempt)
            error.close()  # Do not read/log even a prefix: it may echo the key.
            retryable = status == 429 or (500 <= status <= 599 and request.get_method() in ("GET", "HEAD"))
            if not retryable or attempt + 1 == MAX_ATTEMPTS or delay > MAX_RETRY_DELAY:
                raise HTTPFailure(f"Roblox HTTP {status}", status) from None
            if delay >= remaining(deadline):
                raise HTTPFailure("Roblox retry exceeds request/poll deadline", status) from None
            time.sleep(delay)
        except (OSError, urllib.error.URLError, http.client.HTTPException):
            raise HTTPFailure("Roblox HTTP transport failed; submission may be unresolved") from None
        except (ValueError, UnicodeError, RecursionError):
            raise HTTPFailure("Roblox returned invalid JSON or request data") from None
    raise HTTPFailure("Roblox HTTP retry limit exceeded")
