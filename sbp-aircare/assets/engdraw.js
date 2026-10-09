// SBP AirCare — engineering section drawings (variant B): wall, ceiling-suspended and 4-way cassette indoor units.
// Service-manual style cross-sections with numbered callouts, air / condensate / refrigerant paths and a 7-step sequence
// that highlights the parts and the flow segment involved. Arrangement follows manufacturer documentation; not to scale.
import { TYPES, STEPS } from './hw-data.js';
import { h } from './sbp-core.js';

const f1 = n => n.toFixed(1);
/* ---------- drawing helpers (return SVG strings) ---------- */
function coil(x1, y1, x2, y2, w, part = 'coil') {
  const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L, nx = -uy * w / 2, ny = ux * w / 2;
  let s = `<g class="ed-p" data-part="${part}"><path class="ed-coil" d="M${f1(x1 + nx)} ${f1(y1 + ny)}L${f1(x2 + nx)} ${f1(y2 + ny)}L${f1(x2 - nx)} ${f1(y2 - ny)}L${f1(x1 - nx)} ${f1(y1 - ny)}Z"/>`;
  let fins = ''; for (let t = 4; t < L - 2; t += 4.2) fins += `M${f1(x1 + ux * t + nx)} ${f1(y1 + uy * t + ny)}L${f1(x1 + ux * t - nx)} ${f1(y1 + uy * t - ny)}`;
  s += `<path class="ed-fin" d="${fins}"/>`;
  for (let t = 9; t < L - 5; t += 17) [-0.45, 0.45].forEach((k, i) => { const tt = t + (i ? 8 : 0); if (tt < L - 4) s += `<circle class="ed-tube" cx="${f1(x1 + ux * tt + nx * k * 2 * 0.5)}" cy="${f1(y1 + uy * tt + ny * k)}" r="3.4"/>`; });
  return s + '</g>';
}
function crossFan(cx, cy, r) {
  let b = ''; for (let i = 0; i < 30; i++) { const a = i / 30 * Math.PI * 2, a2 = a + 0.22; b += `M${f1(cx + Math.cos(a) * r * 0.72)} ${f1(cy + Math.sin(a) * r * 0.72)}Q${f1(cx + Math.cos(a + 0.18) * r * 0.9)} ${f1(cy + Math.sin(a + 0.18) * r * 0.9)} ${f1(cx + Math.cos(a2) * r)} ${f1(cy + Math.sin(a2) * r)}`; }
  return `<g class="ed-p" data-part="fan"><circle class="ed-fanbg" cx="${cx}" cy="${cy}" r="${r}"/><g class="ed-spin" style="transform-origin:${cx}px ${cy}px"><path class="ed-blade" d="${b}"/></g><circle class="ed-hub" cx="${cx}" cy="${cy}" r="${f1(r * 0.12)}"/></g>`;
}
function sirocco(cx, cy, r) {
  let b = ''; for (let i = 0; i < 36; i++) { const a = i / 36 * Math.PI * 2; b += `M${f1(cx + Math.cos(a) * r * 0.78)} ${f1(cy + Math.sin(a) * r * 0.78)}L${f1(cx + Math.cos(a + 0.12) * r)} ${f1(cy + Math.sin(a + 0.12) * r)}`; }
  return `<circle class="ed-fanbg" cx="${cx}" cy="${cy}" r="${r}"/><g class="ed-spin" style="transform-origin:${cx}px ${cy}px"><path class="ed-blade" d="${b}"/></g><circle class="ed-hub" cx="${cx}" cy="${cy}" r="${f1(r * 0.14)}"/>`;
}
const flow = (cls, d, k) => `<path class="ed-flow ${cls}" data-flow="${k}" d="${d}" marker-end="url(#ed-ar-${cls.split(' ')[0]})"/>`;
const tag = (n, x, y, part, lx, ly) => `<g class="ed-tag" data-part="${part}" data-n="${n}" tabindex="0" role="button" aria-label="ชิ้นส่วนหมายเลข ${n}">${lx != null ? `<path class="ed-lead" d="M${x} ${y}L${lx} ${ly}"/>` : ''}<circle cx="${lx ?? x}" cy="${ly ?? y}" r="11"/><text x="${lx ?? x}" y="${(ly ?? y) + 4}">${n}</text></g>`;
const drops = (pts, k = 'water') => pts.map(([x, y]) => `<path class="ed-drop" data-flow="${k}" d="M${x} ${y}c-2.5 4-2.5 7 0 7s2.5-3 0-7z"/>`).join('');
const hatch = (x, y, w, hh) => `<rect class="ed-conc" x="${x}" y="${y}" width="${w}" height="${hh}" fill="url(#ed-hatch)"/>`;
const defs = () => `<defs>
  <pattern id="ed-hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="8" height="8" class="ed-hbg"/><path d="M0 0V8" class="ed-hl"/></pattern>
  <pattern id="ed-grid" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M20 0H0V20" class="ed-gl"/></pattern>
  ${['warm', 'cool', 'water', 'liq', 'gas'].map(c => `<marker id="ed-ar-${c}" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" class="ed-mk ${c}"/></marker>`).join('')}
