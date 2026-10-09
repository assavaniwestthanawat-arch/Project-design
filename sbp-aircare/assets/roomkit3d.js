// SBP AirCare — interior kit for the cut-away scenes (Rev.08): procedural textures (oak planks, painted plaster,
// fabric weave, rug, concrete, tiles) and furniture with rounded forms (sofa + cushions, coffee table, TV console,
// dining set, lamp, plant, shelf, bed, curtains, window with daylight, wall art). Pure three.js, no image files.
import * as THREE from './three.module.min.js';

const R = (s => () => (s = (s * 16807) % 2147483647) / 2147483647)(1234567);
export function ctex(w, h, draw, srgb = true, rep = null) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); }
  return t;
}
const noise = (g, w, h, a, n = 2600, c = '0,0,0') => { for (let i = 0; i < n; i++) { g.fillStyle = `rgba(${c},${(R() * a).toFixed(3)})`; g.fillRect(R() * w, R() * h, 1 + R() * 2, 1 + R() * 2); } };

// ---- textures ----
export const TEX = {
  oak: (dark) => ctex(1024, 1024, (g, w, h) => {
    const base = dark ? [58, 44, 34] : [196, 160, 118];
    const rows = 8, pw = h / rows;
    for (let r = 0; r < rows; r++) {
      let x = -((r * 173) % 260);
      while (x < w) {
        const L = 300 + R() * 260, tone = (R() - 0.5) * 26;
        const c = base.map(v => Math.round(v + tone));
        g.fillStyle = `rgb(${c})`; g.fillRect(x, r * pw, L, pw);
        // grain
        for (let k = 0; k < 26; k++) { g.strokeStyle = `rgba(${dark ? '20,14,10' : '120,86,52'},${0.05 + R() * 0.1})`; g.lineWidth = 0.6 + R() * 1.4; const y = r * pw + R() * pw; g.beginPath(); g.moveTo(x, y); g.bezierCurveTo(x + L * 0.3, y + (R() - 0.5) * 6, x + L * 0.7, y + (R() - 0.5) * 6, x + L, y + (R() - 0.5) * 4); g.stroke(); }
        if (R() < 0.35) { g.fillStyle = `rgba(${dark ? '15,10,8' : '110,76,44'},0.18)`; g.beginPath(); g.ellipse(x + R() * L, r * pw + pw / 2, 7 + R() * 7, 3 + R() * 2, 0, 0, 7); g.fill(); }
        g.fillStyle = `rgba(0,0,0,${dark ? 0.5 : 0.28})`; g.fillRect(x, r * pw, 2, pw);
        x += L;
      }
      g.fillStyle = `rgba(0,0,0,${dark ? 0.55 : 0.3})`; g.fillRect(0, r * pw, w, 2);
    }
  }),
  plaster: (col = '#efebe4') => ctex(512, 512, (g, w, h) => { g.fillStyle = col; g.fillRect(0, 0, w, h); noise(g, w, h, 0.035, 5000); noise(g, w, h, 0.03, 3000, '255,255,255'); }),
  fabric: (col) => ctex(256, 256, (g, w, h) => { g.fillStyle = col; g.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 3) { g.fillStyle = `rgba(0,0,0,${0.04 + R() * 0.04})`; g.fillRect(0, y, w, 1); } for (let x = 0; x < w; x += 3) { g.fillStyle = `rgba(255,255,255,${0.03 + R() * 0.03})`; g.fillRect(x, 0, 1, h); } noise(g, w, h, 0.05, 1200); }, true, [3, 3]),
  rug: (a = '#d9cfc0', b = '#8e9aa6') => ctex(512, 512, (g, w, h) => { g.fillStyle = a; g.fillRect(0, 0, w, h); g.strokeStyle = b; g.lineWidth = 14; g.strokeRect(26, 26, w - 52, h - 52); g.lineWidth = 3; g.strokeRect(52, 52, w - 104, h - 104); for (let i = 0; i < 7; i++) { g.strokeStyle = `rgba(0,0,0,0.05)`; g.beginPath(); g.moveTo(80, 90 + i * 55); g.bezierCurveTo(200, 60 + i * 55, 320, 120 + i * 55, 430, 90 + i * 55); g.stroke(); } noise(g, w, h, 0.07, 9000); }),
  concrete: () => ctex(512, 512, (g, w, h) => { g.fillStyle = '#b9bcbd'; g.fillRect(0, 0, w, h); noise(g, w, h, 0.08, 9000); noise(g, w, h, 0.06, 4000, '255,255,255'); g.strokeStyle = 'rgba(0,0,0,.12)'; g.lineWidth = 2; g.strokeRect(0, 0, w, h); }, true, [2, 2]),
  tile: (col = '#e9e7e2') => ctex(512, 512, (g, w, h) => { g.fillStyle = col; g.fillRect(0, 0, w, h); noise(g, w, h, 0.03, 3000); g.strokeStyle = 'rgba(120,120,120,.35)'; g.lineWidth = 3; for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * w / 4, 0); g.lineTo(i * w / 4, h); g.stroke(); g.beginPath(); g.moveTo(0, i * h / 4); g.lineTo(w, i * h / 4); g.stroke(); } }),
  sky: () => ctex(256, 256, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#8fc4ea'); gr.addColorStop(0.62, '#d9ecf7'); gr.addColorStop(0.64, '#9fb39a'); gr.addColorStop(1, '#6f8a6a'); g.fillStyle = gr; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(255,255,255,.7)'; [[50, 60, 38], [150, 40, 26], [200, 80, 30]].forEach(([x, y, r]) => { g.beginPath(); g.ellipse(x, y, r, r * 0.4, 0, 0, 7); g.fill(); }); g.fillStyle = 'rgba(80,96,110,.55)'; [[20, 150, 30, 14], [70, 130, 26, 34], [120, 142, 40, 22], [180, 120, 22, 44], [215, 138, 30, 26]].forEach(([x, y, ww, hh]) => g.fillRect(x, y, ww, hh)); }),
  art: (hue) => ctex(256, 320, (g, w, h) => { g.fillStyle = '#f6f3ee'; g.fillRect(0, 0, w, h); const c = [`hsl(${hue},35%,62%)`, `hsl(${hue + 30},30%,48%)`, `hsl(${hue - 20},25%,75%)`]; g.fillStyle = c[0]; g.beginPath(); g.arc(w * 0.38, h * 0.42, 70, 0, 7); g.fill(); g.fillStyle = c[1]; g.fillRect(w * 0.45, h * 0.5, 90, 110); g.fillStyle = c[2]; g.beginPath(); g.moveTo(30, h - 40); g.lineTo(w - 30, h - 40); g.lineTo(w * 0.6, h * 0.2); g.closePath(); g.globalAlpha = 0.45; g.fill(); }),
};

