// SBP AirCare — room planner data + rules (Rev.09 round 3, owner: "ลูกค้าลองจัดวางห้องเองเหมือนเกม Sims แต่สมจริง").
// Pure module (no DOM, no three.js): furniture catalog with typical sizes, room presets, footprints, free-spot search,
// and the layout checks used by roomfit.fitCheck — furniture in the cold-air path, air blowing at a sleeping head or a
// seated face, a unit drawn over a window / door. All checks are general guidance (คำแนะนำทั่วไป), not manufacturer rules.
// Room frame (same as roomfit3d): x = width (left −, right +), z = length (back wall −L/2, front +L/2), floor y = 0.
// Floor items: { id, k, x, z, q } — q = quarter turns; at q = 0 the item's back faces the back wall (front toward +z).
// Wall items (window / door): { id, k, wall, along } — along = distance of the centre from the wall's left corner
// (seen from inside, facing the wall), the same convention as the AC position.

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const r2 = v => Math.round(v * 100) / 100;

// typical Thai furniture sizes (m). h = top height (matters for the air path). sleep / seat → comfort checks.
export const FURN = {
  bed: { th: 'เตียง 5 ฟุต', g: 'bed', w: 1.72, d: 2.12, h: 1.0, sleep: true },
  bedS: { th: 'เตียง 3.5 ฟุต', g: 'bed', w: 1.17, d: 2.12, h: 1.0, sleep: true },
  side: { th: 'โต๊ะข้างเตียง', g: 'bed', w: 0.45, d: 0.4, h: 0.9 },
  wardrobe: { th: 'ตู้เสื้อผ้า', g: 'bed', w: 1.2, d: 0.6, h: 2.0, wall: true },
  sofa: { th: 'โซฟา 3 ที่นั่ง', g: 'live', w: 2.1, d: 0.92, h: 0.85, seat: true },
  armchair: { th: 'อาร์มแชร์', g: 'live', w: 0.82, d: 0.82, h: 0.85, seat: true },
  coffee: { th: 'โต๊ะกลาง', g: 'live', w: 1.1, d: 0.6, h: 0.5 },
  tv: { th: 'ทีวี + ชั้นวาง', g: 'live', w: 1.8, d: 0.42, h: 1.5, wall: true },
  rug: { th: 'พรม', g: 'live', w: 2.0, d: 1.4, h: 0.01, flat: true },
  dining: { th: 'โต๊ะอาหาร 4 ที่', g: 'live', w: 1.5, d: 1.75, h: 0.95 },
  desk: { th: 'โต๊ะทำงาน + เก้าอี้', g: 'work', w: 1.2, d: 1.15, h: 1.15, wall: true },
  shelf: { th: 'ชั้นหนังสือ', g: 'work', w: 1.0, d: 0.34, h: 1.8, wall: true },
  meeting: { th: 'โต๊ะประชุม 8 ที่', g: 'work', w: 2.4, d: 2.05, h: 1.0 },
  meetingL: { th: 'โต๊ะประชุม 10–12 ที่', g: 'work', w: 3.6, d: 2.25, h: 1.0 },
  cabinet: { th: 'ตู้เอกสาร', g: 'work', w: 0.9, d: 0.45, h: 1.8, wall: true },
  work4: { th: 'โต๊ะทำงาน 4 ที่นั่ง', g: 'work', w: 2.4, d: 2.4, h: 1.2 },
  fridge: { th: 'ตู้เย็น', g: 'other', w: 0.7, d: 0.7, h: 1.8, wall: true },
  counter: { th: 'เคาน์เตอร์', g: 'other', w: 1.66, d: 0.64, h: 1.3 },
  rack: { th: 'ชั้นวางสินค้า', g: 'other', w: 1.8, d: 0.5, h: 1.8, wall: true },
  gondola: { th: 'ชั้นวางกลางร้าน 2 ด้าน', g: 'other', w: 1.8, d: 0.9, h: 1.5 },
  plant: { th: 'ต้นไม้', g: 'other', w: 0.5, d: 0.5, h: 1.1, porous: true },
  lamp: { th: 'โคมไฟตั้งพื้น', g: 'other', w: 0.4, d: 0.4, h: 1.7, porous: true },
  window: { th: 'หน้าต่าง', g: 'wall', w: 1.6, h: 1.3, sill: 0.9, wallItem: true },
  door: { th: 'ประตู', g: 'wall', w: 0.9, h: 2.05, sill: 0, wallItem: true },
};
export const FURN_GROUPS = [['bed', 'ห้องนอน'], ['live', 'นั่งเล่น · ทานข้าว'], ['work', 'ทำงาน · ประชุม'], ['other', 'อื่น ๆ'], ['wall', 'ผนัง']];
export const PRESETS = [
  { id: 'bedroom', th: 'ห้องนอน' }, { id: 'living', th: 'ห้องนั่งเล่น' }, { id: 'study', th: 'ห้องทำงาน' },
  { id: 'meeting', th: 'ห้องประชุม' }, { id: 'office', th: 'ออฟฟิศ' }, { id: 'shop', th: 'ร้านค้า' }, { id: 'empty', th: 'ห้องว่าง' },
];

