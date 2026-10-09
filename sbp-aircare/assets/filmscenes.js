// SBP AirCare — film scenes (r16, owner 6 ต.ค. 2569: "รื้อโครงสร้างและทำใหม่ … ทุกหัวข้อต้องมีภาพประกอบ animation ที่สมจริง …
// ถ่ายทอดออกมาเหมือนหนังและเกม"). One interface over every 3D tool of the site, so a chapter of the new editions can play any of
// them as a sequence of shots.
//   stepsOf(spec)                → Promise<[{ t, d, why?, get?, form?, who? }]> — the captions, read WITHOUT creating a WebGL
//                                  context (so they exist before the 3D view, and on devices that cannot draw it)
//   makeScene(spec, host, env)   → Promise<{ kind, api, go(i), busy?(), setType?(t), dispose(), disposable }>
//   go(i) shows step i (−1 = the establishing shot); safe to call in any order (scrubbing back and forth)
// Kinds:
//   unit      the cinematic unit (cinema3d) — on the pages it is the shared stage (stage.js), see film.js
//   cycle     the whole air-conditioning system in a home (system3d): 9 steps per type
//   story     a technician acting out a company form step by step (techstory): C1 · C2 · install (STANDARD | PREMIUM) · repair
//   crew      two technicians + the customer on a site (jobscene3d + jobguide timelines): clean (C1 | C2) · install
//   room      airflow and reach in a room (throwsim3d): shots with remote settings
//   materials the specified installation materials, one by one (materials3d)
//   map       the service area around the Rama 2 office (thaimap3d)
// Captions come from the same data the tools teach from (company forms, jobguide, system3d); the only new wording is the
// shot captions of the unit / room / map kinds below. Every 3D view is an illustration — the pages say so on every stage.

const clone = o => JSON.parse(JSON.stringify(o));
const dark = env => (env.theme === 'dark' ? 'dark' : 'light');

// cinema shots used when a chapter gives none: power on → airflow → close → inside → wide
export const UNIT_SHOTS = [
  { t: 'เปิดเครื่อง บานสวิงเปิด ลมเย็นเริ่มไหล', d: 'ตัวเครื่องในภาพเป็นแบบกลาง ไม่มียี่ห้อ', s: { shot: 'hero', power: true, xray: false, explode: 0, dirt: 0 } },
  { t: 'ลมเย็นกระจายทั่วห้อง', d: 'บานสวิงกวาดขึ้น–ลง ลมเย็นหนักกว่าลมอุ่นจึงค่อย ๆ ลงสู่ระดับที่คนนั่ง', s: { shot: 'air', power: true, xray: false, explode: 0 } },
  { t: 'ใกล้ตัวเครื่อง', d: 'หน้ากาก ช่องลมออก และจอแสดงผล', s: { shot: 'close', power: true, xray: false, explode: 0 } },
  { t: 'มองทะลุเข้าไปข้างใน', d: 'แผ่นกรอง คอยล์เย็น พัดลม และถาดน้ำทิ้ง ชิ้นส่วนที่ช่างล้างและตรวจทุกครั้ง', s: { shot: 'inside', power: true, xray: true, explode: 0.45 } },
  { t: 'กลับมาที่ภาพรวมของห้อง', d: 'เครื่องที่สะอาดและขนาดเหมาะกับห้อง เย็นเร็วและทำงานเบากว่า', s: { shot: 'wide', power: true, xray: false, explode: 0 } },
];
// the room: what the remote does to the air (the throw is drawn by the airflow model)
export const ROOM_SHOTS = [
  { t: 'ห้องร้อน เครื่องยังไม่ทำงาน', d: 'ห้องตัวอย่างพร้อมโต๊ะ เก้าอี้ และคนนั่ง', c: { power: false } },
  { t: 'เปิดเครื่อง โหมดเย็น พัดลมอัตโนมัติ', d: 'ลมเย็นพุ่งออกจากเครื่อง แล้วค่อย ๆ กระจายลงสู่ระดับที่คนนั่ง', c: { power: true, mode: 'cool', fan: 'auto', dirty: false } },
  { t: 'พัดลมแรงสุด ลมไปได้ไกลขึ้น', d: 'ระยะลมขึ้นกับความแรงพัดลมและบานสวิง ห้องยาวควรวางเครื่องบนผนังด้านแคบ', c: { power: true, fan: 'turbo' } },
  { t: 'แผ่นกรองและคอยล์สกปรก', d: 'ลมผ่านน้อยลง ระยะลมสั้นลง ห้องเย็นช้า เครื่องทำงานนานขึ้น', c: { power: true, fan: 'auto', dirty: true } },
  { t: 'หลังล้าง ลมกลับมาเต็มที่', d: 'ล้างตามรอบช่วยให้ลมและความเย็นกลับมาเหมือนเดิม', c: { power: true, fan: 'auto', dirty: false } },
];
export const MAP_SHOTS = [
  { t: 'สำนักงานใหญ่ ถนนพระราม 2', d: 'ทีมช่างออกจากสำนักงานทุกเช้า พื้นที่หลักคือกรุงเทพฯ และปริมณฑล', v: 'service' },
  { t: 'พื้นที่บริการหลัก', d: 'ตรวจพื้นที่และค่าเดินทางได้ทันทีในหน้านี้ จังหวัดใกล้เคียงแจ้งค่าเดินทางก่อนนัด', v: 'service' },
  { t: 'งานต่างจังหวัดและงานโครงการ', d: 'สำรวจหน้างานแล้วเสนอราคาเป็นรายงาน', v: 'country' },
];

