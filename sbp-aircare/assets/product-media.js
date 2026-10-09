// SBP AirCare — product photos per model / series, with rendered 3D product shots as the fallback — Rev.09
// Owner decision (1 ต.ค. 2569): every model gets an image slot now; real photos are added later without code changes.
//   1) put the photo in assets/products/  (webp / png / jpg; transparent background looks best, ≥ 1200 px wide)
//   2) list it in assets/product-media.json — most specific key wins:
//        "models":  { "FTKB09ZV2S": ["daikin-ftkb09zv2s.webp", "daikin-ftkb09zv2s-side.webp"] }
//        "series":  { "daikin|FTKB / Max Inverter": ["daikin-ftkb.webp"] }        (brand id | series as shown on the card)
//        "brands":  { "fujiva": { "wall": ["fujiva-wall.webp"], "cassette": ["fujiva-4way.webp"] } }
//   build.py inlines the manifest as globalThis.__SBP_MEDIA and publishes the files next to each page (products/…).
// Without a photo the card shows a studio render of the neutral 3D body of that type (no brand design copied),
// captioned "ภาพประกอบ" so a render is never mistaken for the real product.
import { h, TYPE_BY_ID, BRAND_BY_ID } from './sbp-core.js';
import { typeArt } from './proto-ui.js';

let MEDIA = { models: {}, series: {}, brands: {} };
let BASE = './assets/products/';
export async function loadMedia() {
  try {
    if (globalThis.__SBP_MEDIA) { MEDIA = { ...MEDIA, ...globalThis.__SBP_MEDIA }; BASE = globalThis.__SBP_MEDIA.base || 'products/'; return MEDIA; }
    BASE = new URL('./products/', import.meta.url).href;
    const r = await fetch(new URL('./product-media.json', import.meta.url));
    if (r.ok) MEDIA = { ...MEDIA, ...(await r.json()) };
  } catch (e) { /* no manifest → renders only */ }
  return MEDIA;
}
const url = f => (/^(https?:|data:|\/)/.test(f) ? f : BASE + f);
// photos for one SKU of a catalog series card (m = DEMO.models entry, sku = one of m.skus)
export function photosFor(m, sku) {
  const b = BRAND_BY_ID[m.brand];
  const list = (sku && MEDIA.models[sku.sku]) || MEDIA.series[`${m.brand}|${m.series}`] || MEDIA.series[`${m.brand}|${sku?.d?.series}`] || (MEDIA.brands[m.brand] || {})[m.type] || [];
  return (Array.isArray(list) ? list : [list]).map(url).map(src => ({ src, alt: `${b ? b.name : ''} ${sku ? sku.sku : m.series}`.trim() }));
}
export const hasPhoto = (m, sku) => photosFor(m, sku).length > 0;