export function mats(theme = 'light') {
  const dark = theme === 'dark';
  const S = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8, ...o });
  const oakT = TEX.oak(dark); oakT.wrapS = oakT.wrapT = THREE.RepeatWrapping;
  return {
    dark,
    floor: S(0xffffff, { map: oakT, roughness: 0.55, metalness: 0 }), floorT: oakT,
    wall: S(dark ? 0x3a414b : 0xffffff, { map: dark ? null : TEX.plaster(), roughness: 0.95 }),
    wallAlt: S(dark ? 0x2f353e : 0xdcd6cc, { roughness: 0.95 }),
    ceiling: S(dark ? 0x3a4049 : 0xfbfaf8, { roughness: 1 }),
    base: S(dark ? 0x242a31 : 0xf5f3ef, { roughness: 0.6 }),
    sofa: S(0xffffff, { map: TEX.fabric(dark ? '#4c5563' : '#8d9aa8'), roughness: 0.95 }),
    cushion: S(0xffffff, { map: TEX.fabric(dark ? '#8c7a5e' : '#d8c8a8'), roughness: 0.95 }),
    wood: S(dark ? 0x5a4636 : 0x9b7653, { roughness: 0.55 }), woodL: S(dark ? 0x6d5846 : 0xc9a57c, { roughness: 0.5 }),
    black: S(0x16181b, { roughness: 0.35, metalness: 0.2 }), metal: S(0xb9c0c8, { roughness: 0.3, metalness: 0.85 }), brass: S(0xc9a44c, { roughness: 0.3, metalness: 0.9 }),
    white: S(0xf3f3f1, { roughness: 0.45 }), screen: new THREE.MeshStandardMaterial({ color: 0x0c1016, roughness: 0.15, metalness: 0.3, emissive: 0x0a1a2a, emissiveIntensity: 0.4 }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0xdfefff, roughness: 0.05, metalness: 0, transmission: 0.0, transparent: true, opacity: 0.22, depthWrite: false }),
    frame: S(dark ? 0x5c6773 : 0x8f98a2, { roughness: 0.35, metalness: 0.6 }),
    curtain: S(0xffffff, { map: TEX.fabric(dark ? '#6b6a64' : '#eee6d8'), roughness: 1, side: THREE.DoubleSide }),
    rug: S(0xffffff, { map: TEX.rug(dark ? '#4a4540' : '#dbd2c3', dark ? '#7e8a96' : '#8e9aa6'), roughness: 1 }),
    leaf: S(dark ? 0x3f7a4c : 0x4f8f5c, { roughness: 0.7, side: THREE.DoubleSide }), pot: S(dark ? 0xc9c2b8 : 0xe9e4dc, { roughness: 0.6 }),
    concrete: S(0xffffff, { map: TEX.concrete(), roughness: 0.9 }), tile: S(0xffffff, { map: TEX.tile(), roughness: 0.4 }),
    sky: new THREE.MeshBasicMaterial({ map: TEX.sky() }),
    lampShade: new THREE.MeshStandardMaterial({ color: 0xfff3dc, emissive: 0xffd9a0, emissiveIntensity: dark ? 0.9 : 0.35, roughness: 0.9, side: THREE.DoubleSide }),
    bedding: S(0xffffff, { map: TEX.fabric(dark ? '#9aa3ad' : '#f3f1ec'), roughness: 1 }), throwBlanket: S(0xffffff, { map: TEX.fabric(dark ? '#7c5f55' : '#b88a74'), roughness: 1 }),
  };
}

