// SBP AirCare — "ขั้นตอนงานล้าง และงานติดตั้ง" (Rev.09 round 4, replaces cleanguide.js; owner 1 ต.ค. 2569: "งานล้างแบบ 3D สมจริง
// ทีมช่างทำงานเป็นทีมทุกขั้นตอน … เพิ่มวิธีล้างแอร์แขวนใต้ฝ้า แอร์สี่ทิศทาง แอร์ตั้งตู้ ให้ละเอียด … งานติดตั้งต้องมี detail").
// Steps, order and wording come from services.cleanSteps / installSteps (company forms SBP-SR-ACCL-UNI-001 Rev.07 and
// SBP-SR-ACIN-UNI-001 Rev.04) plus the per-type method notes CLEAN_HOW / INSTALL_HOW — this module only shows them:
// the two levels side by side with the standard price from the Pricebook, a step player over the 3D job scene
// (jobscene3d.js, lazy: two technicians + the customer on a real site per unit type) and a parts tray / install checklist.
// Who does what in each step (lead / assistant) is written out too, so the teamwork reads without the 3D view.
import { icon } from './icons.js';
import { DATA, SIZE_BANDS, cleanRate, installOptions, baht, h, $$ } from './sbp-core.js';
import { cleanSteps, installSteps, CLEAN_HOW, INSTALL_HOW, PH, PHC } from './services.js';
import { METHOD_INFO, cart } from './commerce.js';
import { toast } from './proto-ui.js';

const RM = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
export const JOB_TYPES = [
  { id: 'wall', th: 'แอร์ติดผนัง', venue: 'ห้องนอนในบ้าน' },
  { id: 'ceiling', th: 'แอร์แขวนใต้ฝ้า', venue: 'ร้านค้า' },
  { id: 'cassette', th: 'แอร์สี่ทิศทาง', venue: 'คาเฟ่' },
  { id: 'floor', th: 'แอร์ตู้ตั้งพื้น', venue: 'ห้องประชุม / รับรองลูกค้า' },
];
const PKGS = [{ id: 'Basic Clean', th: 'Basic Clean (P1)', sub: 'ตรวจการทำงาน T1' }, { id: 'Standard Care', th: 'Standard Care (P2)', sub: 'วัดค่า T2 + ภาพ + เกรด' }];
// which part groups come off at each teardown step, per unit type (ids of the ac3d / units3d part groups)
export const TEAR = {
  wall: { parts: ['front', 'filter', 'louver'], lower: [], fan: ['blower'], pan: ['pan'], fanW: 'blower', panW: 'pan' },
  ceiling: { parts: ['grille', 'filter', 'louver'], lower: [], fan: ['scroll', 'fan'], pan: ['pan'], fanW: 'fan', panW: 'pan' },
  cassette: { parts: ['grille', 'filter'], lower: ['louver', 'panel'], fan: ['bell', 'fan'], pan: ['pan'], fanW: 'fan', panW: 'pan' },
  floor: { parts: ['grille', 'filter'], lower: ['front'], fan: ['scroll', 'fan'], pan: ['pan'], fanW: 'fan', panW: 'pan' },
};
// the parts tray, in this order: [key, name]
export const TRAY = {
  wall: [['front', 'หน้ากาก / ฝาหน้า'], ['filter', 'แผ่นกรองฝุ่น'], ['louver', 'บานสวิง'], ['coil', 'คอยล์เย็น ด้านหน้า'], ['coilBack', 'คอยล์เย็น ด้านหลัง'], ['blower', 'ใบพัดโบลเวอร์'], ['pan', 'ถาดน้ำทิ้ง'], ['outdoor', 'คอยล์ร้อน (นอกอาคาร)']],
  ceiling: [['grille', 'หน้ากากลมกลับ'], ['filter', 'แผ่นกรองฝุ่น'], ['louver', 'บานสวิง'], ['coil', 'คอยล์เย็น ด้านหน้า'], ['coilBack', 'คอยล์เย็น ด้านหลัง'], ['fan', 'ใบพัดโบลเวอร์ + โข่งลม'], ['pan', 'ถาดน้ำทิ้ง'], ['outdoor', 'คอยล์ร้อน (นอกอาคาร)']],
  cassette: [['grille', 'หน้ากากลมกลับ'], ['filter', 'แผ่นกรองฝุ่น'], ['panel', 'หน้ากากตกแต่ง + บานสวิง'], ['coil', 'คอยล์เย็น ด้านใน'], ['coilBack', 'คอยล์เย็น ด้านนอก'], ['fan', 'ใบพัดเทอร์โบ + กรวยลม'], ['pan', 'ถาดน้ำทิ้ง + ปั๊ม'], ['outdoor', 'คอยล์ร้อน (นอกอาคาร)']],
  floor: [['grille', 'หน้ากากลมกลับ'], ['filter', 'แผ่นกรองฝุ่น'], ['front', 'ฝาหน้าตู้'], ['coil', 'คอยล์เย็น ด้านหน้า'], ['coilBack', 'คอยล์เย็น ด้านหลัง'], ['fan', 'ใบพัดโบลเวอร์ + โข่งลม'], ['pan', 'ถาดน้ำทิ้ง'], ['outdoor', 'คอยล์ร้อน (นอกอาคาร)']],
};
const TRAY_GROUP = { panel: ['panel', 'louver'], fan: ['fan', 'scroll', 'bell'], blower: ['blower'] };   // tray row → part groups it stands for
export const DIRT0 = { front: 0.25, grille: 0.35, filter: 0.9, louver: 0.4, panel: 0.3, coil: 0.75, coilBack: 0.8, blower: 0.85, fan: 0.85, scroll: 0.6, bell: 0.5, pan: 0.75, outdoor: 0.6 };
const INSTALL_ITEMS = [['unit', 'ตัวเครื่องคอยล์เย็น'], ['out', 'คอยล์ร้อน + ฐาน / ยางกันสั่น'], ['pipe', 'ท่อน้ำยา + ฉนวน + รางครอบท่อ'], ['drain', 'ท่อน้ำทิ้ง'], ['wire', 'สายไฟ + เบรกเกอร์แยกวงจร'], ['leak', 'ทดสอบรอยรั่ว'], ['vac', 'ทำสุญญากาศ'], ['run', 'เดินเครื่องทดสอบ + ค่าที่วัด']];
const clone = o => JSON.parse(JSON.stringify(o));
const c = (s, a = 'idle', t = null) => ({ s, a, t });
const CUSTW = c('cust', 'watch');

