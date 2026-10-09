// SBP AirCare — technician stories in 3D (variant C, Rev.08).
// One realistic home (install3d: living room + balcony, neat Airpro trunking, O-TWO copper in Aeroflex, blue PVC drain,
// Yazaki THW, condensing unit on a stand) and an animated technician (tech3d) acting out every step of four jobs:
//   C1  Standard Cleaning    — company form SBP-SR-ACCL-UNI-001 Rev.07 (basic list + protection / reassembly + T1/T2)
//   C2  Deep Clean           — same form, C2 list: un-hook and lower the indoor unit without cutting the refrigerant pipes,
//                              remove blower + pan, wash the back of the coil, parts register
//   ติดตั้ง Installation      — form SBP-SR-ACIN-UNI-001 Rev.04: survey → check units → plate + hole → trunking → condensing
//                              unit → pipes / drain / cable → hang + flare → valves + power → leak test → vacuum → test run
//                              → drain test + lids + clean-up → hand-over (Standard / Premium test level)
//   ตรวจเช็ก / ซ่อม            — symptom intake → safety → run + error code → filters / coil / drain → ΔT → current / voltage
//                              → outdoor unit → refrigerant check (A4, when needed) → itemised quote → repair after approval
// Values shown on the meters are EXAMPLES of what gets recorded, not pass/fail limits (there is no single ΔT for all brands).
import { icon, iconLabel } from './icons.js';
import * as THREE from './three.module.min.js';
import { createStage, buildHome, createLabels, createPathFlow, V, clamp, ease, RM } from './install3d.js';
import { buildTools, createTech } from './tech3d.js';
import { createAirflow } from './airflow3d.js';
import { canvasTex } from './ac3d.js';
import { h } from './sbp-core.js';

/* ---------------------------------------------------------------- cameras */
// r19 (B3): boxes / cdu framed wide enough for the whole technician at mid widths; trunk steps work from the ladder (in view)
const CAMS = {
  overview: { t: [0.9, 1.0, -0.5], r: 8.4, th: 0.4, ph: 1.2 },
  unit: { t: [1.05, 1.65, -1.45], r: 4.4, th: 0.62, ph: 1.3 },
  unitClose: { t: [1.0, 2.05, -1.75], r: 2.5, th: 0.72, ph: 1.36 },
  unitSide: { t: [1.0, 1.95, -1.7], r: 2.6, th: 0.95, ph: 1.32 },
  breaker: { t: [1.7, 1.4, -1.6], r: 2.6, th: 0.3, ph: 1.33 },
  parts: { t: [0.8, 0.35, -1.25], r: 3.6, th: -0.45, ph: 0.98 },
  trunk: { t: [2.3, 1.45, -1.6], r: 5.0, th: 0.3, ph: 1.25 },
  drain: { t: [2.4, 1.05, -1.5], r: 5.8, th: 0.36, ph: 1.2 },
  cdu: { t: [3.4, 0.78, -1.6], r: 3.4, th: 0.5, ph: 1.12 },
  cduValve: { t: [3.98, 0.32, -1.6], r: 2.0, th: -0.42, ph: 1.08 },
  cduLeft: { t: [3.35, 0.45, -1.6], r: 2.35, th: 0.38, ph: 1.12 },
  balcony: { t: [3.5, 0.8, -1.2], r: 3.8, th: 0.15, ph: 1.22 },
  front: { t: [0.55, 1.0, 0.35], r: 4.4, th: 0.55, ph: 1.3 },
  boxes: { t: [-0.95, 0.85, -1.05], r: 4.4, th: 0.45, ph: 1.12 },
};

/* ---------------------------------------------------------------- state */
// dirt channels 0 clean … 1 dirty; parts: 'front' (lifted only) | 'off' (front, filter, louver on the drop cloth)
const BASE = {
  power: 1, run: 1, parts: 0, peek: 0, unhang: 0, inner: 0, foam: 0, spray: null, drain: 0,
  dFilter: 1, dCoil: 1, dBlower: 1, dPan: 1, dOut: 1, dBack: 1,
  cloth: 0, ladder: 0, bag: 0, bucket: 0, washer: 0, washerOut: 0, pcb: 0, boxes: 0, marks: 0, level: 0, gauges: 0, vac: 0, n2: 0,
  build: null, lids: 1, reveal: 1, cust: 'sofa', chip: null, report: null, needle: 0, ghost: 0,
};
const CLEAN_ALL = { dFilter: 0, dCoil: 0, dBlower: 0, dPan: 0, dOut: 0, dBack: 0 };
const PROTECT = { cloth: 1, ladder: 1, bag: 1, bucket: 1, pcb: 1, power: 0, run: 0 };

const CHIPS = {
  before: { h: 'ค่าก่อนล้าง · ตัวอย่างการบันทึก', rows: [['ลมกลับ (Return)', '26.8 °C'], ['ลมจ่าย (Supply)', '17.2 °C'], ['ผลต่าง ΔT', '9.6 °C'], ['กระแสไฟ', '4.6 A'], ['แรงดันไฟ', '226 V']] },
  after: { h: 'ค่าหลังล้าง · ตัวอย่างการบันทึก', rows: [['ลมกลับ (Return)', '26.3 °C'], ['ลมจ่าย (Supply)', '14.9 °C'], ['ผลต่าง ΔT', '11.4 °C'], ['กระแสไฟ', '4.3 A'], ['แรงดันไฟ', '226 V']] },
  commission: { h: 'ค่าหลังติดตั้ง · ตัวอย่างการบันทึก', rows: [['แรงดันไฟ', '228 V'], ['กระแสไฟ', '4.1 A'], ['ลมกลับ / ลมจ่าย', '27.0 / 13.8 °C'], ['ผลต่าง ΔT', '13.2 °C'], ['ทดสอบน้ำทิ้ง', 'ผ่าน']] },
  leak: { h: 'ทดสอบรั่ว (บันทึกในรายงาน)', rows: [['วิธี', 'ไนโตรเจน'], ['แรงดันทดสอบ', 'ตามคู่มือรุ่น · psi'], ['เวลาค้าง', '… นาที'], ['ผล', 'ผ่าน / ไม่ผ่าน']] },
  leakStd: { h: 'ตรวจรอยรั่ว (บันทึกในรายงาน)', rows: [['วิธี', 'ตรวจรอยต่อที่เข้าถึงได้'], ['จุดตรวจ', 'แฟลร์ใน–นอก'], ['ผล', 'ผ่าน / ไม่ผ่าน']] },
  vac: { h: 'Vacuum Record', rows: [['เวลาทำ', '… นาที'], ['ค่าที่ได้', '… micron / inHg'], ['Hold', '… นาที'], ['ผล', 'ผ่าน / ไม่ผ่าน']] },
  amps: { h: 'ตรวจไฟฟ้าขณะเดินเครื่อง', rows: [['กระแส', '… A (เทียบป้ายรุ่น)'], ['แรงดัน', '… V · 1 เฟส'], ['ขั้วต่อ / สายดิน', 'ตรวจความแน่น']] },
  a4: { h: 'A4 ตรวจระบบสารทำความเย็น', rows: [['ด้านต่ำ', '… psi'], ['ด้านสูง', '… psi'], ['อุณหภูมิแวดล้อม', '… °C'], ['เดินเครื่องคงที่', '… นาที']] },
  dt: { h: 'ลมกลับ–ลมจ่าย', rows: [['ลมกลับ (Return)', '… °C'], ['ลมจ่าย (Supply)', '… °C'], ['ผลต่าง ΔT', 'ประกอบการวินิจฉัย']] },
};
const REPORTS = {
  clean: { h: 'รายงานการให้บริการล้าง (SBP-SR-ACCL-UNI-001)', li: ['ภาพก่อน–หลังงาน', 'รายการที่ทำจริง (ติ๊กเฉพาะที่ทำเสร็จ)', 'ค่าตรวจวัด T1 / T2 ก่อน–หลัง', 'ผลทดสอบน้ำทิ้งและการทำงาน', 'เกรดสภาพเครื่อง A–D + สิ่งที่พบนอกขอบเขต', 'รอบล้างถัดไป 3 / 4 / 6 / 12 เดือน', 'ลงนาม ช่าง · หัวหน้าทีม · ลูกค้า'], note: 'Basic Clean: ตรวจการทำงาน (T1) · Standard Care: วัดค่า T2 + ภาพ + เกรด' },
  clean2: { h: 'รายงานการให้บริการล้าง C2 (SBP-SR-ACCL-UNI-001)', li: ['ทะเบียนชิ้นส่วนที่ถอด + ภาพ (บังคับสำหรับ C2)', 'ยืนยันไม่ตัดท่อ / ไม่เปิดวงจรน้ำยา', 'ภาพก่อน–หลัง + ค่าตรวจวัด', 'ผลทดสอบน้ำทิ้งและการทำงาน', 'เกรดสภาพเครื่อง A–D', 'รอบล้างถัดไป', 'ลงนาม 3 ฝ่าย'], note: 'C2 ไม่รวม: ถอดมอเตอร์ แผงวงจร ถอดแผงคอยล์ ตัดท่อ หรือเปิดวงจรน้ำยา' },
  install: { h: 'รายงานติดตั้งและส่งมอบ (SBP-SR-ACIN-UNI-001)', li: ['Model / Serial จากป้ายจริง ทั้งคอยล์เย็นและคอยล์ร้อน', 'วัสดุที่ใช้จริง (ท่อ ราง สายไฟ ท่อน้ำทิ้ง)', 'ผลทดสอบรั่ว + Vacuum Record', 'ค่าหลังติดตั้ง V · A · Return · Supply · ΔT · Drain', 'Punch list + ภาพหลังงาน', 'การรับประกัน A: ผู้ผลิต · B: งานติดตั้งโดยบริษัท', 'ลงนาม 3 ฝ่าย'], note: 'รับประกันงานติดตั้ง 3 ปี เมื่อซื้อเครื่องจากบริษัท · 1 ปี เมื่อลูกค้าจัดหาเครื่องเอง ตามเงื่อนไขในใบเสนอราคา' },
  repair: { h: 'รายงานตรวจ / ซ่อม', li: ['อาการที่แจ้ง + Error Code', 'ค่าที่วัดได้ (อุณหภูมิ ไฟฟ้า แรงดันน้ำยาเมื่อตรวจ)', 'สาเหตุที่เป็นไปได้ และสิ่งที่ยังต้องตรวจ', 'รายการอะไหล่ ค่าแรง ระยะรับประกันต่อรายการ', 'ผลทดสอบหลังซ่อม'], note: 'ไม่เริ่มซ่อมจนกว่าลูกค้าอนุมัติราคา' },
};

