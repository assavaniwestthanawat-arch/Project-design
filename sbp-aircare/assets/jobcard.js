// SBP AirCare — "ใบงาน" job card (Rev.10 · แบบ D Studio, owner 5 ต.ค. 2569: "พัฒนาให้ดีกว่าเดิมทั้ง frontend และ UX/UI").
// The hero of variant D: one card for the four jobs a visitor comes for — cleaning, installation, repair, annual contract —
// priced live from the Pricebook (cleanRate, DATA.inst, DATA.rep, estimateContract) and handed straight to the booking
// section or the quote basket. Every figure is a round hundred before VAT (CLAUDE.md §6.6 #1); the cleaning minimum per
// visit (#8) is its own line, never hidden inside a unit price; repair shows the diagnosis fee only — repair work is priced
// on site and approved by the customer first (#13). No internal rate, cost or margin is read here.
// mountJobCard(root, {onBook(preset), onQuote(lines), onShop()}) → {set(job), state, summary(), stamp(id)}
import { DATA, TYPE_BY_ID, SIZE_BANDS, CLEAN_PKGS, cleanRate, estimateContract, baht, h, $$ } from './sbp-core.js';
import { PKG_INFO } from './commerce.js';
import { icon } from './icons.js';

export const JOBS = [['clean', 'ล้างแอร์'], ['install', 'ติดตั้ง'], ['repair', 'ซ่อม'], ['amc', 'สัญญาองค์กร']];
const CL_TYPES = ['wall', 'ceiling', 'cassette', 'floor'];
const FORM = { clean: 'SBP-SR-ACCL-UNI-001 Rev.07', amc: 'SBP-SR-ACCL-UNI-001 Rev.07', install: 'SBP-SR-ACIN-UNI-001 Rev.04' };
const INS = { wall: 'W', ceiling: 'C', cassette: 'K', floor: 'FS' };
export const SYMPTOMS = ['ไม่เย็น หรือเย็นน้อย', 'น้ำหยด', 'มีเสียงดัง', 'มีกลิ่น', 'เปิดไม่ติด หรือดับเอง', 'ไฟกะพริบ หรือขึ้นรหัส'];
const LV = { C1: 'ล้างปกติ C1', C2: 'ล้างใหญ่ C2' };
const nf = n => Math.round(n).toLocaleString('en-US');

// installation price rows per type: [{code, range, std, prem}] from the Pricebook (items with a price only)
export function installRows(type) {
  const re = new RegExp(`^INS-${INS[type]}-(\\d+)-(\\d+)-STANDARD$`);
  return DATA.inst.map(i => { const m = i.code.match(re); if (!m || i.ex == null) return null; const p = DATA.instByCode[i.code.replace(/STANDARD$/, 'PREMIUM')];
    return { code: i.code, lo: +m[1], hi: +m[2], range: `${nf(+m[1])}–${nf(+m[2])}`, std: i, prem: p && p.ex != null ? p : null }; }).filter(Boolean).sort((a, b) => a.lo - b.lo);
}
export const diagnosis = type => DATA.rep.find(r => r.cat === 'ตรวจวินิจฉัย' && r.rate.s != null && (type === 'wall' ? /ติดผนัง/.test(r.name) : /แขวน|สี่ทิศทาง/.test(r.name) && type !== 'floor')) || null;
const bandLabel = (type, b) => (type === 'wall' ? b.wall : b.other).replace('<=', 'ไม่เกิน ').replace(/-/g, '–');