/* ---------- rendered product shots (one temporary WebGL context, then released) ---------- */
let shotsP = null;
const SHOTS = {};
// r15: the five studio shots are kept in this browser after the first visit (the same images every time), so a returning visitor's
// shop needs no WebGL context and no renders at all; encoding is asynchronous (toBlob) instead of a blocking toDataURL
const KEY = 'sbp-shots-r18';   // r18: renders 1080×720 (was 720×480 — soft in the product panel on 2× screens); new key drops the old cache
try { localStorage.removeItem('sbp-shots-r15'); } catch (_) {}   // r18: the smaller r15 renders are not used any more
const fromCache = () => { try { const j = JSON.parse(localStorage.getItem(KEY) || 'null'); return j && j.wall && j.floor ? j : null; } catch (_) { return null; } };
const toData = b => new Promise(res => { try { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = () => res(null); fr.readAsDataURL(b); } catch (_) { res(null); } });
export function productShots() {
  if (shotsP) return shotsP;
  const C = fromCache(); if (C) { Object.assign(SHOTS, C); return (shotsP = Promise.resolve(SHOTS)); }
  shotsP = (async () => {
    let r; const blobs = {}, pending = [];
    try {
      const THREE = await import('./three.module.min.js');
      const { buildPremiumIndoor, buildOutdoor, materialSet } = await import('./ac3d.js');
      const { buildCeilingUnit, buildCassetteUnit, buildFloorUnit } = await import('./units3d.js');
      const { RoomEnvironment } = await import('./RoomEnvironment.js');
      const idle = () => new Promise(res => (window.requestIdleCallback ? requestIdleCallback(() => res(), { timeout: 400 }) : setTimeout(res, 30)));
      const W = 1080, H = 720;
      const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
      r = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true, preserveDrawingBuffer: true, powerPreference: 'low-power' });
      r.setPixelRatio(1); r.setSize(W, H, false);
      r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.06;
      r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
      const scene = new THREE.Scene();
      const pm = new THREE.PMREMGenerator(r); scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.85;
      scene.add(new THREE.HemisphereLight(0xffffff, 0xdfe6ee, 0.55));
      const key = new THREE.DirectionalLight(0xffffff, 1.6); key.castShadow = true; key.shadow.mapSize.set(1024, 1024); key.shadow.radius = 6;
      scene.add(key, key.target);
      const ground = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), new THREE.ShadowMaterial({ opacity: 0.16 })); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
      const cam = new THREE.PerspectiveCamera(26, W / H, 0.05, 30);
      const M = materialSet('studio');
      const shadowAll = g => g.traverse(o => { if (o.isMesh) { o.castShadow = !o.userData.noShadow; o.receiveShadow = true; } });
      const floating = U => U.root.traverse(o => { o.userData.noShadow = true; });   // indoor units float in the shot: only the outdoor unit grounds it
      // r15: where the GPU compiles in parallel, the first shot's shaders compile without blocking the page
      const par = !!(r.compileAsync && r.getContext().getExtension('KHR_parallel_shader_compile'));
      const shot = async (build, { yaw = -0.5, pitch = 0.16, pad = 1.06, floorAt = 'min', keyUp = 4 } = {}) => {
        const g = new THREE.Group(); build(g); shadowAll(g); scene.add(g);
        const bb = new THREE.Box3().setFromObject(g), c = bb.getCenter(new THREE.Vector3()), sz = bb.getSize(new THREE.Vector3());
        ground.position.y = floorAt === 'min' ? bb.min.y - 0.002 : -50;
        // fit the box in both directions of the frame (tall floor units and wide ceiling units alike)
        const tv = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)), rad = sz.length() / 2;
        const dist = Math.max(sz.y / 2 / tv, Math.max(sz.x, sz.z) / 2 / (tv * cam.aspect)) * pad + Math.max(sz.x, sz.z) * 0.3;
        cam.position.set(c.x + Math.sin(yaw) * Math.cos(pitch) * dist, c.y + Math.sin(pitch) * dist, c.z + Math.cos(yaw) * Math.cos(pitch) * dist); cam.lookAt(c);
        key.position.set(c.x + 2.2, c.y + keyUp, c.z + 3); key.target.position.copy(c);
        const sc = key.shadow.camera; sc.left = sc.bottom = -rad * 1.6; sc.right = sc.top = rad * 1.6; sc.near = 0.1; sc.far = 12; sc.updateProjectionMatrix();
        if (par) { try { await r.compileAsync(scene, cam); } catch (_) {} }
        r.render(scene, cam);
        // the bitmap is copied when toBlob is called; encoding runs off the main thread
        const p = new Promise(res => { try { cv.toBlob(b => res(b), 'image/webp', 0.9); } catch (e) { res(null); } });
        scene.remove(g); g.traverse(o => { if (o.isMesh) { o.geometry.dispose(); } });
        return [p];   // (in an array: awaiting the shot must not wait for the encode)
      };
      // the encode finishes later (the context is released as soon as the last shot is drawn — it must not outlive the renders)
      const put = async (k, sp) => { const [p] = await sp; pending.push(p.then(b => { if (b) { blobs[k] = b; SHOTS[k] = URL.createObjectURL(b); } })); };
      const outdoor = (g, x, z, s = 0.62) => { const O = buildOutdoor(M); O.root.scale.setScalar(s); O.root.position.set(x, 0.55 * s / 2, z); O.root.rotation.y = -0.18; g.add(O.root); };
      await put('wall', shot(g => { const U = buildPremiumIndoor(M, { logo: false }); floating(U); U.root.position.set(0, 0.62, 0); U.root.rotation.y = 0.04; g.add(U.root); outdoor(g, 0.72, -0.62); }, { yaw: -0.42, pitch: 0.12 }));
      await idle();   // r8: let the page breathe between renders
      await put('wall:fujiva', shot(g => { const U = buildPremiumIndoor(M, { logo: true }); floating(U); U.root.position.set(0, 0.62, 0); U.root.rotation.y = 0.04; g.add(U.root); outdoor(g, 0.72, -0.62); }, { yaw: -0.42, pitch: 0.12 }));   // company brand: wordmark allowed
      await idle();   // r8: let the page breathe between renders
      await put('ceiling', shot(g => { const U = buildCeilingUnit(M, { interior: false, rod: 0 }); floating(U); U.parts.hangers && (U.parts.hangers.visible = false); U.root.position.set(0, 0.7, 0); g.add(U.root); outdoor(g, 1.0, -0.9, 0.7); }, { yaw: -0.5, pitch: 0.05 }));
      await idle();   // r8: let the page breathe between renders
      await put('cassette', shot(g => { const U = buildCassetteUnit(M, { interior: false, rod: 0 }); floating(U); U.root.position.set(0, 0.75, 0); U.root.rotation.x = -0.95; U.parts.hangers && (U.parts.hangers.visible = false); g.add(U.root); outdoor(g, 0.95, -0.8, 0.7); }, { yaw: -0.5, pitch: 0.1 }));   // panel tilted toward the camera, as product shots show it
      await idle();   // r8: let the page breathe between renders
      await put('floor', shot(g => { const U = buildFloorUnit(M); g.add(U.root); outdoor(g, 0.92, -0.3, 0.62); }, { yaw: -0.45, pitch: 0.14, keyUp: 9 }));   // high key light: short shadow under a tall unit
      pm.dispose();
    } catch (e) { /* no WebGL → the line-art illustration stays */ }
    finally { if (r) { r.dispose(); r.forceContextLoss(); } }
    await Promise.all(pending);
    // keep them for the next visit (data URLs, read asynchronously; quota or private mode → simply not kept)
    if (Object.keys(blobs).length === 5) Promise.all(Object.entries(blobs).map(async ([k, b]) => [k, await toData(b)])).then(L => { if (L.every(x => x[1])) { try { localStorage.setItem(KEY, JSON.stringify(Object.fromEntries(L))); } catch (_) {} } });
    return SHOTS;
  })();
  return shotsP;
}

