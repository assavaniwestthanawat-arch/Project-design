// SBP AirCare — วางบนผนังบ้านคุณ (Rev.11, owner 12 ต.ค. 2569: "พัฒนา A B C ให้แบบล้ำสมัยแบบประสบการณ์ที่ USER EXPERIENCE ไม่คาดคิด
// ว่าจะเจอหรือมีจริงๆ"). Any of the 705 catalogue models at its real size on the customer's own wall, through the phone camera,
// from the product panel (model3d.js, beside "ดูรุ่นนี้แบบ 3 มิติ") and the room-fit's chosen model (roomfit.js).
//   iPhone / iPad (Safari): AR Quick Look — a USDZ made in the browser (ar3d.usdz, no file on a server), wall or floor anchoring,
//     size locked (#allowsContentScaling=0); the Quick Look banner button opens the booking form with this model
//   Android Chrome: WebXR immersive-ar + hit-test (walls, floor, ceiling) with Thai buttons over the camera (dom-overlay):
//     วาง · หมุน · ย้าย · ปิด, the size, and the height above the floor once the camera has seen it (ค่าประมาณ)
//   anywhere else (desktop, in-app browsers, the Claude test site): one line saying where it works — never a dead button; the
//     3D viewer and the room-fit stay as they are
// Honest by construction: the body is the brand-neutral unit of the 3D viewer (no logo) at modelScene's size — the model's spec, or
// the typical size of its type, and the card says which; everything is "แบบจำลองเพื่ออธิบาย"; nothing claims a measurement.
// arSupport() → Promise<'quicklook' | 'webxr' | 'none'> · arButton(m, s, sc) → element (display: contents) | null for ducted units
import { h, $$, BRAND_BY_ID, TYPE_BY_ID, btuFmt, isVRF } from './sbp-core.js';
import { testSite } from './ticket.js';
import { requestBooking, askTeam } from './contact.js';
import { closeDrawer } from './proto-ui.js';
import { FIT_RULES } from './roomfit.js';
import { trapFocus } from './feedback.js';

// per type: the button, where it goes, what the camera should look at (WebXR) and the Quick Look tip (' · ' = where a line may break)
const TX = {
  wall: { go: 'วางบนผนังบ้านคุณ', real: 'วางบนผนังจริง', aim: 'ส่องกล้องไปที่ผนังช้า ๆ จนเห็นวงกลมบนผนัง', need: 'แอร์ติดผนังต้องวางบนผนัง',
    ql: 'แตะแล้วส่องกล้องไปที่ผนัง · แบบจำลองจะติดผนังให้เอง · ลากนิ้วเพื่อเลื่อน' },
  ceiling: { go: 'วางใต้ฝ้าบ้านคุณ', real: 'วางใต้ฝ้าจริง', aim: 'ส่องกล้องไปที่ฝ้าเพดาน หรือผนังใต้ฝ้า', need: 'แอร์แขวนใต้ฝ้าวางที่ฝ้าหรือผนังใต้ฝ้า',
    ql: 'แตะแล้วส่องกล้องไปที่ผนัง · วางแล้วลากขึ้นไปชิดฝ้า' },
  cassette: { go: 'วางบนฝ้าบ้านคุณ', real: 'วางบนฝ้าจริง', aim: 'ส่องกล้องไปที่ฝ้าเพดาน (หรือพื้น เพื่อดูขนาดตัวเครื่อง)', need: 'แอร์สี่ทิศทางวางที่ฝ้าเพดาน',
    ql: 'iPhone วางแบบจำลองบนฝ้าไม่ได้ · จะตั้งบนพื้นให้ดูขนาดตัวเครื่องจริงแทน', qlGo: 'ดูขนาดจริงในห้องคุณ' },
  floor: { go: 'ตั้งในห้องบ้านคุณ', real: 'ตั้งในห้องจริง', aim: 'ส่องกล้องไปที่พื้นช้า ๆ จนเห็นวงกลมบนพื้น', need: 'แอร์ตู้ตั้งพื้นวางบนพื้น',
    ql: 'แตะแล้วส่องกล้องไปที่พื้น · แบบจำลองจะตั้งบนพื้นให้เอง · ลากนิ้วเพื่อเลื่อนชิดผนัง' },
};
const SURF_TH = { wall: 'ผนัง', floor: 'พื้น', ceiling: 'ฝ้าเพดาน' };
const FINE = 'แบบจำลองเพื่ออธิบาย · ตัวเครื่องจริงแตกต่างตามรุ่น · ไม่มีโลโก้แบรนด์';
// AR mark (viewfinder corners + a box) and a phone — 24-unit grid, 1.8 stroke, same drawing rules as icons.js
const svg = d => `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${d}</svg>`;
const IC_AR = svg('<path d="M3.5 8V5a1.5 1.5 0 0 1 1.5-1.5h3M16 3.5h3A1.5 1.5 0 0 1 20.5 5v3M20.5 16v3a1.5 1.5 0 0 1-1.5 1.5h-3M8 20.5H5A1.5 1.5 0 0 1 3.5 19v-3"/><path d="M12 7.3l4.3 2.4v4.6L12 16.7l-4.3-2.4V9.7z"/><path d="M7.7 9.7l4.3 2.4 4.3-2.4M12 12.1v4.6"/>');
const IC_PHONE = svg('<rect x="7" y="2.8" width="10" height="18.4" rx="2.2"/><path d="M11 17.6h2"/>');