// a − n + stepper; onChange gets the new value
function stepper(v, { min = 0, max = 999, label, onChange }) {
  const inp = h('input', { type: 'number', inputmode: 'numeric', min, max, value: v, 'aria-label': label });
  const set = n => { n = Math.max(min, Math.min(max, Math.round(+n || 0))); inp.value = n; onChange(n); };
  inp.addEventListener('change', () => set(inp.value));
  inp.addEventListener('input', () => { if (inp.value !== '') set(inp.value); });
  return h('div', { class: 'jc-step' }, h('button', { type: 'button', 'aria-label': `ลด ${label}`, onclick: () => set(+inp.value - 1) }, icon('minus', { size: 16 })), inp,
    h('button', { type: 'button', 'aria-label': `เพิ่ม ${label}`, onclick: () => set(+inp.value + 1) }, icon('plus', { size: 16 })));
}
// pressed-button group (single choice)
function seg(opts, cur, label, onPick, cls = '') {
  const g = h('div', { class: 'jc-seg ' + cls, role: 'group', 'aria-label': label });
  const draw = v => $$('button', g).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === String(v))));
  opts.forEach(([v, th, sub]) => g.append(h('button', { type: 'button', 'data-v': v, onclick: () => { draw(v); onPick(v); } }, th, sub ? h('small', {}, sub) : null)));
  draw(cur); return g;
}

