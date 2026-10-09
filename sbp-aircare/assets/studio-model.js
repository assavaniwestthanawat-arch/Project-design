// SBP AirCare — Room Studio: scene library + illustrative physics (no DOM, no three.js).
// Every number here is a planning model for explaining the service on the website, not a measurement.
// Sizing = Thai rule-of-thumb BTU/m² per room use; dirt → airflow/capacity factors are illustrative.

export const SCENE_GROUPS = [
  { id: 'home', th: 'บ้าน' },
  { id: 'condo', th: 'คอนโด' },
  { id: 'office', th: 'สำนักงาน' },
  { id: 'retail', th: 'ร้านค้า' },
  { id: 'service', th: 'ร้านบริการ' },
  { id: 'hotel', th: 'โรงแรม' },
  { id: 'school', th: 'โรงเรียน' },
  { id: 'hospital', th: 'โรงพยาบาล' },
  { id: 'ind', th: 'โรงงาน' },
];
// risk flags shown per room: dirt = ฝุ่น/คราบสะสมเร็ว · odor = เสี่ยงกลิ่นอับ/เชื้อรา · break = เครื่องทำงานหนัก เสี่ยงเสีย
export const RISK = { dirt: 'คราบสะสมเร็ว', odor: 'เสี่ยงกลิ่นอับ', break: 'ทำงานหนัก เสี่ยงเสีย' };