// who does what (lead technician / assistant), per step id — the teamwork in words
const WHO_CLEAN = {
  confirm: ['ยืนยันงานกับลูกค้า ถ่ายภาพป้ายเครื่อง', 'ขนเครื่องมือเข้าพื้นที่ ปูเสื่อยางกันพื้น'],
  precheck: ['เปิดเครื่องทดสอบด้วยรีโมต', 'ถ่ายภาพก่อนงาน'],
  premeasure: ['วัดอุณหภูมิลมกลับ / ลมจ่ายที่ตัวเครื่อง', 'จดค่าลงรายงาน'],
  power: ['ปิดเบรกเกอร์วงจรแอร์', 'วัดยืนยันว่าไม่มีไฟเข้าเครื่อง'],
  cover: ['ครอบถุงล้างที่ตัวเครื่อง คลุมแผงวงจร', 'จับสายถุงลงถัง วางถังรับน้ำ'],
  parts: ['ถอดชิ้นส่วนทีละชิ้น ส่งลงมา', 'รับชิ้นส่วน นำไปวางเรียงบนโต๊ะ แล้วล้างแยก'],
  lower: ['ปลดตัวเครื่อง / แผงปิดตามแบบเครื่อง', 'ประคองและรับแผงที่ถอด'],
  nocut: ['ชี้ให้ลูกค้าเห็นว่าท่อยังต่ออยู่', 'ถ่ายภาพจุดต่อท่อ'],
  fanOut: ['ปลดใบพัดออกจากแกน ส่งลงมา', 'รับใบพัด วางบนโต๊ะ'],
  panOut: ['ปลดถาดน้ำทิ้ง ส่งลงมา', 'รับถาด วางบนโต๊ะ'],
  coilBack: ['ฉีดล้างคอยล์ด้านหลัง', 'จับปลายถุงล้าง ดูน้ำลงถัง'],
  washParts: ['เช็ดและตรวจชิ้นส่วนที่ล้างแล้ว', 'ล้างชิ้นส่วนทีละชิ้นในอ่าง'],
  register: ['ถ่ายภาพลงทะเบียนชิ้นส่วน', 'เรียงชิ้นส่วนบนโต๊ะตามลำดับ'],
  chem: ['พ่นน้ำยาล้างคอยล์ให้ทั่ว', 'เตรียมเครื่องฉีดน้ำ จับถุงล้าง'],
  coilFront: ['ฉีดล้างคอยล์ตามแนวครีบ', 'จับปลายถุงล้าง ดูน้ำลงถัง'],
  fanWash: ['ฉีดใบพัด หมุนด้วยมือทีละช่วง', 'จับปลายถุงล้าง'],
  drain: ['เทน้ำทดสอบลงถาด', 'ดูน้ำที่ปลายท่อ'],
  outdoor: ['ตรวจยางกันสั่นและจุดต่อที่คอยล์ร้อน', 'ฉีดล้างครีบคอยล์ร้อน'],
  dry: ['เป่าและเช็ดตัวเครื่องให้แห้ง', 'เช็ดชิ้นส่วนบนโต๊ะให้แห้ง'],
  assemble: ['ประกอบชิ้นส่วนกลับเข้าตัวเครื่อง', 'ยื่นชิ้นส่วนขึ้นไปตามลำดับ'],
  cleanup: ['ถอดถุงล้าง เก็บอุปกรณ์ที่ตัวเครื่อง', 'กวาดและเช็ดพื้นที่'],
  testDrain: ['เทน้ำทดสอบหลังประกอบ', 'ดูน้ำออกปลายท่อ'],
  testRun: ['เปิดเครื่องทุกโหมดด้วยรีโมต', 'วัดกระแสไฟที่เบรกเกอร์'],
  postmeasure: ['วัดค่าหลังงานที่จุดเดิม', 'จดค่าลงรายงาน'],
  basicCheck: ['เปิดเครื่องตรวจการทำงาน', 'จดผลลงรายงาน'],
  a4: ['ตรวจจุดที่ผิดปกติ (เมื่ออนุมัติ)', 'บันทึกภาพประกอบ'],
  grade: ['ประเมินสภาพเครื่อง A–D', 'เก็บเครื่องมือลงกล่อง'],
  next: ['แนะนำรอบล้างถัดไปกับลูกค้า', 'ขนเครื่องมือออก'],
  sign: ['ส่งรายงานให้ลูกค้าตรวจ', 'ตรวจพื้นที่ครั้งสุดท้าย'],
};
// r7: opening the unit for C2 differs per type (the unit stays where it is except the wall unit)
const WHO_LOWER = {
  wall: ['ปลดตะขอล่าง โน้มตัวเครื่องออกจากผนัง', 'ประคองตัวเครื่องและหนุนไว้'],
  ceiling: ['เปิดฝาครอบใต้เครื่อง ให้เห็นโข่งลมและคอยล์', 'รับฝาครอบ วางพักบนโต๊ะ'],
  cassette: ['ปลดสายบานสวิง ถอดหน้ากากตกแต่ง', 'รับหน้ากาก วางบนโต๊ะ'],
  floor: ['ถอดฝาหน้าและแผงข้างตู้', 'รับแผง วางพิงผนังบนเสื่อ'],
};
const WHO_INSTALL = {
  survey: ['คุยตำแหน่งกับลูกค้า วัดระยะ', 'จดระยะ ติดเทปแนวเครื่องและแนวท่อ'],
  receive: ['ถ่ายภาพกล่องและป้ายรุ่น ตรวจกับใบเสนอราคา', 'ตรวจสภาพกล่องคอยล์ร้อน'],
  indoor: ['เจาะยึดขายึด / ก้านแขวน แล้วยกเครื่องขึ้นยึด', 'ช่วยยกตัวเครื่อง (ยกสองคน) และจับบันได'],
  outdoor: ['ยึดคอยล์ร้อนกับฐาน / ขาแขวน', 'ช่วยยกคอยล์ร้อน วางยางกันสั่น'],
  piping: ['บานแฟลร์และขันข้อต่อฝั่งคอยล์เย็น', 'ต่อท่อฝั่งคอยล์ร้อน ปิดรางครอบท่อ'],
  drain: ['ต่อท่อน้ำทิ้ง เทน้ำทดสอบ', 'ดูน้ำออกปลายท่อ'],
  electric: ['ต่อสายเข้าเบรกเกอร์แยกวงจร', 'ต่อสายที่ตัวเครื่อง ตั้งค่ารีโมต'],
  leak: ['อัดแรงดัน / ตรวจรอยต่อ', 'ตรวจจุดต่อที่วาล์ว'],
  vacuum: ['ต่อเกจและปั๊มสุญญากาศ ดูค่า', 'จดเวลาและค่าที่วัดได้'],
  valve: ['เปิดวาล์วน้ำยา', 'บันทึกปริมาณน้ำยาที่เติม (ถ้ามี)'],
  testrun: ['วัดอุณหภูมิลมที่ตัวเครื่อง', 'วัดแรงดันไฟ / กระแสไฟ'],
  cleanup: ['เก็บเครื่องมือ ตรวจรายการค้าง', 'ทำความสะอาดพื้นที่'],
  handover: ['สอนใช้งาน ส่งเอกสารรับประกัน', 'เก็บของขึ้นรถ'],
};

