// SBP AirCare — service explorer: how each of the 4 main unit types works, and the full company workflow
// for cleaning / installing / repairing it, with pricebook prices and "add to quote".
// Rev.09 r7 (owner 2 ต.ค. 2569: "แอร์ตั้งตู้ไม่มีขั้นตอนให้ดู"): floor-standing added everywhere in this explorer
// (diagram, parts, clean / install / repair steps, sizes and Pricebook prices).
// Process text follows the company forms: SBP-SR-ACCL-UNI-001 Rev.07 (cleaning), SBP-SR-ACIN-UNI-001 Rev.04 (installation)
// and the repair section of the pricebook. Prices are read from DATA (standard rate only).
import { icon } from './icons.js';
import { DATA, CLEAN_PKGS, SIZE_BANDS, PRICING, TYPE_BY_ID, baht, btuFmt, installOptions, cleanRate, h, $$, reduceMotion } from './sbp-core.js';
import { cart, materialTable, cleanPackageGuide } from './commerce.js';
import { toast } from './proto-ui.js';

const MAIN = ['wall', 'ceiling', 'cassette', 'floor'];
const TYPE_TH = { wall: 'แอร์ติดผนัง', ceiling: 'แอร์แขวนใต้ฝ้า', cassette: 'แอร์สี่ทิศทาง', floor: 'แอร์ตู้ตั้งพื้น' };
const TYPE_SUB = {
  wall: 'บ้าน คอนโด ห้องนอน ห้องทำงาน · 9,000–30,000 BTU เป็นหลัก',
  ceiling: 'ร้านค้า ห้องโถง ร้านอาหาร ห้องยาว · ลมพุ่งไกลในแนวนอน',
  cassette: 'สำนักงาน ห้องประชุม โชว์รูม · ฝังฝ้า กระจายลมรอบทิศ',
  floor: 'ห้องประชุม โถงรับรอง ร้านอาหาร พื้นที่ที่แขวนหรือฝังฝ้าไม่ได้ · ตั้งพื้นชิดผนัง ลมออกด้านบน',
};

/* =========================================================
   1. How it works — animated cross-section per type
   Each part carries data-part so workflow steps can highlight it.
   ========================================================= */
const PARTS = {
  wall: [
    ['grille', 'ช่องลมกลับด้านบน', 'อากาศในห้องถูกดูดเข้าทางด้านบนของตัวเครื่อง'],
    ['filter', 'แผ่นกรองฝุ่น', 'ดักฝุ่นก่อนถึงคอยล์ ถ้าตัน ลมจะเบาและเย็นช้า'],
    ['coil', 'แผงคอยล์เย็น', 'ท่อทองแดงและครีบอะลูมิเนียม ดึงความร้อนออกจากอากาศ'],
    ['fan', 'พัดลมกรงกระรอก (Cross-flow)', 'ใบพัดยาวตลอดตัวเครื่อง ดูดลมผ่านคอยล์แล้วเป่าออกด้านล่าง'],
    ['pan', 'ถาดน้ำทิ้ง', 'รับน้ำที่กลั่นตัวจากคอยล์ ไหลออกทางท่อน้ำทิ้ง'],
    ['louver', 'บานสวิง', 'ปรับทิศลมขึ้น–ลง และซ้าย–ขวา'],
    ['outdoor', 'คอยล์ร้อน (นอกอาคาร)', 'คอมเพรสเซอร์และพัดลมระบายความร้อนออกนอกห้อง'],
  ],
  ceiling: [
    ['grille', 'ช่องลมกลับด้านล่าง/ด้านหลัง', 'ดูดอากาศจากใต้ตัวเครื่องด้านหลัง'],
    ['filter', 'แผ่นกรองฝุ่น', 'อยู่หลังหน้ากากลมกลับ ถอดล้างได้'],
    ['fan', 'พัดลมโบลเวอร์ (Sirocco)', 'ใบพัดหลายชุดบนแกนเดียว สร้างแรงลมให้พุ่งไกล'],
    ['coil', 'แผงคอยล์เย็น', 'วางขวางทางลมก่อนออกหน้าเครื่อง'],
    ['pan', 'ถาดน้ำทิ้ง', 'รับน้ำจากคอยล์ ต้องตั้งเครื่องให้ลาดไปทางท่อน้ำทิ้ง'],
    ['louver', 'บานสวิงหน้าเครื่อง', 'เป่าลมแนวนอนไปตามความยาวห้อง'],
    ['outdoor', 'คอยล์ร้อน (นอกอาคาร)', 'คอมเพรสเซอร์และพัดลมระบายความร้อน'],
  ],
  cassette: [
    ['grille', 'หน้ากากลมกลับตรงกลาง', 'ดูดอากาศจากกลางห้องขึ้นไปในเครื่อง'],
    ['filter', 'แผ่นกรองฝุ่น', 'อยู่หลังหน้ากากกลาง ถอดล้างจากใต้ฝ้า'],
    ['fan', 'พัดลมเทอร์โบ (Turbo fan)', 'ดูดลมขึ้นแนวตั้ง แล้วเหวี่ยงออกรอบตัว'],
    ['coil', 'แผงคอยล์เย็นล้อมรอบ', 'คอยล์ล้อมพัดลมทั้ง 4 ด้าน'],
    ['pan', 'ถาดน้ำทิ้ง', 'ถาดใต้คอยล์ รับน้ำจากทุกด้าน'],
    ['pump', 'ปั๊มน้ำทิ้ง + ลูกลอย (Float)', 'ยกน้ำขึ้นสู่ท่อน้ำทิ้ง ถ้าปั๊มหรือลูกลอยเสีย น้ำจะหยดจากฝ้า'],
    ['louver', 'บานสวิง 4 ทิศทาง', 'กระจายลมออก 4 ด้านรอบเครื่อง'],
    ['outdoor', 'คอยล์ร้อน (นอกอาคาร)', 'คอมเพรสเซอร์และพัดลมระบายความร้อน'],
  ],
  floor: [
    ['grille', 'ช่องลมกลับด้านล่างหน้าตู้', 'ดูดอากาศจากระดับพื้นเข้าตัวเครื่อง'],
    ['filter', 'แผ่นกรองฝุ่น', 'อยู่หลังหน้ากากลมกลับด้านล่าง ถอดล้างได้จากหน้าตู้'],
    ['fan', 'พัดลมโบลเวอร์ (Sirocco)', 'อยู่ส่วนล่างของตู้ ดันลมขึ้นผ่านคอยล์'],
    ['coil', 'แผงคอยล์เย็น', 'อยู่ส่วนบนของตู้ เหนือพัดลม'],
    ['pan', 'ถาดน้ำทิ้ง', 'ใต้คอยล์ น้ำไหลลงท่อน้ำทิ้งด้านหลังหรือด้านข้างตู้'],
    ['louver', 'ช่องลมออกด้านบน + บานสวิง', 'เป่าลมออกด้านบนหน้าตู้ ไปได้ไกล อย่าวางของบังหน้าเครื่อง'],
    ['outdoor', 'คอยล์ร้อน (นอกอาคาร)', 'คอมเพรสเซอร์และพัดลมระบายความร้อน'],
  ],
};

const fins = (x1, y1, x2, y2, n, len, ang = 0) => {
  let s = '';
  for (let i = 0; i <= n; i++) {
    const t = i / n, x = x1 + (x2 - x1) * t, y = y1 + (y2 - y1) * t;
    const dx = Math.cos(ang) * len, dy = Math.sin(ang) * len;
    s += `M${(x - dx).toFixed(1)} ${(y - dy).toFixed(1)}L${(x + dx).toFixed(1)} ${(y + dy).toFixed(1)}`;
  }
  return s;
};
const blades = (cx, cy, r, n, inner = 0.45) => {
  let s = '';
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2, b = a + 0.5;
    s += `M${(cx + Math.cos(a) * r * inner).toFixed(1)} ${(cy + Math.sin(a) * r * inner).toFixed(1)}Q${(cx + Math.cos(a + 0.35) * r * 0.8).toFixed(1)} ${(cy + Math.sin(a + 0.35) * r * 0.8).toFixed(1)} ${(cx + Math.cos(b) * r).toFixed(1)} ${(cy + Math.sin(b) * r).toFixed(1)}`;
  }
  return s;
};
const outdoor = (x, y) => `
  <g class="sv-p" data-part="outdoor">
    <rect x="${x}" y="${y}" width="74" height="54" rx="5" class="sv-body"/>
    <circle cx="${x + 26}" cy="${y + 27}" r="17" class="sv-ring"/>
    <g class="sv-spin" style="transform-origin:${x + 26}px ${y + 27}px"><path d="${blades(x + 26, y + 27, 15, 3, 0.2)}" class="sv-blade"/></g>
    <path d="${fins(x + 52, y + 8, x + 52, y + 46, 8, 7, 0)}" class="sv-fin"/>
    <text x="${x + 37}" y="${y + 68}" class="sv-t" text-anchor="middle">คอยล์ร้อน</text>
  </g>`;

