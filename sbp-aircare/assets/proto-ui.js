// SBP AirCare prototype — shared UI behaviours. Each variant supplies its own markup/CSS
// and small template functions; the logic (state, filtering, estimating, 3D wiring) lives here once.
import {
  DEMO, TYPES, TYPE_BY_ID, BRANDS, BRAND_BY_ID, BTU_BANDS, PRICE_BANDS, emptyFilter, queryCatalog, facetCounts,
  baht, btuFmt, checkZone, TIER_TH, estimateContract, PRESETS, recommendBtu, h, $, $$, countUp, reduceMotion,
  CLEAN_PKGS, SIZE_BANDS, DATA, TRAVEL, stockTh, travelNote, VOLUME_HINT, VOLUME_TIERS, vatOf, incVat,
} from './sbp-core.js';
import { createACViewer, createRoomSim, PARTS } from './ac3d.js';
import { whenCalm } from './gl-pool.js';

export { DEMO, TYPES, TYPE_BY_ID, BRANDS, BRAND_BY_ID, baht, btuFmt, h, $, $$, countUp, reduceMotion, PARTS, stockTh, incVat };

/* ---------------- Catalog ---------------- */
export function mountCatalog(root, cfg) {
  const f = emptyFilter();
  const sel = new Map();           // model id -> chosen sku index
  const compare = new Map();       // model id -> sku
  let page = 1; const per = cfg.pageSize || 12;
  let view = cfg.view || 'grid';
  const els = {
    search: $('[data-cat-search]', root), facets: $('[data-cat-facets]', root), chips: $('[data-cat-chips]', root),
    count: $('[data-cat-count]', root), grid: $('[data-cat-grid]', root), more: $('[data-cat-more]', root),
    sort: $('[data-cat-sort]', root), tray: $('[data-compare]', document), sheetBtn: $('[data-cat-sheet-open]', root),
    sheet: $('[data-cat-sheet]', root), sheetClose: $$('[data-cat-sheet-close]', root), sheetApply: $('[data-cat-sheet-apply]', root),
  };
  const groups = [
    { key: 'type', th: 'ประเภท', opts: TYPES.map(t => ({ id: t.id, th: t.th, dot: t.color })) },
    { key: 'btu', th: 'ขนาด BTU', opts: BTU_BANDS.map(b => ({ id: b.id, th: b.th })) },
    { key: 'brand', th: 'แบรนด์', opts: BRANDS.map(b => ({ id: b.id, th: b.name, own: b.own })), collapsible: 8 },
    { key: 'price', th: 'ราคาเครื่อง (ก่อน VAT)', opts: PRICE_BANDS.map(b => ({ id: b.id, th: b.th })) },
    { key: 'inverter', th: 'ระบบ', opts: [{ id: 'inv', th: 'Inverter' }, { id: 'fix', th: 'Fixed speed' }], single: true },
  ];
  function renderFacets() {
    const c = facetCounts(f);
    els.facets.innerHTML = '';
    for (const g of groups) {
      const box = h('fieldset', { class: 'facet', 'data-key': g.key }, h('legend', {}, g.th));
      const list = h('div', { class: 'facet-opts' });
      g.opts.forEach((o, i) => {
        const on = g.single ? f.inverter === o.id : f[g.key].has(o.id);
        const n = c[g.key][o.id] ?? 0;
        const id = `f-${g.key}-${o.id}`;
        const inp = h('input', { type: 'checkbox', id, checked: on, disabled: !on && n === 0 });
        inp.addEventListener('change', () => {
          if (g.single) f.inverter = inp.checked ? o.id : '';
          else inp.checked ? f[g.key].add(o.id) : f[g.key].delete(o.id);
          page = 1; update();
        });
        const lab = h('label', { class: 'opt' + (o.own ? ' own' : '') + (g.collapsible && i >= g.collapsible ? ' more' : ''), for: id },
          inp, o.dot ? h('i', { class: 'dot', style: `background:${o.dot}` }) : null, h('span', {}, o.th), o.own ? h('b', { class: 'own-tag' }, 'แบรนด์เรา') : null, h('small', { class: 'n' }, String(n)));
        list.append(lab);
      });
      box.append(list);
      if (g.collapsible) {
        const t = h('button', { type: 'button', class: 'facet-more' }, `ดูทั้งหมด ${g.opts.length} แบรนด์`);
        t.addEventListener('click', () => { box.classList.toggle('open'); t.textContent = box.classList.contains('open') ? 'ย่อรายการ' : `ดูทั้งหมด ${g.opts.length} แบรนด์`; });
        box.append(t);
      }
      els.facets.append(box);
    }
  }
  function renderChips() {
    els.chips.innerHTML = '';
    const add = (label, fn) => els.chips.append(h('button', { type: 'button', class: 'chip', onclick: () => { fn(); page = 1; update(); } }, label, h('span', { 'aria-hidden': 'true' }, ' ×')));
    if (f.q) add(`“${f.q}”`, () => { f.q = ''; els.search.value = ''; });
    f.type.forEach(id => add(TYPE_BY_ID[id].th, () => f.type.delete(id)));
    f.btu.forEach(id => add(BTU_BANDS.find(b => b.id === id).th + ' BTU', () => f.btu.delete(id)));
    f.brand.forEach(id => add(BRAND_BY_ID[id].name, () => f.brand.delete(id)));
    f.price.forEach(id => add(PRICE_BANDS.find(b => b.id === id).th, () => f.price.delete(id)));
    if (f.inverter) add(f.inverter === 'inv' ? 'Inverter' : 'Fixed speed', () => { f.inverter = ''; });
    if (els.chips.children.length > 1) els.chips.append(h('button', { type: 'button', class: 'chip clear', onclick: () => { Object.assign(f, emptyFilter()); els.search.value = ''; page = 1; update(); } }, 'ล้างทั้งหมด'));
  }
  let lastQ;
  function renderGrid() {
    const q = queryCatalog(f); lastQ = q;
    els.count && (els.count.innerHTML = `<b>${q.list.length.toLocaleString()}</b> รุ่น · <b>${q.skuTotal.toLocaleString()}</b> SKU`);
    const shown = q.list.slice(0, page * per);
    els.grid.innerHTML = '';
    els.grid.dataset.view = view;
    if (!shown.length) {
      els.grid.append(h('div', { class: 'empty' }, h('strong', {}, 'ไม่พบรุ่นที่ตรงเงื่อนไข'), h('p', {}, 'ลองลดตัวกรองลง หรือส่งขนาดห้องมาให้ทีมขายแนะนำรุ่นให้'), h('button', { type: 'button', class: 'btn-ghost', onclick: () => { Object.assign(f, emptyFilter()); els.search.value = ''; update(); } }, 'ล้างตัวกรอง')));
    }
    shown.forEach((m, idx) => {
      const skus = q.visibleSkus(m);
      let si = Math.min(sel.get(m.id) ?? 0, skus.length - 1);
      const card = (view === 'table' ? cfg.rowTpl : cfg.cardTpl)(m, skus, si, {
        pick: (i) => { sel.set(m.id, i); renderGrid(); },
        open: () => cfg.onOpen && cfg.onOpen(m, skus[si]),
        compare: () => toggleCompare(m, skus[si]),
        inCompare: compare.has(m.id),
      });
      if (!reduceMotion() && idx >= (page - 1) * per) card.style.animationDelay = `${(idx % per) * 28}ms`;
      els.grid.append(card);
    });
    if (els.more) {
      els.more.hidden = shown.length >= q.list.length;
      els.more.textContent = `โหลดเพิ่ม (${Math.min(per, q.list.length - shown.length)} จาก ${q.list.length - shown.length} รุ่นที่เหลือ)`;
    }
  }
  function toggleCompare(m, sku) {
    if (compare.has(m.id)) compare.delete(m.id);
    else { if (compare.size >= 4) { cfg.toast && cfg.toast('เทียบได้สูงสุด 4 รุ่น'); return; } compare.set(m.id, { m, sku }); }
    renderTray(); renderGrid();
  }
  function renderTray() {
    if (!els.tray) return;
    els.tray.hidden = compare.size === 0;
    const list = $('[data-compare-list]', els.tray); list.innerHTML = '';
    compare.forEach(({ m, sku }, id) => list.append(h('li', {}, h('span', {}, `${BRAND_BY_ID[m.brand].name} ${m.series} · ${sku.btu / 1000}k`), h('button', { type: 'button', 'aria-label': 'เอาออก', onclick: () => { compare.delete(id); renderTray(); renderGrid(); } }, '×'))));
    const go = $('[data-compare-go]', els.tray); go.textContent = `เทียบ ${compare.size} รุ่น`;
    go.onclick = () => cfg.onCompare && cfg.onCompare([...compare.values()]);
  }
  // the address keeps #catalog only after the visitor filters (not on the first render, not while the catalog is hidden in another view — r5)
  let first = true;
  function update() { renderFacets(); renderChips(); renderGrid(); if (first) { first = false; return; } if (!els.grid.offsetParent) return; try { history.replaceState(null, '', location.pathname + location.search + '#catalog'); } catch (e) {} }
  let t;
  els.search && els.search.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { f.q = els.search.value.trim(); page = 1; update(); }, 160); });
  els.sort && els.sort.addEventListener('change', () => { f.sort = els.sort.value; renderGrid(); });
  els.more && els.more.addEventListener('click', () => { page++; renderGrid(); });
  $$('[data-cat-view]', root).forEach(b => b.addEventListener('click', () => { view = b.dataset.catView; $$('[data-cat-view]', root).forEach(x => x.setAttribute('aria-pressed', x === b)); renderGrid(); }));
  els.sheetBtn && els.sheetBtn.addEventListener('click', () => { els.sheet.classList.add('open'); document.body.classList.add('lock'); });
  els.sheetClose.forEach(b => b.addEventListener('click', () => { els.sheet.classList.remove('open'); document.body.classList.remove('lock'); }));
  els.sheetApply && els.sheetApply.addEventListener('click', () => { els.sheet.classList.remove('open'); document.body.classList.remove('lock'); els.grid.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'start' }); });
  // skeleton first, then data (demonstrates the loading state)
  if (cfg.skeleton) { els.grid.innerHTML = ''; for (let i = 0; i < per; i++) els.grid.append(cfg.skeleton()); setTimeout(update, 650); } else update();
  return {
    setType: id => { f.type = new Set(id ? [id] : []); page = 1; update(); },
    setQuery: q => { f.q = q; els.search.value = q; page = 1; update(); },
    setBtu: btu => { const b = BTU_BANDS.find(b => btu >= b.min && btu <= b.max); f.btu = new Set(b ? [b.id] : []); page = 1; update(); },
    filter: f,
    facetsHtmlCount: () => groups.length,
  };
}

