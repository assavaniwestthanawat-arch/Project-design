// SBP AirCare — WebGL context budget (B1, Rev.09). Every 3D scene registers its renderer here; at most MAX contexts stay
// live — the ones nearest the viewport. A scene that scrolls away keeps its JS state (step, camera, sliders) but its GL
// context is released through WEBGL_lose_context; when it comes back near the viewport the context is restored and three.js
// re-uploads geometry/textures by itself. The only GPU-side content three cannot rebuild is a PMREM environment map,
// so the pool regenerates scene.environment on restore. No module needs a suspend/resume rewrite.
// Hysteresis keeps scenes from flapping at the edge; reduced-motion users get the same budget.
import * as THREE from './three.module.min.js';
import { RoomEnvironment } from './RoomEnvironment.js';

// r8: 4 live scenes on devices that report ≥ 4 GB (fewer re-uploads while scrolling a view with 4 scenes); 3 otherwise (iOS
// reports nothing), 2 on ≤ 2 GB devices
const MAX = navigator.deviceMemory ? (navigator.deviceMemory <= 2 ? 2 : navigator.deviceMemory >= 4 ? 4 : 3) : 3;
const NEAR = 0.9;                  // "near" = within 0.9 viewport heights above/below the screen
const entries = [];
let queued = 0;

function dist(e) {
  const r = e.el.getBoundingClientRect(), vh = innerHeight || 800;
  if (!r.width && !r.height) return Infinity;                 // hidden (display:none / collapsed)
  if (r.bottom < 0) return -r.bottom / vh;                    // above the screen
  if (r.top > vh) return (r.top - vh) / vh;                   // below the screen
  return 0;                                                   // on screen
}
function balance() {
  queued = 0;
  // disposed scenes leave the pool (only once their canvas has been on the page: track() may run before it is appended)
  for (let i = entries.length - 1; i >= 0; i--) { const e = entries[i]; if (e.renderer.domElement.isConnected) e.seen = true; else if (e.seen) entries.splice(i, 1); }
  entries.forEach(e => { e.d = dist(e); });
  const want = entries.filter(e => e.d <= NEAR).sort((a, b) => a.d - b.d || b.t - a.t).slice(0, MAX);
  const keep = new Set(want);
  const active = () => entries.filter(e => e.state === 'live' || e.state === 'restoring' || e.state === 'losing');
  // free only what is needed to fit the wanted scenes (farthest first). r8: a scene that scrolled away keeps its context while
  // there is room — releasing it early meant a full re-upload + shader re-compile (a visible stall) every time it came back
  let excess = active().length + want.filter(e => e.state === 'lost').length - MAX;
  active().filter(e => e.state === 'live' && e.ext && !keep.has(e)).sort((a, b) => b.d - a.d)
    .forEach(e => { if (excess > 0) { lose(e); excess--; } });
  // bring back wanted scenes only once their slot is really free (the async 'lost' event re-runs this)
  let room = MAX - active().length;
  want.forEach(e => { if (e.state === 'lost' && room > 0) { restore(e); room--; } });
}
const schedule = () => { if (!queued) queued = requestAnimationFrame(balance); };
function lose(e) { if (!e.ext) return; e.state = 'losing'; try { e.ext.loseContext(); } catch (_) { e.state = 'live'; } }
function restore(e) { if (!e.ext) return; e.state = 'restoring'; try { e.ext.restoreContext(); } catch (_) { e.state = 'lost'; } }

let wired = false;
function wire() {
  if (wired) return; wired = true;
  addEventListener('scroll', schedule, { passive: true });
  addEventListener('resize', schedule);
  document.addEventListener('visibilitychange', schedule);
  setInterval(schedule, 1500);   // catches layout shifts (lazy sections growing) that fire no scroll event
}

// r8: after a restore, three.js's previous state objects still listen for 'dispose' on every geometry / material / texture;
// disposing one later made them delete the lost context's buffers ("object does not belong to this context" floods). The
// new state re-attaches its own listeners on first use, so the stale ones are dropped here (three r170 EventDispatcher).
function forget(root) {
  const seen = new Set(), f = o => { if (o && o._listeners && o._listeners.dispose && !seen.has(o)) { seen.add(o); delete o._listeners.dispose; } };
  root.traverse(n => { f(n.geometry); (Array.isArray(n.material) ? n.material : n.material ? [n.material] : []).forEach(m => { f(m); for (const k in m) { const v = m[k]; if (v && v.isTexture) f(v); } }); });
  if (root.environment) f(root.environment);
}
/** register a renderer; el = the element whose position decides priority. opts.scene → its RoomEnvironment map is rebuilt
 *  after a restore; opts.redraw() → called after a restore for scenes that render on demand. Returns { release() }. */