function svgFor(type) {
  if (type === 'wall') return `
  <svg viewBox="0 0 420 250" class="sv-svg" role="img" aria-label="ภาพตัดแอร์ติดผนัง แสดงทางลมและชิ้นส่วน">
    <rect x="8" y="10" width="16" height="230" class="sv-wall"/>
    <path d="M24 44 H196 Q222 44 222 74 V146 Q222 170 196 172 H24 Z" class="sv-body"/>
    <g class="sv-p" data-part="grille"><path d="M44 44 V36 M64 44 V36 M84 44 V36 M104 44 V36 M124 44 V36 M144 44 V36 M164 44 V36 M184 44 V36" class="sv-grille"/><rect x="36" y="44" width="162" height="6" class="sv-hit"/></g>
    <g class="sv-p" data-part="filter"><path d="M40 56 L200 56 Q214 58 214 74" class="sv-filter"/></g>
    <g class="sv-p" data-part="coil"><path d="M48 66 L110 60 L196 72 L208 118" class="sv-coil"/><path d="${fins(48, 66, 110, 60, 10, 6, Math.PI / 2)}${fins(110, 60, 196, 72, 12, 6, Math.PI / 2)}${fins(196, 72, 208, 118, 7, 6, 0)}" class="sv-fin"/></g>
    <g class="sv-p" data-part="fan"><circle cx="132" cy="118" r="26" class="sv-ring"/><g class="sv-spin" style="transform-origin:132px 118px"><path d="${blades(132, 118, 25, 14, 0.7)}" class="sv-blade"/></g></g>
    <g class="sv-p" data-part="pan"><path d="M168 150 L214 150 L214 158 L168 158 Z" class="sv-pan"/><path d="M214 156 Q236 158 238 200 L238 236" class="sv-drain"/></g>
    <g class="sv-p" data-part="louver"><path d="M150 172 L196 190" class="sv-louver"/><path d="M110 172 L150 184" class="sv-louver thin"/></g>
    <path class="sv-air in" d="M70 6 C70 20 72 30 74 50 M120 6 C120 20 122 30 124 50 M170 6 C170 20 170 30 172 50"/>
    <path class="sv-air flow" d="M90 70 C100 90 110 100 120 104 M150 72 C150 90 146 100 140 106"/>
    <path class="sv-air out" d="M150 178 C200 200 250 206 300 212 M130 180 C170 210 200 226 240 240"/>
    <path class="sv-pipe" d="M24 150 H0"/>
    <g class="sv-dust"><circle cx="70" cy="24" r="2"/><circle cx="118" cy="30" r="1.6"/><circle cx="160" cy="20" r="2.2"/><circle cx="96" cy="14" r="1.4"/></g>
    ${outdoor(320, 150)}
    <path class="sv-refr" d="M8 150 C0 150 0 150 0 150 M238 120 H300 Q316 120 316 150 V170 H320"/>
  </svg>`;
  if (type === 'ceiling') return `
  <svg viewBox="0 0 420 250" class="sv-svg" role="img" aria-label="ภาพตัดแอร์แขวนใต้ฝ้า แสดงทางลมและชิ้นส่วน">
    <rect x="0" y="8" width="420" height="12" class="sv-wall"/>
    <path d="M60 20 V44 M270 20 V44" class="sv-rod"/>
    <path d="M30 44 H300 Q318 44 318 62 V102 Q318 118 300 118 H30 Z" class="sv-body"/>
    <g class="sv-p" data-part="grille"><path d="M44 118 V126 M62 118 V126 M80 118 V126 M98 118 V126 M116 118 V126" class="sv-grille"/><rect x="36" y="112" width="92" height="6" class="sv-hit"/></g>
    <g class="sv-p" data-part="filter"><path d="M38 106 L128 106" class="sv-filter"/></g>
    <g class="sv-p" data-part="fan"><circle cx="112" cy="78" r="22" class="sv-ring"/><g class="sv-spin" style="transform-origin:112px 78px"><path d="${blades(112, 78, 21, 18, 0.72)}" class="sv-blade"/></g><circle cx="168" cy="78" r="22" class="sv-ring ghost"/></g>
    <g class="sv-p" data-part="coil"><path d="M214 52 L236 110" class="sv-coil"/><path d="${fins(214, 52, 236, 110, 10, 7, 0)}" class="sv-fin"/></g>
    <g class="sv-p" data-part="pan"><path d="M204 110 L250 110 L250 116 L204 116 Z" class="sv-pan"/></g>
    <g class="sv-p" data-part="louver"><path d="M296 96 L322 104 M292 106 L320 116" class="sv-louver"/></g>
    <path class="sv-air in" d="M50 170 C60 150 70 140 80 124 M100 176 C104 156 106 140 108 124"/>
    <path class="sv-air flow" d="M112 100 C150 96 190 84 212 80 M240 80 C260 80 280 84 296 92"/>
    <path class="sv-air out" d="M322 106 C350 110 380 116 418 124 M320 116 C346 128 372 142 410 160"/>
    <g class="sv-dust"><circle cx="58" cy="156" r="2"/><circle cx="96" cy="162" r="1.6"/><circle cx="80" cy="140" r="1.4"/></g>
    <text x="380" y="98" class="sv-t" text-anchor="middle">ลมพุ่งไกล</text>
    ${outdoor(330, 176)}
    <path class="sv-refr" d="M318 70 H378 Q390 70 390 90 V176"/>
  </svg>`;
  if (type === 'floor') return `
  <svg viewBox="0 0 420 250" class="sv-svg" role="img" aria-label="ภาพตัดแอร์ตู้ตั้งพื้น แสดงทางลมและชิ้นส่วน">
    <rect x="8" y="6" width="16" height="234" class="sv-wall"/>
    <rect x="0" y="236" width="420" height="8" class="sv-ceil"/>
    <text x="300" y="232" class="sv-t" text-anchor="middle">พื้นห้อง</text>
    <path d="M24 22 H104 Q112 22 112 30 V236 H24 Z" class="sv-body"/>
    <g class="sv-p" data-part="louver"><path d="M112 38 L130 34 M112 50 L131 48 M112 62 L130 62" class="sv-louver"/><rect x="104" y="32" width="8" height="36" class="sv-hit"/></g>
    <g class="sv-p" data-part="coil"><path d="M34 150 L104 104" class="sv-coil"/><path d="${fins(34, 150, 104, 104, 11, 6, -0.6)}" class="sv-fin"/></g>
    <g class="sv-p" data-part="pan"><path d="M28 152 L62 152 L62 160 L28 160 Z" class="sv-pan"/><path d="M28 158 Q14 166 16 236" class="sv-drain"/></g>
    <g class="sv-p" data-part="fan"><circle cx="64" cy="196" r="24" class="sv-ring"/><g class="sv-spin" style="transform-origin:64px 196px"><path d="${blades(64, 196, 23, 16, 0.72)}" class="sv-blade"/></g></g>
    <g class="sv-p" data-part="filter"><path d="M102 172 L102 228" class="sv-filter"/></g>
    <g class="sv-p" data-part="grille"><path d="M112 176 H120 M112 186 H120 M112 196 H120 M112 206 H120 M112 216 H120 M112 226 H120" class="sv-grille"/><rect x="106" y="170" width="8" height="60" class="sv-hit"/></g>
    <rect x="86" y="84" width="20" height="10" rx="2" class="sv-pump"/>
    <path class="sv-air in" d="M220 214 C180 212 150 208 122 204 M220 190 C186 192 152 194 122 196"/>
    <path class="sv-air flow" d="M64 168 C66 150 70 132 74 112 M78 100 C86 80 96 62 106 50"/>
    <path class="sv-air out" d="M132 40 C180 34 240 36 300 46 M132 58 C190 70 240 90 290 116"/>
    <g class="sv-dust"><circle cx="196" cy="206" r="2"/><circle cx="168" cy="200" r="1.6"/><circle cx="150" cy="212" r="1.4"/></g>
    <text x="250" y="30" class="sv-t" text-anchor="middle">ลมออกด้านบน</text><text x="176" y="182" class="sv-t" text-anchor="middle">ลมกลับด้านล่าง</text>
    ${outdoor(330, 150)}
    <path class="sv-refr" d="M112 230 H300 Q316 230 316 214 V204 H330"/>
  </svg>`;
  return `
  <svg viewBox="0 0 420 250" class="sv-svg" role="img" aria-label="ภาพตัดแอร์สี่ทิศทาง แสดงทางลมและชิ้นส่วน">
    <rect x="0" y="4" width="420" height="10" class="sv-wall"/>
    <path d="M100 14 V30 M260 14 V30" class="sv-rod"/>
    <path d="M70 30 H290 V104 H70 Z" class="sv-body"/>
    <rect x="0" y="104" width="420" height="8" class="sv-ceil"/>
    <text x="16" y="100" class="sv-t">ฝ้าเพดาน</text>
    <path d="M52 112 H308 V122 H52 Z" class="sv-panel"/>
    <g class="sv-p" data-part="grille"><path d="M140 122 V128 M156 122 V128 M172 122 V128 M188 122 V128 M204 122 V128 M220 122 V128" class="sv-grille"/><rect x="132" y="116" width="96" height="8" class="sv-hit"/></g>
    <g class="sv-p" data-part="filter"><path d="M130 100 L230 100" class="sv-filter"/></g>
    <g class="sv-p" data-part="fan"><rect x="140" y="48" width="80" height="34" rx="6" class="sv-ring"/><g class="sv-spin" style="transform-origin:180px 65px"><path d="${blades(180, 65, 16, 9, 0.35)}" class="sv-blade"/></g></g>
    <g class="sv-p" data-part="coil"><path d="M92 40 L100 96 M268 40 L260 96" class="sv-coil"/><path d="${fins(92, 40, 100, 96, 9, 6, 0)}${fins(268, 40, 260, 96, 9, 6, 0)}" class="sv-fin"/></g>
    <g class="sv-p" data-part="pan"><path d="M80 96 H120 V102 H80 Z M240 96 H280 V102 H240 Z" class="sv-pan"/></g>
    <g class="sv-p" data-part="pump"><rect x="272" y="40" width="16" height="22" rx="3" class="sv-pump"/><circle cx="280" cy="70" r="4" class="sv-pump"/><path d="M288 46 H330 V14" class="sv-drain"/></g>
    <g class="sv-p" data-part="louver"><path d="M58 122 L40 138 M302 122 L320 138" class="sv-louver"/></g>
    <path class="sv-air in" d="M160 200 C164 170 168 150 170 130 M200 200 C198 170 194 150 192 130"/>
    <path class="sv-air flow" d="M170 96 C168 90 170 86 176 84 M150 60 C130 58 116 62 104 70 M210 60 C230 58 244 62 256 70"/>
    <path class="sv-air out" d="M50 128 C30 150 16 170 6 200 M310 128 C320 140 328 152 334 166"/>
    <g class="sv-dust"><circle cx="164" cy="182" r="2"/><circle cx="196" cy="176" r="1.6"/><circle cx="180" cy="160" r="1.4"/></g>
    <text x="40" y="226" class="sv-t">ลมออก ←</text><text x="262" y="172" class="sv-t">→ ลมออก</text><text x="180" y="236" class="sv-t" text-anchor="middle">↑ ลมกลับตรงกลาง</text>
    ${outdoor(342, 150)}
  </svg>`;
}