// rounded box helper
const RB = new Map();
export function rbox(w, h, d, r, mat, x = 0, y = 0, z = 0, seg = 3) {
  r = Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001);
  const key = [w, h, d, r, seg].map(v => v.toFixed(4)).join();
  let g = RB.get(key);
  if (!g) {
    // inner outline (w-2r)×(h-2r); the bevel pushes it out by r on every side → outer size w×h×d with rounded edges
    const iw = w / 2 - r, ih = h / 2 - r, c = Math.min(iw, ih) * 0.35;
    const s = new THREE.Shape(); s.moveTo(-iw + c, -ih); s.lineTo(iw - c, -ih); s.quadraticCurveTo(iw, -ih, iw, -ih + c); s.lineTo(iw, ih - c); s.quadraticCurveTo(iw, ih, iw - c, ih); s.lineTo(-iw + c, ih); s.quadraticCurveTo(-iw, ih, -iw, ih - c); s.lineTo(-iw, -ih + c); s.quadraticCurveTo(-iw, -ih, -iw + c, -ih);
    g = new THREE.ExtrudeGeometry(s, { depth: Math.max(0.001, d - 2 * r), bevelEnabled: true, bevelThickness: r, bevelSize: r, bevelSegments: seg, curveSegments: 4 });
    g.translate(0, 0, -(d - 2 * r) / 2); RB.set(key, g);
    const m = new THREE.Mesh(g, mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; return m;
  }
  const m = new THREE.Mesh(g, mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; return m;
}
const bx = (w, h, d, mat, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; return m; };
const cy = (r1, r2, h, mat, x, y, z, seg = 24) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, seg), mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; return m; };

