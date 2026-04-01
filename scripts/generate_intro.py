#!/usr/bin/env python3
"""Generate localized menu introductions from JSON data.

Usage:
  python3 generate_intro.py --lang en [--id ITEM_ID]
  python3 generate_intro.py --lang lo --all
  python3 generate_intro.py --lang hm --all

Notes:
- Hmong and Lao translations in the sample data are placeholders. Replace with reviewed translations.
"""

import argparse
import json
from pathlib import Path

BASE = Path('/Volumes/External/menu')
DATA_FILE = BASE / 'data' / 'sample_menu.json'

TEMPLATES = {
    'en': "{name} — {short_desc} Price: {price} {currency}. {cultural}",
    'lo': "{name} — {short_desc} ລາຄາ: {price} {currency}. {cultural}",
    'hm': "{name} — {short_desc} Price: {price} {currency}. {cultural}"
}

ASSUMPTIONS_NOTICE = (
    'Note: Lao and Hmong text may be placeholders; validate with a native speaker for production.'
)


def load_items(path=DATA_FILE):
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)


def format_intro(item, lang='en'):
    name = item.get('name', {}).get(lang) or item.get('name', {}).get('en')
    desc = item.get('description', {}).get(lang) or item.get('description', {}).get('en') or ''
    short_desc = desc.split('.')[0] if desc else ''
    cultural = item.get('cultural_notes', {}).get(lang) or item.get('cultural_notes', {}).get('en') or ''
    price = item.get('price', '')
    currency = item.get('currency', 'LAK')
    tpl = TEMPLATES.get(lang, TEMPLATES['en'])
    return tpl.format(name=name, short_desc=short_desc, price=price, currency=currency, cultural=cultural)


def find_item(items, item_id):
    for it in items:
        if it.get('id') == item_id:
            return it
    return None


def score_item(item, weather=None, feel=None, budget=None, category=None, styles=None):
    """Return a numeric score for how well `item` matches the requested conditions.

    Heuristic rules (simple, explainable):
    - Category and explicit style/tag matches get strong boost.
    - Weather/feel give bonuses for matching tags (e.g., 'salad' for hot days).
    - Budget can be numeric (max price) or level ('cheap','medium','expensive').
    """
    score = 0
    tags = [t.lower() for t in item.get('tags', [])]
    cat = (item.get('category') or '').lower()
    price = item.get('price') or 0

    # category exact match
    if category and cat == category.lower():
        score += 20

    # styles: tags like 'spicy', 'vegan', 'grilled', 'salad'
    if styles:
        for s in styles:
            if s.lower() in tags:
                score += 10

    # weather preferences
    if weather:
        w = weather.lower()
        if w == 'hot':
            if 'salad' in tags or 'grilled' in tags:
                score += 10
            if cat == 'staple' or 'soup' in tags:
                score -= 2
        elif w == 'cold':
            if 'stew' in tags or 'soup' in tags or cat == 'soup':
                score += 10
            if 'salad' in tags:
                score -= 2
        elif w == 'rainy':
            if 'grilled' in tags or 'stew' in tags or 'fried' in tags:
                score += 8

    # feel / mood
    if feel:
        f = feel.lower()
        if f == 'comfort':
            if cat == 'staple' or 'stew' in tags:
                score += 8
        elif f == 'festive' or f == 'celebration':
            if 'spicy' in tags or 'contains-fish' in tags:
                score += 6
        elif f == 'light' or f == 'refreshing':
            if 'salad' in tags or cat == 'starter' or 'vegan' in tags:
                score += 8

    # budget handling: either numeric max or level
    if budget:
        # try numeric
        try:
            max_price = float(budget)
            if price > max_price:
                return -9999  # exclude if over explicit max
            else:
                score += 5
        except Exception:
            b = budget.lower()
            if b == 'cheap':
                if price <= 10000:
                    score += 5
                else:
                    score -= 10
            elif b == 'medium':
                if 10000 < price <= 30000:
                    score += 5
            elif b == 'expensive':
                if price > 30000:
                    score += 5

    # avoid too spicy when user wants light
    if feel and feel.lower() in ('light', 'refreshing'):
        if (item.get('spice_level') or 0) >= 3:
            score -= 5

    return score


def filter_and_rank(items, weather=None, feel=None, budget=None, category=None, styles=None, top_n=None):
    scored = []
    for it in items:
        sc = score_item(it, weather=weather, feel=feel, budget=budget, category=category, styles=styles)
        # include items with non-negative score or when no filters applied
        if (weather or feel or budget or category or styles):
            if sc > -1000:
                scored.append((sc, it))
        else:
            # no filters: include all with neutral score
            scored.append((sc, it))

    # sort by score desc, tie-break by price ascending
    scored.sort(key=lambda x: (x[0], - (x[1].get('price') or 0)), reverse=True)
    results = [it for sc, it in scored]
    if top_n:
        results = results[:top_n]
    return results


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--lang', choices=['en', 'lo', 'hm'], default='en')
    p.add_argument('--id', help='item id to render')
    p.add_argument('--all', action='store_true', help='render all items')
    p.add_argument('--weather', choices=['hot', 'cold', 'rainy'], help='weather condition')
    p.add_argument('--feel', help='user feel/mood (comfort, festive, light, refreshing)')
    p.add_argument('--budget', help='budget as max numeric (e.g. 20000) or level: cheap, medium, expensive')
    p.add_argument('--category', help='filter by category (e.g., Main, Starter, Staple)')
    p.add_argument('--style', action='append', help='style/tag to prefer (can be repeated). e.g. --style spicy --style vegan')
    p.add_argument('--recommend', type=int, help='return top N recommended items (by score)')
    args = p.parse_args()

    items = load_items()

    outputs = []
    # direct id or all short-circuit
    if args.id:
        it = find_item(items, args.id)
        if not it:
            print(f'Item id {args.id} not found')
            return
        outputs = [format_intro(it, args.lang)]
    else:
        # apply filters/ranking if any conditional arguments provided
        if args.all or args.weather or args.feel or args.budget or args.category or args.style:
            ranked = filter_and_rank(items, weather=args.weather, feel=args.feel, budget=args.budget, category=args.category, styles=args.style, top_n=args.recommend)
            for it in ranked:
                outputs.append(format_intro(it, args.lang))
        else:
            # default: print all in requested language
            for it in items:
                outputs.append(format_intro(it, args.lang))

    for out in outputs:
        print(out)

    print('\n' + ASSUMPTIONS_NOTICE)


if __name__ == '__main__':
    main()