const cm = v => String(Math.round(v * 1000) / 10);
// Thai lines break only between phrases (' · '), never inside one — no orphaned 'วาง', no 'กว้าง 84 ×' / 'สูง …'
const phr = t => t.split(' · ').flatMap((x, i) => [i ? ' · ' : null, h('span', { class: 'ar-nw' }, x)]).filter(Boolean);
export const dimsTh = sc => `กว้าง ${cm(sc.w)} × สูง ${cm(sc.h)} × ลึก ${cm(sc.d)} ซม.`;
export const srcTh = sc => (sc.src === 'spec' ? 'ขนาดตามสเปก' : 'ขนาดทั่วไปของประเภทนี้') + (sc.type === 'cassette' ? ' (ตัวเครื่อง ไม่รวมหน้ากาก)' : '');

// in-app browsers (LINE, Facebook, Instagram, WeChat, TikTok) — AR does not open from them: say "open in Safari / Chrome"
const INAPP = /\bLine\/|FBAN|FBAV|Instagram|MicroMessenger|TikTok|musical_ly|BytedanceWebview/i;
// AR Quick Look is the iPhone / iPad camera only: macOS Safari also knows rel="ar" (it shows a 3D preview, not the room), and an
// app's web view (WKWebView) only opens it when it is a full browser (Chrome, Edge, Firefox, Google app, DuckDuckGo on iOS)
function quickLookCandidate() {
  const ua = navigator.userAgent || '';
  if (!(/iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) || INAPP.test(ua)) return false;
  if (window.webkit && window.webkit.messageHandlers) return /CriOS\/|EdgiOS\/|FxiOS\/|GSA\/|DuckDuckGo\//.test(ua);
  const a = document.createElement('a');
  return !!(a.relList && a.relList.supports && a.relList.supports('ar'));
}
/** which AR this browser can open: AR Quick Look (iOS / iPadOS Safari), WebXR immersive-ar (Android Chrome), or none */
let SUP = null;
export function arSupport() {
  if (SUP) return SUP;
  return (SUP = (async () => {
    try { if (testSite()) return 'none'; } catch (_) { /* no endpoint config: a normal page */ }
    try { if (quickLookCandidate()) return 'quicklook'; } catch (_) {}
    if (INAPP.test(navigator.userAgent || '')) return 'none';
    try { if (window.isSecureContext !== false && navigator.xr && await navigator.xr.isSessionSupported('immersive-ar')) return 'webxr'; } catch (_) { /* blocked by the frame or the permissions policy */ }
    return 'none';
  })());
}
// why there is no button here, in one plain line
function whyNot(sc) {
  const real = TX[sc.type].real;
  let site = false; try { site = testSite(); } catch (_) {}
  if (site) return `เว็บทดสอบบน Claude เปิดกล้องไม่ได้ · บนเว็บจริงเปิดหน้านี้บนมือถือ iPhone หรือ Android เพื่อ${real}`;
  if (INAPP.test(navigator.userAgent || '')) return `เปิดลิงก์นี้ใน Safari หรือ Chrome เพื่อ${real}`;
  if (matchMedia('(pointer: coarse)').matches) return `เบราว์เซอร์นี้ยังเปิดกล้อง AR ไม่ได้ · เปิดหน้านี้ใน Safari บน iPhone หรือ Chrome บน Android เพื่อ${real}`;
  return `เปิดหน้านี้บนมือถือ iPhone หรือ Android เพื่อ${real}`;
}

