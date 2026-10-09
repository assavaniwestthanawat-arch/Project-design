#!/usr/bin/env python3
"""r13 รุ่นที่ 3 — builds a3.html, b3.html, c3.html (one page each, nine views by job; assets/v3site.js wires them).

The editions share every section (tools/v3/sections.html) so the content is the same — all A/B/C tools — and differ in art
direction: header, home page, type, palette, layout (tools/v3/<e>.css + tools/v3/home-<e>.html). Photos are AI
illustrations listed in assets/photos/photos.json; a photo is used once its file assets/photos/<name>.webp exists
(until then the layouts close up around the missing photo — no empty boxes). Every photo carries "ภาพประกอบ".
usage: python3 tools/v3gen.py        (re-run after adding photos or editing tools/v3/*)
"""
import html, json, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
T = os.path.join(ROOT, 'tools', 'v3')
PH = os.path.join(ROOT, 'assets', 'photos')
MAN = json.load(open(os.path.join(PH, 'photos.json'), encoding='utf-8'))['photos']
read = lambda p: open(p, encoding='utf-8').read()

def photo(name, cls='', attrs='', loading='lazy'):
    """<figure class="ph3"> with the photo — or nothing while the file is not there yet (no empty boxes: the layouts close up)."""
    meta = MAN.get(name, {})
    if not os.path.exists(os.path.join(PH, name + '.webp')):
        return ''
    ar = meta.get('ar', '4:3').replace(':', '/')
    alt = html.escape(meta.get('alt', ''), quote=True)
    return (f'<figure class="ph3 {cls}" style="--ar:{ar}"{attrs}><img src="assets/photos/{name}.webp" alt="{alt}" loading="{loading}" decoding="async">'
            f'<figcaption>ภาพประกอบ</figcaption></figure>')

def has(name): return os.path.exists(os.path.join(PH, name + '.webp'))

# page heading photos (site.js moves <figure data-sx-photo="view"> into the page heading) — only photos that exist
HEADS = {'shop': 'pg-shop', 'cleaning': 'pg-clean', 'install': 'pg-install', 'repair': 'pg-repair', 'business': 'pg-business', 'pricing': 'pg-pricing', 'guide': 'pg-guide', 'contact': 'pg-contact'}

EDITIONS = {
    'a3': dict(code='A3', name='แสงเช้า', title='SBP AirCare · แบบ A3 แสงเช้า'),
    'b3': dict(code='B3', name='คู่มือช่าง', title='SBP AirCare · แบบ B3 คู่มือช่าง'),
    'c3': dict(code='C3', name='โชว์รูม', title='SBP AirCare · แบบ C3 โชว์รูม'),
}
CSS = ['fonts.css', 'shared.css', 'business.css', 'booking.css', 'studio.css', 'services.css', 'v3.css']

def page(e, cfg):
    sections = read(os.path.join(T, 'sections.html'))
    home = read(os.path.join(T, f'home-{e}.html'))
    shell = read(os.path.join(T, f'shell-{e}.html'))
    css = read(os.path.join(T, f'{e}.css'))
    heads = '\n'.join(photo(n, 'sx-ph', f' data-sx-photo="{v}" hidden') for v, n in HEADS.items() if has(n))
    vsw = ''.join(f'<a href="./{k}.html"' + (' aria-current="page"' if k == e else '') + f'>{EDITIONS[k]["code"]}</a>' for k in EDITIONS)
    out = shell
    for k, v in {'TITLE': cfg['title'], 'CODE': cfg['code'], 'NAME': cfg['name'], 'VSW': vsw, 'HOME': home, 'SECTIONS': sections, 'HEADS': heads,
                 'CSSLINKS': '\n'.join(f'<link rel="stylesheet" href="assets/{c}">' for c in CSS), 'CSS': css}.items():
        out = out.replace('{{' + k + '}}', v)
    out = re.sub(r'\{\{photo:([\w-]+)(?:\|([\w -]*))?(?:\|(eager))?\}\}', lambda m: photo(m.group(1), m.group(2) or '', loading='eager' if m.group(3) else 'lazy'), out)
    assert '{{' not in out, re.findall(r'\{\{[^}]*\}\}', out)[:3]
    return out

if __name__ == '__main__':
    for e, cfg in EDITIONS.items():
        open(os.path.join(ROOT, f'{e}.html'), 'w', encoding='utf-8').write(page(e, cfg))
        print(f'{e}.html', 'photos:', sum(has(n) for n in MAN), '/', len(MAN))
