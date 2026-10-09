// SBP AirCare — Room Studio UI (shared by all three variants). Builds its own markup inside `root`,
// styled by assets/studio.css through the variant's --s-* tokens. cfg: { theme, onOpen(model, skuIndex), sceneStart }
import { icon } from './icons.js';
import { DEMO, BRAND_BY_ID, TYPE_BY_ID, DATA, CLEAN_PKGS, VAT, baht, btuFmt, h, $, $$, installOptions, cleanRate } from './sbp-core.js';
import { cart } from './commerce.js';
import { toast } from './proto-ui.js';
import { SCENE_GROUPS, SCENES, SCENE_BY_ID, TYPE_RULES, STD_SIZES, needBtu, btuBreakdown, recommendUnits, dirtFrom, effects, cleanInterval, dirtTh, thermal, stepT, timeToSet, steadyT, T_START, T_SET, ORIENT, GLASS, defaultOrient, dustRate, RISK, energy, RATE, EFF, LOAD_F } from './studio-model.js';

const RM = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const TYPE_ORDER = ['wall', 'ceiling', 'cassette', 'floor', 'duct'];
const ICON = {
  home: '<path d="M3 11 12 4l9 7v9H3z"/><path d="M9 20v-6h6v6"/>',
  office: '<rect x="4" y="3" width="16" height="18" rx="1"/><path d="M8 7h2M14 7h2M8 11h2M14 11h2M8 15h2M14 15h2"/>',
  biz: '<path d="M4 9h16l-1-5H5z"/><path d="M5 9v11h14V9"/><path d="M10 20v-5h4v5"/>',
  ind: '<path d="M3 20V9l5 3V9l5 3V9l5 3V4h3v16z"/>',
  inst: '<path d="M4 21V8l8-5 8 5v13z"/><path d="M12 9v6M9 12h6M10 21v-3h4v3"/>',
  condo: '<rect x="5" y="2" width="14" height="20" rx="1"/><path d="M9 6h2M13 6h2M9 10h2M13 10h2M9 14h2M13 14h2M10 22v-4h4v4"/>',
  retail: '<path d="M4 9h16l-1-5H5z"/><path d="M5 9v11h14V9"/><path d="M10 20v-5h4v5"/>',
  service: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/>',
  hotel: '<path d="M3 20V6h18v14"/><path d="M3 14h18M7 10h3M14 10h3M8 20v-3h8v3"/>',
  school: '<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c2 2 10 2 12 0v-5"/>',
  hospital: '<rect x="4" y="3" width="16" height="18" rx="1"/><path d="M12 7v6M9 10h6M10 21v-4h4v4"/>',
};
const ico = g => `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" aria-hidden="true">${ICON[g]}</svg>`;

// sizes that actually exist in the price book for a type
function catalogSizes(type) {
  const s = new Set(); DEMO.models.filter(m => m.type === type).forEach(m => m.skus.forEach(k => s.add(k.btu)));
  return [...s].sort((a, b) => a - b);
}
const sizeBandFor = (type, btu) => type === 'wall' ? (btu <= 18000 ? 0 : btu <= 24000 ? 1 : btu <= 36000 ? 2 : 3) : (btu <= 24000 ? 0 : btu <= 36000 ? 1 : btu <= 48000 ? 2 : 3);

