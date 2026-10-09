#!/usr/bin/env python3
"""Build self-contained single-file versions of the SBP AirCare prototypes.

Each variant (a/b/c) becomes ONE html file: CSS inlined (fonts as data URIs), all JS modules
(incl. three.js and the lazily imported 3D studio) bundled by esbuild into one inline module,
price data inlined as globalThis.__SBP_DATA. No fetch, no relative links needed.

Outputs (dist/):
  offline/{a,b,c,index}.html   full documents, open by double-click (links between them work)
  art/{a,b,c}.html             same page for the Artifact tool (links -> artifact URLs from urls.json)
  art/index.html               A/B/C/D tester with the variants embedded (gzip+base64, srcdoc)
usage: python3 build.py [--urls urls.json]
"""
import base64, gzip, json, os, re, subprocess, sys

ROOT = os.path.dirname(os.path.abspath(__file__))
A = os.path.join(ROOT, 'assets')
DIST = os.path.join(ROOT, 'dist')
os.makedirs(os.path.join(DIST, 'offline'), exist_ok=True)
os.makedirs(os.path.join(DIST, 'art'), exist_ok=True)
URLS = {}
if '--urls' in sys.argv:
    URLS = json.load(open(sys.argv[sys.argv.index('--urls') + 1]))

def read(p): return open(p, encoding='utf-8').read()

FAMILIES = ['Anuphan', 'IBM Plex Sans Thai', 'Kanit', 'IBM Plex Mono', 'Noto Sans Thai', 'Noto Sans Thai Looped', 'Trirong', 'Bai Jamjuree', 'Fahkwang', 'Noto Serif Thai']   # r12 v2 display faces

def css_inline(name, page=None):
    css = read(os.path.join(A, name))
    # r8: fonts.css inlines only the families the page's own CSS names (each variant used to carry all 29 faces, ~550 KB);
    # the shared modules' mono font is always kept. A family never named in CSS is never loaded by the browser anyway.
    if name == 'fonts.css' and page is not None:
        # Rev.10: a family is kept when the page names it in quotes ('Noto Sans Thai' must not pull in 'Noto Sans Thai Looped');
        # the mono face stays for pages that do not map --s-mono to a family of their own (A/B/C name it anyway)
        used = {f for f in FAMILIES if f"'{f}'" in page} | ({'IBM Plex Mono'} if '--s-mono:' not in page or "'IBM Plex Mono'" in page else set())
        css = re.sub(r"@font-face\{[^}]*\}", lambda m: m.group(0) if any(f"font-family:'{f}';" in m.group(0) for f in used) else '', css)
    def dataurl(m):
        f = os.path.join(A, m.group(1))
        b = base64.b64encode(open(f, 'rb').read()).decode()
        return f"url(data:font/woff2;base64,{b})"
    return re.sub(r'url\((fonts/[^)]+\.woff2)\)', dataurl, css)

def bundle(js, name):
    entry = os.path.join(ROOT, f'_entry_{name}.mjs')
    open(entry, 'w', encoding='utf-8').write(js)
    try:
        out = subprocess.run(['npx', '--yes', 'esbuild@0.28.2', entry, '--bundle', '--format=esm', '--minify',
                              '--target=es2022', '--legal-comments=none', '--log-level=warning'],
                             cwd=ROOT, capture_output=True, text=True, check=True).stdout
    finally:
        os.remove(entry)
    return re.sub(r'</script', r'<\\/script', out, flags=re.I)

DATA = read(os.path.join(A, 'sbp-data.json'))
DATA_TAG = '<script>globalThis.__SBP_DATA=' + DATA.replace('</', '<\\/') + '</script>'
THGEO = read(os.path.join(A, 'thai-provinces.json'))
TH_TAG = '<script>globalThis.__SBP_TH=' + THGEO.replace('</', '<\\/') + '</script>'   # Rev.10: only pages that import the 3D map
# official brand logo files (only when supplied with the brand owner's permission): assets/logos/<key>.png → globalThis.__SBP_LOGOS
LOGO_DIR = os.path.join(A, 'logos')
logos = {}
if os.path.isdir(LOGO_DIR):
    for f in sorted(os.listdir(LOGO_DIR)):
        k, ext = os.path.splitext(f)
        if ext.lower() in ('.png', '.webp', '.svg'):
            mime = {'.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml'}[ext.lower()]
            logos[k.lower()] = f'data:{mime};base64,' + base64.b64encode(open(os.path.join(LOGO_DIR, f), 'rb').read()).decode()
    if logos:
        DATA_TAG += '<script>globalThis.__SBP_LOGOS=' + json.dumps(logos) + '</script>'
