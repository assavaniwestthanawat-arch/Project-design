// SBP AirCare — "ดูรุ่นนี้แบบ 3 มิติ" (r15, owner 6 ต.ค. 2569: "พัฒนาให้ละเอียดครบทุก Model … ให้ smooth ไม่สะดุด"). Every one of
// the 705 catalogue models can be seen in 3D from its product panel, in every edition: the indoor unit of its type at the
// model's size — spec dimensions when the Pricebook has them, otherwise a typical size for the type and BTU (said under the
// picture). The body is brand-neutral (CLAUDE.md §6.6 #14/#20): the brand is text on the page, never drawn on the unit.
// Visitors switch it on, change mode and swing, move the camera, look through the shell, take it apart, watch a clean, and
// may turn on the room sound (only ever started from a click; on phones that can, a short tick when the unit starts or stops).
// ONE viewer per page (cinema3d, one WebGL context in the gl-pool budget) moves into whichever product panel asks for it —
// opening the next model re-uses it instead of compiling a new renderer. Reduced motion → still frames.
// modelViewer(m, s) → element · viewer(host) → Promise<cinema> (the owner's test panel walks every model with the same viewer)
// modelScene(m, s) → {type, w, h, d, src} (what the viewer is given for a model)
import { TYPE_BY_ID, BRAND_BY_ID, btuFmt, h, $$ } from './sbp-core.js';
import { unitDims } from './roomfit.js';

const SHOTS = [['hero', 'ภาพรวม'], ['close', 'ใกล้'], ['air', 'ทางลม'], ['inside', 'ภายใน'], ['wide', 'ทั้งห้อง']];
const MODES = [['cool', 'เย็น'], ['dry', 'ลดความชื้น'], ['fan', 'พัดลม']];
let C = null, booting = null, wantOpen = false, glFocus = () => {};
const st = { power: true, mode: 'cool', swing: true, shot: 'close', xray: false, explode: 0, sound: false };   // 'close' fills the panel's small stage

// light pages get the bright gallery set, dark pages the black product theatre
function mood() {
  const c = getComputedStyle(document.body).backgroundColor.match(/\d+(\.\d+)?/g) || [255, 255, 255];
  const [r, g, b] = c.map(Number); return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 < 0.35 ? 'noir' : 'atelier';
}
/** can this browser draw WebGL — checked without creating a context (a throwaway context counted against the page's budget);
 *  a device that still cannot draw gets the message in the panel when the viewer fails to start */
export const hasGL = () => typeof WebGLRenderingContext !== 'undefined';
export function modelScene(m, s) {
  const type = m.type === 'duct' ? 'ceiling' : m.type, dm = unitDims(type, s.btu, s.d && s.d.indoorDim);
  return { type, w: dm.w, h: dm.h, d: dm.d, src: dm.src };
}
/** the page's one viewer, moved into host (built on first use) */
export function viewer(host) {
  if (C) { C.attach(host); return Promise.resolve(C); }
  // three.js and the pool load with the viewer (not with the page: commerce.js imports this module on every edition)
  if (!booting) booting = Promise.all([import('./cinema3d.js'), import('./gl-pool.js')]).then(([{ createCinema }, pool]) => {
    glFocus = pool.glFocus;
    C = createCinema(host, { mood: mood(), quality: matchMedia('(pointer: coarse)').matches ? 'low' : 'mid', model: null });
    C.auto(false); return C;
  }).catch(e => { booting = null; throw e; });
  return booting.then(c => { c.attach(host); return c; });
}
// sound never outlives a hidden page
const sndBtns = new Set();
document.addEventListener('visibilitychange', () => { if (document.hidden && C && st.sound) { st.sound = C.sound(false); sndBtns.forEach(b => { if (b.isConnected) b.setAttribute('aria-pressed', 'false'); else sndBtns.delete(b); }); } });
const haptic = ms => { try { st.sound && navigator.vibrate && navigator.vibrate(ms); } catch (_) {} };