/* ---------------------------------------------------------------- stories */
// step: { t, form, what, why, get, s: state, tech: [spot, act, tool], cam, lab: [[text, anchor, warn?]] }
const C1 = [
  { t: 'ยืนยันเครื่องและตรวจก่อนเริ่มงาน', form: 'แบบฟอร์มข้อ 1–2 · Pre-Service Inspection', what: 'ยืนยันยี่ห้อ รุ่น Serial ขนาด BTU และชนิดน้ำยาจากป้ายเครื่อง เปิดเครื่องตรวจ ความเย็น น้ำทิ้ง เสียงและการสั่น รีโมต Error Code และบันทึกสภาพเดิม (รอยแตก สนิม ฉนวนเสื่อม) ถ่ายภาพก่อนงาน', why: 'บันทึกสภาพเดิมเพื่อคุ้มครองทั้งลูกค้าและบริษัท ถ้าพบอาการผิดปกติ ช่างแจ้งก่อนเริ่มล้าง', get: 'ผลตรวจก่อนงาน + ภาพก่อนทำ', s: {}, air: 1, tech: ['unitFloor', 'remote', 'remote'], cam: 'unit', lab: [['ป้าย Nameplate: ยี่ห้อ รุ่น Serial BTU', 'nameplate'], ['ตรวจลมออกและความเย็น', 'outlet'], ['ท่อน้ำยา + น้ำทิ้งในราง', 'trunkIn']] },
  { t: 'วัดค่าก่อนล้าง (Standard Care)', form: 'แบบฟอร์มข้อ 4 · T2', what: 'วัดอุณหภูมิลมกลับ (Return) และลมจ่าย (Supply) ที่จุดเดิมทุกครั้ง คำนวณผลต่าง ΔT วัดกระแสไฟขณะเดินเครื่องและแรงดันไฟ บันทึกลงรายงาน', why: 'เป็นตัวเลขตั้งต้นไว้เทียบหลังล้าง · แพ็กเกจ Basic Clean ตรวจเฉพาะการทำงาน (T1)', get: 'ค่าก่อนล้างในรายงาน', s: { chip: 'before' }, tech: ['unit', 'measure', 'probe'], cam: 'unit', lab: [['ลมกลับ (Return) — วัดจุดเดิม', 'intake'], ['ลมจ่าย (Supply)', 'outlet']], props: { ladder: 1 } },
  { t: 'ตัดแยกไฟและตรวจยืนยันก่อนทำงาน', form: 'รายการพื้นฐาน C1/C2', what: 'ปิดเบรกเกอร์ RCBO เฉพาะวงจรแอร์ แล้วตรวจยืนยันว่าเครื่องไม่มีไฟเข้าก่อนแตะชิ้นส่วนใด', why: 'งานล้างใช้น้ำใกล้แผงวงจรและมอเตอร์ ต้องไม่มีไฟเข้าเครื่อง', get: 'ความปลอดภัยของคน บ้าน และตัวเครื่อง', s: { power: 0, run: 0, ladder: 1 }, tech: ['breaker', 'switch', null], cam: 'breaker', lab: [['เบรกเกอร์ RCBO วงจรแอร์ — ปิด', 'rcbo', 1], ['รางสายไฟเข้ารางหลัก', 'mini']] },
  { t: 'คลุมป้องกันพื้น ผนัง และแผงวงจร', form: 'รายการพื้นฐาน + การป้องกัน', what: 'ปูผ้าใบรองพื้น ติดถุงล้างแอร์ใต้ตัวเครื่อง ต่อสายลงถังรองน้ำ และคลุมกล่องแผงวงจรกับเซนเซอร์ด้วยพลาสติกกันน้ำ', why: 'น้ำสกปรกไหลลงถังทั้งหมด แผงวงจรไม่โดนน้ำ', get: 'บ้านสะอาด ไม่มีน้ำหยดใส่ผนัง พื้น และเฟอร์นิเจอร์', s: { ...PROTECT }, tech: ['unit', 'work', null], cam: 'unit', lab: [['ถุงล้างแอร์ใต้ตัวเครื่อง', 'bag'], ['สายลงถังรองน้ำสกปรก', 'bucket'], ['คลุมแผงวงจรกันน้ำ', 'pcb'], ['ผ้าใบรองพื้น', 'cloth']] },
  { t: 'บันทึกจุดยึด แล้วถอดหน้ากาก แผ่นกรอง บานสวิง', form: 'รายการพื้นฐาน · บันทึกตำแหน่งน็อต คลิป จุดยึด', what: 'ถ่ายภาพตำแหน่งน็อต คลิป และจุดยึดก่อนถอด ถอดหน้ากาก แผ่นกรอง และบานสวิงลงมาวางบนผ้าใบ เพื่อล้างแยกนอกตัวเครื่อง', why: 'เปิดทางให้ล้างคอยล์และโบลเวอร์ได้ทั่ว และประกอบกลับได้ครบ', get: 'ชิ้นส่วนพลาสติกทุกชิ้นถูกล้างจริง', s: { ...PROTECT, parts: 1 }, tech: ['unit', 'work', null], cam: 'parts', lab: [['หน้ากาก', 'pFront'], ['แผ่นกรองฝุ่น', 'pFilter'], ['บานสวิง', 'pLouver'], ['คอยล์เย็นที่เปิดโล่ง', 'coil']] },
  { t: 'ฉีดน้ำยาล้างคอยล์ ทิ้งให้คราบหลุด', form: 'วัสดุที่ใช้จริง · งานเสริม A1 / A2', what: 'ฉีดน้ำยาล้างคอยล์ให้ทั่วครีบ ทิ้งไว้ตามเวลาที่ผู้ผลิตน้ำยากำหนด บันทึกชนิดและปริมาณที่ใช้ · A1 น้ำยากรดอุตสาหกรรม หรือ A2 สเปรย์โฟมเกรด อย. ทำเมื่ออนุมัติในใบเสนอราคา', why: 'คราบฝุ่นผสมไขมันติดลึกในครีบ น้ำเปล่าอย่างเดียวออกไม่หมด', get: 'คอยล์สะอาดลึกขึ้น ลมผ่านได้ดีขึ้น', s: { ...PROTECT, parts: 1, foam: 1, spray: 'chem' }, tech: ['unit', 'spray', 'sprayer'], cam: 'unitClose', lab: [['น้ำยาล้างคอยล์บนครีบ', 'coil']] },
  { t: 'ล้างแผงคอยล์เย็นด้านหน้าด้วยน้ำแรงดัน', form: 'รายการพื้นฐาน', what: 'ใช้ปั๊มน้ำแรงดันฉีดไล่คราบตามแนวครีบจากบนลงล่าง ไม่ฉีดเฉียงจนครีบล้ม น้ำสกปรกไหลลงถุงและถัง', why: 'คอยล์ที่อุดตันทำให้ลมผ่านน้อย เย็นช้า และคอมเพรสเซอร์ทำงานนานขึ้น', get: 'เห็นน้ำสกปรกในถังเป็นหลักฐาน', s: { ...PROTECT, parts: 1, washer: 1, spray: 'coil', dCoil: 0 }, tech: ['unit', 'spray', 'gun'], cam: 'unitClose', lab: [['ฉีดตามแนวครีบ', 'coil'], ['น้ำสกปรกลงถัง', 'bucket'], ['ปั๊มน้ำแรงดัน', 'washer']] },
  { t: 'ล้างโบลเวอร์เท่าที่หัวฉีดเข้าถึง', form: 'รายการพื้นฐาน · C1 ล้างที่ตำแหน่งเดิม', what: 'ฉีดล้างใบพัดกรงกระรอกทีละช่วง หมุนใบพัดด้วยมือให้ทั่ว (C1 ไม่ถอดใบพัด)', why: 'คราบดำในใบพัดทำให้ลมเบาและมีกลิ่นอับ', get: 'ลมออกแรงขึ้น', s: { ...PROTECT, parts: 1, washer: 1, spray: 'blower', dCoil: 0, dBlower: 0 }, tech: ['unit', 'spray', 'gun'], cam: 'unitClose', lab: [['ใบพัดโบลเวอร์ (กรงกระรอก)', 'blower']] },
  { t: 'ล้างและทะลวงถาด / ทางน้ำทิ้ง', form: 'รายการพื้นฐาน · T1 Drain Test', what: 'ล้างเมือกในถาดน้ำทิ้ง ทะลวงทางน้ำ แล้วเทน้ำทดสอบให้ไหลออกปลายท่อที่ระเบียงได้ปกติ', why: 'ถาดหรือท่อน้ำทิ้งตันเป็นสาเหตุหลักของน้ำหยดจากเครื่อง', get: 'ลดโอกาสน้ำหยดหลังล้าง', s: { ...PROTECT, parts: 1, washer: 1, spray: 'pan', dCoil: 0, dBlower: 0, dPan: 0, drain: 1 }, tech: ['unit', 'spray', 'gun'], cam: 'drain', lab: [['ถาดน้ำทิ้ง', 'pan'], ['ท่อน้ำทิ้ง PVC สีฟ้าในราง', 'drainRun'], ['น้ำออกที่ท่อระบายระเบียง', 'drainEnd']] },
  { t: 'ฉีดล้างคอยล์ร้อนจากภายนอก', form: 'รายการพื้นฐาน · หรือบันทึก "ไม่รวม/เข้าไม่ถึง"', what: 'ฉีดล้างครีบคอยล์ร้อนจากด้านนอกตัวเครื่อง ตรวจใบพัด ฐานรอง และยางรองกันสั่น ถ้าเข้าถึงอย่างปลอดภัยไม่ได้ บันทึกว่าไม่รวม', why: 'คอยล์ร้อนสกปรกระบายความร้อนไม่ออก เครื่องทำงานหนักขึ้น', get: 'ระบบทั้งชุดได้รับการดูแล ไม่ใช่แค่ในห้อง', s: { ...PROTECT, parts: 1, washerOut: 1, spray: 'outdoor', dCoil: 0, dBlower: 0, dPan: 0, dOut: 0 }, tech: ['cduLeft', 'crouchSpray', 'gun'], cam: 'cduLeft', lab: [['ครีบคอยล์ร้อนด้านหลัง/ด้านข้าง', 'oCoil'], ['ยางรองกันสั่น', 'pads'], ['ท่อจากรางเข้าวาล์ว', 'valves']] },
  { t: 'เป่า เช็ดให้แห้ง ตรวจฉนวน แล้วประกอบกลับ', form: 'ป้องกัน · ประกอบกลับ · ส่งคืนพื้นที่', what: 'เป่าและเช็ดชิ้นส่วนให้แห้งก่อนประกอบ ตรวจฉนวนท่อและจุดยึด ประกอบกลับครบทุกชิ้น เก็บถุงล้าง พลาสติกคลุม และผ้าใบ', why: 'ไม่มีน้ำค้างใกล้วงจร ไม่มีชิ้นส่วนเหลือ', get: 'พื้นที่คืนสภาพเดิม', s: { ...CLEAN_ALL, power: 0, run: 0, ladder: 1 }, tech: ['unit', 'work', 'blower'], cam: 'unit', lab: [['ประกอบกลับครบ ไม่มีชิ้นส่วนเหลือ', 'unit']] },
  { t: 'เปิดไฟ ทดสอบการทำงานและน้ำทิ้ง', form: 'T1 · ทุกระดับบริการ', what: 'เปิดเบรกเกอร์ เดินเครื่องทดสอบ ลมออกสม่ำเสมอ รีโมตปกติ ไม่มี Error ใหม่ เสียงและการสั่นปกติ ตรวจน้ำทิ้งไหลออกอีกครั้ง', why: 'ยืนยันว่าเครื่องกลับมาทำงานปกติก่อนส่งมอบ', get: 'ผลทดสอบการทำงานในรายงาน', s: { ...CLEAN_ALL, drain: 1 }, air: 1, tech: ['unitFloor', 'remote', 'remote'], cam: 'overview', lab: [['ลมเย็นออกเข้าห้อง', 'outlet'], ['น้ำทิ้งไหลออกปกติ', 'drainEnd'], ['คอยล์ร้อนเดินปกติ', 'fan']] },
  { t: 'วัดค่าหลังล้าง เทียบก่อนล้าง', form: 'T2 · Standard Care', what: 'วัดอุณหภูมิลมกลับ ลมจ่าย ΔT กระแส และแรงดัน ที่จุดเดิมกับก่อนล้าง บันทึกเทียบกัน', why: 'ยืนยันผลด้วยตัวเลขและภาพ ไม่ใช่คำบอกเล่า · ไม่มีค่า ΔT ผ่าน/ไม่ผ่านค่าเดียวที่ใช้ได้ทุกยี่ห้อ', get: 'ตัวเลขก่อน–หลังในรายงาน', s: { ...CLEAN_ALL, chip: 'after', ladder: 1 }, tech: ['unit', 'measure', 'probe'], cam: 'unit', lab: [['ลมกลับ — จุดเดิม', 'intake'], ['ลมจ่าย — จุดเดิม', 'outlet']] },
  { t: 'ส่งมอบ: ภาพหลังงาน เกรด A–D รอบถัดไป', form: 'แบบฟอร์มข้อ 5–6', what: 'ทำความสะอาดและส่งคืนพื้นที่ ถ่ายภาพหลังงาน ให้เกรดสภาพเครื่อง A–D บันทึกสิ่งที่พบนอกขอบเขต แนะนำรอบล้างถัดไป ลงนามช่าง หัวหน้าทีม และลูกค้า', why: 'ลูกค้าเห็นหลักฐานครบ และรู้ว่าควรดูแลครั้งถัดไปเมื่อไร', get: 'รายงานบริการ + รอบบริการถัดไป', s: { ...CLEAN_ALL, cust: 'stand', report: 'clean' }, tech: ['front', 'present', 'tablet'], cam: 'front', lab: [] },
];
const C2_IN = [
  { t: 'ปลดคอยล์เย็นจากขายึด ลดระดับลง (ไม่ตัดท่อน้ำยา)', form: 'รายการเพิ่มเติม C2', what: 'ปลดตัวเครื่องออกจากตะขอแผ่นยึด โน้มตัวเครื่องออกจากผนังและลดระดับลงเล็กน้อย ท่อน้ำยาและสายไฟยังต่ออยู่ ยืนยันว่าไม่ตัดท่อและไม่เปิดวงจรน้ำยา', why: 'เข้าถึงคอยล์ด้านหลังและใบพัดได้เต็มที่ โดยไม่เสี่ยงน้ำยารั่ว', get: 'ล้างได้ลึกกว่าล้างปกติ', s: { ...PROTECT, parts: 1, unhang: 1 }, tech: ['unit', 'work', null], cam: 'unitSide', lab: [['ท่อน้ำยายังต่ออยู่ ไม่ตัดท่อ', 'tail'], ['แผ่นยึดบนผนัง', 'plate'], ['คอยล์ด้านหลังที่ล้างปกติเข้าไม่ถึง', 'coilBack']] },
  { t: 'ถอดใบพัดโบลเวอร์และถาดน้ำทิ้ง + ลงทะเบียนชิ้นส่วน', form: 'ทะเบียนชิ้นส่วนที่ถอด · บังคับสำหรับ C2', what: 'ถอดใบพัดโบลเวอร์ โครงใบพัด ถาดน้ำทิ้ง และจุดต่อทางน้ำทิ้งลงมาทีละชิ้น ถ่ายภาพและบันทึกลงทะเบียน (ไม่บันทึกถือว่าไม่ได้ทำ)', why: 'คราบในใบพัดและเมือกในถาดคือต้นเหตุกลิ่นอับและน้ำล้น', get: 'รู้ว่าชิ้นไหนถูกถอดล้างจริง ประกอบกลับครบ', s: { ...PROTECT, parts: 1, unhang: 1, inner: 1 }, tech: ['unit', 'work', null], cam: 'parts', lab: [['ใบพัดโบลเวอร์', 'pBlower'], ['ถาดน้ำทิ้ง', 'pPan'], ['หน้ากาก + แผ่นกรอง', 'pFront']] },
  { t: 'ล้างแผงคอยล์ด้านหลัง — จุดต่างสำคัญของ C2', form: 'รายการเพิ่มเติม C2', what: 'ฉีดล้างคอยล์จากด้านหลังที่ล้างปกติเข้าไม่ถึง แล้วล้างด้านหน้าตามแนวครีบ น้ำลงถุงและถัง', why: 'คราบสะสมด้านหลังคอยล์ทำให้ลมผ่านน้อยแม้ล้างด้านหน้าแล้ว', get: 'คอยล์สะอาดทั้งสองด้าน', s: { ...PROTECT, parts: 1, unhang: 1, inner: 1, washer: 1, spray: 'back', dBack: 0, dCoil: 0 }, tech: ['unit', 'spray', 'gun'], cam: 'unitSide', lab: [['คอยล์ด้านหลัง', 'coilBack'], ['ท่อน้ำยาต่ออยู่ตลอด', 'tail']] },
  { t: 'ล้างชิ้นส่วนที่ถอดทีละชิ้นนอกตัวเครื่อง', form: 'รายการเพิ่มเติม C2', what: 'ล้างใบพัด โครงใบพัด ถาดน้ำทิ้ง หน้ากาก แผ่นกรอง และบานสวิงแยกทีละชิ้นบนพื้นที่ที่ปูไว้', why: 'ล้างได้ทั่วทุกซอก ไม่ทิ้งคราบในตัวเครื่อง', get: 'ชิ้นส่วนสะอาดก่อนประกอบกลับ', s: { ...PROTECT, parts: 1, unhang: 1, inner: 1, washer: 1, spray: 'parts', dBack: 0, dCoil: 0, dBlower: 0, dPan: 0, dFilter: 0 }, tech: ['bucket', 'crouchSpray', 'gun'], cam: 'parts', lab: [['ใบพัดโบลเวอร์', 'pBlower'], ['ถาดน้ำทิ้ง', 'pPan']] },
];
function storyC2() {
  const a = C1.slice(0, 5).map(s => ({ ...s })), rest = C1.slice(5).map(s => ({ ...s, s: { ...s.s } }));
  const mid = rest.filter(s => !s.t.startsWith('ล้างโบลเวอร์')).map(s => {
    if (s.t.startsWith('ฉีดน้ำยา') || s.t.startsWith('ล้างแผงคอยล์เย็นด้านหน้า')) return { ...s, s: { ...s.s, unhang: 1, inner: 1, dBack: s.t.startsWith('ล้างแผงคอยล์') ? 0 : 1 } };
    if (s.t.startsWith('ล้างและทะลวง')) return { ...s, t: 'ล้างทางน้ำทิ้งและทดสอบการไหล', what: 'ล้างจุดต่อทางน้ำทิ้งที่ถอดออก ทะลวงและเทน้ำทดสอบให้ไหลออกปลายท่อที่ระเบียง', s: { ...s.s, unhang: 1, inner: 1, spray: null, dBack: 0, dFilter: 0 }, tech: ['unit', 'work', null] };
    if (s.t.startsWith('ฉีดล้างคอยล์ร้อน')) return { ...s, s: { ...s.s, unhang: 1, inner: 1, dBack: 0, dFilter: 0 } };
    if (s.t.startsWith('เป่า')) return { ...s, t: 'เป่าให้แห้ง ประกอบกลับ แขวนเครื่องเข้าที่', form: 'ประกอบกลับ · ยึดเครื่องเข้าที่และตรวจรั่วซึม', what: 'เป่าและเช็ดให้แห้ง ใส่ใบพัดและถาดกลับ แขวนตัวเครื่องกลับบนแผ่นยึดให้ล็อกครบทุกตะขอ ตรวจฉนวนและจุดต่อไม่รั่วซึม ประกอบหน้ากาก แผ่นกรอง บานสวิง เก็บอุปกรณ์', get: 'ประกอบครบตามทะเบียนชิ้นส่วน' };
    if (s.t.startsWith('ส่งมอบ')) return { ...s, s: { ...s.s, report: 'clean2' } };
    return s;
  });
  return [...a, ...C2_IN, ...mid];
}
const INS = {
  STANDARD: { leak: 'ตรวจรอยต่อแฟลร์ทุกจุดที่เข้าถึงได้ (แพ็กเกจมาตรฐาน)', leakChip: 'leakStd', n2: 0, vac: 'ต่อปั๊มสุญญากาศดูดอากาศและความชื้นออกจากท่อก่อนปล่อยน้ำยา บันทึกเวลาและค่าที่วัดได้', follow: '' },
  PREMIUM: { leak: 'อัดไนโตรเจนเข้าระบบตามแรงดันที่คู่มือรุ่นกำหนด ค้างไว้ตามเวลา ดูเข็มเกจไม่ตก และตรวจฟองที่รอยต่อ ตรวจแรงบิดขันแฟลร์ บันทึก psi และนาที', leakChip: 'leak', n2: 1, vac: 'ต่อปั๊มสุญญากาศดูดอากาศและความชื้นออกจนได้ระดับตามคู่มือ บันทึกค่า micron / inHg แล้วปิดวาล์วทดสอบค้าง (Vacuum Hold) ดูว่าค่าไม่ขึ้น', follow: ' และนัดตรวจติดตาม 2 ครั้ง' },
};
// build stages: which parts of the installation exist
const B = (o) => ({ plate: 0, hole: 0, base: 0, cdu: 0, pipes: 0, unit: 0, nuts: 0, power: 0, ...o });
function storyInstall(tier) {
  const T = INS[tier] || INS.STANDARD;
  const off = { power: 0, run: 0, lids: 0 };
  return [
    { t: 'สำรวจหน้างานและวางแนวท่อ', form: 'แบบฟอร์มติดตั้งข้อ 1–2', what: 'ตรวจตำแหน่งคอยล์เย็น–คอยล์ร้อน วัดระยะและแนวท่อ ตรวจระบบไฟ เบรกเกอร์ ความสูง และผนังที่ต้องรับน้ำหนัก ติดเทปแนวเดินรางไว้ก่อน', why: 'รู้ระยะท่อ วัสดุส่วนเกิน และข้อจำกัดหน้างานก่อนเริ่มงาน', get: 'ใบเสนอราคาที่ตรงกับหน้างานจริง', s: { ...off, build: B({}), marks: 1 }, tech: ['unitFloor', 'tablet', 'tablet'], cam: 'overview', lab: [['ตำแหน่งคอยล์เย็น', 'plate'], ['แนวรางครอบท่อที่วางไว้', 'marksA'], ['ตำแหน่งคอยล์ร้อน', 'cduSpot'], ['เบรกเกอร์แยกวงจร', 'rcbo']] },
    { t: 'ตรวจรับเครื่องก่อนติดตั้ง', form: 'Model / Serial จากป้ายจริง', what: 'ตรวจ Model และ Serial จากป้ายเครื่องจริงของคอยล์เย็นและคอยล์ร้อนให้ตรงกับใบเสนอราคา/PO และ BTU ที่ตกลง ตรวจสภาพกล่องและอุปกรณ์ในกล่อง ถ่ายภาพไว้', why: 'ติดตั้งเครื่องตรงรุ่นที่ลูกค้าซื้อ และมีหลักฐานสภาพก่อนเปิดกล่อง', get: 'เครื่องตรงตามใบเสนอราคา', s: { ...off, build: B({}), boxes: 1, marks: 1 }, tech: ['boxes', 'tablet', 'tablet'], cam: 'boxes', lab: [['คอยล์เย็น (กล่อง)', 'boxA'], ['คอยล์ร้อน (กล่อง)', 'boxB']] },
    { t: 'ยึดแผ่นยึดให้ได้ระดับ และเจาะผนัง', form: 'งานเครื่องกล', what: 'ยึดแผ่นยึดด้วยพุกตามชนิดผนังและตั้งระดับด้วยระดับน้ำ เจาะรูทะลุผนังให้ลาดออกด้านนอกเล็กน้อยกันน้ำย้อน ใส่ฝาครอบผนังทั้งสองด้าน', why: 'ตัวเครื่องได้ระดับ น้ำทิ้งไหลถูกทาง ไม่มีน้ำย้อนเข้าผนัง', get: 'งานยึดแข็งแรง เรียบร้อย', s: { ...off, build: B({ plate: 1, hole: 1 }), ladder: 1, level: 1, marks: 1, boxes: 1 }, tech: ['unit', 'work', 'drill'], cam: 'unit', lab: [['แผ่นยึดตั้งได้ระดับ', 'plate'], ['รูทะลุผนัง + ฝาครอบผนัง', 'wallcap']] },
    { t: 'ติดตั้งรางครอบท่อตามแนว', form: 'Airpro 75 มม. · ข้องอ ข้อต่อ ฝาปิดปลาย', what: 'ยึดตัวรางสีขาวตามแนวเทป เข้ามุมด้วยข้องอฉาก (มุมใน) ข้องอแบน 90° ข้อต่อตรง และฝาปิดปลายยี่ห้อเดียวกัน รางช่วงในห้องลาดเล็กน้อยหาทางออก', why: 'ท่อไม่โดนแดดฝนโดยตรง แนวตรงเรียบร้อย กลมกลืนกับผนัง', get: 'งานติดตั้งดูเรียบร้อยทั้งในห้องและนอกบ้าน', s: { ...off, build: B({ plate: 1, hole: 1, base: 1 }), boxes: 1, ladder: 1 }, tech: ['unit', 'work', 'drill'], cam: 'trunk', lab: [['รางครอบท่อ (ตัวราง)', 'trunkIn'], ['มุมใน', 'corner'], ['ข้องอแบน 90°', 'flat'], ['ข้อต่อตรง', 'joint']] },
    { t: 'ตั้งคอยล์ร้อนบนขาตั้ง + ยางรองกันสั่น', form: 'ระยะบริการ / ระบายอากาศ', what: 'ตั้งคอยล์ร้อนบนขาตั้งเหล็กชุบกัลวาไนซ์ วางยางรองกันสั่นทุกจุด ปรับระดับ เว้นระยะด้านหลังและด้านข้างให้ระบายลมตามคู่มือรุ่น', why: 'ลดเสียงและแรงสั่น ระบายความร้อนได้ดี', get: 'เครื่องเงียบ ทำงานได้เต็มประสิทธิภาพ', s: { ...off, build: B({ plate: 1, hole: 1, base: 1, cdu: 1 }) }, tech: ['cduFront', 'crouch', null], cam: 'cdu', ghost: 1, lab: [['ขาตั้งเหล็กกัลวาไนซ์', 'stand'], ['ยางรองกันสั่น', 'pads'], ['ระยะระบายลมด้านหลัง', 'cduBack']] },
    { t: 'เดินท่อน้ำยา ท่อน้ำทิ้ง และสายไฟลงราง', form: 'ท่อไม่หักงอ · ฉนวนต่อเนื่อง', what: 'ท่อทองแดง O-TWO หนา 0.70 มม. หุ้มฉนวน Aeroflex ตลอดแนว ดัดโค้งด้วยเครื่องดัดไม่ให้ท่อหักงอ ท่อน้ำทิ้ง PVC สีฟ้าลาดลงตลอดแนว สายไฟ Yazaki THW แยกเส้นไฟ นิวทรัล และสายดิน', why: 'ท่อหักงอทำให้น้ำยาไหลไม่สะดวก ฉนวนขาดทำให้เกิดหยดน้ำ', get: 'วัสดุเกรดเดียวกันทั้งแนว เห็นก่อนปิดราง', s: { ...off, build: B({ plate: 1, hole: 1, base: 1, cdu: 1, pipes: 1 }), reveal: 1, ladder: 1 }, tech: ['unit', 'work', null], cam: 'trunk', lab: [['ท่อทองแดง O-TWO 0.70 มม. + ฉนวน Aeroflex', 'insul'], ['ท่อน้ำทิ้ง PVC สีฟ้า', 'drainRun'], ['สายไฟ Yazaki THW 3 เส้น', 'cable']], grow: 1 },
    { t: 'แขวนคอยล์เย็น ต่อแฟลร์ด้านใน', form: 'Flare / Brazing ครบ · ได้ระดับ', what: 'บานแฟลร์ปลายท่อ ต่อเข้ากับท่อของคอยล์เย็น ขันด้วยประแจวัดแรงบิดตามค่าคู่มือ หุ้มฉนวนและพันเทปจุดต่อ แขวนเครื่องลงบนแผ่นยึดให้ล็อกครบทุกตะขอ', why: 'จุดต่อแฟลร์เป็นจุดที่เสี่ยงรั่วที่สุดของงานติดตั้ง', get: 'จุดต่อแน่นตามมาตรฐาน', s: { ...off, build: B({ plate: 1, hole: 1, base: 1, cdu: 1, pipes: 1, unit: 1 }), ladder: 1 }, tech: ['unit', 'work', 'wrench'], cam: 'unit', lab: [['ประแจวัดแรงบิด', 'hand'], ['คอยล์เย็นล็อกบนแผ่นยึด', 'unit']] },
    { t: 'ต่อแฟลร์ที่วาล์วคอยล์ร้อน และระบบไฟ', form: 'ระบบไฟฟ้าและการควบคุม', what: 'ต่อแฟลร์เข้ากับวาล์วบริการของคอยล์ร้อน ขันแรงบิดตามคู่มือ ต่อสายไฟตามแผนผังของรุ่น ขั้วแน่น ต่อสายดิน และติดตั้งเบรกเกอร์ RCBO แยกวงจร', why: 'ไฟถูกขนาดและมีตัวตัดไฟรั่ว ลดความเสี่ยงไฟดูดและไฟไหม้', get: 'ระบบไฟแยกวงจรพร้อมสายดิน', s: { ...off, build: B({ plate: 1, hole: 1, base: 1, cdu: 1, pipes: 1, unit: 1, nuts: 1, power: 1 }) }, tech: ['cduValve', 'crouch', 'wrench'], cam: 'cduValve', ghost: 1, lab: [['แฟลร์นัตที่วาล์วบริการ', 'valves'], ['ทองแดงช่วงที่เห็นก่อนเข้าวาล์ว', 'copper'], ['สายไฟเข้าขั้วต่อ', 'term']] },
    { t: 'ทดสอบรอยรั่ว', form: 'Pressure / Leak Test', what: T.leak, why: 'หาจุดรั่วก่อนปล่อยน้ำยาเข้าระบบ ถ้ารั่วแก้ได้ทันที', get: 'ผลทดสอบในรายงาน', s: { ...off, build: B({ plate: 1, hole: 1, base: 1, cdu: 1, pipes: 1, unit: 1, nuts: 1, power: 1 }), gauges: 1, n2: T.n2, chip: T.leakChip, needle: T.n2 ? 0.75 : 0 }, tech: ['cduValve', 'crouch', T.n2 ? null : 'torch'], cam: 'cduValve', ghost: 1, lab: T.n2 ? [['ถังไนโตรเจน + เรกูเลเตอร์', 'n2'], ['เกจวัดแรงดัน', 'gauges']] : [['ตรวจรอยต่อแฟลร์', 'valves']] },
    { t: 'ทำสุญญากาศ (Vacuum)', form: 'Vacuum Record', what: T.vac, why: 'อากาศและความชื้นที่ค้างในท่อทำให้ระบบทำงานผิดปกติและอายุสั้นลง', get: 'Vacuum Record ในรายงาน', s: { ...off, build: B({ plate: 1, hole: 1, base: 1, cdu: 1, pipes: 1, unit: 1, nuts: 1, power: 1 }), gauges: 1, vac: 1, chip: 'vac', needle: -0.9 }, tech: ['cduValve', 'tablet', 'tablet'], cam: 'cduValve', ghost: 1, lab: [['ปั๊มสุญญากาศ', 'vacPump'], ['เกจอ่านค่า', 'gauges']] },
    { t: 'เปิดวาล์ว เดินเครื่องทดสอบ วัดค่า', form: 'ค่าหลังติดตั้ง', what: 'เปิดวาล์วบริการให้น้ำยาเข้าระบบ เติมน้ำยาเพิ่มเฉพาะเมื่อท่อยาวเกินระยะที่ผู้ผลิตกำหนดและบันทึกปริมาณ เปิดเบรกเกอร์ เดินเครื่อง วัด V · A · ลมกลับ · ลมจ่าย · ΔT ตรวจรีโมตและ Error', why: 'ยืนยันด้วยค่าที่วัดได้ว่าระบบทำงานถูกต้อง', get: 'ค่าที่วัดได้ในใบรับมอบ', s: { build: B({ plate: 1, hole: 1, base: 1, cdu: 1, pipes: 1, unit: 1, nuts: 1, power: 1 }), lids: 0, chip: 'commission', ladder: 1 }, air: 1, tech: ['unit', 'measure', 'probe'], cam: 'unit', lab: [['ลมกลับ', 'intake'], ['ลมจ่าย', 'outlet']] },
    { t: 'ทดสอบน้ำทิ้ง ปิดฝาราง เก็บงาน', form: 'น้ำทิ้ง · งานเก็บ · Punch list', what: 'เทน้ำทดสอบที่ถาดให้ไหลออกปลายท่อได้ดี ไม่ย้อน ปิดฝารางและข้องอทุกจุด ตรวจรายการค้าง (Punch list) ทำความสะอาดพื้นที่ ถ่ายภาพก่อน–หลัง', why: 'ปิดงานเรียบร้อย ไม่มีงานค้าง', get: 'บ้านสะอาด งานเรียบร้อยพร้อมใช้งาน', s: { build: B({ plate: 1, hole: 1, base: 1, cdu: 1, pipes: 1, unit: 1, nuts: 1, power: 1 }), lids: 1, drain: 1 }, tech: ['unitFloor', 'tablet', 'tablet'], cam: 'drain', lab: [['ฝารางปิดครบ', 'trunkOut'], ['น้ำทิ้งออกท่อระบาย', 'drainEnd']] },
    { t: 'ส่งมอบและสอนใช้งาน', form: 'รายการส่งมอบ · ลงนาม 3 ฝ่าย', what: `ส่งรีโมต คู่มือ บัตรรับประกัน/QR สอนเปิด–ปิด โหมด และการล้างฟิลเตอร์ แจ้งเงื่อนไขรับประกัน (ตัวเครื่องตามผู้ผลิต · งานติดตั้งโดยบริษัท) ตั้งรอบบริการถัดไป${T.follow}`, why: 'ลูกค้าใช้งานถูกวิธี รู้สิทธิ์การรับประกัน', get: 'เอกสารรับประกันงานติดตั้ง', s: { build: B({ plate: 1, hole: 1, base: 1, cdu: 1, pipes: 1, unit: 1, nuts: 1, power: 1 }), cust: 'stand', report: 'install' }, tech: ['front', 'present', 'tablet'], cam: 'front', lab: [] },
  ];
}
const REPAIR = [
  { t: 'รับแจ้งอาการและข้อมูลเครื่อง', form: 'ก่อนเริ่มงาน', what: 'สอบถามอาการ เวลาที่เกิด Error Code ยี่ห้อและรุ่น (ภาพป้าย Nameplate) ประวัติการล้างหรือซ่อม ถ้ามีกลิ่นไหม้ ควัน หรือเบรกเกอร์ตัดซ้ำ ให้ปิดเครื่องและตัดเบรกเกอร์ก่อน', why: 'ข้อมูลครบช่วยให้ตรวจตรงจุดและเตรียมอะไหล่ถูก', get: 'นัดตรวจที่ตรงอาการ', s: { cust: 'stand' }, tech: ['front', 'tablet', 'tablet'], cam: 'front', lab: [['เครื่องที่แจ้งอาการ', 'unit']] },
  { t: 'ตรวจความปลอดภัยก่อนเปิดเครื่อง', form: 'ความปลอดภัยต้องมาก่อน', what: 'ตรวจเบรกเกอร์และสภาพสายไฟที่มองเห็น กลิ่นไหม้ รอยน้ำ ถ้าพบความเสี่ยงหยุดตรวจและแจ้งลูกค้าก่อน', why: 'บางอาการเปิดเครื่องต่อแล้วเสียหายเพิ่มหรือเป็นอันตราย', get: 'ตรวจอย่างปลอดภัย', s: { power: 0, run: 0 }, tech: ['breaker', 'switch', 'torch'], cam: 'breaker', lab: [['เบรกเกอร์ RCBO', 'rcbo'], ['รางสายไฟ', 'mini']] },
  { t: 'เดินเครื่องดูอาการ Error Code รีโมต', form: 'ตรวจวินิจฉัยหน้างาน', what: 'เปิดเครื่อง ดูไฟแสดงผลและ Error Code เทียบกับคู่มือของรุ่น ตรวจรีโมตและตัวรับสัญญาณ ฟังเสียงและดูการสั่น', why: 'รหัส Error แต่ละยี่ห้อหมายถึงคนละอย่าง ต้องเทียบกับคู่มือรุ่นนั้น', get: 'ข้อมูลอาการที่ยืนยันได้', s: {}, air: 1, tech: ['unitFloor', 'remote', 'remote'], cam: 'unit', lab: [['จอแสดงผล / Error Code', 'display'], ['ลมออก', 'outlet']] },
  { t: 'ตรวจแผ่นกรอง คอยล์ ถาดและท่อน้ำทิ้ง', form: 'ตรวจด้วยสายตา', what: 'เปิดหน้ากากดูแผ่นกรอง คอยล์ ใบพัด ถาดน้ำทิ้ง และทางน้ำ ส่องไฟดูคราบ น้ำแข็งเกาะ และรอยน้ำมัน', why: 'อาการไม่เย็นหรือน้ำหยดหลายกรณีเริ่มจากฟิลเตอร์ คอยล์ หรือท่อน้ำทิ้ง', get: 'รู้ว่าต้องล้าง ซ่อม หรือตรวจลึกต่อ', s: { power: 0, run: 0, peek: 1, ladder: 1 }, tech: ['unit', 'work', 'torch'], cam: 'unitClose', lab: [['แผ่นกรอง', 'filter'], ['คอยล์เย็น', 'coil'], ['ถาดน้ำทิ้ง', 'pan']] },
  { t: 'วัดอุณหภูมิลมกลับ–ลมจ่าย', form: 'ค่าที่วัดประกอบการวินิจฉัย', what: 'เดินเครื่องจนคงที่ วัดอุณหภูมิลมกลับและลมจ่ายที่จุดเดิม บันทึก ΔT ประกอบการวินิจฉัย', why: 'ใช้ร่วมกับค่าอื่น ไม่มีเกณฑ์ ΔT ค่าเดียวที่ใช้ได้ทุกยี่ห้อ', get: 'ตัวเลขประกอบผลตรวจ', s: { chip: 'dt', ladder: 1 }, tech: ['unit', 'measure', 'probe'], cam: 'unit', lab: [['ลมกลับ', 'intake'], ['ลมจ่าย', 'outlet']] },
  { t: 'วัดกระแสและแรงดันไฟขณะเดินเครื่อง', form: 'Current / Voltage', what: 'ใช้แคลมป์มิเตอร์วัดกระแสสายไฟเข้าคอยล์ร้อนขณะเดินเครื่อง วัดแรงดันไฟ เทียบกับค่าบนป้ายของรุ่น ตรวจความแน่นขั้วต่อและสายดิน', why: 'กระแสหรือแรงดันผิดปกติบอกปัญหาคอมเพรสเซอร์ คาปาซิเตอร์ หรือระบบไฟต้นทาง', get: 'ค่าไฟฟ้าในรายงาน', s: { chip: 'amps' }, tech: ['cduValve', 'crouch', 'meter'], cam: 'cduValve', ghost: 1, lab: [['วัดกระแสที่สายเข้าคอยล์ร้อน', 'term'], ['วาล์วบริการ', 'valves']] },
  { t: 'ตรวจคอยล์ร้อน พัดลม และระยะระบายความร้อน', form: 'ตรวจด้วยสายตา + ฟังเสียง', what: 'ดูคราบที่ครีบ การหมุนของพัดลม เสียงคอมเพรสเซอร์ ยางรองกันสั่น และสิ่งกีดขวางทางลมรอบเครื่อง', why: 'คอยล์ร้อนระบายความร้อนไม่ออกทำให้ไม่เย็นและตัดบ่อย', get: 'รู้สภาพระบบทั้งชุด', s: {}, tech: ['cduFront', 'crouch', 'torch'], cam: 'cdu', lab: [['พัดลมคอยล์ร้อน', 'fan'], ['ครีบคอยล์ร้อน', 'oCoil'], ['ยางรองกันสั่น', 'pads']] },
  { t: 'ตรวจระบบสารทำความเย็น (A4 · เมื่อจำเป็น)', form: 'A4 — ทำเมื่อใบเสนอราคาระบุ หรือพบอาการผิดปกติ', what: 'ต่อเกจที่วาล์วบริการ เดินเครื่องจนคงที่ บันทึกแรงดันด้านต่ำและด้านสูง (psi) อุณหภูมิแวดล้อม และเวลาที่เดินเครื่องคงที่', why: 'ใช้ประกอบการวินิจฉัย การตรวจนี้ไม่รับประกันว่าจะพบจุดรั่ว', get: 'ผลตรวจพร้อมคำแนะนำ', s: { gauges: 1, chip: 'a4', needle: 0.35 }, tech: ['cduValve', 'crouch', null], cam: 'cduValve', ghost: 1, lab: [['เกจวัดแรงดัน', 'gauges'], ['ต่อที่วาล์วบริการ', 'valves']] },
  { t: 'แจ้งผลตรวจและราคาซ่อมรายรายการ', form: 'ไม่ซ่อมก่อนอนุมัติ', what: 'สรุปสาเหตุที่เป็นไปได้จากค่าที่วัด แจ้งอะไหล่ ค่าแรง ระยะรับประกันต่อรายการ และทางเลือก ซ่อม / เปลี่ยน / ไม่ซ่อม', why: 'ลูกค้าตัดสินใจจากข้อมูลจริง ไม่มีค่าใช้จ่ายแอบแฝง', get: 'ใบเสนอราคารายรายการ', s: { cust: 'stand' }, tech: ['front', 'present', 'tablet'], cam: 'front', lab: [] },
  { t: 'ซ่อมหลังอนุมัติ ทดสอบ และส่งรายงาน', form: 'รายงานตรวจ / ซ่อม', what: 'ซ่อมหรือเปลี่ยนอะไหล่ตามที่อนุมัติ เก็บอะไหล่เก่าให้ลูกค้าดู ถ้าพบปัญหาเพิ่มแจ้งก่อนทำต่อ เดินเครื่องทดสอบ วัดค่าที่เกี่ยวข้อง แล้วส่งรายงานและเงื่อนไขรับประกันต่อรายการ', why: 'ยืนยันผลหลังซ่อมด้วยการทดสอบ', get: 'รายงานพร้อมใบรับประกัน', s: { cust: 'stand', report: 'repair' }, tech: ['front', 'present', 'tablet'], cam: 'front', lab: [] },
];
export const STORIES = { C1: () => C1, C2: storyC2, install: tier => storyInstall(tier), repair: () => REPAIR };