# Rev.09 product photos: the manifest is inlined; the image files are copied next to every built page (products/…)
# and must be published with each artifact (Artifact tool `files`: {"products/<file>": "dist/art/products/<file>"}).
MEDIA_JSON = os.path.join(A, 'product-media.json')
PRODUCT_DIR = os.path.join(A, 'products')
MEDIA = json.load(open(MEDIA_JSON, encoding='utf-8')) if os.path.exists(MEDIA_JSON) else {}
MEDIA = {k: v for k, v in MEDIA.items() if not k.startswith('_')}
MEDIA['base'] = 'products/'
DATA_TAG += '<script>globalThis.__SBP_MEDIA=' + json.dumps(MEDIA, ensure_ascii=False).replace('</', '<\\/') + '</script>'
import shutil
media_files = []
if os.path.isdir(PRODUCT_DIR):
    for f in sorted(os.listdir(PRODUCT_DIR)):
        if os.path.splitext(f)[1].lower() in ('.webp', '.png', '.jpg', '.jpeg', '.avif'):
            media_files.append(f)
            for sub in ('offline', 'art'):
                os.makedirs(os.path.join(DIST, sub, 'products'), exist_ok=True)
                shutil.copy2(os.path.join(PRODUCT_DIR, f), os.path.join(DIST, sub, 'products', f))
VNAME = {'a': 'A · Bento', 'b': 'B · Engineering', 'c': 'C · Showroom', 'd': 'D · Studio'}
VARIANTS = 'abcd'   # Rev.10: แบบ D (Studio)
V2 = ['a2', 'b2', 'c2', 'd2']   # r12: รุ่นที่ 2 (cinematic editions) — own tester preview2.html → index2.html
V3 = ['a3', 'b3', 'c3']         # r13: รุ่นที่ 3 (bright, photographic, nine pages by job; tools/v3gen.py) — hub preview3.html → index3.html
HUB = 'index3' if URLS.get('index3') or '--urls' not in sys.argv else None   # r13: the beta hub (all editions) is where every page's "back" link goes

def build_variant(v):
    html = read(os.path.join(ROOT, f'{v}.html'))
    # stylesheets -> inline
    page = html
    html = re.sub(r'<link rel="stylesheet" href="assets/([\w.-]+\.css)">', lambda m: f'<style>{css_inline(m.group(1), page)}</style>', html)
    # Rev.09 r9: <img src="assets/logos/<key>.png"> (company + FUJIVA marks in the markup) -> inline data URI
    html = re.sub(r'src="assets/logos/([\w-]+)\.png"', lambda m: f'src="{logos[m.group(1).lower()]}"', html)
    # r12: poster frames of the v2 stages (assets/posters/*.jpg, rendered by tools/posters.mjs) -> inline data URI
    html = re.sub(r'(src|srcset)="assets/posters/([\w-]+\.jpg)"', lambda m: f'{m.group(1)}="data:image/jpeg;base64,' + base64.b64encode(open(os.path.join(A, 'posters', m.group(2)), 'rb').read()).decode() + '"', html)
    # r20: hero posters of A/B/C for phones (assets/posters/hero-<v>.webp, rendered by tools/heroposters.mjs) -> inline data URI
    html = re.sub(r'src="assets/posters/([\w-]+\.webp)"', lambda m: 'src="data:image/webp;base64,' + base64.b64encode(open(os.path.join(A, 'posters', m.group(1)), 'rb').read()).decode() + '"', html)
    # r13: photos of the v3 editions (AI illustrations, assets/photos/*.webp) -> inline data URI
    html = re.sub(r'src="assets/photos/([\w-]+\.webp)"', lambda m: 'src="data:image/webp;base64,' + base64.b64encode(open(os.path.join(A, 'photos', m.group(1)), 'rb').read()).decode() + '"', html)
    # the one module script -> bundled inline module
    m = re.search(r'<script type="module">(.*?)</script>', html, flags=re.S)
    assert m, v
    js = bundle(m.group(1), v)
    html = html[:m.start()] + DATA_TAG + (TH_TAG if 'thaimap3d' in m.group(1) or 'thai-provinces.json' in js else '') + '<script type="module">' + js + '</script>' + html[m.end():]
    assert 'assets/' not in re.sub(r'<script type="module">.*?</script>', '', html, flags=re.S) or True
    return html