// iOS: one USDZ per size, kept for a while (the visitor often opens it again); oldest revoked
const QL = new Map();
function usdzUrl(sc) {
  const k = `${sc.type}|${sc.w}|${sc.h}|${sc.d}`;
  if (!QL.has(k)) {
    QL.set(k, import('./ar3d.js').then(A => A.usdz(sc)).then(b => URL.createObjectURL(new Blob([b], { type: 'model/vnd.usdz+zip' }))).catch(e => { QL.delete(k); throw e; }));
    while (QL.size > 3) { const [k0, p] = QL.entries().next().value; QL.delete(k0); p.then(u => setTimeout(() => URL.revokeObjectURL(u), 60000), () => {}); }
  }
  return QL.get(k);
}
const frag = o => Object.entries(o).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');

/** "ขอนัดติดตั้งรุ่นนี้": the booking form, filled with this model (VRV / VRF stay a separate inquiry — CLAUDE.md §6.6 #16) */
function book(cx) {
  const { m, s, sc, root } = cx, b = BRAND_BY_ID[m.brand], t = TYPE_BY_ID[m.type];
  const notes = `ลองวาง ${b ? b.name + ' ' : ''}${s.sku} (${t ? t.th + ' ' : ''}${btuFmt(s.btu)}) ขนาดจริงผ่านกล้องมือถือแล้ว · ${dimsTh(sc)}`;
  const d = root.closest('[data-drawer]'); if (d && !d.hidden) closeDrawer(d);
  if (isVRF(m.series, s.sku, s.d && s.d.system)) askTeam('ระบบ VRV / VRF', notes);
  else requestBooking({ service: 'install', units: { [m.type]: 1 }, notes }, 'ติดตั้งแอร์');
}

async function quickLook(cx) {
  const { btn, sc, m, s, say, root } = cx;
  if (btn.getAttribute('aria-busy') === 'true') return;
  btn.setAttribute('aria-busy', 'true');
  const slow = setTimeout(() => say('กำลังเตรียมแบบจำลองขนาดจริง'), 300);
  try {
    const url = await usdzUrl(sc), b = BRAND_BY_ID[m.brand];
    const q = { allowsContentScaling: '0', callToAction: 'ขอนัดติดตั้งรุ่นนี้', checkoutTitle: `${b ? b.name + ' ' : ''}${s.sku}`, checkoutSubtitle: `${dimsTh(sc)} · แบบจำลองเพื่ออธิบาย` };
    if (/^https?:$/.test(location.protocol)) q.canonicalWebPageURL = location.origin + location.pathname;
    $$('a.ar-ql', root).forEach(a => a.remove());
    // Quick Look opens from an <a rel="ar"> holding an <img>; a made-in-browser model needs a .usdz name (download) to be recognised
    const a = h('a', { class: 'ar-ql', rel: 'ar', href: `${url}#${frag(q)}`, download: `sbp-aircare-${sc.type}-${cm(sc.w)}x${cm(sc.h)}x${cm(sc.d)}cm.usdz`, hidden: true, tabindex: '-1', 'aria-hidden': 'true' }, h('img', { alt: '' }));
    a.addEventListener('message', e => { if (e.data === '_apple_ar_quicklook_button_tapped') book(cx); });
    root.append(a); a.click();
    say('');
  } catch (e) { console.warn('[ar] usdz', e); say('เตรียมแบบจำลองไม่สำเร็จ ลองแตะอีกครั้ง'); }
  clearTimeout(slow); btn.removeAttribute('aria-busy');
}