export function modelViewer(m, s) {
  const b = BRAND_BY_ID[m.brand], t = TYPE_BY_ID[m.type], sc = modelScene(m, s);
  const gl = h('div', { class: 'm3d-gl' });
  const cap = h('p', { class: 'm3d-cap' }, 'แบบจำลองเพื่ออธิบาย');
  const note = h('p', { class: 's-note' }, sc.src === 'spec' ? `ขนาดคอยล์เย็นตามสเปกรุ่นนี้ (${s.d.indoorDim} มม.) ตัวเครื่องในภาพเป็นแบบกลาง ไม่ใช่ดีไซน์จริงของ ${b.name}`
    : `รุ่นนี้ยังไม่มีขนาดคอยล์เย็นในข้อมูล ภาพใช้ขนาดทั่วไปของ${t.th} ${btuFmt(s.btu)} ตัวเครื่องในภาพเป็นแบบกลาง ไม่มียี่ห้อ`);
  const seg = (opts, cur, label, pick) => {
    const g = h('div', { class: 'm3d-seg', role: 'group', 'aria-label': label });
    const draw = v => $$('button', g).forEach(x => x.setAttribute('aria-pressed', String(x.dataset.v === v)));
    opts.forEach(([v, th]) => g.append(h('button', { type: 'button', 'data-v': v, onclick: () => { draw(v); pick(v); } }, th)));
    draw(cur); g.draw = draw; return g;
  };
  const press = (b2, on) => b2.setAttribute('aria-pressed', String(on));
  const pw = h('button', { type: 'button', onclick: () => { st.power = !st.power; press(pw, st.power); pw.textContent = st.power ? 'ปิดเครื่อง' : 'เปิดเครื่อง'; C && C.power(st.power); haptic(st.power ? [12, 40, 12] : 18); } }, st.power ? 'ปิดเครื่อง' : 'เปิดเครื่อง');
  press(pw, st.power);
  const modeSeg = seg(MODES, st.mode, 'โหมด', v => { st.mode = v; C && C.mode(v); });
  const swingB = h('button', { type: 'button', onclick: () => { st.swing = !st.swing; press(swingB, st.swing); C && C.swing(st.swing); } }, 'บานสวิง'); press(swingB, st.swing);
  const shotSeg = seg(SHOTS, st.shot, 'มุมกล้อง', v => { st.shot = v; C && C.shot(v); });
  const xrB = h('button', { type: 'button', onclick: () => { st.xray = !st.xray; press(xrB, st.xray); C && C.xray(st.xray); } }, 'มองทะลุ'); press(xrB, st.xray);
  const exR = h('input', { type: 'range', min: 0, max: 100, value: Math.round(st.explode * 100), 'aria-label': 'แยกชิ้นส่วน', oninput: () => { st.explode = exR.value / 100; C && C.explode(st.explode); } });
  const cleanB = h('button', { type: 'button', onclick: () => { if (!C) return; C.clean(); haptic(30); cap.textContent = 'แบบจำลองเพื่ออธิบาย · ฉีดล้างแผ่นกรองและคอยล์ ฝุ่นหลุดออก'; setTimeout(() => { cap.textContent = 'แบบจำลองเพื่ออธิบาย'; }, 4600); } }, 'ดูการล้าง');
  const vib = typeof navigator.vibrate === 'function' && matchMedia('(pointer: coarse)').matches;
  const sndB = h('button', { type: 'button', onclick: () => { if (!C) return; st.sound = C.sound(!st.sound); press(sndB, st.sound); haptic(10); } }, vib ? 'เสียงลม + สั่น' : 'เสียงลม'); press(sndB, false);
  const ctl = h('div', { class: 'm3d-ctl', role: 'group', 'aria-label': 'ควบคุมภาพจำลอง' },
    h('div', { class: 'm3d-row' }, pw, modeSeg, swingB),
    h('div', { class: 'm3d-row' }, shotSeg),
    h('div', { class: 'm3d-row' }, xrB, h('label', { class: 'm3d-ex' }, 'แยกชิ้นส่วน', exR), cleanB, sndB));
  const panel = h('div', { class: 'm3d-panel', hidden: true }, h('div', { class: 'm3d-stage' }, gl, cap), ctl, note);
  const btn = h('button', { type: 'button', class: 's-btn m3d-open', 'aria-expanded': 'false', onclick: () => toggle(panel.hidden) }, 'ดูรุ่นนี้แบบ 3 มิติ');
  const wrap = h('div', { class: 'm3d', hidden: !hasGL() }, btn, panel);
  let io = null;
  function sync() {   // the shared viewer keeps its state between panels: show this model with the panel's settings
    C.scene({ ...sc, power: st.power, mode: st.mode, swing: st.swing, xray: st.xray, explode: st.explode, shot: st.shot, cut: true, auto: false });
  }
  async function toggle(open) {
    wantOpen = open; panel.hidden = !open; btn.setAttribute('aria-expanded', String(open)); btn.textContent = open ? 'ซ่อนภาพ 3 มิติ' : 'ดูรุ่นนี้แบบ 3 มิติ';
    if (!open) { glFocus(null); if (C && st.sound) { st.sound = C.sound(false); press(sndB, false); } return; }
    wrap.classList.add('is-loading');
    try { await viewer(gl); sync(); glFocus(gl); } catch (e) { panel.replaceChildren(h('p', { class: 's-note' }, 'อุปกรณ์นี้แสดงภาพ 3 มิติไม่ได้ ดูสเปกและขนาดจากตารางด้านล่างได้ตามปกติ')); }
    wrap.classList.remove('is-loading');
    // sound never outlives the panel (closed drawer, another model, page hidden)
    // the scenes behind the panel pause while it shows this model (glFocus); both end when the panel leaves the screen
    if (!io) { io = new IntersectionObserver(es => { const on = es.some(e => e.isIntersecting); if (!on) { glFocus(null); if (C && st.sound && C.host === gl) { st.sound = C.sound(false); press(sndB, false); } } else if (!panel.hidden && C && C.host === gl) glFocus(gl); }); io.observe(gl); }
  }
  sndBtns.add(sndB);
  if (wantOpen) requestAnimationFrame(() => toggle(true));   // the visitor opened it for the previous model: keep it open
  return wrap;
}
