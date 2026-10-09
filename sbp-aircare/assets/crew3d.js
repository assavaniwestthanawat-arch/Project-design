// SBP AirCare — the service crew (Rev.09 round 4, owner: "ใส่ตัวคนล้าง … movement action ต่าง ๆ เหมือนช่างจริง ๆ ทำงานเป็นทีม").
// Two technicians in the company uniform (navy long-sleeve shirt, orange cap — CLAUDE.md §5.5) and the customer, as
// jointed people3d figures driven by a 'rig' pose: they walk between work spots (via the scene's route), climb an A-frame
// ladder, and hold the right tool for each job — lead: on the ladder at the unit; assistant: holds the bag, carries the
// parts to the table, washes them, sorts the paperwork. Uniform marks (chest "SBP AirCare", back "SBP AirCare ·
// บริษัท สหบูรพากรุ๊ป จำกัด") are small decals that follow the torso — a crew detail, not an advert.
import * as THREE from './three.module.min.js';
import { createCrowd, gait } from './people3d.js';
import { handTools } from './tech3d.js';
import { chestTex, backTex, cardTex, boxTex } from './brand3d.js';
import { disposeDeep } from './gl-pool.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const UNIFORM = { shirt: 0x1b51a4, pants: 0x2b3440, shoe: 0x22262b, cap: 0xef4e2e, longSleeve: true };   // r9: brand blue / orange
const sm = (c, x = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, ...x });
const mb = (w, h, d, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.castShadow = true; return o; };
const mc = (r, h, m, x = 0, y = 0, z = 0, r2) => { const o = new THREE.Mesh(new THREE.CylinderGeometry(r, r2 ?? r, h, 16), m); o.position.set(x, y, z); o.castShadow = true; return o; };
/** crew-only hand tools (hand frame: grip at the origin, tool hangs along -y): water jug, broom, rag, tape, the SBP tool box */
function crewTools() {
  const T = {}, mk = (n, f) => { const g = new THREE.Group(); f(g); g.visible = false; T[n] = g; };
  mk('jug', g => { g.add(mc(0.06, 0.2, sm(0xdfeef8, { transparent: true, opacity: 0.7, roughness: 0.2 }), 0, -0.12, 0.06)); g.add(mc(0.012, 0.06, sm(0xdfeef8, { transparent: true, opacity: 0.7 }), 0, -0.03, 0.12)); const w = mc(0.055, 0.1, sm(0x5fb6ea, { transparent: true, opacity: 0.6, roughness: 0.1 }), 0, -0.17, 0.06); g.add(w); g.userData.tip = V(0, -0.02, 0.13); });
  mk('broom', g => { g.add(mc(0.012, 1.1, sm(0x2f7fd0), 0, -0.45, 0.02)); g.add(mb(0.3, 0.06, 0.06, sm(0x2b3037), 0, -1.0, 0.02)); g.add(mb(0.28, 0.1, 0.05, sm(0xe2711d, { roughness: 0.9 }), 0, -1.08, 0.02)); });
  mk('cloth', g => { g.add(mb(0.14, 0.02, 0.12, sm(0x6fa8dc, { roughness: 1 }), 0, -0.04, 0.03)); });
  mk('tape', g => { g.add(mb(0.07, 0.07, 0.035, sm(0xf2c230, { roughness: 0.4 }), 0, -0.03, 0.03)); g.add(mb(0.4, 0.002, 0.018, sm(0xf2e6a0, { metalness: 0.4, roughness: 0.4 }), 0.22, -0.05, 0.05)); });
  mk('level', g => { g.add(mb(0.6, 0.035, 0.025, sm(0xf2c230, { roughness: 0.45 }), 0.18, -0.05, 0.04)); g.add(mb(0.05, 0.012, 0.02, sm(0x7ee08a, { transparent: true, opacity: 0.8 }), 0.18, -0.03, 0.04)); });
  mk('box', g => { const b = mb(0.46, 0.2, 0.24, sm(0xef4e2e, { roughness: 0.45 }), 0, 0, 0); g.add(b); g.add(mb(0.47, 0.025, 0.25, sm(0x2b3037), 0, 0.11, 0)); const d = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.13), new THREE.MeshStandardMaterial({ map: boxTex(), roughness: 0.5 })); d.position.set(0, -0.005, 0.1205); g.add(d); g.userData.both = true; });
  return T;
}