/* ---------------- Contract builder ---------------- */
export function mountBuilder(root, cfg = {}) {
  const units = { wall: 0, ceiling: 0, cassette: 0, floor: 0, duct: 0 };
  let visits = 3, high = false, zone = null, pkg = 'Standard Care', size = 0, deep = true, last = null;
  const out = k => $$(`[data-b-out="${k}"]`, root);
  // package / size / deep-clean controls (injected so every variant gets them)
  if (!$('[data-b-pkg]', root)) {
    const host = $('.opts, .bopts', root) || root;
    const ex = h('div', { class: 's-bx' },
      h('label', { class: 's-field' }, 'แพ็กเกจ', h('select', { id: `bx-pkg-${root.id || 'b'}`, 'data-b-pkg': '' }, CLEAN_PKGS.map(p => h('option', { value: p.id, selected: p.id === pkg }, p.th)))),
      h('label', { class: 's-field' }, 'ขนาดเครื่องส่วนใหญ่', h('select', { id: `bx-size-${root.id || 'b'}`, 'data-b-size': '' }, SIZE_BANDS.map(z => h('option', { value: z.id }, `${z.th} (ผนัง ${z.wall} / อื่น ${z.other.replace('<=', '≤')})`)))),
      h('label', { class: 's-chk' }, h('input', { type: 'checkbox', id: `bx-deep-${root.id || 'b'}`, 'data-b-deep': '', checked: true }), h('span', {}, 'รวมล้างใหญ่ (C2) ปีละ 1 ครั้ง')));
    host.prepend(ex);
  }
  let linesBox = $('[data-b-lines]', root);
  if (!linesBox) { const off = $('[data-b-out="off"]', root); linesBox = h('div', { class: 's-blines', 'data-b-lines': '' }); off ? off.after(linesBox) : root.append(linesBox); }
  function setUnits(u) { for (const k in units) units[k] = u[k] || 0; $$('[data-b-unit]', root).forEach(inp => inp.value = units[inp.dataset.bUnit] ?? 0); }
  function calc() {
    const e = estimateContract({ units, visits, zone, high, pkg, size, deep }); last = e;
    const has = e.count > 0;
    root.classList.toggle('has-est', has);
    out('count').forEach(x => countUp(x, e.count || 0, 500));
    out('low').forEach(x => has ? countUp(x, e.annualEx, 700, n => baht(Math.round(n / 100) * 100)) : x.textContent = '—');
    out('high').forEach(x => x.textContent = has ? `ก่อน VAT · บุคคลทั่วไปชำระตามนี้ · ต้องการใบกำกับภาษี ${baht(e.annualInc)} (รวม VAT 7%)` : '—');
    out('perunit').forEach(x => x.textContent = has ? `ประมาณ ${baht(e.perUnitYear)}` : '—');
    out('teamdays').forEach(x => x.textContent = has ? `${e.teamDaysPerVisit} ทีม-วัน / รอบ (ประมาณ)` : '—');
    out('off').forEach(x => x.textContent = has ? `${e.tierTh}${e.discount ? ` · ประหยัด ${baht(e.discount)} / ปี` : ''}${e.next ? ` · เพิ่มอีก ${e.next.need} เครื่อง ได้ลด ${Math.round(e.next.tier.off * 100)}%` : ''}${e.minBillApplied ? ` · ปรับขั้นต่ำ ${baht(DATA.minBill)}/รอบ` : ''}${high ? ' · งานสูงเกิน 3 ม. ประเมินหน้างาน' : ''}${e.project ? ' · จำนวนนี้ขอราคาโครงการเพิ่มได้ ทีมขายยืนยันในใบเสนอราคา' : ''}` : '');
    out('visits').forEach(x => x.textContent = `${visits} ครั้ง / ปี${deep ? ' (ล้างใหญ่ 1)' : ''}`);
    out('tier').forEach(x => x.textContent = !zone || zone.tier === 'core' ? 'กทม.และปริมณฑล' : zone.tier === 'extended' ? (e.travelWaived ? `ยกเว้นค่าเดินทาง (${e.count} เครื่อง)` : `+ค่าเดินทาง ${baht(zone.fee)}/รอบ${e.travelShort ? ` · ขั้นต่ำ ${zone.minUnits} เครื่อง` : ''}`) : zone.tier === 'out' ? 'เกินระยะ — ประเมินแยก' : 'ตรวจพื้นที่');
    $$('[data-b-bar]', root).forEach(bar => { const k = bar.dataset.bBar; const max = Math.max(1, ...Object.values(units)); bar.style.setProperty('--w', ((units[k] || 0) / max * 100).toFixed(1) + '%'); });
    linesBox.innerHTML = '';
    if (has) linesBox.append(h('table', { class: 's-btable' }, h('thead', {}, h('tr', {}, h('th', {}, 'ประเภท'), h('th', {}, 'เครื่อง'), h('th', {}, 'ล้างปกติ/เครื่อง'), h('th', {}, 'ล้างใหญ่/เครื่อง'))),
      h('tbody', {}, e.lines.map(l => h('tr', {}, h('td', {}, `${TYPE_BY_ID[l.type].th} ${l.range || ''}`), h('td', {}, String(l.n)), h('td', {}, baht(l.c1)), h('td', {}, baht(l.c2)))))),
      // Rev.09 r9: public quantity ladder (owner decision 2 ต.ค. 2569) — the visitor's step highlighted
      h('div', { class: 's-ladder', role: 'table', 'aria-label': 'ราคาขั้นบันไดตามจำนวนเครื่องในสัญญา' },
        h('div', { role: 'row', class: 's-ld-h' }, h('span', { role: 'columnheader' }, 'จำนวนเครื่องในสัญญา'), h('span', { role: 'columnheader' }, 'ส่วนลดจากยอดสัญญา')),
        VOLUME_TIERS.map(t => h('div', { role: 'row', class: 's-ld-r' + (t === e.tier ? ' on' : ''), 'aria-current': t === e.tier ? 'true' : null },
          h('span', { role: 'cell' }, t.th, t === e.tier ? h('small', {}, 'สัญญานี้') : null), h('span', { role: 'cell' }, t.off ? `${Math.round(t.off * 100)}%${t.project ? ' + ราคาโครงการ' : ''}` : 'อัตรามาตรฐาน')))),
      h('p', { class: 's-note' }, `ราคาก่อน VAT ปัดหลักร้อย ตาม Pricebook · ${pkg} · ส่วนลดคิดจากค่าล้างต่อรอบ (ไม่รวมค่าเดินทาง) แล้วปัดเป็นหลักร้อย · ยอดขั้นต่ำ ${baht(DATA.minBill)} ต่อรอบยังใช้`));
    cfg.onChange && cfg.onChange(e, { units: { ...units }, visits, zone, high });
  }
  $$('[data-b-unit]', root).forEach(inp => inp.addEventListener('input', () => { units[inp.dataset.bUnit] = Math.max(0, Math.min(999, parseInt(inp.value || '0', 10) || 0)); markPreset(null); calc(); }));
  $$('[data-b-step]', root).forEach(b => b.addEventListener('click', () => {
    const [k, d] = b.dataset.bStep.split(':'); units[k] = Math.max(0, Math.min(999, (units[k] || 0) + +d));
    $(`[data-b-unit="${k}"]`, root).value = units[k]; markPreset(null); calc();
  }));
  function markPreset(id) { $$('[data-b-preset]', root).forEach(b => b.setAttribute('aria-pressed', b.dataset.bPreset === id)); }
  $$('[data-b-preset]', root).forEach(b => b.addEventListener('click', () => {
    const p = PRESETS.find(p => p.id === b.dataset.bPreset); setUnits(p.units); visits = p.visits;
    $$('[data-b-visits]', root).forEach(r => r.checked = +r.value === visits); markPreset(p.id); calc();
  }));
  $$('[data-b-visits]', root).forEach(r => r.addEventListener('change', () => { visits = +r.value; calc(); }));
  const hi = $('[data-b-high]', root); hi && hi.addEventListener('change', () => { high = hi.checked; calc(); });
  $('[data-b-pkg]', root).addEventListener('change', e => { pkg = e.target.value; calc(); });
  $('[data-b-size]', root).addEventListener('change', e => { size = +e.target.value; calc(); });
  $('[data-b-deep]', root).addEventListener('change', e => { deep = e.target.checked; calc(); });
  const zi = $('[data-b-zone]', root), zr = $('[data-b-zone-result]', root);
  zi && zi.addEventListener('input', () => {
    zone = checkZone(zi.value);
    if (zr) { zr.dataset.tier = zone ? zone.tier : ''; zr.textContent = !zone ? '' : zone.tier === 'core' ? `${zone.match} — ${TIER_TH.core.th}` : zone.tier === 'extended' ? `${zone.match} ${zone.province} · ~${zone.km} กม. · ${travelNote(zone)}` : zone.tier === 'out' ? `${zone.match} · ~${zone.km} กม. — ${TIER_TH.out.th}` : TIER_TH.unknown.th; }
    calc();
  });
  const first = PRESETS[1]; setUnits(first.units); visits = first.visits; markPreset(first.id);
  $$('[data-b-visits]', root).forEach(r => r.checked = +r.value === visits);
  calc();
  return { estimate: () => last, state: () => ({ units: { ...units }, visits, zone, high, pkg, size, deep }), zoneInput: () => zi ? zi.value : '' };
}

