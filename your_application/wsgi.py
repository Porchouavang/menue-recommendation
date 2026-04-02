"""WSGI entrypoint shim for hosting platforms that call
`gunicorn your_application.wsgi` by default.

It forwards the WSGI callable to the Flask `app` defined in `server.py`.
"""

try:
    # Import the Flask app from server.py and expose it as 'application'
    from server import app as application
except Exception:
    # If import fails, re-raise with a clearer message for debugging.
    raise