const crewTimeline = (G, spec) => (spec.job === 'install'
  ? G.installTimeline(spec.type || 'wall', spec.level || 'STANDARD')
  : G.cleanTimeline(spec.type || 'wall', spec.level || 'C1', spec.pkg || 'Standard Care'));
const storyOf = (STORIES, spec) => STORIES[spec.story || 'C1'](spec.tier || 'STANDARD');

/** the captions of a chapter's scene, without creating any WebGL context */
export async function stepsOf(spec) {
  switch (spec.kind) {
    case 'unit': return (spec.shots || UNIT_SHOTS).map(({ t, d }) => ({ t, d }));
    case 'room': return (spec.shots || ROOM_SHOTS).map(({ t, d }) => ({ t, d }));
    case 'map': return (spec.shots || MAP_SHOTS).map(({ t, d }) => ({ t, d }));
    case 'cycle': { const { steps } = await import('./system3d.js'); return steps(spec.type || 'wall').map(s => ({ t: s.t, d: s.d })); }
    case 'story': { const { STORIES } = await import('./techstory.js'); return storyOf(STORIES, spec).map(s => ({ t: s.t, d: s.what || '', why: s.why || '', get: s.get || '', form: s.form || '' })); }
    case 'crew': { const G = await import('./jobguide.js'); return crewTimeline(G, spec).map(x => ({ t: x.step.t, d: x.step.d, who: x.who || null })); }
    case 'materials': { const { MATS } = await import('./materials3d.js'); return MATS.map(m => ({ t: [m.th, m.brand].filter(Boolean).join(' · '), d: m.spec || '' })); }
    default: throw new Error('unknown scene ' + spec.kind);
  }
}

async function unitScene(spec, host, env) {
  const { createCinema } = await import('./cinema3d.js');
  const { unitDims } = await import('./roomfit.js');
  const q = env.quality || (matchMedia('(pointer: coarse)').matches ? 'mid' : 'auto');
  const C = createCinema(host, { mood: spec.mood || env.mood || 'atelier', quality: q, model: null, bars: false });
  C.auto(false);
  const type = spec.type || 'wall', dm = unitDims(type, spec.btu || 12000);
  const shots = spec.shots || UNIT_SHOTS;
  let cur = -2;
  const base = { type, w: dm.w, h: dm.h, d: dm.d, mode: 'cool', swing: true, power: true, xray: false, explode: 0, dirt: 0 };
  const apply = i => { const s = i < 0 ? { shot: spec.establish || 'hero', power: true } : shots[i].s || {}; C.scene({ ...base, ...s, cut: cur === -2, auto: false }); };
  await new Promise(r => setTimeout(r, 30)); apply(-1); cur = -1;
  return { kind: 'unit', api: C, disposable: true, go(i) { if (i === cur) return; apply(i); cur = i; }, dispose() { C.dispose(); } };
}