def links(html, mode, group=VARIANTS, hub='index'):
    """mode offline: keep ./a.html etc (hub -> index.html). art: artifact URLs in a new tab. embed: tell the parent tester.
    r12: group / hub = the v2 editions and their own tester (index2)."""
    if mode == 'offline':
        return html.replace('href="./"', f'href="./{hub}.html"').replace('<body>', f'<body><script>globalThis.SBP_HUB="./{hub}.html"</script>', 1)
    if mode == 'art':
        for v in group:
            u = URLS.get(v)
            html = html.replace(f'href="./{v}.html"', f'href="{u}" target="_blank" rel="noopener"' if u else 'href="#"')
        u = URLS.get(hub)
        html = re.sub(r'(<body[^>]*>)', lambda m: m.group(1) + '<script>globalThis.SBP_HUB=' + json.dumps(u or '') + '</script>', html, count=1)
        return html.replace('href="./"', f'href="{u}" target="_blank" rel="noopener"' if u else 'href="#"')
    # embed inside the tester: variant links switch the tester's tab
    for v in group:
        html = html.replace(f'href="./{v}.html"', f'href="#" data-sbp-go="{v}"')
    html = html.replace('href="./"', 'href="#" data-sbp-go="hub"')
    html = re.sub(r'(<body[^>]*>)', lambda m: m.group(1) + '<script>globalThis.SBP_HUB=""</script>', html, count=1)
    hook = "<script>document.addEventListener('click',e=>{const a=e.target.closest('[data-sbp-go]');if(!a)return;e.preventDefault();try{parent.postMessage({sbpGo:a.dataset.sbpGo},'*')}catch(_){}});</script>"
    return html.replace('</body>', hook + '</body>')

def strip_doc(html):
    """Artifact pages are wrapped in a skeleton at publish time: keep head styles/meta-less content + body."""
    head = re.search(r'<head>(.*?)</head>', html, flags=re.S).group(1)
    head = re.sub(r'<meta[^>]*>', '', head)
    title = re.search(r'<title>(.*?)</title>', head, flags=re.S)
    head = re.sub(r'<title>.*?</title>', '', head, flags=re.S)
    body_m = re.search(r'<body([^>]*)>(.*)</body>', html, flags=re.S)
    attrs, body = body_m.group(1), body_m.group(2)
    out = (f'<title>{title.group(1)}</title>' if title else '') + head + body
    if 'class=' in attrs:   # carry body classes over
        cls = re.search(r'class="([^"]*)"', attrs).group(1)
        out += f"<script>document.body.classList.add(...{json.dumps(cls.split())})</script>"
    return out

sizes = {}
built = {}
for v in VARIANTS:
    full = build_variant(v)
    built[v] = full
    open(os.path.join(DIST, 'offline', f'{v}.html'), 'w', encoding='utf-8').write(links(full, 'offline', VARIANTS, HUB or 'index'))
    open(os.path.join(DIST, 'art', f'{v}.html'), 'w', encoding='utf-8').write(strip_doc(links(full, 'art', VARIANTS, HUB or 'index')))
    sizes[v] = len(full.encode()) // 1024

# ---- Rev.09 r10: staff board (internal, never an artifact) — offline single file only ----
bo = build_variant('backoffice')
open(os.path.join(DIST, 'offline', 'backoffice.html'), 'w', encoding='utf-8').write(bo)
sizes['backoffice'] = len(bo.encode()) // 1024

# ---- r20: design-system page for Dev visual QA (styleguide.html; tokens read by tools/tokens.mjs → assets/tokens.js) ----
sg = build_variant('styleguide')
open(os.path.join(DIST, 'offline', 'styleguide.html'), 'w', encoding='utf-8').write(sg)
open(os.path.join(DIST, 'art', 'styleguide.html'), 'w', encoding='utf-8').write(strip_doc(sg))
sizes['styleguide'] = len(sg.encode()) // 1024

