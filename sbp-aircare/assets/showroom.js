// SBP AirCare — showroom: every catalogue model, animated (r12 v2 editions; owner 5 ต.ค. 2569 "ต้องมีภาพ animation ครบทุกโมเดล
// ให้ทดลอง"). Pick any of the 705 models (type → brand → size → series); the stage shows the indoor unit of that type at the
// model's size (spec dimensions when the Pricebook has them — 164 models — otherwise a typical size for the type and BTU, said
// on the page). The body is brand-neutral (CLAUDE.md §6.6 #14/#20): the brand is text on the page, never drawn on the unit.
// Visitors can switch it on, change mode and swing, move the camera, look through the shell, take it apart and watch a clean.
// Prices: machine and standard installation from the Pricebook (round hundreds before VAT, §6.6 #1); no internal rate.
// mountShowroom(root, {stage, slot, ctl, onOpen(m,i), onBook(preset), start:{type, btu}}) → {select(m, i), filter({type, btu}), current()}
import { DEMO, TYPES, TYPE_BY_ID, BRANDS, BRAND_BY_ID, BTU_BANDS, installOptions, baht, btuFmt, h, $, $$ } from './sbp-core.js';
import { cart } from './commerce.js';
import { unitDims } from './roomfit.js';
import { toast } from './proto-ui.js';

const SR_TYPES = ['wall', 'ceiling', 'cassette', 'floor'];
const SHOTS = [['hero', 'ภาพรวม'], ['close', 'ใกล้'], ['air', 'ทางลม'], ['inside', 'ภายใน'], ['wide', 'ทั้งห้อง']];
const MODES = [['cool', 'เย็น'], ['dry', 'ลดความชื้น'], ['fan', 'พัดลม']];
const PAGE = 8;

// small pressed-button group
function seg(opts, cur, label, onPick, cls = '') {
  const g = h('div', { class: 'sr-seg ' + cls, role: 'group', 'aria-label': label });
  const draw = v => $$('button', g).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === String(v))));
  opts.forEach(([v, th]) => g.append(h('button', { type: 'button', 'data-v': v, onclick: () => { draw(v); onPick(v); } }, th)));
  draw(cur); g.draw = draw; return g;
}