// wall frames as plain numbers: inward normal n, along-axis t (left → right seen from inside), origin o, length
export function frame2(wall, W, L) {
  switch (wall) {
    case 'left': return { n: [1, 0], t: [0, -1], o: [-W / 2, L / 2], len: L, q: 1 };
    case 'right': return { n: [-1, 0], t: [0, 1], o: [W / 2, -L / 2], len: L, q: 3 };
    case 'front': return { n: [0, -1], t: [-1, 0], o: [W / 2, L / 2], len: W, q: 2 };
    default: return { n: [0, 1], t: [1, 0], o: [-W / 2, -L / 2], len: W, q: 0 };
  }
}
// world footprint half-sizes of a floor item (axis aligned: items turn in quarter turns)
export function footprint(it) {
  const f = FURN[it.k] || { w: 0.5, d: 0.5, h: 0.5 }, odd = ((it.q || 0) % 2 + 2) % 2;
  return { hx: (odd ? f.d : f.w) / 2, hz: (odd ? f.w : f.d) / 2, h: f.h };
}
export const clampItem = (it, W, L) => {
  if (FURN[it.k] && FURN[it.k].wallItem) { const fr = frame2(it.wall, W, L), hw = FURN[it.k].w / 2 + 0.05; it.along = r2(clamp(it.along, hw, Math.max(hw, fr.len - hw))); return it; }
  const fp = footprint(it); it.x = r2(clamp(it.x, -W / 2 + fp.hx, W / 2 - fp.hx)); it.z = r2(clamp(it.z, -L / 2 + fp.hz, L / 2 - fp.hz)); return it;
};
const overlap = (a, b, pad = 0) => { if (FURN[a.k].wallItem || FURN[b.k].wallItem || FURN[a.k].flat || FURN[b.k].flat) return false; const A = footprint(a), B = footprint(b); return Math.abs(a.x - b.x) < A.hx + B.hx - pad && Math.abs(a.z - b.z) < A.hz + B.hz - pad; };
export const overlaps = (it, list) => list.some(o => o !== it && overlap(it, o, 0.02));
const inside = (it, W, L) => { const fp = footprint(it); return Math.abs(it.x) <= W / 2 - fp.hx + 1e-6 && Math.abs(it.z) <= L / 2 - fp.hz + 1e-6; };

// a floor item with its back against a wall, centred `a` metres along it
export function against(wall, a, k, W, L, gap = 0.02) {
  const f = FURN[k], fr = frame2(wall, W, L), off = f.d / 2 + gap;
  return { k, x: r2(fr.o[0] + fr.t[0] * a + fr.n[0] * off), z: r2(fr.o[1] + fr.t[1] * a + fr.n[1] * off), q: fr.q };
}
let seq = 0;
export const newId = () => `f${Date.now().toString(36)}${(++seq).toString(36)}`;

