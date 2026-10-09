// SBP AirCare — the company's own marks inside the 3D scenes (Rev.09 round 4, owner 1 ต.ค. 2569:
// "เสื่อมีตรา FUJIVA … โปรโมท FUJIVA และ บริษัท สหบูรพากรุ๊ป จำกัด แบบ subliminal ไม่ดูชวนขายเกิน ในหลายรูปและสถานที่").
// FUJIVA = the company's AC brand · SBP AirCare / บริษัท สหบูรพากรุ๊ป จำกัด = the service company. Marks are small and
// placed where a real crew would carry them (work mat, uniform, tool box, cleaning bag, tablet, remote) — never on the
// customer's air conditioner (any brand). Official artwork, when supplied (assets/logos/fujiva.png, sbp.png → build →
// globalThis.__SBP_LOGOS), replaces the text wordmarks automatically.
import * as THREE from './three.module.min.js';
import { logoSrc } from './sbp-core.js';

const cache = new Map();
// one Image per logo (build: data URI · dev server: assets/logos/<key>.png); a missing file falls back to the text wordmark
const imgs = {};
const logo = key => { if (!imgs[key]) { const im = new Image(); im.src = logoSrc(key); imgs[key] = im; } const im = imgs[key]; return !im.complete || im.naturalWidth ? im : null; };
function tex(key, w, h, draw) {
  if (cache.has(key)) return cache.get(key);
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); draw(g, w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; cache.set(key, t);
  // official artwork arrives asynchronously: redraw once it has loaded
  ['fujiva', 'sbp'].forEach(k => { const im = logo(k); if (im && !im.complete) im.addEventListener('load', () => { g.clearRect(0, 0, w, h); draw(g, w, h); t.needsUpdate = true; }, { once: true }); });
  return t;
}
const TH = '"Anuphan","IBM Plex Sans Thai","Kanit",system-ui,sans-serif';
// FUJIVA wordmark (letter-spaced caps) — or the official logo image
// Rev.09 r9: the owner supplied the official FUJIVA and company (SP "QUALITY BRAND") logos — drawn as-is (colours untouched);
// on dark surfaces the FUJIVA logo sits on a small light plate so its blue lettering stays legible.
function plate(g, x, y, w, hh, r) { g.save(); g.fillStyle = 'rgba(248,250,253,.96)'; g.beginPath(); if (g.roundRect) g.roundRect(x, y, w, hh, r); else g.rect(x, y, w, hh); g.fill(); g.restore(); }
const isLight = c => { const m = /^#?([0-9a-f]{6})$/i.exec(c || ''); if (!m) return true; const n = parseInt(m[1], 16); return ((n >> 16) * 0.3 + ((n >> 8) & 255) * 0.59 + (n & 255) * 0.11) > 150; };
export function drawFujiva(g, cx, cy, size, color = '#fff') {
  const im = logo('fujiva');
  if (im && im.complete && im.naturalWidth) {
    const w = size * 4.2, hh = w * im.naturalHeight / im.naturalWidth;
    if (isLight(color)) plate(g, cx - w / 2 - size * 0.18, cy - hh / 2 - size * 0.12, w + size * 0.36, hh + size * 0.24, size * 0.18);   // light ink requested = dark surface
    g.drawImage(im, cx - w / 2, cy - hh / 2, w, hh); return;
  }
  g.save(); g.fillStyle = color; g.font = `600 ${size}px "Kanit",system-ui,sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
  if ('letterSpacing' in g) { g.letterSpacing = `${size * 0.32}px`; g.fillText('FUJIVA', cx + size * 0.16, cy); } else g.fillText('F U J I V A', cx, cy);
  g.restore();
}
export function drawSbp(g, cx, cy, size, color = '#fff', accent = '#EF4E2E', withCo = true) {
  const im = logo('sbp');
  if (im && im.complete && im.naturalWidth) {
    // company mark + "SBP AirCare" side by side (the mark itself carries no service name)
    const mh = size * 1.25, mw = mh * im.naturalWidth / im.naturalHeight, gap = size * 0.28;
    g.save(); g.font = `600 ${size * 0.8}px ${TH}`; const tw = g.measureText('SBP AirCare').width;
    const x0 = cx - (mw + gap + tw) / 2, yM = withCo ? cy - size * 0.12 : cy;
    g.drawImage(im, x0, yM - mh / 2, mw, mh);
    g.fillStyle = color; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText('SBP AirCare', x0 + mw + gap, yM - (withCo ? size * 0.16 : 0));
    if (withCo) { g.globalAlpha *= 0.85; g.font = `400 ${size * 0.4}px ${TH}`; g.fillText('บริษัท สหบูรพากรุ๊ป จำกัด', x0 + mw + gap, yM + size * 0.42); }
    g.restore(); return;
  }
  g.save(); g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `700 ${size}px ${TH}`; const w1 = g.measureText('SBP').width; g.font = `500 ${size}px ${TH}`; const w2 = g.measureText(' AirCare').width;
  const x0 = cx - (w1 + w2) / 2; g.textAlign = 'left';
  g.fillStyle = accent; g.font = `700 ${size}px ${TH}`; g.fillText('SBP', x0, cy);
  g.fillStyle = color; g.font = `500 ${size}px ${TH}`; g.fillText(' AirCare', x0 + w1, cy);
  if (withCo) { g.textAlign = 'center'; g.globalAlpha = 0.85; g.font = `400 ${size * 0.42}px ${TH}`; g.fillText('บริษัท สหบูรพากรุ๊ป จำกัด', cx, cy + size * 0.78); }
  g.restore();
}

/** work mat (rubber, charcoal-blue) with the FUJIVA mark and a small company line */
export const matTex = (dark = false) => tex('mat' + dark, 1024, 640, (g, w, h) => {
  g.fillStyle = dark ? '#1c2836' : '#2a3a4e'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 2600; i++) { g.fillStyle = `rgba(255,255,255,${Math.random() * 0.035})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
  g.strokeStyle = 'rgba(255,255,255,.18)'; g.lineWidth = 6; g.strokeRect(22, 22, w - 44, h - 44);
  g.strokeStyle = 'rgba(241,90,43,.6)'; g.lineWidth = 3; g.strokeRect(40, 40, w - 80, h - 80);
  g.globalAlpha = 0.86; drawFujiva(g, w / 2, h * 0.47, 92, '#f4f6f8'); g.globalAlpha = 1;
  g.globalAlpha = 0.6; drawSbp(g, w - 210, h - 92, 30, '#e7edf3', '#F15A2B'); g.globalAlpha = 1;
});
/** uniform: chest patch + back print */
export const chestTex = () => tex('chest', 256, 128, (g, w, h) => { g.clearRect(0, 0, w, h); g.fillStyle = 'rgba(255,255,255,0)'; g.fillRect(0, 0, w, h); drawSbp(g, w / 2, h * 0.42, 40, '#ffffff', '#F15A2B', false); g.fillStyle = '#F15A2B'; g.fillRect(w * 0.18, h * 0.78, w * 0.64, 5); });
export const backTex = () => tex('back', 512, 256, (g, w, h) => { g.clearRect(0, 0, w, h); drawSbp(g, w / 2, h * 0.4, 64, '#ffffff', '#F15A2B', true); });
/** tool box lid / side, cleaning bag print, tablet back */
export const boxTex = () => tex('box', 512, 256, (g, w, h) => { g.fillStyle = '#EF4E2E'; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(0, h - 26, w, 26); drawSbp(g, w / 2, h * 0.42, 52, '#ffffff', '#1B51A4', true); });
export const bagTex = () => tex('bag', 512, 256, (g, w, h) => { g.clearRect(0, 0, w, h); g.globalAlpha = 0.75; drawFujiva(g, w / 2, h * 0.38, 54, '#1B51A4'); g.globalAlpha = 0.6; g.fillStyle = '#1B51A4'; g.font = `500 22px ${TH}`; g.textAlign = 'center'; g.fillText('SBP AirCare', w / 2, h * 0.72); g.globalAlpha = 1; });
export const cardTex = () => tex('card', 512, 320, (g, w, h) => { g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h); g.fillStyle = '#1B51A4'; g.fillRect(0, 0, w, 64); drawSbp(g, w / 2, 32, 30, '#ffffff', '#F15A2B', false); g.fillStyle = '#1f2a37'; g.font = `600 26px ${TH}`; g.textAlign = 'left'; g.fillText('รายงานงานบริการ', 28, 112); g.fillStyle = '#5b6878'; g.font = `400 20px ${TH}`; ['ข้อมูลเครื่อง', 'ภาพก่อน–หลัง', 'รายการตรวจ', 'ลงนามรับมอบ'].forEach((t, i) => { g.fillStyle = '#e8edf3'; g.fillRect(28, 140 + i * 42, w - 56, 30); g.fillStyle = '#5b6878'; g.fillText(t, 40, 162 + i * 42); }); });

/** flat textured plane helper */
export function decal(texture, w, h, o = {}) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: texture, transparent: true, roughness: o.rough ?? 0.8, depthWrite: o.depthWrite ?? false, polygonOffset: true, polygonOffsetFactor: -2 }));
  m.renderOrder = o.order ?? 2; return m;
}