function mountHowItWorks(host, getType, onPart) {
  const stage = h('div', { class: 'sv-stage' });
  const legend = h('ol', { class: 'sv-legend' });
  const clog = h('button', { type: 'button', class: 's-btn ghost sv-clog', 'aria-pressed': 'false' }, 'จำลองฟิลเตอร์ตัน');
  const note = h('p', { class: 's-note' });
  host.append(h('div', { class: 'sv-how' }, h('div', { class: 'sv-how-l' }, stage, h('div', { class: 'sv-how-tools' }, clog, note)), legend));
  let dirty = false;
  clog.addEventListener('click', () => { dirty = !dirty; clog.setAttribute('aria-pressed', dirty); stage.classList.toggle('dirty', dirty); upd(); });
  function upd() {
    note.textContent = dirty
      ? 'ฝุ่นสะสมที่ฟิลเตอร์และคอยล์ทำให้ลมผ่านได้น้อยลง ห้องเย็นช้า คอมเพรสเซอร์ทำงานนานขึ้น และน้ำอาจล้นถาด (ภาพเพื่ออธิบายหลักการ ไม่ใช่ค่าวัดของเครื่องรุ่นใดรุ่นหนึ่ง)'
      : 'ลมในห้อง → ฟิลเตอร์ → คอยล์เย็น → พัดลม → บานสวิง → กลับเข้าห้องที่เย็นลง ส่วนความร้อนถูกส่งผ่านท่อน้ำยาไปทิ้งที่คอยล์ร้อน';
  }
  function render() {
    const type = getType();
    stage.innerHTML = svgFor(type);
    stage.classList.toggle('still', reduceMotion());
    legend.innerHTML = '';
    PARTS[type].forEach(([id, th, d], i) => legend.append(h('li', {}, h('button', { type: 'button', 'data-part': id, onmouseenter: () => mark(id), onfocus: () => mark(id), onclick: () => { mark(id); onPart && onPart(id); } }, h('b', {}, th), h('small', {}, d)))));
    upd();
  }
  function mark(id) {
    $$('.sv-p', stage).forEach(g => g.classList.toggle('on', g.dataset.part === id));
    $$('button[data-part]', legend).forEach(b => b.classList.toggle('on', b.dataset.part === id));
  }
  return { render, mark };
}

/* =========================================================
   2. Workflows — steps from the company forms
   phase: pre | work | c2 | test | hand ; part: highlight on the diagram
   ========================================================= */
export const PH = { pre: 'ก่อนเริ่มงาน', work: 'ขั้นตอนหลัก', c2: 'เพิ่มเฉพาะล้างใหญ่ C2', close: 'ประกอบกลับ', test: 'ทดสอบและตรวจวัด', hand: 'ส่งมอบ' };
export const PHC = { pre: 'ก่อนเริ่มงาน · แบบฟอร์มข้อ 1–2', work: 'รายการพื้นฐาน ทำทั้ง C1 และ C2 · ข้อ 3', c2: 'รายการเพิ่มเติม เฉพาะล้างใหญ่ C2 · ข้อ 3', close: 'การป้องกัน ประกอบกลับ และส่งคืนพื้นที่ · ข้อ 3', test: 'ทดสอบและตรวจวัด T1 / T2 · ข้อ 4', hand: 'ประเมินสภาพ ส่งมอบ ลงนาม · ข้อ 5–6' };

// Cleaning workflow = company form SBP-SR-ACCL-UNI-001 Rev.07 (one report per unit).
// Service level: Basic Clean (P1) → T1 checks · Standard Care (P2) → T2 measurements + 2–4 photos + grade A–D.
// Method: C1 Standard Cleaning (washed in place) · C2 Deep Clean (indoor coil un-hooked / lowered, refrigerant pipes NOT cut).
// Rev.09 r3: every step carries a stable id (no text change) so the teardown view (cleanguide.js) can show it in 3D.
export function cleanSteps(type, level, pkg) {
  const bag = { wall: 'ติดถุงล้างแอร์ใต้ตัวเครื่องต่อสายลงถัง', ceiling: 'ติดถุงรองน้ำใต้ตัวเครื่องตลอดความยาว', cassette: 'ติดถุงรับน้ำใต้หน้ากากทั้ง 4 ด้าน', floor: 'วางถาดรองน้ำใต้คอยล์ต่อสายลงถัง' }[type];
  const fan = { wall: 'พัดลมกรงกระรอก (Cross-flow)', ceiling: 'พัดลมโบลเวอร์ (Sirocco)', cassette: 'พัดลมเทอร์โบ', floor: 'พัดลมโบลเวอร์ (Sirocco)' }[type];
  const t2 = pkg !== 'Basic Clean', c2 = level === 'C2';
  const S = [
    { id: 'confirm', ph: 'pre', part: null, t: 'ยืนยันงานและข้อมูลเครื่อง', d: 'ตรวจ Asset/Tag ยี่ห้อ รุ่น หมายเลขเครื่อง ขนาด BTU และชนิดสารทำความเย็นจากป้ายเครื่อง ให้ตรงกับ QTN / PO / WO ยืนยันระดับบริการ วิธีล้าง และงานเสริมที่ได้รับอนุมัติ', chk: ['R32 / R410A / R22', t2 ? 'Standard Care (P2)' : 'Basic Clean (P1)', c2 ? 'Deep Clean (C2)' : 'Standard Cleaning (C1)', 'A1 / A2 / A4 เฉพาะที่อนุมัติ'] },
    { id: 'precheck', ph: 'pre', part: null, t: 'ตรวจสภาพก่อนเริ่มงานและสภาพเดิม', d: `เปิดเครื่องทดสอบ ตรวจความเย็น น้ำทิ้ง${type === 'cassette' ? ' ปั๊มน้ำทิ้งและลูกลอย' : ''} เสียงและการสั่น รีโมต Error Code บันทึกสภาพเดิมของเครื่องและทรัพย์สินใกล้เคียง ถ่ายภาพก่อนงาน ถ้าพบอาการผิดปกติ ช่างแจ้งก่อนเริ่มล้าง`, chk: ['รอยแตก / กรอบ / ซีด', 'สนิม / คราบฝังแน่น', 'ร่องรอยซ่อมเดิม', 'ฉนวนท่อเสื่อม'], you: 'สภาพเดิมถูกบันทึก คุ้มครองทั้งลูกค้าและบริษัท' },
    t2 ? { id: 'premeasure', ph: 'pre', part: null, t: 'วัดค่าก่อนงาน (T2)', d: 'วัดอุณหภูมิลมกลับ (Return) และลมจ่าย (Supply) ที่จุดเดิม คำนวณ ΔT วัดกระแสไฟขณะเดินเครื่องและแรงดันไฟ เพื่อเทียบหลังงาน', chk: ['Return °C', 'Supply °C', 'ΔT °C', 'Current A', 'Voltage V'] } : null,
    { id: 'power', ph: 'work', part: null, t: 'ตัดแยกไฟและตรวจยืนยันก่อนทำงาน', d: 'ปิดเบรกเกอร์เฉพาะวงจรเครื่อง แล้วตรวจยืนยันว่าไม่มีไฟเข้าเครื่องก่อนแตะชิ้นส่วนใด' },
    { id: 'cover', ph: 'work', part: null, t: 'คลุมป้องกันพื้น ผนัง และแผงวงจร', d: `ปูผ้าใบรองพื้น ${bag} คลุมแผงวงจรและเซนเซอร์ด้วยพลาสติกกันน้ำครบทุกจุด` },
    { id: 'parts', ph: 'work', part: 'grille', t: 'บันทึกจุดยึด แล้วถอดล้างแผ่นกรอง หน้ากาก บานสวิง', d: 'ถ่ายภาพหรือบันทึกตำแหน่งน็อต คลิป และจุดยึดก่อนถอด ถอดชิ้นส่วนพลาสติกออกมาล้างแยกนอกตัวเครื่อง' },
  ];
  if (c2) S.push(
    { id: 'lower', ph: 'c2', part: 'coil', t: { wall: 'ปลดคอยล์เย็นจากขายึด แขวนลอย / ลดระดับลง', ceiling: 'เปิดฝาครอบใต้เครื่อง เข้าถึงใบพัดและคอยล์ (เครื่องแขวนอยู่ที่เดิม)', cassette: 'ถอดหน้ากากตกแต่ง เข้าถึงใบพัด คอยล์ และถาด (เครื่องแขวนอยู่ที่เดิม)', floor: 'ถอดฝาหน้าและแผงข้างตู้ เข้าถึงใบพัดและถาด (ตู้ตั้งอยู่ที่เดิม)' }[type],
      d: type === 'wall' ? 'โน้มหรือลดระดับตัวเครื่องเพื่อเข้าถึงคอยล์ด้านหลังและใบพัด โดยท่อน้ำยาและสายไฟยังต่ออยู่' : 'เปิดเฉพาะส่วนที่เข้าถึงได้อย่างปลอดภัยตามแบบเครื่อง เพื่อเข้าถึงคอยล์ด้านที่ล้างปกติเข้าไม่ถึงและใบพัด โดยท่อน้ำยาและสายไฟยังต่ออยู่', you: 'ล้างได้ลึกกว่าล้างปกติ' },
    { id: 'nocut', ph: 'c2', part: null, t: 'ยืนยันไม่ตัดท่อน้ำยาและไม่เปิดวงจรน้ำยา', d: 'ถ้าต้องถอดแผงคอยล์ ตัดท่อ หรือเปิดวงจรสารทำความเย็น ถือเป็นงานยกเครื่อง (C3 Overhaul) แยกใบเสนอราคา' },
    { id: 'fanOut', ph: 'c2', part: 'fan', t: 'ถอดใบพัดโบลเวอร์ / โครงใบพัด', d: `ถอด${fan}และโครงออกมาล้าง คราบในใบพัดเป็นต้นเหตุหลักของกลิ่นอับและลมเบา` },
    { id: 'panOut', ph: 'c2', part: type === 'cassette' ? 'pump' : 'pan', t: 'ถอดถาดน้ำทิ้ง / จุดต่อทางน้ำทิ้ง', d: 'ถอดออกมาล้างเมือกและตะกอนที่ทำให้น้ำล้น' },
    { id: 'coilBack', ph: 'c2', part: 'coil', t: 'ล้างแผงคอยล์ด้านหลัง — จุดต่างสำคัญของ C2', d: 'ล้างด้านที่ล้างปกติเข้าไม่ถึง คอยล์จึงสะอาดทั้งสองด้าน' },
    { id: 'washParts', ph: 'c2', part: null, t: 'ล้างชิ้นส่วนที่ถอดแยกทีละชิ้นนอกตัวเครื่อง', d: 'ใบพัด โครงใบพัด ถาดน้ำทิ้ง จุดต่อทางน้ำทิ้ง หน้ากาก แผ่นกรอง บานสวิง' },
    { id: 'register', ph: 'c2', part: null, t: 'ลงทะเบียนชิ้นส่วนที่ถอด + ภาพ (บังคับ)', d: 'ถอดจริงต้องมีภาพ ถ้าไม่บันทึกถือว่าไม่ได้ทำ ชิ้นที่ไม่ได้ถอดต้องระบุเหตุผล', chk: ['แผงหน้ากาก', 'บานสวิง', 'ถาดน้ำทิ้ง', 'ใบพัดโบลเวอร์', 'โครงใบพัด', 'จุดต่อทางน้ำทิ้ง'], you: 'รู้ว่าชิ้นไหนถูกถอดล้างจริง' },
  );
  S.push(
    { id: 'chem', ph: 'work', part: 'coil', t: 'ฉีดน้ำยาล้างคอยล์ ทิ้งให้คราบหลุด', d: 'บันทึกชนิดและปริมาณน้ำยาที่ใช้จริง · A1 น้ำยาล้างคอยล์กรดอุตสาหกรรม หรือ A2 Chemical Wash สเปรย์โฟมเกรด อย. ทำเมื่ออนุมัติในใบเสนอราคา' },
    { id: 'coilFront', ph: 'work', part: 'coil', t: 'ล้างแผงคอยล์เย็นด้านหน้า', d: 'ฉีดตามแนวครีบจากบนลงล่างด้วยแรงดันที่เหมาะกับครีบ ไม่ฉีดเฉียงจนครีบล้ม น้ำสกปรกลงถุงและถัง' },
    c2 ? null : { id: 'fanWash', ph: 'work', part: 'fan', t: `ล้าง${fan}เท่าที่หัวฉีดเข้าถึง`, d: 'C1 ล้างที่ตำแหน่งเดิม หมุนใบพัดให้ล้างได้ทั่วทีละช่วง โดยไม่ถอดใบพัด' },
    { id: 'drain', ph: 'work', part: type === 'cassette' ? 'pump' : 'pan', t: 'ล้างและทะลวงถาด / ทางน้ำทิ้ง', d: `ล้างเมือก ทะลวงทางน้ำ${type === 'cassette' ? ' ตรวจปั๊มน้ำทิ้งและลูกลอย' : ''} แล้วเทน้ำทดสอบให้ไหลออกปลายท่อได้ปกติ` },
    { id: 'outdoor', ph: 'work', part: 'outdoor', t: 'ฉีดล้างคอยล์ร้อนจากภายนอก', d: 'ล้างครีบระบายความร้อน ตรวจใบพัด ฐานรอง และยางรองกันสั่น ถ้าเข้าถึงอย่างปลอดภัยไม่ได้ บันทึก "ไม่รวม / เข้าไม่ถึง"' },
    { id: 'dry', ph: 'close', part: null, t: 'เป่าและเช็ดให้แห้ง ตรวจฉนวนและจุดยึด', d: 'ชิ้นส่วนแห้งก่อนประกอบ ไม่มีน้ำค้างใกล้แผงวงจร ตรวจฉนวนท่อและจุดยึดก่อนประกอบกลับ' },
    { id: 'assemble', ph: 'close', part: null, t: c2 ? 'ประกอบกลับครบ ยึดเครื่องเข้าที่ ตรวจการรั่วซึม' : 'ประกอบกลับครบ ไม่มีชิ้นส่วนเหลือ', d: c2 ? 'ใส่ใบพัดและถาดกลับ แขวนตัวเครื่องให้ล็อกครบทุกจุด ประกอบตามทะเบียนชิ้นส่วน ตรวจจุดต่อไม่รั่วซึม' : 'ประกอบตามตำแหน่งที่บันทึกไว้ เก็บพลาสติกคลุม ถุงล้าง และผ้าใบ', you: 'ไม่มีชิ้นส่วนเหลือ' },
    { id: 'cleanup', ph: 'close', part: null, t: 'ทำความสะอาดและส่งคืนพื้นที่', d: 'เช็ดพื้นและผนังบริเวณที่ทำงาน ถ่ายภาพหลังงานให้ครบ' },
    { id: 'testDrain', ph: 'test', part: type === 'cassette' ? 'pump' : 'pan', t: 'ทดสอบระบายน้ำทิ้ง (T1 · ทุกระดับ)', d: 'เทน้ำทดสอบ ตรวจว่าไหลออกปกติ ไม่ย้อนหรือซึม', chk: type === 'cassette' ? ['ถาด', 'ท่อ', 'ปั๊ม', 'ลูกลอย'] : ['ถาด', 'ท่อ'] },
    { id: 'testRun', ph: 'test', part: null, t: 'ทดสอบเดินเครื่องหลังงาน (T1 · ทุกระดับ)', d: 'เปิดไฟ เดินเครื่องทดสอบครบทุกโหมดที่เกี่ยวข้อง', chk: ['เดินเครื่องปกติ', 'รีโมตปกติ', 'ไม่มี Error ใหม่', 'เสียง / การสั่นปกติ', 'ลมออกสม่ำเสมอ'] },
    t2 ? { id: 'postmeasure', ph: 'test', part: null, t: 'วัดค่าหลังงาน (T2) เทียบก่อนงาน', d: 'วัดที่จุดเดิม บันทึก Return Supply ΔT กระแส และแรงดัน · ไม่มีค่า ΔT ผ่าน/ไม่ผ่านค่าเดียวที่ใช้ได้ทุกยี่ห้อ', you: 'เห็นตัวเลขก่อน–หลังในรายงาน' }
       : { id: 'basicCheck', ph: 'test', part: null, t: 'Basic Clean: ตรวจการทำงาน (T1)', d: 'แพ็กเกจนี้ไม่รวมการวัดอุณหภูมิและค่าไฟฟ้า (T2)', off: true },
    { id: 'a4', ph: 'test', part: 'outdoor', t: 'A4 ตรวจระบบสารทำความเย็น (เมื่ออนุมัติ / พบผิดปกติ)', d: 'บันทึกแรงดันด้านต่ำ ด้านสูง (psi) อุณหภูมิแวดล้อม และเวลาที่เดินเครื่องคงที่ ใช้ประกอบการวินิจฉัย ไม่รับประกันว่าจะพบจุดรั่ว', off: true },
    { id: 'grade', ph: 'hand', part: null, t: t2 ? 'ประเมินสภาพเครื่อง A–D และบันทึกสิ่งที่พบ' : 'บันทึกสิ่งที่พบระหว่างล้าง', d: t2 ? 'A ปกติ · B ใช้งานได้ ควรเฝ้าระวัง · C ควรแก้ไขรอบถัดไป · D เร่งด่วน ควรหยุดใช้งาน พร้อมปัญหาที่อยู่นอกขอบเขตงานล้างและงานที่เสนอเพิ่ม' : 'Basic Clean ไม่ให้เกรด (N/A) แจ้งสิ่งที่พบและงานที่ควรทำเพิ่ม' },
    { id: 'next', ph: 'hand', part: null, t: 'สถานะส่งมอบและรอบล้างถัดไป', d: 'ใช้งานได้ตามปกติ / มีข้อควรระวัง / นัดตรวจ-ซ่อมเพิ่ม / แจ้งหยุดใช้งาน และกำหนดรอบถัดไปโดยประมาณ', chk: ['ทุก 3 เดือน', 'ทุก 4 เดือน', 'ทุก 6 เดือน', 'ทุก 12 เดือน'] },
    { id: 'sign', ph: 'hand', part: null, t: 'ลงนามรับรอง 3 ฝ่าย', d: 'ช่างผู้ปฏิบัติงาน หัวหน้าทีม และลูกค้าลงนามรับมอบ พร้อมประเมินความพึงพอใจ ต้นฉบับให้ลูกค้า สำเนาเก็บที่บริษัท', you: 'ลูกค้าตรวจผลงานและลงนามรับงาน' },
  );
  return S.filter(Boolean);
}