/** furnished starting layouts, scaled to the visitor's room; pieces that do not fit are left out.
 *  Rev.09 r7 (owner: "ห้องใหญ่ขึ้น เฟอร์นิเจอร์ต้องปรับให้สมจริง"): furniture keeps its real size; a bigger room gets more of it
 *  (office desk rows, shop aisles, a bigger meeting table, a desk / armchairs / dining set in big bedrooms and living rooms). */
export function presetLayout(id, W, L) {
  const out = [];
  const put = it => { if (!it) return; it.id = newId(); if (FURN[it.k].wallItem) { clampItem(it, W, L); if (!out.some(o => FURN[o.k].wallItem && o.wall === it.wall && Math.abs(o.along - it.along) < (FURN[o.k].w + FURN[it.k].w) / 2 + 0.1)) out.push(it); return; }
    if (inside(it, W, L) && !overlaps(it, out)) out.push(it); };
  const wallI = (k, wall, a) => ({ k, wall, along: a });
  const mid = (wall) => frame2(wall, W, L).len / 2;
  if (id === 'bedroom') {
    const bk = W >= 3.2 ? 'bed' : 'bedS', bw = FURN[bk].w;
    put(against('back', W / 2, bk, W, L)); put(against('back', W / 2 - bw / 2 - 0.3, 'side', W, L)); put(against('back', W / 2 + bw / 2 + 0.3, 'side', W, L));
    put(against('right', L - 0.75, 'wardrobe', W, L)); put(against('left', 0.5, 'plant', W, L));
    put(wallI('window', 'left', mid('left'))); put(wallI('door', 'front', 0.75));
    if (W >= 4.0 && L >= 4.3) put(against('front', W - 0.8, 'desk', W, L));
    if (W * L >= 20) put(against('left', L - 1.0, 'armchair', W, L, 0.12));
    if (L >= 5.2) put(against('front', W / 2, 'tv', W, L));
  } else if (id === 'living') {
    put(against('front', W / 2, 'tv', W, L)); put(against('back', W / 2, 'sofa', W, L, 0.25));
    const sofa = out[out.length - 1]; if (sofa) { put({ k: 'coffee', x: sofa.x, z: r2(sofa.z + 1.05), q: 0 }); put({ k: 'rug', x: sofa.x, z: r2(sofa.z + 1.0), q: 0 }); }
    put(against('back', 0.4, 'lamp', W, L)); put(against('right', 0.45, 'plant', W, L));
    put(wallI('window', 'right', mid('right'))); put(wallI('door', 'left', 0.7));
    if (sofa && W >= 4.6) { put({ k: 'armchair', x: r2(sofa.x - 1.55), z: r2(sofa.z + 1.1), q: 1 }); put({ k: 'armchair', x: r2(sofa.x + 1.55), z: r2(sofa.z + 1.1), q: 3 }); }
    if (W >= 5 && L >= 5) put({ k: 'dining', x: r2(W / 2 - 1.25), z: r2(L / 2 - 1.5), q: 0 });
  } else if (id === 'study') {
    put(against('left', L / 2, 'desk', W, L)); put(against('right', L / 2, 'shelf', W, L)); put(against('front', W - 0.7, 'armchair', W, L, 0.15)); put(against('back', W - 0.45, 'plant', W, L));
    put(wallI('window', 'right', Math.min(L - 1.1, mid('right') + 0.6))); put(wallI('door', 'front', 0.75));
  } else if (id === 'meeting') {
    const big = Math.max(W, L) >= 6 && Math.min(W, L) >= 4.2;
    put({ k: big ? 'meetingL' : 'meeting', x: 0, z: r2(Math.min(0.3, L / 2 - 1.1)), q: W >= L ? 0 : 1 }); put(against('front', W / 2, 'tv', W, L)); put(against('back', 0.45, 'plant', W, L));
    put(wallI('window', 'right', mid('right'))); put(wallI('door', 'front', 0.75));
    if (big) { put(against('back', W - 0.6, 'cabinet', W, L)); put(against('left', 0.45, 'plant', W, L)); }
  } else if (id === 'office') {
    // rows of 4-person pods with 0.9–1.0 m walkways; a meeting table near the door when the room is deep enough
    const cols = Math.max(1, Math.floor((W - 0.9) / 2.75)), rows = Math.max(1, Math.floor((L - 1.7) / 3.1));
    for (let r = 0; r < rows; r++) for (let i = 0; i < cols; i++) put({ k: 'work4', x: r2(-((cols - 1) * 2.75) / 2 + i * 2.75), z: r2(rows === 1 ? Math.min(0.4, L / 2 - 1.3) : -L / 2 + 1.55 + r * 3.1), q: 0 });
    put(against('left', 0.7, 'shelf', W, L)); put(against('right', L - 0.6, 'fridge', W, L)); put(against('back', 0.45, 'plant', W, L));
    put(wallI('window', 'right', mid('right'))); put(wallI('door', 'front', 0.75));
    if (L - rows * 3.1 >= 2.4 && W >= 4.5) put({ k: 'meeting', x: r2(-W / 2 + 1.6), z: r2(L / 2 - 1.25), q: 0 });
    if (W >= 6) put(against('left', L - 0.6, 'cabinet', W, L));
  } else if (id === 'shop') {
    // wall racks all round (keeping the front for the door and counter) + aisles of double-sided gondolas, 1.2 m walkways
    const nS = Math.max(1, Math.floor((L - 1.6) / 1.9)), nB = Math.max(1, Math.floor((W - 0.4) / 1.9));
    for (let i = 0; i < nS; i++) { const a = L - 0.5 - 0.95 - i * 1.9; put(against('left', a, 'rack', W, L)); put(against('right', L - a, 'rack', W, L)); }
    for (let i = 0; i < nB; i++) put(against('back', W / 2 + (i - (nB - 1) / 2) * 1.9, 'rack', W, L));
    for (let x = -W / 2 + 0.5 + 1.2 + 0.45; x + 0.45 <= W / 2 - 0.5 - 1.2 + 1e-6; x += 2.1)
      for (let z = -L / 2 + 0.5 + 1.2 + 0.9; z + 0.9 <= L / 2 - 2.0 + 1e-6; z += 3.0) put({ k: 'gondola', x: r2(x), z: r2(z), q: 1 });
    put({ k: 'counter', x: r2(W / 2 - 1.3), z: r2(L / 2 - 1.0), q: 2 }); put(against('front', 0.5, 'plant', W, L));
    put(wallI('door', 'front', W / 2));
  }
  return out;
}