/* ---------- WebXR: the camera view with Thai controls over it (dom-overlay) ---------- */
function overlay(cx) {
  const { m, s, sc } = cx, T = TX[sc.type], b = BRAND_BY_ID[m.brand];
  const B = (a, label, cls = 's-btn') => h('button', { type: 'button', class: cls, 'data-a': a, disabled: a !== 'close' }, label);
  const place = B('place', 'วาง', 's-btn primary'), turn = B('turn', 'หมุน'), move = B('move', 'ย้าย'), close = B('close', 'ปิด');
  turn.setAttribute('aria-label', 'หมุน 15 องศา');
  const bookB = h('button', { type: 'button', class: 's-btn ar-xr-book', hidden: true }, 'ขอนัดติดตั้งรุ่นนี้');
  const status = h('p', { class: 'ar-xr-s', role: 'status', 'aria-live': 'polite' }, 'กำลังเปิดกล้อง');
  const tall = h('p', { class: 'ar-xr-h', hidden: true });
  const el = h('div', { class: 'ar-xr wait', role: 'dialog', 'aria-modal': 'true', 'aria-label': `${T.go} · ${b ? b.name + ' ' : ''}${s.sku}`, tabindex: '-1' },
    h('div', { class: 'ar-xr-top' },
      h('p', { class: 'ar-xr-t' }, b ? b.name + ' ' : '', h('b', {}, s.sku)),
      h('p', { class: 'ar-xr-d' }, h('span', { class: 'ar-src' }, srcTh(sc)), ' ', h('span', { class: 'ar-nw' }, dimsTh(sc))),
      tall),
    h('div', { class: 'ar-xr-aim', 'aria-hidden': 'true' }),
    h('div', { class: 'ar-xr-bot' }, status, h('div', { class: 'ar-xr-b', role: 'group', 'aria-label': 'ควบคุมแบบจำลอง' }, place, turn, move, close), bookB, h('p', { class: 'ar-xr-f' }, phr(FINE))));
  trapFocus(el);
  // taps on the controls never reach the session as a "select" (that would place the body behind the button)
  ['ar-xr-top', 'ar-xr-bot'].forEach(c => el.querySelector('.' + c).addEventListener('beforexrselect', e => e.preventDefault()));
  let ctl = null;
  const run = (f) => () => { if (ctl) f(ctl); };
  place.addEventListener('click', run(c => c.place()));
  turn.addEventListener('click', run(c => c.rotate()));
  move.addEventListener('click', run(c => c.move()));
  close.addEventListener('click', () => (ctl ? ctl.end() : cx.cancel()));
  bookB.addEventListener('click', () => { cx.after = () => book(cx); ctl ? ctl.end() : cx.cancel(); });
  // Esc closes the camera view only (captured first: the product panel behind it, which also closes on Esc, stays open)
  const esc = e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close.click(); } };
  addEventListener('keydown', esc, true);
  const want = sc.type === 'cassette' ? 'ceiling' : sc.type === 'floor' ? 'floor' : 'wall';
  return {
    el,
    bind(c) { ctl = c; el.classList.remove('wait'); },
    drop() { removeEventListener('keydown', esc, true); },
    paint(st) {
      el.dataset.mode = st.mode; el.dataset.ok = String(!!st.ok);
      const f = document.activeElement;
      place.disabled = !(st.mode === 'aim' && st.ok); turn.disabled = !st.turn; move.disabled = st.mode !== 'placed'; bookB.hidden = st.mode !== 'placed';
      // a control that just turned off loses the keyboard focus: hand it to the next sensible one (never to the page behind)
      if (f && el.contains(f) && (f.disabled || f.hidden)) (st.mode === 'placed' ? move : !place.disabled ? place : el).focus({ preventScroll: true });
      let t;
      if (st.mode === 'placed') t = `วางแล้ว · กด\u00a0ย้าย เพื่อเลือกที่ใหม่${st.turn ? ' · กด\u00a0หมุน ทีละ 15\u00a0องศา' : ''}`;
      else if (st.ok) t = `พบ${SURF_TH[st.surf]}แล้ว · กด\u00a0วาง หรือแตะจอ`;
      else if (st.surf) t = `ตรงนี้เป็น${SURF_TH[st.surf]} · ${T.need}`;
      else t = T.aim;
      if (status.textContent !== t) status.textContent = t;
      // heights are estimates from the camera; guidance is general (FIT_RULES, CLAUDE.md §6.6 #17), never pass / fail
      let ht = '';
      if (st.bottom != null) ht = `ขอบล่างสูงจากพื้นประมาณ ${st.bottom.toFixed(2)} ม. · ค่าประมาณจากกล้อง` + (sc.type === 'wall' ? ` · ค่าแนะนำทั่วไป ${FIT_RULES.wall.bestBottom[0].toFixed(1)}–${FIT_RULES.wall.bestBottom[1].toFixed(1)} ม.` : sc.type === 'ceiling' ? ` · ค่าแนะนำทั่วไปไม่ต่ำกว่า ${FIT_RULES.ceiling.minBottom.toFixed(1)} ม.` : '');
      else if (st.ceil != null) ht = `ฝ้าสูงจากพื้นประมาณ ${st.ceil.toFixed(2)} ม. · ค่าประมาณจากกล้อง · ค่าแนะนำทั่วไป ${FIT_RULES.cassette.minH.toFixed(1)}–${FIT_RULES.cassette.maxH.toFixed(1)} ม.`;
      else if (want !== 'floor' && st.mode === 'aim' && !st.ok) ht = 'ส่องพื้นสักครู่ก่อน จะบอกความสูงจากพื้นให้';
      tall.hidden = !ht; if (tall.dataset.t !== ht) { tall.dataset.t = ht; tall.replaceChildren(...phr(ht)); }
    },
  };
}
const errTh = e => {
  const n = e && e.name;
  if (n === 'NotAllowedError' || n === 'SecurityError') return 'ไม่ได้รับอนุญาตให้ใช้กล้อง · เปิดสิทธิ์กล้องของเบราว์เซอร์แล้วลองอีกครั้ง';
  if (n === 'NotSupportedError') return 'อุปกรณ์นี้ยังวางแบบจำลองด้วยกล้องไม่ได้ · ขนาดดูได้จากตัวเลขด้านบนตามปกติ';
  return 'เปิดกล้องไม่สำเร็จ ลองแตะอีกครั้ง';
};
function webXR(cx) {
  const { btn, sc, say } = cx;
  if (btn.getAttribute('aria-busy') === 'true') return;
  const ov = overlay(cx);
  document.body.append(ov.el);
  let session = null, done = false;
  const finish = text => {
    if (done) return; done = true;
    ov.drop(); ov.el.remove(); btn.removeAttribute('aria-busy');
    if (btn.isConnected) btn.focus({ preventScroll: true });
    say(text);
    const next = cx.after; cx.after = null; if (next) next();
  };
  cx.cancel = () => { if (session) session.end().catch(() => {}); else finish(''); };
  // the session is asked for inside the tap (user activation); three.js and the body load meanwhile
  let req;
  try { req = navigator.xr.requestSession('immersive-ar', { requiredFeatures: ['hit-test'], optionalFeatures: ['dom-overlay'], domOverlay: { root: ov.el } }); } catch (e) { req = Promise.reject(e); }
  const mod = import('./ar3d.js');
  btn.setAttribute('aria-busy', 'true'); say('กำลังเปิดกล้อง');
  req.then(async ses => {
    session = ses;
    const A = await mod;
    const ctl = await A.startXR(ses, sc, { update: st => ov.paint(st), ended: () => finish('ปิดกล้องแล้ว · ขนาดดูได้จากตัวเลขด้านบน') });
    if (done) return;
    ov.bind(ctl); say(''); ov.el.focus({ preventScroll: true });
  }).catch(e => {
    console.warn('[ar] webxr', e);
    if (session) session.end().catch(() => {});
    finish(errTh(e));
  });
}