// r8: touch devices draw at ≤ 1.5× (≤ 1.25× on low-memory / few-core phones) instead of 2×: several animated scenes at 2× on a
// 3× phone screen were fill-rate bound (stutter, heat); the difference is hard to see at phone size
// r18 (owner: "ความคมชัด"): strong phones (≥ 6 GB, or ≥ 6 cores when the browser hides memory, as iOS does) draw at 2× — 1.5×
// on a 3× screen read soft on product edges and labels. The adaptive resolution below still steps every scene down
// (85 / 72 / 60 %) the moment frames run late, so the sharper start cannot cost smoothness.
const COARSE = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
const LOW = (navigator.deviceMemory && navigator.deviceMemory <= 3) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4);
const HIGH = !LOW && (navigator.deviceMemory ? navigator.deviceMemory >= 6 : (navigator.hardwareConcurrency || 0) >= 6);
export const PR_CAP = COARSE ? (LOW ? 1.25 : HIGH ? 2 : 1.5) : 2;
export function track(renderer, el, opts = {}) {
  // r15: no shader diagnostics outside automated checks — reading the program / shader logs makes the page wait for the GPU to
  // finish compiling (the stall when a new type or step appears); tests (navigator.webdriver) keep them to catch broken shaders
  if (!navigator.webdriver) renderer.debug.checkShaderErrors = false;
  if (renderer.getPixelRatio() > PR_CAP) { const sz = renderer.getSize(new THREE.Vector2()); renderer.setPixelRatio(PR_CAP); if (sz.x && sz.y) renderer.setSize(sz.x, sz.y, false); }
  const gl = renderer.getContext();
  const e = { renderer, el, scene: opts.scene || null, env: !!(opts.scene && opts.scene.environment), redraw: opts.redraw || null, onScale: opts.onScale || null, name: opts.name || '', ext: gl && gl.getExtension('WEBGL_lose_context'), state: 'live', t: performance.now(), d: 0, base: renderer.getPixelRatio(), drawn: 0, cost: 0 };
  if (lvl) applyScale(e, false);   // a scene being built: never call back into it from here
  const cv = renderer.domElement;
  // loseContext() makes the context unusable at once but three.js only learns of it from the async event — until then a
  // render would compile programs on a dead context (getProgramInfoLog → null). So render only while the slot is live.
  const render0 = renderer.render.bind(renderer);
  // r15: the first frame's shaders are compiled in parallel (KHR_parallel_shader_compile, Chrome / Edge / Android and newer
  // Safari) instead of blocking the page: the canvas waits invisibly until they are ready, then fades in. Browsers without
  // the extension draw at once, as before. The compile runs inside the first draw call, so a post-processing chain's render
  // target is current and the programs match what it draws.
  const par = !!(renderer.compileAsync && gl && gl.getExtension('KHR_parallel_shader_compile'));
  e.ready = !par;
  renderer.render = (s, c) => {
    if (e.state !== 'live') return;
    if (focusEl && !(e.el === focusEl || focusEl.contains(e.el) || e.el.contains(focusEl))) return;   // r15: another scene has the stage (glFocus)
    if (!e.ready) {
      if (!e.compiling) {
        e.compiling = true; cv.style.opacity = '0';
        const done = () => { if (e.ready) return; e.ready = true; cv.style.transition = 'opacity .35s ease'; cv.style.opacity = ''; setTimeout(() => { cv.style.transition = ''; }, 400); if (e.redraw) try { e.redraw(); } catch (_) {} };
        try { renderer.compileAsync(s, c).then(done, done); } catch (_) { done(); }
        setTimeout(done, 5000);   // never wait longer than this
      }
      if (!e.ready) return;
    }
    if (s === e.scene && !e.cam) { e.cam = c; e.rt = renderer.getRenderTarget(); setTimeout(() => whenCalm(late, 2500), 4000); }
    const t0 = performance.now(); render0(s, c); const t1 = performance.now(); e.cost += ((t1 - t0) - e.cost) * 0.1; e.drawn = lastDraw = t1; if (!probe) startProbe();
  };
  // r15: once the visitor pauses, everything the scene holds — hidden parts too (tools, later steps, other types kept for
  // a quick switch) — is compiled (in parallel where the GPU can; otherwise in one frame with everything shown), so showing it
  // later does not stall
  function late() {
    if (e.state !== 'live' || !e.cam || !e.scene) return;
    if (!par) { warmHidden(renderer, e.scene, e.cam, e.rt || undefined); return; }   // no parallel compile: one frame with everything shown, now
    const prev = renderer.getRenderTarget();
    try { renderer.setRenderTarget(e.rt || null); renderer.compileAsync(e.scene, e.cam).catch(() => {}); } catch (_) {}
    renderer.setRenderTarget(prev);
  }
  cv.addEventListener('webglcontextlost', () => { e.state = 'lost'; schedule(); });
  cv.addEventListener('webglcontextrestored', () => {
    e.state = 'live'; e.t = performance.now();

    if (e.scene) forget(e.scene);   // r8: before the next render (three.js has just rebuilt its state in its own handler)
    // three.js restores its own state on this event (registered first); rebuild the GPU-generated environment map after it
    setTimeout(() => {
      if (e.env && e.scene) { try { const pm = new THREE.PMREMGenerator(renderer); const old = e.scene.environment; e.scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; pm.dispose(); old && old.dispose && old.dispose(); } catch (_) {} }
      if (par) { e.ready = false; e.compiling = false; }   // r15: the restored context compiles everything again — in parallel too (after the map above)
      if (e.redraw) { try { e.redraw(); } catch (_) {} }
      schedule();
    }, 0);
  });
  // balance now, not on the next frame: scenes that boot back to back (fast scroll, single-file build) must not overshoot
  entries.push(e); wire(); if (queued) { cancelAnimationFrame(queued); } balance();
  // r12 move(el): the canvas was moved to another place on the page (one cinema serving several slots)
  // r15: a scene moved back onto the page after its old host was removed (the product drawer re-uses one viewer) joins again
  return { release() { const i = entries.indexOf(e); if (i >= 0) entries.splice(i, 1); schedule(); }, move(el2) { e.el = el2; e.seen = false; if (!entries.includes(e)) entries.push(e); schedule(); } };
}
/** r15: while a panel shows its own 3D (the product panel's model viewer over the page), the scenes behind it pause their
 *  drawing — one scene gets the GPU instead of two or three. glFocus(null) lets them draw again. */
