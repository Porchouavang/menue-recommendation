Menu model for Lao & Hmong audiences

This small project provides:

- A JSON schema for a multilingual menu item (`schema/menu_schema.json`).
- A sample dataset with fields in English, Lao and Hmong (`data/sample_menu.json`).
- A small Python script to generate short localized introductions from the data (`scripts/generate_intro.py`).

Goals

- Make it easy to present culturally appropriate menu items to Lao and Hmong customers.
- Provide space for transliteration, pronunciation, cultural notes, allergens and pairing suggestions.

How to run

1. Ensure you have Python 3.8+ installed.
2. From a terminal run:

```bash
python3 /Volumes/External/menu/scripts/generate_intro.py --lang en
python3 /Volumes/External/menu/scripts/generate_intro.py --lang lo
python3 /Volumes/External/menu/scripts/generate_intro.py --lang hm --all
```

Web preview

1. Start a simple static server from the project root and open the web UI in a browser:

```bash
cd /Volumes/External/menu
python3 -m http.server 8000
# then open http://localhost:8000/web/index.html in your browser
```

The web UI allows selecting language, weather, mood, budget, category and styles, and shows ranked recommendations with brief explanations.

Notes and next steps

- The Hmong and Lao text in the sample file are placeholders. For production, have a native speaker review translations and pronunciations.
- Next improvements: add images, integrate with a web UI, or connect to a simple NMT model for automated translations (with human review).