</defs>`;
const title = (no, th) => `<g class="ed-title"><rect x="560" y="418" width="232" height="36"/><path d="M660 418V454M560 436H660"/><text x="566" y="431" class="s">DWG</text><text x="566" y="449">${no}</text><text x="668" y="433">${th}</text><text x="668" y="449" class="s">หน้าตัด A-A · ไม่ใช่มาตราส่วน</text></g>`;

/* ---------- drawings ---------- */
const DRAW = {
  wall: {
    parts: [[1, 'intake', 'ช่องลมกลับด้านบน'], [2, 'filter', 'แผ่นกรองฝุ่น'], [3, 'coil', 'คอยล์เย็น 3 ช่วง พับรอบพัดลม'], [4, 'fan', 'พัดลมกรงกระรอก (Cross-flow)'], [5, 'pan', 'ถาดน้ำทิ้งหน้า + รางน้ำหลัง'], [6, 'louver', 'บานสวิงแนวนอน + ครีบแนวตั้ง'], [7, 'outdoor', 'ท่อน้ำยา / ท่อน้ำทิ้งออกหลังเครื่อง']],
    svg: () => `
    ${hatch(40, 40, 36, 380)}<text class="ed-note v" x="30" y="230">ผนัง</text>
    <rect class="ed-plate" x="76" y="96" width="6" height="280"/>
    <g class="ed-p" data-part="casing"><path class="ed-case" d="M82 108H356Q392 108 394 146L390 318Q388 342 364 350L336 352"/><path class="ed-case" d="M82 108V372H300"/></g>
    <g class="ed-p" data-part="intake"><path class="ed-grille" d="${Array.from({ length: 13 }, (_, i) => `M${120 + i * 18} 100V114`).join('')}"/></g>
    <g class="ed-p" data-part="filter"><path class="ed-filter" d="M104 126H348Q372 128 374 156V252"/></g>
    ${coil(118, 176, 210, 136, 20)}${coil(210, 136, 346, 160, 20)}${coil(356, 176, 358, 288, 20)}
    <g class="ed-p" data-part="pan"><path class="ed-pan" d="M330 300H378V312H330Z"/><path class="ed-pan" d="M104 188H132V196H104Z"/></g>
    <path class="ed-guide" d="M132 206Q148 322 214 346T340 354"/><path class="ed-guide" d="M318 296Q300 300 296 314"/>
    ${crossFan(236, 262, 50)}
    <g class="ed-p" data-part="louver"><path class="ed-louver" d="M306 372L388 398"/><path class="ed-vane" d="M300 356V372M318 356V372M336 356V370M354 354V368"/></g>
    <g class="ed-p" data-part="outdoor"><circle class="ed-pipe gas" cx="96" cy="356" r="9"/><circle class="ed-pipe liq" cx="96" cy="336" r="6"/><path class="ed-hidden" d="M354 314Q356 346 300 366H100"/></g>
    ${flow('warm', 'M160 26V96', 'in')}${flow('warm', 'M236 20V96', 'in')}${flow('warm', 'M312 26V96', 'in')}
    ${flow('warm', 'M170 132Q176 170 206 206', 'in2')}${flow('warm', 'M300 140Q290 176 268 214', 'in2')}
    ${flow('cool', 'M250 318Q300 344 336 366', 'out')}${flow('cool', 'M372 404Q470 430 560 448', 'out')}${flow('cool', 'M392 386Q480 392 580 376', 'out')}
    ${drops([[346, 292], [358, 294], [118, 184]])}
    ${flow('water', 'M290 366H70', 'drain')}
    ${flow('liq', 'M20 336H86', 'refr')}${flow('gas', 'M86 356H20', 'refr')}
    <text class="ed-note" x="468" y="60">ลมอุ่นในห้องถูกดูดเข้าด้านบน</text><text class="ed-note s" x="150" y="388">ท่อน้ำทิ้งอยู่หลังระนาบตัด (เส้นประ)</text>
    <text class="ed-note" x="420" y="360">ลมเย็นออกด้านล่าง บานสวิงกำหนดทิศ</text>
    <text class="ed-note s" x="8" y="330">น้ำยาเหลว</text><text class="ed-note s" x="8" y="372">ไอน้ำยากลับ</text>
    ${tag(1, 236, 104, 'intake', 250, 64)}${tag(2, 360, 190, 'filter', 420, 150)}${tag(3, 280, 150, 'coil', 440, 190)}${tag(4, 236, 262, 'fan', 450, 250)}${tag(5, 354, 306, 'pan', 440, 300)}${tag(6, 350, 386, 'louver', 440, 410)}${tag(7, 96, 346, 'outdoor', 130, 404)}
    ${title('SOP-HW-01', 'แอร์ติดผนัง (Wall type)')}`,
  },
  ceiling: {
    parts: [[1, 'intake', 'ตะแกรงลมกลับใต้เครื่องครึ่งหลัง'], [2, 'filter', 'แผ่นกรองเหนือตะแกรง'], [3, 'fan', 'โบลเวอร์ซีร็อกโคในเสื้อพัดลม'], [4, 'coil', 'คอยล์เย็นวางเอียง'], [5, 'pan', 'ถาดน้ำทิ้งใต้คอยล์'], [6, 'louver', 'ช่องลมหน้า + บานสวิง'], [7, 'outdoor', 'ท่อน้ำยาออกด้านหลัง']],
    svg: () => `
    ${hatch(20, 30, 760, 34)}<text class="ed-note" x="30" y="24">พื้นคอนกรีตชั้นบน / เพดาน</text>
    <path class="ed-rod" d="M150 64V104M570 64V104"/>
    <g class="ed-p" data-part="casing"><path class="ed-case" d="M100 104H620V196M620 256V270H360M100 104V270H112"/><path class="ed-case" d="M606 196H620"/></g>
    <g class="ed-p" data-part="intake"><path class="ed-grille" d="${Array.from({ length: 14 }, (_, i) => `M${118 + i * 17} 264V276`).join('')}"/></g>
    <g class="ed-p" data-part="filter"><path class="ed-filter" d="M114 252H348"/></g>
    <g class="ed-p" data-part="fan"><path class="ed-scroll" d="M318 118Q236 96 176 130Q140 170 170 222Q206 258 262 244"/>${sirocco(236, 176, 50)}</g>
    ${coil(364, 116, 438, 238, 22)}
    <g class="ed-p" data-part="pan"><path class="ed-pan" d="M350 244H474V258H350Z"/></g>
    <g class="ed-p" data-part="louver"><path class="ed-louver" d="M606 250L660 262"/><path class="ed-vane" d="M590 204V248M572 204V248"/></g>
    <g class="ed-p" data-part="outdoor"><circle class="ed-pipe gas" cx="112" cy="140" r="9"/><circle class="ed-pipe liq" cx="112" cy="162" r="6"/></g>
    ${flow('warm', 'M160 400V286', 'in')}${flow('warm', 'M230 410V286', 'in')}${flow('warm', 'M300 400V286', 'in')}
    ${flow('warm', 'M236 246Q236 218 236 196', 'in2')}${flow('warm', 'M290 150Q330 150 380 170', 'in2')}
    ${flow('cool', 'M450 190Q540 210 600 222', 'out')}${flow('cool', 'M630 214Q700 150 790 118', 'out')}${flow('cool', 'M640 236Q720 200 790 196', 'out')}
    ${drops([[392, 236], [412, 240], [432, 238]])}
    ${flow('water', 'M470 252H548', 'drain')}
    ${flow('liq', 'M20 162H104', 'refr')}${flow('gas', 'M104 140H20', 'refr')}
    <text class="ed-note" x="640" y="104">ลมพุ่งไกลแนบฝ้า</text><text class="ed-note" x="170" y="430">ลมอุ่นจากห้องเข้าทางใต้เครื่อง</text>
    <text class="ed-note s" x="470" y="292">น้ำไหลไปท่อน้ำทิ้งด้านข้างเครื่อง</text>
    ${tag(1, 230, 270, 'intake', 90, 330)}${tag(2, 300, 252, 'filter', 330, 330)}${tag(3, 236, 176, 'fan', 120, 200)}${tag(4, 400, 178, 'coil', 470, 140)}${tag(5, 412, 252, 'pan', 470, 310)}${tag(6, 630, 256, 'louver', 690, 300)}${tag(7, 112, 150, 'outdoor', 60, 110)}
    ${title('SOP-HW-02', 'แอร์แขวนใต้ฝ้า (Ceiling)')}`,
  },
  cassette: {
    parts: [[1, 'intake', 'หน้ากากลมกลับตรงกลาง'], [2, 'filter', 'แผ่นกรอง'], [3, 'fan', 'ปากแตร + พัดลมเทอร์โบ + มอเตอร์'], [4, 'coil', 'คอยล์เย็นล้อมรอบพัดลม'], [5, 'pan', 'ถาดน้ำทิ้ง + ปั๊ม + ลูกลอย'], [6, 'louver', 'ช่องลมออก 4 ด้าน + บานสวิง'], [7, 'outdoor', 'ท่อน้ำยา / ท่อน้ำทิ้งเหนือฝ้า']],
    svg: () => `
    ${hatch(20, 26, 760, 30)}<text class="ed-note" x="30" y="20">พื้นคอนกรีตชั้นบน</text>
    <path class="ed-rod" d="M220 56V172M580 56V172"/>
    <path class="ed-ceil" d="M20 300H162M638 300H780"/><text class="ed-note s" x="30" y="316">ฝ้าเพดาน</text>
    <g class="ed-p" data-part="casing"><path class="ed-case" d="M190 300V172H610V300"/></g>
    <g class="ed-p" data-part="louver"><path class="ed-panel" d="M162 300H638V318H162Z"/><path class="ed-slot" d="M176 300H218V318H176ZM582 300H624V318H582Z"/><path class="ed-louver" d="M214 318L176 346M586 318L624 346"/></g>
    <g class="ed-p" data-part="intake"><path class="ed-grille" d="${Array.from({ length: 13 }, (_, i) => `M${282 + i * 20} 306V318`).join('')}"/></g>
    <g class="ed-p" data-part="filter"><path class="ed-filter" d="M280 298H520"/></g>
    <g class="ed-p" data-part="fan"><path class="ed-bell" d="M268 296Q300 290 318 262M532 296Q500 290 482 262"/><path class="ed-case" d="M308 206H492"/><path class="ed-case" d="M318 262H482"/><g class="ed-spin2">${Array.from({ length: 9 }, (_, i) => `<path class="ed-blade" d="M${326 + i * 19} 212L${320 + i * 19} 258"/>`).join('')}</g><rect class="ed-motor" x="366" y="176" width="68" height="30" rx="4"/><text class="ed-note s" x="376" y="195">มอเตอร์</text></g>
    ${coil(226, 196, 226, 280, 24)}${coil(574, 196, 574, 280, 24)}
    <g class="ed-p" data-part="pan"><path class="ed-pan" d="M204 282H262V292H204ZM538 282H596V292H538Z"/><rect class="ed-pump" x="592" y="226" width="14" height="24" rx="2"/><circle class="ed-float" cx="586" cy="286" r="4"/><path class="ed-drainp" d="M599 226V140H760"/><text class="ed-note s" x="610" y="134">ท่อน้ำทิ้งจากปั๊ม</text></g>
    <g class="ed-p" data-part="outdoor"><circle class="ed-pipe gas" cx="200" cy="190" r="8"/><circle class="ed-pipe liq" cx="200" cy="210" r="5"/></g>
    ${flow('warm', 'M340 440V326', 'in')}${flow('warm', 'M400 450V326', 'in')}${flow('warm', 'M460 440V326', 'in')}
    ${flow('warm', 'M400 292V266', 'in2')}${flow('warm', 'M360 236H250', 'in2')}${flow('warm', 'M440 236H550', 'in2')}
    ${flow('cool', 'M208 240Q196 280 198 306', 'out')}${flow('cool', 'M592 240Q604 280 602 306', 'out')}
    ${flow('cool', 'M188 330Q120 380 60 430', 'out')}${flow('cool', 'M612 330Q680 380 740 430', 'out')}
    ${drops([[226, 284], [574, 284]])}
    ${flow('water', 'M599 250V150Q600 140 612 140H770', 'drain')}
    ${flow('liq', 'M20 210H192', 'refr')}${flow('gas', 'M192 190H20', 'refr')}
    <text class="ed-note" x="300" y="466">ลมอุ่นจากห้องขึ้นทางหน้ากากกลาง</text><text class="ed-note" x="30" y="456">ลมเย็นออก 4 ทิศ</text>
    ${tag(1, 400, 318, 'intake', 470, 372)}${tag(2, 500, 298, 'filter', 520, 350)}${tag(3, 400, 234, 'fan', 400, 150)}${tag(4, 574, 238, 'coil', 520, 110)}${tag(5, 599, 238, 'pan', 690, 250)}${tag(6, 196, 332, 'louver', 110, 350)}${tag(7, 200, 200, 'outdoor', 120, 230)}
    ${title('SOP-HW-03', 'แอร์สี่ทิศทาง (Cassette)')}`,
  },
};
// which flows belong to each step
const STEP_FLOWS = { intake: ['in'], filter: ['in', 'in2'], coil: ['in2', 'refr'], water: ['water', 'drain'], fan: ['in2', 'out'], throw: ['out'], outdoor: ['refr'] };

export function mountEngDrawings(root, cfg = {}) {
  root.classList.add('ed');
  let type = cfg.start || 'wall', step = -1;
  const tabs = h('div', { class: 'ed-tabs', role: 'tablist', 'aria-label': 'ประเภทแอร์' });
  const sheet = h('div', { class: 'ed-sheet' });
  const legend = h('ol', { class: 'ed-legend' });
  const seq = h('div', { class: 'ed-seq', role: 'group', 'aria-label': 'ลำดับการทำงาน' });
  const cap = h('div', { class: 'ed-cap', 'aria-live': 'polite' });
  const keys = h('div', { class: 'ed-keys' }, ...[['warm', 'ลมอุ่นจากห้อง'], ['cool', 'ลมเย็นออก'], ['water', 'น้ำทิ้ง'], ['liq', 'น้ำยาเหลว (ท่อเล็ก)'], ['gas', 'ไอน้ำยากลับ (ท่อใหญ่)']].map(([k, t]) => h('span', {}, h('i', { class: 'k-' + k }), t)));
  root.append(tabs, h('div', { class: 'ed-grid' }, h('div', {}, sheet, keys), h('div', { class: 'ed-side' }, seq, cap, legend)),
    h('p', { class: 's-note' }, 'ภาพตัดแสดงตำแหน่งและหน้าที่ของชิ้นส่วนตามโครงสร้างในเอกสารผู้ผลิต ไม่ใช่แบบของรุ่นใดรุ่นหนึ่งและไม่ใช่มาตราส่วน ระยะยกท่อน้ำทิ้งของปั๊ม ขนาดท่อ และแรงบิดขันแฟลร์ต้องดูจากคู่มือของรุ่นนั้น'));
  function render() {
    tabs.innerHTML = '';
    Object.entries(TYPES).forEach(([k, t]) => tabs.append(h('button', { type: 'button', role: 'tab', 'aria-selected': k === type, onclick: () => { type = k; step = -1; render(); cfg.onType && cfg.onType(k); } }, t.th)));
    sheet.innerHTML = `<svg viewBox="0 0 800 470" class="ed-svg" role="group" aria-label="ภาพตัด${TYPES[type].th}"><rect width="800" height="470" fill="url(#ed-grid)" class="ed-bg"/>${defs()}${DRAW[type].svg()}</svg>`;
    legend.innerHTML = '';
    DRAW[type].parts.forEach(([n, p, th]) => legend.append(h('li', { 'data-part': p }, h('button', { type: 'button', onclick: () => mark(p) }, h('span', {}, String(n)), th))));
    seq.innerHTML = '';
    seq.append(h('span', { class: 's-lbl' }, 'ลำดับการทำงาน'), ...STEPS[type].map((s, i) => h('button', { type: 'button', 'aria-pressed': i === step, title: s.t, onclick: () => go(i) }, String(i + 1))), h('button', { type: 'button', class: 'all', 'aria-pressed': step < 0, onclick: () => go(-1) }, 'ทั้งหมด'));
    sheet.querySelectorAll('.ed-tag').forEach(t => { const f = () => mark(t.dataset.part); t.addEventListener('click', f); t.addEventListener('keydown', e => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), f())); });
    apply();
  }
  function go(i) { step = i; render(); }
  function mark(p) { const K = { grille: 'intake', front: 'intake', intake: 'intake', filter: 'filter', coil: 'coil', fan: 'fan', blower: 'fan', pan: 'water', pump: 'water', louver: 'throw', outdoor: 'outdoor' }; go(STEPS[type].findIndex(s => s.k === K[p])); }
  function apply() {
    const s = STEPS[type][step];
    const partOf = { intake: 'intake', filter: 'filter', coil: 'coil', water: 'pan', fan: 'fan', throw: 'louver', outdoor: 'outdoor' };
    const on = s ? partOf[s.k] : null, flows = s ? STEP_FLOWS[s.k] : null;
    sheet.classList.toggle('focus', !!s);
    sheet.querySelectorAll('.ed-p, .ed-tag').forEach(g => g.classList.toggle('on', g.dataset.part === on));
    sheet.querySelectorAll('[data-flow]').forEach(f => f.classList.toggle('on', !flows || flows.includes(f.dataset.flow)));
    legend.querySelectorAll('li').forEach(li => li.classList.toggle('on', li.dataset.part === on));
    cap.innerHTML = '';
    if (s) cap.append(h('b', {}, `${step + 1}. ${s.t}`), h('p', {}, s.d));
    else { const T = TYPES[type]; cap.append(h('b', {}, `${T.th}: หลักการทำงาน`), h('p', {}, `ลมเข้า ${T.inlet} · ลมออก ${T.outlet} · ${T.fan} · น้ำทิ้ง: ${T.drain}`)); }
  }
  render();
  return { setType(t) { if (TYPES[t] && t !== type) { type = t; step = -1; render(); } } };
}