/* ---------------- Service-area checker ---------------- */
export function mountZone(root, cfg = {}) {
  const inp = $('[data-z-input]', root), res = $('[data-z-result]', root);
  function run() {
    const z = checkZone(inp.value);
    $$('[data-z-prov]', root).forEach(el => el.classList.toggle('hit', !!z && el.dataset.zProv === z.province));
    if (!z) { res.hidden = true; return; }
    res.hidden = false; res.dataset.tier = z.tier;
    res.innerHTML = '';
    res.append(h('strong', {}, TIER_TH[z.tier].th), h('span', {}, ` ${z.match}${z.province && z.match !== z.province ? ' · ' + z.province : ''}`), h('p', {}, TIER_TH[z.tier].note));
    if (z.tier === 'extended') res.append(h('p', { class: 's-zfee' }, `ระยะทางถนนประมาณ ${z.km} กม. จากสำนักงานใหญ่ · ${travelNote(z)} (ก่อน VAT)`));
    if (z.tier === 'out') res.append(h('p', { class: 's-zfee' }, `ระยะทางถนนประมาณ ${z.km} กม. เกิน ${TRAVEL.maxKm} กม. — รับเป็นงานโครงการหรือสัญญา คิดค่าทีมต่อวัน + ทางด่วน + ที่พักตามจริง`));
    cfg.onResult && cfg.onResult(z);
  }
  inp.addEventListener('input', run);
  $$('[data-z-try]', root).forEach(b => b.addEventListener('click', () => { inp.value = b.dataset.zTry; run(); }));
  $$('[data-z-prov]', root).forEach(el => el.addEventListener('click', () => { inp.value = el.dataset.zProv; run(); }));
}