// w,d,h metres · people · equip W (appliances/machines) · sun 0..2 · dust = accumulation rate (1 ≈ quarterly cleaning, 0.5 ≈ 6-monthly, 1.5 ≈ 2-monthly)
// perM2 = BTU per m² for this use incl. its default occupancy · types = suitable AC types (first = default) · hrs = typical running hours/day
// heavy = why this room is a heavy-use room for the AC (dirt / odour / breakdown). Intervals follow Thai service practice and published guidance
// (homes ~6 months, offices/shops 2–3, restaurants 1–2, schools ≥ every 6 months with monthly filter care, hospitals by their own standard).
export const SCENES = [
  // ---------------- home ----------------
  { id: 'master', g: 'home', th: 'ห้องนอนมาสเตอร์', w: 5.5, d: 4.5, h: 2.8, people: 2, equip: 300, sun: 1, dust: 0.5, perM2: 750, types: ['wall', 'ceiling', 'duct'], furn: 'master', floor: 0xb89272, wall: 0xe9e3da, hrs: 9, risk: ['odor'],
    heavy: 'เปิดทั้งคืน 8–10 ชม. ในห้องปิด คอยล์เปียกนาน ถ้าไม่ล้างจะเริ่มมีกลิ่นอับ', note: 'ห้องใหญ่มีมุมอับลม เครื่องติดผนังตัวเดียวอาจเป่าไม่ทั่ว ติดด้านข้างเตียงเพื่อไม่ให้ลมเป่าตรงตัว' },
  { id: 'bedroom', g: 'home', th: 'ห้องนอน', w: 4, d: 3.5, h: 2.6, people: 2, equip: 150, sun: 1, dust: 0.5, perM2: 750, types: ['wall'], furn: 'bedroom', floor: 0xc8a17c, wall: 0xece6de, hrs: 8, risk: ['odor'],
    heavy: 'ใช้กลางคืนเป็นหลัก ความชื้นค้างในเครื่อง ถ้าเกิน 6 เดือนไม่ล้างเริ่มมีกลิ่น', note: 'เลือกรุ่นเสียงเบา และตั้งทิศลมไม่ให้เป่าตรงเตียง' },
  { id: 'kids', g: 'home', th: 'ห้องเด็ก · ผู้สูงอายุ', w: 3.6, d: 3.4, h: 2.6, people: 2, equip: 200, sun: 1, dust: 0.8, perM2: 750, types: ['wall'], furn: 'kids', floor: 0xd7b58e, wall: 0xeef0e6, hrs: 10, risk: ['dirt', 'odor'],
    heavy: 'ฝุ่นจากตุ๊กตา ผ้าห่ม ขนสัตว์ และคนในห้องไวต่อฝุ่น แนะนำล้างทุก 3–4 เดือน', note: 'ห้องที่มีเด็กเล็ก ผู้สูงอายุ หรือผู้แพ้ฝุ่น ควรล้างถี่กว่าห้องนอนทั่วไป และเช็ดแผ่นกรองทุก 2–4 สัปดาห์' },
  { id: 'living', g: 'home', th: 'ห้องนั่งเล่น', w: 6.5, d: 5, h: 2.8, people: 4, equip: 450, sun: 2, dust: 0.74, perM2: 800, types: ['wall', 'ceiling', 'cassette', 'floor'], furn: 'living', floor: 0xd2b48f, wall: 0xf1ede6, hrs: 6, risk: ['dirt'],
    heavy: 'คนเข้าออกมาก มักต่อกับครัวเปิด คราบมันและฝุ่นเกาะเร็วกว่าห้องนอน', note: 'ผนังกระจกรับแดดบ่ายทำให้ต้องใช้ BTU สูงขึ้น ลองสลับค่าแดดเพื่อดูผล' },
  { id: 'kitchen', g: 'home', th: 'ห้องครัว', w: 5, d: 4, h: 2.7, people: 4, equip: 1200, sun: 1, dust: 1.3, perM2: 900, types: ['wall', 'ceiling'], furn: 'kitchen', mount: 'back', at: 0.9, floor: 0xe6e2da, wall: 0xf3f1ec, hrs: 3, risk: ['dirt', 'odor'],
    heavy: 'ไอน้ำมันจากการทำอาหารเกาะคอยล์และใบพัดเป็นคราบเหนียว ดักฝุ่นต่อเนื่อง', note: 'ไม่ติดเครื่องเหนือเตา และควรมีเครื่องดูดควัน' },
  { id: 'dining', g: 'home', th: 'ห้องทานอาหาร', w: 4.5, d: 4, h: 2.7, people: 6, equip: 300, sun: 1, or: 'W', dust: 0.55, perM2: 800, types: ['wall', 'ceiling'], furn: 'dining', floor: 0xc9a57f, wall: 0xf2ede5, hrs: 3,
    heavy: 'คนนั่งพร้อมกันหลายคนและอาหารร้อนเพิ่มภาระความร้อนช่วงมื้ออาหาร', note: 'ตั้งทิศลมไม่ให้เป่าตรงโต๊ะอาหาร' },
  { id: 'study', g: 'home', th: 'ห้องทำงานที่บ้าน', w: 3.5, d: 3, h: 2.6, people: 1, equip: 450, sun: 1, dust: 0.6, perM2: 800, types: ['wall'], furn: 'study', floor: 0xbf9a76, wall: 0xe8ecef, hrs: 9,
    heavy: 'ทำงานที่บ้านเปิดวันละ 8–10 ชม. คอมพิวเตอร์และจอหลายจอเพิ่มความร้อน', note: 'ห้องเล็กที่มีคอมพิวเตอร์หลายเครื่องต้องเผื่อ BTU' },
  { id: 'bath', g: 'home', th: 'ห้องน้ำ · ห้องแต่งตัว', w: 3.2, d: 2.8, h: 2.6, people: 1, equip: 120, sun: 0, dust: 0.9, perM2: 700, types: ['wall'], furn: 'bath', floor: 0xdfe3e6, wall: 0xf4f6f7, humid: true, hrs: 1, risk: ['odor'],
    heavy: 'ความชื้นสูงมาก เชื้อราโตในเครื่องได้ง่าย', note: 'ต้องมีพัดลมระบายอากาศแยก ติดเครื่องฝั่งห้องแต่งตัวให้ห่างจุดโดนน้ำ และให้ช่างสำรวจก่อนทุกครั้ง' },
  // ---------------- condo ----------------
  { id: 'condostudio', g: 'condo', th: 'ห้องสตูดิโอ + ครัวเปิด', w: 6.5, d: 4.2, h: 2.6, people: 2, equip: 900, sun: 2, or: 'W', dust: 1.0, perM2: 750, types: ['wall'], furn: 'condostudio', mount: 'back', at: 0.3, floor: 0xcfb08d, wall: 0xefebe4, hrs: 12, risk: ['dirt', 'odor', 'break'],
    heavy: 'แอร์ตัวเดียวรับทั้งไอน้ำมันจากครัวและเปิดเกือบทั้งวัน · คอยล์ร้อนบนระเบียงแคบระบายความร้อนยาก เครื่องทำงานหนัก', note: 'ห้องสตูดิโอกระจกเต็มผนัง ติดฟิล์มหรือม่านกันความร้อนช่วยได้มาก คอยล์ร้อนต้องมีที่ระบายลมพอ ไม่ติดชิดผนังหรือช่องระแนงแคบ' },
  { id: 'condobed', g: 'condo', th: 'ห้องนอนคอนโด', w: 3.2, d: 3.0, h: 2.6, people: 2, equip: 150, sun: 2, or: 'E', dust: 0.5, perM2: 750, types: ['wall'], furn: 'condobed', floor: 0xc9a883, wall: 0xedeae4, hrs: 9, risk: ['odor'],
    heavy: 'ห้องเล็ก ปิดทั้งวันทั้งคืน ความชื้นค้าง', note: 'ห้องเล็กไม่ควรเลือกเครื่องใหญ่เกิน เครื่องจะตัดบ่อยและลดความชื้นได้ไม่ดี' },
  { id: 'condoliving', g: 'condo', th: 'นั่งเล่น + แพนทรี', w: 5.0, d: 4.0, h: 2.6, people: 3, equip: 700, sun: 2, or: 'W', dust: 0.8, perM2: 750, types: ['wall', 'ceiling'], furn: 'condoliving', floor: 0xd0b089, wall: 0xf0ece5, hrs: 7, risk: ['dirt'],
    heavy: 'ต่อกับแพนทรี มีทั้งไอน้ำมันและคนเข้าออก', note: 'ถ้าห้องนั่งเล่นเชื่อมห้องนอน ให้แยกเครื่องแต่ละห้องจะคุมอุณหภูมิได้ดีกว่า' },
  // ---------------- office ----------------
  { id: 'openoffice', g: 'office', th: 'ออฟฟิศ Open-plan', w: 14, d: 10, h: 2.8, people: 24, equip: 4800, sun: 1, dust: 1.0, perM2: 800, types: ['cassette', 'ceiling', 'duct', 'wall'], furn: 'openoffice', floor: 0x8e969e, wall: 0xeef0f2, hrs: 10, risk: ['dirt'],
    heavy: 'คนและคอมพิวเตอร์หนาแน่น เปิดวันละ 10–12 ชม.', note: 'แบบสี่ทิศทางกระจายลมได้ทั่ว เหมาะกับสัญญาล้างรายปี' },
  { id: 'meeting', g: 'office', th: 'ห้องประชุม', w: 8, d: 5, h: 2.8, people: 12, equip: 700, sun: 1, dust: 0.9, perM2: 850, types: ['cassette', 'ceiling', 'duct'], furn: 'meeting', floor: 0x7c858e, wall: 0xedeff1, hrs: 5,
    heavy: 'คนเต็มห้องพร้อมกัน ภาระความร้อนขึ้นเร็ว', note: 'ควรคิดขนาดเผื่อจำนวนคนเต็มห้อง' },
  { id: 'reception', g: 'office', th: 'โถงต้อนรับ', w: 8, d: 6, h: 3.0, people: 6, equip: 600, sun: 2, dust: 1.1, perM2: 850, types: ['cassette', 'ceiling'], furn: 'reception', floor: 0xd9d4cc, wall: 0xf1efeb, hrs: 12, risk: ['dirt'],
    heavy: 'ประตูเปิดปิดตลอดวัน ฝุ่นและความร้อนจากภายนอกเข้ามามาก', note: 'ติดม่านอากาศหรือประตูปิดเองช่วยลดภาระเครื่อง' },
  { id: 'printroom', g: 'office', th: 'ห้องถ่ายเอกสาร · แพนทรี', w: 4, d: 3.5, h: 2.8, people: 2, equip: 2000, sun: 0, dust: 1.2, perM2: 900, types: ['wall'], furn: 'printroom', floor: 0xc5cacf, wall: 0xeef0f2, hrs: 10, risk: ['dirt', 'odor'],
    heavy: 'ผงหมึกและฝุ่นกระดาษจากเครื่องถ่ายเอกสาร กลิ่นอาหารจากแพนทรี', note: 'แยกเครื่องถ่ายเอกสารไว้ใกล้ช่องระบายอากาศ' },
  { id: 'exec', g: 'office', th: 'ห้องผู้บริหาร', w: 6, d: 5, h: 2.8, people: 2, equip: 500, sun: 2, dust: 0.8, perM2: 800, types: ['cassette', 'wall', 'duct'], furn: 'exec', floor: 0x6f5a48, wall: 0xe7e2da, hrs: 9,
    heavy: 'ใช้ทั้งวัน ต้องการความเงียบและฝ้าเรียบร้อย', note: 'แบบสี่ทิศทางหรือท่อลมจะดูเรียบกว่าแบบติดผนัง' },
  { id: 'server', g: 'office', th: 'ห้อง Server · ห้องไฟฟ้า', w: 4, d: 4, h: 2.8, people: 0, equip: 6000, sun: 0, dust: 0.5, perM2: 400, types: ['wall', 'floor'], closed: true, furn: 'server', floor: 0xb9c0c7, wall: 0xe6eaee, critical: true, hrs: 24, risk: ['break'],
    heavy: 'เปิด 24 ชม. ทุกวัน ถ้าแอร์หยุด อุปกรณ์เสียหายได้ภายในไม่กี่ชั่วโมง', note: 'ควรมีเครื่องสำรองอย่างน้อย 1 ชุด (N+1) และตรวจเช็ก PM รายเดือน ต้องสำรวจหน้างานก่อนเสนอราคา' },
  // ---------------- retail ----------------
  { id: 'shop', g: 'retail', th: 'ร้านเสื้อผ้า · โชว์รูม', w: 10, d: 8, h: 3.2, people: 10, equip: 1800, sun: 2, dust: 1.0, perM2: 850, types: ['cassette', 'ceiling', 'floor'], furn: 'shop', floor: 0xe3ddd3, wall: 0xf5f3ef, hrs: 12, risk: ['dirt'],
    heavy: 'ขุยผ้าและฝุ่นจากลูกค้า ประตูเปิดบ่อย ไฟส่องสินค้าร้อน', note: 'ติดเครื่องให้ลมไม่เป่าตรงประตูทางเข้า' },
  { id: 'minimart', g: 'retail', th: 'มินิมาร์ท · ร้านสะดวกซื้อ', w: 12, d: 8, h: 3.0, people: 8, equip: 6000, sun: 2, dust: 1.3, perM2: 900, types: ['cassette', 'ceiling'], furn: 'minimart', floor: 0xe7e5e0, wall: 0xf4f4f2, hrs: 24, risk: ['dirt', 'break'],
    heavy: 'เปิด 24 ชม. ประตูเปิดตลอด ตู้แช่ปล่อยความร้อนเข้าร้าน เครื่องแทบไม่ได้พัก', note: 'ร้าน 24 ชม. ควรมีแผนล้างตามรอบและ PM ตรวจกระแสไฟ ป้องกันเครื่องเสียกลางคืน' },
  { id: 'restaurant', g: 'retail', th: 'ร้านอาหาร', w: 10, d: 7, h: 3, people: 24, equip: 2500, sun: 1, dust: 1.5, perM2: 1000, types: ['ceiling', 'cassette', 'floor'], furn: 'restaurant', floor: 0xa9876a, wall: 0xefe7dc, hrs: 12, risk: ['dirt', 'odor'],
    heavy: 'ไอน้ำมันจากครัวและคนหนาแน่น คราบเหนียวเกาะคอยล์และใบพัดเร็ว', note: 'ร้านอาหารแนะนำล้างทุก 1–2 เดือน แยกเครื่องโซนครัวกับโซนนั่ง' },
  { id: 'cafe', g: 'retail', th: 'คาเฟ่ · เบเกอรี่', w: 8, d: 6, h: 3.0, people: 16, equip: 3500, sun: 2, dust: 1.5, perM2: 950, types: ['ceiling', 'cassette', 'wall'], furn: 'cafe', floor: 0xb8946f, wall: 0xf1ebe2, hrs: 12, risk: ['dirt', 'odor'],
    heavy: 'ผงแป้ง ไอจากเครื่องชงกาแฟและเตาอบ เกาะคอยล์ที่เปียกเป็นคราบ', note: 'หน้าร้านกระจกรับแดดและลูกค้านั่งนาน ต้องเผื่อ BTU' },
  // ---------------- services ----------------
  { id: 'gym', g: 'service', th: 'ฟิตเนส', w: 12, d: 9, h: 3.2, people: 20, equip: 4000, sun: 1, dust: 1.2, perM2: 1100, types: ['ceiling', 'cassette'], furn: 'gym', floor: 0x4a5058, wall: 0xe9ecef, hrs: 14, risk: ['odor', 'dirt'],
    heavy: 'เหงื่อและความชื้นสูง ละอองผิวหนังและขุยผ้าเกาะคอยล์ที่เปียก → กลิ่นอับและเชื้อรา', note: 'ควรคุมความชื้นในห้องให้ต่ำกว่า 60% และล้างถี่ ถาดน้ำทิ้งต้องไหลสะดวก' },
  { id: 'salon', g: 'service', th: 'ร้านทำผม · เสริมสวย', w: 7, d: 5, h: 2.8, people: 8, equip: 3000, sun: 2, dust: 1.4, perM2: 900, types: ['ceiling', 'cassette', 'wall'], furn: 'salon', floor: 0xe9e4dd, wall: 0xf6f3ef, hrs: 10, risk: ['dirt', 'odor'],
    heavy: 'เส้นผม สเปรย์ และไอเคมีจากการทำสีหรือยืดผม เกาะแผ่นกรองและคอยล์ · ไดร์เป่าผมเพิ่มความร้อน', note: 'ร้านที่ทำเคมีควรมีพัดลมดูดอากาศแยก' },
  { id: 'spa', g: 'service', th: 'สปา · ห้องนวด', w: 5, d: 4, h: 2.7, people: 4, equip: 300, sun: 0, dust: 1.2, perM2: 800, types: ['wall', 'cassette'], furn: 'spa', floor: 0x9c7d62, wall: 0xe9dfd3, hrs: 10, risk: ['odor'],
    heavy: 'ไอน้ำมันนวด ความชื้นจากสตีม ผ้าขนหนู และการเปิดพัดลมเบา ทำให้เชื้อราโตง่าย', note: 'ตั้งลมไม่ให้เป่าตรงเตียงนวด และล้างถี่เพราะกลิ่นมีผลต่อลูกค้าโดยตรง' },
  { id: 'karaoke', g: 'service', th: 'ห้องคาราโอเกะ', w: 5, d: 4, h: 2.7, people: 10, equip: 1200, sun: 0, closed: true, dust: 1.2, perM2: 900, types: ['wall', 'cassette'], furn: 'karaoke', floor: 0x3b3342, wall: 0x2f2a36, hrs: 10, risk: ['odor'],
    heavy: 'ห้องปิดทึบ คนแน่น มีอาหารและเครื่องดื่ม เปิดยาวถึงดึก', note: 'ห้องไม่มีหน้าต่างต้องมีระบบเติมอากาศ ไม่เช่นนั้นกลิ่นสะสมในเครื่อง' },
  { id: 'netcafe', g: 'service', th: 'ร้านเกม · อินเทอร์เน็ต', w: 10, d: 7, h: 3.0, people: 20, equip: 8000, sun: 0, dust: 1.3, perM2: 950, types: ['cassette', 'ceiling'], furn: 'netcafe', floor: 0x2d333b, wall: 0x3a414b, hrs: 18, risk: ['dirt', 'break'],
    heavy: 'คอมพิวเตอร์ปล่อยความร้อนทั้งวัน เครื่องทำงานหนัก 12–24 ชม.', note: 'ความร้อนจากคอมพิวเตอร์เป็นภาระหลัก คิดขนาดจากจำนวนเครื่องจริง' },
  { id: 'dental', g: 'service', th: 'คลินิกทันตกรรม · ความงาม', w: 4.5, d: 4, h: 2.7, people: 3, equip: 1200, sun: 1, dust: 1.0, perM2: 850, types: ['wall', 'cassette'], furn: 'dental', floor: 0xe8ecef, wall: 0xf6f8f9, hrs: 9, risk: ['dirt'],
    heavy: 'ละอองจากหัวกรอและเครื่องขูดหินปูน ลูกค้าคาดหวังความสะอาดสูง', note: 'ใช้แพ็กเกจที่มีรายงานภาพก่อน–หลังทุกรอบ' },
  { id: 'laundry', g: 'service', th: 'ร้านซัก–อบผ้า', w: 8, d: 5, h: 3.0, people: 3, equip: 9000, sun: 1, dust: 2.0, perM2: 900, types: ['ceiling', 'wall'], furn: 'laundry', floor: 0xd7dadd, wall: 0xf0f2f4, hrs: 16, risk: ['dirt', 'break'],
    heavy: 'ขุยผ้าจากเครื่องอบอุดแผ่นกรองเร็วมาก ความร้อนและความชื้นสูง', note: 'แผ่นกรองควรเช็ดทุกสัปดาห์ และล้างเครื่องทุกเดือน' },
  // ---------------- hotel ----------------
  { id: 'hotel', g: 'hotel', th: 'ห้องพักโรงแรม', w: 4.2, d: 7, h: 2.7, people: 2, equip: 400, sun: 2, or: 'W', dust: 0.7, perM2: 800, types: ['wall', 'duct', 'ceiling'], furn: 'hotel', floor: 0x8f8579, wall: 0xefe9e1, hrs: 10, risk: ['odor'],
    heavy: 'ห้องปิดระหว่างไม่มีแขก ความชื้นค้าง เป็นที่มาของข้อร้องเรียน "กลิ่นอับ"', note: 'งานล้างต้องจัดตามรอบห้องว่างและมีรายงานรายห้อง' },
  { id: 'lobby', g: 'hotel', th: 'ล็อบบี้', w: 16, d: 12, h: 4.5, people: 20, equip: 3000, sun: 2, dust: 1.0, perM2: 800, types: ['cassette', 'ceiling', 'duct'], furn: 'lobby', floor: 0xcfc6ba, wall: 0xf2eee8, hrs: 24, risk: ['dirt', 'break'],
    heavy: 'เปิด 24 ชม. ประตูเปิดตลอด เพดานสูง', note: 'เพดานสูงต้องเลือกเครื่องที่ลมลงถึงระดับคน' },
  { id: 'ballroom', g: 'hotel', th: 'ห้องจัดเลี้ยง', w: 18, d: 12, h: 4.0, people: 120, equip: 5000, sun: 0, dust: 0.8, perM2: 1000, types: ['cassette', 'ceiling', 'duct'], furn: 'ballroom', floor: 0x8e6f5a, wall: 0xefe8de, hrs: 6,
    heavy: 'คนนับร้อยพร้อมกัน ภาระความร้อนขึ้นเร็วมาก', note: 'เปิดเครื่องล่วงหน้าก่อนงานและคิดขนาดจากจำนวนคนสูงสุด' },
  { id: 'buffet', g: 'hotel', th: 'ห้องอาหารบุฟเฟ่ต์', w: 14, d: 10, h: 3.2, people: 60, equip: 8000, sun: 2, dust: 1.5, perM2: 1000, types: ['ceiling', 'cassette'], furn: 'restaurant', floor: 0xa98c70, wall: 0xf1e9de, hrs: 14, risk: ['dirt', 'odor'],
    heavy: 'ไลน์อาหารร้อนและคนหนาแน่นช่วงมื้อ คราบมันเกาะเร็ว', note: 'แยกเครื่องโซนไลน์อาหารร้อนออกจากโซนที่นั่ง' },
  // ---------------- school ----------------
  { id: 'classroom', g: 'school', th: 'ห้องเรียน', w: 9, d: 8, h: 3, people: 36, equip: 800, sun: 1, or: 'E', dust: 0.9, perM2: 1000, types: ['ceiling', 'cassette', 'wall'], furn: 'classroom', floor: 0xd9d4ca, wall: 0xf1efe9, hrs: 8, risk: ['dirt'],
    heavy: 'นักเรียน 30–40 คน ฝุ่นชอล์กและกระดาษ', note: 'กรมอนามัยแนะนำทำความสะอาดแผ่นกรองทุกเดือนและล้างเครื่องอย่างน้อยทุก 6 เดือน ล้างครบทุกห้องช่วงปิดภาคเรียน' },
  { id: 'complab', g: 'school', th: 'ห้องคอมพิวเตอร์', w: 10, d: 8, h: 3, people: 40, equip: 8000, sun: 1, dust: 0.9, perM2: 1000, types: ['cassette', 'ceiling', 'wall'], furn: 'complab', floor: 0xc8ccd0, wall: 0xeef0f2, hrs: 8, risk: ['break'],
    heavy: 'คอมพิวเตอร์ 40 เครื่องปล่อยความร้อนพร้อมกัน', note: 'ห้องคอมพิวเตอร์ร้อนกว่าห้องเรียนปกติมาก ต้องคิด BTU จากจำนวนเครื่อง' },
  { id: 'library', g: 'school', th: 'ห้องสมุด', w: 14, d: 10, h: 3.2, people: 30, equip: 2000, sun: 1, dust: 0.8, perM2: 850, types: ['cassette', 'ceiling'], furn: 'library', floor: 0xb99b7a, wall: 0xf0ebe3, hrs: 10, risk: ['dirt'],
    heavy: 'ฝุ่นกระดาษจากหนังสือ เปิดยาวทั้งวัน', note: 'ความชื้นต่ำช่วยถนอมหนังสือ ควรคุมความชื้นด้วย' },
  { id: 'auditorium', g: 'school', th: 'หอประชุม', w: 24, d: 16, h: 6, people: 300, equip: 8000, sun: 0, dust: 0.7, perM2: 900, types: ['ceiling', 'duct', 'floor'], furn: 'auditorium', floor: 0x8a6a55, wall: 0xe8e2da, hrs: 4,
    heavy: 'คนหลายร้อยคน เพดานสูง', note: 'ต้องออกแบบลมให้ลงถึงพื้นที่นั่ง เป็นงานโครงการ ต้องสำรวจ' },
  { id: 'canteen', g: 'school', th: 'โรงอาหาร', w: 16, d: 12, h: 3.5, people: 120, equip: 6000, sun: 1, dust: 1.5, perM2: 950, types: ['ceiling', 'cassette'], furn: 'canteen', floor: 0xcfcfc9, wall: 0xf1f1ee, hrs: 6, risk: ['dirt', 'odor'],
    heavy: 'ไอน้ำมันจากร้านอาหารและคนแน่นช่วงพัก', note: 'ล้างทุก 2 เดือน แยกโซนร้านค้ากับโซนนั่ง' },
  { id: 'dorm', g: 'school', th: 'ห้องพักหอพัก', w: 4, d: 5, h: 2.7, people: 4, equip: 500, sun: 1, dust: 0.8, perM2: 800, types: ['wall'], furn: 'dorm', floor: 0xcdb293, wall: 0xefeae2, hrs: 12, risk: ['odor'],
    heavy: 'หลายคนต่อห้อง เปิดทั้งคืน ผ้าและของใช้เยอะ', note: 'สัญญาล้างรายปีแบบยกอาคารช่วยคุมต้นทุนต่อห้อง' },
  // ---------------- hospital ----------------
  { id: 'ward', g: 'hospital', th: 'ห้องพักผู้ป่วย', w: 6, d: 5.5, h: 2.8, people: 4, equip: 600, sun: 1, or: 'S', dust: 1.5, perM2: 800, types: ['cassette', 'wall'], furn: 'ward', floor: 0xe3e8ea, wall: 0xf4f7f8, hrs: 24, risk: ['dirt', 'break'],
    heavy: 'เปิด 24 ชม. ผู้ป่วยไวต่อฝุ่นและกลิ่น', note: 'โรงพยาบาลหลายแห่งกำหนดรอบทำความสะอาดรายเดือนตามมาตรฐานภายใน ต้องทำงานเงียบ คุมฝุ่นระหว่างล้าง และนัดเวลากับเจ้าหน้าที่' },
  { id: 'opd', g: 'hospital', th: 'พื้นที่รอตรวจ OPD', w: 16, d: 10, h: 3.2, people: 80, equip: 3000, sun: 2, dust: 1.5, perM2: 950, types: ['cassette', 'ceiling'], furn: 'opd', floor: 0xdfe5e8, wall: 0xf5f8f9, hrs: 14, risk: ['dirt'],
    heavy: 'ผู้ป่วยและญาติแออัด เปิดทั้งวัน ฝุ่นจากคนเข้าออก', note: 'งานล้างต้องทำนอกเวลาให้บริการหรือแบ่งโซน' },
  { id: 'clinic', g: 'hospital', th: 'ห้องตรวจ', w: 5, d: 4, h: 2.7, people: 3, equip: 500, sun: 1, dust: 1.0, perM2: 800, types: ['wall', 'cassette'], furn: 'clinic', floor: 0xe8ecef, wall: 0xf6f8f9, hrs: 10,
    heavy: 'ผู้ป่วยเข้าออกทั้งวัน ความสะอาดของอากาศสำคัญ', note: 'ควรใช้แพ็กเกจที่มีรายงานภาพก่อน–หลังทุกรอบ' },
  { id: 'medlab', g: 'hospital', th: 'ห้องปฏิบัติการ (Lab)', w: 8, d: 6, h: 3.0, people: 6, equip: 5000, sun: 0, dust: 0.9, perM2: 900, types: ['cassette', 'wall'], furn: 'medlab', floor: 0xe6eaec, wall: 0xf5f7f8, hrs: 24, risk: ['break'], critical: false,
    heavy: 'เครื่องวิเคราะห์ต้องการอุณหภูมิคงที่ ทำงาน 24 ชม.', note: 'ควรมีเครื่องสำรองและตรวจ PM ตามรอบ' },
  { id: 'orroom', g: 'hospital', th: 'ห้องผ่าตัด · ICU · แยกโรค', w: 7, d: 6, h: 3.0, people: 8, equip: 4000, sun: 0, closed: true, dust: 1.0, perM2: 1200, types: ['duct'], furn: 'orroom', floor: 0xdde6ea, wall: 0xeef3f5, special: true, hrs: 24, risk: ['break'],
    heavy: 'ห้องควบคุมอากาศพิเศษ ต้องคุมความดันห้อง อัตราเปลี่ยนอากาศ และแผ่นกรองตามมาตรฐานโรงพยาบาล', note: 'ไม่ใช่งานติดตั้งแอร์ทั่วไป ต้องออกแบบตามมาตรฐานห้องควบคุมอากาศ (เช่น ASHRAE 170) ร่วมกับวิศวกรของโรงพยาบาล ทีมจะสำรวจก่อนเสนอขอบเขตงาน' },
  // ---------------- factory ----------------
  { id: 'factory', g: 'ind', th: 'สายการผลิต', w: 24, d: 16, h: 5, people: 30, equip: 18000, sun: 1, dust: 1.5, perM2: 700, types: ['ceiling', 'floor', 'duct'], furn: 'factory', floor: 0x9aa39c, wall: 0xdfe3e5, hrs: 16, risk: ['dirt', 'break'],
    heavy: 'ฝุ่น ละอองน้ำมัน และความร้อนจากเครื่องจักร เดินเครื่อง 2 กะ', note: 'พื้นที่ใหญ่ขนาดนี้มักเหมาะกับระบบท่อลมหรือ Package ต้องสำรวจและออกแบบเป็นงานโครงการ' },
  { id: 'warehouse', g: 'ind', th: 'คลังสินค้า', w: 20, d: 14, h: 6, people: 6, equip: 2000, sun: 1, dust: 1.3, perM2: 450, types: ['ceiling', 'floor', 'duct'], furn: 'warehouse', floor: 0xa7aca8, wall: 0xe1e4e6, hrs: 12, risk: ['dirt'],
    heavy: 'ฝุ่นจากกล่องและรถยก ประตูโหลดสินค้าเปิดบ่อย', note: 'เพดานสูง ควรเน้นเป่าเฉพาะโซนที่มีคนทำงานหรือสินค้าที่ต้องคุมอุณหภูมิ' },
  { id: 'control', g: 'ind', th: 'ห้องควบคุม · ห้อง QC', w: 8, d: 6, h: 3, people: 6, equip: 3000, sun: 0, dust: 0.95, perM2: 900, types: ['cassette', 'wall', 'ceiling'], furn: 'control', floor: 0xc3c9ce, wall: 0xeceff1, hrs: 24, risk: ['break'],
    heavy: 'จอและอุปกรณ์ควบคุมทำงาน 24 ชม. ต้องการอุณหภูมิคงที่', note: 'ควรมีรายงานรายเครื่องทุกรอบล้างและเครื่องสำรอง' },
  { id: 'fcanteen', g: 'ind', th: 'โรงอาหารพนักงาน', w: 16, d: 10, h: 3.5, people: 100, equip: 5000, sun: 1, dust: 1.5, perM2: 950, types: ['ceiling', 'cassette'], furn: 'canteen', floor: 0xcbcbc4, wall: 0xefefec, hrs: 6, risk: ['dirt', 'odor'],
    heavy: 'ไอน้ำมันจากครัวและพนักงานเข้าพร้อมกันเป็นรอบ', note: 'ล้างทุก 2 เดือน' },
  { id: 'foffice', g: 'ind', th: 'สำนักงานในโรงงาน', w: 10, d: 7, h: 2.8, people: 14, equip: 2800, sun: 1, dust: 1.2, perM2: 800, types: ['cassette', 'wall', 'ceiling'], furn: 'openoffice', floor: 0x8e969e, wall: 0xeef0f2, hrs: 10, risk: ['dirt'],
    heavy: 'ฝุ่นจากไลน์ผลิตเข้ามากับคนและเอกสาร', note: 'ฝุ่นมากกว่าสำนักงานทั่วไป ควรล้างทุก 2 เดือน' },
];
export const SCENE_BY_ID = Object.fromEntries(SCENES.map(s => [s.id, s]));