async function cycleScene(spec, host, env) {
  const { createSystem3D } = await import('./system3d.js');
  const V = createSystem3D(host, { theme: dark(env), type: spec.type || 'wall' });
  const n = V.steps.length;
  let cur = -2;
  return { kind: 'cycle', api: V, disposable: true, go(i) { if (i === cur) return; cur = i; V.go(Math.max(-1, Math.min(n - 1, i))); }, dispose() { V.dispose(); } };
}

async function storyScene(spec, host, env) {
  const { createTechStory3D } = await import('./techstory.js');
  const S = createTechStory3D(host, { theme: dark(env) });
  if (spec.story && spec.story !== 'C1') S.setStory(spec.story, spec.tier || 'STANDARD');
  let cur = -2;
  return { kind: 'story', api: S, disposable: true, go(i) { if (i === cur) return; cur = i; S.go(Math.max(-1, Math.min(S.length - 1, i))); }, dispose() { S.dispose(); } };
}

async function crewScene(spec, host, env) {
  const [{ createJobScene }, G] = await Promise.all([import('./jobscene3d.js'), import('./jobguide.js')]);
  const TL = crewTimeline(G, spec);
  const V = createJobScene(host, { theme: dark(env), type: spec.type || 'wall', job: spec.job || 'clean' });
  V.show(clone(TL[0].state), { jump: true });
  let cur = 0;
  return {
    kind: 'crew', api: V, disposable: true,
    // a step back or forward by one plays the move; a jump (scrubbing, a chapter link) cuts straight to the state
    go(i) { i = Math.max(0, Math.min(TL.length - 1, i)); if (i === cur) return; V.show(clone(TL[i].state), { jump: Math.abs(i - cur) !== 1 }); cur = i; },
    busy: () => V.busy(), dispose() { V.dispose(); },
  };
}

async function roomScene(spec, host, env) {
  const { createThrowSim } = await import('./throwsim3d.js');
  const V = createThrowSim(host, { theme: dark(env) });
  if (spec.type && spec.type !== 'wall') V.setType(spec.type);
  const shots = spec.shots || ROOM_SHOTS;
  let cur = -2;
  const set = i => V.setControl({ power: true, mode: 'cool', fan: 'auto', dirty: false, ...(i < 0 ? {} : shots[Math.min(i, shots.length - 1)].c) });
  set(-1);
  // (throwsim keeps its context for the page's life: no dispose — the pool releases its GL context when it is far away)
  return { kind: 'room', api: V, disposable: false, go(i) { if (i === cur) return; cur = i; set(i); }, setType(t) { V.setType(t); }, dispose() {} };
}

async function materialsScene(spec, host, env) {
  const { createMaterials3D, MATS } = await import('./materials3d.js');
  const V = createMaterials3D(host, { theme: dark(env) });
  let cur = -2;
  return { kind: 'materials', api: V, disposable: false, go(i) { if (i === cur) return; cur = i; V.setFocus(i < 0 ? null : MATS[Math.min(i, MATS.length - 1)].id); }, dispose() {} };
}

async function mapScene(spec, host, env) {
  const { mountThaiMap } = await import('./thaimap3d.js');
  const M = await mountThaiMap(host, { theme: dark(env) });
  const shots = spec.shots || MAP_SHOTS;
  let cur = -2;
  return { kind: 'map', api: M, disposable: false, go(i) { if (i === cur) return; cur = i; M.setView((shots[Math.max(0, Math.min(i, shots.length - 1))] || shots[0]).v); }, dispose() {} };
}

const KINDS = { unit: unitScene, cycle: cycleScene, story: storyScene, crew: crewScene, room: roomScene, materials: materialsScene, map: mapScene };
/** build the scene a chapter asks for inside host; env = { theme: 'light' | 'dark', mood (cinema), quality } */
export async function makeScene(spec, host, env = {}) {
  const f = KINDS[spec.kind]; if (!f) throw new Error('unknown scene ' + spec.kind);
  return f(spec, host, env);
}