/* ---------------- FAQ ---------------- */
export function mountFaq(root) {
  $$('details', root).forEach(d => d.addEventListener('toggle', () => { if (d.open) $$('details', root).forEach(o => o !== d && (o.open = false)); }));
}

/* ---------------- BTU helper ---------------- */
export function mountBtu(root, cfg = {}) {
  const g = k => $(`[data-btu="${k}"]`, root);
  const pad = $('[data-btu-pad]', root);
  function run() {
    const r = recommendBtu({ w: +g('w').value, d: +g('d').value, h: +g('h').value, sun: +($('[data-btu="sun"]:checked', root)?.value ?? 1), people: +g('people').value, use: g('use')?.value || 'home' });
    $$('[data-btu-out="area"]', root).forEach(x => x.textContent = r.area.toFixed(1) + ' ตร.ม.');
    $$('[data-btu-out="calc"]', root).forEach(x => x.textContent = r.btu.toLocaleString() + ' BTU');
    $$('[data-btu-out="pick"]', root).forEach(x => countUp(x, r.pick, 500, n => (Math.round(n / 1000) * 1000).toLocaleString()));
    $$('[data-btu-show]', root).forEach(x => x.textContent = `${g(x.dataset.btuShow).value}`);
    if (pad) { const knob = $('[data-btu-knob]', pad); knob.style.left = ((+g('w').value - 2) / 8 * 100) + '%'; knob.style.top = (100 - (+g('d').value - 2) / 8 * 100) + '%'; const room = $('[data-btu-room]', pad); room && (room.style.width = ((+g('w').value) / 10 * 100) + '%', room.style.height = ((+g('d').value) / 10 * 100) + '%'); }
    cfg.onChange && cfg.onChange(r);
  }
  $$('input,select', root).forEach(i => i.addEventListener('input', run));
  if (pad) {
    let drag = false;
    const move = e => { if (!drag) return; const r = pad.getBoundingClientRect(); const x = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), y = Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)); g('w').value = (2 + x * 8).toFixed(1); g('d').value = (2 + (1 - y) * 8).toFixed(1); run(); };
    pad.addEventListener('pointerdown', e => { drag = true; pad.setPointerCapture(e.pointerId); move(e); });
    pad.addEventListener('pointermove', move); pad.addEventListener('pointerup', () => drag = false);
  }
  run();
}