const INS_TEST = {
  MASS: { leak: false, vac: 'Vacuum ขั้นพื้นฐาน', rec: false, photo: false, follow: false },
  STANDARD: { leak: 'ตรวจรอยต่อตามจุดที่เข้าถึงได้', vac: 'Vacuum ก่อนปล่อยน้ำยา', rec: true, photo: true, follow: false },
  PREMIUM: { leak: 'ทดสอบรั่วด้วยไนโตรเจนเมื่อเหมาะสม + ตรวจแรงบิดขันแฟลร์', vac: 'Vacuum และทดสอบค้างความดัน (Vacuum Hold)', rec: true, photo: true, follow: true },
};
export function installSteps(type, lv) {
  const T = INS_TEST[lv];
  const mount = {
    wall: 'ยึดแผ่นยึดกับผนังให้ได้ระดับ ตรวจผนังรับน้ำหนักได้ และเจาะผนังลาดออกด้านนอก',
    ceiling: 'แขวนด้วยก้านเกลียวยึดโครงสร้างด้านบน ปรับระดับตามคู่มือให้น้ำไหลไปทางท่อน้ำทิ้ง',
    cassette: 'เปิดฝ้าตามขนาดหน้ากาก แขวนก้านเกลียวจากพื้นชั้นบน ตั้งระยะตัวเครื่องกับฝ้าตามคู่มือ',
    floor: 'วางตัวเครื่องตามตำแหน่งบนพื้นที่รับน้ำหนักได้ ปรับระดับ ยึดกันล้มกับผนังตามคู่มือ และเจาะผนังด้านหลังหรือด้านข้างสำหรับแนวท่อ',
  }[type];
  const drain = {
    wall: 'เดินท่อน้ำทิ้งให้ลาดตลอดแนว ไม่ย้อนขึ้น',
    ceiling: 'เดินท่อน้ำทิ้งให้ลาดตลอดแนว ทำ Trap เมื่อจำเป็น',
    cassette: 'ต่อท่อน้ำทิ้งจากปั๊มในตัวเครื่อง เทน้ำทดสอบปั๊มและลูกลอย',
    floor: 'เดินท่อน้ำทิ้งจากถาดด้านล่างตัวเครื่องให้ลาดตลอดแนว ไม่ย้อนขึ้น',
  }[type];
  return [
    { id: 'survey', ph: 'pre', part: null, t: 'สำรวจหน้างาน', d: 'ตำแหน่งคอยล์เย็น–คอยล์ร้อน แนวและระยะท่อ ระบบไฟ เบรกเกอร์ ความสูง และโครงสร้างที่ต้องรับน้ำหนัก แจ้งวัสดุส่วนเกินก่อนเริ่มงาน', you: 'รู้ค่าใช้จ่ายส่วนเกินก่อนเริ่มงาน' },
    { id: 'receive', ph: 'pre', part: null, t: 'ตรวจรับเครื่อง', d: 'รุ่นและ Serial จากป้าย Nameplate ต้องตรงกับใบเสนอราคาและ BTU ที่ตกลง ตรวจสภาพกล่องและอุปกรณ์ในกล่อง' },
    { id: 'indoor', ph: 'work', part: 'coil', t: 'ติดตั้งคอยล์เย็น', d: mount },
    { id: 'outdoor', ph: 'work', part: 'outdoor', t: 'ติดตั้งคอยล์ร้อน', d: 'ขาแขวนหรือฐานรองพร้อมยางกันสั่น เว้นระยะระบายความร้อนตามคู่มือ' },
    { id: 'piping', ph: 'work', part: null, t: 'เดินท่อน้ำยาและหุ้มฉนวน', d: 'ท่อไม่หักงอ บานแฟลร์หรือเชื่อมตามมาตรฐาน หุ้มฉนวนตลอดแนวและเก็บในราง' },
    { id: 'drain', ph: 'work', part: type === 'cassette' ? 'pump' : 'pan', t: 'ระบบน้ำทิ้ง', d: drain + ' แล้วทดสอบการไหล' },
    { id: 'electric', ph: 'work', part: null, t: 'ระบบไฟฟ้าและรีโมต', d: 'สายไฟตามกระแสของรุ่น เบรกเกอร์แยกวงจร ต่อสายดิน กรณี 3 เฟสตรวจลำดับเฟส และตั้งค่ารีโมต' },
    { id: 'leak', ph: 'test', part: null, t: 'ทดสอบรอยรั่ว', d: T.leak || 'แพ็กเกจพื้นฐานตรวจเฉพาะหลังเปิดเครื่อง', off: !T.leak },
    { id: 'vacuum', ph: 'test', part: null, t: 'ทำสุญญากาศ (Vacuum)', d: `${T.vac} เพื่อไล่อากาศและความชื้นออกจากท่อก่อนเปิดวาล์วน้ำยา${T.rec ? ' บันทึกเวลาและค่าที่วัดได้' : ''}` },
    { id: 'valve', ph: 'test', part: null, t: 'เปิดวาล์วและเติมน้ำยาส่วนเกิน (ถ้ามี)', d: 'เติมเพิ่มเฉพาะเมื่อท่อยาวเกินระยะที่ผู้ผลิตกำหนด บันทึกปริมาณที่เติม' },
    { id: 'testrun', ph: 'test', part: null, t: 'เดินเครื่องทดสอบ (Test Run)', d: T.rec ? 'วัดแรงดันไฟ (V) กระแส (A) อุณหภูมิลมกลับ ลมจ่าย ΔT ตรวจน้ำทิ้ง รีโมต และไม่มี Error' : 'ตรวจ Function และน้ำทิ้ง (แพ็กเกจนี้ไม่รวมบันทึกค่าไฟฟ้า)', you: T.rec ? 'เห็นค่าที่วัดได้ในใบรับมอบ' : null },
    { id: 'cleanup', ph: 'hand', part: null, t: 'เก็บงานและทำความสะอาด', d: T.photo ? 'ตรวจรายการค้าง (Punch list) ถ่ายภาพก่อน–หลังและค่าที่วัดได้' : 'ตรวจรายการค้างและทำความสะอาดพื้นที่' },
    { id: 'handover', ph: 'hand', part: null, t: 'ส่งมอบและสอนใช้งาน', d: `ส่งรีโมต คู่มือ บัตรรับประกัน/QR สอนการใช้งานและการล้างฟิลเตอร์ ตั้งรอบบริการครั้งถัดไป${T.follow ? ' และนัดตรวจติดตาม 2 ครั้ง' : ''}`, you: 'รับเอกสารรับประกันงานติดตั้ง' },
  ];
}