let focusEl = null;
export function glFocus(el) { const was = focusEl; focusEl = el || null; if (was && !focusEl) entries.forEach(e => { if (e.redraw) try { e.redraw(); } catch (_) {} }); }
export const glBudget = () => ({ max: MAX, live: entries.filter(e => e.state === 'live').length, total: entries.length });

/* ---- r15 · adaptive resolution (owner 6 ต.ค. 2569: "ให้ smooth ไม่สะดุด") ------------------------------------------------
 * A display-rate probe runs only while some scene is drawing. Every 45 frames (or 3 s on a very slow device) it counts the late ones
 * (longer than 1.6 × the screen's own frame time): more than 1 in 6 late → every scene draws at a lower pixel ratio (one step,
 * at most every 2 s); 8 calm seconds → one step back toward full sharpness. Fill rate (pixels × shading) is what makes phones
 * stutter with animated scenes, and a lower pixel ratio is hard to see while things move. glLock(level) pins a level for the
 * owner's test panel (null = automatic). */
const STEPS = [1, 0.85, 0.72, 0.6];
const PR_MIN = 0.75;
let lvl = 0, lock = null, probe = 0, lastDraw = 0, lastChange = 0, calmSince = 0, prevT = 0;
const iv = [];
function applyScale(e, notify = true) {   // notify = false while the scene is still being built (its callbacks are not ready)
  const pr = Math.max(Math.min(PR_MIN, e.base), +(e.base * STEPS[lvl]).toFixed(3));
  if (Math.abs(e.renderer.getPixelRatio() - pr) < 0.01) return;
  e.renderer.setPixelRatio(pr);                     // three keeps the CSS size (setSize(w, h, false) inside)
  if (notify && e.onScale) { try { e.onScale(pr); } catch (_) {} }
  if (notify && e.redraw && e.drawn && performance.now() - e.drawn > 300) { try { e.redraw(); } catch (_) {} }   // still scenes: show the new sharpness now
}
function setLevel(n) { n = Math.max(0, Math.min(STEPS.length - 1, n)); if (n === lvl) return; lvl = n; lastChange = performance.now(); iv.length = 0; entries.forEach(e => applyScale(e)); }
function startProbe() { prevT = 0; probe = requestAnimationFrame(tick); }
function tick(t) {
  probe = 0;
  if (document.hidden || t - lastDraw > 2500) { prevT = 0; iv.length = 0; return; }   // idle: stop (the next draw restarts it)
  if (prevT) iv.push(t - prevT); prevT = t;
  // judge every 45 frames — or sooner on a very slow device (a few frames covering 3 s say enough)
  if (iv.length >= 45 || (iv.length >= 6 && iv.reduce((a, b) => a + b, 0) > 3000)) {
    const s = [...iv].sort((a, b) => a - b), frame = Math.max(6.9, Math.min(34, s[Math.floor(s.length * 0.2)]));
    const late = iv.filter(x => x > frame * 1.6 + 2).length / iv.length; iv.length = 0;
    const now = performance.now();
    stats.late = Math.round(late * 100); stats.frame = +frame.toFixed(1);
    if (lock == null) {
      if (late > 1 / 6) { calmSince = 0; if (now - lastChange > 2000) setLevel(lvl + 1); }
      else if (late < 0.03) { if (!calmSince) calmSince = now; else if (now - calmSince > 8000 && now - lastChange > 4000) { calmSince = now; setLevel(lvl - 1); } }
      else calmSince = 0;
    }
  }
  probe = requestAnimationFrame(tick);
}
const stats = { late: 0, frame: 0 };
/** r15: what the owner's test panel shows — level 0 = full sharpness … 3 = lightest; per scene: state, pixel ratio, draw cost */
export const glStats = () => ({ max: MAX, level: lvl, scale: STEPS[lvl], locked: lock != null, late: stats.late, frame: stats.frame, cap: PR_CAP,
  scenes: entries.map(e => ({ name: e.name || (e.el && (e.el.id || e.el.className || e.el.tagName)) || '?', state: e.state, pr: +e.renderer.getPixelRatio().toFixed(2), on: e.d === 0, cost: +e.cost.toFixed(1), active: performance.now() - e.drawn < 600 })) });