/* ---------------- 3D viewer wiring ---------------- */
// r8: viewers that are not on screen at load (other pages of the site, lower sections) boot when they come near the viewport.
// All three used to boot at once while the page loaded (several seconds of main-thread work on a phone). Until then the
// returned object queues calls (the last one per method, in order) and replays them on the real viewer.
// r20: cfg.phoneDefer — on phones (touch, ≤ 900 px) the hero 3D waits for the first tap on it or for a calm moment after the
// page has settled (gl-pool.whenCalm: idle, nobody scrolling or tapping, never in the first seconds), so the first screen is
// readable and scrollable at once; a poster still (<img class="v-poster"> in the canvas box) stands in until the canvas shows.
const PHONE = () => matchMedia('(pointer:coarse) and (max-width:900px)').matches;
export function mountViewer(root, cfg = {}) {
  const r = root && root.getBoundingClientRect();
  const defer = cfg.phoneDefer && PHONE();
  if (!root || (!defer && r.width && r.top < innerHeight * 1.6)) return mountViewerNow(root, cfg);
  const q = new Map(); let real = null, started = false;
  const stub = { state: { dirt: cfg.dirt || 0, selected: null, explode: 0, cleaning: 0, xrayT: 0, visible: false } };
  const P = new Proxy(stub, { get(t, k) {
    if (real) { const v = real[k]; return typeof v === 'function' ? v.bind(real) : v; }
    if (k in t) return t[k]; if (typeof k !== 'string' || k === 'then') return undefined;
    return (...a) => { q.delete(k); q.set(k, a); };
  } });
  const boot = () => {
    if (started) return; started = true; io.disconnect();
    real = mountViewerNow(root, cfg); if (real) q.forEach((a, k) => { if (typeof real[k] === 'function') real[k](...a); });
  };
  const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) boot(); }, { rootMargin: '500px 0px' });
  if (defer) { root.addEventListener('pointerdown', boot, { once: true, passive: true }); whenCalm(boot, 1500); }
  else io.observe(root);
  return P;
}
function mountViewerNow(root, cfg = {}) {
  const canvasBox = $('[data-v-canvas]', root);
  const labels = $('[data-v-labels]', root);
  const info = $('[data-v-info]', root);
  const partsList = $('[data-v-parts]', root);
  const svg = cfg.leaders ? $('[data-v-leaders]', root) : null;
  const labelEls = new Map();
  let V;
  const fallback = $('[data-v-fallback]', root);
  try {
    V = createACViewer(canvasBox, {
      style: cfg.style || 'studio', unit: cfg.unit || 'indoor', accent: cfg.accent || 0xe2711d, autoRotate: cfg.autoRotate !== false,
      wheelZoom: cfg.wheelZoom ?? false, ghost: cfg.ghost ?? 0.16, targetOffset: cfg.targetOffset || [0, 0], floorShadow: cfg.floorShadow !== false, exposure: cfg.exposure || 1, premium: cfg.premium, edgeLines: cfg.edgeLines || null, radiusScale: cfg.radiusScale || 1,
      onSelect: meta => showInfo(meta),
      onFrame: (anchors, st) => drawLabels(anchors, st),
    });
  } catch (err) {
    if (fallback) fallback.hidden = false;
    console.warn('3D unavailable', err); return null;
  }
  function renderParts() {
    if (!partsList) return;
    partsList.innerHTML = '';
    V.parts().forEach((p, i) => {
      const b = h('button', { type: 'button', class: 'part-btn', 'data-part': p.id, 'aria-pressed': 'false' }, h('span', { class: 'pn' }, String(i + 1).padStart(2, '0')), h('span', { class: 'pt' }, p.th), h('small', {}, p.en));
      b.addEventListener('click', () => { V.select(p.id); });
      partsList.append(b);
    });
  }
  function showInfo(meta) {
    $$('[data-part]', root).forEach(b => b.setAttribute('aria-pressed', !!meta && b.dataset.part === meta.id));
    if (!info) return;
    if (!meta) { info.classList.remove('on'); info.innerHTML = cfg.infoEmpty || '<p>แตะชิ้นส่วนเพื่อดูว่าทำหน้าที่อะไร และช่างทำอะไรกับมันตอนล้าง</p>'; return; }
    info.classList.add('on');
    info.innerHTML = '';
    info.append(h('small', {}, meta.en), h('h3', {}, meta.th), h('p', {}, meta.d));
    if (meta.dirty) info.append(h('p', { class: 'tag-dirty' }, 'จุดที่ฝุ่นและคราบสะสม — อยู่ในรายการล้าง'));
  }
  function drawLabels(anchors, st) {
    if (!labels) return;
    const W = labels.clientWidth, H = labels.clientHeight;
    if (svg) svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    let lines = '';
    const showAll = cfg.labelsAlways || st.explode > 0.55 || st.xrayT > 0.5;
    const vis = [];
    anchors.forEach((a, i) => {
      let el = labelEls.get(a.id);
      if (!el) { el = cfg.labelTpl ? cfg.labelTpl(a, i) : h('button', { type: 'button', class: 'hs' }, a.th); el.addEventListener('click', () => V.select(a.id)); labels.append(el); labelEls.set(a.id, el); }
      const on = a.visible && (showAll || a.selected) && a.x > 0 && a.x < W && a.y > 0 && a.y < H;
      el.classList.toggle('on', on); el.classList.toggle('sel', a.selected);
      if (on) vis.push({ a, el }); else if (!cfg.leaders) el.style.transform = '';
    });
    if (cfg.leaders) {
      // two tidy columns (left / right of the unit), labels sorted by the height of their part, evenly spaced, leaders never cross
      const top = 16, bottom = H - 16, gap = Math.max(30, Math.min(40, (H - 40) / Math.max(1, Math.ceil(vis.length / 2))));
      const cx = vis.length ? vis.reduce((s, v) => s + v.a.x, 0) / vis.length : W / 2;
      const cols = [vis.filter(v => v.a.x < cx).sort((p, q) => p.a.y - q.a.y), vis.filter(v => v.a.x >= cx).sort((p, q) => p.a.y - q.a.y)];
      if (Math.abs(cols[0].length - cols[1].length) > 2) { const all = vis.slice().sort((p, q) => p.a.x - q.a.x); const half = Math.ceil(all.length / 2); cols[0] = all.slice(0, half).sort((p, q) => p.a.y - q.a.y); cols[1] = all.slice(half).sort((p, q) => p.a.y - q.a.y); }
      cols.forEach((col, ci) => {
        let y = top; const ys = col.map(v => { y = Math.max(y, Math.min(bottom, v.a.y)); const r = y; y += gap; return r; });
        const over = ys.length ? ys[ys.length - 1] - bottom : 0; if (over > 0) for (let i = ys.length - 1, lim = bottom; i >= 0; i--) { ys[i] = Math.min(ys[i], lim); lim = ys[i] - gap; }
        col.forEach((v, i) => {
          const w = v.el.offsetWidth || 110, lx = ci === 0 ? 12 : W - 12 - w, ly = ys[i];
          v.el.style.transform = `translate(${lx}px, ${ly - 13}px)`;
          const ex = ci === 0 ? lx + w + 4 : lx - 4, mx = ci === 0 ? Math.min(v.a.x - 14, ex + 26) : Math.max(v.a.x + 14, ex - 26);
          lines += `<path d="M${ex} ${ly} H${mx} L${v.a.x} ${v.a.y}" /><circle cx="${v.a.x}" cy="${v.a.y}" r="3.2" />`;
        });
      });
    } else vis.forEach(({ a, el }) => { el.style.transform = `translate(${a.x}px, ${a.y}px)`; });
    if (svg) svg.innerHTML = lines;
  }
  const on = (sel, ev, fn) => $$(sel, root).forEach(b => b.addEventListener(ev, () => fn(b)));
  const press = (sel, b) => $$(sel, root).forEach(x => x.setAttribute('aria-pressed', x === b));
  on('[data-v-explode]', 'click', b => { const v = V.getExplode() > 0.5 ? 0 : 1; V.setExplode(v); V.view(v ? 'exploded' : 'persp'); b.setAttribute('aria-pressed', !!v); });
  on('[data-v-xray]', 'click', b => { const v = b.getAttribute('aria-pressed') !== 'true'; V.setXray(v); b.setAttribute('aria-pressed', v); });
  on('[data-v-air]', 'click', b => { const v = b.getAttribute('aria-pressed') === 'false'; V.setAirflow(v); b.setAttribute('aria-pressed', v); });
  on('[data-v-view]', 'click', b => { V.view(b.dataset.vView); press('[data-v-view]', b); });
  on('[data-v-unit]', 'click', b => { V.setUnit(b.dataset.vUnit); V.setExplode(0, true); press('[data-v-unit]', b); $$('[data-v-explode]', root).forEach(x => x.setAttribute('aria-pressed', false)); labelEls.forEach(el => el.remove()); labelEls.clear(); renderParts(); showInfo(null); V.view('persp'); });
  on('[data-v-zoom]', 'click', b => V.zoom(+b.dataset.vZoom));
  on('[data-v-finish]', 'click', b => { V.setFinish && V.setFinish(b.dataset.vFinish); press('[data-v-finish]', b); });
  const dirt = $('[data-v-dirt]', root);
  const dirtOut = $$('[data-v-dirt-out]', root);
  const setD = v => { V.setDirt(v); if (dirt) dirt.value = v; dirtOut.forEach(o => o.textContent = v < 0.05 ? 'สะอาด' : v < 0.4 ? 'เริ่มมีฝุ่น' : v < 0.75 ? 'สกปรก — ถึงรอบล้าง' : 'สกปรกมาก — ลมเบา อาจมีกลิ่น'); };
  dirt && dirt.addEventListener('input', () => setD(+dirt.value));
  on('[data-v-clean]', 'click', b => {
    if (V.state.dirt < 0.05) setD(0.85);
    V.setExplode(0); V.setXray(true); $$('[data-v-xray]', root).forEach(x => x.setAttribute('aria-pressed', true)); V.view('front');
    b.disabled = true; const t0 = b.textContent; b.textContent = 'กำลังล้าง…';
    V.clean();
    const tick = () => { if (V.state.cleaning > 0) { dirt && (dirt.value = V.state.dirt); setD(V.state.dirt); requestAnimationFrame(tick); } else { setD(0); b.disabled = false; b.textContent = t0; cfg.onCleaned && cfg.onCleaned(); } };
    requestAnimationFrame(tick);
  });
  renderParts(); showInfo(null);
  if (cfg.dirt != null) setD(cfg.dirt);
  return V;
}