/** A-frame aluminium step ladder; userData.top = standing height of the top step used, userData.foot = offset of the climber */
export function buildLadder(h = 1.5) {
  const g = new THREE.Group(), m = new THREE.MeshStandardMaterial({ color: 0xc9ced4, metalness: 0.75, roughness: 0.3 }), tread = new THREE.MeshStandardMaterial({ color: 0x9aa2ab, metalness: 0.6, roughness: 0.5 });
  const rail = (x, z0, z1) => { const L = Math.hypot(h, z1 - z0), r = new THREE.Mesh(new THREE.BoxGeometry(0.035, L, 0.025), m); r.position.set(x, h / 2, (z0 + z1) / 2); r.rotation.x = Math.atan2(z1 - z0, h); r.castShadow = true; g.add(r); };
  const sp = h * 0.36; [-0.21, 0.21].forEach(x => { rail(x, sp, 0.02); rail(x, -sp, -0.02); });
  const n = Math.max(3, Math.round(h / 0.27));
  for (let i = 1; i <= n; i++) { const y = i * h / (n + 0.4), z = sp * (1 - y / h) + 0.01; const t = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.025, 0.09), tread); t.position.set(0, y, z); t.castShadow = true; g.add(t); }
  const top = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.04, 0.2), new THREE.MeshStandardMaterial({ color: 0xef4e2e, roughness: 0.5 })); top.position.set(0, h + 0.02, 0); g.add(top);
  const stand = (n - 1) * h / (n + 0.4);   // the climber stands on the second-highest tread
  g.userData = { top: stand, z: sp * (1 - stand / h) + 0.04 };
  return g;
}

/**
 * createCrew(parent, { route(from, to) → [[x,z]…], customer: { colors } })
 * crew.go(i, { x, z, face, act, tool, ladder: { at: [x, z], face, top, z } , y })  — walk (or climb) there and do it
 * crew.place(i, spec) — same, without walking (instant) · crew.tick(dt, t) · crew.hand(i, side) · crew.mid(i) · crew.busy(i)
 * members: 0 = lead technician, 1 = assistant technician, 2 = customer
 */
