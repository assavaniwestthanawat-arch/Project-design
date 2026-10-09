// SBP AirCare — one cinema, many places (r12 v2 editions). A page marks "stage slots" ([data-stage] with a JSON scene:
// {type, shot, power, mode, swing, xray, explode, dirt, auto}). ONE createCinema() instance (one WebGL context — gl-pool budget)
// moves its canvas to whichever slot is most in view and plays that slot's scene; every other slot shows its poster frame
// (a still rendered at build time, so the first paint never waits for WebGL). The engine loads when the browser is idle or
// on the first touch of a slot. No WebGL → the posters stay and the page still reads complete.
// createStage({mood, quality, bars, selector}) → {set(slot, patch), scene(slot), on(slot, 'frame'|'active', fn), boot(), active, cinema}
import { $$ } from './sbp-core.js';

const RM = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const BASE = { frame: null, frameM: null, power: true, mode: 'cool', swing: true, xray: false, explode: 0, dirt: 0 };

export function createStage({ mood = 'aurora', quality = 'auto', bars = false, selector = '[data-stage]' } = {}) {
  const slots = $$(selector);
  const scenes = new Map(), subs = new Map(), vis = new Map();
  slots.forEach(s => { let sc = {}; try { sc = JSON.parse(s.dataset.stage || '{}'); } catch (_) {} scenes.set(s, sc); subs.set(s, { frame: new Set(), active: new Set() }); vis.set(s, 0); if (!s.querySelector('.stage-gl')) s.prepend(Object.assign(document.createElement('div'), { className: 'stage-gl' })); });
  let C = null, booting = null, active = null, failed = false, armed = false;
  const glOf = s => s.querySelector('.stage-gl');
  function pick() {
    let best = null, bv = 0.02;
    vis.forEach((v, s) => { if (v > bv && !s.closest('[hidden]')) { bv = v; best = s; } });
    if (best && best !== active) activate(best);
  }
  function activate(s) {
    const prev = active; active = s;
    if (!C) { if (!booting && armed) boot(); return; }   // before the boot moment the poster holds the slot
    C.attach(glOf(s)); C.scene({ ...BASE, ...scenes.get(s), cut: true });   // what a slot does not set returns to the base state
    slots.forEach(x => x.classList.toggle('is-live', x === s));
    if (prev) subs.get(prev).active.forEach(f => f(false));
    subs.get(s).active.forEach(f => f(true));
  }
  const io = new IntersectionObserver(es => {
    es.forEach(e => { const r = e.boundingClientRect, vh = innerHeight || 800; vis.set(e.target, e.isIntersecting ? Math.min(r.bottom, vh) - Math.max(r.top, 0) : 0); });
    pick();
  }, { threshold: [0, 0.15, 0.3, 0.5, 0.7, 0.9, 1] });
  slots.forEach(s => io.observe(s));

  function boot() {
    if (booting) return booting;
    const first = active || slots.find(s => vis.get(s) > 0) || slots[0];
    if (!first) return Promise.resolve(null);
    active = first;
    booting = import('./cinema3d.js').then(({ createCinema }) => {
      try {
        C = createCinema(glOf(first), { mood, quality, bars, model: null,
          onFrame: api => { if (active) subs.get(active).frame.forEach(f => f(api)); } });
      } catch (e) { failed = true; slots.forEach(s => s.classList.add('no-gl')); return null; }
      // the unit + its settled airflow are built in the next task (two shorter main-thread tasks instead of one long one)
      return new Promise(res => setTimeout(() => {
        const s0 = active || first;
        C.attach(glOf(s0)); C.scene({ ...BASE, ...scenes.get(s0), cut: true });
        s0.classList.add('is-live');
        subs.get(s0).active.forEach(f => f(true));
        pick();
        res(C);
      }, 30));
    });
    return booting;
  }
  // boot when the page is idle (after load), or as soon as a visitor touches a stage
  const coarse = matchMedia('(pointer: coarse)').matches;
  const idle = () => {
    if (coarse) { const go = () => { removeEventListener('scroll', go); removeEventListener('touchstart', go); armed = true; boot(); }; addEventListener('scroll', go, { passive: true, once: true }); addEventListener('touchstart', go, { passive: true, once: true }); setTimeout(go, 3500); return; }
    (window.requestIdleCallback || (f => setTimeout(f, 300)))(() => { armed = true; boot(); }, { timeout: 2500 });
  };
  if (document.readyState === 'complete') idle(); else addEventListener('load', idle, { once: true });
  slots.forEach(s => s.addEventListener('pointerdown', () => { armed = true; boot(); }, { once: true }));

  return {
    slots,
    get cinema() { return C; }, get active() { return active; }, get failed() { return failed; }, get reduced() { return RM(); },
    boot,
    scene: s => scenes.get(s),
    // change a slot's scene; applied at once when the slot holds the canvas, otherwise when it next does
    set(s, patch) { const sc = scenes.get(s); if (!sc) return; Object.assign(sc, patch); if (C && s === active) C.scene(patch); },   // before boot the scene is only stored (it plays when the engine starts)
    on(s, ev, fn) { subs.get(s)?.[ev]?.add(fn); return () => subs.get(s)?.[ev]?.delete(fn); },
    // run something on the engine once it exists (e.g. a button press before boot finished)
    with(fn) { armed = true; return C ? fn(C) : boot().then(c => c && fn(c)); },
  };
}

// labels for parts of the unit, drawn as HTML over a slot (two columns left/right, no overlap) — fed by the stage's frame hook
export function stageLabels(slot, stage) {
  const layer = document.createElement('div'); layer.className = 'stage-labs'; layer.setAttribute('aria-hidden', 'true'); slot.append(layer);
  let list = [];   // [{id, text, el}]
  const set = items => {
    layer.replaceChildren(); list = (items || []).map(([id, text]) => { const el = document.createElement('span'); el.className = 'stage-lab'; el.innerHTML = '<i></i><b></b>'; el.querySelector('b').textContent = text; layer.append(el); return { id, el }; });
    stage.with(c => c.kick());
  };
  stage.on(slot, 'frame', c => {
    if (!list.length) return;
    const W = slot.clientWidth, H = slot.clientHeight, side = { l: [], r: [] };
    const seen = new Set();   // the same name twice (an alias part) is drawn once
    list.forEach(L => { const a = c.anchor(L.id); L.a = a; const txt = L.el.textContent; if (!a || !a.on || seen.has(txt)) { L.el.hidden = true; return; } seen.add(txt); L.el.hidden = false; (a.x < W / 2 ? side.l : side.r).push(L); });
    for (const k of ['l', 'r']) {
      const col = side[k].sort((p, q) => p.a.y - q.a.y); let y = 16;
      col.forEach(L => {
        const h = L.el.offsetHeight || 30, ty = Math.max(y, Math.min(H - h - 16, L.a.y - h / 2)); y = ty + h + 8;
        const x = k === 'l' ? 14 : W - 14 - L.el.offsetWidth;
        L.el.style.transform = `translate(${Math.round(x)}px,${Math.round(ty)}px)`; L.el.dataset.side = k;
        const i = L.el.firstChild, ex = k === 'l' ? L.el.offsetWidth : 0, ey = h / 2, dx = L.a.x - x - ex, dy = L.a.y - ty - ey, len = Math.hypot(dx, dy);
        i.style.width = len + 'px'; i.style.transform = `rotate(${Math.atan2(dy, dx)}rad)`; i.style.left = ex + 'px'; i.style.top = ey + 'px';
      });
    }
  });
  stage.on(slot, 'active', on => { layer.hidden = !on; });
  return { set };
}