/* scroll-linked explode inside a tall sticky section */
export function scrollExplode(section, V, cfg = {}) {
  if (!V) return;
  const steps = cfg.steps ? $$(cfg.steps, section) : [];
  function onScroll() {
    const r = section.getBoundingClientRect();
    const total = r.height - innerHeight;
    const p = Math.max(0, Math.min(1, -r.top / Math.max(1, total)));
    V.setExplode(Math.max(0, Math.min(1, (p - 0.08) / 0.6)));
    if (steps.length) { const i = Math.min(steps.length - 1, Math.floor(p * steps.length)); steps.forEach((s, j) => s.classList.toggle('on', j === i)); }
    cfg.onProgress && cfg.onProgress(p);
  }
  addEventListener('scroll', onScroll, { passive: true }); onScroll();
}

/* ---------------- Virtual room ---------------- */
export function mountRoom(root) {
  const box = $('[data-r-canvas]', root);
  let R;
  try {
    R = createRoomSim(box, {
      onStats: s => {
        $$('[data-r-out="temp"]', root).forEach(x => x.textContent = s.T.toFixed(1) + '°C');
        $$('[data-r-out="time"]', root).forEach(x => x.textContent = s.reached != null ? `${Math.round(s.reached)} นาที` : (s.simMin > 150 ? 'ไม่ถึง 25°C' : `${Math.round(s.simMin)} นาที…`));
        $$('[data-r-out="need"]', root).forEach(x => x.textContent = s.need.toLocaleString() + ' BTU');
        $$('[data-r-out="fit"]', root).forEach(x => { const r = s.btu / s.need; x.dataset.fit = r < 0.9 ? 'low' : r > 1.5 ? 'high' : 'ok'; x.textContent = r < 0.9 ? 'เล็กเกินไป — เย็นช้า เครื่องทำงานหนัก' : r > 1.5 ? 'ใหญ่เกินจำเป็น — ลงทุนเกิน' : 'ขนาดเหมาะสม'; });
        const bar = $('[data-r-bar]', root); bar && bar.style.setProperty('--p', Math.max(0, Math.min(1, (32 - s.T) / 7)));
      },
    });
  } catch (e) { const fb = $('[data-v-fallback]', root); fb && (fb.hidden = false); return; }
  const g = k => $(`[data-r="${k}"]`, root);
  function apply() {
    R.set({ w: +g('w').value, d: +g('d').value, sun: +($('[data-r="sun"]:checked', root)?.value ?? 1), people: +g('people').value, btu: +g('btu').value });
    $$('[data-r-show]', root).forEach(x => x.textContent = (+g(x.dataset.rShow).value).toLocaleString());
  }
  $$('input,select', root).forEach(i => i.addEventListener('change', apply));
  $$('input[type=range]', root).forEach(i => i.addEventListener('input', () => $$(`[data-r-show="${i.dataset.r}"]`, root).forEach(x => x.textContent = (+i.value).toLocaleString())));
  $$('[data-r-restart]', root).forEach(b => b.addEventListener('click', () => R.restart()));
  apply();
  return R;
}

