// SBP AirCare — physically-flavoured airflow for the room simulations (Rev.08).
// Each particle is a short streak (camera-facing ribbon) whose length follows its speed, so the jets read as moving air.
// Supply air leaves the unit at the louver angle (the swing sweeps up/down), slows with distance (entrainment drag),
// cold air sinks as it slows (buoyancy), ceiling-type jets cling to the ceiling first (Coanda), a jet that meets a wall
// turns and runs down it, air that reaches the floor spreads out as a cool layer, then warms up and drifts back to the
// unit's return grille. Heat sources (people, windows, appliances) send warm plumes up to the ceiling, where they join
// the return air. Colour = air temperature (same scale as the floor map). Temperatures are illustrative, not CFD.
// Rev.09 round 3 (owner: air must look natural, "not like splashing water"): each particle is drawn as a soft wisp —
// its last few positions joined into a tapering translucent streamline (wisp3d.js) — with gentle turbulence that grows
// as the jet slows, pale de-saturated colour, and motion shown at ~0.6× real speed so the room air reads as calm drift.
import { createWisps, createHaze, airTint, swirl } from './wisp3d.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const RAMP = [[0.05, 0.3, 0.95], [0.13, 0.55, 1.0], [0.3, 0.8, 1.0], [0.7, 0.92, 0.98], [0.98, 0.86, 0.55], [0.97, 0.56, 0.25], [0.86, 0.24, 0.18]];
export function tempColor(t, out) { // 13 °C deep blue … 34 °C red
  const k = clamp((t - 13) / 21, 0, 1) * (RAMP.length - 1), i = Math.min(RAMP.length - 2, Math.floor(k)), r = k - i;
  out[0] = RAMP[i][0] + (RAMP[i + 1][0] - RAMP[i][0]) * r; out[1] = RAMP[i][1] + (RAMP[i + 1][1] - RAMP[i][1]) * r; out[2] = RAMP[i][2] + (RAMP[i + 1][2] - RAMP[i][2]) * r; return out;
}

/**
 * createAirflow(parent, opts) → controller
 * opts: { count, dark, width (wisp half-width, m), trail (s of history drawn), hist (points per wisp), timeScale (shown speed) }
 * setRoom({ w, d, h, x0, z0 })            room box: x ∈ [x0-w/2, x0+w/2], z ∈ [z0-d/2, z0+d/2], y ∈ [0, h]
 * setEmitters([{ o:Vector3, f:Vector3 (horizontal forward), r:Vector3 (right), width, kind:'wall'|'ceiling'|'cassette'|'floor'|'diff', intake:Vector3, v0 }])
 * setSources([{ x, y, z, r, k }])         heat sources (k = strength 0..1)
 * set({ airF, supplyT, roomT, running, swing, fan, louver: null | 0…1 (fixed flap), hswing, alpha (r12: wisp opacity) })
 * update(dt, t) · tempAt(x, z) (occupied-zone air temperature, from the particles) · obstacles([{minX,maxX,minY,maxY,minZ,maxZ}])
 */