export function mountShowroom(root, { stage, slot, ctl, onOpen, onBook, start = {}, hl = 'h3' } = {}) {   // hl: heading level of the model name (h2 when the showroom sits right under the page h1)
  const F = { type: start.type || 'wall', brand: '', band: '', q: '' };
  let shown = PAGE, cur = null;   // cur = {m, i}
  const st = { power: true, mode: 'cool', swing: true, shot: 'hero', xray: false, explode: 0, sound: false };

  /* ---- picker ---- */
  const count = t => DEMO.models.filter(m => m.type === t).reduce((n, m) => n + m.skus.length, 0);
  const typeTabs = h('div', { class: 'sr-types', role: 'group', 'aria-label': 'ประเภทแอร์' });
  SR_TYPES.forEach(t => typeTabs.append(h('button', { type: 'button', 'data-t': t, 'aria-pressed': String(t === F.type), onclick: () => { F.type = t; F.brand = ''; shown = PAGE; drawTypes(); fillBrands(); if (!matches().length) { F.band = ''; bandSel.value = ''; } list(true); } },
    TYPE_BY_ID[t].th, h('small', {}, `${count(t)} รุ่น`))));
  const drawTypes = () => $$('[data-t]', typeTabs).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.t === F.type)));
  const brandSel = h('select', { 'aria-label': 'ยี่ห้อ', onchange: () => { F.brand = brandSel.value; shown = PAGE; list(true); } });
  function fillBrands() {
    const ids = new Set(DEMO.models.filter(m => m.type === F.type).map(m => m.brand));
    brandSel.replaceChildren(h('option', { value: '' }, 'ทุกยี่ห้อ'), ...BRANDS.filter(b => ids.has(b.id)).map(b => h('option', { value: b.id }, b.name)));
    brandSel.value = F.brand;
  }
  const bandSel = h('select', { 'aria-label': 'ขนาด BTU', onchange: () => { F.band = bandSel.value; shown = PAGE; list(true); } },
    h('option', { value: '' }, 'ทุกขนาด'), BTU_BANDS.map(b => h('option', { value: b.id }, `${b.th} BTU`)));
  const qIn = h('input', { type: 'search', placeholder: 'ค้นหารุ่น หรือรหัสรุ่น', 'aria-label': 'ค้นหารุ่น', oninput: () => { F.q = qIn.value.trim().toLowerCase().replace(/[\s\-\/,]/g, ''); shown = PAGE; list(true); } });
  const out = h('ul', { class: 'sr-list', 'aria-label': 'รุ่นที่ตรงกับตัวกรอง' });
  const more = h('button', { type: 'button', class: 'sr-more', onclick: () => { shown += PAGE; list(false); } });
  const tally = h('p', { class: 'sr-tally', 'aria-live': 'polite' });

  const band = () => BTU_BANDS.find(b => b.id === F.band);
  const skuOk = s => { const b = band(); return !b || (s.btu >= b.min && s.btu <= b.max); };
  function matches() {
    return DEMO.models.filter(m => m.type === F.type && (!F.brand || m.brand === F.brand) && m.skus.some(skuOk)
      && (!F.q || (BRAND_BY_ID[m.brand].name + m.series + m.skus.map(s => s.sku + s.btu).join('')).toLowerCase().replace(/[\s\-\/,]/g, '').includes(F.q)));
  }
  function list(reset) {
    const L = matches();
    tally.textContent = `${L.length} ซีรีส์ ${L.reduce((n, m) => n + m.skus.filter(skuOk).length, 0)} รุ่น`;
    out.replaceChildren(...L.slice(0, shown).map(m => {
      const skus = m.skus.filter(skuOk), b = BRAND_BY_ID[m.brand];
      return h('li', { class: 'sr-row' + (cur && cur.m === m ? ' on' : '') },
        h('p', { class: 'sr-rh' }, h('b', {}, b.name), h('span', {}, m.series)),
        h('div', { class: 'sr-btus', role: 'group', 'aria-label': `ขนาดของ ${b.name} ${m.series}` }, skus.map(s => {
          const i = m.skus.indexOf(s), on = cur && cur.m === m && cur.i === i;
          return h('button', { type: 'button', 'aria-pressed': String(!!on), onclick: () => select(m, i, true) }, h('b', {}, (s.btu / 1000).toFixed(s.btu % 1000 ? 1 : 0) + 'k'), h('small', {}, baht(s.price)));
        })));
    }));
    if (!L.length) { out.append(h('li', { class: 'sr-empty' }, 'ไม่พบรุ่นที่ตรงกับตัวกรอง ลองเลือกทุกยี่ห้อหรือทุกขนาด')); if (reset) { cur = null; det.replaceChildren(h('p', { class: 'sr-note' }, 'เลือกรุ่นจากรายการเพื่อดูราคาและสเปก')); } }
    more.hidden = L.length <= shown; more.textContent = `แสดงอีก ${Math.min(PAGE, L.length - shown)} ซีรีส์`;
    if (reset && L.length && (!cur || !L.includes(cur.m))) { const m = L[0]; select(m, m.skus.indexOf(m.skus.find(skuOk)), false); list(false); }
  }

  /* ---- the selected model ---- */
  const det = h('div', { class: 'sr-det', 'aria-live': 'polite' });
  function select(m, i, user) {
    cur = { m, i }; const s = m.skus[i], b = BRAND_BY_ID[m.brand], t = TYPE_BY_ID[m.type];
    const dm = unitDims(m.type, s.btu, s.d.indoorDim);
    stage.set(slot, { type: m.type, w: dm.w, h: dm.h, d: dm.d, power: st.power, shot: user ? st.shot : 'hero' });
    const ins = installOptions(m.type, s.btu).find(o => o.key === 'STANDARD');
    const row = (k, v) => v ? [h('dt', {}, k), h('dd', {}, v)] : [];
    const pipes = s.d.pipeLiquid && s.d.pipeGas ? `${s.d.pipeLiquid}" / ${s.d.pipeGas}"` : null;
    det.replaceChildren(
      h('p', { class: 'sr-brand' }, b.name, m.inverter ? h('span', {}, 'Inverter') : null),
      h(hl, { class: 'sr-name' }, m.series),
      h('p', { class: 'sr-code' }, `${s.sku} · ${t.th} · ${btuFmt(s.btu)}`),
      h('div', { class: 'sr-price' },
        h('p', {}, h('span', {}, 'ราคาเครื่อง'), h('b', {}, baht(s.price))),
        h('p', {}, h('span', {}, 'พร้อมติดตั้งมาตรฐาน'), h('b', {}, ins && ins.item.ex != null ? baht(s.price + ins.item.ex) : 'ประเมินหน้างาน')),
        h('small', {}, 'ราคาก่อน VAT · นิติบุคคลที่ต้องการใบกำกับภาษีบวก VAT 7%')),
      h('dl', { class: 'sr-spec' }, ...row('น้ำยา', s.d.refrigerant), ...row('ระบบ', s.d.system), ...row('ท่อน้ำยา', pipes), ...row('ขนาดคอยล์เย็น', s.d.indoorDim ? `${s.d.indoorDim} มม.` : null),
        ...row('น้ำหนักคอยล์เย็น', s.d.indoorKg ? `${s.d.indoorKg} กก.` : null), ...row('ไฟฟ้า', s.d.power), ...row('คอยล์ร้อน', s.d.outdoorModel), ...row('รับประกันเครื่อง', s.d.warranty)),
      h('p', { class: 'sr-note' }, dm.src === 'spec' ? 'ภาพใช้ขนาดคอยล์เย็นตามสเปกรุ่นนี้ ตัวเครื่องในภาพเป็นแบบกลางไม่มียี่ห้อ ไม่ใช่ดีไซน์จริงของแบรนด์' : 'รุ่นนี้ยังไม่มีขนาดคอยล์เย็นในข้อมูล ภาพใช้ขนาดทั่วไปของประเภทและ BTU นี้ ตัวเครื่องในภาพเป็นแบบกลางไม่มียี่ห้อ'),
      h('div', { class: 'sr-acts' },
        h('button', { type: 'button', class: 'v-btn go', onclick: () => addQuote(m, i, ins) }, ins && ins.item.ex != null ? 'ใส่ใบเสนอราคา พร้อมติดตั้ง' : 'ใส่ใบเสนอราคา'),
        onBook ? h('button', { type: 'button', class: 'v-btn ghost', onclick: () => onBook({ service: 'install', units: { [m.type]: 1 }, notes: `สนใจ ${b.name} ${s.sku} (${btuFmt(s.btu)}) พร้อมติดตั้ง` }) }, 'นัดติดตั้ง') : null,
        onOpen ? h('button', { type: 'button', class: 'v-btn ghost', onclick: () => onOpen(m, i) }, 'ตัวเลือกติดตั้งและอุปกรณ์เสริม') : null));
    $$('.sr-row', out).forEach(li => li.classList.remove('on'));
    if (user) list(false);
  }
  function addQuote(m, i, ins) {
    const s = m.skus[i], b = BRAND_BY_ID[m.brand], t = TYPE_BY_ID[m.type];
    cart.add({ kind: 'product', group: 'product', key: `P-${s.sku}`, name: `${b.name} ${s.sku}`, detail: `${t.th} ${btuFmt(s.btu)}`, unitEx: s.px, qty: 1 });
    if (ins && ins.item.ex != null) cart.add({ kind: 'service', group: 'install', key: `I-${ins.item.code}`, name: ins.item.name, detail: `สำหรับ ${s.sku}`, unitEx: ins.item.ex, qty: 1 });
    toast(`ใส่ใบเสนอราคาแล้ว ${b.name} ${s.sku}`);
  }

  /* ---- stage controls ---- */
  const cap = h('p', { class: 'stage-cap' }, 'แบบจำลองเพื่ออธิบาย');
  const pw = h('button', { type: 'button', class: 'sr-pw', 'aria-pressed': 'true', onclick: () => { st.power = !st.power; pw.setAttribute('aria-pressed', String(st.power)); pw.textContent = st.power ? 'ปิดเครื่อง' : 'เปิดเครื่อง'; stage.set(slot, { power: st.power }); } }, 'ปิดเครื่อง');
  const modeSeg = seg(MODES, st.mode, 'โหมด', v => { st.mode = v; stage.set(slot, { mode: v, power: st.power }); });
  const swingB = h('button', { type: 'button', 'aria-pressed': 'true', onclick: () => { st.swing = !st.swing; swingB.setAttribute('aria-pressed', String(st.swing)); stage.set(slot, { swing: st.swing }); } }, 'บานสวิง');
  const shotSeg = seg(SHOTS, st.shot, 'มุมกล้อง', v => { st.shot = v; stage.set(slot, { shot: v, auto: false }); });
  const xrB = h('button', { type: 'button', 'aria-pressed': 'false', onclick: () => { st.xray = !st.xray; xrB.setAttribute('aria-pressed', String(st.xray)); stage.set(slot, { xray: st.xray }); } }, 'มองทะลุ');
  const exR = h('input', { type: 'range', min: 0, max: 100, value: 0, 'aria-label': 'แยกชิ้นส่วน', oninput: () => { st.explode = exR.value / 100; stage.set(slot, { explode: st.explode }); } });
  const cleanB = h('button', { type: 'button', onclick: () => { stage.with(c => { c.clean(); cap.textContent = 'แบบจำลองเพื่ออธิบาย ฝุ่นที่แผ่นกรองและคอยล์ถูกล้างออก'; setTimeout(() => { cap.textContent = 'แบบจำลองเพื่ออธิบาย'; }, 4600); }); } }, 'ดูการล้าง');
  const sndB = h('button', { type: 'button', 'aria-pressed': 'false', onclick: () => stage.with(c => { st.sound = c.sound(!st.sound); sndB.setAttribute('aria-pressed', String(st.sound)); }) }, 'เสียงลม');
  const bar = h('div', { class: 'sr-ctl', role: 'group', 'aria-label': 'ควบคุมภาพจำลอง' },
    h('div', { class: 'sr-cg' }, pw, modeSeg, swingB),
    h('div', { class: 'sr-cg' }, shotSeg),
    h('div', { class: 'sr-cg' }, xrB, h('label', { class: 'sr-ex' }, 'แยกชิ้นส่วน', exR), cleanB, sndB));
  (ctl || slot).append(bar); slot.append(cap);
  // the shot can also change by itself (drag / auto): keep the buttons honest
  stage.on(slot, 'active', on => { if (on) stage.with(c => { st.shot = c.state.shot; shotSeg.draw(st.shot); }); });

  root.replaceChildren(
    h('div', { class: 'sr-pick' }, typeTabs, h('div', { class: 'sr-filt' }, brandSel, bandSel, qIn), tally, out, more),
    det);
  fillBrands(); list(true);

  return {
    select: (m, i) => select(m, i, true), current: () => cur,
    // jump to a type + size (e.g. from the concierge's room-size answer): nearest model at or above that BTU
    filter({ type, btu } = {}) {
      if (type) { F.type = type; F.brand = ''; drawTypes(); fillBrands(); }
      F.band = btu ? (BTU_BANDS.find(b => btu >= b.min && btu <= b.max) || {}).id || '' : ''; bandSel.value = F.band; F.q = ''; qIn.value = ''; shown = PAGE; list(false);
      const L = matches(); let best = null;
      L.forEach(m => m.skus.forEach((s, i) => { if (skuOk(s) && (!btu || s.btu >= btu * 0.95) && (!best || s.btu < best.s.btu || (s.btu === best.s.btu && s.price < best.s.price))) best = { m, i, s }; }));
      if (best) select(best.m, best.i, true); else if (L.length) select(L[0], 0, true);
    },
  };
}