/* ---------------- small helpers ---------------- */
export function toast(msg) {
  let t = $('#toast'); if (!t) { t = h('div', { id: 'toast', role: 'status', 'aria-live': 'polite' }); document.body.append(t); }
  t.textContent = msg; t.classList.add('on'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('on'), 2600);
}
export function reveal(sel = '[data-reveal]') {
  // Rev.07 design review: section-by-section fade/slide entrances read as template motion and hid content from
  // fast scrollers and screen readers — sections now render immediately; motion is kept for the 3D scenes only.
  return;
  if (reduceMotion() || !('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px' });
  $$(sel).forEach(el => { if (el.getBoundingClientRect().top < innerHeight) return; el.classList.add('rv'); io.observe(el); });
}
export function openDrawer(drawer) { drawer.hidden = false; requestAnimationFrame(() => drawer.classList.add('open')); document.body.classList.add('lock'); const c = $('[data-close]', drawer); c && c.focus(); }
export function closeDrawer(drawer) { drawer.classList.remove('open'); document.body.classList.remove('lock'); setTimeout(() => drawer.hidden = true, 260); }
export function wireDrawers() {
  $$('[data-drawer]').forEach(d => {
    $$('[data-close]', d).forEach(b => b.addEventListener('click', () => closeDrawer(d)));
    d.addEventListener('click', e => { if (e.target === d) closeDrawer(d); });
  });
  addEventListener('keydown', e => { if (e.key === 'Escape') $$('[data-drawer].open').forEach(closeDrawer); });
}
export function priceRange(m, skus) { const ps = skus.map(s => s.price); return [Math.min(...ps), Math.max(...ps)]; }

