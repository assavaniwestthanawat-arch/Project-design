// SBP AirCare — installation material kit (Rev.08): physically-based looks for the materials the company installs.
//  • copper: O-TWO refrigerant pipe, wall 0.70 mm (the only copper the web shows), polished/oxidised variation
//  • insulation: Aeroflex EPDM closed-cell, black, fine pebbled skin, brand + spec printed along the tube
//  • drain: blue PVC (as installed by the company), glossy, printed along the pipe
//  • trunking: white PVC (Airpro-style), satin; cable: grey sheath with print; galvanised steel; rubber; brass
// Brand marks: printed as plain text only. If the company supplies an official logo file (with the brand owner's permission)
// as globalThis.__SBP_LOGOS[key] (data URI; build.py inlines assets/logos/<key>.png), the print uses that image instead.
import * as THREE from './three.module.min.js';

const cache = new Map();
const once = (k, f) => cache.has(k) ? cache.get(k) : (cache.set(k, f()), cache.get(k));
function ctex(w, h, draw, srgb = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

export function logoImage(key) {
  const src = globalThis.__SBP_LOGOS && globalThis.__SBP_LOGOS[key]; if (!src) return null;
  return once('img:' + key, () => { const im = new Image(); im.src = src; return im; });
}

// pebbled / grain normal maps (tangent space) from a height canvas
function normalFrom(h, w, hh, k = 2) {
  const c = document.createElement('canvas'); c.width = w; c.height = hh; const g = c.getContext('2d'); const out = g.createImageData(w, hh);
  const H = (x, y) => h[((y + hh) % hh) * w + ((x + w) % w)];
  for (let y = 0; y < hh; y++) for (let x = 0; x < w; x++) {
    const dx = (H(x + 1, y) - H(x - 1, y)) * k, dy = (H(x, y + 1) - H(x, y - 1)) * k; const l = Math.hypot(dx, dy, 1);
    const i = (y * w + x) * 4; out.data[i] = (-dx / l * 0.5 + 0.5) * 255; out.data[i + 1] = (-dy / l * 0.5 + 0.5) * 255; out.data[i + 2] = (1 / l * 0.5 + 0.5) * 255; out.data[i + 3] = 255;
  }
  g.putImageData(out, 0, 0); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
const pebble = () => once('pebble', () => { const w = 256, hh = 256, h = new Float32Array(w * hh); for (let i = 0; i < 2600; i++) { const cx = rnd() * w, cy = rnd() * hh, r = 1.5 + rnd() * 3.5; for (let y = -6; y <= 6; y++) for (let x = -6; x <= 6; x++) { const d = Math.hypot(x, y) / r; if (d < 1) { const X = ((Math.round(cx + x)) % w + w) % w, Y = ((Math.round(cy + y)) % hh + hh) % hh; h[Y * w + X] += (1 - d * d) * 0.6; } } } return normalFrom(h, w, hh, 1.6); });
const brushed = () => once('brushed', () => { const w = 512, hh = 64, h = new Float32Array(w * hh); for (let y = 0; y < hh; y++) { let v = rnd(); for (let x = 0; x < w; x++) { v += (rnd() - 0.5) * 0.08; h[y * w + x] = v * 0.4 + rnd() * 0.05; } } return normalFrom(h, w, hh, 0.6); });
const satin = () => once('satin', () => { const w = 128, hh = 128, h = new Float32Array(w * hh); for (let i = 0; i < w * hh; i++) h[i] = rnd() * 0.25; return normalFrom(h, w, hh, 0.3); });

// print texture for a TubeGeometry (u = along the path, v = around): text repeated along u in a narrow band
function printTex(bg, ink, text, logoKey, { band = [0.18, 0.34], per = 0.9, font = 700, px = 44, stripe = null } = {}) {
  const W = 1024, Hh = 256;
  const draw = (g) => {
    g.fillStyle = bg; g.fillRect(0, 0, W, Hh);
    if (stripe) { g.fillStyle = stripe; g.fillRect(0, Hh * 0.55, W, Hh * 0.3); }
    const y0 = band[0] * Hh, y1 = band[1] * Hh, cy = (y0 + y1) / 2;
    const im = logoKey ? logoImage(logoKey) : null;
    g.save(); g.translate(0, cy);
    // around the tube v runs across the canvas height; keep the text upright along the length
    if (im && im.complete && im.naturalWidth) { const hgt = (y1 - y0) * 0.9, wd = hgt * im.naturalWidth / im.naturalHeight; g.drawImage(im, 24, -hgt / 2, wd, hgt); g.font = `${font} ${px * 0.62}px Arial, Helvetica, sans-serif`; g.fillStyle = ink; g.textBaseline = 'middle'; g.fillText(text.replace(/^\S+\s*/, ''), 36 + wd, 2); }
    else {
      const [brand, ...rest] = text.split('   '); g.fillStyle = ink; g.textBaseline = 'middle';
      g.font = `900 ${px * 1.12}px Arial, Helvetica, sans-serif`; g.fillText(brand, 24, 2); const bw = g.measureText(brand).width;
      g.font = `${font} ${px * 0.78}px Arial, Helvetica, sans-serif`; g.fillText(rest.join('   '), 24 + bw + px * 0.8, 3);
    }
    g.restore();
  };
  const t = ctex(W, Hh, draw);
  const im = logoKey ? logoImage(logoKey) : null; if (im && !im.complete) im.addEventListener('load', () => { const c = t.image; draw(c.getContext('2d')); t.needsUpdate = true; });
  t.userData = { per };
  return t;
}

export function kit(theme = 'light') {
  const flat = theme === 'blueprint';
  return once('kit:' + theme, () => {
    if (flat) {
      const L = c => new THREE.MeshLambertMaterial({ color: c });
      return { flat, copper: L(0xe2711d), copperCut: L(0xf2a36b), insul: L(0x5b6f8c), insulPrint: null, drain: L(0x6a9ad6), drainPrint: null, trunk: L(0xf7f9fc), trunkFit: L(0xeef3f9), cable: L(0x9fb3cf), steel: L(0xc7d4e6), rubber: L(0x5b6f8c), brass: L(0xe2b04a), wall: L(0xf1f5fa) };
    }
    const copper = new THREE.MeshPhysicalMaterial({ color: 0xc8794a, metalness: 1, roughness: 0.3, clearcoat: 0.25, clearcoatRoughness: 0.2, normalMap: brushed(), normalScale: new THREE.Vector2(0.25, 0.25) });
    const copperCut = new THREE.MeshStandardMaterial({ color: 0xe8a878, metalness: 1, roughness: 0.18 });
    const insul = new THREE.MeshStandardMaterial({ color: 0x151618, roughness: 0.88, metalness: 0, normalMap: pebble(), normalScale: new THREE.Vector2(0.6, 0.6) });
    const drain = new THREE.MeshPhysicalMaterial({ color: 0x2b6cc4, roughness: 0.32, metalness: 0, clearcoat: 0.7, clearcoatRoughness: 0.2 });
    const trunk = new THREE.MeshPhysicalMaterial({ color: 0xf7f7f4, roughness: 0.36, metalness: 0, clearcoat: 0.3, normalMap: satin(), normalScale: new THREE.Vector2(0.15, 0.15) });
    const trunkFit = new THREE.MeshPhysicalMaterial({ color: 0xfbfbf9, roughness: 0.28, clearcoat: 0.4 });
    const cable = new THREE.MeshStandardMaterial({ color: 0xb9bdc2, roughness: 0.55 });
    const steel = new THREE.MeshStandardMaterial({ color: 0xb4bcc4, metalness: 0.75, roughness: 0.38, normalMap: satin(), normalScale: new THREE.Vector2(0.4, 0.4) });
    const rubber = new THREE.MeshStandardMaterial({ color: 0x17181a, roughness: 0.92 });
    const brass = new THREE.MeshStandardMaterial({ color: 0xc9a44c, metalness: 0.95, roughness: 0.26 });
    return { flat, copper, copperCut, insul, drain, trunk, trunkFit, cable, steel, rubber, brass };
  });
}

/** printed material for a tube of length L (m): Aeroflex insulation / blue drain / Yazaki THW cores (thwL brown, thwN blue, thwG green-yellow) */
const THW = 'YAZAKI   THW   60227 IEC 01   1×2.5 sq.mm   450/750 V';
const SPEC = {
  insul: { bg: '#151618', ink: 'rgba(240,240,236,0.95)', text: 'AEROFLEX   EPDM · CLOSED CELL · 3/8"', key: 'aeroflex', per: 0.95, band: [0.2, 0.36], flat: 0x5b6f8c },
  drain: { bg: '#2b6cc4', ink: 'rgba(245,248,255,0.92)', text: 'SCG   ท่อ PVC   3/4"', key: 'scg', per: 1.1, band: [0.22, 0.34], flat: 0x6a9ad6 },
  thwL: { bg: '#6a3a1e', ink: 'rgba(245,236,220,0.85)', text: THW, key: 'yazaki', per: 1.3, band: [0.25, 0.38], flat: 0xb07a52 },
  thwN: { bg: '#1f4fa8', ink: 'rgba(235,242,255,0.85)', text: THW, key: 'yazaki', per: 1.3, band: [0.25, 0.38], flat: 0x6a8fd0 },
  thwG: { bg: '#e2c21e', ink: 'rgba(30,60,30,0.8)', text: THW, key: 'yazaki', per: 1.3, band: [0.25, 0.38], stripe: '#2f9a45', flat: 0xb9c46a },
  cable: { bg: '#b9bdc2', ink: 'rgba(40,44,50,0.85)', text: THW, key: 'yazaki', per: 1.2, band: [0.2, 0.34], flat: 0x9fb3cf },
};
export function printed(kind, L, theme = 'light') {
  const K = kit(theme), spec = SPEC[kind] || SPEC.cable;
  if (K.flat) return once('flat:' + kind, () => new THREE.MeshLambertMaterial({ color: spec.flat }));
  const base = kind === 'insul' ? K.insul : kind === 'drain' ? K.drain : K.cable;
  const t = once('print:' + kind, () => { const tx = printTex(spec.bg, spec.ink, spec.text, spec.key, { per: spec.per, band: spec.band, stripe: spec.stripe }); return tx; }).clone();
  t.needsUpdate = true; t.repeat.set(Math.max(1, L / spec.per), 1);
  const m = base.clone(); m.map = t; m.color = new THREE.Color(0xffffff); if (kind.startsWith('thw')) { m.roughness = 0.42; } return m;
}

/** tube along a curve with printed material */
export function tube(curve, r, kind, theme, seg = 200) {
  const L = curve.getLength();
  const mat = kind === 'copper' ? kit(theme).copper : printed(kind, L, theme);
  const m = new THREE.Mesh(new THREE.TubeGeometry(curve, Math.max(24, Math.round(seg * Math.min(1, L / 3) + 24)), r, 20, false), mat); m.castShadow = true; m.receiveShadow = true; return m;
}

/** O-TWO copper cut-end showing the 0.70 mm wall: ring + label geometry helper */
export const COPPER = { wall: 0.0007, sizes: { '1/4"': 0.00635, '3/8"': 0.00952, '1/2"': 0.0127, '5/8"': 0.01588 } };