// Rev.09 r4 (owner: "ใส่รายละเอียดวิธีล้างแอร์แขวน สี่ทิศทาง ตู้ตั้ง และงานติดตั้ง ให้ละเอียดทุกขั้นตอน"):
// how each step is done on each unit type — general technician practice that sits UNDER the company form steps
// (the form text above stays the source; these notes never add a promise, a price or a measured value).
// ⚠️ For the tech lead to review (CLAUDE.md §7.3).
export const CLEAN_HOW = {
  wall: {
    cover: 'ครอบถุงล้างใต้ตัวเครื่องให้ตลอดแนว ต่อสายลงถังบนพื้น ปูเสื่อ/ผ้าใบใต้จุดทำงาน คลุมแผงวงจรด้านขวาของเครื่อง',
    parts: 'ยกฝาหน้าขึ้น ถอดแผ่นกรองซ้าย–ขวา ปลดตะขอฝาหน้าแล้วยกออก ถอดบานสวิง ส่งให้ช่างผู้ช่วยด้านล่างนำไปวางเรียงบนโต๊ะ',
    lower: 'ปลดตะขอด้านล่างของตัวเครื่องจากเพลทแขวน โน้มตัวเครื่องออกจากผนังแล้วหนุนไว้ ท่อน้ำยาและสายไฟยังต่ออยู่ตลอด',
    fanOut: 'ปลดน็อตยึดใบพัดกับแกนมอเตอร์ ถอดตลับลูกปืนฝั่งตรงข้าม แล้วเลื่อนใบพัดออกทางด้านข้าง',
    panOut: 'ปลดถาดน้ำทิ้งออกจากตัวเครื่องและสายน้ำทิ้ง',
    coilBack: 'ฉีดคอยล์ด้านที่ติดผนังขณะตัวเครื่องโน้มออก น้ำไหลลงถุงล้าง',
    chem: 'พ่นน้ำยาให้ทั่วหน้าคอยล์ ทิ้งไว้ให้คราบหลุดตามเวลาที่ผู้ผลิตน้ำยากำหนด',
    coilFront: 'ฉีดตามแนวครีบจากบนลงล่าง ระยะหัวฉีดพอเหมาะ ไม่ฉีดเฉียงจนครีบล้ม',
    fanWash: 'หมุนใบพัดด้วยมือทีละช่วง แล้วฉีดผ่านช่องลมออก',
    drain: 'เทน้ำลงถาด ดูน้ำไหลออกปลายท่อด้านนอก',
    testDrain: 'เทน้ำทดสอบลงถาดอีกครั้งหลังประกอบ ตรวจไม่มีน้ำซึมใต้ตัวเครื่อง',
  },
  ceiling: {
    cover: 'ติดถุงรองน้ำใต้ตัวเครื่องตลอดความยาว กั้นพื้นที่ทำงานในร้าน/สำนักงาน ปูเสื่อใต้จุดทำงาน คลุมกล่องควบคุมด้านข้าง',
    parts: 'เปิดหน้ากากลมกลับใต้เครื่อง ถอดแผ่นกรอง ถอดบานสวิงหน้าเครื่อง ส่งต่อให้ผู้ช่วยด้านล่าง',
    lower: 'ถอดฝาครอบใต้เครื่องเพื่อเข้าถึงใบพัดและคอยล์ ตัวเครื่องยังแขวนบนก้านเกลียว ท่อยังต่ออยู่',
    fanOut: 'ถอดฝาครอบโข่งลม ปลดใบพัดโบลเวอร์ทีละชุดออกจากแกน',
    panOut: 'ปลดถาดน้ำทิ้งพร้อมจุดต่อท่อน้ำทิ้ง',
    coilBack: 'ฉีดคอยล์จากด้านลมออก (ด้านที่ล้างปกติเข้าไม่ถึง)',
    chem: 'พ่นน้ำยาที่หน้าคอยล์ด้านลมเข้าให้ทั่วทั้งแผง',
    coilFront: 'ฉีดคอยล์จากด้านลมเข้าไล่ตามความยาวเครื่อง น้ำไหลลงถุงรองน้ำ',
    fanWash: 'ฉีดใบพัดโบลเวอร์ผ่านช่องลมกลับทีละชุด หมุนใบพัดด้วยมือ',
    drain: 'ตรวจความลาดของตัวเครื่องไปทางท่อน้ำทิ้ง เทน้ำทดสอบ',
    testDrain: 'เทน้ำทดสอบ ตรวจน้ำไม่ค้างถาดและไม่ย้อน',
  },
  cassette: {
    cover: 'ติดถุงรับน้ำใต้หน้ากากทั้ง 4 ด้าน ย้ายโต๊ะและเก้าอี้ใต้เครื่องออก ปูเสื่อ คลุมกล่องควบคุม',
    parts: 'ปลดตะขอหน้ากากลมกลับตรงกลาง ถอดแผ่นกรอง (หน้ากากตกแต่งยังติดอยู่) ส่งต่อให้ผู้ช่วย',
    lower: 'ถอดหน้ากากตกแต่ง (ปลดสายบานสวิงก่อน) เพื่อเข้าถึงใบพัดและถาด ตัวเครื่องยังแขวนอยู่ ท่อยังต่ออยู่',
    fanOut: 'ถอดกรวยลม (Bell mouth) แล้วปลดน็อตใบพัดเทอร์โบออกจากแกนมอเตอร์',
    panOut: 'ปลดถาดน้ำทิ้ง ระวังสายปั๊มน้ำทิ้งและลูกลอย',
    coilBack: 'ฉีดคอยล์ด้านนอกที่ล้อมใบพัด (ด้านที่ล้างปกติเข้าไม่ถึง)',
    chem: 'พ่นน้ำยาที่คอยล์ด้านในรอบตัวใบพัด',
    coilFront: 'ฉีดคอยล์ด้านในรอบตัวเครื่องจากช่องลมกลับ น้ำลงถุงรับน้ำ',
    fanWash: 'ฉีดใบพัดเทอร์โบผ่านช่องลมกลับ หมุนใบพัดด้วยมือ',
    drain: 'เทน้ำลงถาดให้ลูกลอยยกตัว ตรวจว่าปั๊มน้ำทิ้งทำงานและน้ำไหลออกปลายท่อ',
    testDrain: 'เทน้ำทดสอบให้ปั๊มทำงาน ตรวจปั๊ม ลูกลอย และไม่มีน้ำหยดจากฝ้า',
  },
  floor: {
    cover: 'ปูเสื่อรอบตัวเครื่อง วางถาดรองน้ำใต้คอยล์ ต่อสายลงถัง คลุมแผงวงจร กั้นพื้นที่ห้องประชุม/โถงต้อนรับ',
    parts: 'เปิดฝาหน้าตู้ ถอดแผ่นกรองช่องลมกลับด้านล่าง ถอดหน้ากากลมออกด้านบน',
    lower: 'ถอดแผงหน้าและแผงข้างที่ถอดได้ เพื่อเข้าถึงใบพัดและถาด ตัวเครื่องตั้งอยู่ที่เดิม ท่อยังต่ออยู่',
    fanOut: 'ปลดโข่งลมและใบพัดโบลเวอร์ส่วนล่างของตัวตู้',
    panOut: 'ปลดถาดน้ำทิ้งใต้คอยล์พร้อมจุดต่อท่อน้ำทิ้ง',
    coilBack: 'ฉีดคอยล์ด้านหลังจากช่องที่เปิดแผงข้าง',
    chem: 'พ่นน้ำยาที่หน้าคอยล์ซึ่งตั้งอยู่ส่วนบนของตู้',
    coilFront: 'ฉีดคอยล์จากบนลงล่างให้น้ำลงถาดใต้คอยล์',
    fanWash: 'ฉีดใบพัดโบลเวอร์ผ่านช่องลมกลับด้านล่าง หมุนใบพัดด้วยมือ',
    drain: 'เทน้ำลงถาด ตรวจน้ำไหลออกปลายท่อ',
    testDrain: 'เทน้ำทดสอบ ตรวจไม่มีน้ำซึมที่พื้นรอบตู้',
  },
};
export const INSTALL_HOW = {
  wall: { survey: 'วัดผนังที่จะติด ระยะถึงฝ้าและมุมห้อง แนวท่อผ่านผนังถึงตำแหน่งคอยล์ร้อน', indoor: 'ยึดเพลทแขวนด้วยพุกให้ได้ระดับ เจาะรูผนังลาดออกด้านนอก ใส่ปลอกรูผนัง แล้วแขวนตัวเครื่องให้ล็อกครบทุกจุด', piping: 'ดัดท่อด้วยเครื่องมือดัดท่อ บานแฟลร์ ขันตามแรงบิด หุ้มฉนวนตลอดแนวและเก็บในรางครอบท่อ', outdoor: 'ติดขาแขวนหรือวางฐานพร้อมยางกันสั่น เว้นระยะระบายความร้อน' },
  ceiling: { survey: 'ตรวจโครงสร้างเหนือฝ้า/ใต้พื้นชั้นบน ความสูงที่แขวนได้ แนวท่อน้ำทิ้งที่ลาดได้ และไม่มีคานขวางแนวลม', indoor: 'ยึดพุกเพดานและก้านเกลียว ช่างสองคนยกตัวเครื่องขึ้นแขวน ปรับระดับให้ลาดไปทางท่อน้ำทิ้ง', piping: 'เดินท่อตามแนวฝ้าในราง หุ้มฉนวนตลอดแนว ยึดหิ้วท่อเป็นระยะ', outdoor: 'วางคอยล์ร้อนบนฐานหรือขาแขวนพร้อมยางกันสั่น เว้นระยะระบายความร้อน' },
  cassette: { survey: 'ตรวจความสูงเหนือฝ้าที่ต้องพอสำหรับตัวเครื่อง ตำแหน่งกลางห้อง และโครงฝ้าที่ต้องเปิด', indoor: 'เปิดฝ้าตามแบบกระดาษ (Template) ของรุ่น ยึดก้านเกลียว ช่างสองคนยกเครื่องขึ้นเหนือฝ้า ตั้งระยะกับฝ้าตามคู่มือ ติดหน้ากากหลังเดินท่อ', piping: 'เดินท่อเหนือฝ้า หุ้มฉนวนตลอดแนว ต่อท่อน้ำทิ้งจากปั๊มในตัวเครื่อง', outdoor: 'วางคอยล์ร้อนบนฐานพร้อมยางกันสั่น เว้นระยะระบายความร้อน' },
  floor: { survey: 'ตรวจพื้นรับน้ำหนัก ระยะหน้าเครื่องโล่งสำหรับลมออก ตำแหน่งเจาะผนังด้านหลังหรือด้านข้าง', indoor: 'ช่างสองคนยกตัวเครื่องวางตำแหน่ง ปรับระดับ ยึดกันล้มกับผนัง เจาะผนังสำหรับท่อ', piping: 'ต่อท่อจากด้านหลังหรือด้านข้างตัวเครื่องผ่านผนัง หุ้มฉนวนและเก็บในรางครอบท่อ', outdoor: 'วางคอยล์ร้อนบนฐานพร้อมยางกันสั่น เว้นระยะระบายความร้อน' },
};

