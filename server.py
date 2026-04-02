"""Small image-search proxy using Google Custom Search JSON API.

Usage:
  1. Create a Google API key and a Custom Search Engine (CSE) with Image Search enabled.
  2. Set environment variables:
       export GOOGLE_API_KEY=your_key
       export GOOGLE_CX=your_search_engine_id
  3. Install dependencies and run:
       pip install -r requirements.txt
       python3 server.py

The server exposes a single endpoint:
  GET /api/image?q=SEARCH_TERMS
Returns JSON: {"image": "https://..."} or HTTP 400/500 with error message.

Security notes: API keys will be sent from this server to Google. Do not expose keys in client-side code.
"""

from flask import Flask, request, jsonify, send_from_directory
import os
import requests
from flask_cors import CORS
import os
import requests

# Serve the static web UI from the `web/` directory at the project root.
# This allows the root URL (/) to return `web/index.html` and static assets
# (CSS/JS/images) to be fetched by the browser. Hosting platforms that route
# to the WSGI app will now show the client UI instead of a 404 at '/'.
app = Flask(__name__)
CORS(app)

GOOGLE_API_KEY = os.environ.get('GOOGLE_API_KEY')
GOOGLE_CX = os.environ.get('GOOGLE_CX')

@app.route('/api/image')
def image_search():
    q = request.args.get('q', '').strip()
    if not q:
        return jsonify({'error': 'missing q parameter'}), 400
    if not GOOGLE_API_KEY or not GOOGLE_CX:
        return jsonify({'error': 'server not configured with GOOGLE_API_KEY and GOOGLE_CX'}), 400

    params = {
        'key': GOOGLE_API_KEY,
        'cx': GOOGLE_CX,
        'q': q,
        'searchType': 'image',
        'num': 1,
    }
    try:
        r = requests.get('https://www.googleapis.com/customsearch/v1', params=params, timeout=10)
        r.raise_for_status()
        data = r.json()
        items = data.get('items') or []
        if not items:
            return jsonify({'image': None}), 200
        first = items[0]
        link = first.get('link')
        return jsonify({'image': link}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/health')
def health():
    # Simple health-check for hosting platforms
    return jsonify({'status':'ok'}), 200


# Static file routes for the client-side web UI
@app.route('/')
def index():
    # Serve the main HTML page
    return send_from_directory('web', 'index.html')


@app.route('/<path:filename>')
def web_static(filename):
    # Try to serve any static asset from the `web/` folder (css, js, images).
    # If the file is not found, fall back to index.html for SPA-style routing.
    try:
        return send_from_directory('web', filename)
    except Exception:
        return send_from_directory('web', 'index.html')

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    print(f'Starting image proxy on http://0.0.0.0:{port} (requires GOOGLE_API_KEY & GOOGLE_CX)')
    app.run(host='0.0.0.0', port=port)
