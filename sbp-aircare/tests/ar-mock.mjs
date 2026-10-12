// Rev.11 AR test doubles (page init scripts) — headless Chromium has neither AR Quick Look nor an AR device, so the AR flow test
// and the screenshots stand them in:
//   QL_MOCK  iPhone Safari: its user agent + a.relList.supports('ar') → true (the click then downloads the .usdz in Chromium)
//   XR_MOCK  navigator.xr with immersive-ar support and a fake XRSession: hit-test results on a wall / floor / ceiling
//            (window.__xr.surface), viewer pose 1.5 m above the floor, frames every 50 ms; window.__xr records the request
//            (window.__xr.reject = 'NotAllowedError' makes requestSession fail like a denied camera). The renderer's canvas is
//            kept (window.__xr.canvas) so a screenshot can show the body over a stand-in "camera picture".
// Test-only globals; the site itself adds none.
export const QL_MOCK = () => {
  Object.defineProperty(navigator, 'userAgent', { configurable: true, get: () => 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1' });
  const sup = DOMTokenList.prototype.supports;
  DOMTokenList.prototype.supports = function (t) { return t === 'ar' ? true : sup.call(this, t); };
};
export const XR_MOCK = () => {
  const X = window.__xr = { calls: [], surface: 'wall', ended: 0, reject: null, session: null, canvas: null, cancelled: false };
  // hit poses (column-major; Y axis = surface normal), 1.6 m in front of a camera at (0, 1.5, 0) looking down −Z; floor at y = 0
  const POSE = {
    wall: [1, 0, 0, 0, 0, 0, 1, 0, 0, -1, 0, 0, 0, 2.25, -1.6, 1],
    floor: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, -1.6, 1],
    ceiling: [1, 0, 0, 0, 0, -1, 0, 0, 0, 0, -1, 0, 0, 2.7, -1.6, 1],
  };
  const proj = () => { const f = 1 / Math.tan(Math.PI / 6), a = innerWidth / innerHeight, n = 0.01, fa = 40; return [f / a, 0, 0, 0, 0, f, 0, 0, 0, 0, (fa + n) / (n - fa), -1, 0, 0, (2 * fa * n) / (n - fa), 0]; };
  const gc = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (t, o) { const c = gc.call(this, t, o); if (o && o.xrCompatible) X.canvas = this; return c; };
  for (const C of [window.WebGLRenderingContext, window.WebGL2RenderingContext]) if (C) C.prototype.makeXRCompatible = async function () {};
  window.XRWebGLLayer = class { constructor() { this.framebuffer = null; this.framebufferWidth = innerWidth; this.framebufferHeight = innerHeight; this.antialias = true; } getViewport() { return { x: 0, y: 0, width: innerWidth, height: innerHeight }; } };
  class FakeSession extends EventTarget {
    constructor(opts) { super(); this.renderState = { baseLayer: null }; this.enabledFeatures = ['hit-test', 'dom-overlay']; this.domOverlayState = opts.domOverlay ? { type: 'screen' } : undefined; this.environmentBlendMode = 'alpha-blend'; this.inputSources = []; this.done = false; }
    updateRenderState(s) { Object.assign(this.renderState, s); }
    async requestReferenceSpace(type) { return { type, getOffsetReferenceSpace() { return this; } }; }
    async requestHitTestSource() { return { cancel() { X.cancelled = true; } }; }
    requestAnimationFrame(cb) { setTimeout(() => { if (!this.done) cb(performance.now(), this.frame()); }, 50); return 1; }
    cancelAnimationFrame() {}
    frame() {
      // the phone looks at the hit (the hit-test ray leaves the centre of the screen): pitch toward it
      const m = POSE[X.surface], a = m ? Math.atan2(m[13] - 1.5, -m[14]) : 0, c = Math.cos(a), s = Math.sin(a);
      const pose = { matrix: new Float32Array([1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 1.5, 0, 1]), position: { x: 0, y: 1.5, z: 0, w: 1 }, orientation: { x: Math.sin(a / 2), y: 0, z: 0, w: Math.cos(a / 2) },
        inverse: { matrix: new Float32Array([1, 0, 0, 0, 0, c, -s, 0, 0, s, c, 0, 0, -1.5 * c, 1.5 * s, 1]) } };
      return { session: this, getViewerPose: () => ({ transform: pose, views: [{ eye: 'none', projectionMatrix: new Float32Array(proj()), transform: pose }] }),
        getHitTestResults: () => { const m = POSE[X.surface]; return m ? [{ getPose: () => ({ transform: { matrix: new Float32Array(m) } }) }] : []; } };
    }
    async end() { if (this.done) return; this.done = true; X.ended++; this.dispatchEvent(new Event('end')); }
  }
  Object.defineProperty(navigator, 'xr', { configurable: true, value: {
    isSessionSupported: async mode => mode === 'immersive-ar',
    requestSession: async (mode, opts = {}) => {
      X.calls.push({ mode, required: opts.requiredFeatures || [], optional: opts.optionalFeatures || [], overlay: !!(opts.domOverlay && opts.domOverlay.root && opts.domOverlay.root.isConnected) });
      if (X.reject) throw new DOMException('test', X.reject);
      return (X.session = new FakeSession(opts));
    },
  } });
};
// open the shop view and the product panel of the first catalogue model of a type ('ติดผนัง' = wall …)
export async function openModel(p, typeTh = 'ติดผนัง') {
  await p.evaluate(() => { location.hash = 'shop'; });
  // B opens the catalogue as a table: switch to cards (the same product panel opens from either)
  await p.waitForSelector('[data-cat-grid] > *', { state: 'attached', timeout: 120000 });
  await p.evaluate(() => { const g = document.querySelector('[data-cat-view="grid"]'); if (g && g.getAttribute('aria-pressed') !== 'true') g.click(); });
  await p.waitForSelector('[data-cat-grid] .card .open', { timeout: 120000 });
  await p.waitForTimeout(600);
  // narrow the catalogue to the type (the facet checkbox works in the hidden phone sheet too)
  const tid = { 'ติดผนัง': 'wall', 'แขวนใต้ฝ้า': 'ceiling', 'สี่ทิศทาง': 'cassette', 'ตู้ตั้งพื้น': 'floor', 'ซ่อนในฝ้า': 'duct' }[typeTh];
  if (tid) await p.evaluate(id => { const i = document.getElementById('f-type-' + id); if (i && !i.checked) i.click(); }, tid);
  await p.waitForFunction(([th, id]) => [...document.querySelectorAll('[data-cat-grid] .card')].some(x => x.textContent.includes(th) || x.querySelector(`[data-type="${id}"]`)), [typeTh, tid], { timeout: 30000 }).catch(() => {});
  const ok = await p.evaluate(([th, id]) => { const c = [...document.querySelectorAll('[data-cat-grid] .card')].find(x => x.textContent.includes(th) || x.querySelector(`[data-type="${id}"]`)); const b = c && c.querySelector('.open'); if (b) b.click(); return !!b; }, [typeTh, tid]);
  if (!ok) throw new Error('no catalogue card of type ' + typeTh);
  await p.waitForSelector('#drawerBody .m3d', { state: 'attached', timeout: 30000 });
  await p.waitForFunction(() => { const r = document.querySelector('#drawerBody .ar'); return r && r.dataset.ar !== 'wait'; }, null, { timeout: 30000 });
}