/** cleaning: each step + the scene state after it (persistent things accumulate; camera / crew / spray / tests are per step) */
export function cleanTimeline(type, level, pkg) {
  const steps = cleanSteps(type, level, pkg), T = TEAR[type], c2 = level === 'C2';
  const P = { power: 1, bag: 0, pcb: 0, lower: 0, foam: 0, bagWater: 0, off: {}, dirt: { ...DIRT0 } };
  const clean = (ids, v) => ids.forEach(k => { P.dirt[k] = Math.min(P.dirt[k] ?? 1, v); });
  const off = ids => ids.forEach(k => { P.off[k] = 1; });
  return steps.map(s => {
    const x = { cam: 'wide', run: 0, probes: 0, drain: 0, spray: null, flash: false, tags: [], crew: [c('L', 'work'), c('foot', 'hold'), CUSTW], beats: null };
    switch (s.id) {
      case 'confirm': x.cam = 'wide'; x.crew = [c('leadMeet', 'explain'), c('box', 'carryBox', 'box'), c('custMeet', 'explain')]; x.beats = [{ t: 3.2, crew: [c('uf', 'photo', 'tablet'), c('box', 'crouch'), CUSTW] }]; x.tags = [{ at: 'unit', th: 'ตรวจป้ายเครื่อง: รุ่น · BTU · น้ำยา' }, { at: 'mat', th: 'ปูเสื่อยางกันพื้นก่อนวางเครื่องมือ' }]; break;
      case 'precheck': x.run = 1; x.flash = true; x.cam = 'unit'; x.crew = [c('uf', 'remote', 'remote'), c('uf2', 'photo', 'tablet'), CUSTW]; x.tags = [{ at: 'unit', th: 'เปิดทดสอบ · ถ่ายภาพก่อนงาน' }]; break;
      case 'premeasure': x.run = 1; x.probes = 1; x.cam = 'unit'; x.crew = [c('L', 'measure', 'probe'), c('foot', 'tablet', 'tablet'), CUSTW]; x.tags = [{ at: 'unit', th: 'วัดลมกลับ / ลมจ่าย · กระแสไฟ' }]; break;
      case 'power': P.power = 0; x.cam = 'breaker'; x.crew = [c('breaker', 'switch'), c('uf', 'measure', 'meter'), CUSTW]; x.tags = [{ at: 'breaker', th: 'ปิดเบรกเกอร์ · ยืนยันไม่มีไฟ', kind: 'ok' }]; break;
      case 'cover': P.bag = 1; P.pcb = 1; x.cam = 'bag'; x.crew = [c('L', 'work'), c('foot', 'hold'), CUSTW]; x.tags = [{ at: 'bag', th: type === 'floor' ? 'ถาดรองน้ำ + ถัง · คลุมแผงวงจร' : 'ถุงล้าง + ถัง · คลุมแผงวงจร' }, { at: 'mat', th: 'เสื่อยางกันน้ำกันรอย' }]; break;
      case 'parts': off(T.parts); x.cam = 'team';
        if (!c2) { clean(T.parts, 0.06); x.spray = { by: 1, at: 'tub' }; x.crew = [c('L', 'work'), c('tub', 'crouchSpray', 'gun'), CUSTW]; x.tags = [{ at: 'table', th: 'ผู้ช่วยรับชิ้นส่วน · ล้างแยกนอกตัวเครื่อง' }]; }
        else { x.crew = [c('L', 'work'), c('table', 'table'), CUSTW]; x.tags = [{ at: 'table', th: 'วางเรียงตามลำดับ · บันทึกจุดยึด' }]; }
        break;
      case 'lower': P.lower = 1; off(T.lower); x.cam = type === 'wall' ? 'back' : 'unit';   // r7: overhead units open up (casing see-through) instead of nothing changing x.crew = [c('L', 'reach'), c('foot', 'hold'), CUSTW]; x.tags = [{ at: 'pipes', th: type === 'wall' ? 'โน้มเครื่องออกจากขายึด · ท่อยังต่ออยู่' : 'ถอดแผงปิด · เครื่องอยู่ที่เดิม ท่อยังต่ออยู่', kind: 'ok' }]; break;
      case 'nocut': x.cam = 'back'; x.crew = [c('L', 'work'), c('foot', 'photo', 'tablet'), CUSTW]; x.tags = [{ at: 'pipes', th: 'ไม่ตัดท่อ ไม่เปิดวงจรน้ำยา', kind: 'ok' }]; break;
      case 'fanOut': off(T.fan); x.cam = 'team'; x.crew = [c('L', 'work'), c('table', 'table'), CUSTW]; x.tags = [{ at: 'table', th: 'ใบพัดถอดออกมาล้าง' }]; break;
      case 'panOut': off(T.pan); x.cam = 'team'; x.crew = [c('L', 'work'), c('table', 'table'), CUSTW]; x.tags = [{ at: 'table', th: 'ถาดน้ำทิ้งถอดออกมาล้าง' }]; break;
      case 'coilBack': clean(['coilBack'], 0.06); P.dirt.coil = Math.min(P.dirt.coil, 0.45); P.bagWater = Math.min(1, P.bagWater + 0.25); x.spray = { by: 0, at: 'back' }; x.cam = 'back'; x.crew = [c('L', 'spray', 'gun'), c('foot', 'hold'), CUSTW]; x.tags = [{ at: 'unit', th: 'ล้างคอยล์ด้านหลัง (เฉพาะ C2)', kind: 'ok' }]; break;
      case 'washParts': clean(Object.keys(P.off), 0.05); x.spray = { by: 1, at: 'tub' }; x.cam = 'tub'; x.crew = [c('table2', 'table', 'cloth'), c('tub', 'crouchSpray', 'gun'), CUSTW]; x.tags = [{ at: 'tub', th: 'ล้างทีละชิ้น' }]; break;
      case 'register': x.flash = true; x.cam = 'table'; x.crew = [c('table2', 'photo', 'tablet'), c('table', 'table'), CUSTW]; x.tags = [{ at: 'table', th: 'ทะเบียนชิ้นส่วน + ภาพ (บังคับ)', kind: 'ok' }]; break;
      case 'chem': P.foam = 1; x.spray = { by: 0, at: 'coil', chem: true }; x.cam = 'under'; x.crew = [c('L', 'spray', 'sprayer'), c('foot', 'hold'), CUSTW]; x.tags = [{ at: 'unit', th: 'น้ำยาล้างคอยล์ · ทิ้งให้คราบหลุด' }]; break;
      case 'coilFront': P.foam = 0; clean(['coil'], c2 ? 0.05 : 0.28); P.bagWater = Math.min(1, P.bagWater + 0.4); x.spray = { by: 0, at: 'coil' }; x.cam = 'under'; x.crew = [c('L', 'spray', 'gun'), c('foot', 'hold'), CUSTW]; x.tags = [{ at: 'bag', th: 'น้ำสกปรกลงถุงและถัง' }]; break;
      case 'fanWash': clean([T.fanW], 0.4); P.bagWater = Math.min(1, P.bagWater + 0.2); x.spray = { by: 0, at: 'fan' }; x.cam = 'under'; x.crew = [c('L', 'spray', 'gun'), c('foot', 'hold'), CUSTW]; x.tags = [{ at: 'unit', th: 'ใบพัดล้างในตำแหน่ง · เท่าที่หัวฉีดเข้าถึง', kind: 'warn' }]; break;
      case 'drain': if (c2) { clean(T.pan, 0.05); x.spray = { by: 1, at: 'tub' }; x.cam = 'tub'; x.crew = [c('table2', 'table', 'cloth'), c('tub', 'crouchSpray', 'gun'), CUSTW]; x.tags = [{ at: 'tub', th: 'ถาดและจุดต่อทางน้ำทิ้ง ล้างนอกตัวเครื่อง' }]; } else { clean([T.panW], 0.3); x.drain = 1; x.cam = 'under'; x.crew = [c('L', 'pour', 'jug'), c('foot', 'hold'), CUSTW]; x.tags = [{ at: 'unit', th: 'ทะลวงทางน้ำ · เทน้ำทดสอบ' }]; } break;
      case 'outdoor': clean(['outdoor'], 0.1); x.spray = { by: 1, at: 'outdoor' }; x.cam = 'outdoor'; x.crew = [c('valve', 'crouch', 'torch'), c('out', 'crouchSpray', 'gun'), CUSTW]; x.tags = [{ at: 'outdoor', th: 'ล้างครีบคอยล์ร้อน · ตรวจยางรองกันสั่น' }]; break;
      case 'dry': x.cam = 'team'; x.crew = [c('L', 'work', 'blower'), c('table', 'table', 'cloth'), CUSTW]; x.tags = [{ at: 'unit', th: 'เป่า · เช็ดแห้ง · ตรวจฉนวน' }]; break;
      case 'assemble': P.off = {}; P.lower = 0; x.cam = 'team'; x.crew = [c('L', 'work'), c('foot', 'hold'), CUSTW]; x.tags = [{ at: 'unit', th: c2 ? 'ประกอบตามทะเบียนชิ้นส่วน · ล็อกขายึดครบ' : 'ประกอบกลับครบ · ไม่มีชิ้นส่วนเหลือ', kind: 'ok' }]; break;
      case 'cleanup': P.bag = 0; P.pcb = 0; P.bagWater = 0; x.flash = true; x.crew = [c('L', 'work'), c('uf2', 'sweep', 'broom'), CUSTW]; x.tags = [{ at: 'unit', th: 'คืนพื้นที่ · ถ่ายภาพหลังงาน' }]; break;
      case 'testDrain': x.drain = 1; x.cam = 'under'; x.crew = [c('L', 'pour', 'jug'), c('foot', 'watch'), CUSTW]; x.tags = [{ at: 'unit', th: 'น้ำไหลออกปกติ ไม่ย้อน ไม่ซึม', kind: 'ok' }]; break;
      case 'testRun': P.power = 1; x.run = 1; x.crew = [c('uf', 'remote', 'remote'), c('breaker', 'measure', 'meter'), CUSTW]; x.tags = [{ at: 'unit', th: 'เดินเครื่องทุกโหมด · ลมออกสม่ำเสมอ', kind: 'ok' }]; break;
      case 'postmeasure': P.power = 1; x.run = 1; x.probes = 1; x.cam = 'unit'; x.crew = [c('L', 'measure', 'probe'), c('foot', 'tablet', 'tablet'), CUSTW]; x.tags = [{ at: 'unit', th: 'วัดค่าหลังงาน ที่จุดเดิม' }]; break;
      case 'basicCheck': P.power = 1; x.run = 1; x.crew = [c('uf', 'remote', 'remote'), c('uf2', 'tablet', 'tablet'), CUSTW]; break;
      case 'a4': x.cam = 'outdoor'; x.crew = [c('valve', 'crouch', 'torch'), c('out', 'tablet', 'tablet'), CUSTW]; x.tags = [{ at: 'outdoor', th: 'เมื่ออนุมัติ / พบผิดปกติเท่านั้น', kind: 'warn' }]; break;
      case 'grade': x.cam = 'meet'; x.crew = [c('leadMeet', 'tablet', 'tablet'), c('box', 'crouch'), CUSTW]; break;
      case 'next': x.cam = 'meet'; x.crew = [c('leadMeet', 'explain'), c('box', 'carryBox', 'box'), c('custMeet', 'explain')]; break;
      case 'sign': x.cam = 'meet'; x.crew = [c('leadMeet', 'present', 'tablet'), c('asstMeet', 'idle'), c('custMeet', 'sign')]; break;
      default: P.power = 1;
    }
    return { step: s, who: (s.id === 'lower' ? WHO_LOWER[type] : WHO_CLEAN[s.id]) || null, state: { ...clone(P), ...x } };
  }).map(t => { if (!t.state.beats) delete t.state.beats; return t; });
}

