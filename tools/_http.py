"""Shared HTTP opener for scripts that send API keys.

CPython's default redirect handler copies x-api-key / xi-api-key to any
redirect target, so keyed requests must never follow redirects.
"""
import urllib.request


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None  # Never forward the API key to another URL.


OPENER = urllib.request.build_opener(NoRedirect())


def open(request, timeout):
    return OPENER.open(request, timeout=timeout)