/** the AR entry for one model: a button beside "ดูรุ่นนี้แบบ 3 มิติ" plus the size and labels, or — where AR cannot open — one line
 *  saying where it works. sc = model3d.modelScene(m, s). Ducted units sit above the ceiling: nothing to place, so null. */
export function arButton(m, s, sc, { compact = false } = {}) {
  if (!m || !s || !sc || m.type === 'duct' || !TX[sc.type]) return null;
  const T = TX[sc.type], id = `ar-i-${Math.random().toString(36).slice(2, 8)}`;
  const root = h('div', { class: 'ar' + (compact ? ' compact' : ''), 'data-ar': 'wait' });
  const label = h('span', {}, T.go);
  const btn = h('button', { type: 'button', class: 's-btn ar-go', hidden: true, 'aria-describedby': id }, h('span', { class: 'ar-ic', html: IC_AR }), label);
  const msg = h('p', { class: 'ar-msg', role: 'status', 'aria-live': 'polite' });
  const tip = h('p', { class: 'ar-tip' });
  const info = h('div', { class: 'ar-info', id, hidden: true },
    h('p', { class: 'ar-dim' }, h('span', { class: 'ar-src' }, srcTh(sc)), ' ', h('span', { class: 'ar-nw' }, dimsTh(sc))), tip, h('p', { class: 'ar-fine' }, phr(FINE)));
  const hint = h('p', { class: 'ar-hint', hidden: true }, h('span', { class: 'ar-ic', html: IC_PHONE }), h('span', {}, ''));
  root.append(btn, hint, info, msg);
  const cx = { m, s, sc, btn, root, say: t => { if (msg.textContent !== t) msg.textContent = t; }, after: null, cancel: () => {} };
  arSupport().then(mode => {
    root.dataset.ar = mode;
    if (mode === 'none') { hint.lastChild.textContent = whyNot(sc); hint.hidden = false; return; }
    if (mode === 'quicklook') {
      if (T.qlGo) label.textContent = T.qlGo;
      tip.replaceChildren(...phr(`${T.ql} · ขนาดล็อกไว้ตามจริง`));
      btn.addEventListener('click', () => quickLook(cx));
      // start making the model as soon as the visitor reaches for the button (Quick Look must open from the same tap)
      ['pointerdown', 'focus'].forEach(t => btn.addEventListener(t, () => { usdzUrl(sc).catch(() => {}); }, { once: true, passive: true }));
    } else {
      tip.replaceChildren(...phr(`แตะแล้วอนุญาตให้ใช้กล้อง · ส่อง${sc.type === 'floor' ? 'พื้น' : sc.type === 'wall' ? 'ผนัง' : 'ฝ้า'}ช้า ๆ จนเห็นวงกลม · แล้วกด\u00a0วาง`));
      btn.addEventListener('click', () => webXR(cx));
      btn.addEventListener('pointerdown', () => { import('./ar3d.js').catch(() => {}); }, { once: true, passive: true });
    }
    btn.hidden = false; info.hidden = false;
  });
  return root;
}