// ---- furniture (each returns a Group positioned at (x, 0, z) facing +z unless rotated) ----
export const F = {
  sofa(K, len = 2.1) { const g = new THREE.Group(); g.add(rbox(len, 0.42, 0.92, 0.06, K.sofa, 0, 0.23, 0)); g.add(rbox(len, 0.5, 0.2, 0.07, K.sofa, 0, 0.62, -0.36)); [-1, 1].forEach(s => g.add(rbox(0.2, 0.6, 0.92, 0.07, K.sofa, s * (len / 2 - 0.1), 0.34, 0)));
    const n = Math.max(2, Math.round((len - 0.4) / 0.62)); for (let i = 0; i < n; i++) { const x = -len / 2 + 0.2 + (i + 0.5) * (len - 0.4) / n; g.add(rbox((len - 0.4) / n - 0.02, 0.14, 0.62, 0.05, K.sofa, x, 0.5, 0.05)); g.add(rbox((len - 0.4) / n - 0.06, 0.4, 0.14, 0.06, K.sofa, x, 0.74, -0.2)); }
    g.add(rbox(0.42, 0.36, 0.12, 0.05, K.cushion, -len / 2 + 0.45, 0.72, -0.12)); g.add(rbox(0.4, 0.34, 0.12, 0.05, K.cushion, len / 2 - 0.45, 0.72, -0.12)); [-1, 1].forEach(s => [-1, 1].forEach(t => g.add(cy(0.02, 0.015, 0.06, K.black, s * (len / 2 - 0.12), 0.03, t * 0.36, 8)))); return g; },
  coffee(K) { const g = new THREE.Group(); g.add(rbox(1.1, 0.05, 0.6, 0.02, K.woodL, 0, 0.42, 0)); g.add(bx(1.0, 0.02, 0.5, K.wood, 0, 0.14, 0)); [[-0.5, -0.25], [0.5, -0.25], [-0.5, 0.25], [0.5, 0.25]].forEach(([x, z]) => g.add(cy(0.02, 0.02, 0.42, K.black, x, 0.21, z, 8))); g.add(cy(0.07, 0.05, 0.12, K.pot, 0.25, 0.51, 0)); g.add(bx(0.24, 0.03, 0.17, K.cushion, -0.25, 0.46, 0.05)); return g; },
  tv(K, w = 1.6) { const g = new THREE.Group(); g.add(rbox(w + 0.2, 0.46, 0.42, 0.02, K.woodL, 0, 0.26, 0)); g.add(bx(w + 0.16, 0.02, 0.4, K.wood, 0, 0.06, 0)); [-1, 1].forEach(s => g.add(bx(0.005, 0.3, 0.005, K.black, s * 0.3, 0.27, 0.212)));
    g.add(bx(w, w * 0.57, 0.035, K.black, 0, 0.55 + w * 0.3, -0.12)); g.add(bx(w - 0.03, w * 0.57 - 0.03, 0.002, K.screen, 0, 0.55 + w * 0.3, -0.101)); g.add(bx(0.3, 0.02, 0.18, K.black, 0, 0.5, -0.1)); return g; },
  dining(K) { const g = new THREE.Group(); g.add(rbox(1.5, 0.045, 0.85, 0.015, K.woodL, 0, 0.74, 0)); [[-0.66, -0.34], [0.66, -0.34], [-0.66, 0.34], [0.66, 0.34]].forEach(([x, z]) => g.add(bx(0.05, 0.72, 0.05, K.wood, x, 0.36, z)));
    const chair = (x, z, ry) => { const c = new THREE.Group(); c.add(rbox(0.44, 0.05, 0.44, 0.02, K.woodL, 0, 0.46, 0)); c.add(rbox(0.44, 0.42, 0.04, 0.015, K.woodL, 0, 0.72, -0.2)); [[-0.19, -0.19], [0.19, -0.19], [-0.19, 0.19], [0.19, 0.19]].forEach(([a, b]) => c.add(bx(0.03, 0.46, 0.03, K.wood, a, 0.23, b))); c.position.set(x, 0, z); c.rotation.y = ry; g.add(c); };
    chair(-0.38, -0.62, 0); chair(0.38, -0.62, 0); chair(-0.38, 0.62, Math.PI); chair(0.38, 0.62, Math.PI);
    g.add(cy(0.05, 0.04, 0.2, K.glass, 0, 0.87, 0)); g.add(bx(0.4, 0.01, 0.28, K.cushion, -0.4, 0.768, 0.1)); return g; },
  lamp(K) { const g = new THREE.Group(); g.add(cy(0.14, 0.16, 0.03, K.black, 0, 0.015, 0)); g.add(cy(0.012, 0.012, 1.45, K.black, 0, 0.74, 0, 8)); g.add(cy(0.13, 0.2, 0.28, K.lampShade, 0, 1.52, 0, 28)); const l = new THREE.PointLight(0xffd8a0, K.dark ? 1.6 : 0.6, 4, 2); l.position.set(0, 1.45, 0); g.add(l); return g; },
  plant(K, s = 1) { const g = new THREE.Group(); g.add(cy(0.17 * s, 0.13 * s, 0.36 * s, K.pot, 0, 0.18 * s, 0)); const leafG = new THREE.PlaneGeometry(0.1 * s, 0.34 * s); leafG.translate(0, 0.17 * s, 0);
    for (let i = 0; i < 22; i++) { const l = new THREE.Mesh(leafG, K.leaf); const a = i * 2.4, tilt = 0.35 + (i % 5) * 0.12; l.position.set(0, 0.34 * s + (i % 4) * 0.06 * s, 0); l.rotation.set(tilt * Math.cos(a), a, tilt * Math.sin(a)); l.castShadow = true; g.add(l); } return g; },
  shelf(K, w = 1.0, h = 1.8) { const g = new THREE.Group(); g.add(bx(w, h, 0.34, K.woodL, 0, h / 2, 0)); const cols = [0x8a4b3e, 0x3e5c8a, 0xc9a24a, 0x2f6d5a, 0xe6e1d6, 0x55606c]; const lv = Math.floor(h / 0.38);
    for (let l = 0; l < lv; l++) { g.add(bx(w - 0.04, 0.3, 0.3, K.wood, 0, 0.19 + l * 0.38, 0.03)); for (let i = 0; i < 9; i++) if ((i * 7 + l * 3) % 5) g.add(bx(0.06 + (i % 3) * 0.01, 0.22 + (i % 4) * 0.015, 0.22, new THREE.MeshStandardMaterial({ color: cols[(i + l) % 6], roughness: 0.8 }), -w / 2 + 0.1 + i * (w - 0.2) / 9, 0.16 + l * 0.38, 0.06)); } return g; },
  bed(K, w = 1.6, l = 2.0) { const g = new THREE.Group(); g.add(rbox(w + 0.1, 0.32, l + 0.08, 0.03, K.wood, 0, 0.16, 0)); g.add(rbox(w, 0.22, l, 0.06, K.bedding, 0, 0.42, 0)); g.add(rbox(w + 0.04, 0.05, l * 0.55, 0.02, K.throwBlanket, 0, 0.55, l * 0.18)); g.add(rbox(w + 0.12, 1.0, 0.08, 0.03, K.sofa, 0, 0.5, -l / 2 - 0.02)); [-1, 1].forEach(s => g.add(rbox(w * 0.4, 0.14, 0.36, 0.06, K.bedding, s * w * 0.22, 0.6, -l / 2 + 0.3))); return g; },
  curtain(K, w, h) { const g = new THREE.Group(); const geo = new THREE.PlaneGeometry(w, h, 40, 1); const p = geo.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) / w * Math.PI * 14) * 0.035); geo.computeVertexNormals(); const m = new THREE.Mesh(geo, K.curtain); m.position.y = h / 2; m.castShadow = m.receiveShadow = true; g.add(m); const rod = cy(0.012, 0.012, w + 0.3, K.metal, 0, h + 0.03, 0.02, 8); rod.rotation.z = Math.PI / 2; g.add(rod); return g; },   // Rev.09 r3: rotate the rod, not the whole curtain (it used to lie on its side)
  rug(K, w, d) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.012, d), K.rug); m.position.y = 0.006; m.receiveShadow = true; return m; },
  art(K, hue = 200) { const g = new THREE.Group(); g.add(bx(0.62, 0.78, 0.03, K.black, 0, 0, 0)); const p = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.72), new THREE.MeshStandardMaterial({ map: TEX.art(hue), roughness: 0.9 })); p.position.z = 0.016; g.add(p); return g; },
};