export const repairSteps = type => [
  { ph: 'pre', part: null, t: 'แจ้งอาการ', d: 'แจ้งอาการ Error Code ยี่ห้อ รุ่น (ภาพป้าย Nameplate) และภาพหรือวิดีโอ ถ้ามีกลิ่นไหม้ ควัน หรือเบรกเกอร์ตัดซ้ำ ให้ปิดเครื่องก่อน' },
  { ph: 'pre', part: null, t: 'ตรวจวินิจฉัยหน้างาน', d: `ตรวจอาการ เดินเครื่องทดสอบ ตรวจไฟฟ้า น้ำทิ้ง อุณหภูมิ และ Error Code (ค่าตรวจ${type === 'wall' ? 'แอร์ติดผนัง' : 'แอร์แขวน/สี่ทิศทาง'}ตามตารางด้านขวา)` },
  { ph: 'work', part: null, t: 'แจ้งผลตรวจและราคาซ่อมรายรายการ', d: 'ระบุอะไหล่ ค่าแรง ระยะรับประกันต่อรายการ และทางเลือก (ซ่อม / เปลี่ยน / ไม่ซ่อม)', you: 'ไม่ซ่อมจนกว่าลูกค้าอนุมัติ' },
  { ph: 'work', part: null, t: 'อนุมัติและนัดซ่อม', d: 'อะไหล่เฉพาะรุ่นบางรายการต้องสั่ง ทีมแจ้งวันนัดตามวันที่อะไหล่เข้า' },
  { ph: 'work', part: null, t: 'ซ่อมหรือเปลี่ยนอะไหล่', d: 'เก็บอะไหล่เก่าให้ลูกค้าดู ถ้าพบปัญหาเพิ่มระหว่างซ่อม แจ้งก่อนทำต่อ' },
  { ph: 'test', part: null, t: 'ทดสอบหลังซ่อม', d: 'เดินเครื่อง วัดค่าที่เกี่ยวข้อง ตรวจว่าไม่มี Error และอาการเดิมไม่เกิดขณะทดสอบ' },
  { ph: 'hand', part: null, t: 'ส่งรายงานและเงื่อนไขรับประกัน', d: 'รายงานตรวจ/ซ่อม รายการอะไหล่ ผลทดสอบ และระยะรับประกันต่อรายการ', you: 'รับรายงานพร้อมใบรับประกัน' },
];

/* symptom → groups the technician checks (possible causes, never a diagnosis) */
const SYMPTOMS = [
  { id: 'warm', th: 'ไม่เย็น / เย็นน้อย', causes: ['ฟิลเตอร์หรือคอยล์สกปรก', 'คอยล์ร้อนระบายความร้อนไม่ได้', 'พัดลมคอยล์ร้อนหรือคาปาซิเตอร์', 'น้ำยารั่วหรือไม่พอ', 'เซนเซอร์หรือบอร์ด', 'คอมเพรสเซอร์'], cats: ['ไฟฟ้า', 'Motor', 'Refrigerant', 'Control/Sensor', 'Compressor/Electrical'], parts: ['filter', 'coil', 'outdoor'] },
  { id: 'drip', th: 'น้ำหยด / น้ำล้น', causes: ['ท่อน้ำทิ้งตัน', 'ถาดน้ำทิ้งสกปรกหรือแตก', 'ความลาดของท่อไม่พอ', 'ปั๊มน้ำทิ้งหรือลูกลอย (แอร์สี่ทิศทาง)', 'ฉนวนเสื่อมจนเกิดหยดน้ำ'], cats: ['ระบบน้ำทิ้ง'], parts: ['pan', 'pump'] },
  { id: 'noise', th: 'เสียงดัง / สั่น', causes: ['ใบพัดสกปรกหรือไม่สมดุล', 'ลูกปืนมอเตอร์', 'ยางรองกันสั่นเสื่อม', 'บานสวิงหรือเฟือง'], cats: ['Motor/Mechanical', 'Mechanical/Control', 'Motor'], parts: ['fan', 'louver', 'outdoor'] },
  { id: 'off', th: 'เปิดไม่ติด / เบรกเกอร์ตัด', causes: ['ระบบไฟต้นทางหรือเบรกเกอร์', 'ฟิวส์ รีเลย์ หรือหม้อแปลงในเครื่อง', 'บอร์ดควบคุม', 'คอมเพรสเซอร์หรือชุดสตาร์ท'], cats: ['Electrical', 'Electrical/Control', 'PCB/Control', 'Compressor/Electrical'], parts: [], safety: true },
  { id: 'smell', th: 'มีกลิ่นไหม้ / ควัน / ประกายไฟ', causes: ['หยุดใช้งานทันที ให้ช่างตรวจระบบไฟก่อนเปิดอีกครั้ง'], cats: ['Electrical'], parts: [], safety: true, stop: true },
  { id: 'code', th: 'ขึ้น Error Code / รีโมตไม่ทำงาน', causes: ['ต้องเทียบรหัสกับคู่มือของรุ่นนั้น', 'เซนเซอร์อุณหภูมิ', 'บอร์ดหรือสายสื่อสาร', 'รีโมตหรือตัวรับสัญญาณ'], cats: ['Control', 'Control/Sensor', 'PCB/Control', 'Control/Communication'], parts: [] },
  { id: 'ice', th: 'คอยล์เย็นเป็นน้ำแข็ง', causes: ['ฟิลเตอร์หรือคอยล์ตัน ลมผ่านน้อย', 'พัดลมคอยล์เย็นหมุนช้า', 'น้ำยาไม่พอ', 'เซนเซอร์น้ำแข็ง'], cats: ['Motor', 'Refrigerant', 'Control/Sensor'], parts: ['filter', 'coil', 'fan'] },
];
const SAFETY = 'จากอาการที่แจ้ง ยังไม่ควรเปิดเครื่องใช้งานต่อ เนื่องจากอาจเกี่ยวข้องกับระบบไฟฟ้าหรืออุปกรณ์ภายใน กรุณาปิดเครื่องและตัดเบรกเกอร์เฉพาะวงจรของเครื่องปรับอากาศหากสามารถทำได้อย่างปลอดภัย ห้ามเปิดฝาครอบหรือซ่อมด้วยตนเอง และควรให้ช่างเข้าตรวจสอบหน้างานก่อนใช้งานอีกครั้ง';