/** installation: each step + the scene state after it */
export function installTimeline(type, lv) {
  const steps = installSteps(type, lv), prem = lv === 'PREMIUM', over = type !== 'wall' && type !== 'floor';
  const P = { marks: 0, mount: 0, cut: 0, unbox: 0, unitK: 0, cartons: 0, oUnbox: 0, outK: 0, ocarton: 0, pipeK: 0, trunkK: 0, drainK: 0, wireK: 0, lad0: 0, lad1: 0, power: 0, panel: type === 'cassette' ? 0 : 1, done: {} };   // r7: the cassette decorative panel is fitted after piping and drain
  return steps.map(s => {
    const x = { cam: 'wide', run: 0, drain: 0, gauges: 0, n2: 0, vac: 0, needle: 0, flash: false, tags: [], crew: [c('L', 'work'), c('foot', 'hold'), CUSTW], beats: null };
    switch (s.id) {
      case 'survey': P.marks = 1; x.crew = [c('leadMeet', 'explain'), c('asstMeet', 'tablet', 'tablet'), c('custMeet', 'explain')]; x.beats = [{ t: 3, crew: [c('uf', 'measure', 'tape'), c('uf2', 'tablet', 'tablet'), CUSTW] }]; x.tags = [{ at: 'unit', th: 'ติดเทปแนวตัวเครื่อง · วัดระยะ' }]; break;
      case 'receive': P.cartons = 1; P.ocarton = 1; x.cam = 'door'; x.crew = [c('carton', 'photo', 'tablet'), c('ocarton', 'crouch'), CUSTW]; x.tags = [{ at: 'carton', th: 'รุ่น · Serial · BTU ตรงใบเสนอราคา' }]; break;
      case 'indoor': P.cartons = 0; P.unbox = 1; P.lad0 = type === 'floor' ? 0 : 1; x.cam = 'team';
        x.crew = [c('L', 'drill', 'drill'), c('foot', 'hold'), CUSTW];
        x.beats = [{ t: 2.6, set: { mount: 1, cut: 1, lad1: over ? 1 : 0 }, crew: [c(type === 'floor' ? 'uf' : 'L', 'lift'), c(over ? 'L2' : 'uf2', type === 'floor' ? 'carry' : 'lift'), null] }, { t: 3.4, set: { unitK: 1 } }, { t: 6.6, set: { lad1: 0 }, crew: [c('L', 'work', type === 'wall' ? 'level' : 'wrench'), c('foot', 'hold'), null] }];
        if (type === 'floor') x.beats = [{ t: 2.4, set: { mount: 1 }, crew: [c('cartonR', 'carry'), c('cartonL', 'carry'), null] }, { t: 4.4, set: { carry: 1 }, crew: [c('sideR', 'carry'), c('sideL', 'carry'), null] }, { t: 7.6, set: { carry: 0, unitK: 1 }, crew: [c('uf', 'kneel', 'level'), c('foot', 'hold'), null] }];   // two-man carry of the cabinet
        P.mount = 1; P.cut = 1; P.unitK = 1; P.done.unit = 1; Object.assign(x, { mount: 0, cut: 0, unitK: 0, lad1: 0 }); x.tags = [{ at: 'unit', th: { wall: 'ขายึดได้ระดับ · ยกสองคน', ceiling: 'ก้านเกลียวยึดโครงสร้าง · ยกสองคน', cassette: 'เปิดฝ้าตามแบบ · ยกสองคนขึ้นเหนือฝ้า', floor: 'วางตำแหน่ง ปรับระดับ ยึดกันล้ม' }[type] }]; break;
      case 'outdoor': P.ocarton = 0; P.oUnbox = 1; x.cam = 'outdoor'; x.crew = [c('out', 'carry'), c('out2', 'carry'), CUSTW]; x.beats = [{ t: 0.6, set: { outK: 1 } }, { t: 3.4, crew: [c('valve', 'crouch', 'wrench'), c('out', 'crouch'), null] }]; P.outK = 1; P.done.out = 1; x.outK = 0; x.tags = [{ at: 'outdoor', th: 'ฐาน + ยางกันสั่น · เว้นระยะระบายความร้อน' }]; break;
      case 'piping': x.cam = 'wide'; x.crew = [c('L', 'work', 'wrench'), c('valve', 'crouch', 'wrench'), CUSTW]; x.beats = [{ t: 0.2, set: { pipeK: 1 } }, { t: 3.6, set: { trunkK: 1 }, crew: [null, c('out2', 'hold'), null] }]; P.pipeK = 1; P.trunkK = 1; P.done.pipe = 1; Object.assign(x, { pipeK: 0, trunkK: 0 }); x.tags = [{ at: 'trunk', th: 'O-TWO 0.70 มม. · ฉนวน Aeroflex · ราง Airpro' }]; break;
      case 'drain': x.cam = 'wide'; x.crew = [c('L', 'pour', 'jug'), c('outDrain', 'crouch', 'torch'), CUSTW]; x.beats = [{ t: 0.2, set: { drainK: 1 } }, { t: 2.8, set: { drain: 1 } }]; P.drainK = 1; P.done.drain = 1; x.drainK = 0; x.tags = [{ at: 'drain', th: 'ลาดตลอดแนว · ไม่ย้อน' }]; break;
      case 'electric': x.cam = 'breaker'; x.crew = [c('breaker', 'switch', 'meter'), c('uf', 'remote', 'remote'), CUSTW]; x.beats = [{ t: 0.2, set: { wireK: 1 } }, { t: 2.4, set: { power: 1 } }]; P.wireK = 1; P.power = 1; P.done.wire = 1; Object.assign(x, { wireK: 0, power: 0 }); x.tags = [{ at: 'breaker', th: 'เบรกเกอร์แยกวงจร · สายดิน' }]; break;
      case 'leak': x.cam = 'outdoor'; x.gauges = prem ? 1 : 0; x.n2 = prem ? 1 : 0; x.needle = prem ? 0.8 : 0;
        x.crew = prem ? [c('n2', 'work'), c('valve', 'crouch', 'wrench'), CUSTW] : [c('valve', 'crouch', 'sprayer'), c('out', 'tablet', 'tablet'), CUSTW]; if (!s.off) P.done.leak = 1;
        x.tags = [{ at: prem ? 'gauges' : 'outdoor', th: prem ? 'อัดไนโตรเจน · ดูเกจค้างความดัน' : 'ตรวจรอยต่อตามจุดที่เข้าถึงได้' }]; break;
      case 'vacuum': x.cam = 'outdoor'; x.gauges = 1; x.vac = 1; x.needle = -1; x.crew = [c('valve', 'crouch', 'wrench'), c('out2', 'tablet', 'tablet'), CUSTW]; P.done.vac = 1; x.tags = [{ at: 'gauges', th: prem ? 'Vacuum + ค้างความดัน (Hold)' : 'Vacuum ก่อนปล่อยน้ำยา' }]; break;
      case 'valve': x.cam = 'outdoor'; x.gauges = 1; x.needle = 0.6; x.crew = [c('valve', 'crouch', 'wrench'), c('out', 'tablet', 'tablet'), CUSTW]; x.tags = [{ at: 'outdoor', th: 'เปิดวาล์ว · เติมเฉพาะท่อเกินระยะ' }]; break;
      case 'testrun': P.power = 1; x.run = 1; x.crew = [c('L', 'measure', 'probe'), c('breaker', 'measure', 'meter'), CUSTW]; P.done.run = 1; x.tags = [{ at: 'unit', th: 'V · A · ลมกลับ / ลมจ่าย · น้ำทิ้ง', kind: 'ok' }];
        if (type === 'cassette' && !P.panel) { P.panel = 1; x.panel = 0; x.run = 0; x.beats = [{ t: 0.2, crew: [c('L', 'work'), c('foot', 'hold'), null] }, { t: 1.4, set: { panel: 1 } }, { t: 3.0, set: { run: 1 }, crew: [c('L', 'measure', 'probe'), c('breaker', 'measure', 'meter'), null] }]; x.tags.unshift({ at: 'unit', th: 'ติดหน้ากากตกแต่ง + บานสวิง แล้วเปิดทดสอบ' }); }
        break;
      case 'cleanup': P.marks = 0; x.flash = true; x.run = 1; x.crew = [c('box', 'crouch'), c('uf2', 'sweep', 'broom'), CUSTW]; x.beats = [{ t: 3.5, set: { lad0: 0 } }]; P.lad0 = 0; x.lad0 = type === 'floor' ? 0 : 1; x.tags = [{ at: 'unit', th: 'ตรวจรายการค้าง · ภาพก่อน–หลัง' }]; break;
      case 'handover': x.cam = 'meet'; x.crew = [c('leadMeet', 'remote', 'remote'), c('asstMeet', 'idle'), c('custMeet', 'watch')]; x.beats = [{ t: 3.4, crew: [c('leadMeet', 'present', 'tablet'), c('box', 'carryBox', 'box'), c('custMeet', 'sign')] }]; x.tags = [{ at: 'cust', th: 'รีโมต · คู่มือ · ใบรับประกันงานติดตั้ง', kind: 'ok' }]; break;
    }
    const st = { ...clone(P), ...x }; delete st.done; if (!st.beats) delete st.beats;
    return { step: s, who: WHO_INSTALL[s.id] || null, done: { ...P.done }, state: st };
  });
}