/** first free spot for a new piece: against a wall for wall-friendly pieces, else the open floor, from the centre out */
export function freeSpot(k, list, W, L, avoid = null) {
  const f = FURN[k];
  if (f.wallItem) {
    for (const wall of ['left', 'right', 'back', 'front']) {
      const fr = frame2(wall, W, L);
      for (let a = fr.len / 2, s = 0; s < fr.len; s += 0.25, a = fr.len / 2 + (s / 0.25 % 2 ? 1 : -1) * Math.ceil(s / 0.5) * 0.5) {
        const it = clampItem({ k, wall, along: a }, W, L);
        const clash = list.some(o => FURN[o.k].wallItem && o.wall === wall && Math.abs(o.along - it.along) < (FURN[o.k].w + f.w) / 2 + 0.1) || (avoid && avoid(it));
        if (!clash) return it;
      }
    }
    return clampItem({ k, wall: 'left', along: frame2('left', W, L).len / 2 }, W, L);
  }
  if (f.wall) for (const wall of ['left', 'right', 'front', 'back']) {
    const fr = frame2(wall, W, L);
    for (let a = f.w / 2 + 0.1; a <= fr.len - f.w / 2 - 0.1; a += 0.25) { const it = against(wall, a, k, W, L); if (inside(it, W, L) && !overlaps(it, list) && !(avoid && avoid(it))) return it; }
  }
  for (let r = 0; r <= Math.max(W, L); r += 0.25) for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) {
    const it = { k, x: r2(Math.round(Math.cos(a) * r / 0.05) * 0.05), z: r2(Math.round(Math.sin(a) * r / 0.05) * 0.05), q: 0 };
    if (inside(it, W, L) && !overlaps(it, list) && !(avoid && avoid(it))) return it;
    if (r === 0) break;
  }
  return clampItem({ k, x: 0, z: 0, q: 0 }, W, L);
}