export function mountJobCard(root, { onBook, onQuote, onShop } = {}) {
  const S = {
    job: 'clean',
    clean: { level: 'C1', pkg: 'Basic Clean', n: { wall: 2, ceiling: 0, cassette: 0, floor: 0 }, size: { wall: 0, ceiling: 0, cassette: 0, floor: 0 } },
    install: { type: 'wall', i: 0, tier: 'STANDARD', qty: 1 },
    repair: { type: 'wall', qty: 1, sym: new Set() },
    amc: { n: { wall: 12, ceiling: 0, cassette: 4, floor: 0 }, visits: 3, pkg: 'Standard Care' },
  };
  const tabs = h('div', { class: 'jc-tabs', role: 'tablist', 'aria-label': 'งานที่ต้องการ' });
  const body = h('div', { class: 'jc-body', role: 'tabpanel', id: 'jc-panel' });
  const sum = h('div', { class: 'jc-sum', 'aria-live': 'polite' });
  const acts = h('div', { class: 'jc-acts' });
  const foot = h('p', { class: 'jc-foot' });
  const ref = h('span', { class: 'jc-ref' }, 'เลขที่คำขอ SBP-·······');
  root.replaceChildren(
    h('div', { class: 'jc-head' }, h('h2', { class: 'jc-title' }, 'ใบงาน'), ref),
    tabs, body, h('div', { class: 'jc-tear', 'aria-hidden': 'true' }), sum, acts, foot);
  root.classList.add('jc-on');

  JOBS.forEach(([k, th]) => tabs.append(h('button', { type: 'button', role: 'tab', id: `jc-t-${k}`, 'aria-controls': 'jc-panel', 'data-job': k, onclick: () => set(k),
    onkeydown: e => { const i = JOBS.findIndex(j => j[0] === S.job); const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0; if (!d) return; e.preventDefault(); const n = JOBS[(i + d + JOBS.length) % JOBS.length][0]; set(n); $$('[data-job]', tabs).find(b => b.dataset.job === n).focus(); } }, th)));

  /* ---- per job: controls (built once per switch) + price (recomputed on every change) ---- */
  const row = (lab, ctl, extra) => h('div', { class: 'jc-row' }, h('span', { class: 'jc-lab' }, lab), ctl, extra || null);
  const unitOut = () => h('span', { class: 'jc-unit' });
  function buildClean() {
    const C = S.clean, outs = {};
    body.append(row('วิธีล้าง', seg([['C1', 'ล้างปกติ', 'C1 ที่ตำแหน่งเดิม'], ['C2', 'ล้างใหญ่', 'C2 ปลดเครื่องลงล้าง']], C.level, 'วิธีล้าง', v => { C.level = v; price(); }, 'two')));
    const list = h('div', { class: 'jc-units' }, h('div', { class: 'jc-u jc-uh', 'aria-hidden': 'true' }, h('span', {}, 'ประเภท'), h('span', {}, 'ขนาด (BTU)'), h('span', {}, 'จำนวน'), h('span', {}, 'ต่อเครื่อง')));
    CL_TYPES.forEach(t => {
      const bands = SIZE_BANDS.filter(b => cleanRate(C.pkg, 'C1', t, b.id));
      const sel = h('select', { 'aria-label': `ขนาด ${TYPE_BY_ID[t].th}`, onchange: () => { C.size[t] = +sel.value; price(); } }, bands.map(b => h('option', { value: b.id, selected: C.size[t] === b.id }, bandLabel(t, b))));
      outs[t] = unitOut();
      // most homes only have wall units: the other types stay folded until asked for (or already counted)
      list.append(h('div', { class: 'jc-u' + (C.n[t] ? ' on' : ''), hidden: t !== 'wall' && !C.n[t] && !C.more }, h('b', {}, TYPE_BY_ID[t].th), sel, stepper(C.n[t], { label: `จำนวน${TYPE_BY_ID[t].th}`, onChange: n => { C.n[t] = n; list.children[CL_TYPES.indexOf(t) + 1].classList.toggle('on', n > 0); price(); } }), outs[t]));
    });
    body.append(list);
    const folded = () => [...list.children].some(r => r.hidden);
    if (folded()) { const more = h('button', { type: 'button', class: 'jc-link', 'aria-expanded': 'false', onclick: () => { C.more = true; [...list.children].forEach(r => { r.hidden = false; }); more.remove(); list.querySelector('.jc-u:nth-child(3) select')?.focus(); } }, 'เพิ่มแอร์แขวน สี่ทิศทาง หรือตู้ตั้งพื้น'); body.append(more); }
    const pk = h('p', { class: 'jc-hint' });
    body.append(row('แพ็กเกจ', seg(CLEAN_PKGS.map(p => [p.id, p.th]), C.pkg, 'แพ็กเกจ', v => { C.pkg = v; price(); }, 'three')), pk);
    return () => {
      const P = PKG_INFO.find(p => p.id === C.pkg), K = CLEAN_PKGS.find(p => p.id === C.pkg);
      pk.textContent = `${P.pitch}: ${P.fit} — ${K.sub.replace(/ · /g, ', ')}`;
      let sub = 0, n = 0; const lines = [];
      CL_TYPES.forEach(t => { const r = cleanRate(C.pkg, C.level, t, C.size[t]); const u = r ? r.rate.s : null;
        outs[t].textContent = u == null ? 'ประเมิน' : baht(u); outs[t].title = 'ราคาต่อเครื่อง ก่อน VAT';
        if (C.n[t] && u != null) { sub += u * C.n[t]; n += C.n[t]; lines.push({ t, r, n: C.n[t] }); } });
      const gap = sub > 0 && sub < DATA.minBill ? DATA.minBill - sub : 0;
      const wall = cleanRate(C.pkg, C.level, 'wall', C.size.wall)?.rate.s || 0;
      const room = gap && wall ? Math.floor(gap / wall) : 0;
      return { n, total: sub + gap, rows: [[`ค่าล้าง ${n} เครื่อง (${LV[C.level]})`, sub], gap ? [`ปรับเป็นยอดขั้นต่ำต่อการเข้างาน ${baht(DATA.minBill)}`, gap] : null].filter(Boolean),
        hint: gap && room ? `ในยอดนี้ล้างแอร์ติดผนังเพิ่มได้อีก ${room} เครื่องโดยราคาไม่เปลี่ยน` : '',
        book: { service: 'clean', units: Object.fromEntries(Object.entries(C.n).filter(([, v]) => v)), level: LV[C.level], pkg: C.pkg, notes: `จากใบงาน: ${lines.map(l => `${TYPE_BY_ID[l.t].th} ${l.r.range} BTU × ${l.n}`).join(', ')} · ${LV[C.level]} · ${C.pkg}` },
        quote: lines.map(({ t, r, n: q }) => ({ kind: 'service', group: 'clean', key: `CL-${C.pkg}-${C.level}-${t}-${C.size[t]}`, name: `${r.name} · ${LV[C.level]}`, detail: `${C.pkg} · ${r.warranty || ''}`, unitEx: r.rate.s, qty: q, units: q })) };
    };
  }
  function buildInstall() {
    const I = S.install;
    const rangeSel = h('select', { 'aria-label': 'ขนาดเครื่อง' });
    const fill = () => { const rows = installRows(I.type); I.i = Math.min(I.i, rows.length - 1); rangeSel.replaceChildren(...rows.map((r, i) => h('option', { value: i, selected: i === I.i }, `${r.range} BTU`))); };
    rangeSel.addEventListener('change', () => { I.i = +rangeSel.value; price(); });
    body.append(row('ประเภท', seg(CL_TYPES.map(t => [t, TYPE_BY_ID[t].th]), I.type, 'ประเภทแอร์', v => { I.type = v; I.i = 0; fill(); price(); }, 'four')));
    body.append(row('ขนาด', rangeSel));
    const tierNote = h('p', { class: 'jc-hint' });
    body.append(row('ระดับงาน', seg([['STANDARD', 'มาตรฐาน'], ['PREMIUM', 'พรีเมียม']], I.tier, 'ระดับงานติดตั้ง', v => { I.tier = v; price(); }, 'two')), tierNote);
    body.append(row('จำนวน', stepper(I.qty, { min: 1, max: 99, label: 'จำนวนเครื่อง', onChange: n => { I.qty = n; price(); } })));
    body.append(h('button', { type: 'button', class: 'jc-link', onclick: () => onShop && onShop() }, 'ยังไม่มีเครื่อง ดูแอร์พร้อมราคาติดตั้ง'));
    fill();
    return () => {
      const r = installRows(I.type)[I.i]; const it = r && (I.tier === 'PREMIUM' ? r.prem : r.std);
      tierNote.textContent = I.tier === 'PREMIUM' ? 'วัสดุชุดพรีเมียม ทดสอบรั่วและทำสุญญากาศตามแบบฟอร์มติดตั้ง เคลมงานก่อน' : 'วัสดุระบุยี่ห้อทุกชิ้น รวมท่อและวัสดุ 4 เมตรแรก';
      if (!it) return { n: 0, total: 0, rows: [], hint: 'ขนาดนี้ประเมินหน้างาน', book: { service: 'install' }, quote: [] };
      return { n: I.qty, total: it.ex * I.qty, rows: [[`ค่าติดตั้ง${I.tier === 'PREMIUM' ? 'พรีเมียม' : 'มาตรฐาน'} ${TYPE_BY_ID[I.type].th} ${r.range} BTU × ${I.qty}`, it.ex * I.qty]],
        hint: 'ไม่รวมตัวเครื่อง รับประกันงานติดตั้ง 3 ปีเมื่อซื้อเครื่องกับบริษัท หรือ 1 ปีเมื่อจัดหาเครื่องเอง',
        book: { service: 'install', units: { [I.type]: I.qty }, notes: `จากใบงาน: ${it.name} × ${I.qty}` },
        quote: [{ kind: 'service', group: 'install', key: `I-${it.code}`, name: it.name, detail: 'รวมท่อและวัสดุ 4 เมตรแรก', unitEx: it.ex, qty: I.qty }] };
    };
  }
  function buildRepair() {
    const R = S.repair;
    body.append(row('ประเภท', seg(CL_TYPES.map(t => [t, TYPE_BY_ID[t].th]), R.type, 'ประเภทแอร์', v => { R.type = v; price(); }, 'four')));
    const box = h('div', { class: 'jc-sym', role: 'group', 'aria-label': 'อาการที่พบ' });
    SYMPTOMS.forEach(s => box.append(h('button', { type: 'button', 'aria-pressed': String(R.sym.has(s)), onclick: e => { R.sym.has(s) ? R.sym.delete(s) : R.sym.add(s); e.currentTarget.setAttribute('aria-pressed', String(R.sym.has(s))); price(); } }, s)));
    body.append(row('อาการ', box));
    body.append(row('จำนวน', stepper(R.qty, { min: 1, max: 99, label: 'จำนวนเครื่องที่มีอาการ', onChange: n => { R.qty = n; price(); } })));
    return () => {
      const d = diagnosis(R.type); const sym = [...R.sym];
      const book = { service: 'repair', units: { [R.type]: R.qty }, notes: `จากใบงาน: ${TYPE_BY_ID[R.type].th} × ${R.qty}${sym.length ? ' · อาการ: ' + sym.join(', ') : ''}` };
      if (!d) return { n: R.qty, total: null, rows: [['ค่าตรวจวินิจฉัย', null]], hint: 'แอร์ตู้ตั้งพื้น ทีมแจ้งค่าตรวจก่อนนัด', book, quote: [] };
      return { n: R.qty, total: d.rate.s * R.qty, rows: [[`ค่าตรวจวินิจฉัย ${TYPE_BY_ID[R.type].th} × ${R.qty}`, d.rate.s * R.qty]],
        hint: 'ค่าซ่อมแจ้งเป็นรายรายการให้อนุมัติก่อนลงมือทุกครั้ง', book,
        quote: [{ kind: 'service', group: 'repair', key: `RP-${d.name}`, name: d.name, detail: 'ยังไม่รวมค่าซ่อม · แจ้งราคาก่อนซ่อม', unitEx: d.rate.s, qty: R.qty }] };
    };
  }
  function buildAmc() {
    const A = S.amc;
    const list = h('div', { class: 'jc-units amc' });
    CL_TYPES.forEach(t => list.append(h('div', { class: 'jc-u' + (A.n[t] ? ' on' : '') }, h('b', {}, TYPE_BY_ID[t].th),
      stepper(A.n[t], { max: 9999, label: `จำนวน${TYPE_BY_ID[t].th}`, onChange: n => { A.n[t] = n; list.children[CL_TYPES.indexOf(t)].classList.toggle('on', n > 0); price(); } }))));
    body.append(list);
    body.append(row('รอบล้างต่อปี', seg([[2, '2 ครั้ง'], [3, '3 ครั้ง'], [4, '4 ครั้ง']], A.visits, 'รอบล้างต่อปี', v => { A.visits = +v; price(); }, 'three')));
    body.append(row('แพ็กเกจ', seg(CLEAN_PKGS.map(p => [p.id, p.th]), A.pkg, 'แพ็กเกจ', v => { A.pkg = v; price(); }, 'three')));
    return () => {
      const e = estimateContract({ units: A.n, visits: A.visits, pkg: A.pkg });
      if (!e.count) return { n: 0, total: 0, rows: [], hint: 'ใส่จำนวนเครื่องอย่างน้อย 1 เครื่อง', book: { service: 'amc' }, quote: [] };
      const rows = [[`ล้างปกติ ${A.visits - 1} รอบ + ล้างใหญ่ 1 รอบ · ${e.count} เครื่อง`, e.annualStd]];
      if (e.discount) rows.push([`${e.tierTh}`, -e.discount]);
      return { n: e.count, total: e.annualEx, per: 'ต่อปี', rows,
        hint: e.project ? 'ตั้งแต่ 100 เครื่อง ขอราคาโครงการเพิ่มได้ในใบเสนอราคา' : e.next ? `เพิ่มอีก ${e.next.need} เครื่อง ได้ราคาขั้น ${e.next.tier.th} (${e.next.tier.note})` : `เฉลี่ย ${baht(e.perUnitYear)} ต่อเครื่องต่อปี`,
        book: { service: 'amc', units: Object.fromEntries(Object.entries(A.n).filter(([, v]) => v)), pkg: A.pkg, notes: `จากใบงาน: สัญญาล้างรายปี ${e.count} เครื่อง ${A.visits} ครั้ง/ปี · ${A.pkg} · ประมาณการ ${baht(e.annualEx)}/ปี ก่อน VAT` },
        quote: [{ kind: 'service', group: 'contract', key: `K-${e.count}-${A.visits}-${A.pkg}`, name: `สัญญาล้างรายปี ${e.count} เครื่อง × ${A.visits} ครั้ง/ปี`, detail: `${A.pkg} · ${e.tierTh}`, unitEx: e.annualEx, qty: 1, units: e.count }] };
    };
  }
  const BUILD = { clean: buildClean, install: buildInstall, repair: buildRepair, amc: buildAmc };
  let calc = null, last = null;

  function price() {
    const r = last = calc();
    sum.replaceChildren(
      h('dl', { class: 'jc-lines' }, r.rows.flatMap(([k, v]) => [h('dt', {}, k), h('dd', {}, v == null ? 'แจ้งก่อนนัด' : (v < 0 ? '−' : '') + baht(Math.abs(v)))])),
      h('p', { class: 'jc-total' }, h('span', {}, S.job === 'repair' ? 'ค่าตรวจ' : 'รวม'), h('b', { class: 'jc-num' }, r.total == null ? 'แจ้งก่อนนัด' : baht(r.total)), h('small', {}, `ก่อน VAT${r.per ? ' ' + r.per : ''}`)),
      r.hint ? h('p', { class: 'jc-hint strong' }, r.hint) : '');
    const can = r.n > 0;
    acts.replaceChildren(
      h('button', { type: 'button', class: 'jc-go', disabled: !can, onclick: () => onBook && onBook(r.book) }, S.job === 'amc' ? 'นัดสำรวจหน้างาน' : S.job === 'repair' ? 'นัดช่างตรวจ' : 'เลือกวันและจองคิว'),
      h('button', { type: 'button', class: 'jc-add', disabled: !r.quote.length, onclick: () => onQuote && onQuote(r.quote) }, 'ใส่ใบเสนอราคา'));
    foot.replaceChildren('บุคคลทั่วไปชำระตามราคานี้ ต้องการใบกำกับภาษีบวก VAT 7%', FORM[S.job] ? h('br') : '', FORM[S.job] ? `ขั้นตอนตามแบบฟอร์ม ${FORM[S.job]}` : '');
    root.dispatchEvent(new CustomEvent('jc:change', { detail: api.summary() }));
  }
  function set(job) {
    S.job = job;
    $$('[data-job]', tabs).forEach(b => { const on = b.dataset.job === job; b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1; });
    body.setAttribute('aria-labelledby', `jc-t-${job}`);
    body.replaceChildren(); calc = BUILD[job](); price();
  }
  const api = {
    set, state: S,
    // preset from a price table elsewhere on the page: {job:'clean', type, size, pkg, level} | {job:'install', type, i, tier}
    load(o) {
      if (o.job === 'clean') { const C = S.clean; Object.assign(C, { pkg: o.pkg || C.pkg, level: o.level || C.level }); if (o.type) { C.size[o.type] = o.size ?? C.size[o.type]; C.n[o.type] = Math.max(1, C.n[o.type]); } }
      if (o.job === 'install') Object.assign(S.install, { type: o.type || S.install.type, i: o.i ?? 0, tier: o.tier || S.install.tier });
      set(o.job);
    },
    summary: () => last && { job: S.job, label: JOBS.find(j => j[0] === S.job)[1], n: last.n, total: last.total, per: last.per || '' },
    // the booking section reports the ticket number back once the back office has stored it (never before)
    stamp(id) { ref.textContent = `เลขที่คำขอ ${id}`; ref.classList.add('ok'); },
  };
  set('clean');
  return api;
}