export function glLock(level) { lock = level == null ? null : Math.max(0, Math.min(STEPS.length - 1, +level)); if (lock != null) setLevel(lock); else { calmSince = 0; } }
export const GL_STEPS = STEPS;

/* ---- r15 · shader warm-up: compile what a scene will show next while the page is idle, so a click never waits for it ----
 * warm(renderer, scene, camera, obj, target) draws the scene once with obj forced visible (and not culled), so three.js builds
 * every program obj needs with the exact lights, clipping, tone mapping and output of a real frame. On screen (no target) the
 * normal frame is drawn again straight after, in the same task — the warm-up frame is never shown. Scenes drawn through a
 * post-processing chain pass its render target (the chain renders the scene into one, which needs other programs).
 * whenIdle(fn) runs fn when the main thread has nothing to do (or after `timeout` ms). */
export function warm(renderer, scene, camera, obj, target) {
  if (!obj || renderer.getContext().isContextLost()) return false;
  const added = !obj.parent; if (added) scene.add(obj);
  const vis = []; for (let o = obj; o; o = o.parent) { vis.push([o, o.visible]); o.visible = true; }
  const culled = []; obj.traverse(o => { if (o.frustumCulled) { culled.push(o); o.frustumCulled = false; } });
  const prev = renderer.getRenderTarget();
  try { if (target !== undefined) renderer.setRenderTarget(target); renderer.render(scene, camera); } catch (_) { /* a lost context: the next frame compiles */ }
  renderer.setRenderTarget(prev);
  culled.forEach(o => { o.frustumCulled = true; }); vis.forEach(([o, v]) => { o.visible = v; }); if (added) scene.remove(obj);
  if (target === undefined) { try { renderer.render(scene, camera); } catch (_) {} }
  return true;
}
/** r15: draw the scene once with everything hidden in it shown (tools for later steps, the next job's parts …) so their shaders
 *  compile now, at a calm moment, not when they first appear; the normal frame is drawn again straight after */