/* ---------------------------------------------------------------- particles */
const dotTex = (() => { let t; return () => t || (t = canvasTex(64, 64, g => { const r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.5, 'rgba(255,255,255,.5)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); })); })();
function cloud(n, color, size, additive = false) {
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  const p = new THREE.Points(g, new THREE.PointsMaterial({ color, size, map: dotTex(), transparent: true, depthWrite: false, opacity: 0.9, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending }));
  p.frustumCulled = false; p.renderOrder = 9; p.userData = { n, a: new Float32Array(n * 6), life: new Float32Array(n).map(() => Math.random()) }; return p;
}

/* ================================================================= 3D engine */
export function createTechStory3D(container, opts = {}) {
  const dark = opts.theme === 'dark';
  const stage = createStage(container, { theme: opts.theme, name: 'เรื่องเล่างานช่าง' });
  const home = buildHome(stage.scene, { type: 'wall', theme: opts.theme });
  const tools = buildTools(home), tech = createTech(home, { tools });
  const labels = createLabels(container); labels.occluders(home.walls);
  const U = home.U, OU = home.OU, P = U.parts;
  // unique materials so dirt tint stays local
  const tintable = { dFilter: [], dCoil: [], dBack: [], dBlower: [], dPan: [], dOut: [] };
  U.root.traverse(o => { if (o.isMesh || o.isInstancedMesh) { o.material = o.material.clone(); } });
  OU.root.traverse(o => { if (o.isMesh || o.isInstancedMesh) { o.material = o.material.clone(); } });
  const reg = (grp, ch) => grp && grp.traverse(o => { if ((o.isMesh || o.isInstancedMesh) && o.material.color) { o.userData.base = o.material.color.clone(); tintable[ch].push(o); } });
  reg(P.filter, 'dFilter'); reg(P.coil, 'dCoil'); reg(P.blower, 'dBlower'); reg(P.pan, 'dPan'); reg(OU.parts['o-coil'], 'dOut');
  const dirtC = new THREE.Color(0x5b4a33);
  // parts that come off the unit and lie on the drop cloth
  const REST = {}; for (const id of ['front', 'filter', 'louver', 'blower', 'motor', 'pan']) { const o = P[id]; REST[id] = { parent: o.parent, p: o.position.clone(), q: o.quaternion.clone() }; }
  const toQ = (x, y, z) => new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z));
  const SPOT = { front: [V(0.38, 0.12, -1.22), toQ(-Math.PI / 2, 0.15, 0)], filter: [V(0.42, 0.05, -0.9), toQ(-1.2, -0.2, 0)], louver: [V(0.36, 0.03, -1.66), toQ(0, 0.3, 0)], blower: [V(1.34, 0.06, -0.86), toQ(0, 0.25, 0)], motor: [V(1.3, 0.05, -0.86), toQ(0, 0.25, 0)], pan: [V(0.62, 0.035, -1.72), toQ(0, -0.1, 0)] };
  const centerOf = o => { const b = new THREE.Box3().setFromObject(o); return b.getCenter(new THREE.Vector3()); };
  const mover = {};
  function partOff(id, on) {
    const o = P[id], m = mover[id] || (mover[id] = { k: 1, off: false }); if (m.off === on) return; m.off = on; m.k = 0;
    if (on) { const c = o.worldToLocal(centerOf(o)); home.props.attach(o); const [pw, q] = SPOT[id]; m.from = { p: o.position.clone(), q: o.quaternion.clone() }; m.to = { p: pw.clone().sub(c.clone().applyQuaternion(q)), q: q.clone() }; m.world = true; }
    else { REST[id].parent.attach(o); m.from = { p: o.position.clone(), q: o.quaternion.clone() }; m.to = { p: REST[id].p.clone(), q: REST[id].q.clone() }; m.world = false; }
  }
  function stepParts(dt) {
    for (const id in mover) { const m = mover[id], o = P[id]; if (m.k >= 1) continue; m.k = RM() ? 1 : Math.min(1, m.k + dt / 1.5); const e = ease(m.k); o.position.lerpVectors(m.from.p, m.to.p, e); if (m.world) o.position.y += Math.sin(Math.PI * e) * 0.25; o.quaternion.slerpQuaternions(m.from.q, m.to.q, e); }
  }
  // airflow in the room
  const air = createAirflow(home.root, { count: 1300, dark, width: 0.018, trail: 0.16, plumeShare: 0 });
  air.setRoom(home.roomBox); air.obstacles(home.obstacles); air.setEmitters(home.emitters);
  const ambient = (x, z) => 30 - 3.6 * Math.exp(-Math.hypot(x - 0.9, (z + 1.8) * 0.5) / 4.2);
  air.set({ airF: 0.7, fan: 1, swing: true, supplyT: 15, roomT: 30, dark, ambient, running: true });
  air.prewarm(180, 0.05);   // r8: settle once, draw once (was 180 full draws)
  const drainFlow = createPathFlow(home.root, { color: 0x3aa0ff, color2: 0x7cc6ff, size: 0.03, count: 90, speed: 0.5, jitter: 0.004, depthTest: false }); drainFlow.setPath(home.flow.drain());
  const spray = cloud(700, 0xd6f0ff, 0.02, true), foam = cloud(600, 0xffffff, 0.026), drip = cloud(260, 0x7d6a48, 0.022);
  home.root.add(spray, foam, drip);
  // HTML overlays: meter chip + report card
  const chipEl = h('div', { class: 'ts-chip', hidden: true }), repEl = h('div', { class: 'ts-report', hidden: true }); container.append(chipEl, repEl);

  /* ---------- anchors ---------- */
  const UL = (x, y, z) => () => U.root.localToWorld(V(x, y, z));
  const PW = id => () => { const o = P[id]; return o.parent === home.props ? centerOf(o).add(V(0, 0.06, 0)) : null; };
  const A = home.anchors;
  const AN = {
    unit: UL(0, 0.06, 0.13), nameplate: UL(0.45, 0.0, 0.02), outlet: UL(0, -0.13, 0.13), intake: UL(0.1, 0.16, -0.02), display: UL(0.32, 0.04, 0.13), filter: UL(-0.1, 0.12, 0.06), coil: UL(-0.1, 0.06, 0.08), coilBack: UL(-0.2, 0.05, -0.1), blower: UL(-0.1, -0.035, 0.05), pan: UL(-0.1, -0.095, 0.08), pcb: UL(0.39, 0.05, 0.1),
    bag: UL(0.2, -0.4, 0.1), bucket: () => tools.items.bucket.position.clone().add(V(0, 0.34, 0)), cloth: V(0.35, 0.02, -1.5), washer: () => tools.items.washer.position.clone().add(V(0, 0.34, 0)), rcbo: A.rcbo, mini: V(1.85, 1.75, -1.98),
    trunkIn: A.trunkIn, trunkOut: A.trunkOut, corner: A.corner, flat: A.flat, joint: A.joint, wallcap: A.wallcap, insul: A.insul, drainRun: A.drain, drainEnd: A.drainEnd, cable: () => home.lanes.L.fixed[Math.floor(home.lanes.L.fixed.length * 0.62)],
    cdu: A.cdu, fan: A.fan, oCoil: home.cdu.clone().add(V(-0.42, 0.05, -0.08)), pads: A.pads, valves: A.valves, copper: home.valve.gas.clone().add(V(0.06, 0.0, 0.0)), term: A.term, stand: home.cdu.clone().add(V(-0.3, -0.36, 0.18)), cduBack: home.cdu.clone().add(V(-0.1, 0.1, -0.17)), cduSpot: home.cdu.clone().add(V(0, 0.2, 0)),
    tail: () => home.lanes.gas.full[4], plate: A.plate, hand: () => tech.hand(), marksA: () => home.lanes.gas.fixed[Math.floor(home.lanes.gas.fixed.length * 0.2)],
    boxA: () => tools.items.boxes.localToWorld(V(0, 0.36, 0)), boxB: () => tools.items.boxes.localToWorld(V(0.02, 0.68, 0.62)), gauges: () => tools.items.gauges.position.clone().add(V(0, 0.1, 0)), vacPump: () => tools.items.vac.position.clone().add(V(0, 0.25, 0)), n2: () => tools.items.n2.position.clone().add(V(0, 1.0, 0)),
    pFront: PW('front'), pFilter: PW('filter'), pLouver: PW('louver'), pBlower: PW('blower'), pPan: PW('pan'),
  };

  /* ---------- state machine ---------- */
  let story = C1, step = -1, t0 = performance.now(), tier = 'STANDARD', storyName = 'C1';
  const S = { ...BASE }, T = { ...BASE };
  const NUM = ['power', 'run', 'unhang', 'foam', 'drain', 'lids', 'needle', 'peek'];
  function build(b) {
    const on = k => !b || b[k] === 1;
    home.unitG.visible = on('unit'); home.plate.visible = on('plate') && !on('unit') || (!!b && b.plate === 1);
    home.wallCaps.visible = on('hole'); home.trunk.base.visible = on('base'); home.outG.visible = on('cdu'); home.stand.visible = on('cdu');
    for (const k in home.meshes) Object.values(home.meshes[k]).forEach(m => { if (m !== home.meshes.gas.core && m !== home.meshes.liq.core) m.visible = on('pipes'); });
    home.nuts.visible = on('nuts'); home.rcbo.visible = on('power'); home.mini.visible = on('power') && on('base'); home.powerMeshes.forEach(m => m.visible = on('power') && on('pipes'));
    home.trunk.lid.visible = home.trunk.fit.visible = on('base');
  }
  function go(i) {
    step = i; const st = i >= 0 ? story[i] : null; const s = st ? st.s : {};
    Object.assign(T, BASE, s, st && st.props ? st.props : {}); T.ghost = st && st.ghost ? 1 : 0; t0 = performance.now();
    if (storyName !== 'install') T.build = null;
    if (i < 0 && storyName === 'install') T.build = B({}), T.lids = 0, T.power = 0, T.run = 0;
    build(T.build);
    // parts on/off
    const pOff = T.parts ? ['front', 'filter', 'louver'] : [], iOff = T.inner ? ['blower', 'motor', 'pan'] : [];
    for (const id of ['front', 'filter', 'louver', 'blower', 'motor', 'pan']) partOff(id, pOff.includes(id) || iOff.includes(id));
    // pipes grow along the run during the piping step
    S.reveal = st && st.grow ? 0 : 1; home.setReveal(S.reveal);
    // props
    ['cloth', 'ladder', 'bag', 'bucket', 'pcb', 'boxes', 'marks', 'level', 'gauges', 'vac', 'n2'].forEach(k => tools.show(k, !!T[k]));
    tools.show('gaugeHoses', !!T.gauges); tools.show('vacHose', !!T.vac); tools.show('n2Hose', !!T.n2);
    tools.show('washer', !!(T.washer || T.washerOut));
    const w = tools.items.washer; if (T.washerOut) { w.position.set(2.92, -0.05, -0.55); w.userData.outlet.set(2.97, 0.15, -0.45); } else { w.position.set(1.95, 0, -1.05); w.userData.outlet.set(2.0, 0.2, -0.95); }
    // technician + customer
    if (st) tech.goTo(st.tech[0], st.tech[1], st.tech[2], RM()); else tech.goTo('unitFloor', 'idle', null, RM());
    tech.customer(T.cust);
    // camera + labels + overlays
    stage.flyTo(CAMS[st ? st.cam : 'overview'] || CAMS.overview, RM() ? 0 : 1600);
    labels.set(st ? st.lab.map(([text, at, warn], k) => ({ text, at: AN[at] || null, warn, n: k + 1 })) : []);
    chip(T.chip); report(T.report);
    if (T.dCoil === 1 && T.dBlower === 1) { S.dFilter = S.dCoil = S.dBlower = S.dPan = S.dOut = S.dBack = 1; }
    opts.onStep && opts.onStep(i);
  }
  function chip(k) {
    const c = CHIPS[k]; chipEl.hidden = !c; if (!c) return; chipEl.innerHTML = '';
    chipEl.append(h('b', {}, c.h), h('dl', {}, ...c.rows.flatMap(([a, b]) => [h('dt', {}, a), h('dd', {}, b)])), h('small', {}, '…  = ช่างกรอกค่าที่วัดได้จริง · ตัวเลขเป็นตัวอย่างการบันทึก ไม่ใช่เกณฑ์ผ่าน/ไม่ผ่าน'));
  }
  function report(k) {
    const r = REPORTS[k]; repEl.hidden = !r; if (!r) return; repEl.innerHTML = '';
    repEl.append(h('b', {}, r.h), h('ul', {}, r.li.map(x => h('li', {}, x))), h('small', {}, r.note));
  }
  function setStory(name, t = tier) { storyName = name; tier = t; story = STORIES[name](t); step = -1; S.dFilter = S.dCoil = S.dBlower = S.dPan = S.dOut = S.dBack = 1; go(-1); }

  /* ---------- per frame ---------- */
  const tmpC = new THREE.Color(), wv = new THREE.Vector3();
  let lastTilt = 0, unitDrop = 0, lastUnitVis = true;
  stage.onFrame((dt, clock, raw) => {
    const rm = RM(), k = rm ? 1 : 1 - Math.pow(0.02, raw), st = (performance.now() - t0) / 1000;
    for (const key of NUM) S[key] += (T[key] - S[key]) * k;
    // dirt: animated while the matching spray plays, otherwise snaps
    const sprayOn = T.spray && !tech.busy;
    for (const ch of Object.keys(tintable)) {
      const target = T[ch]; if (S[ch] === target) continue;
      const cleaning = sprayOn && ((ch === 'dCoil' && (T.spray === 'coil' || T.spray === 'back')) || (ch === 'dBack' && T.spray === 'back') || (ch === 'dBlower' && (T.spray === 'blower' || T.spray === 'parts')) || (ch === 'dPan' && (T.spray === 'pan' || T.spray === 'parts')) || (ch === 'dFilter' && T.spray === 'parts') || (ch === 'dOut' && T.spray === 'outdoor'));
      if (cleaning && target < S[ch]) S[ch] = Math.max(target, S[ch] - raw * (rm ? 9 : 0.2));
      else if (!T.spray || target > S[ch]) S[ch] += (target - S[ch]) * k;
    }
    for (const ch in tintable) { const d = ch === 'dCoil' ? Math.max(S.dCoil * 0.8, S.dBack * 0.45) : S[ch]; for (const o of tintable[ch]) o.material.color.copy(o.userData.base).lerp(dirtC, d * (ch === 'dFilter' ? 0.9 : 0.8)); }
    // parts, un-hang (C2), peek (inspection: front panel lifted)
    stepParts(raw);
    if (home.hang) { const u = ease(clamp(S.unhang, 0, 1)); home.hang.rotation.x = -0.55 * u; home.hang.position.y = 2.356 - 0.14 * u; home.hang.position.z = -1.991 + 0.05 * u;
      if (Math.abs(u - lastTilt) > 0.01 || (u === 0 && lastTilt !== 0)) { lastTilt = u; home.rebuildTails(); } }
    if (!mover.front || !mover.front.off) { P.front.rotation.x = -1.15 * ease(clamp(S.peek, 0, 1)); P.front.position.copy(REST.front.p).add(V(0, 0.05 * S.peek, 0.04 * S.peek)); }
    // power / running
    home.setPower(S.power > 0.5);
    const running = S.power > 0.5 && T.run && !T.parts && !T.peek && (!T.build || T.build.unit === 1);
    const spinK = running ? 1 : 0;
    if (!rm) { P.blower.userData.spin.rotation.x -= dt * 9 * spinK * (1 - S.dBlower * 0.35); OU.parts['o-fan'].userData.spin.rotation.z -= dt * 11 * spinK; }
    const flap = P.louver.userData.flap; flap.rotation.x = running ? 0.55 + Math.sin(clock * 0.9) * 0.22 : flap.rotation.x * (1 - k);
    if (P.front.userData.led) P.front.userData.led.visible = running;
    const dirtAvg = (S.dCoil + S.dBlower + S.dFilter) / 3;
    const showAir = step >= 0 && !!story[step].air; air.set({ running: running && showAir, airF: 1 - dirtAvg * 0.45, supplyT: 13.8 + dirtAvg * 2.2 }); air.update(dt, clock);
    // the indoor unit drops onto its plate when it first appears (install)
    if (home.unitG.visible !== lastUnitVis) { if (home.unitG.visible && storyName === 'install' && !rm) unitDrop = 1; lastUnitVis = home.unitG.visible; }
    if (unitDrop > 0) { unitDrop = Math.max(0, unitDrop - raw / 1.6); const e = ease(unitDrop); home.unitG.position.set(0, -0.35 * e, 0.3 * e); }
    // lids: close during clean-up step (install)
    home.trunk.lid.traverse(m => { if (m.isMesh && m.userData.n) { if (!m.userData.p0) m.userData.p0 = m.position.clone(); m.position.copy(m.userData.p0).addScaledVector(m.userData.n, (1 - clamp(S.lids, 0, 1)) * 0.12); } });
    home.trunk.lid.visible = home.trunk.base.visible && S.lids > 0.03; home.trunk.fit.visible = home.trunk.base.visible && S.lids > 0.5;
    // pipes grow during the piping step
    if (step >= 0 && story[step].grow && S.reveal < 1 && !tech.busy) { S.reveal = Math.min(1, S.reveal + raw * (rm ? 9 : 0.16)); home.setReveal(S.reveal); }
    // tools follow
    U.root.updateWorldMatrix(true, false); tools.update(raw, U.root.matrixWorld);
    tools.bagHoseTo(tools.items.bag.visible ? U.root.localToWorld(V(0.29, -0.58, 0.05)) : null);
    const gun = tech.toolTip('gun'); tools.washerHose(gun && tools.items.washer.visible ? tech.hand() : null);
    const bw = tools.items.bucket.userData.water; const fill = clamp(1 - (S.dCoil + S.dBlower) / 2, 0, 1) * (T.bag ? 1 : 0); bw.position.y = 0.04 + 0.16 * fill; bw.material.color.set(0x6b5a3a).lerp(tmpC.set(0x9cc4dc), 1 - (S.dCoil + S.dBlower) / 2 * 0.2);
    // gauges needles
    if (tools.items.gauges.visible) tools.items.gauges.userData.dials.forEach((d, j) => { d.userData.needle.parent.rotation.z = -(S.needle * (j ? 0.6 : 1)) * 2.2 + Math.sin(clock * 3) * 0.01; });
    tech.setGhost(T.ghost ? 0.22 : 1); tech.stepGhost(raw); tech.tick(dt, clock);
    stepSpray(dt, sprayOn ? T.spray : null, st); stepFoam(S.foam > 0.3 && T.foam); stepDrip(dt, sprayOn && T.bag && ['coil', 'back', 'blower', 'pan', 'chem'].includes(T.spray));
    drainFlow.set(T.drain && S.drain > 0.5 && !tech.busy); drainFlow.update(dt);
  });
  stage.onAfter((camera, W, H) => labels.update(camera, W, H));

  /* ---------- spray / foam / drips ---------- */
  function sprayTarget(kind, st) {
    const r = () => Math.random() - 0.5, sw = Math.sin(st * 1.3);
    if (kind === 'coil' || kind === 'chem') return U.root.localToWorld(V(sw * 0.38 - 0.03 + r() * 0.1, 0.05 + r() * 0.1, 0.08));
    if (kind === 'blower') return U.root.localToWorld(V(sw * 0.3 - 0.06 + r() * 0.08, -0.04 + r() * 0.03, 0.02));
    if (kind === 'pan') return U.root.localToWorld(V(sw * 0.36 - 0.04 + r() * 0.08, -0.09, 0.07 + r() * 0.02));
    if (kind === 'back') return U.root.localToWorld(V(sw * 0.36 - 0.05 + r() * 0.1, 0.06 + r() * 0.08, -0.08));
    if (kind === 'outdoor') return home.outG.localToWorld(V(-0.41, r() * 0.42, -0.1 + sw * 0.1 + r() * 0.12));
    if (kind === 'parts') { const o = P.blower; return centerOf(o).add(V(r() * 0.4, 0.02, r() * 0.1)); }
    return null;
  }
  function stepSpray(dt, kind, st) {
    const p = spray, u = p.userData, pos = p.geometry.attributes.position.array;
    const nz = kind ? tech.toolTip(kind === 'chem' ? 'sprayer' : 'gun') : null; p.visible = !!nz && !RM(); if (!p.visible) return;
    p.material.color.set(kind === 'chem' ? 0xffffff : 0xd6f0ff); p.material.size = kind === 'chem' ? 0.03 : 0.02;
    for (let i = 0; i < u.n; i++) {
      u.life[i] += dt * (kind === 'chem' ? 1.6 : 2.6);
      if (u.life[i] >= 1) { const tg = sprayTarget(kind, st); u.a[i * 6] = tg.x; u.a[i * 6 + 1] = tg.y; u.a[i * 6 + 2] = tg.z; u.life[i] = 0; }
      const t = u.life[i]; pos[i * 3] = nz.x + (u.a[i * 6] - nz.x) * t; pos[i * 3 + 1] = nz.y + (u.a[i * 6 + 1] - nz.y) * t - t * t * 0.02; pos[i * 3 + 2] = nz.z + (u.a[i * 6 + 2] - nz.z) * t;
    }
    p.geometry.attributes.position.needsUpdate = true;
  }
  function stepFoam(on) {
    const p = foam, u = p.userData, pos = p.geometry.attributes.position.array; p.visible = on; if (!on) return;
    if (!u.init) { u.init = 1; for (let i = 0; i < u.n; i++) { const x = -0.41 + Math.random() * 0.74, seg = Math.random(); const v = seg < 0.55 ? V(x, 0.035 + Math.random() * 0.06, 0.09 + Math.random() * 0.012) : V(x, -0.06 + Math.random() * 0.1, 0.128); u.a[i * 6] = v.x; u.a[i * 6 + 1] = v.y; u.a[i * 6 + 2] = v.z; } }
    const tt = performance.now() / 1000;
    for (let i = 0; i < u.n; i++) { wv.set(u.a[i * 6], u.a[i * 6 + 1] - ((tt * 0.01 + i * 0.001) % 0.025), u.a[i * 6 + 2]); U.root.localToWorld(wv); pos[i * 3] = wv.x; pos[i * 3 + 1] = wv.y; pos[i * 3 + 2] = wv.z; }
    p.geometry.attributes.position.needsUpdate = true;
  }
  function stepDrip(dt, on) {
    const p = drip, u = p.userData, pos = p.geometry.attributes.position.array; p.visible = on; if (!on) return;
    p.material.color.copy(tmpC.set(0x7d6a48).lerp(new THREE.Color(0x9ccfe8), 1 - S.dCoil));
    for (let i = 0; i < u.n; i++) { u.life[i] += dt * (0.9 + (i % 5) * 0.1); if (u.life[i] > 1) { u.life[i] = 0; u.a[i * 6] = -0.42 + Math.random() * 0.84; u.a[i * 6 + 1] = Math.random() * 0.2; }
      const t = u.life[i]; wv.set(u.a[i * 6] * (1 - t * 0.8) + 0.29 * t * 0.8, -0.13 - t * 0.42, u.a[i * 6 + 1] * (1 - t) + 0.05 * t); U.root.localToWorld(wv); pos[i * 3] = wv.x; pos[i * 3 + 1] = wv.y; pos[i * 3 + 2] = wv.z; }
    p.geometry.attributes.position.needsUpdate = true;
  }
  setStory('C1');
  return { go, setStory, get length() { return story.length; }, story: () => story, dispose: () => stage.dispose(), advance: sec => stage.advance(sec), _dbg: { home, tech, tools, stage } };
}

/* ================================================================= UI */
export function mountTechStory(root, cfg = {}) {
  root.classList.add('ts', 'ts8');
  let mode = 'C1', step = -1, S3 = null, timer = null, playing = false, tier = 'STANDARD';
  const TAB = [['C1', 'ล้างปกติ (C1)'], ['C2', 'ล้างใหญ่ (C2)'], ['install', 'ติดตั้ง'], ['repair', 'ตรวจเช็ก / ซ่อม']];
  const tabs = h('div', { class: 'ts-tabs', role: 'tablist', 'aria-label': 'งานของช่าง' });
  const stage = h('div', { class: 'ts-stage' }), fb = h('div', { class: 'ts-fb', hidden: true }, 'อุปกรณ์นี้แสดงภาพ 3 มิติไม่ได้ ขั้นตอนด้านล่างยังอ่านได้ครบ'); stage.append(fb);
  const tl = h('div', { class: 'ts-tl', role: 'group', 'aria-label': 'ขั้นตอน' });
  const play = iconLabel(h('button', { type: 'button', class: 'ts-play', onclick: () => toggle() }), 'play', 'เล่นทุกขั้นตอน');
  const prev = h('button', { type: 'button', class: 'ts-nav', 'aria-label': 'ขั้นก่อนหน้า', onclick: () => { stop(); go(Math.max(-1, step - 1)); } }, '‹');
  const next = h('button', { type: 'button', class: 'ts-nav', 'aria-label': 'ขั้นถัดไป', onclick: () => { stop(); go(Math.min(len() - 1, step + 1)); } }, '›');
  const tierSeg = h('div', { class: 's-seg ts-tier', hidden: true }, [['STANDARD', 'มาตรฐาน'], ['PREMIUM', 'พรีเมียม']].map(([k, th]) => h('button', { type: 'button', 'aria-pressed': k === tier, onclick: () => { tier = k; stop(); step = -1; S3 && S3.setStory('install', tier); render(); } }, th)));
  const cap = h('div', { class: 'ts-cap', 'aria-live': 'polite' });
  root.append(tabs, h('div', { class: 'ts-3d' }, stage, h('div', { class: 'ts-bar' }, play, prev, tl, next, tierSeg), cap),
    h('p', { class: 's-note' }, 'ภาพ 3 มิติอธิบายขั้นตอนตามแบบฟอร์มงานบริการของบริษัท (ล้าง SBP-SR-ACCL-UNI-001 · ติดตั้ง SBP-SR-ACIN-UNI-001) ตัวเครื่องและห้องเป็นแบบจำลอง ลำดับและอุปกรณ์จริงอาจปรับตามรุ่นและหน้างาน ค่าในหน้าจอวัดเป็นตัวอย่างการบันทึก ไม่ใช่เกณฑ์ผ่าน/ไม่ผ่าน'));
  const storyOf = () => STORIES[mode](tier);
  const len = () => (S3 ? S3.length : storyOf().length);
  function stop() { if (playing) toggle(); }
  function toggle() { playing = !playing; iconLabel(play, playing ? 'pause' : 'play', playing ? 'หยุด' : 'เล่นทุกขั้นตอน'); clearInterval(timer); if (playing) { go(step < 0 || step >= len() - 1 ? 0 : step + 1); timer = setInterval(() => { if (step >= len() - 1) { toggle(); return; } go(step + 1); }, 8000); } }
  function go(i) { step = i; S3 ? S3.go(i) : paint(); }
  function paint() {
    const st = S3 ? S3.story() : storyOf();
    tl.innerHTML = ''; st.forEach((s, i) => tl.append(h('button', { type: 'button', 'aria-pressed': i === step, title: s.t, class: i < step ? 'done' : '', onclick: () => { stop(); go(i); } }, String(i + 1))));
    cap.innerHTML = '';
    if (step < 0) {
      const intro = { C1: ['ล้างปกติ (C1) — ล้างที่ตำแหน่งเดิม', `${st.length} ขั้นตามแบบฟอร์มงานล้างของบริษัท ตั้งแต่ตรวจก่อนงาน ตัดไฟ คลุมป้องกัน ล้าง ประกอบกลับ ทดสอบ จนส่งมอบพร้อมรายงาน`], C2: ['ล้างใหญ่ (C2) — ปลดคอยล์เย็นลงล้าง ไม่ตัดท่อน้ำยา', `${st.length} ขั้น เพิ่มจากล้างปกติ: ลดระดับตัวเครื่อง ถอดใบพัดและถาดน้ำทิ้ง ล้างคอยล์ด้านหลัง และบันทึกทะเบียนชิ้นส่วนที่ถอด`], install: ['ติดตั้งแอร์ใหม่ — ทุกขั้นก่อนปิดราง', `${st.length} ขั้นตามแบบฟอร์มติดตั้งของบริษัท เห็นวัสดุจริงทุกชิ้นก่อนถูกปิดในราง: ท่อทองแดง O-TWO 0.70 มม. ฉนวน Aeroflex ท่อน้ำทิ้ง PVC สีฟ้า สายไฟ Yazaki THW ราง Airpro`], repair: ['ตรวจเช็ก / ซ่อม — ตรวจก่อน แจ้งราคาก่อนซ่อม', `${st.length} ขั้น จากรับแจ้งอาการ ตรวจความปลอดภัย วัดค่า จนแจ้งผลและราคารายรายการ บริษัทไม่ซ่อมก่อนลูกค้าอนุมัติ`] }[mode];
      cap.append(h('div', { class: 'ts-cap-h' }, h('b', {}, intro[0])), h('p', {}, intro[1] + ' · กด "เล่นทุกขั้นตอน" หรือเลือกหมายเลขขั้น ลากภาพเพื่อหมุนดู'));
    } else {
      const s = st[step];
      cap.append(h('div', { class: 'ts-cap-h' }, h('span', { class: 'ts-sn' }, `${step + 1}/${st.length}`), h('b', {}, s.t), s.form ? h('em', { class: 'ts-form' }, s.form) : null),
        h('dl', { class: 'ts-dl' }, h('div', {}, h('dt', {}, 'ช่างทำ'), h('dd', {}, s.what)), h('div', {}, h('dt', {}, 'ทำไม'), h('dd', {}, s.why)), h('div', { class: 'ok' }, h('dt', {}, 'ลูกค้าได้'), h('dd', {}, s.get))));
    }
  }
  function render() {
    tabs.innerHTML = '';
    TAB.forEach(([k, th]) => tabs.append(h('button', { type: 'button', role: 'tab', 'aria-selected': k === mode, onclick: () => { if (k === mode) return; stop(); mode = k; step = -1; S3 && S3.setStory(k, tier); render(); } }, th)));
    tierSeg.hidden = mode !== 'install'; tierSeg.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', b.textContent === (tier === 'STANDARD' ? 'มาตรฐาน' : 'พรีเมียม')));
    paint();
  }
  const io = new IntersectionObserver(es => { if (!es.some(e => e.isIntersecting)) return; io.disconnect();
    try { S3 = createTechStory3D(stage, { theme: cfg.theme, onStep: i => { step = i; paint(); } }); if (mode !== 'C1') S3.setStory(mode, tier); } catch (e) { console.warn('story 3D unavailable', e); fb.hidden = false; } }, { rootMargin: '400px 0px' });
  io.observe(stage);
  render();
  return { setFinish() {}, _s3: () => S3 };
}