// ---- Rev.09 round 3: more pieces for the room planner ("ลองวางแอร์ในห้องของคุณ"). Same convention: origin on the floor
// at the footprint centre, back toward local −z, front toward +z. Sizes are typical Thai furniture (cm in comments).
const S2 = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7, ...o });
Object.assign(F, {
  // wardrobe 120×60×200: two hinged doors with a shadow gap, bar handles, plinth
  wardrobe(K, w = 1.2, d = 0.6, h = 2.0) { const g = new THREE.Group(); g.add(rbox(w, h - 0.06, d, 0.012, K.woodL, 0, 0.06 + (h - 0.06) / 2, 0)); g.add(bx(w - 0.04, 0.06, d - 0.06, K.wood, 0, 0.03, -0.01));
    g.add(bx(0.006, h - 0.12, 0.004, K.wood, 0, 0.06 + (h - 0.06) / 2, d / 2 + 0.001)); [-1, 1].forEach(s => g.add(cy(0.008, 0.008, 0.32, K.metal, s * 0.05, 1.05, d / 2 + 0.025, 10))); return g; },
  // bedside table 45×40×55 with a drawer and a small lamp
  side(K) { const g = new THREE.Group(); g.add(rbox(0.45, 0.5, 0.4, 0.015, K.woodL, 0, 0.3, 0)); g.add(bx(0.4, 0.004, 0.004, K.wood, 0, 0.42, 0.201)); { const k = cy(0.006, 0.006, 0.08, K.metal, 0, 0.47, 0.205, 8); k.rotation.z = Math.PI / 2; g.add(k); }
    [[-0.19, -0.16], [0.19, -0.16], [-0.19, 0.16], [0.19, 0.16]].forEach(([x, z]) => g.add(cy(0.015, 0.012, 0.05, K.wood, x, 0.025, z, 8))); g.add(cy(0.06, 0.07, 0.03, K.black, 0.08, 0.565, -0.05)); g.add(cy(0.008, 0.008, 0.2, K.black, 0.08, 0.68, -0.05, 8)); g.add(cy(0.07, 0.1, 0.12, K.lampShade, 0.08, 0.8, -0.05, 20)); return g; },
  armchair(K) { const g = new THREE.Group(); g.add(rbox(0.82, 0.4, 0.82, 0.06, K.sofa, 0, 0.22, 0)); g.add(rbox(0.82, 0.48, 0.18, 0.07, K.sofa, 0, 0.6, -0.32)); [-1, 1].forEach(s => g.add(rbox(0.16, 0.56, 0.82, 0.06, K.sofa, s * 0.33, 0.32, 0)));
    g.add(rbox(0.5, 0.13, 0.56, 0.05, K.sofa, 0, 0.47, 0.06)); g.add(rbox(0.38, 0.32, 0.12, 0.05, K.cushion, 0, 0.66, -0.18)); [-1, 1].forEach(s => [-1, 1].forEach(t => g.add(cy(0.018, 0.014, 0.06, K.black, s * 0.33, 0.03, t * 0.33, 8)))); return g; },
  // work desk 120×60 against the wall (−z) + office chair in front (+z)
  desk(K) { const g = new THREE.Group(); g.add(rbox(1.2, 0.03, 0.6, 0.008, K.woodL, 0, 0.74, -0.3)); [-1, 1].forEach(s => g.add(bx(0.04, 0.72, 0.56, K.black, s * 0.56, 0.36, -0.3))); g.add(bx(0.4, 0.14, 0.5, K.wood, 0.36, 0.64, -0.31));
    g.add(bx(0.55, 0.33, 0.02, K.black, -0.1, 0.99, -0.5)); g.add(bx(0.53, 0.31, 0.002, K.screen, -0.1, 0.99, -0.489)); g.add(bx(0.04, 0.18, 0.04, K.black, -0.1, 0.84, -0.52)); g.add(bx(0.4, 0.015, 0.14, K.white, -0.1, 0.762, -0.22));
    const ch = F.officeChair(K); ch.position.set(-0.05, 0, 0.28); ch.rotation.y = Math.PI; g.add(ch); return g; },
  officeChair(K) { const g = new THREE.Group(); for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; const leg = bx(0.03, 0.025, 0.3, K.black, Math.sin(a) * 0.14, 0.06, Math.cos(a) * 0.14); leg.rotation.y = a; g.add(leg); g.add(cy(0.022, 0.022, 0.03, K.black, Math.sin(a) * 0.28, 0.025, Math.cos(a) * 0.28, 8)); }
    g.add(cy(0.025, 0.025, 0.32, K.metal, 0, 0.24, 0, 10)); g.add(rbox(0.48, 0.08, 0.46, 0.03, K.sofa, 0, 0.45, 0)); g.add(rbox(0.44, 0.5, 0.06, 0.03, K.sofa, 0, 0.78, -0.22)); [-1, 1].forEach(s => g.add(bx(0.04, 0.03, 0.26, K.black, s * 0.25, 0.62, 0))); return g; },
  fridge(K, w = 0.7, d = 0.7, h = 1.8) { const g = new THREE.Group(); const m = S2(K.dark ? 0x9ea6ae : 0xd9dde1, { roughness: 0.25, metalness: 0.6 });
    g.add(rbox(w, h, d, 0.03, m, 0, h / 2, 0)); g.add(bx(w - 0.02, 0.006, 0.004, K.black, 0, h * 0.64, d / 2 + 0.001)); [h * 0.8, h * 0.4].forEach(y => g.add(bx(0.022, 0.32, 0.03, K.metal, w / 2 - 0.08, y, d / 2 + 0.02))); return g; },
  // meeting table 240×110 with 8 chairs (footprint 240×220)
  meeting(K, w = 2.4, d = 1.1) { const g = new THREE.Group(); g.add(rbox(w, 0.04, d, 0.02, K.woodL, 0, 0.74, 0)); [-1, 1].forEach(s => g.add(bx(0.08, 0.7, d * 0.6, K.black, s * (w / 2 - 0.35), 0.36, 0)));
    const n = Math.max(2, Math.round((w - 0.6) / 0.6) + 1);   // r7: chairs every ~60 cm (2.4 m → 4 a side, 3.6 m → 6 a side)
    for (let i = 0; i < n; i++) [-1, 1].forEach(s => { const c = F.officeChair(K); c.position.set(-w / 2 + 0.3 + i * (w - 0.6) / (n - 1), 0, s * (d / 2 + 0.24)); c.rotation.y = s > 0 ? Math.PI : 0; g.add(c); }); return g; },
  // 4-person workstation 240×200: two desk pairs back to back, a screen divider, chairs
  work4(K) { const g = new THREE.Group(); const div = S2(K.dark ? 0x4a5563 : 0x9fb0bf, { roughness: 0.95 });
    [-1, 1].forEach(sx => [-1, 1].forEach(sz => { g.add(rbox(1.18, 0.03, 0.7, 0.008, K.woodL, sx * 0.6, 0.74, sz * 0.36)); g.add(bx(0.03, 0.72, 0.66, K.black, sx * 1.16, 0.36, sz * 0.36));
      g.add(bx(0.5, 0.3, 0.02, K.black, sx * 0.6, 0.98, sz * 0.16)); const c = F.officeChair(K); c.position.set(sx * 0.6, 0, sz * 0.92); c.rotation.y = sz > 0 ? Math.PI : 0; g.add(c); }));
    g.add(bx(2.36, 0.42, 0.03, div, 0, 0.96, 0)); return g; },
  counter(K, w = 1.6, d = 0.6) { const g = new THREE.Group(); g.add(rbox(w, 1.0, d, 0.015, K.white, 0, 0.5, 0)); g.add(rbox(w + 0.06, 0.04, d + 0.04, 0.01, K.woodL, 0, 1.02, 0)); g.add(bx(w - 0.1, 0.06, 0.006, K.wood, 0, 0.12, d / 2 + 0.003));
    g.add(bx(0.32, 0.24, 0.02, K.black, -w / 2 + 0.3, 1.18, -0.1)); return g; },
  // shop rack 180×50×180 with stocked shelves
  rack(K, w = 1.8, d = 0.5, h = 1.8) { const g = new THREE.Group(); const cols = [0xd95b43, 0x3e7cb1, 0xf0c05a, 0x5aa36b, 0xe8e3d8, 0x8a5fb0];
    [-1, 1].forEach(s => g.add(bx(0.04, h, d, K.metal, s * (w / 2 - 0.02), h / 2, 0))); g.add(bx(w, h, 0.02, K.white, 0, h / 2, -d / 2 + 0.01));
    for (let l = 0; l < 4; l++) { const y = 0.1 + l * (h - 0.2) / 3.4; g.add(bx(w - 0.04, 0.025, d, K.white, 0, y, 0)); for (let i = 0; i < 8; i++) if ((i + l) % 4) g.add(bx(0.15, 0.18 + ((i * 3 + l) % 3) * 0.05, d * 0.7, new THREE.MeshStandardMaterial({ color: cols[(i + l * 2) % 6], roughness: 0.6 }), -w / 2 + 0.16 + i * (w - 0.3) / 7.4, y + 0.11, 0.02)); } return g; },
  // door leaf in a frame on a wall facing +z (origin at the floor, centred on the opening)
  door(K, w = 0.9, h = 2.05) { const g = new THREE.Group(); const t = 0.05;
    [[t, h + t, -w / 2 - t / 2, (h + t) / 2], [t, h + t, w / 2 + t / 2, (h + t) / 2], [w + 2 * t, t, 0, h + t / 2]].forEach(([a, b, x, y]) => g.add(bx(a, b, 0.08, K.white, x, y, 0)));
    g.add(rbox(w - 0.01, h - 0.01, 0.04, 0.006, K.woodL, 0, h / 2, 0.005)); g.add(bx(w - 0.24, h * 0.36, 0.006, K.wood, 0, h * 0.7, 0.027)); g.add(bx(w - 0.24, h * 0.36, 0.006, K.wood, 0, h * 0.28, 0.027));
    const hd = cy(0.01, 0.01, 0.13, K.metal, w / 2 - 0.1, 1.0, 0.06, 10); hd.rotation.z = Math.PI / 2; const ro = cy(0.03, 0.03, 0.012, K.metal, w / 2 - 0.06, 1.0, 0.03, 16); ro.rotation.x = Math.PI / 2; g.add(hd, ro); return g; },
});

/** window (opening with frame, glass, sky behind) on a wall facing +z; returns group sized w×h, sill at y0 */
export function windowUnit(K, w, h) {
  const g = new THREE.Group();
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(w, h), K.sky); sky.position.z = -0.08; g.add(sky);
  const t = 0.05; [[w + t * 2, t, 0, h / 2 + t / 2], [w + t * 2, t, 0, -h / 2 - t / 2], [t, h, -w / 2 - t / 2, 0], [t, h, w / 2 + t / 2, 0], [t * 0.6, h, 0, 0]].forEach(([a, b, x, y]) => g.add(bx(a, b, 0.07, K.frame, x, y, 0)));
  const gl = new THREE.Mesh(new THREE.PlaneGeometry(w, h), K.glass); gl.position.z = 0.01; g.add(gl);
  g.add(bx(w + 0.2, 0.04, 0.16, K.white, 0, -h / 2 - 0.07, 0.06));
  return g;
}