export function warmHidden(renderer, scene, camera, target) {
  if (!scene || renderer.getContext().isContextLost()) return false;
  const shown = [], culled = [];
  scene.traverse(o => { if (o !== scene && o.visible === false) { o.visible = true; shown.push(o); } if (o.frustumCulled) { o.frustumCulled = false; culled.push(o); } });
  if (!shown.length) { culled.forEach(o => { o.frustumCulled = true; }); return false; }
  const prev = renderer.getRenderTarget();
  try { if (target !== undefined) renderer.setRenderTarget(target); renderer.render(scene, camera); } catch (_) {}
  renderer.setRenderTarget(prev);
  shown.forEach(o => { o.visible = false; }); culled.forEach(o => { o.frustumCulled = true; });
  if (target === undefined) { try { renderer.render(scene, camera); } catch (_) {} }
  return true;
}
export const whenIdle = (fn, timeout = 2000) => (typeof requestIdleCallback === 'function' ? requestIdleCallback(() => fn(), { timeout }) : setTimeout(fn, 300));
// whenCalm(fn): like whenIdle, but also only after `quiet` ms without a touch, click, key, wheel or scroll — building the next
// type is a long task, and it must never land while the visitor is dragging, scrolling or pressing something
let lastInput = 0;
if (typeof addEventListener === 'function') ['pointerdown', 'pointermove', 'wheel', 'keydown', 'touchstart', 'scroll'].forEach(t => addEventListener(t, () => { lastInput = performance.now(); }, { passive: true, capture: true }));
export function whenCalm(fn, quiet = 1200) { calmQ.push({ fn, quiet }); pump(); }
// one job at a time for the whole page (several scenes preparing at once would add up to a visible hitch), never in the
// first seconds after the page opens, and a second's breather between jobs so taps and frames always get through
const calmQ = []; let calmBusy = false;
const GRACE = 3000;
function pump() {
  if (calmBusy || !calmQ.length) return; calmBusy = true;
  const { fn, quiet } = calmQ[0];
  const tryIt = () => {
    const now = performance.now(), w = Math.max(quiet - (now - lastInput), GRACE - now);
    if (w > 0) { setTimeout(tryIt, w + 60); return; }
    // a truly idle moment if the browser offers one soon; forced only after a long wait (a page that never idles still gets ready)
    whenIdle(() => {
      if (performance.now() - lastInput < quiet) { tryIt(); return; }
      calmQ.shift(); try { fn(); } catch (_) { /* a preparation that fails only means a later stall */ }
      calmBusy = false; setTimeout(pump, 1000);
    }, 6000);
  };
  tryIt();
}

/** r15: free a replaced subtree two frames later — after its replacement has been drawn once. three.js deletes a shader program
 *  as soon as no material uses it any more; disposing the old part first meant the new part (same kinds of material) had to
 *  compile them all again, on every switch. */
export function disposeLater(root, keep = null) { if (!root) return; const f = () => disposeDeep(root, keep); requestAnimationFrame(() => requestAnimationFrame(f)); }
/** r15: free only the geometry of a sample built for a shader warm-up — its materials stay, so their programs stay compiled */
export function freeGeometry(root) { if (root) root.traverse(o => { if (o.geometry && o.geometry.dispose) o.geometry.dispose(); }); }

/** r8: free what a removed subtree holds on the GPU — geometries, and the materials / textures that are not shared (keep =
 *  a Set of shared materials; their textures are kept too). Disposing something still in use is safe in three.js (it is
 *  uploaded again on next use) but costs a re-upload, so pass the shared sets. */
export function disposeDeep(root, keep = null) {
  if (!root) return;
  const keepT = new Set(); if (keep) keep.forEach(m => { for (const k in m) { const v = m[k]; if (v && v.isTexture) keepT.add(v); } });
  const doneM = new Set();
  root.traverse(o => {
    if (o.geometry && o.geometry.dispose) o.geometry.dispose();
    (Array.isArray(o.material) ? o.material : o.material ? [o.material] : []).forEach(m => {
      if (doneM.has(m) || (keep && keep.has(m))) return; doneM.add(m);
      for (const k in m) { const v = m[k]; if (v && v.isTexture && !keepT.has(v)) v.dispose(); }
      m.dispose();
    });
  });
}
