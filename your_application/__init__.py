"""Shim package used only to satisfy hosting providers that run a default
command like `gunicorn your_application.wsgi` when a start command isn't set.

This package intentionally stays minimal: the real Flask app lives in
`server.py` at the repo root. This shim exposes a WSGI callable named
`application` so gunicorn with no explicit variable will find it.
"""