export async function mountStudio(root, cfg = {}) {
  const theme = cfg.theme || 'light';
  root.classList.add('st', 'st-' + theme);
  const S0 = SCENE_BY_ID[cfg.sceneStart || 'bedroom'];
  const state = { scene: S0, p: pick(S0), type: S0.types[0], n: 1, per: 12000, months: 6, auto: true, T: T_START, sim: 0, reached: null, view: 'room', pkg: 'Standard Care' };
  function pick(s) { return { w: s.w, d: s.d, h: s.h, people: s.people, equip: s.equip, sun: s.closed ? 0 : s.sun, orient: defaultOrient(s), roof: false, closed: !!s.closed }; }

  /* ---------- markup ---------- */
  const groupBar = h('div', { class: 'st-groups', role: 'tablist', 'aria-label': 'ประเภทพื้นที่' });
  const sceneBar = h('div', { class: 'st-scenes', role: 'listbox', 'aria-label': 'เลือกห้อง' });
  const viewTabs = h('div', { class: 'st-views', role: 'tablist', 'aria-label': 'มุมมอง' },
    [['room', 'ห้อง 3 มิติ'], ['inside', 'ข้างในเครื่อง'], ['cycle', 'วงจรทำความเย็น']].map(([id, th]) => h('button', { type: 'button', role: 'tab', 'data-view': id, 'aria-selected': id === 'room' }, th)));
  const canvasBox = h('div', { class: 'st-canvas' });
  const insCv = h('canvas', { class: 'st-in-cv', 'aria-label': 'ภาพจำลองแผ่นกรอง คอยล์เย็น พัดลม และถาดน้ำทิ้ง เมื่อไม่ได้ล้าง' });
  const insSide = h('div', { class: 'st-in-side' });
  const inside = h('div', { class: 'st-inside', hidden: true }, h('div', { class: 'st-in-art' }, insCv), insSide);
  const cycle = h('div', { class: 'st-cycle', hidden: true });
  const hud = h('div', { class: 'st-hud', 'aria-live': 'polite' });
  const layersBar = h('div', { class: 'st-layers' }, [['air', 'ลมเย็น'], ['heat', 'อุณหภูมิพื้น'], ['dust', 'ฝุ่นในอากาศ'], ['marks', 'สัญลักษณ์']].map(([k, th]) => h('button', { type: 'button', 'data-layer': k, 'aria-pressed': 'true' }, h('i', { class: 'st-dot ' + k }), th)));
  const legend = h('div', { class: 'st-legend', 'aria-hidden': 'true' }, h('span', {}, '21°'), h('i'), h('span', {}, '34°C'));
  const cam = h('div', { class: 'st-cam' }, h('button', { type: 'button', 'aria-label': 'ซูมออก', 'data-z': '1.15' }, '−'), h('button', { type: 'button', 'aria-label': 'ซูมเข้า', 'data-z': '0.87' }, '+'), h('button', { type: 'button', 'aria-label': 'มุมเริ่มต้น', 'data-reset': '' }, '⟲'));
  const fallback = h('div', { class: 'st-fb', hidden: true }, 'อุปกรณ์นี้แสดงภาพ 3 มิติไม่ได้ ตัวเลขและคำแนะนำด้านล่างยังใช้งานได้ตามปกติ');
  const stage = h('div', { class: 'st-stage' }, viewTabs, canvasBox, inside, cycle, hud, layersBar, legend, cam, fallback);

  const rng = (key, label, min, max, step, unit) => h('label', { class: 'st-rng' }, h('span', {}, label, h('b', { 'data-show': key }), unit ? h('small', {}, unit) : null), h('input', { type: 'range', min, max, step, 'data-p': key, 'aria-label': label }));
  const sunSeg = h('div', { class: 'st-seg', role: 'radiogroup', 'aria-label': 'ขนาดกระจก' }, GLASS.map((g, i) => h('button', { type: 'button', role: 'radio', 'data-sun': i }, g.th)));
  const orSeg = h('div', { class: 'st-seg or', role: 'radiogroup', 'aria-label': 'ผนังรับแดดหันทิศ' }, ORIENT.map(o => h('button', { type: 'button', role: 'radio', 'data-or': o.id }, o.th)));
  const envTg = h('div', { class: 'st-tg' }, h('button', { type: 'button', 'data-tg': 'roof', 'aria-pressed': 'false' }, 'ชั้นบนสุด ใต้หลังคารับแดด'), h('button', { type: 'button', 'data-tg': 'closed', 'aria-pressed': 'false' }, 'ห้องปิดทึบ อับ ไม่มีหน้าต่าง'));
  const typeSeg = h('div', { class: 'st-types', role: 'radiogroup', 'aria-label': 'ประเภทเครื่อง' });
  const sizeSel = h('select', { class: 'st-size', 'aria-label': 'ขนาดต่อเครื่อง' });
  const nOut = h('b', { class: 'st-n' }, '1');
  const monthsIn = h('input', { type: 'range', min: '0', max: '18', step: '1', 'aria-label': 'ไม่ได้ล้างมากี่เดือน' });
  const dirtBar = h('div', { class: 'st-dirt' }, h('i'), h('span'));
  const cleanBtn = h('button', { type: 'button', class: 's-btn primary st-clean' }, 'ล้างเครื่องตอนนี้');
  const panel = h('aside', { class: 'st-panel' },
    h('section', {}, h('h3', {}, 'ขนาดและการใช้งานห้อง'), rng('w', 'กว้าง', 2, 30, 0.5, 'ม.'), rng('d', 'ลึก', 2, 24, 0.5, 'ม.'), rng('h', 'สูงถึงฝ้า', 2.4, 7, 0.1, 'ม.'), rng('people', 'จำนวนคน', 0, 60, 1, 'คน'), rng('equip', 'เครื่องใช้ไฟฟ้า / เครื่องจักร', 0, 30000, 100, 'วัตต์')),
    h('section', { class: 'st-env' }, h('h3', {}, 'แดดและสภาพอาคาร'), h('span', { class: 'st-lbl' }, 'ผนังหน้าต่าง/ผนังรับแดดหันทิศ'), orSeg, h('span', { class: 'st-lbl' }, 'ขนาดกระจกด้านนั้น'), sunSeg, envTg),
    h('section', {}, h('h3', {}, 'เครื่องปรับอากาศ'), typeSeg,
      h('div', { class: 'st-row two' }, h('label', { class: 'st-lbl' }, 'ขนาดต่อเครื่อง', sizeSel), h('div', { class: 'st-lbl' }, 'จำนวน', h('div', { class: 'st-stp' }, h('button', { type: 'button', 'data-n': '-1', 'aria-label': 'ลดจำนวน' }, '−'), nOut, h('button', { type: 'button', 'data-n': '1', 'aria-label': 'เพิ่มจำนวน' }, '+')))),
      h('button', { type: 'button', class: 'st-auto', 'data-auto': '' }, 'ใช้ขนาดที่แนะนำ')),
    h('section', {}, h('h3', {}, 'สภาพเครื่อง'), h('label', { class: 'st-rng' }, h('span', {}, 'ไม่ได้ล้างมา', h('b', { 'data-show': 'months' }), h('small', {}, 'เดือน')), monthsIn), dirtBar, cleanBtn));
  const kpis = h('div', { class: 'st-kpis' });
  const bd = h('div', { class: 'st-bd', 'aria-live': 'polite' });
  const note = h('div', { class: 'st-note' });
  const riskBar = h('div', { class: 'st-risk', 'aria-live': 'polite' });
  const energyCard = h('section', { class: 'st-energy' });
  const reco = h('div', { class: 'st-reco' });
  root.append(h('div', { class: 'st-top' }, groupBar, sceneBar, riskBar), h('div', { class: 'st-main' }, stage, panel), kpis, bd, note, energyCard, reco,
    h('p', { class: 's-note st-disc' }, 'ภาพและตัวเลขในห้องจำลองเป็นแบบจำลองเพื่ออธิบายหลักการ (ขนาด BTU ใช้สูตรประมาณตามพื้นที่และการใช้งาน ผลของฝุ่นเป็นค่าประกอบการอธิบาย) ไม่ใช่ค่าที่วัดจากเครื่องจริง ขนาดและจำนวนเครื่องต้องยืนยันจากการสำรวจหน้างาน เวลาในแบบจำลองเร่ง 1 วินาที = 1 นาที'));

  /* ---------- scenes ---------- */
  let group = S0.g;
  function renderGroups() {
    groupBar.innerHTML = '';
    SCENE_GROUPS.forEach(g => groupBar.append(h('button', { type: 'button', role: 'tab', 'aria-selected': g.id === group, onclick: () => { group = g.id; renderGroups(); renderScenes(); const first = SCENES.find(s => s.g === g.id); first && setScene(first); } }, h('span', { html: ico(g.id) }), g.th)));
  }
  function renderScenes() {
    sceneBar.innerHTML = '';
    SCENES.filter(s => s.g === group).forEach(s => sceneBar.append(h('button', { type: 'button', role: 'option', 'aria-selected': s === state.scene, onclick: () => setScene(s) }, h('b', {}, s.th), h('small', {}, `${s.w}×${s.d} ม. · ${TYPE_RULES[s.types[0]].th}`), s.risk && s.risk.length ? h('span', { class: 'st-rdots' }, s.risk.map(r => h('i', { class: 'r-' + r, title: RISK[r] }))) : null)));
  }

  /* ---------- 3D ---------- */
  // 3D is created lazily when the studio scrolls near the viewport (saves a WebGL context + CPU on long pages);
  // until then — or if WebGL is unavailable — the model runs on a timer so every number still works.
  let V = null, timer = null;
  const runTimer = () => { let l = performance.now(); timer = setInterval(() => { const n = performance.now(); tick(Math.min(0.1, (n - l) / 1000)); l = n; }, 100); };
  runTimer();
  async function boot3D() {
    try { const { createStudio3D } = await import('./studio3d.js'); V = createStudio3D(canvasBox, { theme, onFrame: tick }); }
    catch (e) { console.warn('studio 3D unavailable', e); fallback.hidden = false; return; }
    clearInterval(timer);
    V.setScene(state.scene, state.p); V.setUnits({ type: state.type, n: state.n, per: state.per }); V.setDirt(dirt()); V.setCap(Math.min(1.4, th.cap / Math.max(1, th.Qset))); if (state.view !== 'room') V.pause(true);
    $$('[data-layer]', layersBar).forEach(b => V.setLayer(b.dataset.layer, b.getAttribute('aria-pressed') === 'true'));
  }
  const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { io.disconnect(); boot3D(); } }, { rootMargin: '600px 0px' });
  io.observe(stage);

  /* ---------- model ---------- */
  let th = null, thClean = null, sizes = [];
  function dirt() { return dirtFrom(state.months, dustRate(state.scene, state.p)); }
  function recompute(resetSim = false) {
    const s = state.scene, p = state.p;
    sizes = catalogSizes(state.type); if (!sizes.length) sizes = STD_SIZES;
    const need = needBtu(p, s), area = p.w * p.d;
    const rec = recommendUnits(need, area, state.type, sizes);
    if (state.auto) { state.n = rec.n; state.per = rec.per; }
    if (!sizes.includes(state.per)) state.per = sizes.find(x => x >= state.per) || sizes[sizes.length - 1];
    th = thermal(p, s, state.n * state.per, dirt()); thClean = thermal(p, s, state.n * state.per, 0);
    if (resetSim) { state.T = T_START; state.sim = 0; state.reached = null; }
    state.need = need; state.rec = rec;
    V && V.setCap(Math.min(1.4, th.cap / Math.max(1, th.Qset)));
    V && V.setDirt(dirt());
    renderControls(); renderKpis(); renderBd(); renderNote(); renderRisk(); renderEnergy(); renderReco(); drawInside(true); updateCycle();
  }
  function tick(dt) {
    if (!th) return;
    const dtSim = dt * 60; // 1 s real = 1 min simulated
    for (let k = 0; k < 6; k++) state.T = stepT(state.T, th, dtSim / 6);
    state.sim += dtSim / 60;
    if (state.reached == null && state.T <= T_SET + 0.1) state.reached = state.sim;
    if (state.sim > 240) { state.T = T_START; state.sim = 0; state.reached = null; }
    V && V.setTemp(state.T);
    hudT(); if (state.view === 'inside') drawInside();
  }
  let hudAcc = 0;
  function hudT() {
    if ((hudAcc += 1) % 6) return;
    hud.innerHTML = '';
    const ss = steadyT(th);
    hud.append(h('div', { class: 'st-temp' }, h('b', {}, state.T.toFixed(1) + '°C'), h('small', {}, `ตั้งไว้ ${T_SET}°C · นอกห้อง 34°C`)),
      h('div', { class: 'st-clock' }, h('span', {}, `นาทีที่ ${Math.floor(state.sim)}`), state.reached != null ? h('em', { class: 'ok' }, `ถึง ${T_SET}°C ใน ${Math.round(state.reached)} นาที`) : ss > T_SET + 0.1 ? h('em', { class: 'bad' }, `คาดว่าไม่ถึง ${T_SET}°C · ค้างที่ ~${ss.toFixed(1)}°C`) : h('em', {}, 'กำลังทำความเย็น…')));
  }

  /* ---------- controls ---------- */
  function renderControls() {
    const p = state.p;
    $$('[data-p]', panel).forEach(i => { const k = i.dataset.p; if (document.activeElement !== i) i.value = p[k]; });
    $$('[data-show]', panel).forEach(b => { const k = b.dataset.show; b.textContent = k === 'months' ? String(state.months) : k === 'equip' ? Number(p[k]).toLocaleString() : String(p[k]); });
    $$('[data-sun]', sunSeg).forEach(b => { b.setAttribute('aria-checked', !p.closed && +b.dataset.sun === p.sun); b.disabled = !!p.closed; });
    $$('[data-or]', orSeg).forEach(b => { b.setAttribute('aria-checked', !p.closed && b.dataset.or === p.orient); b.disabled = !!p.closed; });
    $$('[data-tg]', envTg).forEach(b => b.setAttribute('aria-pressed', !!p[b.dataset.tg]));
    typeSeg.innerHTML = '';
    TYPE_ORDER.forEach(t => { const ok = state.scene.types.includes(t); typeSeg.append(h('button', { type: 'button', role: 'radio', 'aria-checked': t === state.type, class: ok ? 'fit' : '', title: ok ? 'เหมาะกับห้องนี้' : 'ใช้ได้แต่ไม่ใช่ตัวเลือกแรกของห้องนี้', onclick: () => { state.type = t; state.auto = true; recompute(true); V && V.setUnits({ type: state.type, n: state.n, per: state.per }); } }, TYPE_RULES[t].th, ok ? icon('star', { size: 13, cls: 'st-fit-ic' }) : null)); });
    sizeSel.innerHTML = ''; sizes.forEach(s => sizeSel.append(h('option', { value: s, selected: s === state.per }, btuFmt(s))));
    nOut.textContent = String(state.n);
    monthsIn.value = state.months;
    const d = dirt(); dirtBar.style.setProperty('--d', d.toFixed(3)); $('span', dirtBar).textContent = `${dirtTh(d)} · ฝุ่นสะสม ~${Math.round(d * 100)}%`;
    $('[data-auto]', panel).hidden = state.auto;
  }
  $$('[data-p]', panel).forEach(i => i.addEventListener('input', () => { state.p[i.dataset.p] = +i.value; state.auto = true; schedule(true); }));
  $$('[data-sun]', sunSeg).forEach(b => b.addEventListener('click', () => { state.p.sun = +b.dataset.sun; state.auto = true; schedule(true); }));
  $$('[data-or]', orSeg).forEach(b => b.addEventListener('click', () => { state.p.orient = b.dataset.or; state.auto = true; schedule(true); }));
  $$('[data-tg]', envTg).forEach(b => b.addEventListener('click', () => { const k = b.dataset.tg; state.p[k] = !state.p[k]; if (k === 'closed' && !state.p.closed && state.p.orient === 'none') state.p.orient = 'E'; state.auto = true; schedule(true); }));
  sizeSel.addEventListener('change', () => { state.per = +sizeSel.value; state.auto = false; recompute(true); V && V.setUnits({ type: state.type, n: state.n, per: state.per }); });
  $$('[data-n]', panel).forEach(b => b.addEventListener('click', () => { state.n = Math.max(1, Math.min(40, state.n + +b.dataset.n)); state.auto = false; recompute(true); V && V.setUnits({ type: state.type, n: state.n, per: state.per }); }));
  $('[data-auto]', panel).addEventListener('click', () => { state.auto = true; recompute(true); V && V.setUnits({ type: state.type, n: state.n, per: state.per }); });
  monthsIn.addEventListener('input', () => { state.months = +monthsIn.value; recompute(false); });
  state.hrs = null; state.rate = null; state.inv = true;
  cleanBtn.addEventListener('click', () => {
    if (state.months === 0) { state.months = 9; recompute(false); return; }
    const from = state.months, t0 = performance.now(), dur = RM() ? 1 : 1600; cleanBtn.disabled = true; cleanBtn.textContent = 'กำลังล้าง…';
    const step = t => { const k = Math.min(1, (t - t0) / dur); state.months = Math.round(from * (1 - k)); recompute(false); if (k < 1) requestAnimationFrame(step); else { cleanBtn.disabled = false; cleanBtn.textContent = 'ล้างเครื่องตอนนี้'; state.T = T_START; state.sim = 0; state.reached = null; toast('ล้างแล้ว ลมกลับมาเต็มแรง เริ่มจับเวลาใหม่'); } };
    requestAnimationFrame(step);
  });
  let sched = null, schedGeo = false;
  function schedule(geo) { schedGeo = schedGeo || geo; clearTimeout(sched); sched = setTimeout(() => { recompute(true); if (V && schedGeo) { V.setParams(state.p); V.setUnits({ type: state.type, n: state.n, per: state.per }); } schedGeo = false; }, 140); }
  $$('[data-layer]', layersBar).forEach(b => b.addEventListener('click', () => { const on = b.getAttribute('aria-pressed') !== 'true'; b.setAttribute('aria-pressed', on); V && V.setLayer(b.dataset.layer, on); legend.hidden = b.dataset.layer === 'heat' ? !on : legend.hidden; }));
  $$('[data-z]', cam).forEach(b => b.addEventListener('click', () => V && V.zoom(+b.dataset.z)));
  $('[data-reset]', cam).addEventListener('click', () => V && V.resetView());
  $$('[data-view]', viewTabs).forEach(b => b.addEventListener('click', () => setView(b.dataset.view)));
  function setView(v) {
    state.view = v; $$('[data-view]', viewTabs).forEach(b => b.setAttribute('aria-selected', b.dataset.view === v));
    canvasBox.hidden = v !== 'room'; layersBar.hidden = v !== 'room'; legend.hidden = v !== 'room'; cam.hidden = v !== 'room'; hud.hidden = v !== 'room';
    inside.hidden = v !== 'inside'; cycle.hidden = v !== 'cycle'; stage.classList.toggle('v-cycle', v === 'cycle'); stage.classList.toggle('v-inside', v === 'inside'); V && V.pause(v !== 'room');
    if (v === 'inside') drawInside(true); if (v === 'cycle') updateCycle();
  }

  function setScene(s) {
    state.scene = s; state.p = pick(s); state.type = s.types[0]; state.auto = true; group = s.g; state.hrs = null; state.rate = null;
    renderGroups(); renderScenes(); recompute(true);
    V && (V.setScene(s, state.p), V.setUnits({ type: state.type, n: state.n, per: state.per }), V.setDirt(dirt()));
    cfg.onScene && cfg.onScene(s);
  }

  /* ---------- KPIs ---------- */
  function renderKpis() {
    const d = dirt(), e = effects(d), ci = cleanInterval(dustRate(state.scene, state.p));
    const total = state.n * state.per, ratio = total / state.need;
    const fit = ratio < 0.95 ? ['bad', 'เล็กเกินไป — เย็นช้า เครื่องทำงานหนัก'] : ratio > 1.6 ? ['warn', 'ใหญ่เกินจำเป็น — ลงทุนเกิน'] : ['ok', 'ขนาดเหมาะสม'];
    const tc = timeToSet(thClean), tn = timeToSet(th), ss = steadyT(th);
    kpis.innerHTML = '';
    const card = (lbl, big, sub, cls = '') => h('div', { class: 'st-kpi ' + cls }, h('span', { class: 'st-lbl' }, lbl), h('b', {}, big), sub ? h('small', {}, sub) : null);
    kpis.append(
      card('ห้องนี้ต้องการประมาณ', btuFmt(state.need), `เลือกไว้ ${state.n} × ${btuFmt(state.per)}${state.n > 1 ? ` = ${btuFmt(total)}` : ''} · ${fit[1]}`, fit[0]),
      card(`เย็นถึง ${T_SET}°C (จาก 32°C)`, tn != null ? `${Math.round(tn)} นาที` : `ไม่ถึง`, tc != null ? (tn != null ? `ถ้าเครื่องสะอาด ${Math.round(tc)} นาที${tn - tc >= 1 ? ` · ช้าลง ${Math.round(tn - tc)} นาที` : ''}` : `ถ้าเครื่องสะอาด ${Math.round(tc)} นาที · ตอนนี้ค้างที่ ~${ss.toFixed(1)}°C`) : 'เครื่องเล็กเกินห้อง แม้สะอาดก็ไม่ถึง', tn == null ? 'bad' : tn - (tc || tn) > 8 ? 'warn' : 'ok'),
      card('ผลของฝุ่นสะสม (แบบจำลอง)', `ลม −${Math.round((1 - e.air) * 100)}%`, `ความเย็นที่ได้ −${Math.round((1 - e.cap) * 100)}% · ไฟฟ้าต่อความเย็น +${Math.round((e.power - 1) * 100)}%`, d > 0.6 ? 'bad' : d > 0.35 ? 'warn' : 'ok'),
      card('รอบล้างที่แนะนำสำหรับห้องนี้', `ทุก ${ci.months} เดือน`, `${ci.visits} ครั้ง/ปี · ปรับตามสภาพจริงหลังตรวจครั้งแรก`),
    );
  }
  const BD_COL = { base: '#1b6fc2', sun: '#f0a020', roof: '#f06a28', people: '#6b7a8c', equip: '#c0392b' };
  function renderBd() {
    const B = btuBreakdown(state.p, state.scene); const pos = B.items.filter(i => i.btu > 1); const sum = pos.reduce((a, b) => a + b.btu, 0) || 1;
    bd.innerHTML = '';
    bd.append(h('h3', {}, h('span', {}, 'ที่มาของ BTU ที่ห้องนี้ต้องการ'), h('b', {}, btuFmt(B.total))),
      h('div', { class: 'st-bd-bar', role: 'img', 'aria-label': 'สัดส่วน BTU แยกตามที่มา' }, pos.map(i => h('i', { style: `width:${(i.btu / sum * 100).toFixed(1)}%;background:${BD_COL[i.k]}`, title: i.th }))),
      h('ul', {}, B.items.filter(i => Math.abs(i.btu) >= 50).map(i => h('li', { class: i.btu < 0 ? 'neg' : '' }, h('i', { style: `background:${BD_COL[i.k]}` }), h('span', {}, i.th), h('b', {}, (i.btu < 0 ? '−' : i.k === 'base' ? '' : '+') + Math.abs(Math.round(i.btu / 100) * 100).toLocaleString('en-US'))))),
      h('p', { class: 's-note', style: 'margin:0' }, 'สูตรประมาณเพื่ออธิบายผลของแดด หลังคา คน และเครื่องใช้ไฟฟ้า ใช้เลือกขนาดเบื้องต้นเท่านั้น ขนาดจริงยืนยันจากการสำรวจหน้างาน'));
  }
  function renderNote() {
    const s = state.scene; const warn = [];
    if (s.humid) warn.push('ต้องสำรวจก่อนติดตั้ง: ความชื้นสูง');
    if (s.critical) warn.push('ห้องที่ต้องเย็นตลอดเวลา: ควรมีเครื่องสำรอง');
    if (state.rec.project) warn.push('พื้นที่ใหญ่: ควรออกแบบเป็นงานโครงการ');
    if (!s.types.includes(state.type)) warn.push(`${TYPE_RULES[state.type].th} ไม่ใช่ตัวเลือกแรกของห้องนี้`);
    const p = state.p;
    if (p.closed) warn.push('ห้องปิดทึบ: แอร์ไม่ได้เติมอากาศใหม่ ควรมีพัดลมระบายหรือช่องเติมอากาศ ความชื้น กลิ่น และฝุ่นในเครื่องสะสมเร็วขึ้น (แบบจำลองคิดเร็วขึ้น 30%) จึงแนะนำรอบล้างถี่กว่าปกติ');
    if (p.roof) warn.push('ชั้นบนสุดใต้หลังคา: ความร้อนจากหลังคาเพิ่มภาระราว 12% ในแบบจำลอง ฉนวนใต้หลังคาและการระบายอากาศใต้หลังคาช่วยลดได้');
    if (!p.closed && p.orient === 'W') warn.push('ผนังทิศตะวันตก: ห้องร้อนที่สุดช่วงบ่าย ม่านกันแสงหรือฟิล์มกันความร้อนช่วยลดภาระ และควรเลือกขนาดตามช่วงบ่าย');
    if (!p.closed && p.sun === 2) warn.push('ผนังกระจกบานใหญ่: ตำแหน่งติดตั้งควรให้ลมเย็นกวาดผ่านแนวกระจก');
    note.innerHTML = '';
    note.append(h('p', {}, h('b', {}, s.th + ': '), s.note)); if (warn.length) note.append(h('ul', {}, warn.map(w => h('li', {}, w))));
  }

  /* ---------- recommendations: models + contract ---------- */
  function renderReco() {
    reco.innerHTML = '';
    const type = state.type, per = state.per, n = state.n;
    // models of this type with this size (or the next one up)
    const cands = [];
    DEMO.models.filter(m => m.type === type).forEach(m => { const i = m.skus.findIndex(k => k.btu >= per && k.btu <= per * 1.25); if (i >= 0) cands.push({ m, i, k: m.skus[i] }); });
    cands.sort((a, b) => a.k.px - b.k.px);
    const col1 = h('div', { class: 'st-rc' }, h('h3', {}, `รุ่นที่เข้ากับห้องนี้ · ${TYPE_RULES[type].th} ${btuFmt(per)} × ${n}`));
    if (!cands.length) {
      col1.append(h('p', { class: 's-note' }, type === 'duct' ? 'ระบบท่อลมต้องสำรวจและออกแบบท่อก่อน ทีมจะเสนอรุ่นและ BOQ หลังสำรวจ' : 'ยังไม่มีรุ่นขนาดนี้ใน Pricebook ลองเปลี่ยนขนาดหรือประเภท'),
        h('button', { type: 'button', class: 's-btn', onclick: () => { cart.add({ kind: 'survey', group: 'install', key: `SV-${state.scene.id}-${type}`, name: `ขอสำรวจหน้างาน · ${state.scene.th} (${TYPE_RULES[type].th})`, detail: `${state.p.w}×${state.p.d} ม. · ต้องการ ~${btuFmt(state.need)}`, unitEx: null, qty: 1 }); toast('เพิ่มคำขอสำรวจในใบเสนอราคาแล้ว'); } }, '+ ขอสำรวจหน้างาน'));
    } else {
      const list = h('ul', { class: 'st-models' });
      cands.slice(0, 4).forEach(({ m, i, k }) => {
        const ins = installOptions(m.type, k.btu).find(o => o.key === 'STANDARD');
        const oneEx = k.px + (ins ? ins.item.ex : 0);
        list.append(h('li', {},
          h('div', { class: 'st-m-t' }, h('small', {}, `${BRAND_BY_ID[m.brand].name} · ${m.series}`), h('b', {}, k.sku), h('span', { class: 's-note' }, `${btuFmt(k.btu)}${k.d.approved ? '' : ' · ราคาอ้างอิง'}`)),
          h('div', { class: 'st-m-p' }, h('b', {}, baht((oneEx * n))), h('small', {}, `${n} เครื่อง พร้อมติดตั้งมาตรฐาน · เครื่องละ ${baht(oneEx)}`)),
          h('div', { class: 'st-m-a' },
            h('button', { type: 'button', class: 's-btn primary', onclick: () => { cart.add({ kind: 'product', group: 'product', key: `P-${k.sku}`, name: `${BRAND_BY_ID[m.brand].name} ${k.sku}`, detail: `${TYPE_BY_ID[m.type].th} ${btuFmt(k.btu)} · จากห้องจำลอง ${state.scene.th}`, unitEx: k.px, qty: n }); if (ins) cart.add({ kind: 'service', group: 'install', key: `I-${ins.item.code}`, name: ins.item.name, detail: `สำหรับ ${k.sku}`, unitEx: ins.item.ex, qty: n }); toast(`ใส่ ${n} เครื่อง + ติดตั้งมาตรฐาน ในใบเสนอราคาแล้ว`); } }, 'ใส่ใบเสนอราคา'),
            cfg.onOpen ? h('button', { type: 'button', class: 's-btn ghost', onclick: () => cfg.onOpen(m, i) }, 'รายละเอียด') : null)));
      });
      col1.append(list, h('p', { class: 's-note' }, `เรียงจากราคาต่ำ · ${cands.length} รุ่นที่เข้าเงื่อนไข · ราคาก่อน VAT ตาม Pricebook 2569 ติดตั้งมาตรฐานรวมท่อและวัสดุ 4 เมตรแรก`));
    }
    // cleaning plan
    const ci = cleanInterval(dustRate(state.scene, state.p)), band = sizeBandFor(type, per);
    const r1 = cleanRate(state.pkg, 'C1', type, band), r2 = cleanRate(state.pkg, 'C2', type, band);
    const col2 = h('div', { class: 'st-rc' }, h('h3', {}, 'แผนล้างรายปีสำหรับห้องนี้'));
    const pk = h('select', { 'aria-label': 'แพ็กเกจล้าง' }, CLEAN_PKGS.map(p => h('option', { value: p.id, selected: p.id === state.pkg }, p.th)));
    pk.addEventListener('change', () => { state.pkg = pk.value; renderReco(); });
    col2.append(h('label', { class: 's-field' }, 'แพ็กเกจ', pk));
    if (r1) {
      const v1 = Math.max(r1.rate.s * n, DATA.minBill), v2 = Math.max((r2 ? r2.rate.s : r1.rate.s) * n, DATA.minBill);
      const annualEx = v1 * (ci.visits - 1) + v2;
      col2.append(h('dl', { class: 'st-plan' },
        h('dt', {}, 'รอบล้าง'), h('dd', {}, `${ci.visits} ครั้ง/ปี (ล้างใหญ่ 1 ครั้ง)`),
        h('dt', {}, 'ล้างปกติ / รอบ'), h('dd', {}, baht(v1)),
        h('dt', {}, 'ล้างใหญ่ / รอบ'), h('dd', {}, baht(v2)),
        h('dt', { class: 'tot' }, 'รวมต่อปี'), h('dd', { class: 'tot' }, baht(annualEx))),
        h('p', { class: 's-note' }, `อัตรามาตรฐาน ${n} เครื่อง · ขั้นต่ำต่อรอบ ${baht(DATA.minBill)}${(r1.rate.s * n) < DATA.minBill ? ' (ปรับขึ้นเป็นขั้นต่ำแล้ว — รวมหลายห้องหรือหลายเครื่องในรอบเดียวกันจะคุ้มกว่า)' : ''} · สัญญา 10 เครื่องขึ้นไปมีราคาขั้นบันได`),
        h('button', { type: 'button', class: 's-btn', onclick: () => { cart.add({ kind: 'service', group: 'contract', key: `K-${state.scene.id}-${n}-${ci.visits}-${state.pkg}`, name: `สัญญาล้างรายปี ${state.scene.th} ${n} เครื่อง × ${ci.visits} ครั้ง/ปี`, detail: `${state.pkg} · ${TYPE_RULES[type].th} ${btuFmt(per)}`, unitEx: annualEx, qty: 1, units: n }); toast('เพิ่มสัญญาล้างรายปีในใบเสนอราคาแล้ว'); } }, '+ ใส่สัญญาล้างในใบเสนอราคา'));
    } else col2.append(h('p', { class: 's-note' }, 'ขนาดนี้ต้องประเมินค่าล้างจากหน้างาน'));
    const col = [col1, col2];
    if (state.rec.project || state.scene.critical || state.scene.humid) col.unshift(h('div', { class: 'st-rc st-flag' }, h('h3', {}, 'แนะนำให้สำรวจก่อน'), h('p', {}, state.scene.humid ? 'ห้องที่มีความชื้นสูงต้องดูตำแหน่งติดตั้ง ท่อน้ำทิ้ง และการระบายอากาศจริง' : state.scene.critical ? 'ห้องที่ต้องเย็นตลอดเวลาต้องออกแบบเครื่องสำรองและระบบไฟ' : `ต้องการประมาณ ${btuFmt(state.need)} ขนาดนี้ทีมจะออกแบบระบบและทำ BOQ ให้`), h('button', { type: 'button', class: 's-btn primary', onclick: () => { cart.add({ kind: 'survey', group: 'install', key: `SV-${state.scene.id}`, name: `ขอสำรวจหน้างาน · ${state.scene.th}`, detail: `${state.p.w}×${state.p.d}×${state.p.h} ม. · ~${btuFmt(state.need)}`, unitEx: null, qty: 1 }); toast('เพิ่มคำขอสำรวจแล้ว'); } }, '+ ขอสำรวจหน้างาน')));
    reco.append(...col);
  }

  /* ---------- risk chips for the selected room ---------- */
  function renderRisk() {
    const s = state.scene; riskBar.innerHTML = '';
    riskBar.append(h('span', { class: 'st-lbl' }, 'ทำไมห้องนี้ต้องดูแลแอร์:'), h('span', { class: 'st-heavy' }, s.heavy || s.note));
    (s.risk || []).forEach(r => riskBar.append(h('span', { class: 'st-chip r-' + r }, RISK[r])));
    riskBar.append(h('span', { class: 'st-chip hrs' }, `เปิดเฉลี่ย ~${s.hrs || 8} ชม./วัน`));
  }

  /* ---------- electricity: clean vs not cleaned, across sizes ---------- */
  const SIZES_SHOW = { wall: [9000, 12000, 18000, 24000], ceiling: [24000, 36000, 48000, 60000], cassette: [24000, 36000, 48000, 60000], floor: [36000, 48000, 60000], duct: [24000, 36000, 48000, 60000] };
  const bizGroup = g => !['home', 'condo'].includes(g);
  function renderEnergy() {
    const s = state.scene, d = dirt(), type = state.type;
    const hrs = state.hrs ?? (s.hrs || 8), rate = state.rate ?? (bizGroup(s.g) ? RATE.biz : RATE.home), inv = state.inv;
    energyCard.innerHTML = '';
    const hrsIn = h('input', { type: 'range', min: '1', max: '24', step: '1', value: hrs, 'aria-label': 'ชั่วโมงใช้งานต่อวัน' });
    hrsIn.addEventListener('input', () => { state.hrs = +hrsIn.value; renderEnergy(); });
    const rateIn = h('input', { type: 'number', min: '2', max: '9', step: '0.01', value: rate.toFixed(2), 'aria-label': 'ค่าไฟต่อหน่วย' });
    rateIn.addEventListener('change', () => { state.rate = clampN(+rateIn.value, 2, 9); renderEnergy(); });
    const sys = h('div', { class: 'st-seg', role: 'radiogroup', 'aria-label': 'ระบบคอมเพรสเซอร์' }, [['inv', 'Inverter'], ['fix', 'Fixed speed']].map(([k, t]) => h('button', { type: 'button', role: 'radio', 'aria-checked': (k === 'inv') === inv, onclick: () => { state.inv = k === 'inv'; renderEnergy(); } }, t)));
    const rows = [{ th: `ห้องนี้: ${state.n} × ${btuFmt(state.per)}`, btu: state.n * state.per, n: state.n, per: state.per, me: true }, ...SIZES_SHOW[type].map(b => ({ th: `1 × ${btuFmt(b)}`, btu: b, n: 1, per: b }))];
    const tb = h('tbody');
    rows.forEach(r => {
      const E = energy(r.btu, type, inv, hrs, d, rate);
      const band = sizeBandFor(type, r.per), c1 = cleanRate('Basic Clean', 'C1', type, band);
      const cleanCost = c1 ? c1.rate.s * r.n : null;
      tb.append(h('tr', { class: r.me ? 'me' : '' }, h('th', { scope: 'row' }, r.th), h('td', {}, baht(Math.round(E.bahtMonthClean))), h('td', {}, baht(Math.round(E.bahtMonth))), h('td', { class: E.extraYear > 1 ? 'up' : '' }, E.extraYear > 1 ? '+' + baht(Math.round(E.extraYear)) : '—'), h('td', {}, cleanCost ? baht(Math.round(cleanCost)) : 'ประเมินหน้างาน')));
    });
    const E0 = energy(state.n * state.per, type, inv, hrs, d, rate);
    energyCard.append(
      h('div', { class: 'st-en-head' }, h('div', {}, h('h3', {}, 'ค่าไฟ: ล้างแล้ว กับ ไม่ได้ล้าง ' + state.months + ' เดือน'), h('p', { class: 's-note' }, `ห้องนี้จ่ายค่าไฟแอร์เพิ่มราว ${baht(Math.round(E0.extraYear))} ต่อปี ถ้าปล่อยสภาพนี้ตลอดปี (ไฟฟ้าต่อความเย็น +${Math.round((effects(d).power - 1) * 100)}%)`)),
        h('div', { class: 'st-en-ctl' }, h('label', { class: 'st-rng' }, h('span', {}, 'ใช้งาน', h('b', {}, String(hrs)), h('small', {}, 'ชม./วัน')), hrsIn), h('label', { class: 's-field' }, 'ค่าไฟ บาท/หน่วย', rateIn), sys)),
      h('div', { class: 'st-en-scroll', tabindex: '0', role: 'region', 'aria-label': 'ตารางค่าไฟตามขนาดเครื่อง' }, h('table', { class: 'st-en-t' }, h('thead', {}, h('tr', {}, h('th', {}, 'ขนาดเครื่อง'), h('th', {}, 'ค่าไฟ/เดือน เมื่อสะอาด'), h('th', {}, `ค่าไฟ/เดือน ไม่ล้าง ${state.months} เดือน`), h('th', {}, 'จ่ายเพิ่ม/ปี'), h('th', {}, 'ค่าล้างมาตรฐาน/ครั้ง'))), tb)),
      h('p', { class: 's-note' }, `ตัวเลขประมาณการ: ประสิทธิภาพเฉลี่ย ${inv ? 'Inverter' : 'Fixed speed'} ${type === 'wall' ? (inv ? EFF.inverter.wall : EFF.fixed.wall) : (inv ? EFF.inverter.other : EFF.fixed.other)} BTU/ชม. ต่อวัตต์ · เครื่องทำงานเฉลี่ย ${Math.round(LOAD_F * 100)}% ของกำลัง · ค่าไฟ ${rate.toFixed(2)} บาท/หน่วย (${bizGroup(s.g) ? 'กิจการขนาดเล็ก ประมาณการ' : 'บ้านอยู่อาศัย ช่วง 201–400 หน่วย รอบ ก.ย.–ธ.ค. 2569 รวม Ft และ VAT'}) · ผลของฝุ่นอิงช่วงที่เผยแพร่: กระทรวงพลังงานสหรัฐฯ ระบุแผ่นกรองอุดตันทำให้ใช้ไฟเพิ่ม 5–15% และ กฟน./กฟผ. ระบุการล้างช่วยประหยัดราว 5–10% · ค่าล้างคือ Basic Clean ล้างปกติ ก่อน VAT ต่อรอบ ยังไม่รวมขั้นต่ำต่อรอบ ${baht(DATA.minBill)}`),
      h('p', { class: 'st-en-honest' }, h('b', {}, 'พูดตรงๆ: '), 'ห้องที่เปิดวันละไม่กี่ชั่วโมง ค่าไฟที่ประหยัดได้อาจน้อยกว่าค่าล้าง ประโยชน์หลักของการล้างคือ ลมแรงและเย็นเร็วขึ้น ลดกลิ่นอับและน้ำหยด และช่วยให้เครื่องไม่ทำงานหนักเกินไป ส่วนห้องที่เปิดทั้งวันหรือหลายเครื่อง ค่าไฟที่ลดลงจะเห็นผลชัดกว่า'));
  }
  const clampN = (v, a, b) => Math.max(a, Math.min(b, isFinite(v) ? v : a));

  /* ---------- inside view: what builds up inside the unit, month by month ---------- */
  const rnd = (() => { let x = 7; return () => (x = (x * 16807) % 2147483647) / 2147483647; })();
  const seeds = Array.from({ length: 1400 }, () => ({ x: rnd(), y: rnd(), r: 0.5 + rnd() * 2, t: rnd(), a: rnd() * 6.28 }));
  const fibers = Array.from({ length: 40 }, () => ({ x: rnd(), y: rnd(), l: 18 + rnd() * 40, a: rnd() * 6.28, b: (rnd() - 0.5) * 2, t: rnd() }));
  let insT = 0, lastIns = performance.now();
  function drawInside(force) {
    if (inside.hidden && !force) return;
    if (force) renderInsideSide();
    const now = performance.now(); insT += Math.min(0.05, (now - lastIns) / 1000); lastIns = now;
    const cv = insCv, W = cv.clientWidth || 600, H = cv.clientHeight || 360, dpr = Math.min(2, devicePixelRatio || 1);
    if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
    const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
    const cs = getComputedStyle(root); const ink = cs.getPropertyValue('--s-ink').trim() || '#123', ink3 = cs.getPropertyValue('--s-ink-3').trim() || '#678', line = cs.getPropertyValue('--s-line').trim() || '#ccd';
    const dk = theme === 'dark';
    const d = dirt(), e = effects(d), odor = (state.scene.risk || []).includes('odor') || state.scene.humid || state.p.closed, oily = /kitchen|restaurant|cafe|canteen|buffet|condostudio|fcanteen|salon/.test(state.scene.id);
    const narrow = W < 520, gap = 12, cw = narrow ? W - 24 : (W - 24 - gap) / 2, ch = narrow ? (H - 24 - gap * 3) / 4 : (H - 24 - gap) / 2;
    const cells = [0, 1, 2, 3].map(i => narrow ? { x: 12, y: 12 + i * (ch + gap), w: cw, h: ch } : { x: 12 + (i % 2) * (cw + gap), y: 12 + Math.floor(i / 2) * (ch + gap), w: cw, h: ch });
    const dust = (a) => oily ? `rgba(98,74,40,${a})` : `rgba(118,96,70,${a})`;
    const titles = ['แผ่นกรองฝุ่น', 'คอยล์เย็น', 'พัดลมกรงกระรอก', 'ถาดน้ำทิ้ง'];
    const sub = [`อุดตัน ~${Math.round(Math.min(92, d * 92))}%`, `ลมผ่านได้ ~${Math.round(e.air * 100)}%`, d > 0.35 ? (odor ? 'คราบดำ + จุดเชื้อรา' : 'คราบดำเกาะใบพัด') : 'ใบพัดยังสะอาด', d > 0.72 ? 'เมือกหนา น้ำเริ่มค้าง อาจล้น' : d > 0.35 ? 'เริ่มมีเมือก' : 'น้ำไหลปกติ'];
    cells.forEach((c, i) => {
      g.save(); g.beginPath(); g.roundRect(c.x, c.y, c.w, c.h, 12); g.clip();
      const bg = g.createLinearGradient(0, c.y, 0, c.y + c.h); bg.addColorStop(0, dk ? '#1a2633' : '#f4f7fa'); bg.addColorStop(1, dk ? '#111a24' : '#e6ecf1'); g.fillStyle = bg; g.fillRect(c.x, c.y, c.w, c.h);
      const ix = c.x + 14, iy = c.y + 40, iw = c.w - 28, ih = c.h - 54;
      if (i === 0) { // filter: mesh + specks + felt + fibres
        g.fillStyle = dk ? '#2a3a4a' : '#dfe8ef'; g.fillRect(ix, iy, iw, ih);
        g.strokeStyle = dk ? 'rgba(170,195,220,.35)' : 'rgba(120,145,170,.55)'; g.lineWidth = 1;
        for (let x = ix; x <= ix + iw; x += 6) { g.beginPath(); g.moveTo(x, iy); g.lineTo(x, iy + ih); g.stroke(); }
        for (let y = iy; y <= iy + ih; y += 6) { g.beginPath(); g.moveTo(ix, y); g.lineTo(ix + iw, y); g.stroke(); }
        seeds.forEach(q => { if (q.t < d * 1.1) { g.fillStyle = dust(0.3 + q.t * 0.5); g.beginPath(); g.arc(ix + q.x * iw, iy + q.y * ih, q.r * (0.6 + d * 1.4), 0, 7); g.fill(); } });
        if (d > 0.4) { g.fillStyle = dust(Math.min(0.75, (d - 0.4) * 1.25)); g.fillRect(ix, iy, iw, ih); }
        g.strokeStyle = dk ? 'rgba(210,200,180,.7)' : 'rgba(70,58,44,.7)'; g.lineWidth = 1.1;
        fibers.forEach(f => { if (f.t < d * 1.2) { const x = ix + f.x * iw, y = iy + f.y * ih; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(f.a) * f.l * 0.5 + f.b * 8, y + Math.sin(f.a) * f.l * 0.5 - f.b * 8, x + Math.cos(f.a) * f.l, y + Math.sin(f.a) * f.l); g.stroke(); } });
      }
      if (i === 1) { // coil section: fins + tubes + fouling on the air-entry face + droplets
        const fx0 = ix + 10, fx1 = ix + iw - 10;
        for (let x = fx0; x < fx1; x += 7) { g.fillStyle = dk ? '#8fa6bb' : '#a9b8c6'; g.fillRect(x, iy, 1.6, ih); }
        [0.25, 0.5, 0.75].forEach(ty => [0.33, 0.66].forEach(tx => { g.fillStyle = '#c27a46'; g.beginPath(); g.arc(ix + iw * tx, iy + ih * ty, Math.min(10, ih * 0.08), 0, 7); g.fill(); g.strokeStyle = '#8e5227'; g.lineWidth = 1.5; g.stroke(); }));
        const lay = 4 + d * iw * 0.32; const grd = g.createLinearGradient(fx0, 0, fx0 + lay, 0); grd.addColorStop(0, dust(0.2 + d * 0.7)); grd.addColorStop(1, dust(0)); g.fillStyle = grd; g.fillRect(fx0 - 2, iy, lay, ih);
        if (d > 0.55) for (let x = fx0; x < fx0 + lay * 0.7; x += 7) for (let k = 0; k < 6; k++) { g.fillStyle = dust(0.55); g.fillRect(x, iy + ((x * 13 + k * 37) % ih), 7, 3 + d * 5); }
        g.fillStyle = 'rgba(80,170,240,.8)'; for (let k = 0; k < 16; k++) { const x = fx0 + ((k * 53) % (fx1 - fx0)), y = iy + ((k * 29 + insT * 40) % ih); g.beginPath(); g.ellipse(x + 1, y, 1.8, 2.6, 0, 0, 7); g.fill(); }
        const n = Math.round(3 + 6 * e.air); for (let k = 0; k < n; k++) { const y = iy + 10 + (k * (ih - 20)) / Math.max(1, n - 1), x = ix + ((insT * 60 * (0.4 + e.air)) + k * 29) % iw; g.strokeStyle = `rgba(20,150,230,${0.35 + 0.6 * e.air})`; g.lineWidth = 2; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 14, y); g.stroke(); g.beginPath(); g.moveTo(x + 10, y - 3); g.lineTo(x + 15, y); g.lineTo(x + 10, y + 3); g.stroke(); }
      }
      if (i === 2) { // cross-flow fan: blades + black build-up at the blade tips + mould spots
        const cx = ix + iw / 2, cy = iy + ih / 2, R = Math.min(iw, ih) * 0.46, rot = insT * 5 * e.air;
        g.strokeStyle = dk ? '#7c8a98' : '#9aa6b2'; g.lineWidth = 2; g.beginPath(); g.arc(cx, cy, R, 0, 7); g.stroke(); g.beginPath(); g.arc(cx, cy, R * 0.55, 0, 7); g.stroke();
        for (let k = 0; k < 32; k++) { const a = rot + k / 32 * Math.PI * 2; g.strokeStyle = dk ? '#b7c4d0' : '#5f6c79'; g.lineWidth = 2.6; g.beginPath(); g.moveTo(cx + Math.cos(a) * R * 0.58, cy + Math.sin(a) * R * 0.58); g.quadraticCurveTo(cx + Math.cos(a + 0.2) * R * 0.85, cy + Math.sin(a + 0.2) * R * 0.85, cx + Math.cos(a + 0.12) * R, cy + Math.sin(a + 0.12) * R); g.stroke();
          if (d > 0.12) { g.fillStyle = `rgba(28,24,20,${Math.min(0.9, d * 1.1)})`; g.beginPath(); g.arc(cx + Math.cos(a + 0.1) * R * 0.94, cy + Math.sin(a + 0.1) * R * 0.94, 1.2 + d * 3.6, 0, 7); g.fill(); }
          if (odor && d > 0.35 && k % 3 === 0) { g.fillStyle = `rgba(40,70,40,${Math.min(0.85, (d - 0.35) * 1.6)})`; g.beginPath(); g.arc(cx + Math.cos(a + 0.05) * R * 0.76, cy + Math.sin(a + 0.05) * R * 0.76, 1.5 + (d - 0.35) * 5, 0, 7); g.fill(); } }
      }
      if (i === 3) { // drain pan: water, slime layer, outlet flow / overflow
        const px = ix + 8, pw = iw - 40, py = iy + ih * 0.35, ph = ih * 0.55;
        g.fillStyle = dk ? '#3a4652' : '#cfd8e0'; g.fillRect(px, py + ph - 6, pw, 6); g.fillRect(px, py, 6, ph); g.fillRect(px + pw - 6, py, 6, ph);
        const slime = d * ph * 0.35, lvl = ph * (0.18 + Math.max(0, d - 0.55) * 1.2);
        g.fillStyle = 'rgba(80,165,230,.45)'; g.fillRect(px + 6, py + ph - 6 - lvl, pw - 12, lvl);
        g.fillStyle = `rgba(${oily ? '96,78,40' : '70,96,58'},${0.25 + d * 0.6})`; g.fillRect(px + 6, py + ph - 6 - slime, pw - 12, slime);
        g.fillStyle = dk ? '#3a4652' : '#cfd8e0'; g.fillRect(px + pw, py + ph - 20, 30, 10);
        const flow = Math.max(0.1, 1 - Math.max(0, d - 0.5) * 1.8); g.fillStyle = 'rgba(40,130,220,.85)';
        for (let k = 0; k < 5; k++) { const t = ((insT * 1.2 * flow) + k / 5) % 1; g.beginPath(); g.arc(px + pw + 24, py + ph - 10 + t * 30 * flow, 2.2, 0, 7); g.fill(); }
        if (d > 0.72) { g.fillStyle = 'rgba(40,130,220,.85)'; for (let k = 0; k < 3; k++) { const t = ((insT * 1.4) + k / 3) % 1; g.beginPath(); g.arc(px + pw * 0.3 + k * 18, py - 4 + t * 22, 2.4, 0, 7); g.fill(); } }
      }
      g.restore();
      g.strokeStyle = line; g.lineWidth = 1; g.beginPath(); g.roundRect(c.x, c.y, c.w, c.h, 12); g.stroke();
      g.fillStyle = ink; g.font = '600 13px system-ui, sans-serif'; g.fillText(titles[i], c.x + 14, c.y + 22);
      g.fillStyle = i === 3 && d > 0.72 || i === 0 && d > 0.6 ? (dk ? '#ff8f7a' : '#c0392b') : ink3; g.font = '12px system-ui, sans-serif'; g.textAlign = 'right'; g.fillText(sub[i], c.x + c.w - 12, c.y + 22); g.textAlign = 'left';
    });
  }
  function renderInsideSide() {
    const d = dirt(), e = effects(d), rate = dustRate(state.scene, state.p), ci = cleanInterval(rate);
    const W = 300, Hh = 170, X = m => 34 + m / 18 * (W - 44), Y = v => 12 + (1.2 - v) / 0.6 * (Hh - 34);
    const line = f => Array.from({ length: 19 }, (_, m) => `${m ? 'L' : 'M'}${X(m).toFixed(1)} ${Y(f(effects(dirtFrom(m, rate)))).toFixed(1)}`).join('');
    const air = line(q => q.air), cap = line(q => q.cap), pow = line(q => q.power);
    const cx = X(state.months);
    insSide.innerHTML = '';
    insSide.append(
      h('div', { class: 'st-in-kpi' }, ...[['ลมผ่าน', Math.round(e.air * 100) + '%', 'air'], ['ความเย็นที่ได้', Math.round(e.cap * 100) + '%', 'cap'], ['ไฟต่อความเย็น', '+' + Math.round((e.power - 1) * 100) + '%', 'pow']].map(([a, b, k]) => h('div', { class: 'k-' + k }, h('small', {}, a), h('b', {}, b)))),
      h('div', { class: 'st-in-chart', html: `<svg viewBox="0 0 ${W} ${Hh}" role="img" aria-label="ผลของการไม่ล้างตามเดือน 0 ถึง 18 เดือน">
        <rect x="${X(0)}" y="10" width="${X(ci.months) - X(0)}" height="${Hh - 30}" class="ok-band"/>
        ${[0, 3, 6, 9, 12, 15, 18].map(m => `<path d="M${X(m)} ${Hh - 20}v4" class="ax"/><text x="${X(m)}" y="${Hh - 6}" class="axt">${m}</text>`).join('')}
        ${[1.2, 1, 0.8, 0.6].map(v => `<path d="M${X(0)} ${Y(v)}H${X(18)}" class="grid${v === 1 ? ' base' : ''}"/><text x="2" y="${Y(v) + 4}" class="axt s">${Math.round(v * 100)}%</text>`).join('')}
        <path d="${air}" class="l-air"/><path d="${cap}" class="l-cap"/><path d="${pow}" class="l-pow"/>
        <path d="M${cx} 10V${Hh - 20}" class="now"/><circle cx="${cx}" cy="${Y(e.air)}" r="4" class="d-air"/><circle cx="${cx}" cy="${Y(e.cap)}" r="4" class="d-cap"/><circle cx="${cx}" cy="${Y(e.power)}" r="4" class="d-pow"/>
        <text x="${X(ci.months) + 4}" y="${Hh - 26}" class="axt g">← รอบล้างแนะนำ ${ci.months} เดือน</text></svg>` }),
      h('div', { class: 'st-in-leg' }, h('span', { class: 'k-air' }, 'ลมผ่าน'), h('span', { class: 'k-cap' }, 'ความเย็นที่ได้'), h('span', { class: 'k-pow' }, 'ค่าไฟ (สูงกว่า 100% = จ่ายเพิ่ม)'), h('small', {}, 'แกนนอน = เดือนที่ไม่ได้ล้าง')),
      h('p', { class: 's-note' }, `ห้อง${state.scene.th}สะสมฝุ่น${rate >= 1.3 ? 'เร็วมาก' : rate >= 0.9 ? 'เร็ว' : 'ปกติ'} · แนะนำล้างทุก ${ci.months} เดือน · ลากแถบ "ไม่ได้ล้างมา" ด้านขวาเพื่อดูผล 0–18 เดือน`));
  }
  (function loop() { requestAnimationFrame(loop); if (state.view === 'inside') drawInside(); })();

  /* ---------- refrigeration cycle ---------- */
  const STAGES = {
    evap: { n: 1, th: 'คอยล์เย็น (ในห้อง) — ดูดความร้อน', d: 'น้ำยาที่เย็นจัด (ราว 5–10°C) ไหลในท่อทองแดงของคอยล์เย็น ลมในห้องผ่านครีบ ความร้อนจากลมทำให้น้ำยาเดือดกลายเป็นไอ ลมที่ออกมาจึงเย็นลงราว 8–12°C ความชื้นในลมกลั่นเป็นน้ำทิ้ง', you: 'คุณได้ลมเย็นและอากาศที่ชื้นน้อยลง ถ้าคอยล์หรือแผ่นกรองสกปรก ลมผ่านน้อย ห้องเย็นช้า อาจมีน้ำแข็งเกาะคอยล์และน้ำหยด', dirty: 'ฝุ่นอุดครีบ ลมผ่านน้อยลง น้ำยารับความร้อนได้น้อย เครื่องต้องเดินนานขึ้นเพื่อให้ห้องเย็นเท่าเดิม' },
    comp: { n: 2, th: 'คอมเพรสเซอร์ (คอยล์ร้อน) — อัดน้ำยา', d: 'ไอน้ำยาเย็นที่กลับมาทางท่อใหญ่ถูกคอมเพรสเซอร์อัดจนแรงดันและอุณหภูมิสูง (ไอร้อนราว 60–80°C) ส่วนนี้ใช้ไฟมากที่สุดของเครื่อง รุ่น Inverter ปรับรอบตามความร้อนในห้อง', you: 'ค่าไฟส่วนใหญ่มาจากส่วนนี้ เครื่องที่สกปรกทำให้คอมเพรสเซอร์ต้องทำงานหนักและนานขึ้น', dirty: 'แรงดันด้านสูงเพิ่มเมื่อคอยล์ร้อนสกปรก คอมเพรสเซอร์กินกระแสมากขึ้น ร้อนขึ้น และสึกเร็วขึ้น' },
    cond: { n: 3, th: 'คอยล์ร้อน — ระบายความร้อนทิ้ง', d: 'พัดลมคอยล์ร้อนเป่าลมภายนอกผ่านครีบ ไอร้อนคายความร้อนออกนอกอาคาร แล้วกลั่นตัวเป็นน้ำยาเหลว (ราว 35–45°C) ความร้อนที่ดึงออกจากห้องถูกทิ้งตรงนี้', you: 'คอยล์ร้อนต้องมีที่ระบายลมพอ ไม่ติดชิดผนังหรือที่อับ ถ้าวางผิดที่หรือครีบสกปรก เครื่องจะเย็นน้อยลงและกินไฟ', dirty: 'ครีบอุดตันจากฝุ่นถนนและใบไม้ ระบายความร้อนไม่ออก เครื่องตัดการทำงานเพื่อป้องกันตัวเองบ่อยขึ้น' },
    exp: { n: 4, th: 'วาล์วลดแรงดัน (EEV / Capillary)', d: 'น้ำยาเหลวแรงดันสูงถูกบีบผ่านวาล์วหรือท่อรูเล็ก แรงดันลดลงทันที อุณหภูมิจึงลดลงมากก่อนกลับเข้าคอยล์เย็น แล้ววนรอบใหม่', you: 'จุดนี้ไม่เกี่ยวกับการล้าง ถ้าเย็นผิดปกติหรือมีน้ำแข็ง ต้องให้ช่างวัดแรงดันและอุณหภูมิหน้างาน ไม่ควรเติมน้ำยาโดยไม่ตรวจหาจุดรั่ว', dirty: 'ไม่ได้รับผลจากฝุ่นโดยตรง แต่ค่าที่วัดได้ผิดปกติเมื่อคอยล์สกปรก ช่างจึงต้องล้างก่อนวินิจฉัย' },
  };
  let cyc = 'evap';
  function updateCycle() {
    if (cycle.hidden && state.view !== 'cycle') return;
    const d = dirt(), e = effects(d), dur = (2.4 / (0.55 + 0.45 * e.cap)).toFixed(2), dirtyOp = (d * 0.75).toFixed(2);
    const fins = (x, y, w, hh, cls) => Array.from({ length: Math.floor(w / 6) }, (_, i) => `<rect x="${x + 3 + i * 6}" y="${y + 6}" width="1.6" height="${hh - 12}" class="${cls}"/>`).join('');
    const tag = (id, x, y) => `<g class="st-tag" data-st="${id}"><circle cx="${x}" cy="${y}" r="13"/><text x="${x}" y="${y + 4.5}">${STAGES[id].n}</text></g>`;
    cycle.innerHTML = `<svg viewBox="0 0 760 360" role="img" aria-label="วงจรน้ำยาทำความเย็น 4 ขั้น">
      <defs><linearGradient id="st-in" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#dff0ff"/><stop offset="1" stop-color="#eef7ff"/></linearGradient><linearGradient id="st-out" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff0e2"/><stop offset="1" stop-color="#fff8f1"/></linearGradient>
      <marker id="st-ar" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0L10 5L0 10z" fill="context-stroke"/></marker></defs>
      <rect x="10" y="10" width="300" height="340" rx="16" class="z-in"/><rect x="450" y="10" width="300" height="340" rx="16" class="z-out"/>
      <text x="26" y="36" class="zt">ภายในห้อง</text><text x="466" y="36" class="zt">ภายนอกอาคาร</text>
      <path d="M160 96 V62 H600 V98" class="pp p-suc" style="animation-duration:${dur}s"/><text x="380" y="54" class="pt">ไอน้ำยาเย็นกลับ (ท่อใหญ่) ~10–15°C</text>
      <path d="M600 262 V300 H400" class="pp p-liq" style="animation-duration:${dur}s"/><text x="470" y="322" class="pt">น้ำยาเหลวอุ่น ~35–45°C</text>
      <path d="M340 300 H160 V262" class="pp p-cold" style="animation-duration:${dur}s"/><text x="170" y="322" class="pt">น้ำยาเย็นจัด ~5–10°C</text>
      <path d="M640 206 V230" class="pp p-hot" style="animation-duration:${dur}s"/>
      <g data-st="evap" class="st-cmp"><rect x="80" y="98" width="160" height="164" rx="12" class="c-evap"/>${fins(86, 98, 148, 164, 'fin')}<rect x="80" y="98" width="160" height="164" rx="12" fill="rgb(112,86,58)" opacity="${dirtyOp}"/>
        <text x="160" y="250" class="ct">คอยล์เย็น + พัดลมในห้อง</text></g>
      <g data-st="cond" class="st-cmp"><rect x="530" y="98" width="180" height="108" rx="12" class="c-cond"/>${fins(536, 98, 168, 108, 'fin h')}<rect x="530" y="98" width="180" height="108" rx="12" fill="rgb(112,86,58)" opacity="${(d * 0.6).toFixed(2)}"/>
        <circle cx="620" cy="152" r="34" class="fan"/><g class="spin" style="transform-origin:620px 152px;animation-duration:${(1.4 / (0.5 + 0.5 * e.cap)).toFixed(2)}s"><path d="M620 152 q10 -30 0 -32 q-8 2 0 32 M620 152 q30 8 30 0 q-2 -8 -30 0 M620 152 q-10 30 0 32 q8 -2 0 -32 M620 152 q-30 -8 -30 0 q2 8 30 0" class="blade"/></g>
        <text x="620" y="222" class="ct">คอยล์ร้อน + พัดลม</text></g>
      <g data-st="comp" class="st-cmp"><rect x="592" y="232" width="96" height="60" rx="26" class="c-comp"/><text x="640" y="267" class="ct w">คอมเพรสเซอร์</text></g>
      <g data-st="exp" class="st-cmp"><rect x="340" y="284" width="60" height="32" rx="10" class="c-exp"/><text x="370" y="304" class="ct s">ลดแรงดัน</text></g>
      ${[0, 1, 2, 3].map(k => `<path d="M24 ${120 + k * 34} h44" class="air warm"/><path d="M252 ${120 + k * 34} h44" class="air cold" style="opacity:${(0.3 + 0.7 * e.air).toFixed(2)};stroke-width:${(1.4 + 2.2 * e.air).toFixed(1)}"/>`).join('')}
      ${[0, 1, 2].map(k => `<path d="M470 ${118 + k * 30} h44" class="air amb"/><path d="M714 ${118 + k * 30} h30" class="air hot"/>`).join('')}
      <text x="26" y="286" class="zt s">ลมห้อง ~27°C เข้า → ลมเย็น ~15–18°C ออก</text><text x="26" y="302" class="zt s">แรงลมตอนนี้ ~${Math.round(e.air * 100)}%</text>
      <text x="466" y="80" class="zt s">ลมภายนอกเข้า → ลมร้อนออก</text>
      ${tag('evap', 80, 98)}${tag('comp', 690, 236)}${tag('cond', 530, 98)}${tag('exp', 340, 284)}
    </svg><div class="st-cyc-cards"></div><p class="s-note">อุณหภูมิในภาพเป็นค่าทั่วไปโดยประมาณของเครื่องปรับอากาศบ้านขณะทำความเย็น ขึ้นกับรุ่น น้ำยา อุณหภูมิภายนอก และภาระห้อง · สภาพเครื่องตามแถบ "ไม่ได้ล้างมา" ${state.months} เดือน</p>`;
    const cards = $('.st-cyc-cards', cycle);
    Object.entries(STAGES).forEach(([id, st]) => cards.append(h('button', { type: 'button', class: 'st-cc' + (id === cyc ? ' on' : ''), onclick: () => { cyc = id; updateCycle(); } }, h('span', { class: 'n' }, String(st.n)), h('b', {}, st.th), id === cyc ? h('div', {}, h('p', {}, st.d), h('p', { class: 'you' }, h('b', {}, 'ผลกับคุณ: '), st.you), d > 0.2 ? h('p', { class: 'dirty' }, h('b', {}, `ถ้าไม่ได้ล้าง ${state.months} เดือน: `), st.dirty) : null) : null)));
    $$('[data-st]', cycle).forEach(g => { g.setAttribute('tabindex', '0'); g.setAttribute('role', 'button'); g.setAttribute('aria-label', STAGES[g.dataset.st].th); g.classList.toggle('on', g.dataset.st === cyc); const go = () => { cyc = g.dataset.st; updateCycle(); }; g.addEventListener('click', go); g.addEventListener('keydown', ev => (ev.key === 'Enter' || ev.key === ' ') && (ev.preventDefault(), go())); });
  }
  /* ---------- start ---------- */
  renderGroups(); renderScenes(); setScene(S0);
  return { setScene: id => SCENE_BY_ID[id] && setScene(SCENE_BY_ID[id]), setView, state };
}