/* customer journey across all services */
const JOURNEY = [
  ['เลือกบริการ', 'ดูขั้นตอนและราคาบนเว็บ ใส่ในใบเสนอราคาเบื้องต้น'],
  ['ส่งคำขอ', 'แนบเขต/อำเภอ จำนวนเครื่อง ภาพหน้างาน'],
  ['ทีมยืนยัน', 'โทรยืนยันขอบเขต วันนัด และรายการที่ต้องประเมินหน้างาน'],
  ['วันทำงาน', 'ทำตามขั้นตอนด้านล่าง ถ่ายภาพก่อน–หลัง'],
  ['ส่งมอบ', 'ทดสอบต่อหน้าลูกค้า ส่งเอกสารตามแพ็กเกจ'],
  ['ติดตามผล', 'เตือนรอบบริการครั้งถัดไป และดูแลตามระยะรับประกัน'],
];

/* =========================================================
   mount
   ========================================================= */
export function mountServices(root, cfg = {}) {
  const st = { svc: cfg.start || 'clean', type: 'wall', size: 0, level: 'C1', pkg: 'Standard Care', ins: 'STANDARD', btu: 12000, sym: 'warm' };
  const svcTabs = h('div', { class: 'sv-svc', role: 'tablist', 'aria-label': 'ประเภทบริการ' });
  const typeTabs = h('div', { class: 'sv-types', role: 'group', 'aria-label': 'ประเภทแอร์' });
  const howHost = h('div');
  const opts = h('div', { class: 'sv-opts' });
  const flow = h('ol', { class: 'sv-flow' });
  const side = h('aside', { class: 'sv-side' });
  const pkgHost = h('div', { class: 'sv-pkg' });
  const journey = h('ol', { class: 'sv-journey', 'aria-label': 'ขั้นตอนการใช้บริการ' }, JOURNEY.map(([t, d], i) => h('li', {}, h('span', {}, i + 1), h('b', {}, t), h('small', {}, d))));
  root.classList.add('sv');
  root.append(
    journey,
    h('div', { class: 'sv-head' }, svcTabs, typeTabs),
    h('div', { class: 'sv-type-sub', 'aria-live': 'polite' }),
    howHost,
    opts,
    h('div', { class: 'sv-grid' }, h('div', {}, h('h3', { class: 'sv-h4' }), flow), side),
    pkgHost,
  );
  // cfg.how === false: the variant shows its own 'how it works' view (3D / drawings / storyboard) and links via onType / onPart
  const how = cfg.how === false ? { render() {}, mark(p) { if (st.type !== 'floor') cfg.onPart && cfg.onPart(p); } } : mountHowItWorks(howHost, () => st.type);   // the variants' 3D 'how it works' views have no floor-standing unit
  if (cfg.how === false) howHost.remove();

  const SV = [
    { id: 'clean', th: 'ล้างแอร์', sub: 'ล้างปกติ C1 · ล้างใหญ่ C2' },
    { id: 'install', th: 'ติดตั้งแอร์', sub: 'มาตรฐาน · พรีเมียม · วัสดุเกรดพรีเมียม' },
    { id: 'repair', th: 'ตรวจเช็ก / ซ่อม', sub: 'ตรวจก่อน แจ้งราคาก่อนซ่อม' },
  ];
  const seg = (list, val, set, label) => h('div', { class: 's-seg', role: 'group', 'aria-label': label }, list.map(o => h('button', { type: 'button', 'aria-pressed': o.id === val, onclick: () => { set(o.id); render(); } }, o.th, o.sub ? h('small', {}, o.sub) : null)));

  function sizeList() {
    return st.type === 'wall'
      ? [[0, '9,000–18,000'], [1, '19,000–24,000'], [2, '25,000–36,000']]
      : [[0, 'ไม่เกิน 24,000'], [1, '25,000–36,000'], [2, '37,000–48,000'], [3, '49,000–60,000']];
  }
  const btuList = () => ({ wall: [9000, 12000, 18000, 24000, 30000], ceiling: [13000, 18000, 24000, 36000, 48000, 60000], cassette: [13000, 18000, 24000, 36000, 48000, 60000], floor: [36000, 48000, 60000, 80000] })[st.type];   // floor: Pricebook bands 36–48k / 49–60k, 61k+ = survey

  function renderOpts() {
    opts.innerHTML = '';
    if (st.svc === 'clean') opts.append(
      seg([{ id: 'C1', th: 'ล้างปกติ C1', sub: 'ล้างในตำแหน่ง' }, { id: 'C2', th: 'ล้างใหญ่ C2', sub: 'ถอดล้างโบลเวอร์ ถาดน้ำทิ้ง' }], st.level, v => st.level = v, 'ระดับการล้าง'),
      seg(CLEAN_PKGS.map(p => ({ id: p.id, th: p.th })), st.pkg, v => st.pkg = v, 'แพ็กเกจเอกสาร'),
      seg(sizeList().map(([id, th]) => ({ id, th: th + ' BTU' })), st.size, v => st.size = v, 'ขนาดเครื่อง'));
    if (st.svc === 'install') opts.append(
      seg([{ id: 'STANDARD', th: 'มาตรฐาน', sub: 'วัสดุพรีเมียมครบ' }, { id: 'PREMIUM', th: 'พรีเมียม', sub: '+ Support · ติดตามผล' }], st.ins, v => st.ins = v, 'ระดับงานติดตั้ง'),
      seg(btuList().map(b => ({ id: b, th: (b / 1000) + 'k BTU' })), st.btu, v => st.btu = v, 'ขนาดเครื่อง'));
    if (st.svc === 'repair') opts.append(h('div', { class: 'sv-sym', role: 'group', 'aria-label': 'อาการที่พบ' }, h('span', { class: 's-lbl' }, 'อาการที่พบ'),
      SYMPTOMS.map(s => h('button', { type: 'button', 'aria-pressed': s.id === st.sym, class: s.safety ? 'warn' : '', onclick: () => { st.sym = s.id; render(); } }, s.th))));
  }

  function renderFlow(steps) {
    flow.innerHTML = '';
    let last = '';
    steps.forEach((s, i) => {
      if (s.ph !== last) { flow.append(h('li', { class: 'sv-ph ' + s.ph }, (st.svc === 'clean' ? PHC : PH)[s.ph])); last = s.ph; }
      const li = h('li', { class: 'sv-step ' + s.ph + (s.off ? ' off' : ''), tabindex: s.part ? '0' : null },
        h('span', { class: 'sv-n' }, String(i + 1).padStart(2, '0')),
        h('div', {}, h('b', {}, s.t), h('p', {}, s.d), s.chk ? h('ul', { class: 'sv-chk' }, s.chk.map(x => h('li', {}, x))) : null, s.you ? h('em', {}, icon('check', { size: 15 }), s.you) : null));
      if (s.part) { const on = () => how.mark(s.part); if (cfg.how !== false) { li.addEventListener('mouseenter', on); li.addEventListener('focus', on); } li.addEventListener('click', on); li.classList.add('has-part'); }
      flow.append(li);
    });
  }

  const addBtn = (label, line, cls = 'primary') => h('button', { type: 'button', class: 's-btn ' + cls, onclick: () => { cart.add(line); toast(`เพิ่ม "${line.name}" แล้ว`); } }, label);
  const priceBig = (ex, unit) => ex == null ? h('div', { class: 'sv-price' }, h('b', {}, 'ประเมินหน้างาน')) : h('div', { class: 'sv-price' }, h('b', {}, baht(ex)), h('small', {}, `ต่อ${unit || 'เครื่อง'} ก่อน VAT`));
  const list = (title, items, cls = '') => items && items.length ? h('div', { class: 'sv-box ' + cls }, h('h4', {}, title), h('ul', {}, items.map(x => h('li', {}, x)))) : null;
  const splitTxt = s => (s || '').replace(/^ไม่รวม\s*/, '').split(/[;,]\s*|\s+และ\s+/).map(x => x.trim()).filter(Boolean);

  function renderSide() {
    side.innerHTML = '';
    const T = TYPE_BY_ID[st.type];
    if (st.svc === 'clean') {
      const r = cleanRate(st.pkg, st.level, st.type, st.size);
      const per = PRICING.unitsPerTeamDay[st.type];
      side.append(
        h('p', { class: 's-lbl' }, `${TYPE_TH[st.type]} · ${r ? r.range : ''} BTU · ${st.pkg} · ${st.level}`),
        priceBig(r?.rate.s, r?.unit),
        r ? addBtn('+ ใส่ใบเสนอราคา', { kind: 'service', group: 'clean', key: `CL-${st.pkg}-${st.level}-${st.type}-${st.size}`, name: `${r.name} · ${st.level === 'C2' ? 'ล้างใหญ่ C2' : 'ล้างปกติ C1'}`, detail: `${st.pkg} · ${r.warranty || ''}`, unitEx: r.rate.s, qty: 1 }) : null,
        h('dl', { class: 'sv-dl' },
          h('dt', {}, 'รับประกันงานล้าง'), h('dd', {}, r?.warranty || '—'),
          h('dt', {}, 'ดูแลหลังบริการ'), h('dd', {}, r?.care || '—'),
          h('dt', {}, 'เอกสารที่ได้รับ'), h('dd', {}, r?.doc || '—'),
          h('dt', {}, 'กำลังทีม (ล้างปกติ)'), h('dd', {}, `ประมาณ ${per} เครื่อง / ทีม / วัน ขึ้นกับหน้างาน`),
          h('dt', {}, 'ขั้นต่ำต่อครั้ง'), h('dd', {}, `ค่าล้างรวมต่อครั้งขั้นต่ำ ${baht(DATA.minBill)} (ก่อน VAT)`)),
        list('รวมในราคา', r ? [r.inc] : []),
        list('ไม่รวม', splitTxt(r?.exc), 'exc'),
        extrasBox(),
        h('p', { class: 's-note' }, 'ราคามาตรฐานจาก Pricebook 2569 · ราคาเป็นการประเมินเบื้องต้น อาจเปลี่ยนตามสภาพหน้างาน ความสูง และการเข้าถึง บริษัทยืนยันราคาและขอบเขตงานอีกครั้งก่อนดำเนินงาน'));
    }
    if (st.svc === 'install') {
      const o = installOptions(st.type, st.btu).find(x => x.key === st.ins);
      side.append(
        h('p', { class: 's-lbl' }, `${TYPE_TH[st.type]} ${btuFmt(st.btu)} · ติดตั้ง${o ? o.th : ''}`),
        priceBig(o?.item.ex, o?.item.unit),
        o ? addBtn('+ ใส่ใบเสนอราคา', { kind: 'service', group: 'install', key: `IN-${o.item.code}`, name: `ติดตั้ง${T.th} ${o.th} (${btuFmt(st.btu)})`, detail: 'รวมท่อและวัสดุ 4 เมตรแรก', unitEx: o.item.ex, qty: 1 }) : h('p', { class: 's-note' }, 'ขนาดนี้ต้องสำรวจหน้างานก่อนเสนอราคา'),
        h('div', { class: 'sv-box' }, h('h4', {}, 'รับประกัน 2 ส่วน'), h('ul', {},
          h('li', {}, h('b', {}, 'A · ตัวเครื่อง: '), 'ตามเงื่อนไขผู้ผลิตของรุ่นนั้น (คอมเพรสเซอร์ อะไหล่ บอร์ด)'),
          h('li', {}, h('b', {}, 'B · งานติดตั้งของบริษัท: '), o?.item.warranty || '—'),
          h('li', {}, 'B ครอบคลุมรอยต่อท่อ น้ำทิ้ง และงานไฟในขอบเขตที่ติดตั้ง ไม่รวมความเสียหายจากการใช้งานผิดวิธี ไฟตก หรือการดัดแปลงโดยผู้อื่น'))),
        h('div', { class: 'sv-box' }, h('h4', {}, 'ลูกค้าเตรียมก่อนวันติดตั้ง'), h('ul', {}, ['พื้นที่ให้ช่างเข้าถึงตำแหน่งคอยล์เย็นและคอยล์ร้อน', 'ที่จอดรถและการขออนุญาตนิติบุคคล (คอนโด/อาคาร)', 'จุดไฟที่ใช้ระหว่างงาน', st.type === 'cassette' ? 'แบบฝ้าและตำแหน่งโครงเหล็ก (ถ้ามี)' : st.type === 'floor' ? 'ทางขนตัวเครื่องเข้าห้อง (ตู้สูงราว 1.8–1.9 ม.) และพื้นที่ว่างหน้าตู้' : 'ย้ายของใต้ตำแหน่งติดตั้ง'].map(x => h('li', {}, x)))),
        h('p', { class: 's-note' }, 'ราคารวมท่อน้ำยา ฉนวน ราง สายไฟ ท่อน้ำทิ้ง 4 เมตรแรก ส่วนเกินคิดตามจริงและแจ้งก่อนเริ่มงาน · ราคาประเมินเบื้องต้น ยืนยันหลังสำรวจหน้างาน'));
    }
    if (st.svc === 'repair') {
      const S = SYMPTOMS.find(s => s.id === st.sym);
      const diag = st.type === 'floor' ? null : DATA.rep.find(r => r.cat === 'ตรวจวินิจฉัย' && (st.type === 'wall' ? /ติดผนัง/.test(r.name) : /แขวน|สี่ทิศทาง/.test(r.name)));   // no floor-standing diagnosis row in the Pricebook → quoted before the visit
      let items = DATA.rep.filter(r => S.cats.includes(r.cat));
      if (S.id === 'drip' && st.type !== 'cassette') items = items.filter(r => !/Float|ปั๊มน้ำทิ้ง/.test(r.name));   // floor-standing drains by gravity like wall / ceiling units
      if (S.id === 'drip') items = items.filter(r => !/AHU/.test(r.name));
      items = items.filter(r => !/AHU|FCU\/CDU มากกว่า|3 เฟส/.test(r.name)).slice(0, 8);
      if (S.stop || S.safety) side.append(h('div', { class: 'sv-safety', role: 'alert' }, h('b', {}, S.stop ? 'หยุดใช้งานทันที' : 'ข้อควรระวังด้านไฟฟ้า'), h('p', {}, SAFETY)));
      side.append(
        h('p', { class: 's-lbl' }, `ขั้นแรก: ตรวจวินิจฉัย${TYPE_TH[st.type]}`),
        priceBig(diag?.rate.s, diag?.unit),
        !diag ? h('p', { class: 's-note' }, 'ค่าตรวจแอร์ตู้ตั้งพื้นแจ้งก่อนนัดเข้าตรวจ ตามขนาดและการเข้าถึงหน้างาน') : null,
        diag ? addBtn('+ นัดตรวจวินิจฉัย', { kind: 'service', group: 'repair', key: `RP-${diag.name}`, name: diag.name, detail: 'ยังไม่รวมค่าซ่อม · แจ้งราคาก่อนซ่อม', unitEx: diag.rate.s, qty: 1 }) : null,
        h('p', { class: 's-note' }, diag?.warranty || ''),
        list('สาเหตุที่เป็นไปได้ (ต้องตรวจยืนยันหน้างาน)', S.causes),
        items.length ? h('div', { class: 'sv-box' }, h('h4', {}, 'ราคาซ่อมที่อาจเกี่ยวข้อง'), h('ul', { class: 'sv-rep' }, items.map(r => h('li', {},
          h('span', {}, r.name, h('small', {}, r.warranty || '')),
          h('b', {}, r.rate.s == null ? 'ประเมิน' : baht(r.rate.s)))))) : null,
        h('p', { class: 's-note' }, 'รายการด้านบนเป็นตัวอย่างงานซ่อมในกลุ่มอาการนี้ ยังไม่ใช่ผลวินิจฉัย ช่างต้องตรวจและแจ้งราคาจริงก่อนซ่อม ราคาก่อน VAT ต่อหน่วยตาม Pricebook 2569 ไม่รวมอะไหล่เฉพาะรุ่นที่ระบุ "ประเมิน"'),
        h('div', { class: 'sv-box' }, h('h4', {}, 'ข้อมูลที่ช่วยให้ตรวจเร็วขึ้น'), h('ul', {}, ['ภาพป้าย Nameplate คอยล์เย็นและคอยล์ร้อน', 'Error Code ที่ขึ้น (ภาพหน้าจอหรือไฟกะพริบ)', 'วิดีโออาการ 10–20 วินาที', 'อายุเครื่องและประวัติการล้าง/ซ่อม'].map(x => h('li', {}, x)))));
    }
  }
  function extrasBox() {
    const ex = DATA.clean.filter(r => r.pkg === st.pkg && r.level === st.level && ['งานเพิ่ม', 'Access/Risk', 'เงื่อนไขเวลา'].includes(r.ty));
    if (!ex.length) return null;
    return h('div', { class: 'sv-box' }, h('h4', {}, 'งานเพิ่มที่อาจเกิด (แจ้งก่อนทำ)'), h('ul', { class: 'sv-rep' }, ex.map(r => h('li', {}, h('span', {}, r.name), h('b', {}, r.rate.s == null ? 'ประเมิน' : baht(r.rate.s))))));
  }

  function render() {
    svcTabs.innerHTML = '';
    SV.forEach(s => svcTabs.append(h('button', { type: 'button', role: 'tab', 'aria-selected': s.id === st.svc, onclick: () => { st.svc = s.id; render(); } }, h('b', {}, s.th), h('small', {}, s.sub))));
    typeTabs.innerHTML = '';
    MAIN.forEach(t => typeTabs.append(h('button', { type: 'button', 'aria-pressed': t === st.type, onclick: () => { st.type = t; st.size = Math.min(st.size, sizeList().length - 1); if (!btuList().includes(st.btu)) st.btu = btuList()[1]; render(); cfg.onType && cfg.onType(t); } }, typeIcon(t), h('span', {}, TYPE_TH[t]))));
    root.querySelector('.sv-type-sub').textContent = TYPE_SUB[st.type];
    root.classList.toggle('sv-is-repair', st.svc === 'repair');
    how.render();
    renderOpts();
    const steps = st.svc === 'clean' ? cleanSteps(st.type, st.level, st.pkg) : st.svc === 'install' ? installSteps(st.type, st.ins) : repairSteps(st.type);
    root.querySelector('.sv-h4').textContent = st.svc === 'clean' ? `ขั้นตอนล้าง${TYPE_TH[st.type].replace('แอร์', 'แอร์')} ${steps.length} ขั้น (${st.level === 'C2' ? 'ล้างใหญ่ C2' : 'ล้างปกติ C1'})` : st.svc === 'install' ? `ขั้นตอนติดตั้ง ${steps.length} ขั้น · ระดับ${{ STANDARD: 'มาตรฐาน', PREMIUM: 'พรีเมียม' }[st.ins]}` : `ขั้นตอนซ่อม ${steps.length} ขั้น · ไม่ซ่อมก่อนลูกค้าอนุมัติราคา`;
    renderFlow(steps);
    if (st.svc === 'repair') { const S = SYMPTOMS.find(s => s.id === st.sym); if (S.parts[0]) how.mark(S.parts.find(p => st.type === 'cassette' || p !== 'pump') || S.parts[0]); }
    renderSide();
    pkgHost.innerHTML = ''; if (st.svc === 'clean') pkgHost.append(h('h3', { class: 'sv-h4' }, 'แพ็กเกจล้างของบริษัท: ได้อะไร เหมาะกับใคร ราคาเริ่มต้น'), cleanPackageGuide());
    if (st.svc === 'install') {
      const mt = h('details', { class: 'sv-mat' }, h('summary', {}, 'เทียบวัสดุ มาตรฐาน / พรีเมียม ของขนาดนี้'), materialTable(st.type, st.btu, { compact: true }));
      side.append(mt);
    }
  }
  render();
  return { set(svc, type) { if (svc) st.svc = svc; if (type) st.type = type; render(); }, setType(t) { if (t !== st.type && MAIN.includes(t)) { st.type = t; st.size = Math.min(st.size, sizeList().length - 1); if (!btuList().includes(st.btu)) st.btu = btuList()[1]; render(); } } };
}

export function typeIcon(t) {
  const d = {
    wall: '<rect x="3" y="7" width="26" height="11" rx="3"/><path d="M8 18l2 4M16 18v5M24 18l-2 4"/>',
    ceiling: '<path d="M2 4h28M9 4v4M23 4v4"/><rect x="4" y="8" width="24" height="9" rx="2"/><path d="M28 13h2M22 20h8"/>',
    cassette: '<path d="M2 12h28"/><rect x="7" y="6" width="18" height="6"/><rect x="5" y="12" width="22" height="3"/><path d="M5 17l-3 4M27 17l3 4M13 19v4M19 19v4"/>',
    floor: '<rect x="10" y="1" width="12" height="23" rx="2"/><path d="M12 5h8M12 8h8M13 17h6M13 20h6M6 25h20"/>',
  }[t];
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 32 26'); s.setAttribute('aria-hidden', 'true'); s.setAttribute('class', 'sv-ico');
  s.innerHTML = d; return s;
}