// how many m² one unit of each type can cover well, and the largest size we let one unit be
export const TYPE_RULES = {
  wall: { cover: 40, max: 30000, th: 'ติดผนัง' },
  ceiling: { cover: 90, max: 60000, th: 'แขวนใต้ฝ้า' },
  cassette: { cover: 70, max: 48000, th: 'สี่ทิศทาง' },
  floor: { cover: 90, max: 60000, th: 'ตู้ตั้งพื้น' },
  duct: { cover: 60, max: 60000, th: 'ท่อลม (ซ่อนในฝ้า)' },
};
export const STD_SIZES = [9000, 12000, 15000, 18000, 24000, 30000, 36000, 48000, 60000];

// ---------- environment ----------
// Which way the sun-facing (glass) wall looks, how much glass it has, top floor under the roof, closed/stuffy room.
// Factors are planning rules of thumb for explaining the effect — the survey confirms the real load.
export const ORIENT = [
  { id: 'none', th: 'ไม่มี', long: 'ไม่มีผนังรับแดดโดยตรง', f: 0.95, sun: 0.35 },
  { id: 'N', th: 'เหนือ', long: 'ผนังหันทิศเหนือ · แดดอ้อม', f: 0.97, sun: 0.5 },
  { id: 'E', th: 'ตะวันออก', long: 'ผนังหันทิศตะวันออก · แดดเช้า', f: 1.03, sun: 0.85 },
  { id: 'S', th: 'ใต้', long: 'ผนังหันทิศใต้ · แดดเกือบทั้งวัน', f: 1.05, sun: 0.95 },
  { id: 'W', th: 'ตะวันตก', long: 'ผนังหันทิศตะวันตก · แดดบ่ายร้อนที่สุด', f: 1.08, sun: 1.15 },
];
export const ORIENT_BY_ID = Object.fromEntries(ORIENT.map(o => [o.id, o]));
export const GLASS = [{ th: 'หน้าต่างเล็ก', f: 0.95 }, { th: 'หน้าต่างปกติ', f: 1 }, { th: 'ผนังกระจกบานใหญ่', f: 1.08 }];
export const ROOF_F = 1.12, CLOSED_F = 0.92, CLOSED_DUST = 1.3;
export const defaultOrient = s => s.or || (s.closed ? 'none' : s.sun === 2 ? 'W' : s.sun === 0 ? 'none' : 'E');
export const dustRate = (scene, p) => scene.dust * (p && p.closed ? CLOSED_DUST : 1);
export function solarF(p) { return p.closed ? CLOSED_F : (ORIENT_BY_ID[p.orient] || ORIENT[2]).f * GLASS[p.sun ?? 1].f; }