/* ---------- the visual used by catalog cards, product detail and the room-fit picker ---------- */
// size: 'card' | 'detail' | 'thumb'
export function productVisual(m, sku, { size = 'card', tag = null } = {}) {
  const t = TYPE_BY_ID[m.type];
  const photos = photosFor(m, sku);
  const fig = h('figure', { class: `s-ph s-ph-${size}` + (photos.length ? ' real' : ' render'), 'data-type': m.type });
  if (photos.length) {
    const main = h('img', { src: photos[0].src, alt: photos[0].alt, loading: 'lazy', decoding: 'async' });
    fig.append(main);
    if (size === 'detail' && photos.length > 1) {
      const strip = h('div', { class: 's-ph-strip', role: 'group', 'aria-label': 'ภาพสินค้า' });
      photos.forEach((p, i) => strip.append(h('button', { type: 'button', 'aria-pressed': i === 0, 'aria-label': `ภาพที่ ${i + 1}`, onclick: e => { main.src = p.src; strip.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', b === e.currentTarget)); } }, h('img', { src: p.src, alt: '', loading: 'lazy' }))));
      fig.append(strip);
    }
  } else {
    const holder = h('div', { class: 's-ph-art', html: typeArt(m.type) });
    fig.append(holder, h('figcaption', {}, 'ภาพประกอบ'));
    const key = m.brand === 'fujiva' && m.type === 'wall' ? 'wall:fujiva' : m.type;
    const swap = S => { if (!S[key]) return; holder.replaceWith(h('img', { src: S[key], alt: `ภาพประกอบ ${t ? t.th : ''}`, decoding: 'async' })); };
    // r8: render the studio shots only when an illustrated card comes near the screen (a temporary WebGL context + 6 shadowed
    // renders used to run during page load because a card on another page asked for them)
    if (SHOTS[key]) swap(SHOTS);
    else { const io = new IntersectionObserver(es => { if (!es.some(e => e.isIntersecting)) return; io.disconnect(); productShots().then(swap); }, { rootMargin: '300px 0px' }); io.observe(fig); }
  }
  if (tag) fig.append(h('span', { class: 's-ph-tag' }, tag));
  return fig;
}