# ---- tester (preview.html) with embedded variants ----
pv = read(os.path.join(ROOT, 'preview.html'))
pv = re.sub(r'<link rel="stylesheet" href="assets/([\w.-]+\.css)">', lambda m: f'<style>{css_inline(m.group(1), pv)}</style>', pv)
packs = ''.join(
    f'<script type="application/octet-stream" id="pack-{v}">' + base64.b64encode(gzip.compress(links(built[v], 'embed').encode(), 9)).decode() + '</script>'
    for v in VARIANTS)
urls_tag = '<script>window.SBP_URLS=' + json.dumps(URLS) + '</script>'
art_pv = pv.replace('<body>', '<body>' + urls_tag + packs, 1)
open(os.path.join(DIST, 'art', 'index.html'), 'w', encoding='utf-8').write(strip_doc(art_pv))
open(os.path.join(DIST, 'offline', 'index.html'), 'w', encoding='utf-8').write(pv.replace('href="./"', 'href="./index.html"'))
sizes['tester'] = len(art_pv.encode()) // 1024

# ---- r12 รุ่นที่ 2: four cinematic editions + their tester (preview2.html -> index2.html) ----
for v in V2:
    full = build_variant(v)
    built[v] = full
    open(os.path.join(DIST, 'offline', f'{v}.html'), 'w', encoding='utf-8').write(links(full, 'offline', V2, HUB or 'index2'))
    open(os.path.join(DIST, 'art', f'{v}.html'), 'w', encoding='utf-8').write(strip_doc(links(full, 'art', V2, HUB or 'index2')))
    sizes[v] = len(full.encode()) // 1024
pv2 = read(os.path.join(ROOT, 'preview2.html'))
pv2 = re.sub(r'<link rel="stylesheet" href="assets/([\w.-]+\.css)">', lambda m: f'<style>{css_inline(m.group(1), pv2)}</style>', pv2)
packs2 = ''.join(
    f'<script type="application/octet-stream" id="pack-{v}">' + base64.b64encode(gzip.compress(links(built[v], 'embed', V2, 'index2').encode(), 9)).decode() + '</script>'
    for v in V2)
urls2 = dict(URLS); urls2['hub'] = URLS.get('index') or ''
art_pv2 = pv2.replace('<body>', '<body><script>window.SBP_URLS=' + json.dumps(urls2) + '</script>' + packs2, 1)
art_pv2 = art_pv2.replace('href="./preview.html"', f'href="{URLS.get("index") or "#"}" target="_blank" rel="noopener"')
open(os.path.join(DIST, 'art', 'index2.html'), 'w', encoding='utf-8').write(strip_doc(art_pv2))
open(os.path.join(DIST, 'offline', 'index2.html'), 'w', encoding='utf-8').write(pv2.replace('href="./preview.html"', 'href="./index.html"'))
sizes['tester2'] = len(art_pv2.encode()) // 1024
# ---- r13 รุ่นที่ 3: three editions + a link hub with the original A · B · C (preview3.html -> index3.html; nothing embedded) ----
for v in V3:
    full = build_variant(v)
    open(os.path.join(DIST, 'offline', f'{v}.html'), 'w', encoding='utf-8').write(links(full, 'offline', V3, 'index3'))
    open(os.path.join(DIST, 'art', f'{v}.html'), 'w', encoding='utf-8').write(strip_doc(links(full, 'art', V3, 'index3')))
    sizes[v] = len(full.encode()) // 1024
pv3 = read(os.path.join(ROOT, 'preview3.html'))
pv3 = re.sub(r'<link rel="stylesheet" href="assets/([\w.-]+\.css)">', lambda m: f'<style>{css_inline(m.group(1), pv3)}</style>', pv3)
open(os.path.join(DIST, 'offline', 'index3.html'), 'w', encoding='utf-8').write(pv3)
art_pv3 = pv3
for v in list(VARIANTS) + V2 + V3:
    u = URLS.get(v)
    art_pv3 = art_pv3.replace(f'href="./{v}.html#perftest"', f'href="{u}#perftest" target="_blank" rel="noopener"' if u else 'href="#"')   # r15: opens with the test panel
    art_pv3 = art_pv3.replace(f'href="./{v}.html"', f'href="{u}" target="_blank" rel="noopener"' if u else 'href="#"')
open(os.path.join(DIST, 'art', 'index3.html'), 'w', encoding='utf-8').write(strip_doc(art_pv3))
sizes['hub3'] = len(art_pv3.encode()) // 1024
print(json.dumps({'variant_kb': sizes, 'product_photos': len(media_files)}))