// ---------- sizing ----------
// BTU split into readable parts: base (area × BTU/m² for this use, incl. its usual occupancy, × ceiling height),
// sun & glass, roof, extra people (600 BTU each), extra appliances (W × 3.412).
export function btuBreakdown(p, scene) {
  const area = p.w * p.d;
  const hF = Math.pow(Math.max(1, p.h / 2.7), 0.8);
  const base = area * scene.perM2 * hF;
  const sf = solarF(p), rf = p.roof ? ROOF_F : 1;
  const items = [
    { k: 'base', th: `พื้นที่ ${area.toFixed(1)} ตร.ม. × สูง ${p.h} ม. (${scene.th})`, btu: base },
    { k: 'sun', th: p.closed ? 'ห้องปิดทึบ ไม่มีแดดเข้า' : `แดด: ${(ORIENT_BY_ID[p.orient] || ORIENT[2]).long} · ${GLASS[p.sun ?? 1].th}`, btu: base * (sf - 1) },
    { k: 'roof', th: 'ชั้นบนสุด ใต้หลังคารับแดด', btu: p.roof ? base * sf * (rf - 1) : 0 },
    { k: 'people', th: `คน ${p.people} คน (${p.people >= scene.people ? 'เพิ่ม' : 'ลด'}จากปกติ ${scene.people} คน)`, btu: (p.people - scene.people) * 600 },
    { k: 'equip', th: `เครื่องใช้ไฟฟ้า ${Number(p.equip).toLocaleString('en-US')} วัตต์ (ปกติ ${scene.equip.toLocaleString('en-US')})`, btu: (p.equip - scene.equip) * 3.412 },
  ];
  if (scene.critical) { items.length = 0; items.push({ k: 'base', th: `พื้นที่ ${area.toFixed(1)} ตร.ม.`, btu: area * scene.perM2 * rf }, { k: 'equip', th: `ความร้อนจากอุปกรณ์ ${Number(p.equip).toLocaleString('en-US')} วัตต์ + เผื่อ 20%`, btu: p.equip * 3.412 * 1.2 }); }
  const raw = items.reduce((a, b) => a + b.btu, 0);
  return { items, total: Math.max(6000, Math.round(raw / 100) * 100) };
}
export const needBtu = (p, scene) => btuBreakdown(p, scene).total;
// recommend count + per-unit size for a type; `sizes` = sizes that actually exist in the catalog for that type
export function recommendUnits(need, area, type, sizes = STD_SIZES) {
  const r = TYPE_RULES[type];
  const avail = sizes.filter(s => s <= r.max).sort((a, b) => a - b);
  const top = avail[avail.length - 1] || r.max;
  // `need` already carries the ~10% design allowance (thermal() uses need / 1.1 as the real load), so size to need itself —
  // adding another 10% here oversized small rooms by a whole step (e.g. 20 m² → 24,000 BTU).
  let n = Math.max(1, Math.ceil(need / top), Math.ceil(area / r.cover));
  n = Math.min(n, 40);
  const per = avail.find(s => s * n >= need * 0.97) || top;   // within 3% counts as a match (catalog steps are coarse)
  return { n, per, total: n * per, project: need > 240000 || n > 12 };
}