/* ---------------- line art per unit type (placeholder until approved product photos) ---------------- */
export function typeArt(type, cls = 'art') {
  const S = (d) => `<svg class="${cls}" viewBox="0 0 160 110" role="img" aria-label="ภาพประกอบ ${TYPE_BY_ID[type].th}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
  switch (type) {
    case 'wall': return S('<rect x="14" y="30" width="132" height="40" rx="10"/><path d="M22 62h116"/><path d="M30 70c10 10 90 10 100 0"/><rect x="116" y="40" width="14" height="6" rx="2"/><path d="M40 84l-4 12M60 86l-2 12M80 86v12M100 86l2 12M120 84l4 12" stroke-dasharray="2 4"/>');
    case 'cassette': return S('<path d="M8 28h144"/><rect x="36" y="30" width="88" height="14" rx="3"/><rect x="46" y="44" width="68" height="28" rx="4"/><rect x="62" y="52" width="36" height="12" rx="2"/><path d="M46 58l-14 12M114 58l14 12M80 72v14" stroke-dasharray="2 4"/>');
    case 'ceiling': return S('<path d="M8 22h144"/><path d="M28 22v6M132 22v6"/><rect x="20" y="28" width="120" height="30" rx="8"/><path d="M26 58c16 8 92 8 108 0"/><path d="M40 70l-6 16M80 72v16M120 70l6 16" stroke-dasharray="2 4"/>');
    case 'floor': return S('<rect x="56" y="10" width="48" height="90" rx="6"/><path d="M62 20h36M62 26h36M62 32h36"/><rect x="66" y="48" width="28" height="8" rx="2"/><path d="M104 22l22-6M104 30l24 0" stroke-dasharray="2 4"/><path d="M50 100h60"/>');
    default: return S('<path d="M8 20h144"/><rect x="30" y="24" width="100" height="26" rx="4"/><path d="M130 30h18v14h-18M12 30h18v14H12"/><path d="M8 50h144" stroke-dasharray="3 3"/><rect x="56" y="54" width="48" height="8" rx="2"/><path d="M68 66v16M92 66v16" stroke-dasharray="2 4"/>');
  }
}

/* ---------------- product drawer + compare (generic markup; each variant styles it) ---------------- */
export function productDrawerContent(m, skuIndex, { onPick, on3D, onQuote } = {}) {
  const b = BRAND_BY_ID[m.brand], t = TYPE_BY_ID[m.type];
  const sku = m.skus[skuIndex];
  const wrap = h('div', { class: 'pd' });
  wrap.append(
    h('div', { class: 'pd-art', html: typeArt(m.type) }),
    h('p', { class: 'pd-brand' }, b.name, b.own ? h('b', { class: 'own-tag' }, 'แบรนด์เรา') : null),
    h('h3', { class: 'pd-title' }, m.series),
    h('p', { class: 'pd-meta' }, `${t.th} · ${m.inverter ? 'Inverter' : 'Fixed speed'} · ฉลาก ${m.label}`),
  );
  const chips = h('div', { class: 'btu-chips', role: 'radiogroup', 'aria-label': 'เลือกขนาด BTU' });
  m.skus.forEach((s, i) => chips.append(h('button', { type: 'button', role: 'radio', 'aria-checked': i === skuIndex, class: 'bchip', onclick: () => onPick && onPick(i) }, (s.btu / 1000) + 'k')));
  wrap.append(chips,
    h('dl', { class: 'pd-spec' },
      h('dt', {}, 'รหัส SKU'), h('dd', { class: 'mono' }, sku.sku),
      h('dt', {}, 'ขนาด'), h('dd', {}, btuFmt(sku.btu)),
      h('dt', {}, 'ราคาเครื่อง'), h('dd', {}, baht(sku.price), h('small', {}, ' ราคาตัวอย่าง')),
      h('dt', {}, 'สถานะ'), h('dd', {}, sku.stock === 'ready' ? 'พร้อมส่ง' : 'สั่งจอง 3–7 วัน'),
    ),
    h('div', { class: 'pd-include' },
      h('h3', {}, 'ราคารวมติดตั้งมาตรฐาน รวม'),
      h('ul', {}, h('li', {}, 'ท่อน้ำยาและสายไฟ ตามระยะมาตรฐานที่ระบุในใบเสนอราคา'), h('li', {}, 'ขาแขวนคอยล์ร้อน / ขาตั้งพื้น'), h('li', {}, 'ทดสอบระบบและแนะนำการใช้งาน')),
      h('h3', {}, 'อาจมีค่าใช้จ่ายเพิ่ม'),
      h('ul', { class: 'extra' }, h('li', {}, 'ระยะท่อเกินมาตรฐาน · รางครอบท่อ'), h('li', {}, 'งานที่สูง / นั่งร้าน'), h('li', {}, 'เดินไฟใหม่ / เบรกเกอร์')),
    ),
    h('div', { class: 'pd-cta' },
      h('button', { type: 'button', class: 'btn-primary', onclick: () => onQuote && onQuote(m, sku) }, 'ขอราคาพร้อมติดตั้ง'),
      h('button', { type: 'button', class: 'btn-ghost', onclick: () => on3D && on3D(m, sku) }, 'ดูข้างในแบบ 3 มิติ'),
    ),
    h('p', { class: 'pd-note' }, 'ข้อมูลรุ่นและราคาในต้นแบบนี้สร้างขึ้นเพื่อทดสอบหน้าจอ ใช้ข้อมูลจริงจาก Catalog เมื่อพัฒนา'),
  );
  return wrap;
}
export function compareTable(items) {
  const rows = [
    ['แบรนด์', x => BRAND_BY_ID[x.m.brand].name], ['รุ่น', x => x.m.series], ['ประเภท', x => TYPE_BY_ID[x.m.type].th],
    ['ขนาด', x => btuFmt(x.sku.btu)], ['ระบบ', x => x.m.inverter ? 'Inverter' : 'Fixed speed'], ['น้ำยา', x => x.m.label],
    ['ราคาเครื่อง (ก่อน VAT)', x => baht(x.sku.price)], ['พร้อมติดตั้งมาตรฐาน', x => x.sku.installStdEx ? baht(x.sku.px + x.sku.installStdEx) : '—'], ['รับประกัน', x => x.sku.d?.warranty || '—'],
  ];
  const tbl = h('table', { class: 'cmp' });
  tbl.append(h('thead', {}, h('tr', {}, h('th', {}, ''), ...items.map(x => h('th', {}, `${x.sku.sku}`)))));
  const tb = h('tbody');
  rows.forEach(([k, fn]) => { const vals = items.map(fn); const diff = new Set(vals).size > 1; tb.append(h('tr', { class: diff ? 'diff' : '' }, h('th', {}, k), ...vals.map(v => h('td', {}, v)))); });
  tbl.append(tb);
  return h('div', { class: 'cmp-wrap' }, tbl);
}