export function createAirflow(parent, opts = {}) {
  const o = { count: 2200, dark: false, width: 0.022, trail: 0.16, plumeShare: 0.13, hist: 7, timeScale: 0.6, haze: 0.3, alpha: 1, ...opts };
  const N = o.count, HN = o.hist;
  const wisps = createWisps(parent, { max: N * HN, additive: o.dark, renderOrder: 5 });
  const haze = o.haze ? createHaze(wisps.mesh, { max: Math.ceil(N * o.haze), additive: o.dark, renderOrder: 5 }) : null;   // child of the wisps: shown/hidden with them
  const mesh = wisps.mesh;
  const W = new Float32Array(N);
  // position history (ring of HN samples per particle, sampled together every hdt seconds of simulated time)
  const hist = new Float32Array(N * HN * 3); let hp = 0, hAcc = 0; const hdt = () => o.trail * 0.32;

  // particle state
  const pos = new Float32Array(N * 3), vel = new Float32Array(N * 3), T = new Float32Array(N), age = new Float32Array(N), mode = new Uint8Array(N), em = new Uint16Array(N), life = new Float32Array(N), seed = new Float32Array(N);
  for (let i = 0; i < N; i++) { seed[i] = Math.random(); W[i] = o.width * 1.15 * (0.6 + Math.random() * 0.8); mode[i] = 9; age[i] = -Math.random() * 6; }
  const resetHist = i => { const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2]; for (let k = 0; k < HN; k++) { const j = (i * HN + k) * 3; hist[j] = x; hist[j + 1] = y; hist[j + 2] = z; } };
  const sw3 = [0, 0, 0];
  let R = { w: 5, d: 4, h: 2.7, x0: 0, z0: 0 }, E = [], SRC = [], OB = [];
  let prm = { airF: 1, supplyT: 14, roomT: 30, running: true, swing: true, fan: 1, dark: o.dark };
  // coarse occupied-zone temperature grid (from particle temperatures), used by people + floor maps
  const GX = 40, GZ = 30; const gridT = new Float32Array(GX * GZ), gridW = new Float32Array(GX * GZ), gridS = new Float32Array(GX * GZ).fill(30);
  const tmpC = [0, 0, 0];

  function spawnSupply(i) {
    if (!E.length) { mode[i] = 9; return; }
    const e = E[(i * 7 + (seed[i] * 97 | 0)) % E.length];
    em[i] = E.indexOf(e);
    const lat = (Math.random() - 0.5) * e.width;
    const ox = e.o.x + e.r.x * lat, oz = e.o.z + e.r.z * lat, oy = e.o.y + (Math.random() - 0.5) * 0.02;
    // louver pitch (down from horizontal) + sweep · Rev.09 r4 (remote): prm.louver = fixed flap position 0 (highest) … 1 (lowest)
    // instead of the up/down swing, prm.hswing = left–right sweep (defaults to swing; wall / ceiling / floor-standing)
    const fx = prm.louver != null, L = fx ? clamp(prm.louver, 0, 1) : 0;
    const sw = prm.swing && !fx ? Math.sin(tNow * (e.kind === 'wall' ? 0.55 : 0.4) + e.phase) : 0;
    let pitch, spread;
    if (e.kind === 'wall') { pitch = fx ? 0.16 + 0.56 * L : 0.42 + 0.24 * sw; spread = 0.55; }
    else if (e.kind === 'ceiling') { pitch = fx ? 0.0 + 0.24 * L : 0.1 + 0.08 * sw; spread = 0.26; }
    else if (e.kind === 'cassette') { pitch = fx ? 0.16 + 0.34 * L : 0.32 + 0.14 * sw; spread = 0.55; }
    else if (e.kind === 'floor') { pitch = fx ? -0.72 + 0.34 * L : -0.55 + 0.1 * sw; spread = 0.2; }
    else { pitch = 1.25; spread = 1.2; }
    const hs = prm.hswing ?? prm.swing;
    const yaw = (Math.random() - 0.5) * spread + (((e.kind === 'wall' || e.kind === 'ceiling') && hs) || (e.kind === 'floor' && prm.hswing === true) ? Math.sin(tNow * 0.23 + e.phase) * 0.32 : 0);
    const cp = Math.cos(pitch), sp = Math.sin(pitch), cy = Math.cos(yaw), sy = Math.sin(yaw);
    const hx = e.f.x * cy + e.r.x * sy, hz = e.f.z * cy + e.r.z * sy;
    const v = (e.v0 || 3.2) * prm.fan * (0.35 + 0.65 * prm.airF) * (0.85 + Math.random() * 0.3);
    pos[i * 3] = ox; pos[i * 3 + 1] = oy; pos[i * 3 + 2] = oz;
    vel[i * 3] = hx * cp * v; vel[i * 3 + 1] = -sp * v; vel[i * 3 + 2] = hz * cp * v;
    T[i] = prm.supplyT + (1 - prm.airF) * 2.5; age[i] = 0; mode[i] = 0; life[i] = 3.5 + Math.random() * 7; resetHist(i);
  }
  function spawnPlume(i) {
    if (!SRC.length) return spawnSupply(i);
    const s = SRC[(seed[i] * 1000 | 0) % SRC.length];
    const a = Math.random() * Math.PI * 2, r = Math.random() * s.r;
    pos[i * 3] = s.x + Math.cos(a) * r; pos[i * 3 + 1] = s.y + Math.random() * 0.1; pos[i * 3 + 2] = s.z + Math.sin(a) * r;
    vel[i * 3] = (Math.random() - 0.5) * 0.05; vel[i * 3 + 1] = 0.22 + 0.25 * s.k; vel[i * 3 + 2] = (Math.random() - 0.5) * 0.05;
    T[i] = prm.roomT + 1.5 + 2.5 * s.k; age[i] = 0; mode[i] = 2; life[i] = 9; resetHist(i);
  }
  const isPlume = i => seed[i] < o.plumeShare && SRC.length;
  const isIntake = i => seed[i] >= o.plumeShare && seed[i] < o.plumeShare + 0.12;
  function spawnIntake(i) {   // room air being drawn into the return grille (sink flow)
    if (!E.length) { mode[i] = 9; return; }
    const k = (seed[i] * 7919 | 0) % E.length, e = E[k]; em[i] = k;
    const r = 0.5 + Math.random() * 1.6, a = Math.random() * Math.PI * 2, b = Math.random() * 0.9;
    let x = e.intake.x + (e.f.x * Math.abs(Math.cos(a)) + e.r.x * Math.sin(a)) * r * Math.cos(b), z = e.intake.z + (e.f.z * Math.abs(Math.cos(a)) + e.r.z * Math.sin(a)) * r * Math.cos(b), y = e.intake.y - Math.abs(Math.sin(b)) * r * 0.8;
    const { w, d, h, x0, z0 } = R; x = clamp(x, x0 - w / 2 + 0.1, x0 + w / 2 - 0.1); z = clamp(z, z0 - d / 2 + 0.1, z0 + d / 2 - 0.1); y = clamp(y, 0.3, h - 0.05);
    pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z; vel[i * 3] = vel[i * 3 + 1] = vel[i * 3 + 2] = 0;
    T[i] = prm.roomT - 0.3 + Math.random() * 0.6; age[i] = 0; mode[i] = 3; life[i] = 6; resetHist(i);
  }

  let tNow = 0;
  function step(dt) {
    const { w, d, h, x0, z0 } = R, xmin = x0 - w / 2 + 0.04, xmax = x0 + w / 2 - 0.04, zmin = z0 - d / 2 + 0.04, zmax = z0 + d / 2 - 0.04, ceil = h - 0.03;
    const on = prm.running && E.length;
    for (let i = 0; i < N; i++) {
      if (mode[i] === 9) { age[i] += dt; if (age[i] > 0 && on) { isPlume(i) ? spawnPlume(i) : isIntake(i) ? spawnIntake(i) : spawnSupply(i); } else continue; }
      let x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2], vx = vel[i * 3], vy = vel[i * 3 + 1], vz = vel[i * 3 + 2];
      age[i] += dt; const m = mode[i];
      if (m === 0) { // supply jet
        const e = E[em[i]] || E[0];
        const spd = Math.hypot(vx, vy, vz);
        const drag = (e.kind === 'ceiling' ? 0.53 : e.kind === 'cassette' ? 0.85 : e.kind === 'floor' ? 0.5 : e.kind === 'diff' ? 1.1 : 0.52) * (1.25 - 0.25 * prm.airF);
        const k = Math.exp(-drag * dt); vx *= k; vy *= k; vz *= k;
        // mixing: the jet warms as it entrains room air (faster once slow)
        T[i] += (prm.roomT - T[i]) * dt * (0.07 + 0.22 * clamp(1 - spd / 2, 0, 1));
        // buoyancy: colder than the room → sinks
        vy -= 0.55 * clamp((prm.roomT - T[i]) / 12, 0, 1.2) * dt;
        // Coanda: ceiling jets hug the ceiling while fast
        if ((e.kind === 'ceiling' || e.kind === 'cassette') && y > h - 0.45 && spd > (e.kind === 'ceiling' ? 2.5 : 1.3)) { vy += (h - 0.1 - y) * 3.2 * dt; if (vy < -0.08) vy *= 0.9; }
        if (spd < 0.14 || age[i] > life[i]) { mode[i] = 1; life[i] = age[i] - Math.random() * 2.2; }
      } else if (m === 1) { // spent jet: a cool layer that keeps spreading low over the floor, warming as it mixes, then fades (the room air it becomes is drawn back to the unit)
        const e = E[em[i]] || E[0];
        const ix = e.intake.x - x, iz = e.intake.z - z, L = Math.hypot(ix, iz) || 1;
        const kd = Math.exp(-0.35 * dt); vx *= kd; vz *= kd;
        vx += (ix / L * 0.05 + Math.sin(age[i] * 0.9 + seed[i] * 20) * 0.04) * dt; vz += (iz / L * 0.05 + Math.cos(age[i] * 0.7 + seed[i] * 30) * 0.04) * dt;
        vy += ((T[i] < prm.roomT - 2 ? -0.02 : 0.06) - vy) * dt * 0.8;
        T[i] += (prm.roomT - T[i]) * dt * 0.16;
        if (age[i] > life[i] + 4) { mode[i] = 9; age[i] = -Math.random() * 0.3; pos[i * 3 + 1] = -99; continue; }
      } else if (m === 3) { // intake: accelerating toward the return grille
        const e = E[em[i]] || E[0];
        const ix = e.intake.x - x, iy = e.intake.y - y, iz = e.intake.z - z, L = Math.hypot(ix, iy, iz) || 1;
        const s = clamp(0.35 / (L * L + 0.08), 0.12, 2.4);
        vx = ix / L * s; vy = iy / L * s; vz = iz / L * s;
        if (L < 0.12 || age[i] > life[i]) { mode[i] = 9; age[i] = -Math.random() * 0.2; pos[i * 3 + 1] = -99; continue; }
      } else { // plume from a heat source
        vy += (0.3 - vy) * dt * 0.8; vx += Math.sin(age[i] * 1.7 + seed[i] * 9) * 0.04 * dt; vz += Math.cos(age[i] * 1.3 + seed[i] * 7) * 0.04 * dt;
        T[i] += (prm.roomT - T[i]) * dt * 0.08;
        if (y > h - 0.25 || age[i] > life[i]) { mode[i] = 9; age[i] = -Math.random() * 0.5; pos[i * 3 + 1] = -99; continue; }
      }
      x += vx * dt; y += vy * dt; z += vz * dt;
      // obstacles (furniture): air flows over / around
      for (let b = 0; b < OB.length; b++) { const q = OB[b]; if (x > q.minX && x < q.maxX && z > q.minZ && z < q.maxZ && y > q.minY && y < q.maxY) { const up = q.maxY - y; if (up < 0.25) { y = q.maxY + 0.005; if (vy < 0) vy = -vy * 0.1; } else { const dx1 = x - q.minX, dx2 = q.maxX - x, dz1 = z - q.minZ, dz2 = q.maxZ - z; const mn = Math.min(dx1, dx2, dz1, dz2); if (mn === dx1) { x = q.minX; vx = -Math.abs(vx) * 0.2; } else if (mn === dx2) { x = q.maxX; vx = Math.abs(vx) * 0.2; } else if (mn === dz1) { z = q.minZ; vz = -Math.abs(vz) * 0.2; } else { z = q.maxZ; vz = Math.abs(vz) * 0.2; } vy += 0.2 * dt; } } }
      // walls: the jet turns and runs down the wall
      if (x < xmin) { x = xmin; vx = Math.abs(vx) * 0.12; vy -= Math.abs(vy) * 0.1 + 0.15 * dt * (m === 0 ? 4 : 0); }
      if (x > xmax) { x = xmax; vx = -Math.abs(vx) * 0.12; vy -= m === 0 ? 0.6 * dt : 0; }
      if (z < zmin) { z = zmin; vz = Math.abs(vz) * 0.12; vy -= m === 0 ? 0.6 * dt : 0; }
      if (z > zmax) { z = zmax; vz = -Math.abs(vz) * 0.12; vy -= m === 0 ? 0.6 * dt : 0; }
      if (y > ceil) { y = ceil; vy = -Math.abs(vy) * 0.05; }
      if (y < 0.05) { // floor: spread out
        y = 0.05; if (vy < 0) { const s = -vy * 0.55; vy = 0; const hl = Math.hypot(vx, vz) || 1; vx += vx / hl * s; vz += vz / hl * s; }
        const kf = Math.exp(-0.6 * dt); vx *= kf; vz *= kf;
      }
      pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z; vel[i * 3] = vx; vel[i * 3 + 1] = vy; vel[i * 3 + 2] = vz;
    }
  }
  function nearestIntake(x, y, z) { let bi = 0, bd = 1e9; E.forEach((e, k) => { const dd = (e.intake.x - x) ** 2 + (e.intake.y - y) ** 2 + (e.intake.z - z) ** 2; if (dd < bd) { bd = dd; bi = k; } }); return bi; }

  function write() {
    const dark = prm.dark;
    gridT.fill(0); gridW.fill(0);
    const { w, d, x0, z0 } = R;
    wisps.begin(); haze && haze.begin(); const hk = o.haze ? Math.max(1, Math.round(1 / o.haze)) : 0, hs = 0.42 * Math.sqrt(o.trailK || 1);
    for (let i = 0; i < N; i++) {
      const m = mode[i];
      if (m === 9) continue;
      const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2], vx = vel[i * 3], vy = vel[i * 3 + 1], vz = vel[i * 3 + 2];
      const spd = Math.hypot(vx, vy, vz);
      tempColor(T[i], tmpC); airTint(tmpC, dark);
      const fadeIn = m === 0 ? clamp(age[i] * 9, 0, 1) : clamp(age[i] * 2.2, 0, 1);   // supply air shows right at the louver: the jet must visibly come out of the unit
      // head alpha: a calm, translucent read — the many overlapping wisps build up the jet, no single one is bold
      let a = m === 0 ? 0.15 + 0.13 * clamp(spd / 3, 0, 1) : m === 1 ? 0.085 * clamp(life[i] + 4 - age[i], 0, 1) : m === 3 ? 0.07 * clamp(age[i] * 2, 0, 1) : 0.065 * clamp((R.h - 0.25 - y) * 2, 0, 1);
      if (m === 0 && age[i] > life[i] - 1) a *= clamp(life[i] - age[i], 0.25, 1);
      a *= fadeIn * (dark ? 0.62 : 1) * o.alpha;   // o.alpha (Rev.09 r4): close-up scenes draw the same air fainter
      if (a > 0.004) {
        // turbulence is drawn, not simulated: each point of the wisp sways by a smooth swirl field evaluated at its own
        // position, so streamlines curl and breathe like real air while the physics (throw, temperatures) stays unchanged
        const amp = m === 0 ? 0.025 + 0.11 * clamp(1 - spd / 2.4, 0, 1) : m === 1 ? 0.1 : m === 2 ? 0.06 : 0.03, sd = seed[i] * 6.3;
        swirl(x, y, z, tNow, sd, sw3);
        let px = x + sw3[0] * amp, py = y + sw3[1] * amp, pz = z + sw3[2] * amp; const w0 = W[i];
        for (let k = 0; k < HN; k++) {
          const j = (i * HN + ((hp - k + HN) % HN)) * 3; swirl(hist[j], hist[j + 1], hist[j + 2], tNow, sd, sw3);
          const qx = hist[j] + sw3[0] * amp, qy = hist[j + 1] + sw3[1] * amp, qz = hist[j + 2] + sw3[2] * amp;
          const f0 = 1 - k / HN, f1 = 1 - (k + 1) / HN;
          const wd = dark ? w0 * 1.45 : w0;   // on dark scenes additive wisps glow: wider + fainter reads as cool mist, not drops
          wisps.seg(px, py, pz, qx, qy, qz, tmpC[0], tmpC[1], tmpC[2], a * f0 * f0, a * f1 * f1, wd * (0.55 + 0.45 * f0), wd * (0.55 + 0.45 * f1));
          px = qx; py = qy; pz = qz;
        }
        // haze: the cool air mass around the jet and the spreading layer (supply + spent air only), grows as it slows
        if (haze && (m === 0 || m === 1) && i % hk === 0) haze.add(x, y, z, tmpC[0], tmpC[1], tmpC[2], a * (dark ? 0.32 : 0.36), hs * (0.7 + 1.1 * clamp(1 - spd / 2.5, 0, 1)));
      }
      // occupied zone temperature sample
      if (y < 1.8) { const gx = Math.floor(((x - x0) / w + 0.5) * GX), gz = Math.floor(((z - z0) / d + 0.5) * GZ); if (gx >= 0 && gx < GX && gz >= 0 && gz < GZ) { const wgt = m === 0 ? 1 : m === 1 ? 0.5 : 0.25; gridT[gz * GX + gx] += T[i] * wgt; gridW[gz * GX + gx] += wgt; } }
    }
    wisps.end(); haze && haze.end();
    // smooth the grid in time; cells with no cold air drift to room temperature
    for (let gz = 0; gz < GZ; gz++) for (let gx = 0; gx < GX; gx++) { const j = gz * GX + gx; const amb = prm.ambient ? prm.ambient(x0 + ((gx + 0.5) / GX - 0.5) * w, z0 + ((gz + 0.5) / GZ - 0.5) * d) : prm.roomT; const tgt = gridW[j] > 0.5 ? (gridT[j] + amb * 0.6) / (gridW[j] + 0.6) : amb; gridS[j] += (tgt - gridS[j]) * 0.06; }
  }
  // advance the simulation (shown at timeScale × real speed) and sample the wisp history
  function advance(dt) {
    const sub = dt > 0.034 ? 2 : 1; for (let s2 = 0; s2 < sub; s2++) step(dt / sub);
    hAcc += dt; const hd = hdt() * Math.sqrt(o.trailK || 1);
    if (hAcc >= hd) { hAcc = Math.min(hAcc - hd, hd); hp = (hp + 1) % HN; for (let i = 0; i < N; i++) { const j = (i * HN + hp) * 3; hist[j] = pos[i * 3]; hist[j + 1] = pos[i * 3 + 1]; hist[j + 2] = pos[i * 3 + 2]; } }
  }

  return {
    mesh,
    setRoom(r) { R = { x0: 0, z0: 0, ...r }; gridS.fill(prm.roomT); },
    setEmitters(list) { E = list.map((e, k) => ({ v0: 3.2, width: 0.6, kind: 'wall', phase: k * 1.3, ...e })); for (let i = 0; i < N; i++) { mode[i] = 9; age[i] = -Math.random() * 7; pos[i * 3 + 1] = -99; } },
    setSources(list) { SRC = list || []; },
    obstacles(list) { OB = list || []; },
    set(p) { const was = prm.dark; if (p.alpha != null) o.alpha = p.alpha; Object.assign(prm, p); if (prm.dark !== was) { wisps.setAdditive(prm.dark); haze && haze.setAdditive(prm.dark); } },
    update(dt, t) { tNow = t * o.timeScale; if (dt > 0) advance(dt * o.timeScale); write(); },
    // settle the flow without drawing every step (room planner: after a move / resize), then draw once
    prewarm(steps = 80, dt = 0.05) { for (let k = 0; k < steps; k++) advance(dt * o.timeScale); write(); },
    visible(v) { mesh.visible = !!v; },
    setScale(k) { for (let i = 0; i < N; i++) W[i] = o.width * 1.15 * k * (0.6 + seed[i] * 0.8); o.trailK = k; },
    tempAt(x, z) { const { w, d, x0, z0 } = R; const gx = clamp(Math.floor(((x - x0) / w + 0.5) * GX), 0, GX - 1), gz = clamp(Math.floor(((z - z0) / d + 0.5) * GZ), 0, GZ - 1); let s = 0, n = 0; for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const X = gx + a, Z = gz + b; if (X >= 0 && X < GX && Z >= 0 && Z < GZ) { s += gridS[Z * GX + X]; n++; } } return s / n; },
    grid: () => ({ GX, GZ, T: gridS }),
    _debug: () => ({ mode, T, age, life, pos, vel }),
    dispose() { haze && haze.dispose(); wisps.dispose(); },
  };
}