/**
 * layout checks (pure). ctx: { t (unit type), d (unit dims), thr (throw m), depth (room depth in front m), add(ok, th, d) }
 * Unit position comes from S.place (same frames as the 3D view).
 */
export function layoutChecks(S, { t, d, thr, add }) {
  const items = S.furn || []; if (!items.length) return;
  const { w: W, l: L, h: H } = S.room;
  if (t === 'cassette') {
    const tall = items.filter(it => !FURN[it.k].wallItem && FURN[it.k].h >= 1.7 && Math.hypot(it.x - S.place.cx, it.z - S.place.cz) < 1.2);
    if (tall.length) add('info', `${FURN[tall[0].k].th}อยู่ใกล้ใต้เครื่อง`, 'ลมสี่ทิศทางเป่าออกแนวเฉียงลง ของสูงใกล้เครื่องจะรับลมเย็นแรงและบังลมบางด้าน · คำแนะนำทั่วไป');
    return;
  }
  const fr = frame2(S.place.wall, W, L);
  const along = clamp(S.place.along, d.w / 2, fr.len - d.w / 2);
  const ux = fr.o[0] + fr.t[0] * along, uz = fr.o[1] + fr.t[1] * along;
  const room = fr.n[0] ? W : L, reach = Math.min(thr, room - d.d);
  const yTop = t === 'wall' ? S.place.height + d.h : t === 'ceiling' ? H - S.place.gap : d.h;
  const yBot = t === 'wall' ? S.place.height : t === 'ceiling' ? H - S.place.gap - d.h : 0;
  // jet height above the floor at distance s from the wall (bottom edge of the cold-air stream; illustrative)
  const jetBottom = s => t === 'wall' ? yBot - s * 0.45 : t === 'ceiling' ? yBot - s * 0.12 : t === 'floor' ? (s < 1.2 ? 0.6 : 1.4) : 0;
  const inFrame = it => {
    const fp = footprint(it);
    const s = (it.x - fr.o[0]) * fr.n[0] + (it.z - fr.o[1]) * fr.n[1], es = fp.hx * Math.abs(fr.n[0]) + fp.hz * Math.abs(fr.n[1]);
    const u = (it.x - ux) * fr.t[0] + (it.z - uz) * fr.t[1], eu = fp.hx * Math.abs(fr.t[0]) + fp.hz * Math.abs(fr.t[1]);
    return { s, es, u, eu, s0: Math.max(0.25, s - es) };
  };
  const corridor = (q, s0) => Math.abs(q.u) - q.eu < d.w / 2 + 0.15 + 0.25 * s0;
  // 5a · a tall piece right under the unit (same wall), then tall solid furniture in the air path
  const under = t !== 'floor' && items.find(it => { const f = FURN[it.k]; if (f.wallItem || f.flat || f.porous) return false; const q = inFrame(it); return q.s - q.es < 0.3 && Math.abs(q.u) - q.eu < d.w / 2 + 0.1 && f.h > yBot - 0.3; });
  if (under) add('warn', `${FURN[under.k].th}อยู่ใต้เครื่องชิดเกินไป`, 'ลมที่ออกด้านล่างกระทบของ และช่างต้องมีที่ตั้งบันไดเพื่อถอดล้าง เว้นระยะใต้เครื่องอย่างน้อยราว 30 ซม. · คำแนะนำทั่วไป');
  let block = null;
  items.forEach(it => {
    const f = FURN[it.k]; if (it === under || f.wallItem || f.flat || f.porous || (t !== 'floor' && f.h < 1.3)) return;
    const q = inFrame(it); if (q.s + q.es < 0.25 || q.s0 > reach || q.s + q.es > room - 0.15 || !corridor(q, q.s0)) return;   // against the far wall: the wall ends the stream anyway
    if (f.h > jetBottom(q.s0) - 0.1 && (!block || q.s0 < block.s0)) block = { it, s0: q.s0 };
  });
  if (block) add('warn', `${FURN[block.it.k].th}บังทางลม (ห่างเครื่อง ~${block.s0.toFixed(1)} ม.)`, `ลมเย็นกระทบ${FURN[block.it.k].th}แล้ววกกลับ ด้านหลังจะเย็นช้า ลองย้ายของสูงออกจากแนวลม หรือเปลี่ยนผนังที่ติดแอร์ · คำแนะนำทั่วไป`);
  else if (!under) add('ok', 'ไม่มีของสูงบังทางลม', 'เฟอร์นิเจอร์ในห้องอยู่ต่ำกว่าแนวลมเย็นหรืออยู่นอกแนวลม');
  // 5b · comfort: where the stream meets a bed / a seat (wall + ceiling units)
  if (t === 'wall' || t === 'ceiling') {
    const bed = items.filter(it => FURN[it.k].sleep).map(it => ({ it, q: inFrame(it) })).filter(o => o.q.s0 < Math.min(reach, 4.5) && corridor(o.q, o.q.s0))[0];
    if (bed) {
      const qn = ((bed.it.q || 0) % 4 + 4) % 4, hd = [[0, -1], [-1, 0], [0, 1], [1, 0]][qn], half = FURN[bed.it.k].d / 2;   // head = local −z (headboard)
      const sh = (bed.it.x + hd[0] * half - fr.o[0]) * fr.n[0] + (bed.it.z + hd[1] * half - fr.o[1]) * fr.n[1];
      const sf = (bed.it.x - hd[0] * half - fr.o[0]) * fr.n[0] + (bed.it.z - hd[1] * half - fr.o[1]) * fr.n[1];
      if (sh > sf + 0.3) add('info', 'ลมเป่าเข้าหาศีรษะขณะนอน', 'แอร์อยู่ด้านปลายเท้า ลมเย็นจะไหลเข้าหาหน้า ตั้งบานสวิงให้ลมผ่านเหนือเตียง หรือย้ายแอร์ไปผนังด้านหัวเตียง/ด้านข้าง · คำแนะนำทั่วไปเพื่อความสบาย');
      else if (sf > sh + 0.3) add('ok', 'ลมผ่านเหนือเตียงจากหัวเตียงไปปลายเท้า', 'ตำแหน่งที่นิยมสำหรับห้องนอน ลมไม่เป่าตรงหน้า');
      else add('info', 'ลมผ่านขวางเตียง', 'ตั้งบานสวิงไม่ให้ลมตกตรงตัวขณะนอน · คำแนะนำทั่วไปเพื่อความสบาย');
    } else {
      const seat = items.filter(it => FURN[it.k].seat).map(it => ({ it, q: inFrame(it) })).find(o => { if (o.q.s0 > 3 || !corridor(o.q, o.q.s0)) return false; const qn = ((o.it.q || 0) % 4 + 4) % 4, fd = [[0, 1], [1, 0], [0, -1], [-1, 0]][qn]; return fd[0] * fr.n[0] + fd[1] * fr.n[1] < -0.5; });
      if (seat) add('info', `ลมเป่าตรงหน้าคนนั่ง${FURN[seat.it.k].th}`, 'ที่นั่งหันหน้าเข้าหาแอร์ในระยะใกล้ ปรับบานสวิงขึ้นหรือลดความแรงลม · คำแนะนำทั่วไปเพื่อความสบาย');
    }
  }
  // 5c · the unit drawn over a window / door on the same wall
  const hit = items.find(it => { const f = FURN[it.k]; if (!f.wallItem || it.wall !== S.place.wall) return false; return Math.abs(it.along - along) < f.w / 2 + d.w / 2 + 0.05 && yBot < f.sill + f.h && yTop > f.sill; });
  if (hit) add('warn', `ตำแหน่งเครื่องทับ${FURN[hit.k].th}`, 'ติดตั้งทับช่องเปิดไม่ได้ เลื่อนเครื่องหรือลากหน้าต่าง/ประตูในภาพไปตำแหน่งอื่น');
}