export function createCrew(parent, o = {}) {
  const crowd = createCrowd(parent, { max: 3, shadows: true });
  const route = o.route || ((a, b) => [b]);
  const M = [0, 1, 2].map(i => ({ i, x: o.at?.[i]?.[0] ?? i, z: o.at?.[i]?.[1] ?? 2, y: 0, face: Math.PI, path: [], walkT: 0, act: 'idle', tool: null, climb: 0, climbTo: 0, ladder: null, pending: null, target: null, seen: false }));
  // per technician: own tool set held in the right hand
  const TOOLS = [{ ...handTools(), ...crewTools() }, { ...handTools(), ...crewTools() }];
  TOOLS.forEach(T => Object.values(T).forEach(t => { t.matrixAutoUpdate = false; parent.add(t); }));
  // tablet screens show the company service report
  TOOLS.forEach(T => { const scr = T.tablet && T.tablet.getObjectByProperty('isMesh', true); T.tablet.traverse(x => { if (x.isMesh && x.material && x.material.isMeshBasicMaterial && x.material.map) { x.material.map = cardTex(); x.material.needsUpdate = true; } }); void scr; });

  function rig(m) {
    return (Sk, t, dt) => {
      Sk.root.position.set(m.x, m.y, m.z); Sk.root.rotation.set(0, m.face, 0); Sk.pelvis.position.set(0, 0.95, 0); Sk.spine.scale.setScalar(1);
      const set = (n, x = 0, y = 0, z = 0) => n.rotation.set(x, y, z);
      if (m.path.length) { m.walkT += dt * 6.2; gait(Sk, m.walkT, 1); if (m.act === 'carry' || m.act === 'carryBox') { set(Sk.sh[0], -0.55); set(Sk.el[0], -1.15); set(Sk.sh[1], -0.55); set(Sk.el[1], -1.15); } return; }
      if (m.climb > 0.01 && m.climb < 0.99) { const c = m.climb * 6; set(Sk.hip[0], -0.9 * Math.sin(c) ** 2); set(Sk.kn[0], 1.2 * Math.sin(c) ** 2); set(Sk.hip[1], -0.9 * Math.cos(c) ** 2); set(Sk.kn[1], 1.2 * Math.cos(c) ** 2); set(Sk.sh[0], -1.6); set(Sk.sh[1], -1.6); set(Sk.el[0], -0.4); set(Sk.el[1], -0.4); return; }
      const w = Math.sin(t * 5.5 + m.i), w2 = Math.sin(t * 2.2 + m.i * 1.3), slow = Math.sin(t * 0.8 + m.i);
      switch (m.act) {
        case 'reach': case 'work':   // both hands up at the unit
          set(Sk.sh[0], -2.05 + w * 0.08, 0, 0.08); set(Sk.el[0], -0.45 - w * 0.12); set(Sk.sh[1], -1.95 - w * 0.06, 0, -0.1); set(Sk.el[1], -0.6 + w * 0.1); set(Sk.neck, -0.22); set(Sk.head, -0.1, w2 * 0.1); set(Sk.spine, -0.04); break;
        case 'handDown':   // on the ladder, handing a part down to the assistant
          set(Sk.sh[0], -1.2 + slow * 0.1, 0, 0.1); set(Sk.el[0], -0.3); set(Sk.sh[1], -1.2 + slow * 0.1, 0, -0.1); set(Sk.el[1], -0.3); set(Sk.spine, 0.25); set(Sk.neck, 0.35); break;
        case 'receive':   // standing at the ladder foot, arms up to take the part
          set(Sk.sh[0], -2.3, 0, 0.15); set(Sk.el[0], -0.2); set(Sk.sh[1], -2.3, 0, -0.15); set(Sk.el[1], -0.2); set(Sk.neck, -0.35); break;
        case 'spray':   // right hand on the gun, left steadies the lance, sweeping
          set(Sk.sh[0], -2.0 + w2 * 0.18, w2 * 0.2, 0.05); set(Sk.el[0], -0.35); set(Sk.sh[1], -1.75 + w2 * 0.15, 0.25, -0.2); set(Sk.el[1], -0.95); set(Sk.neck, -0.28); set(Sk.head, -0.1, w2 * 0.15); set(Sk.spine, -0.05, w2 * 0.1); break;
        case 'sprayLow':   // washing parts on the table / outdoor coil, bent forward
          set(Sk.spine, 0.35, w2 * 0.12); set(Sk.sh[0], -1.35 + w2 * 0.15, w2 * 0.2); set(Sk.el[0], -0.3); set(Sk.sh[1], -1.1, 0.2); set(Sk.el[1], -0.9); set(Sk.neck, 0.15); break;
        case 'hold':   // holds the cleaning bag spout / steadies the ladder
          set(Sk.sh[0], -1.55, 0, 0.1); set(Sk.el[0], -0.5); set(Sk.sh[1], -0.6, 0, -0.1); set(Sk.el[1], -0.9); set(Sk.neck, -0.25); set(Sk.head, 0, slow * 0.2); break;
        case 'crouch':   // squat, hands working forward (outdoor unit, valves, floor-standing unit)
          Sk.pelvis.position.y = 0.5; set(Sk.hip[0], -1.95, 0, -0.18); set(Sk.hip[1], -1.95, 0, 0.18); set(Sk.kn[0], 2.25); set(Sk.kn[1], 2.25); set(Sk.an[0], -0.3); set(Sk.an[1], -0.3); set(Sk.spine, 0.42);
          set(Sk.sh[0], -1.25 + w * 0.08); set(Sk.el[0], -0.7 + w * 0.1); set(Sk.sh[1], -1.1 - w * 0.06); set(Sk.el[1], -0.8); set(Sk.neck, 0.1); break;
        case 'crouchSpray':
          Sk.pelvis.position.y = 0.52; set(Sk.hip[0], -1.9); set(Sk.hip[1], -1.9); set(Sk.kn[0], 2.2); set(Sk.kn[1], 2.2); set(Sk.an[0], -0.3); set(Sk.an[1], -0.3); set(Sk.spine, 0.3, w2 * 0.1);
          set(Sk.sh[0], -1.45 + w2 * 0.15, w2 * 0.2); set(Sk.el[0], -0.3); set(Sk.sh[1], -1.3, 0.2); set(Sk.el[1], -0.9); break;
        case 'kneel':   // one knee down, working at a low panel
          Sk.pelvis.position.y = 0.55; set(Sk.hip[0], -1.6); set(Sk.kn[0], 1.55); set(Sk.hip[1], -0.1); set(Sk.kn[1], 1.6); set(Sk.an[1], 0.5); set(Sk.spine, 0.2);
          set(Sk.sh[0], -1.2 + w * 0.08); set(Sk.el[0], -0.6); set(Sk.sh[1], -1.0); set(Sk.el[1], -0.8); set(Sk.neck, 0.05); break;
        case 'up':   // working overhead (4-way cassette above the head)
          set(Sk.sh[0], -2.6 + w * 0.05, 0, 0.12); set(Sk.el[0], -0.3 - w * 0.1); set(Sk.sh[1], -2.5 - w * 0.04, 0, -0.12); set(Sk.el[1], -0.38); set(Sk.neck, -0.5); set(Sk.head, -0.15, w2 * 0.1); set(Sk.spine, -0.06); break;
        case 'sprayUp':
          set(Sk.sh[0], -2.45 + w2 * 0.12, w2 * 0.15, 0.08); set(Sk.el[0], -0.3); set(Sk.sh[1], -2.2 + w2 * 0.1, 0.2, -0.15); set(Sk.el[1], -0.7); set(Sk.neck, -0.5); set(Sk.head, -0.1, w2 * 0.12); set(Sk.spine, -0.06); break;
        case 'lift':   // both arms overhead holding the unit (two-man lift to rods / ceiling)
          set(Sk.sh[0], -2.4, 0, 0.12); set(Sk.el[0], -0.55); set(Sk.sh[1], -2.4, 0, -0.12); set(Sk.el[1], -0.55); set(Sk.neck, -0.4); set(Sk.spine, -0.08); break;
        case 'carry': case 'carryBox':   // carrying a part / carton in front
          set(Sk.sh[0], -0.55); set(Sk.el[0], -1.15); set(Sk.sh[1], -0.55); set(Sk.el[1], -1.15); set(Sk.neck, 0.15); break;
        case 'table':   // working at the parts table (sorting, wiping)
          set(Sk.spine, 0.32); set(Sk.sh[0], -1.0 + w * 0.12, w2 * 0.2); set(Sk.el[0], -0.55); set(Sk.sh[1], -0.95 - w * 0.1, -0.2); set(Sk.el[1], -0.6); set(Sk.neck, 0.25); break;
        case 'tablet':   // reading / writing the service form
          set(Sk.sh[0], -0.55); set(Sk.el[0], -1.35 + w * 0.05); set(Sk.sh[1], -0.6, 0, -0.15); set(Sk.el[1], -1.25); set(Sk.wr[0], 0, 0, 0.2); set(Sk.neck, 0.42); set(Sk.head, 0.12); break;
        case 'photo':   // tablet raised, taking a photo
          set(Sk.sh[0], -1.55); set(Sk.el[0], -0.55); set(Sk.sh[1], -1.5, 0, -0.1); set(Sk.el[1], -0.6); set(Sk.neck, -0.1); break;
        case 'present':   // showing the report to the customer
          set(Sk.sh[0], -0.95); set(Sk.el[0], -0.8); set(Sk.sh[1], -0.9, 0, -0.1); set(Sk.el[1], -0.9); set(Sk.neck, 0.15); set(Sk.head, 0, slow * 0.2); break;
        case 'explain':   // talking with the customer, one hand gesturing
          set(Sk.sh[1], -0.5 - Math.max(0, w2) * 0.4, 0, 0.1); set(Sk.el[1], -0.9 - Math.max(0, w2) * 0.3); set(Sk.sh[0], -0.15); set(Sk.el[0], -0.3); set(Sk.head, 0, slow * 0.15); break;
        case 'measure':   // probe / clamp up to the unit, meter at chest
          set(Sk.sh[0], -2.1 + w2 * 0.05); set(Sk.el[0], -0.25); set(Sk.sh[1], -0.6, 0, -0.1); set(Sk.el[1], -1.35); set(Sk.neck, -0.15); set(Sk.head, -0.1, 0.2); break;
        case 'switch':   // breaker at shoulder height
          set(Sk.sh[0], -1.5 + Math.max(0, Math.sin(t * 1.6)) * 0.1); set(Sk.el[0], -0.35); set(Sk.sh[1], -0.2); set(Sk.el[1], -0.3); set(Sk.neck, 0.05); break;
        case 'drill':   // drilling into the wall / ceiling at head height
          set(Sk.sh[0], -1.85 + w * 0.03); set(Sk.el[0], -0.45); set(Sk.sh[1], -1.7, 0, -0.25); set(Sk.el[1], -0.7); set(Sk.spine, -0.05 + w * 0.01); set(Sk.neck, -0.2); break;
        case 'pour':   // pouring test water from a jug
          set(Sk.sh[0], -1.9, 0.2, 0.2); set(Sk.el[0], -0.5); set(Sk.wr[0], 0, 0, 0.9 + slow * 0.1); set(Sk.sh[1], -1.6, 0, -0.1); set(Sk.el[1], -0.6); set(Sk.neck, -0.3); break;
        case 'sweep':   // cleaning up the area
          set(Sk.spine, 0.28, Math.sin(t * 2.4) * 0.25); set(Sk.sh[0], -0.9 + Math.sin(t * 2.4) * 0.3, Math.sin(t * 2.4) * 0.3); set(Sk.el[0], -0.5); set(Sk.sh[1], -1.0 + Math.sin(t * 2.4) * 0.3); set(Sk.el[1], -0.7); set(Sk.neck, 0.2); break;
        case 'remote':
          set(Sk.sh[0], -1.3); set(Sk.el[0], -0.45); set(Sk.sh[1], -0.2); set(Sk.el[1], -0.25); set(Sk.neck, -0.2); break;
        case 'sign':   // customer signing on the tablet
          set(Sk.sh[0], -0.7); set(Sk.el[0], -1.3 + Math.sin(t * 7) * 0.06); set(Sk.wr[0], 0, Math.sin(t * 9) * 0.2, 0); set(Sk.sh[1], -0.5, 0, -0.1); set(Sk.el[1], -1.2); set(Sk.neck, 0.4); break;
        case 'watch':   // customer watching the work, arms folded / relaxed
          [0, 1].forEach(k => { const s = k ? 1 : -1; set(Sk.sh[k], -0.55, s * 0.45, -s * 0.25); set(Sk.el[k], -1.85); }); set(Sk.head, -0.12, slow * 0.25); break;
        default: { const sw = Math.sin(t * 0.5 + m.i); Sk.pelvis.rotation.z = sw * 0.03; set(Sk.sh[0], 0, 0, -0.08); set(Sk.sh[1], 0, 0, 0.08); set(Sk.el[0], -0.2); set(Sk.el[1], -0.2); set(Sk.head, 0, Math.sin(t * 0.3 + m.i) * 0.4); }
      }
    };
  }
  const cust = o.customer || {};
  crowd.set([
    { x: M[0].x, z: M[0].z, pose: 'rig', rig: rig(M[0]), female: false, colors: { ...UNIFORM, skin: 0xc99a73, hair: 0x1d1a17 } },
    { x: M[1].x, z: M[1].z, pose: 'rig', rig: rig(M[1]), female: false, colors: { ...UNIFORM, skin: 0xa87653, hair: 0x2a211b } },
    { x: M[2].x, z: M[2].z, pose: 'rig', rig: rig(M[2]), female: cust.female ?? true, colors: { shirt: 0xd8d2c4, pants: 0x3b3f46, skin: 0xe3bd98, hair: 0x2a211b, longSleeve: true, ...(cust.colors || {}) } },
  ]);
  const P = crowd.people();
  // uniform marks: decals following each technician's torso
  const decals = [0, 1].map(() => {
    const mk = (tx, w, h) => { const d = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tx, transparent: true, roughness: 0.9, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 })); d.matrixAutoUpdate = false; d.renderOrder = 3; crowd.group.add(d); return d; };
    return { chest: mk(chestTex(), 0.085, 0.042), back: mk(backTex(), 0.25, 0.125) };
  });
  const OFF = { chest: new THREE.Matrix4().makeTranslation(0.07, 0.36, 0.1), back: new THREE.Matrix4().makeRotationY(Math.PI).premultiply(new THREE.Matrix4().makeTranslation(0, 0.3, -0.1)) };

  function apply(m, s, instant) {
    m.target = s; m.act = s.act || 'idle'; m.tool = s.tool || null; m.faceTo = s.face ?? m.face;
    const lad = s.ladder || null;
    const goal = lad ? lad.at : [s.x, s.z];
    if (instant) { m.path = []; m.pending = null; m.x = goal[0]; m.z = goal[1]; m.ladder = lad; m.climb = m.climbTo = lad ? 1 : 0; m.face = m.faceTo; return; }
    const sameL = (!m.ladder && !lad) || (m.ladder && lad && Math.hypot(m.ladder.at[0] - lad.at[0], m.ladder.at[1] - lad.at[1]) < 0.05);
    if (Math.hypot(goal[0] - m.x, goal[1] - m.z) < 0.05 && sameL && !m.pending) { if (lad) m.ladder = lad; m.climbTo = lad ? 1 : 0; return; }
    m.pending = { goal, lad };
  }
  function step(m, dt) {
    // climb down before walking away; then walk the route; climb up after arriving at a ladder
    if (m.pending) {
      if (m.climb > 0.01) { m.climb = Math.max(0, m.climb - dt * 1.3); }
      else { const pts = route([m.x, m.z], m.pending.goal, m.i); m.path = pts.slice(); m.ladder = m.pending.lad; m.climbTo = m.pending.lad ? 1 : 0; m.pending = null; }
    }
    if (m.path.length) {
      const [nx, nz] = m.path[0], dx = nx - m.x, dz = nz - m.z, d = Math.hypot(dx, dz), sp = 1.2 * dt;
      // Rev.09 r4: keep clear of the others — sidestep anyone standing or walking in the way (no walking through people)
      let ax = d > 1e-4 ? dx / d : 0, az = d > 1e-4 ? dz / d : 0;
      M.forEach(n => { if (n === m || (P[n.i] && P[n.i].hidden)) return; const ox = n.x - m.x, oz = n.z - m.z, od = Math.hypot(ox, oz); if (od < 0.75 && od > 1e-3 && ox * ax + oz * az > 0 && d > od - 0.2) { const k = (0.75 - od) / 0.75 * 1.6, px = az, pz = -ax, side = ox * px + oz * pz > 0 ? -1 : 1; ax += px * side * k; az += pz * side * k; } });
      { const L = Math.hypot(ax, az) || 1; ax /= L; az /= L; }
      const want = Math.atan2(ax, az); m.face += Math.atan2(Math.sin(want - m.face), Math.cos(want - m.face)) * clamp(dt * 7, 0, 1);
      if (d <= sp) { m.x = nx; m.z = nz; m.path.shift(); } else { m.x += ax * sp; m.z += az * sp; }
    } else if (!m.pending) {
      const fa = m.ladder ? m.ladder.face : m.faceTo;
      m.face += Math.atan2(Math.sin(fa - m.face), Math.cos(fa - m.face)) * clamp(dt * 5, 0, 1);
      if (m.climbTo > m.climb) m.climb = Math.min(1, m.climb + dt * 1.0); else if (m.climbTo < m.climb) m.climb = Math.max(0, m.climb - dt * 1.3);
    }
    // on the ladder: rise to the tread and lean in toward the unit
    const c = ease(m.climb), base = m.target?.y ?? 0;
    if (m.ladder && !m.path.length) { m.y = base + c * m.ladder.top; const fx = Math.sin(m.ladder.face), fz = Math.cos(m.ladder.face); m.vx = fx * (m.ladder.lean || 0) * c; m.vz = fz * (m.ladder.lean || 0) * c; } else { m.y = base; m.vx = m.vz = 0; }
  }
  const tmpM = new THREE.Matrix4(), v = V(0, 0, 0), v2 = V(0, 0, 0);
  function tick(dt, t) {
    M.forEach(m => step(m, dt));
    // ladder lean is applied to the drawn position only (route / spots stay on the floor grid)
    const save = M.map(m => [m.x, m.z]); M.forEach(m => { m.x += m.vx || 0; m.z += m.vz || 0; });
    crowd.update(dt, t, null);
    M.forEach((m, i) => { [m.x, m.z] = save[i]; });
    [0, 1].forEach(i => {
      const Sk = P[i].sk; Sk.wr[0].updateMatrixWorld(true);
      const T = TOOLS[i], m = M[i], show = !m.path.length && m.climb >= m.climbTo - 0.02;
      for (const k in T) {
        const tl = T[k], both = tl.userData.both; tl.visible = k === m.tool && (show || both);
        if (!tl.visible) continue;
        if (both) { Sk.wr[1].updateMatrixWorld(true); v.setFromMatrixPosition(Sk.wr[0].matrixWorld).add(v2.setFromMatrixPosition(Sk.wr[1].matrixWorld)).multiplyScalar(0.5); tl.matrix.copy(crowd.group.matrix).multiply(tmpM.makeRotationY(m.face).setPosition(v.x, v.y - 0.06, v.z)); }
        else tl.matrix.copy(crowd.group.matrix).multiply(Sk.wr[0].matrixWorld).multiply(tmpM.makeTranslation(0, -0.05, 0));
      }
      const D = decals[i]; Sk.spine.updateMatrixWorld(true);
      D.chest.matrix.copy(Sk.spine.matrixWorld).multiply(OFF.chest); D.back.matrix.copy(Sk.spine.matrixWorld).multiply(OFF.back);
    });
  }
  return {
    crowd, members: M, tools: TOOLS,
    go(i, s) { apply(M[i], s, false); }, place(i, s) { apply(M[i], s, true); },
    tick,
    hand(i, side = 0) { const Sk = P[i].sk; Sk.wr[side].updateMatrixWorld(true); return crowd.group.localToWorld(v.setFromMatrixPosition(Sk.wr[side].matrixWorld).clone()); },
    mid(i) { return this.hand(i, 0).add(this.hand(i, 1)).multiplyScalar(0.5); },
    busy(i) { const m = M[i]; return m.path.length > 0 || !!m.pending || Math.abs(m.climb - m.climbTo) > 0.02; },
    toolTip(i, name) { const tl = TOOLS[i][name]; if (!tl || !tl.visible || !tl.userData.tip) return null; return parent.localToWorld(tl.userData.tip.clone().applyMatrix4(tl.matrix)); },
    visible(i, on) { P[i].hidden = !on; },
    // r8: free the tools, their screen / label textures and the uniform decals too (the crew is rebuilt when the venue changes)
    dispose() { decals.forEach(D => Object.values(D).forEach(d => { d.parent && d.parent.remove(d); disposeDeep(d); })); crowd.dispose(); TOOLS.forEach(T => Object.values(T).forEach(t => { t.parent && t.parent.remove(t); disposeDeep(t); })); },
  };
}