export function mountJobGuide(root, { theme = 'light', start = 'C1', type = 'wall', job = 'clean' } = {}) {
  const st = { job, level: job === 'install' ? 'STANDARD' : start, type, pkg: 'Standard Care', size: 0, band: 0, i: 0, playing: false };
  let TL = [], V3 = null, timer = 0;
  root.classList.add('cg'); root.innerHTML = '';
  const timeline = () => st.job === 'install' ? installTimeline(st.type, st.level) : cleanTimeline(st.type, st.level, st.pkg);
  const instBands = t => { const code = { wall: 'W', ceiling: 'C', cassette: 'K', floor: 'FS' }[t]; return [...new Set(DATA.inst.filter(i => i.code.startsWith(`INS-${code}-`) && /-(STANDARD|PREMIUM)$/.test(i.code)).map(i => i.code.split('-').slice(2, 4).join('-')))].map(b => ({ b, lo: +b.split('-')[0], hi: +b.split('-')[1] })).sort((a, b) => a.lo - b.lo); };

  /* ----- 1 · job + type + package / size ----- */
  const segOf = (list, val, on, label, cls = '') => { const g = h('div', { class: 's-seg cg-seg ' + cls, role: 'group', 'aria-label': label }); list.forEach(o => g.append(h('button', { type: 'button', 'aria-pressed': String(String(o.id) === String(val)), onclick: e => { $$('button', g).forEach(b => b.setAttribute('aria-pressed', String(b === e.currentTarget))); on(o.id); } }, o.th, o.sub ? h('small', {}, o.sub) : null))); return g; };
  const jobSeg = segOf([{ id: 'clean', th: 'งานล้าง', sub: 'C1 · C2' }, { id: 'install', th: 'งานติดตั้ง', sub: 'มาตรฐาน · พรีเมียม' }], st.job, v => { st.job = v; st.level = v === 'install' ? 'STANDARD' : 'C1'; refresh(false); }, 'งาน', 'cg-job');
  const typeSeg = segOf(JOB_TYPES.map(t => ({ id: t.id, th: t.th, sub: t.venue })), st.type, v => { st.type = v; st.size = 0; st.band = 0; refresh(false); }, 'ประเภทแอร์', 'cg-types');
  const pkgSeg = segOf(PKGS, st.pkg, v => { st.pkg = v; refresh(true); }, 'แพ็กเกจ');
  const sizeSel = h('select', { class: 'cg-size', 'aria-label': 'ขนาดเครื่อง' });
  sizeSel.addEventListener('change', () => { if (st.job === 'install') st.band = +sizeSel.value; else st.size = +sizeSel.value; renderCmp(); });
  const pkgWrap = h('div', { class: 'cg-pkgw' }, pkgSeg);
  const cmp = h('div', { class: 'cg-cmp' });
  root.append(h('div', { class: 'cg-bar' }, jobSeg, typeSeg), h('div', { class: 'cg-bar cg-bar2' }, pkgWrap, h('label', { class: 'cg-sz' }, 'ขนาด ', sizeSel)), cmp);

  /* ----- 2 · player: 3D job scene + step card + tray / checklist ----- */
  const host = h('div', { class: 'cg-host' });
  const tags = h('div', { class: 'cg-tags', 'aria-hidden': 'true' });
  const flash = h('div', { class: 'cg-flash', 'aria-hidden': 'true' });
  const sheet = h('div', { class: 'cg-sheet', hidden: true });
  const venueTag = h('p', { class: 'cg-venue', 'aria-hidden': 'true' });
  const fb = h('p', { class: 'cg-fb', hidden: true }, 'อุปกรณ์นี้แสดงภาพ 3 มิติไม่ได้ ขั้นตอนทั้งหมดอ่านได้ครบในรายการด้านข้าง');
  const arw = (cls, lab, d) => h('button', { type: 'button', class: 'cg-arw ' + cls, 'aria-label': lab, onclick: () => { stop(); go(st.i + d); } }, d < 0 ? '‹' : '›');
  const arPrev = arw('prev', 'ขั้นก่อนหน้า', -1), arNext = arw('next', 'ขั้นถัดไป', 1);
  const pill = h('p', { class: 'cg-pill', 'aria-hidden': 'true' });
  host.append(tags, flash, sheet, venueTag, arPrev, arNext, pill);
  const lvlSeg = h('div', { class: 'cg-lvl', role: 'group', 'aria-label': 'ระดับงาน' });
  const card = h('div', { class: 'cg-card', 'aria-live': 'polite' });
  const prev = h('button', { type: 'button', class: 's-btn ghost', onclick: () => { stop(); go(st.i - 1); } }, 'ก่อนหน้า');
  const play = h('button', { type: 'button', class: 's-btn primary', onclick: () => togglePlay() }, 'เล่นทีละขั้น');
  const next = h('button', { type: 'button', class: 's-btn ghost', onclick: () => { stop(); go(st.i + 1); } }, 'ถัดไป');
  const trayH = h('h3', {}), tray = h('ul', { class: 'cg-tray' }), trayNote = h('p', { class: 'cg-note' });
  const strip = h('ol', { class: 'cg-strip', 'aria-label': 'ทุกขั้นตอน' });
  const cap = h('p', { class: 'cg-cap' });
  root.append(h('div', { class: 'cg-main' },
    h('div', { class: 'cg-stage' }, lvlSeg, host, fb, cap),
    h('div', { class: 'cg-side' }, card, h('div', { class: 'cg-nav' }, prev, play, next), h('section', { class: 'cg-trayw' }, trayH, tray, trayNote))),
    h('div', { class: 'cg-stripw' }, strip));

  function renderLvl() {
    lvlSeg.innerHTML = '';
    const opts = st.job === 'install' ? [['STANDARD', 'ติดตั้งมาตรฐาน', 'ตรวจรอยต่อ · Vacuum'], ['PREMIUM', 'ติดตั้งพรีเมียม', 'ไนโตรเจน · Vacuum Hold · ตรวจติดตาม']] : [['C1', 'ล้างปกติ C1', 'ล้างในตำแหน่ง'], ['C2', 'ล้างใหญ่ C2', st.type === 'wall' ? 'ปลดเครื่อง · ถอดใบพัด/ถาด' : 'ถอดแผงปิด · ใบพัด · ถาด']];
    opts.forEach(([id, th, sub]) => lvlSeg.append(h('button', { type: 'button', class: 'lv-' + id, 'aria-pressed': String(st.level === id), onclick: () => { st.level = id; refresh(true); } }, h('b', {}, th), h('small', {}, `${sub} · ${(st.job === 'install' ? installSteps(st.type, id) : cleanSteps(st.type, id, st.pkg)).length} ขั้น`))));
  }
  function renderCmp() {
    cmp.innerHTML = ''; pkgWrap.hidden = st.job === 'install';
    if (st.job === 'install') {
      const bands = instBands(st.type); if (st.band >= bands.length) st.band = 0;
      sizeSel.innerHTML = ''; bands.forEach((b, i) => sizeSel.append(h('option', { value: i, selected: i === st.band }, `${b.lo.toLocaleString()}–${b.hi.toLocaleString()} BTU`)));
      const opts = bands.length ? installOptions(st.type, bands[st.band].hi) : [];
      opts.forEach(o => {
        const it = o.item, steps = installSteps(st.type, o.key), leak = steps.find(s => s.id === 'leak'), vac = steps.find(s => s.id === 'vacuum'), hand = steps.find(s => s.id === 'handover'), on = st.level === o.key;
        cmp.append(h('article', { class: 'cg-col ' + o.key + (on ? ' on' : '') },
          h('p', { class: 'cg-tag' }, o.key === 'PREMIUM' ? 'พรีเมียม' : 'มาตรฐาน'), h('h3', {}, `ติดตั้ง${o.th}`), h('p', { class: 'cg-d' }, o.note),
          h('dl', {}, h('dt', {}, 'รวมในงาน'), h('dd', {}, (it.inc || '').split(';').map(x => x.trim()).filter(Boolean).slice(0, 6).join(' · ')),
            h('dt', {}, 'ทดสอบรั่ว'), h('dd', {}, leak ? leak.d : '—'), h('dt', {}, 'สุญญากาศ'), h('dd', {}, vac ? vac.d : '—'), h('dt', {}, 'ส่งมอบ'), h('dd', {}, hand ? hand.d : '—'),
            h('dt', {}, 'ไม่รวม'), h('dd', { class: 'x' }, (it.exc || '').split(',').slice(0, 4).join(', '))),
          h('div', { class: 'cg-pr' }, it.ex != null ? [h('b', {}, baht(it.ex)), h('small', {}, `ต่อเครื่อง ก่อน VAT · ${it.name}`)] : [h('b', {}, 'ประเมินหน้างาน')]),
          h('div', { class: 'cg-act' },
            h('button', { type: 'button', class: 's-btn ' + (on ? 'primary' : 'ghost'), onclick: () => { st.level = o.key; refresh(true); root.querySelector('.cg-main').scrollIntoView({ behavior: RM() ? 'auto' : 'smooth', block: 'start' }); } }, `ดู ${steps.length} ขั้นตอน`),
            it.ex != null ? h('button', { type: 'button', class: 's-btn ghost', onclick: () => { cart.add({ kind: 'service', group: 'install', key: `I-${it.code}`, name: it.name, detail: it.warranty || '', unitEx: it.ex, qty: 1 }); toast(`เพิ่ม "${it.name}" แล้ว`); } }, 'ใส่ใบเสนอราคา') : null)));
      });
      cmp.append(h('p', { class: 'cg-when' }, h('b', {}, 'รับประกันงานติดตั้ง'), ' 3 ปีเมื่อซื้อเครื่องใหม่จากบริษัท · 1 ปีเมื่อลูกค้าจัดหาเครื่องเอง · ท่อ ราง สาย ส่วนที่เกินระยะในแพ็กเกจคิดตามจริงจาก Pricebook'));
      return;
    }
    const T = TEAR[st.type], names = Object.fromEntries(TRAY[st.type]);
    const bands = SIZE_BANDS.filter(b => st.type === 'wall' ? b.id < 3 : true);
    sizeSel.innerHTML = ''; bands.forEach(b => sizeSel.append(h('option', { value: b.id, selected: b.id === st.size }, `${(st.type === 'wall' ? b.wall : b.other).replace('<=', '≤ ')} BTU`)));
    const priceOf = lv => { const r = cleanRate(st.pkg, lv, st.type, st.size); return r && r.rate.s != null ? r : null; };
    const nm = k => names[k] || names[Object.keys(TRAY_GROUP).find(g => TRAY_GROUP[g].includes(k))];
    const col = lv => {
      const c2 = lv === 'C2', r = priceOf(lv), n = cleanSteps(st.type, lv, st.pkg).length, info = METHOD_INFO.find(m => m.id === lv);
      const out = [...new Set((c2 ? [...T.parts, ...T.lower, ...T.fan, ...T.pan] : T.parts).map(nm).filter(Boolean))];
      const inPlace = c2 ? ['คอยล์เย็นทั้งด้านหน้าและด้านหลัง', 'คอยล์ร้อน'] : ['คอยล์เย็นด้านหน้า', `${nm(T.fanW)} เท่าที่หัวฉีดเข้าถึง`, `${nm(T.panW)} และทางน้ำทิ้ง`, 'คอยล์ร้อน'];
      const notInc = c2 ? ['ตัดท่อ / เปิดวงจรน้ำยา (= งานยกเครื่อง C3 แยกใบเสนอราคา)', 'มอเตอร์ แผงวงจร'] : [st.type === 'wall' ? 'ปลดตัวเครื่องลง' : 'ถอดแผงปิดตัวเครื่อง', `ถอด${nm(T.fanW)} และ${nm(T.panW)}`, 'ล้างคอยล์ด้านหลัง'];
      return h('article', { class: 'cg-col ' + lv + (st.level === lv ? ' on' : '') },
        h('p', { class: 'cg-tag' }, c2 ? 'ล้างใหญ่' : 'ล้างปกติ'),
        h('h3', {}, info.th), h('p', { class: 'cg-d' }, info.d),
        h('dl', {}, h('dt', {}, 'ถอดออกมาล้าง'), h('dd', {}, out.join(' · ')), h('dt', {}, 'ล้างในเครื่อง'), h('dd', {}, inPlace.join(' · ')), h('dt', {}, 'ไม่รวม'), h('dd', { class: 'x' }, notInc.join(' · ')),
          c2 ? [h('dt', {}, 'เพิ่มจาก C1'), h('dd', {}, 'ทะเบียนชิ้นส่วนที่ถอด + ภาพ (บังคับ) · ชิ้นที่ไม่ได้ถอดต้องระบุเหตุผล')] : null),
        h('div', { class: 'cg-pr' }, r ? [h('b', {}, baht(r.rate.s)), h('small', {}, `ต่อเครื่อง ก่อน VAT · ${st.pkg}`)] : [h('b', {}, 'ประเมินหน้างาน')]),
        h('div', { class: 'cg-act' },
          h('button', { type: 'button', class: 's-btn ' + (st.level === lv ? 'primary' : 'ghost'), onclick: () => { st.level = lv; refresh(true); root.querySelector('.cg-main').scrollIntoView({ behavior: RM() ? 'auto' : 'smooth', block: 'start' }); } }, `ดู ${n} ขั้นตอน`),
          r ? h('button', { type: 'button', class: 's-btn ghost', onclick: () => { cart.add({ kind: 'service', group: 'clean', key: `CL-${st.pkg}-${lv}-${st.type}-${st.size}`, name: `${r.name} · ${c2 ? 'ล้างใหญ่ C2' : 'ล้างปกติ C1'}`, detail: `${st.pkg} · ${r.warranty || ''}`, unitEx: r.rate.s, qty: 1 }); toast(`เพิ่ม "${r.name} · ${c2 ? 'ล้างใหญ่ C2' : 'ล้างปกติ C1'}" แล้ว`); } }, 'ใส่ใบเสนอราคา') : null));
    };
    cmp.append(col('C1'), col('C2'), h('p', { class: 'cg-when' }, h('b', {}, 'เลือกล้างใหญ่เมื่อ'), ' เห็นคราบดำที่ใบพัด กลิ่นอับไม่หายหลังล้างปกติ หรือไม่ได้ล้างมานาน · งานล้างมียอดขั้นต่ำต่อการเข้าหน้างาน ', baht(DATA.minBill), ' ก่อน VAT'));
  }
  const PHI = { pre: 'ก่อนเริ่มงาน', work: 'งานติดตั้ง', test: 'ทดสอบ', hand: 'ส่งมอบ' };
  const phName = ph => st.job === 'install' ? PHI[ph] : PH[ph];
  function renderStrip() {
    strip.innerHTML = '';
    let ph = null, grp = null;
    TL.forEach((t, i) => {
      if (t.step.ph !== ph) { ph = t.step.ph; grp = h('ol', {}); strip.append(h('li', { class: 'cg-grp ph-' + ph }, h('span', {}, phName(ph)), grp)); }
      grp.append(h('li', {}, h('button', { type: 'button', class: (t.step.ph === 'c2' ? 'c2 ' : '') + (t.step.off ? 'opt ' : ''), 'aria-current': i === st.i ? 'step' : null, 'aria-label': `ขั้นที่ ${i + 1} ${t.step.t}`, onclick: () => { stop(); go(i); } }, h('b', {}, i + 1), h('span', {}, t.step.t))));
    });
  }
  function renderCard() {
    const t = TL[st.i], s = t.step, n = TL.length, ins = st.job === 'install';
    const how = (ins ? INSTALL_HOW : CLEAN_HOW)[st.type]?.[s.id], tyTh = JOB_TYPES.find(x => x.id === st.type).th;
    card.innerHTML = '';
    card.append(...[h('p', { class: 'cg-meta' }, h('span', { class: 'cg-ph ph-' + s.ph }, phName(s.ph)), s.off ? h('span', { class: 'cg-opt' }, 'ตามเงื่อนไข') : null, h('span', { class: 'cg-n' }, `ขั้นที่ ${st.i + 1} / ${n}`)),
      h('h3', {}, s.t), h('p', {}, s.d),
      how ? h('p', { class: 'cg-how' }, h('b', {}, `วิธีทำกับ${tyTh}: `), how) : null,
      t.who ? h('ul', { class: 'cg-who', 'aria-label': 'ทีมช่างทำอะไร' }, h('li', {}, h('i', {}, 'ช่างหัวหน้า'), t.who[0]), h('li', {}, h('i', {}, 'ช่างผู้ช่วย'), t.who[1])) : null,
      s.chk ? h('ul', { class: 'cg-chk', 'aria-label': 'บันทึกในรายงาน' }, s.chk.map(x => h('li', {}, x))) : null,
      s.you ? h('p', { class: 'cg-you' }, h('b', {}, 'ลูกค้าได้: '), s.you) : null,
      h('p', { class: 'cg-form' }, ins ? 'แบบฟอร์ม SBP-SR-ACIN-UNI-001 Rev.04 · ' + PHI[s.ph] : 'แบบฟอร์ม SBP-SR-ACCL-UNI-001 Rev.07 · ' + PHC[s.ph])].filter(Boolean));   // DOM append() would print null
    prev.disabled = arPrev.disabled = st.i === 0; next.disabled = arNext.disabled = st.i === n - 1; pill.textContent = `${st.i + 1} / ${n} · ${s.t}`;
    $$('button', strip).forEach((b, i) => { if (i === st.i) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current'); });
    const cur = $$('button', strip)[st.i]; if (cur && strip.scrollWidth > strip.clientWidth) { const sr = strip.getBoundingClientRect(), br = cur.getBoundingClientRect(); if (br.left < sr.left || br.right > sr.right) strip.scrollBy({ left: br.left - sr.left - sr.width / 3, behavior: RM() ? 'auto' : 'smooth' }); }
  }
  function renderTray() {
    const t = TL[st.i]; tray.innerHTML = '';
    if (st.job === 'install') {
      trayH.textContent = 'ติดตั้งแล้วอะไรบ้าง'; trayNote.textContent = 'วัสดุจริงตามแพ็กเกจ: ท่อทองแดง O-TWO 0.70 มม. · ฉนวน Aeroflex · ราง Airpro · สายไฟ Yazaki · ท่อน้ำทิ้ง SCG · เบรกเกอร์ NANO';
      INSTALL_ITEMS.forEach(([k, th]) => { const done = !!t.done[k], skip = k === 'leak' && st.level !== 'PREMIUM' && !done; tray.append(h('li', { class: done ? 'off' : skip ? 'x' : '' }, h('span', { class: 'cg-tn' }, th), h('span', { class: 'cg-tw' }, done ? 'เรียบร้อย' : 'ยังไม่ถึงขั้นนี้'), h('span', { class: 'cg-meter', role: 'img', 'aria-label': done ? 'เสร็จแล้ว' : 'ยังไม่เสร็จ' }, h('i', { style: `width:${done ? 100 : 0}%` })))); });
      return;
    }
    trayH.textContent = 'ชิ้นส่วนอยู่ที่ไหน · สะอาดแค่ไหน'; trayNote.textContent = 'แถบ = ความสะอาดโดยประมาณ (ภาพประกอบ)';
    const P = t.state, T = TEAR[st.type], c2 = st.level === 'C2';
    TRAY[st.type].forEach(([k, th]) => {
      const ids = TRAY_GROUP[k] || [k], off = ids.some(id => P.off[id]); let where, cls = '';
      if (k === 'coilBack') { where = c2 ? 'ล้างหลังเปิดเครื่อง' : 'ไม่รวมในล้างปกติ · เฉพาะ C2'; cls = c2 ? '' : 'x'; }
      else if (k === 'coil') where = 'ล้างในตำแหน่ง';
      else if (k === 'outdoor') where = 'ล้างภายนอกอาคาร';
      else if (off) { where = 'ถอดออกมาล้าง'; cls = 'off'; }
      else if (!c2 && ids.some(id => T.fan.includes(id) || T.pan.includes(id) || T.lower.includes(id))) { where = 'ล้างในตำแหน่ง · ไม่ถอด'; cls = 'in'; }
      else where = 'ติดเครื่อง';
      const d = P.dirt[ids[0]] ?? 0, pct = Math.round((1 - d) * 100);
      tray.append(h('li', { class: cls }, h('span', { class: 'cg-tn' }, th), h('span', { class: 'cg-tw' }, where), h('span', { class: 'cg-meter', role: 'img', 'aria-label': `ความสะอาดประมาณ ${pct}%` }, h('i', { style: `width:${pct}%` }))));
    });
  }
  function renderSheet() {
    const s = TL[st.i].step; sheet.innerHTML = '';
    const rows = s.id === 'grade' && st.pkg !== 'Basic Clean' ? [['A', 'ปกติ'], ['B', 'ใช้งานได้ ควรเฝ้าระวัง'], ['C', 'ควรแก้ไขรอบถัดไป'], ['D', 'เร่งด่วน ควรหยุดใช้งาน']]
      : s.id === 'sign' ? [['ic:sign', 'ช่างผู้ปฏิบัติงาน'], ['ic:sign', 'หัวหน้าทีม'], ['ic:sign', 'ลูกค้ารับมอบ']]
      : s.id === 'register' ? (s.chk || []).map(x => ['ic:check', x + ' · ภาพ'])
      : s.id === 'next' ? (s.chk || []).map(x => ['ic:clock', x]) : null;
    sheet.hidden = !rows;
    if (rows) sheet.append(h('b', {}, s.id === 'grade' ? 'ประเมินสภาพเครื่อง' : s.id === 'sign' ? 'ลงนามรับรอง 3 ฝ่าย' : s.id === 'register' ? 'ทะเบียนชิ้นส่วนที่ถอด' : 'รอบล้างถัดไปโดยประมาณ'), h('ul', {}, rows.map(([a, b]) => h('li', {}, h('i', {}, a.startsWith('ic:') ? icon(a.slice(3), { size: 14 }) : a), b))));
  }
  let tagEls = [];
  function renderTags() { tags.innerHTML = ''; tagEls = (TL[st.i].state.tags || []).map(t => { const e = h('span', { class: 'cg-tag-3d ' + (t.kind || '') }, t.th); tags.append(e); return { e, at: t.at }; }); }
  function onFrame(cam, W, Hh) {
    if (!V3) return; const A = V3.anchors();
    tagEls.forEach(({ e, at }) => { const p = A[at]; if (!p) { e.style.visibility = 'hidden'; return; } const q = V3.project(p); const off = q.z > 1 || Math.abs(q.x) > 1.05 || Math.abs(q.y) > 1.05; e.style.visibility = off ? 'hidden' : 'visible'; if (off) return; const w = e.offsetWidth || 120; const x = Math.min(W - w / 2 - 6, Math.max(w / 2 + 6, (q.x + 1) / 2 * W)), y = Math.min(Hh - 16, Math.max(16, (1 - q.y) / 2 * Hh - 18)); e.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -50%)`; });
  }
  function renderCap() {
    const v = JOB_TYPES.find(x => x.id === st.type);
    venueTag.textContent = `${v.th} · ${v.venue}`;
    cap.textContent = st.job === 'install'
      ? `แบบจำลองเพื่ออธิบาย · สถานที่ตัวอย่าง: ${v.venue} · ขั้นตอนตามแบบฟอร์มงานติดตั้งของบริษัท SBP-SR-ACIN-UNI-001 Rev.04 · วัสดุและระยะจริงขึ้นกับหน้างานและคู่มือผู้ผลิตของรุ่น`
      : `แบบจำลองเพื่ออธิบาย · สถานที่ตัวอย่าง: ${v.venue} · ความสกปรกเป็นภาพประกอบ ไม่ใช่ผลตรวจเครื่องจริง · ขั้นตอนตามแบบฟอร์มงานล้างของบริษัท SBP-SR-ACCL-UNI-001 Rev.07`;
  }

  let lastI = -1;
  function go(i) {
    st.i = Math.max(0, Math.min(TL.length - 1, i));
    renderCard(); renderTray(); renderSheet(); renderTags();
    const s = TL[st.i].state;
    if (V3) V3.show(clone(s), { jump: Math.abs(st.i - lastI) !== 1 });
    lastI = st.i;
    if (s.flash && !RM()) { flash.classList.remove('on'); void flash.offsetWidth; flash.classList.add('on'); }
  }
  function refresh(keepStep) {
    const cur = TL[st.i] && TL[st.i].step.id;
    TL = timeline();
    renderLvl(); renderCmp(); renderStrip(); renderCap();
    if (V3) { V3.setJob(st.job); V3.setType(st.type); }
    const j = keepStep && cur ? TL.findIndex(t => t.step.id === cur) : -1;
    if (V3 && j < 0) V3.reset();
    lastI = -9; go(j >= 0 ? j : 0);
  }
  function stop() { st.playing = false; clearTimeout(timer); play.textContent = 'เล่นทีละขั้น'; }
  function togglePlay() {
    if (st.playing) { stop(); return; }
    st.playing = true; play.textContent = 'หยุด';
    if (st.i >= TL.length - 1) go(0);
    const dwell = () => (RM() ? 6000 : 4600);
    let waited = 0;
    const tick = () => {
      if (!st.playing) return;
      if (V3 && V3.busy() && waited < 16000) { waited += 500; timer = setTimeout(tick, 500); return; }   // let the crew finish the hand-offs first
      waited = 0; if (st.i >= TL.length - 1) { stop(); return; } go(st.i + 1); timer = setTimeout(tick, dwell());
    };
    timer = setTimeout(tick, dwell());
  }
  strip.addEventListener('keydown', e => { if (e.key === 'ArrowRight') { e.preventDefault(); stop(); go(st.i + 1); $$('button', strip)[st.i]?.focus(); } if (e.key === 'ArrowLeft') { e.preventDefault(); stop(); go(st.i - 1); $$('button', strip)[st.i]?.focus(); } });

  refresh(false);
  /* ----- lazy 3D ----- */
  let booting = false;
  const io = new IntersectionObserver(async es => {
    if (!es.some(e => e.isIntersecting) || booting) return; booting = true; io.disconnect();
    try { const mod = await import('./jobscene3d.js'); V3 = mod.createJobScene(host, { theme, type: st.type, job: st.job, onFrame }); V3.show(clone(TL[st.i].state), { jump: true }); lastI = st.i; renderTags(); }
    catch (e) { console.warn('job scene 3D unavailable', e); fb.hidden = false; host.hidden = true; }
  }, { rootMargin: '300px 0px' });
  io.observe(host);
  return {
    setJob: j => { st.job = j; st.level = j === 'install' ? 'STANDARD' : 'C1'; $$('button', jobSeg).forEach(b => b.setAttribute('aria-pressed', String(b.textContent.startsWith(j === 'install' ? 'งานติดตั้ง' : 'งานล้าง')))); refresh(false); },
    setLevel: lv => { st.level = lv; refresh(true); }, setType: t => { st.type = t; $$('button', typeSeg).forEach((b, i) => b.setAttribute('aria-pressed', String(JOB_TYPES[i].id === t))); refresh(false); },
    go: i => go(i), steps: () => TL.map(t => t.step.id), advance: sec => V3 && V3.advance(sec), busy: () => !!(V3 && V3.busy()), ready: () => !!V3,
  };
}
// the pages call it by its round-3 name too
export const mountCleanGuide = mountJobGuide;