// ---------- dirt ----------
// months since last cleaning → dirt 0..1 (depends on the room's dust rate). Rates are tuned so the recommended interval
// matches common practice: homes ~6 months (busier living rooms 4), offices/clinics quarterly, kitchens/restaurants/factories every 2 months.
export const dirtFrom = (months, rate) => 1 - Math.exp(-months * rate / 6);
// Calibrated to published ranges: US DOE — a clogged filter raises AC energy use 5–15%; Niknami et al. 2024 — 30% evaporator
// blockage cut capacity ~19% and EER ~13%; MEA/EGAT — cleaning saves about 5–10%. dirt = 1 is a heavily fouled unit.
export const effects = dirt => ({
  air: 1 - 0.35 * dirt,         // airflow through clogged filter/coil
  cap: 1 - 0.2 * dirt,          // cooling capacity actually delivered
  power: 1 + 0.15 * dirt,       // electricity for the same cooling (energy penalty)
});
// ---------- electricity ----------
// Typical seasonal efficiency (BTU/h per W) by system — assumption for the estimate, not a model's label value.
export const EFF = { inverter: { wall: 18, other: 14 }, fixed: { wall: 12.5, other: 11.5 } };
// Thai tariff Sep–Dec 2569: residential tier 201–400 kWh 4.1584 + Ft 0.1623 + VAT ≈ 4.62 THB/kWh; small business ≈ 4.9 THB/kWh.
export const RATE = { home: 4.62, biz: 4.9 };
export const LOAD_F = 0.65;   // average compressor loading over the running hours (part load)
export function energy(btu, type, inverter, hrs, dirt, rate) {
  const eff = (inverter ? EFF.inverter : EFF.fixed)[type === 'wall' ? 'wall' : 'other'];
  const kwhDayClean = btu / eff / 1000 * hrs * LOAD_F;
  const kwhDay = kwhDayClean * effects(dirt).power;
  return { eff, kwhMonthClean: kwhDayClean * 30, kwhMonth: kwhDay * 30, bahtMonthClean: kwhDayClean * 30 * rate, bahtMonth: kwhDay * 30 * rate, extraYear: (kwhDay - kwhDayClean) * 365 * rate };
}
export function cleanInterval(rate) {
  const m = 6 * -Math.log(1 - 0.4) / rate;          // months until dirt reaches 0.4
  const opts = [1, 2, 3, 4, 6];
  const pick = [...opts].reverse().find(o => o <= m) || 1;
  return { months: pick, visits: Math.round(12 / pick) };
}
export const dirtTh = d => d < 0.12 ? 'สะอาด' : d < 0.35 ? 'เริ่มมีฝุ่น' : d < 0.6 ? 'ถึงรอบล้าง' : d < 0.8 ? 'สกปรก — ลมเบาลง' : 'สกปรกมาก — อาจมีกลิ่นและน้ำหยด';

// ---------- thermal (lumped room) ----------
export const T_OUT = 34, T_SET = 25, T_START = 32;
export function thermal(p, scene, capBtu, dirt) {
  const need = needBtu(p, scene);
  const Qset = need / 3.412 / 1.1;                 // W at set point
  const UA = 0.4 * Qset / (T_OUT - T_SET);
  const Qi = 0.6 * Qset;
  const C = p.w * p.d * Math.min(p.h, 3.5) * 1.2 * 1005 * 6;   // occupied-zone air + furnishings, J/K
  const cap = capBtu * 0.293 * effects(dirt).cap;   // W
  return { need, Qset, UA, Qi, C, cap };
}
export function stepT(T, th, dt) {                   // dt seconds, returns new T
  const load = th.Qi + th.UA * (T_OUT - T);
  const q = T > T_SET ? th.cap : Math.min(th.cap, load);
  return T + (load - q) / th.C * dt;
}
export function timeToSet(th, from = T_START, limitMin = 240) {
  let T = from, t = 0;
  while (T > T_SET + 0.1 && t < limitMin * 60) { T = stepT(T, th, 10); t += 10; }
  return T <= T_SET + 0.1 ? t / 60 : null;
}
export const steadyT = th => th.cap >= th.Qi + th.UA * (T_OUT - T_SET) ? T_SET : T_OUT + (th.Qi - th.cap) / th.UA;
