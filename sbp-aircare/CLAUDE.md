# CLAUDE.md — SBP AirCare Website · Technical Handover Specification

> **สถานะ:** Rev.09 r19 · 7 ต.ค. 2569 (r19 = เก็บงานค้างที่แก้ในโค้ดได้ทั้งหมด (มุมกล้องช่าง B3 · ภาพ 3 มิติหน้าแรก C มือถือ · ตัวอักษร/axe ที่เหลือ) + ทดสอบใหม่ครบทุกแบบ · r18 = A · B · C ต้นฉบับ ตรวจแบบวัดค่าและพัฒนาความคมชัด/รายละเอียดทุกจุด เน้น C · r17 = A3–C3 ภาพถ่ายแบบสารคดี + จัดหน้า แสง อารมณ์ภาพ · r16 = รุ่นที่ 2 A2–D2 ทำใหม่บน film engine) (ต่อจาก Rev.08.1 — r5 = โครงเว็บตามเส้นทางลูกค้า เตรียม Beta · r7 = งานหน้างานแอร์แขวน/สี่ทิศทาง/ตู้ตั้ง + ลองวางแอร์ในห้องแบบสำรวจหน้างาน · r8 = แก้ค้าง/หน่วง/หน่วยความจำ · r9 = ราคาหลักร้อยก่อน VAT + ราคาขั้นบันได + หน้าองค์กร/งานโครงการ + โลโก้และสีแบรนด์ · r10 = ระบบจองคิว + ticket เข้าหลังบ้าน Google Sheet/Apps Script + หน้าหลังบ้าน · r11 = **แบบ D Studio** หน้าเดียวโหลดเร็ว ใบงานคำนวณราคา → จองคิว · r12 = **รุ่นที่ 2: A2 · B2 · C2 · D2** ภาพ 3 มิติแบบภาพยนตร์ + ปรึกษาอาการ + ลองแอร์ได้ทุกรุ่น · r13 = **รุ่นที่ 3: A3 · B3 · C3** โทนสว่าง ภาพถ่ายประกอบ 9 หน้าตามงาน เนื้อหาครบเท่า A/B/C + หน้าเทียบกับต้นฉบับ · r14 = **ตรวจพร้อมทดลองใช้ทุกแบบ (11 แบบ)** + หน้ารวมทดลองใช้ + ฟอร์มความเห็นทุกแบบ · r15 = **3 มิติครบทุกรุ่น + ลื่นทุกแบบ**: "ดูรุ่นนี้แบบ 3 มิติ" 705 รุ่นในหน้ารายละเอียดสินค้าทุกแบบ + แผง "ทดสอบความลื่น" ทุกแบบ + ความละเอียดปรับเองตามเครื่อง + เตรียม shader ล่วงหน้า) · เจ้าของโปรเจกต์: ธนวัฒน์ (บริษัท สหบูรพากรุ๊ป จำกัด) · repo: `jenokubz-rgb/Jeno-Project` โฟลเดอร์ `sbp-aircare/`
> **เริ่มที่ [`HANDOFF.md`](HANDOFF.md)** — ภาพรวม สถานะฟีเจอร์ ตัวแปร/ไฟล์ config และ todo ล่าสุดในไฟล์เดียว · ไฟล์นี้คือสเปกเชิงลึก
> **ไฟล์นี้คืออะไร:** เอกสารส่งมอบงานสำหรับ Claude Code (CLI) วางไว้ที่ root ของ repo — Claude Code อ่าน `CLAUDE.md` อัตโนมัติทุกครั้งที่เปิดโปรเจกต์
> **ซอร์สโค้ดเต็ม:** อยู่ในไฟล์ `SBP-WEB-011_Prototype_Source.zip` (ทุกไฟล์ ไบต์ตรงกับที่เผยแพร่ล่าสุด) — เอกสารนี้สรุปสัญญา (API), กติกา และงานถัดไป ไม่ได้คัดลอกโค้ด 3 มิติทั้งหมดซ้ำ เพราะโค้ดจริงอยู่ในไฟล์แล้วและแม่นยำกว่า
> **เอกสารอ้างอิงละเอียด:** `SBP-WEB-011_Dev_Handoff_Plan.md` (แผนส่งมอบทีม Dev ฉบับเต็ม ~700 บรรทัด หัวข้อ 0–13 และ 6A–6V)

---

## 0. Quick start (ทำตามนี้ก่อนแก้อะไร)

```bash
# 1) แตก zip แล้วเข้าโฟลเดอร์
unzip SBP-WEB-011_Prototype_Source.zip -d sbp-aircare && cd sbp-aircare
git init && git add -A && git commit -m "Rev.08.1 baseline from Cowork"   # .gitignore กัน dist/ internal/ node_modules/ ไว้แล้ว

# 2) เครื่องมือ (เวอร์ชันที่ใช้ทดสอบมา)
#    Python 3.11 · Node 22 · esbuild 0.28.2 (เรียกผ่าน npx ใน build.py) · Playwright 1.56.0
npm install
npx playwright install chromium

# 3) เปิด dev server (โหมดหลายไฟล์ แก้แล้วรีเฟรชได้ทันที)
python3 -m http.server 8765          # หรือ npm run serve
#    http://localhost:8765/a.html  b.html  c.html  preview.html (หน้าทดสอบ A/B/C)

# 4) ตรวจ baseline ก่อนเริ่มงาน (ต้องผ่านทั้งหมด)
npm run smoke            # error ใน console = 0, ไม่เลื่อนแนวนอน
npm run smoke:mobile     # 390×844
npm run textscan         # ไม่มีคำต้องห้าม / Type L / K Copper / ต้นทุน
npm run recon            # ต้องได้ "mismatches": 0  (ต้องมี internal/sbp_real.json — ดู §7)

# 5) build ไฟล์เดียว (offline + artifact)
npm run build            # → dist/offline/{a,b,c,index}.html, dist/art/{a,b,c,index}.html
```

---

## 1. Project Overview & Objective

### 1.1 ธุรกิจและเป้าหมาย

เว็บขายและบริการแอร์ของ **SBP AirCare (บริษัท สหบูรพากรุ๊ป จำกัด)** สำนักงานใหญ่ พระราม 2 ซอย 31 กรุงเทพฯ

| # | เป้าหมาย | วัดผลจาก |
|---|---|---|
| 1 | **ปิดสัญญาล้างรายปี B2B เป็นจำนวน** — ลูกค้าเห็นราคาต่อปีจาก Pricebook จริงและใส่ใบเสนอราคาได้เอง | จำนวนคำขอสัญญา |
| 2 | **ขายแอร์ทุกรุ่นพร้อมราคา** — ราคาเครื่อง ราคาพร้อมติดตั้ง อุปกรณ์เสริม รวมยอดเอง | ใบเสนอราคาเบื้องต้นที่ส่งเข้ามา |
| 3 | **ค่าบริการโปร่งใสครบทุกหมวด** — ล้าง ติดตั้ง ซ่อม รื้อ/ย้าย วัสดุ พร้อม รวม/ไม่รวม/รับประกัน | ลดคำถามซ้ำของทีมขาย |
| 4 | **ให้ลูกค้าเห็นภาพก่อนตัดสินใจ** — ห้องจำลอง ลม ฝุ่น วิธีทำงานของช่าง วัสดุจริง | เวลาอยู่บนหน้า / conversion |
| 5 | **ขายคุณภาพวัสดุ** (จุดต่างจากคู่แข่ง) — ระบุยี่ห้อและสเปกวัสดุทุกแพ็กเกจ | — |

**พื้นที่บริการ:** กรุงเทพฯ นนทบุรี ปทุมธานี สมุทรปราการ สมุทรสาคร (ไม่มีค่าเดินทาง) · นอกพื้นที่คิดค่าเดินทางตามช่วงระยะ สูงสุด 150 กม.

### 1.2 กลุ่มผู้ใช้

| กลุ่ม | ต้องการอะไร | แบบที่ตอบโจทย์ |
|---|---|---|
| B2C บ้าน/คอนโด | ราคาชัด เห็นภาพ ช่างทำอะไรบ้าง | A, C |
| B2B ฝ่ายอาคาร/จัดซื้อ/สำนักงาน/โรงงาน/คลินิก/โรงแรม | ราคาต่อปี ตารางเครื่อง รายงานรายเครื่อง เอกสารตรวจสอบได้ | B |
| ผู้รับเหมา/งานโครงการ | ขอบเขตงาน วัสดุ BOQ ขอสำรวจ | B |

### 1.3 ต้นแบบ 3 แบบ (เจ้าของยัง **ไม่เลือก** — พัฒนาไปพร้อมกัน ฟีเจอร์ใช้โมดูลร่วม ต่างกันที่ภาษาภาพ)

| | A · Bento Clean (`a.html`) | B · Engineering Sheet (`b.html`) | C · Virtual Showroom (`c.html`) |
|---|---|---|---|
| แนวคิด | แอปพรีเมียม สว่าง สะอาด | ชุดแบบวิศวกรรม ตรวจสอบได้ | โชว์รูมมืด สินค้าเป็นแหล่งแสง |
| ธีมเริ่มต้น | light (มี dark) | blueprint/light (มี dark) | dark (มี light) |
| จุดเด่นเฉพาะ | ขั้นตอนล้างตามแบบฟอร์ม + story แยกชิ้นส่วน | **ลำดับการทำงาน 3 มิติ** (`system3d.js`) + แบบวิศวกรรมภาพตัด (`engdraw.js`) | **ช่างทำงาน 4 งานในห้อง 3 มิติ** (`techstory.js`) |
| ลิงก์ที่เผยแพร่ | claude.ai/artifact/EymM19Ff1MDrV5w94kq8Jz | claude.ai/artifact/Ljne7eUGxzXs1Fbf3VAyj4 | claude.ai/artifact/WmbTyh3x5xz3jci7tq6zF5 |

หน้าทดสอบ A/B/C (`preview.html` → `dist/art/index.html`): claude.ai/artifact/VGmjDYNJPN7AzoybNRRH6i (แชร์ "ทุกคนที่มีลิงก์")

คำแนะนำเดิมของที่ปรึกษา (ยังไม่ใช่คำตัดสิน): ใช้ A เป็นโครงหลัก ยืมหน้าองค์กรจาก B และหน้าโชว์รูม/ห้องจำลองจาก C เป็นหน้าฟีเจอร์แยก

**★Rev.09 r11 แบบ D · Studio (`d.html`, เจ้าของ 5 ต.ค. 2569 เลือก "สร้างแบบ D ใหม่"):** หน้าเดียวเรียงบท (ล้าง → ติดตั้ง → ซ่อม → ซื้อแอร์ → องค์กร → จองคิว → พื้นที่ → คำถาม/ติดต่อ) · จุดเด่นเดียว = **ใบงาน** (`jobcard.js`) ในพื้นน้ำเงิน FUJIVA: ล้าง/ติดตั้ง/ซ่อม/สัญญาองค์กร คิดราคาจาก Pricebook ทันที (ยอดขั้นต่ำงานล้างเป็นบรรทัดแยก + บอกว่าเพิ่มได้อีกกี่เครื่องในยอดนี้) → ส่งต่อส่วนจองคิว/ใบเสนอราคา · ฟอนต์ Noto Sans Thai แบบแคบ (หัวข้อ ตัวเลขราคา) + Noto Sans Thai Looped (เนื้อความ) · **เน้นความเร็ว**: hero และหัวบทเป็น HTML ล้วน แต่ละบท mount เมื่อใกล้จอ (`dstudio.whenNear`) ภาพ 3 มิติ (ทีมช่าง, ลองวางในห้อง) โหลดเมื่อกดปุ่มเท่านั้น · ลิงก์ทดลองพัฒนา claude.ai/artifact/SCaGJ2rpX2k85o6fWpGcMc (private) · ⚠️ เจ้าของให้ใช้เว็บ `sbp-aircare-studio.sahaburapa-official.chatgpt.site` เป็นต้นแบบ แต่ **network policy ของ environment บล็อกโดเมนนี้** — ยังไม่ได้เทียบทีละส่วน (รอเปิดสิทธิ์โดเมน หรือภาพหน้าจอ/ไฟล์ HTML จากเจ้าของ)

**★Rev.09 r16 รุ่นที่ 2 ทำใหม่ทั้งหมด — A2 ภาพยนตร์ · B2 ภารกิจ · C2 โชว์รูม · D2 ดิจิทัลทวิน (เจ้าของ 6 ต.ค. 2569: "แก้ไขใหม่ทั้งหมดโดยไม่ต้องแก้ A B C ต้นฉบับ แต่ในส่วน A2 B2 C2 D2 รุ่นใหม่ทั้งหมด รื้อโครงสร้างและทำใหม่ … ทำมาทั้งหมด 4 แบบ ให้เลือกและพัฒนา ทุกหัวข้อต้องมีภาพประกอบ animation ที่สมจริง … ถ่ายถอดออกมาเหมือน หนัง และ เกมส์ และ สามารถขายบริการและสินค้าได้จริง")** — หน้า `a2–d2.html` เขียนใหม่ทั้งหมดบน **film engine**: แต่ละบท = `<section class="fm" data-film='{kind, drive, …}'>` มีฉาก 3 มิติของตัวเอง (`filmscenes.js`: unit · cycle · story · crew · room · materials · map) เล่นทีละขั้นด้วย `film.js` (drive `progress` = เลื่อนหน้า (A2) · `blocks` = ขั้นที่อยู่กลางจอ (C2) · `player` = ปุ่ม/เล่นเอง (B2, D2) · `none` = เวทีที่โมดูลอื่นคุม) แล้วตามด้วยแผงขาย `[data-sell]` (`filmsell.js`: clean · install · room · repair · quality · business · area) + โชว์รูม `[data-showroom]` + ปรึกษา `[data-concierge]` + จองคิว `#bookRoot` — ต่อสายด้วย `mountFilmSite()` (`filmsite.js`) ตัวเดียว · ฉาก unit ทุกจุดใช้ cinema ตัวเดียวของ `stage.js` เหมือนเดิม · คำบรรยายทุกขั้นมาจากข้อมูลเดิม (แบบฟอร์มบริษัท/jobguide/system3d/MATS) อ่านได้โดยไม่ต้องมี WebGL (`stepsOf`) · ห้ามแต่งตัวเลขเทเลเมทรี (อุณหภูมิ/แรงดัน) ในฉากหรือ inspector · ทุกเวทีมี "แบบจำลองเพื่ออธิบาย" · `v2site.js` ไม่มีหน้าไหนใช้แล้ว (เก็บไว้เป็นประวัติ) · ทดสอบ `npm run test:v2` (tests/v2-flow.mjs เขียนใหม่สำหรับโครง r16)

**★Rev.09 r12 รุ่นที่ 2 — A2 · B2 · C2 · D2 (เจ้าของ 5 ต.ค. 2569: "…พัฒนาให้ดีกว่า… เข้าใจลูกค้าจริงๆ … ภาพที่สมจริง … Cinematic … Mood & tone … Luxury premium ultra … ทำมาทั้งหมด A/B/C/D แบบฉบับใหม่หมด แต่ต้องมีภาพ animation ครบทุกโมเดลให้ทดลอง")** — 4 หน้าใหม่ (`a2/b2/c2/d2.html`) อยู่คู่กับรุ่นแรก (a/b/c/d ไม่ถูกแก้) · ทุกหน้าใช้ **ภาพ 3 มิติตัวเดียว** (`cinema3d.js` — post-processing: ACES tone mapping, ระยะชัดลึก, bloom, color grade, vignette, grain) ที่ย้ายไปตามส่วนที่กำลังดู (`stage.js` — WebGL context เดียวต่อหน้า) + **ส่วนปรึกษา** (`concierge.js`: ที่ไหน → เกิดอะไรขึ้น 10 เรื่อง → รายละเอียด → สิ่งที่เข้าใจ · สาเหตุที่พบบ่อยในภาพพร้อมป้ายชิ้นส่วน · งานที่แนะนำ + ราคา Pricebook → จองคิว/ใบเสนอราคา) + **โชว์รูมทุกรุ่น** (`showroom.js`: 705 รุ่น ตัวเครื่องแบบกลางขนาดตามสเปก เปิด/ปิด โหมด สวิง 5 มุมกล้อง มองทะลุ แยกชิ้นส่วน ดูการล้าง เสียงลม) + บทล้าง/ติดตั้ง/ซ่อม (`dstudio.js` เดิม) + จองคิว/ticket/ตะกร้า/พื้นที่/FAQ (โมดูลเดิม) — แต่ละแบบต่างกันที่ art direction:

| | A2 · Residence | B2 · Tower | C2 · Noir | D2 · Atelier |
|---|---|---|---|---|
| ลูกค้าหลัก | บ้าน คอนโด | ฝ่ายอาคาร องค์กร | คนกำลังเลือกซื้อแอร์ | คนที่อยากปรึกษาก่อน |
| ฉาก 3 มิติ (mood) | `aurora` ห้องนั่งเล่นยามเย็น ระแนงไม้ แดดอำพัน | `tower` ห้องประชุมชั้นบนกลางคืน เมืองหลังกระจก เส้นไฟฟ้าใส | `noir` โรงภาพยนตร์สินค้า ดำเงา เส้นไฟทอง สปอตไลต์ | `atelier` แกลเลอรีปูนขาว แสงเหนือ |
| โครงหน้า | ภาพเต็มจอ ข้อความซ้ายล่าง | ห้องควบคุม: ข้อความ + **ตัวประมาณการสัญญารายปี** ซ้าย ภาพขวา | จอ 2.39:1 = โชว์รูมเป็น hero หัวเรื่องกึ่งกลางแบบ opening credits | ส่วนปรึกษาเป็น hero ภาพแขวนในกรอบ + ป้ายแบบพิพิธภัณฑ์ · การ์ดแอร์ 4 แบบ |
| ฟอนต์หัวข้อ / เนื้อความ | Trirong / Noto Sans Thai Looped | Bai Jamjuree / Bai Jamjuree | Fahkwang / Anuphan | Noto Serif Thai / Noto Sans Thai Looped |
| ธีม | มืดอย่างเดียว (ตั้งใจ) | มืดอย่างเดียว | มืดอย่างเดียว | สว่างอย่างเดียว |
| ส่วนองค์กร (AMC/SOP/โครงการ) | — | ✅ | — | ✅ |

ลิงก์ทดลอง (private, `urls.dev.json`): A2 claude.ai/artifact/F3dqLnymTTSWH55UTG78wC · B2 claude.ai/artifact/L9yfEVUYdtR6cPPCyKsHW9 · C2 claude.ai/artifact/QRWDuTSQMmE2FKBD1YmBKJ · D2 claude.ai/artifact/3dCYNawjJYxLFGZHvf7VKQ · หน้าทดสอบรุ่นที่ 2 claude.ai/artifact/RbGGBB9qwFcRTDzhjwNLh4 · หน้าทดสอบรุ่นที่ 2 `preview2.html` → `dist/art/index2.html` (ทีละแบบ/เทียบ 4 แบบ/ให้คะแนน — localStorage `sbp-preview-v2`) · ภาพนิ่งเปิดหน้า (poster) `assets/posters/*.jpg` เรนเดอร์ด้วย `npm run posters` (ต้องเปิด dev server) แล้ว build ฝังเป็น data URI 

**★Rev.09 r13 รุ่นที่ 3 — A3 · B3 · C3 (เจ้าของ 6 ต.ค. 2569: "จัดทำ A B C แบบต้นฉบับขึ้นมาเทียบ และแบบใหม่ทั้งหมด A2 B2 C2 D2 ผมดูแล้วมันไม่สวยและไม่เสมือนจริง มันแย่กว่า A B C ต้องทำแยกออกมาให้เป็นเวอร์ชั่นที่ใหม่และดีกว่าและแยกแยะหน้าเว็บให้เป็นสัดส่วนชัดเจน" · ตอบคำถาม: ปัญหา = ภาพ 3 มิติดูปลอม, โทนมืดเกินไป, เนื้อหาน้อยกว่า ABC, หน้ายาวปนกันหมด · ทำแนวใหม่ทั้งหมด · ภาพสร้างด้วย AI (Higgsfield) · หลายหน้าแยกตามงาน)** — 3 หน้าใหม่ (`a3/b3/c3.html`) **สร้างจากตัวสร้างหน้าเดียวกัน** (`tools/v3gen.py` ← `tools/v3/`: `sections.html` ส่วนเนื้อหาร่วม · `shell-<e>.html` หัวเว็บ/โครง · `home-<e>.html` หน้าแรก · `<e>.css` art direction) จึงมีเนื้อหาและเครื่องมือเท่ากันทุกแบบ = ทุกโมดูลของ A/B/C + ส่วนเช็กอาการ (`concierge.js` แบบไม่มีภาพ 3 มิติ) · **9 หน้าตามงาน** (site.js views): หน้าแรก · ซื้อแอร์ · ล้างแอร์ · ติดตั้ง ย้าย · ซ่อม ตรวจเช็ก · สำหรับองค์กร · ราคา · ความรู้ · ติดต่อ — แต่ละหน้ามีหัวเรื่อง ข้อมูลสำคัญ ทางลัดหัวข้อ และ "ขั้นต่อไป" ของตัวเอง · โมดูลของหน้าโหลดเมื่อเปิดหน้านั้นครั้งแรก (`v3site.js`) · **สว่างอย่างเดียว (ตั้งใจ)** · ภาพถ่ายประกอบ (AI) อยู่ใน `assets/photos/` ตาม `photos.json` (prompt + alt) — **ยังไม่มีไฟล์ภาพ** เพราะ network policy บล็อก CDN ผลลัพธ์ของ Higgsfield (`d8j0ntlcm91z4.cloudfront.net`) — ไม่มีภาพ = เลย์เอาต์ปิดช่องเอง (ไม่มีกล่องว่าง) · วางไฟล์ `<name>.webp` แล้ว `npm run v3` ภาพขึ้นทุกแบบพร้อมป้าย "ภาพประกอบ"

| | A3 แสงเช้า | B3 คู่มือช่าง | C3 โชว์รูม |
|---|---|---|---|
| กลุ่มหลัก | บ้าน คอนโด ร้านเล็ก | องค์กร ผู้ดูแลอาคาร | ผู้เลือกซื้อแอร์ใหม่ |
| เมนูหน้า | แถบบน (จอแคบ = แถวเลื่อนใต้โลโก้) | แถบบทด้านซ้ายตลอด (จอแคบ = แถวเลื่อนบน) | แถบแท็บกลางจอใต้หัวเว็บ |
| หน้าแรก | หัวเรื่อง + รายการงาน 5 งานพร้อมราคาเริ่มต้น ข้างภาพห้อง (4:5) | ภาพงานช่าง 21:9 · หัวเรื่อง + ตาราง "สิ่งที่ตรวจสอบได้" · ตารางงาน/ขอบเขต/ราคาเริ่มต้น | หัวเรื่องตัวมีเชิงกลางจอ · ภาพห้องพาโนรามา 21:9 · งาน 4 ช่อง |
| ฟอนต์หัวข้อ / เนื้อความ | Noto Sans Thai / Noto Sans Thai Looped | Bai Jamjuree / IBM Plex Sans Thai | Noto Serif Thai / Anuphan |
| รูปทรง | มุมโค้ง 20 · เงานุ่ม | มุม 6 · เส้นบาง ไม่มีเงา · ขีดส้มหน้าหัวข้อ | มุมโค้ง 24 · พื้นหมอกอ่อน |

หน้าเทียบ (`preview3.html` → `dist/art/index3.html`, ลิงก์อย่างเดียว ไม่ฝังหน้า): ต้นฉบับ A · B · C (ลิงก์ชุดพัฒนา) + A3 · B3 · C3 + ตาราง 9 หน้า ↔ ตำแหน่งใน A/B/C · ลิงก์ (private, `urls.dev.json` key a3 b3 c3 index3): A3 claude.ai/artifact/DN9HoujitYzPDhwoaMi6vZ · B3 claude.ai/artifact/HfL8ydX1oDy8nH7cMofyfk · C3 claude.ai/artifact/P4cx9g5VT6Kh31knF4vBYc · หน้าเทียบ claude.ai/artifact/XuNkFBEUCRb9LXMwEhTWY9

### 1.4 ฟังก์ชันที่ทำเสร็จแล้ว (ทุกแบบ เว้นแต่ระบุ)

**การขายและราคา (ข้อมูลจริงจาก Pricebook)**
- **Catalog 705 รุ่น 22 แบรนด์** (ติดผนัง 351 · แขวน 178 · สี่ทิศทาง 153 · ตู้ตั้ง 23) จัดกลุ่มเป็นซีรีส์ ค้นหา กรองประเภท/แบรนด์/BTU/ราคา/Inverter เทียบรุ่น · FUJIVA (แบรนด์บริษัท) แสดงเป็น "รอนำเข้าราคา"
- **หน้าสินค้า (drawer):** ราคารวม VAT + ก่อน VAT, สลับ BTU ในซีรีส์, แพ็กเกจติดตั้ง มาตรฐาน/พรีเมียม/ไม่ติดตั้ง (รวม/ไม่รวม/รับประกัน), อุปกรณ์เสริมตามขนาดเครื่อง, งานประเมินหน้างาน, ตารางเทียบวัสดุ, สเปกเต็ม, จำนวน → ราคารวม → ใส่ใบเสนอราคา
- **ศูนย์ค่าบริการ** (`mountPriceCenter`): ล้าง (3 แพ็กเกจ × C1/C2 × ประเภท × BTU + AHU/งานเพิ่ม) · ติดตั้ง (167 รายการบนเว็บ) · ซ่อม 86 รายการ · รื้อ/ย้าย/น้ำยา/งานพิเศษ · วัสดุ — ค้นหาได้ ทุกแถวมีปุ่ม "เพิ่ม" หรือ "ขอประเมิน"
- **ตัวคำนวณสัญญาล้างรายปี** (`mountBuilder` + `estimateContract`): จำนวนเครื่องต่อประเภท × รอบต่อปี × แพ็กเกจ → ราคาต่อปี + กำลังทีมที่ต้องใช้ + ยอดขั้นต่ำ 4,500
- **ใบเสนอราคาเบื้องต้น (ตะกร้า)** ทุกหน้า: ปรับจำนวน/ลบ, ใส่พื้นที่ → ค่าเดินทาง/ยกเว้น/เตือนขั้นต่ำเครื่อง, เติมส่วนต่างยอดขั้นต่ำงานล้าง, ยอดก่อน VAT / VAT / รวม, ฟอร์มส่งคำขอ → ★r10 ticket เข้าหลังบ้าน (เมื่อตั้ง `TICKET_ENDPOINT`) ไม่เชื่อม = เลขอ้างอิง + สรุปให้ส่งเอง, คัดลอกสรุปไป LINE · เก็บใน `localStorage['sbp-quote-v2']`
- ★r10 **จองคิว + ticket เข้าหลังบ้าน** (`booking.js`, `ticket.js`, `backoffice/`): ฟอร์มจองคิว 4 ขั้น (งาน+จำนวนเครื่อง → วัน/ช่วง + แถบวันว่าง → สถานที่ → ผู้ติดต่อ+ยินยอม) → เลขที่คำขอ + ติดตามสถานะ · ฟอร์มติดต่อ/ใบเสนอราคา/ความเห็นเป็น ticket เดียวกัน · หลังบ้าน = Google Sheet + Apps Script + หน้า `backoffice.html` (ยืนยันนัด จัดทีม กำลังทีม 14 วัน) — **รอติดตั้งในบัญชี Google บริษัท**
- **ตรวจพื้นที่ + ค่าเดินทาง** (`checkZone`, `travelCharge`) + **แผนที่ประเทศไทย 3 มิติ 77 จังหวัด** (`thaimap3d.js`) ระบายสีตามโซน คลิกจังหวัดเพื่อตรวจ

**ภาพอธิบาย / 3 มิติ (ทั้งหมดเป็น "แบบจำลองเพื่ออธิบาย")**
- **ตัวเครื่อง 3 มิติ** (`ac3d.js`): คอยล์เย็น/ร้อน, exploded, X-ray, ลม, ฝุ่น + ล้างเสมือนจริง, ป้ายชิ้นส่วน, ช่อง `loadModel(url)` สำหรับ GLB ทางการ (ต้องมีสิทธิ์)
- **แอร์ทำงานอย่างไร** (`howitworks3d.js` + `units3d.js` + `hw-data.js`): ติดผนัง/แขวน/สี่ทิศทาง ตัวเครื่องเต็มมองทะลุ 7 ขั้น ลม-น้ำ-น้ำยา แนวท่อในรางครอบท่อถึงคอยล์ร้อน + จำลองระยะลม (`throwsim3d.js`)
- **ห้องจำลอง 48 ห้อง 9 กลุ่ม** (`studio*.js`): ปรับขนาดห้อง คน เครื่องใช้ไฟฟ้า แดด/หลังคา → BTU ที่ต้องใช้ + รุ่นแนะนำพร้อมราคา, ฝุ่น 0–18 เดือน → ลม/ความเย็น/ค่าไฟ (ค่าประมาณ), วงจรทำความเย็น, แผนล้างรายปี
- **โชว์รูมวัสดุ 3 มิติ** (`materials3d.js`): O-TWO · Aeroflex · Airpro · Yazaki · SCG · ขาแขวน+ยางกันสั่น · NANO RCBO
- **ขั้นตอนบริการ** (`services.js`): ล้าง/ติดตั้ง/ซ่อมต่อประเภทเครื่อง งานล้างเรียงตามหัวข้อแบบฟอร์ม SBP-SR-ACCL-UNI-001 Rev.07 พร้อมรายการตรวจ
- **[B] ลำดับการทำงาน 3 มิติ** (`system3d.js`): 9 ขั้นต่อประเภท ไฟ ลม น้ำยา น้ำทิ้งไหลตามเส้นทางจริงในราง + ปุ่มเปิดภาพตัด 2 มิติ (`engdraw.js`)
- **[C] ช่างทำงานจริงในห้อง 3 มิติ** (`techstory.js` + `tech3d.js` + `install3d.js`): ล้างปกติ C1 14 ขั้น · ล้างใหญ่ C2 17 ขั้น · ติดตั้ง 13 ขั้น (มาตรฐาน/พรีเมียม) · ตรวจซ่อม 10 ขั้น ทุกขั้นมี อ้างอิงแบบฟอร์ม / ช่างทำ / ทำไม / ลูกค้าได้ / ป้ายชิ้นส่วน / ค่าที่บันทึก (ตัวอย่าง)
- แถบขั้นตอนใช้บริการ 6 ขั้น (`journey.js mountFlow`), เมนูมือถือ, ปุ่มใบเสนอราคาลอย, FAQ

**ไม่อยู่ในเฟสนี้ (คำตัดสินเจ้าของ):** ชำระเงินออนไลน์ · หน้าผลงาน/โลโก้ลูกค้า · รีวิว · บทความ SEO

---

## 2. Tech Stack & Architecture

### 2.1 Stack ปัจจุบัน (ต้นแบบ — ไม่มี framework, ไม่มี backend)

| ชั้น | ใช้อะไร | เวอร์ชัน / หมายเหตุ |
|---|---|---|
| ภาษา | HTML5 + CSS (custom properties) + **JavaScript ES modules (ES2022)** | ไม่มี TypeScript, ไม่มี JSX |
| Framework | **ไม่มี** — vanilla DOM ผ่าน helper `h()` / `$()` / `$$()` | ทุกโมดูลมี `mountX(root, cfg)` |
| 3D | **three.js r170** (vendored: `assets/three.module.min.js`) + `GLTFLoader.js`, `RoomEnvironment.js`, `BufferGeometryUtils.js` (addons ของ r170) | ทุกโมเดลเป็น procedural (สร้างจากโค้ด) ไม่มีไฟล์ GLB |
| ข้อมูล | `assets/sbp-data.json` (Pricebook สาธารณะ) · `assets/thai-provinces.json` (Natural Earth admin-1, public domain) | ไม่มี database |
| ฟอนต์ | self-hosted woff2 ใน `assets/fonts/`: Anuphan, IBM Plex Sans Thai, IBM Plex Mono, Kanit | `fonts.css` |
| Build | `build.py` (Python 3.11) + **esbuild 0.28.2** ผ่าน `npx --yes` | bundle เป็นไฟล์เดียว inline ทุกอย่าง |
| ทดสอบ | Node 22 + **Playwright 1.56.0** (Chromium + swiftshader) · axe-core 4.13.0 | `tests/*.mjs` |
| กระทบยอดราคา | `tools_recon.py` (Python) | ต้องได้ mismatches 0 |
| Deploy ปัจจุบัน | Claude Artifacts (หน้าเดียว ไฟล์เดียว) | URL ใน `urls.json` |
| Backend / API | ★r10 **Google Apps Script web app + Google Sheet** (`backoffice/apps-script/Code.gs`) — ticket จองคิว/ใบเสนอราคา/ติดต่อ/ความเห็น · ทดสอบในเครื่องด้วย `tools/gas-emu.mjs` (รัน Code.gs ตัวจริง) | ยังไม่ deploy · Artifact เรียกภายนอกไม่ได้ → แสดงสรุปให้ส่งเอง · production ย้ายไป DB จริงได้โดยคงรูปแบบ API |

### 2.2 สถาปัตยกรรม

```
a.html / b.html / c.html          ← markup + CSS tokens ของแต่ละแบบ + <script type="module"> ตัวเดียว (wiring)
   │ import
   ├─ sbp-core.js        domain logic ล้วน (ไม่มี DOM rendering): loadData, catalog/facet, ราคา VAT, ติดตั้ง/อุปกรณ์เสริม,
   │                     checkZone/travel, estimateContract, ค่าคงที่ธุรกิจ  ← ข้อมูลจาก sbp-data.json (หรือ globalThis.__SBP_DATA)
   ├─ proto-ui.js        catalog, contract builder, zone, FAQ, viewer wiring, drawers, toast
   ├─ commerce.js        cart (singleton + localStorage), product detail, price centre, material tables  (lazy → materials3d.js)
   ├─ journey.js         travel table, quote pill, mobile menu, flow bar
   ├─ services.js        ขั้นตอนบริการ (cleanSteps/installSteps/repairSteps)
   ├─ studio.js          ห้องจำลอง UI (lazy → studio3d.js) + studio-model.js (สูตร ไม่มี DOM)
   ├─ howitworks3d.js    กลไกแอร์ 3 ประเภท (units3d, trunk3d, throwsim3d, hw-data)
   ├─ thaimap3d.js       แผนที่ 3 มิติ (thai-provinces.json หรือ globalThis.__SBP_TH)
   ├─ [B] system3d.js    ลำดับการทำงาน 3 มิติ (install3d, airflow3d, people3d)  (lazy → engdraw.js)
   └─ [C] techstory.js   ช่าง 4 งาน (install3d, tech3d, airflow3d)

ชั้นล่างของ 3 มิติ: ac3d.js (ตัวเครื่อง/วัสดุ/helper) · units3d.js · install3d.js (ห้องบ้าน+ระบบติดตั้ง) · tech3d.js (ช่าง+เครื่องมือ)
                     · matkit3d.js (วัสดุพิมพ์ยี่ห้อ) · roomkit3d.js (พื้น ผนัง เฟอร์นิเจอร์) · trunk3d.js (รางครอบท่อ)
                     · airflow3d.js (อนุภาคลม) · people3d.js (คนมีข้อต่อ)
```

**Data flow ราคา:**
```
Pricebook Excel (ใบเสนอราคาติดตั้งแอร์ Final จริง.xlsx, ใบเสนอราคาล้างและซ่อม Final จริง.xlsx)
   → [สคริปต์แปลง — ทำแบบ ad-hoc ใน Cowork, ยังไม่อยู่ใน repo ⚠️ ดู §8 ข้อ 6]
   → assets/sbp-data.json   (สาธารณะ: อัตรามาตรฐานเท่านั้น, รุ่นที่อนุมัติเท่านั้น, sp/pj = null)
   → internal/sbp_real.json (ภายใน: มีอัตราพิเศษ/โครงการ — ห้ามขึ้นเว็บ ห้าม commit)
   → loadData() แปลงตอนโหลด (K Copper → O-TWO, ซ่อน -MASS และ MAT-CU-L-*)
   → tools_recon.py เทียบทุกราคาที่เว็บแสดงได้กับ extract ภายใน → ต้อง 0 ผิด
```

**Build pipeline (`build.py`):** แต่ละแบบ → CSS inline (ฟอนต์เป็น data URI) → script module ถูก bundle ด้วย esbuild (รวม three.js และ lazy imports) → ฝังข้อมูลเป็น `globalThis.__SBP_DATA`, `__SBP_TH`, และ `__SBP_LOGOS` (ถ้ามีไฟล์ใน `assets/logos/`) → ได้ไฟล์เดียว ~2.3–2.4 MB ต่อแบบ

### 2.3 สถาปัตยกรรม production ที่แนะนำ (ยังไม่เริ่ม — แผน §4 ของ Handoff Plan)

| ชั้น | แนะนำ |
|---|---|
| Framework | Next.js (App Router) + TypeScript — บริษัทมีเว็บ Polar Air บน Next.js อยู่แล้ว; หน้าสินค้า 705 รุ่นทำ SSG |
| สไตล์ | CSS variables (ยก token จากต้นแบบ) + CSS Modules หรือ Tailwind อ่าน token |
| 3D | ห่อโมดูลเดิมเป็น client component (dynamic import, `ssr:false`) หรือย้ายไป react-three-fiber |
| ข้อมูล | PostgreSQL/Supabase + สคริปต์นำเข้าจาก Excel (เจ้าของแก้ราคาใน Excel ที่เดิม) |
| ใบเสนอราคา | cart ฝั่ง client + API สร้าง Lead และ **คำนวณยอดซ้ำฝั่ง server** |
| ระยะทาง | Google Distance Matrix จากที่อยู่หน้างาน |
| แจ้งเตือน | LINE OA / อีเมลทีมขาย |

---

## 3. Current File Structure

```
sbp-aircare/
├── CLAUDE.md                     ← ไฟล์นี้
├── SBP-WEB-011_Dev_Handoff_Plan.md  แผนส่งมอบทีม Dev ฉบับเต็ม (ภาษาไทย) — อ้างอิงคำตัดสินเจ้าของ §0, สเปก §6A–6V, checklist §12
├── package.json                  npm scripts + devDependencies (playwright, axe-core)
├── .gitignore                    dist/ internal/ node_modules/ _entry_*.mjs *.png
├── urls.json                     URL ของ artifact ที่เผยแพร่ (build.py ใช้แปลงลิงก์ระหว่างหน้า) — ชุดที่แชร์ "ทุกคนที่มีลิงก์"
├── urls.dev.json                 ★Rev.09 URL ชุดทดลองพัฒนา (`npm run build:dev`) — อัปเดตชุดนี้ระหว่างพัฒนา ไม่แตะชุดที่แชร์
├── build.py                      สร้างไฟล์เดียว → dist/offline/*, dist/art/*  (128 บรรทัด, โค้ดเต็มใน §4.4)
├── tools_recon.py                กระทบยอดราคาเว็บ vs Pricebook (ต้อง 0 ผิด)  (โค้ดเต็มใน §4.5)
│
├── a.html                        แบบ A · Bento (754 บรรทัด: markup + CSS tokens + wiring)
├── b.html                        แบบ B · Engineering (645)
├── c.html                        แบบ C · Showroom (541)
├── backoffice.html               ★r10 หน้าหลังบ้าน (ภายใน noindex) — `backoffice-board.js` · build → dist/offline/backoffice.html เท่านั้น ห้ามทำเป็น Artifact
├── backoffice/                   ★r10 README.md (ติดตั้ง Google Sheet + Apps Script ภาษาไทย) · apps-script/Code.gs + appsscript.json · .dev-data.json (gitignored)
├── tools/                        ★r10 gas-emu.mjs (Apps Script emulator: Sheet/Properties/Cache/Lock/Mail/UrlFetch/Utilities) · backoffice-server.mjs (`npm run backoffice` :8790 = /exec + ไฟล์เว็บ)
├── d.html                        ★r11 แบบ D · Studio (markup + tokens + wiring) — สไตล์ `assets/d.css` · ใบงาน `assets/jobcard.js` · บทต่าง ๆ `assets/dstudio.js`
├── preview.html                  หน้าทดสอบ A/B/C/D (★r11 เพิ่ม D: แท็บ + เทียบ 4 แบบ + ให้คะแนน · `ALIAS.d` แมปหัวข้อ A/B/C → บทของ D): สลับแบบ/ขนาดจอ เทียบ 3 แบบพร้อมกัน รายการทดลอง + ให้คะแนน 6 ด้าน (localStorage 'sbp-preview-v1')
├── a2.html · b2.html · c2.html · d2.html  ★r16 รุ่นที่ 2 ทำใหม่ (ภาพยนตร์ · ภารกิจ · โชว์รูม · ดิจิทัลทวิน) — markup + tokens + CSS ของแต่ละแบบ · สคริปต์เรียก `mountFilmSite()` (filmsite.js) · B2 มีสคริปต์ภารกิจ/เหรียญ (localStorage `sbp-b2-missions`) · C2 แถบใบเสนอราคาล่างจอ · (เดิม r12: Residence · Tower · Noir · Atelier)
├── preview2.html                 ★r12 หน้าทดสอบรุ่นที่ 2 (A2/B2/C2/D2) → `dist/art/index2.html` · localStorage `sbp-preview-v2`
├── a3.html · b3.html · c3.html  ★r13 รุ่นที่ 3 — **ไฟล์ที่สร้าง ห้ามแก้ตรง** แก้ที่ `tools/v3/` แล้ว `npm run v3` (tools/v3gen.py)
├── preview3.html                 ★r13 หน้าเทียบ ต้นฉบับ A/B/C + A3/B3/C3 (ลิงก์อย่างเดียว) → `dist/art/index3.html`
├── tools/v3gen.py · tools/v3/   ★r13 ตัวสร้างรุ่นที่ 3: sections.html (เนื้อหาร่วม) · shell-/home-<e>.html · <e>.css
├── tools/photofinish.py          ★r17 เกรดภาพประกอบ A3–C3 (ครอปตาม ar · inpaint ลบเครื่องหมายบนตัวเครื่อง · tone/สี/vignette/grain ชุดเดียว) — numpy + opencv-python-headless
├── test-cinema.html              ★r12 ดูภาพ 3 มิติแบบภาพยนตร์แยก ?mood=&type=&shot=&q=&fx=&fy=&x=&xr&t= (window.TS, window.READY) — ใช้กับ tools/posters.mjs
│
├── test-ts.html                  ทดสอบ techstory แยก (window.TS, window.READY)   ?theme=light|dark
├── test-shots.html               ★Rev.09 ดูภาพเรนเดอร์สินค้า 5 แบบ (productShots) — ตรวจหลังแก้ตัวเครื่อง 3 มิติ
├── test-clean.html               ★Rev.09 r4 ทดสอบส่วน "ทีมช่าง ล้าง / ติดตั้ง" แยก ?job=clean|install&type=wall|ceiling|cassette|floor&level=C1|C2|STANDARD|PREMIUM&theme=dark&step=n (window.TS.go / steps / advance / busy / ready)
├── test-sys.html                 ทดสอบ system3d แยก   ?type=wall|ceiling|cassette
├── test-home.html                ทดสอบฉากบ้าน install3d แยก
├── test-mat.html                 ทดสอบโชว์รูมวัสดุแยก
├── test-hw.html · test-ed.html · test-map.html · test-studio.html · test-throw.html · test-viewer.html · test3d.html · testroom.html
│                                 หน้าทดสอบโมดูลเดี่ยวอื่น ๆ (ใช้ debug / screenshot)
├── index.html · hub.tpl.html · hub.tpl2.html · hub-local.html
│                                 ⚠️ LEGACY — หน้า hub รุ่นเก่า (Rev.03–06) ไม่ได้ใช้ใน build ปัจจุบัน (build ใช้ preview.html) ลบได้หลังยืนยัน
│
├── tests/                        Playwright (ต้องเปิด dev server ก่อน; BASE=http://localhost:8765)
│   ├── _lib.mjs                  launch() แบบ swiftshader + scrollAll()
│   ├── smoke.mjs                 error ใน console, จำนวน canvas/WebGL context, overflow แนวนอน  → exit 1 ถ้าไม่ผ่าน
│   ├── textscan.mjs              คำต้องห้าม / Type L / K Copper / สีเทา / ต้นทุน / อัตราพิเศษ ในข้อความที่แสดง
│   ├── pricing.mjs               ★Rev.09 r9 `npm run pricing` (ไม่ใช้ browser): ทุกราคาที่เว็บแสดงเป็นหลักร้อย · VAT ใบกำกับภาษี · ราคาขั้นบันได 792 กรณี
│   ├── story-shots.mjs           screenshot ขั้นของ techstory (C1|C2|install|repair)
│   ├── backoffice.mjs            ★r10 `npm run test:backoffice` Code.gs ใน emulator 44 ข้อ
│   ├── booking-e2e.mjs           ★r10 จองคิว → ticket → หลังบ้าน → ลูกค้าเห็นสถานะ 21 ข้อ (เปิดเซิร์ฟเวอร์เองพอร์ต 8792+) `node tests/booking-e2e.mjs [page] [width] [theme]`
│   ├── d-flow.mjs                ★r11 `npm run test:d` แบบ D: ใบงาน 4 งานคิดราคาถูก · ยอดขั้นต่ำ · ตาราง → ใบงาน · ใบงาน → จองคิว/ใบเสนอราคา · แท็บองค์กร · ไม่มี error · ไม่เลื่อนแนวนอน (16 ข้อ)
│   ├── v3-flow.mjs               ★r13 `npm run test:v3` (BASE env ได้): เมนู 9 หน้าเรียงถูก · แต่ละหน้าแสดงเฉพาะส่วนของตัวเอง + h1 เดียว + เมนูทำเครื่องหมาย · ย้อนกลับ/ไปข้างหน้า · ลิงก์งานในหน้าแรกเปิดหน้าถูก + ราคาเริ่มต้น · เช็กอาการ 10 เรื่องได้ราคาหรือ "ประเมินหน้างาน" → จองคิวในหน้าติดต่อ · สินค้า/ล้าง/ติดตั้ง/สัญญารายปี → ใบเสนอราคา · ลิงก์ data-pc → หน้าราคา · ค้นหารุ่น · คำต้องห้าม · WebGL ≤ 3 · ไม่ error · ไม่เลื่อนแนวนอน
│   ├── v2-flow.mjs               ★r12 `npm run test:v2` รุ่นที่ 2: ปรึกษา 10 เรื่อง × 4 ประเภทได้ราคาหรือ "ประเมินหน้างาน" ทุกกรณี · ไม่เย็น+เกิน 1 ปี → C2 + บรรทัดยอดขั้นต่ำ · ป้ายชิ้นส่วนบนภาพ · ส่งต่อจองคิว · ซื้อใหม่ → โชว์รูมได้รุ่น ≥ BTU ที่แนะนำ · โชว์รูม 4 ประเภท → ใบเสนอราคา · ราคาในบท → ใบเสนอราคา · คำต้องห้ามในทุกคำตอบ · WebGL ≤ 3 · ไม่ error · ไม่เลื่อนแนวนอน (97 ข้อ)
│   ├── section-shots.mjs         ★Rev.09 screenshot ทุก section ของหน้า (ตรวจงานออกแบบ ก่อน–หลัง)
│   └── shot.mjs                  ★Rev.09 screenshot หนึ่ง section (`@id` = ทั้ง section) + รายงาน console error
│
├── internal/                     ⚠️ ไม่อยู่ใน zip สาธารณะ, gitignored — วาง sbp_real.json (extract ภายใน มีอัตราพิเศษ/โครงการ)
├── dist/                         ผล build (gitignored)
│
└── assets/
    ├── sbp-data.json             Pricebook สาธารณะ 220 KB (schema §4.2)
    ├── thai-provinces.json       77 จังหวัด (polygon แบบย่อ)
    ├── fonts.css · fonts/*.woff2 Anuphan / IBM Plex Sans Thai / IBM Plex Mono / Kanit (Thai + Latin subsets)
    ├── logos/README.txt          ช่องใส่โลโก้ทางการ (ต้องมีหนังสืออนุญาต) — key: aeroflex scg yazaki airpro o-two nano · ★r9 `sbp.png` (ตรา SP บริษัท) + `fujiva.png` จากเจ้าของ → header/footer/การ์ด FUJIVA (build แปลง `src="assets/logos/…"` เป็น data URI) + ภาพ 3 มิติ
    │
    ├── shared.css      (543)     สไตล์ร่วม: price centre, product detail, cart, builder, ป้าย 3 มิติ (.hl*), techstory (.ts*), system3d (.sy3*)
    ├── studio.css      (214)     ห้องจำลอง
    ├── services.css    (146)     ขั้นตอนบริการ
    │
    ├── sbp-core.js     (378)     ★ domain logic + ข้อมูล + กฎธุรกิจ (VAT, โซน, ค่าเดินทาง, แพ็กเกจล้าง, สัญญา, BTU)
    ├── proto-ui.js     (464)     catalog / builder / zone / FAQ / viewer / drawers / toast / reveal
    ├── commerce.js     (426)     cart · productDetail · mountPriceCenter · materialMatrix/Table · mountMaterials · cleanPackageGuide
    ├── journey.js      (96)      travelTable · mountQuotePill · mountMobileMenu · mountFlow
    ├── services.js     (452)     cleanSteps(type, level, pkg) · installSteps · repairSteps · mountServices
    ├── hw-data.js      (47)      ข้อความ "แอร์แต่ละประเภททำงานอย่างไร" (TYPES, STEPS, LABELS, FAN_NAME)
    ├── studio-model.js (244)     ห้องจำลอง: 48 SCENES, สูตร BTU, ฝุ่น→ผล, ค่าไฟ, อุณหภูมิห้อง (ไม่มี DOM — unit test ได้)
    ├── studio.js       (452)     UI ห้องจำลอง
    ├── studio3d.js     (722)     ฉาก 3 มิติห้องจำลอง (ห้อง/เฟอร์นิเจอร์/แอร์ 5 ประเภท/อนุภาคลม/ฝุ่น/heat map)
    ├── ac3d.js         (873)     ★ ตัวเครื่อง 3 มิติ + viewer (exploded/X-ray/ล้าง) + helper ร่วม (materialSet, canvasTex, orbit, buildIndoor/Outdoor)
    ├── units3d.js      (345)     แอร์ติดผนัง/แขวน/สี่ทิศทาง ละเอียด + animateUnit
    ├── howitworks3d.js (472)     กลไกแอร์ 3 ประเภท 7 ขั้น
    ├── throwsim3d.js   (300)     จำลองระยะลมในห้อง 12 ม. · ★Rev.09 r4 4 ประเภท (เพิ่มตู้ตั้ง) + ตัวควบคุมจำลอง 3 แบบ: รีโมต (A) · แผงควบคุมห้อง (B) · แผงสัมผัสกระจก (C)
    ├── trunk3d.js      (94)      รางครอบท่อ Airpro + ข้อต่อ (bentPath, buildTrunk, pipeHanger)
    ├── airflow3d.js    (205)     อนุภาคลมแบบเส้น (tempColor, createAirflow)
    ├── people3d.js     (214)     คนมีข้อต่อแบบ instanced (createCrowd, gait, freePath) + pose 'rig'
    ├── roomkit3d.js    (122)     texture + เฟอร์นิเจอร์ procedural
    ├── matkit3d.js     (109)     ★Rev.08 วัสดุพิมพ์ยี่ห้อ (printed, tube, kit, COPPER, logoImage)
    ├── materials3d.js  (367)     ★Rev.08 โชว์รูมวัสดุ 3 มิติ 7 แท่น
    ├── install3d.js    (528)     ★Rev.08 ห้องบ้านจำลอง + ระบบติดตั้งครบ (ใช้ร่วม B/C)
    ├── tech3d.js       (239)     ★Rev.08 ช่าง + เครื่องมือ + เส้นทางเดิน
    ├── techstory.js    (387)     ★Rev.08 เรื่องราว 4 งาน + UI (แบบ C)
    ├── system3d.js     (244)     ★Rev.08 ลำดับการทำงาน 9 ขั้น (แบบ B)
    ├── engdraw.js      (155)     แบบวิศวกรรมภาพตัด 2 มิติ (แบบ B, lazy)
    ├── thaimap3d.js    (243)     แผนที่ประเทศไทย 3 มิติ
    ├── contact.js                ★Rev.09 askTeam(topic,msg) + หัวข้อ/รายละเอียดในฟอร์มติดต่อ · ★r5 handoffBox (Beta: สรุปคำขอให้ลูกค้าคัดลอก/ส่งอีเมล — ไม่แกล้งว่าส่งแล้ว) · copyText
    ├── jobcard.js                ★r11 "ใบงาน" ของแบบ D: `mountJobCard(root, {onBook, onQuote, onShop})` → `{set(job), load(o), state, summary(), stamp(id)}` · `installRows(type)` · `diagnosis(type)` · `SYMPTOMS` · event `jc:change` (`detail` = สรุป) บน root
    ├── dstudio.js · d.css        ★r11 บทของแบบ D: `mountCleanChapter` · `mountInstallChapter` · `mountRepairChapter` · `whenNear(el, fn, margin)` (mount ในเวลาว่างเมื่อใกล้จอ) · `onDemand(btn, host, load)` · `wireContactForm(form)` · `fillFacts()` (ตัวเลขจากข้อมูล)
    ├── fonts/noto-sans-thai-*.woff2  ★r11 Noto Sans Thai (variable น้ำหนัก 500–800 กว้าง 70–100%) + Looped (400–650) OFL-1.1 ตัดเหลือไทย + ละตินพื้นฐาน รวม 87 KB
    ├── fonts/{trirong,bai-jamjuree,fahkwang,noto-serif-thai}-*.woff2  ★r12 ฟอนต์หัวข้อรุ่นที่ 2 (OFL-1.1, @fontsource 5.3.0 ชุดไทย + ละติน) — build ฝังเฉพาะฟอนต์ที่หน้านั้นเรียกชื่อ
    ├── cinema3d.js               ★r12 ภาพ 3 มิติแบบภาพยนตร์ (ดู §4.1) · three-pp/ = post-processing add-ons ของ three r170 (vendored ห้ามแก้ · import ชี้ไฟล์ในโฟลเดอร์)
    ├── film.js · filmscenes.js · filmfx.js · filmsell.js · filmsite.js · film.css   ★r16 film engine ของรุ่นที่ 2 (ผู้กำกับฉาก · ตัวแปลงฉาก 7 ชนิด · ชื่อเรื่องแตกคำ/เกรน/เสียง · แผงขาย · wiring · สไตล์)
    ├── stage.js · showroom.js · concierge.js · v2site.js · v2.css   ★r12 เวที (canvas เดียวหลายจุด) · โชว์รูมทุกรุ่น · ส่วนปรึกษา · wiring ร่วมของรุ่น 2 · สไตล์ร่วมรุ่น 2 (ใช้ token ของหน้า)
    ├── v3site.js · v3.css        ★r13 wiring รุ่นที่ 3 (`mountV3`, `PAGES` 9 หน้า → site.js) · สไตล์โมดูลร่วม (จาก a.html ใช้ token ของหน้า) + ส่วนเช็กอาการ + ภาพ `.ph3`
    ├── photos/photos.json        ★r13 รายการภาพประกอบ AI (alt, สัดส่วน, prompt) · ไฟล์ `<name>.webp` วางที่นี่ (build ฝังเป็น data URI)
    ├── posters/*.jpg             ★r12 ภาพนิ่งเปิดหน้า hero ของ A2–D2 (จอใหญ่ + มือถือ) จาก `npm run posters` (tools/posters.mjs)
    ├── ticket.js                 ★r10 ตัวเชื่อมหลังบ้าน: `TICKET_ENDPOINT` (วาง URL /exec) · sendTicket / fetchSlots / trackTicket / staffApi · ศัพท์ KINDS SERVICES STATUSES SLOTS
    ├── booking.js · booking.css  ★r10 ส่วน "จองคิว" `#booking` (ฟอร์ม 4 ขั้น + แถบวันว่าง + ติดตามสถานะ) · ฟัง event `sbp:book`
    ├── backoffice-board.js       ★r10 หน้าหลังบ้าน (เข้าใช้ด้วยชื่อ + STAFF_TOKEN ใน sessionStorage)
    ├── typeset.js                ★r18 `thaiPhrases(sel)` (หัวข้อ/คำอธิบายภาษาไทยไม่ฉีกคำ: แต่ละวลีที่คั่นด้วยช่องว่างเป็น inline-block) · `zoneMarks()` (เลขปุ่มหัวข้อของหน้า → ★r20 `data-sec-n` บน section และ eyebrow — เดิม `data-zone` ชนกับตัวตรวจพื้นที่ `#area [data-zone]`) — เรียกท้าย script ของ a/b/c หลัง mountSite
    ├── site.js                   ★Rev.09 r5 โครงเว็บตามเส้นทางลูกค้า: 6 หน้า (หน้าแรก · ซื้อแอร์ · ล้าง/ติดตั้ง/ซ่อม · องค์กร · ความรู้ · ติดต่อ) · เลือกงาน → เส้นทางทีละขั้น · ข้อมูลบริษัท · แบบฟอร์มความเห็น Beta · footer
    ├── product-media.js          ★Rev.09 ช่องรูปสินค้าทุกรุ่น (product-media.json + products/) + ภาพเรนเดอร์ 3 มิติต่อประเภทเมื่อยังไม่มีรูป
    ├── product-media.json · products/README.md   ★Rev.09 manifest รูปจริง (models / series / brands) + วิธีเพิ่มรูป
    ├── roomfit.js                ★Rev.09 "ลองวางแอร์ในห้องของคุณ" UI + fitCheck() (ค่าแนะนำ FIT_RULES, ขนาดเครื่องจากสเปก, ท่อ, ระยะลม) + FUJIVA preview
    ├── roomfit3d.js              ★Rev.09 ฉาก 3 มิติห้องจริงของลูกค้า: เครื่องตามขนาดจริง ระยะห่าง ลม คอยล์ร้อน แนวท่อ
    ├── knowledge.js              ★Rev.09 ศูนย์ความรู้ 12 หัวข้อ (บ้าน/องค์กร) ตัวเลขดึงจากค่าคงที่เดียวกับเครื่องมือ + ปุ่ม "ลองเอง"
    ├── gl-pool.js                ★Rev.09 งบ WebGL context (≤3 live) — ทุก renderer ลงทะเบียนด้วย track()
    ├── wisp3d.js                 ★Rev.09 r3 ลมแบบธรรมชาติ: createWisps (เส้นลมโปร่งเรียวท้าย) · createHaze (ไอเย็นจาง) · airTint · swirl — ภาพลมทุกจุดใช้ตัวนี้
    ├── roomplan.js               ★Rev.09 r3 จัดห้อง (ไม่มี DOM/three): FURN 21 ชิ้น · PRESETS 7 ห้อง · presetLayout · freeSpot · layoutChecks (ของบังลม/ลมเป่าหน้า/ทับหน้าต่าง)
    ├── business.js · business.css ★Rev.09 r9 หน้าองค์กร: จุดเด่น + ราคาขั้นบันได + เทียบแพ็กเกจ (`#amc`) · ขั้นตอนสัญญา + ขั้นตอนต่อเครื่อง + ตัวอย่าง Service Report + เงื่อนไข (`#sop`) · งานโครงการ สร้างใหม่ / รีโนเวต / เปลี่ยนพร้อมเทิร์น + ประมาณการทีละห้อง (`#projects`)
    ├── jobguide.js               ★Rev.09 r4 (แทน cleanguide.js) "ทีมช่าง ล้าง / ติดตั้ง" (#cleanflow): แท็บงานล้าง C1/C2 · งานติดตั้ง มาตรฐาน/พรีเมียม × 4 ประเภท (ติดผนัง/แขวน/สี่ทิศทาง/ตู้ตั้ง) · การ์ดเทียบ + ราคา Pricebook · เล่นทีละขั้น · ช่างหัวหน้า/ผู้ช่วยทำอะไร · วิธีทำต่อประเภท (CLEAN_HOW/INSTALL_HOW) · ถาดชิ้นส่วน / รายการติดตั้ง
    ├── jobscene3d.js             ★Rev.09 r4 (แทน cleanguide3d.js) ฉาก 3 มิติทีมช่างหน้างานจริง: สถานที่ตามประเภท (ติดผนัง = ห้องนอนบ้าน · แขวน = ร้านค้า · สี่ทิศทาง = คาเฟ่ · ตู้ตั้ง = ห้องประชุม) · ส่งต่อชิ้นส่วนช่าง→ผู้ช่วย→โต๊ะ · ติดตั้งทีละขั้น (เทปแนว ขายึด ยกสองคน ท่อในราง น้ำทิ้ง สายไฟ ไนโตรเจน Vacuum) · ตัวแอร์ไม่มียี่ห้อ
    ├── crew3d.js                 ★Rev.09 r4 ช่าง 2 คน + ลูกค้า (people3d rig): เดิน ปีนบันได ท่าทำงาน ~30 ท่า เครื่องมือในมือ ป้ายเสื้อ SBP AirCare
    ├── brand3d.js                ★Rev.09 r4 ตราบริษัทในฉาก 3 มิติ (texture): เสื่อ FUJIVA · ป้ายเสื้อ · กล่องเครื่องมือ · ถุงล้าง · แท็บเล็ตรายงาน — ใช้ไฟล์โลโก้ทางการอัตโนมัติถ้ามี assets/logos/fujiva.png, sbp.png
    └── three.module.min.js · GLTFLoader.js · RoomEnvironment.js · BufferGeometryUtils.js   (three.js r170, ห้ามแก้)
```

**Dependency graph ของโมดูล 3 มิติ (Rev.08):**
```
techstory.js ─┬─ install3d.js ─┬─ trunk3d.js
system3d.js  ─┤                ├─ matkit3d.js
              │                ├─ roomkit3d.js
              │                ├─ units3d.js ── ac3d.js ── RoomEnvironment.js
              ├─ tech3d.js ────┴─ people3d.js
              └─ airflow3d.js
```

---

## 4. Complete Source Code Summary

> **โค้ดเต็มทุกไฟล์อยู่ใน `SBP-WEB-011_Prototype_Source.zip`** (ตรงกับเวอร์ชันที่เผยแพร่ Rev.08.1) — ส่วนนี้ให้ "สัญญา" ที่ต้องรู้ก่อนแก้ + โค้ดเต็มของไฟล์ pipeline ที่สั้นและสำคัญ (`build.py`, `tools_recon.py`) + โค้ดจริงของกฎธุรกิจที่ห้ามพัง
> ไฟล์ที่แก้ล่าสุด (Rev.08 → 08.1): `install3d.js` (ใหม่), `tech3d.js` (ใหม่), `system3d.js` (ใหม่), `matkit3d.js` (ใหม่), `techstory.js` (เขียนใหม่), `materials3d.js` (ส่วนหัวเขียนใหม่), `people3d.js`, `services.js`, `services.css`, `shared.css`, `howitworks3d.js`, `studio3d.js`, `sbp-core.js`, `commerce.js`, `b.html`, `c.html`, `build.py`, `tools_recon.py` (path แบบ relative), `tests/*`, `package.json`, `.gitignore`

### 4.1 Public API ของแต่ละโมดูล (exports)

| โมดูล | exports หลัก | การเรียกใช้ในหน้า |
|---|---|---|
| `sbp-core.js` | `VAT, incVat, vatOf, r100, TAX_MODES, PRICE_NOTE, withTax` (★r9), `VOLUME_TIERS, tierFor` (★r9), `logoSrc` (★r9), `TYPES, TYPE_BY_ID, BRANDS, BRAND_BY_ID, DEMO, DATA, loadData, stockTh, installOptions, addonsFor, PRICE_BANDS, BTU_BANDS, emptyFilter, queryCatalog, facetCounts, filterToParams, baht, btuFmt, kbtu, HQ, ZONES, NEARBY, TRAVEL, TIER_TH, travelFor, travelCharge, travelNote, checkZone, CLEAN_PKGS, SIZE_BANDS, VOLUME_LEVELS, VOLUME_HINT, PRICING, PRESETS, estimateContract, recommendBtu, SERVICES, PROCESS, FAQ, h, $, $$, countUp, reduceMotion` | `await loadData()` ก่อน mount ทุกอย่าง |
| `proto-ui.js` | `mountCatalog(root,cfg)`, `mountBuilder(root,cfg)`, `mountZone(root,{onResult})`, `mountFaq(root)`, `mountBtu`, `mountViewer(root,cfg)`, `scrollExplode`, `mountRoom`, `toast(msg)`, `reveal`, `openDrawer/closeDrawer/wireDrawers`, `typeArt`, `productDrawerContent`, `compareTable` | |
| `commerce.js` | `cart` (singleton: `items, zone, zoneInput, tax ('none'\|'invoice' ★r9), subs:Set, load(), save(), add(line), setQty(id,q), remove(id), clear(), setZone(input), setTax(m), count(), totals()` → `{…, totalEx, tax, vat, inc}`), `mountCart({buttons})` → `{open, close, render}`, `productDetail(m, skuIndex, {onPick,on3D,onAdded})`, `mountPriceCenter(root)`, `materialMatrix(type,btu)`, `materialTable(type,btu,{compact})`, `mountMaterials(root,{theme})` (lazy โหลด `materials3d.js`), `cleanPackageGuide(where,hl)`, `MAT_ROWS, PKG_INFO, METHOD_INFO` | |
| `journey.js` | `travelTable()`, `mountQuotePill(openCart)`, `mountMobileMenu()`, `mountFlow(root, ids, {openCart, dock})` | |
| `services.js` | `cleanSteps(type, level, pkg)`, `installSteps(type, lv)`, `repairSteps`, `mountServices(root, {how, onType, onPart})`, `typeIcon(t)` | |
| `studio.js` | `mountStudio(root, {theme, sceneStart, onOpen(m,i)})` (async, lazy 3D) | sceneStart: A `bedroom` · B `openoffice` · C `living` |
| `studio-model.js` | `SCENES` (48), `SCENE_GROUPS` (9), `needBtu, btuBreakdown, recommendUnits, dirtFrom, effects, energy, cleanInterval, thermal, timeToSet, steadyT …` | ไม่มี DOM |
| `howitworks3d.js` | `createHowItWorks3D(container, opts)`, `mountHowItWorks(root, {theme, start, onType})` → `{setType, focusPart}` | theme: `light` / `blueprint` / `dark` |
| `system3d.js` | `createSystem3D(container, {theme, type, onStep})` → `{setType, go, steps, advance, dispose}` · `mountSystem3D(root, {theme, start, onType})` → `{setType, mark, _v3}` | แบบ B `#edRoot` |
| `techstory.js` | `STORIES` · `createTechStory3D(container, opts)` → `{go(i), setStory(key,tier), length, story(), dispose, advance(sec), _dbg}` · `mountTechStory(root, {theme})` → `{setFinish, _s3()}` | แบบ C `#storyRoot` |
| `install3d.js` | `createStage(container, o)` → `{renderer, scene, camera, cam, flyTo, el, container, onFrame(f), onAfter(f), size, flying, advance(sec), dispose()}` · `createLabels(container)` → `{set(list), update(cam,W,H), occluders(list)}` · `buildHome(scene, {type, theme})` · `createPathFlow(parent, o)` · `laneLine, smoothPts, V, clamp, ease, RM` | |
| `tech3d.js` | `buildTools(home)` → `{g, items, show(name,on), update(dt,unitMatrix), washerHose(to), bagHoseTo(spoutW)}` · `createTech(home, {tools})` → `{crowd, tools, st, goTo(spot,act,tool,immediate), tick(dt,clock), customer(mode), toolTip(name), busy, hand(), setGhost(k), stepGhost(dt)}` · `SPOTS` | |
| `matkit3d.js` | `printed(kind, L, theme)`, `tube(curve, r, kind, theme, seg)`, `kit(theme)`, `logoImage(key)`, `COPPER = { wall: 0.0007, sizes: {'1/4"','3/8"','1/2"','5/8"'} }` | |
| `materials3d.js` | `MATS`, `createMaterials3D(container, opts)`, `mountMaterials3D(root, {theme})` | |
| `ac3d.js` | `createACViewer(container, opts)` → `{setUnit, setExplode, setXray, setAirflow, setDirt, clean, view, select, zoom, loadModel(url) …}`, `createRoomSim`, `PARTS`, `FINISHES`, `buildIndoor, buildPremiumIndoor, buildOutdoor, materialSet, orbit, canvasTex, finSegment, meshTex` | |
| `units3d.js` | `buildWallUnit(M,opt)`, `buildCeilingUnit`, `buildCassetteUnit`, `buildUnit`, `animateUnit(U, dt, t, k)` | |
| `trunk3d.js` | `bentPath(pts, r)`, `pathPoints`, `pipeMesh(path, r, mat, seg)`, `buildTrunk(center, lids, {caps, W, D})`, `pipeHanger(at, up, len, mat)` | |
| `airflow3d.js` | `tempColor(t, out)`, `createAirflow(parent, opts)` → `set({running, …})` | |
| `people3d.js` | `createCrowd(parent, opts)` (pose `'rig'` + `p.rig(S,t,dt,p)` hook, `cap`, `colors` override), `gait(S,w,amp)`, `freePath` | |
| `thaimap3d.js` | `mountThaiMap(host, {theme, onPick})` (async) → `{highlight(zone), setView, provinces}` · ไม่มี WebGL → วาด fallback | |
| `engdraw.js` | `mountEngDrawings(root, cfg)` | lazy จาก system3d |
| `contact.js` ★09 | `enhanceQuoteForm(form)`, `askTeam(topic, message)` (re-export ผ่าน journey.js) · ★r6 `guardForm(form)` ตรวจช่องกรอกภาษาไทยข้างช่อง (aria-invalid + aria-describedby, หยุด submit) · ★r5 `handoffBox({ref, title, text, subject, note})` → กล่องสรุป (คัดลอก / เปิดอีเมล / อีเมลเป็นข้อความเลือกได้ / โทร) · `copyText(text, ta)` · ★r10 `CONSENT_TH`, `consentBox(id)`, `honeypot()`, `submitTicket(ticket, {out, fallback, label, onTrack, form})` → `{ok, id, code}` (สำเร็จ = `ticketCard` · แก้ได้ เช่น bad_tel/no_consent/rate_limited = แจ้งในฟอร์ม · อื่น ๆ = `handoffBox` + เหตุผล) · `ticketCard({id, statusTh, label, onTrack, tel})` · `requestBooking(preset, topic)` | ทุกปุ่ม "ติดต่อสอบถาม" · หลังกดส่งฟอร์ม/ใบเสนอราคา |
| `ticket.js` ★09r10 | `TICKET_ENDPOINT` (production: URL เว็บแอป Apps Script `…/exec`; ว่าง = ไม่เชื่อม) · `TIMEOUT_MS` · `useEndpoint(u)` (หน้าหลังบ้านเท่านั้น, https) · `endpoint()`, `connected()` · `errTh(e)` ข้อความไทย · `sendTicket(ticket)` → `{id, status, statusTh}` · `fetchSlots(from, days)` → `{capacity, days:[{date, AM, PM, EVE}]}` · `trackTicket(id, tel)` · `staffApi(token)` → `{list(q), update(id, patch, staff)}` · `KINDS, SERVICES, STATUSES, SLOTS` · `sourceTag(variant)` · `quoteFromCart(cart)` · error = reject `{code}` (`not_connected` `network` `timeout` หรือรหัสจาก server) · localhost เท่านั้น: `?ticketApi=<url>` | ทุกฟอร์มผ่าน `contact.submitTicket` |
| `booking.js` ★09r10 | `mountBooking(root, {variant, hl})` → `{preset({service, units, notes}), track(id, tel)}` · `bookWith(preset)` · ฟัง `document` event `sbp:book` (`detail` = preset) | `#bookRoot` ทุกแบบ (หน้า "ติดต่อเรา") · เปิดจากที่อื่นด้วย `contact.requestBooking(preset, topic)` (ไม่มีส่วนจองคิว → `askTeam`) |
| `backoffice-board.js` ★09r10 | `mountBoard(root)` — login (ชื่อ + `STAFF_TOKEN` + URL ถ้า `TICKET_ENDPOINT` ว่าง) · ตัวเลขสรุป · ตัวกรอง · ตาราง · กำลังทีม 14 วัน · รายละเอียด + แก้สถานะ/ทีม/วันนัด/ช่วง/โน้ตภายใน · คัดลอกข้อความยืนยันนัด · ประวัติ · รีเฟรช 60 วิ | `backoffice.html` |
| `jobcard.js` ★09r11 | `JOBS`, `SYMPTOMS`, `installRows(type)` → `[{code, lo, hi, range, std, prem}]` (เฉพาะรายการที่มีราคา), `diagnosis(type)` (ค่าตรวจจาก Pricebook; ตู้ตั้ง = null → "แจ้งก่อนนัด") · `mountJobCard(root, {onBook(preset), onQuote(lines), onShop()})` → `{set(job), load({job, type, size, pkg, level, i, tier}), state, summary(), stamp(id)}` · ราคา: ล้าง `cleanRate` + บรรทัดปรับยอดขั้นต่ำ `DATA.minBill` · ติดตั้ง `DATA.inst` · ซ่อม = ค่าตรวจเท่านั้น · สัญญา `estimateContract` (ราคาขั้นบันได) · ไม่อ่านอัตราภายในใด ๆ | `#jobcard` ใน hero ของแบบ D · `stamp` ถูกเรียกจาก `mountBooking({onSent})` เมื่อหลังบ้านตอบเลขที่จริงเท่านั้น |
| `cinema3d.js` ★09r12 | `MOODS` (aurora · tower · noir · atelier) · `createCinema(container, {mood, quality: 'auto'\|'high'\|'mid'\|'low', bars, model:{type,w,h,d}, onShot, onClean, onFrame})` → `{scene({type,w,h,d, mood, shot, auto, power, mode, swing, xray, explode, dirt, frame:[x,y], frameM, cut}), attach(host), anchor(partId) → {x,y,on}, setModel, shot('hero'\|'close'\|'air'\|'inside'\|'wide'), auto, power, mode('cool'\|'dry'\|'fan'), swing, xray, explode(0–1), dirt(0–1), clean(), setMood, letterbox, sound(on) (WebAudio หลังคลิกเท่านั้น), frame, advance(sec), dispose, state, type, host}` · ตัวเครื่องจาก `units3d.buildUnit` (ไม่มียี่ห้อ) ขนาดจากสเปก — ★r15 สร้างครั้งเดียวต่อประเภทแล้วปรับขนาด (เปลี่ยนรุ่นในประเภทเดียวกันไม่สร้างใหม่) + สร้าง/คอมไพล์ประเภทอื่นล่วงหน้าตอนว่าง · `probe()` → `{type, dims, box:[x,y,z], parts}` (ใช้ตรวจครบทุกรุ่น) · ลม `airflow3d` · ทุกภาพ "แบบจำลองเพื่ออธิบาย" · คุณภาพ high = DOF+bloom+grade, mid = bloom+grade (จอสัมผัส/RAM ≤3 GB, 30 fps), low = grade | ผ่าน `stage.js` |
| `stage.js` ★09r12 | `createStage({mood, quality, bars, selector:'[data-stage]'})` → `{set(slot, patch), scene(slot), on(slot, 'frame'\|'active', fn), with(fn), boot(), cinema, active, failed}` — canvas เดียวย้ายไปช่องที่เห็นมากสุด (ตัดภาพ ไม่บินกล้อง) · ค่าที่ช่องไม่ได้ตั้งกลับเป็นค่าพื้นฐาน · โหลดเมื่อเบราว์เซอร์ว่างหรือแตะช่อง · ไม่มี WebGL = ภาพนิ่ง · `stageLabels(slot, stage)` → `{set([[partId, 'ชื่อ']])}` ป้ายชิ้นส่วน 2 คอลัมน์มีเส้นชี้ | `[data-stage]` ในหน้า |
| `showroom.js` ★09r12 | `mountShowroom(root, {stage, slot, ctl, start:{type}, onOpen(m,i), onBook(preset)})` → `{select(m,i), filter({type, btu}), current()}` — ประเภท/ยี่ห้อ/ขนาด/ค้นหา · ราคาเครื่อง + พร้อมติดตั้งมาตรฐาน (`installOptions`) · สเปก · ใส่ใบเสนอราคา (เครื่อง + ติดตั้งมาตรฐาน) · ปุ่มควบคุมภาพ | `#srRoot` + `#srStage` + `#srCtl` |
| `model3d.js` ★09r15 | `modelViewer(m, sku)` → element (ปุ่ม "ดูรุ่นนี้แบบ 3 มิติ" + เวที + ปุ่ม เปิด/ปิด โหมด สวิง 5 มุมกล้อง มองทะลุ แยกชิ้นส่วน ดูการล้าง เสียงลม(+สั่นบนมือถือที่รองรับ) + หมายเหตุขนาดตามสเปก/ขนาดทั่วไป) · `viewer(host)` → Promise<cinema> (ภาพยนตร์ 3 มิติตัวเดียวต่อหน้า ย้ายไปตามแผงสินค้า, ฉาก atelier/noir ตามสีพื้นหน้า, คุณภาพ mid / low บนจอสัมผัส) · `modelScene(m, sku)` → `{type,w,h,d,src}` · `hasGL()` | `productDetail` ใน commerce.js (ทุกแบบ) |
| `perfhud.js` ★09r15 | `openPerfHud({variant})` → `{box, min, close, summary(), results:{tour, models}, run:{tour(), models()}, stop()}` — แผงทดสอบความลื่น: ภาพ/วินาที · เฟรมช้าสุด 5% · สะดุด (> 50 ms) · หน้าค้าง (long task) · ฉาก 3 มิติ live/งบ · ระดับความละเอียด · ข้อผิดพลาด · กราฟเวลาเฟรม · ทัวร์อัตโนมัติทุกส่วน (กดปุ่มภาพ 3 มิติทุกตัว ไม่แตะตะกร้า/จอง/ลิงก์) · ไล่ดูครบทุกรุ่น (705) · ล็อกความละเอียด · "ส่งผลให้ทีม" (เปิดฟอร์มความเห็นพร้อมผล — ไม่ส่งเอง) | ปุ่ม "ทดสอบความลื่น" ในแถบ Beta ทุกแบบ (`feedback.perfButton`) หรือ `#perftest` ท้ายลิงก์ |
| `concierge.js` ★09r12 | `PLACES`, `NEEDS` · `mountConcierge(root, {stage, slot, labels, place, onBook, onShop({type,btu}), onPrices(tab)})` — สาเหตุที่พบบ่อยต่อเรื่อง (`CAUSES`: ข้อความ + ฉาก + ป้าย) · กติกาแนะนำ: ถึงรอบ/กลิ่น/ค่าไฟ หรือ ไม่เย็น/น้ำหยดที่ล้างเกิน 6 เดือน → ล้าง (C2 เมื่อเกิน 1 ปีและมีอาการ) · ล้างไม่เกิน 6 เดือน/เสียงดัง/ไฟ → ตรวจวินิจฉัย (ไม่ซ่อมก่อนอนุมัติ) · ซื้อใหม่ → `recommendBtu` + ค่าติดตั้ง · ย้าย → ประเมินหน้างาน · หลายเครื่อง → `estimateContract` | `#askRoot` + `#askStage` |
| `filmscenes.js` ★09r16 | `stepsOf(spec)` → `[{t, d, why?, get?, form?, who?}]` (ไม่สร้าง WebGL) · `makeScene(spec, host, {theme, mood, quality})` → `{kind, api, go(i), busy?(), dispose(), disposable}` · spec.kind: `unit` (shots) · `cycle` (type) · `story` (story C1\|C2\|install\|repair, tier) · `crew` (job clean\|install, type, level, pkg) · `room` (type, shots) · `materials` · `map` (shots) · `UNIT_SHOTS`, `ROOM_SHOTS`, `MAP_SHOTS` |
| `film.js` ★09r16 | `mountFilm({stage, theme, mood, quality, autoplay, onStep(ch,i,step), onDone(ch), onBuilt(ch)})` → `{chapters, byId, go(id,i), play(id), stop(id), scene(id)}` — `[data-film]` + `.fm-stage` (+ `.fm-track` สำหรับ progress) · เติม `.fm-shots` · `.fm-sub` · `[data-count]` · `[data-prog]` · `[data-detail]` · `.fm-ctl` · คลาส `is-titled` `is-on` `is-live` `is-loading` `no-gl` `is-playing` · สร้างฉากทีละฉากใกล้สุดก่อน · มือถือ/RAM ≤4 GB คืนฉากที่ไกล 4 จอ |
| `filmfx.js` ★09r16 | `kinetic(root)` (`[data-kinetic]` แตกคำไทยด้วย Intl.Segmenter) · `grain(el)` (`.fx-grain`) · `sound(on)` · `tone('tick'\|'step'\|'done'\|'badge')` |
| `filmsell.js` ★09r16 | `cleanPanel(root, {onBook, onPrices, onBusiness, start})` · `installPanel(root, {onBook, onShop, start})` · `roomPanel(root, {onShop, use})` · `repairPanel(root, {onPrices})` · `qualityPanel(root, {onInstall})` · `businessPanel(root, {onCatalog})` (async) · `areaPanel(root, {onZone})` — ราคาจาก `cleanRate`/`installRows`/`recommendBtu`/`diagnosis`/`VOLUME_TIERS` ใส่ `cart` รูปแบบเดียวกับทุกแบบ |
| `filmsite.js` ★09r16 | `mountFilmSite({variant, theme, mood, quality, bars, place, srStart, autoplay, onStep, onDone, onBuilt})` → `{stage, film, book, go, openPrices, openProduct, showroom, shop, panels, cart, toast, sound}` · `[data-sell][data-start='{…}']` ตั้งค่าเริ่มของแผง · `[data-spy]` ลิงก์ได้ `aria-current` · `--hd` ความสูง header · ตั้ง `html.film-on` เมื่อพร้อม |
| `v2site.js` ★09r12 | `mountV2({variant, mood, quality, bars, place, theme, srStart})` → `{stage, book(preset), go(sel), openPrices(tab), showroom(), cart, toast}` — header/เมนู · ตะกร้า · จองคิว · drawer ราคา/สินค้า · ลองวางในห้อง · บทล้าง/ติดตั้ง/ซ่อม (ราคาในตาราง → ใบเสนอราคา) · แท็บองค์กร · พื้นที่ · FAQ · ฟอร์มติดต่อ · ใส่ class `v2-on` เมื่อพร้อม | a2/b2/c2/d2 |
| `v3site.js` ★09r13 | `PAGES` (9 หน้า: th, lead, ids) · `mountV3({variant, navFmt, hubLabel})` → `{site, ensure(view)}` — ตะกร้า · จองคิว · FAQ · drawer สินค้า/เทียบ พร้อมทุกหน้า · โมดูลของแต่ละหน้า mount เมื่อเปิดหน้าครั้งแรก (`ensure`) · ลิงก์ `[data-pc]` → หน้าราคาแท็บนั้น · `[data-from]`/`[data-from-buy]`/`[data-models]`/`[data-minbill]` เติมราคาเริ่มต้นจาก SERVICES/DEMO/DATA · ใส่ class `v3-on` เมื่อพร้อม | a3/b3/c3 |
| `dstudio.js` ★09r11 | `whenNear`, `onDemand`, `mountCleanChapter(root, {onPick})` (C1/C2 จาก `METHOD_INFO` + ขั้นตอน `cleanSteps` + ตารางราคาต่อเครื่องจัดกลุ่มตามประเภท + เทียบแพ็กเกจ `PKG_INFO`) · `mountInstallChapter(root, {onPick})` (ราคา `installRows` + `installSteps` + `materialTable`) · `mountRepairChapter(root, {onAll})` (`repairSteps` + ค่าตรวจ + ตัวอย่างราคาซ่อม) · `wireContactForm(form, {variant})` (ticket ประเภท inquiry) · `fillFacts()` | `d.html` |
| `site.js` ★09r5 | `VIEWS`, `JOURNEYS` · `mountSite({variant, views:{home,shop,service,business,knowledge,contact: [section ids]}, order, navFmt, labels, hooks:{clean,install,repair}, openCart, openModel(m), priceItem(tab, q)})` → `{go(id), view(), startJourney(k), openFeedback(), openSearch()}` · ★r6 ค้นหาทั้งเว็บ (ปุ่ม header + `/`), แถบข้อเท็จจริงต่อหน้า (`FACTS`), การ์ดเส้นทางมีราคาเริ่มต้น · section ที่อยู่ในหน้าอื่นถูกซ่อน (`data-sx` + `hidden`) — ลิงก์ `#id`, เมนู, `scrollIntoView()` ทุกที่สลับหน้าให้เอง · back/forward ใช้ได้ · `localStorage['sbp-journey-v1']` | เรียกท้าย script ของ a/b/c (หลัง mount ทุกโมดูล) · ⚠️ ห้ามใช้ attribute `data-view` กับ section (โมดูลอื่นใช้ชื่อนี้) | · ★r13 ตัวเลือก `viewDefs` (เพิ่ม/เปลี่ยนชื่อหน้า {id:{th,lead}}), `facts`, `next` (ต่อหน้า), `hubLabel` · `<figure data-sx-photo="<view>">` ในหน้า → ย้ายเข้าหัวเรื่องของหน้านั้น · เส้นทาง install/repair รองรับ `installflow` / `ask` (ถ้าไม่มีใช้ `cleanflow` / `howto` เหมือนเดิม)
| `typeset.js` ★09r18 | `thaiPhrases(sel, root?)` — ข้อความไทยใน element ที่เลือก: วลีที่คั่นด้วยช่องว่างเป็น `<span class="thp">` (inline-block ใน shared.css) ย้ายขึ้นบรรทัดใหม่ทั้งวลีเมื่อพอดี ยาวกว่าบรรทัดก็ยังตัดในวลีได้ (ไม่ล้น) · ทำครั้งเดียวต่อ element (`data-thp`) · `zoneMarks(root?)` — `.sx-jump a[href^="#"]` ลำดับที่ n → ★r20 `data-sec-n="n"` (เดิม `data-zone`) บน section ปลายทาง และ `.sec-h .eyebrow` ของ section นั้น (แต่ละแบบเลือกแสดงเอง) | a/b/c ท้าย script: `thaiPhrases('.sx-vh h1, .sx-lead, .sec-h h2, .sec-h h2 + p, #start .sx-int h3, #start .sx-int-s, .sx-next h2')` (B เพิ่ม `.sheet-h h2`, `.sheet-h h2 + p`) + `zoneMarks()` |
| `icons.js` ★09r6 | `icon(name, {size, label, cls})` → `<svg>` (aria-hidden ถ้าไม่มี label) · `iconLabel(btn, name, text)` · ชื่อ: play pause check info warn star sign x plus minus compare external phone mail copy clock search pin | ทุกปุ่ม/สถานะที่เคยใช้ตัวอักษรสัญลักษณ์ (▶ ❚❚ ✓ ★ ✍) |
| `product-media.js` ★09 | `loadMedia()`, `photosFor(m, sku)`, `hasPhoto`, `productShots()` (WebGL ชั่วคราว 1 ตัว แล้วคืน), `productVisual(m, sku, {size: card\|detail\|thumb, tag})` | `await loadMedia()` หลัง loadData |
| `roomfit.js` ★09 | `FIT_RULES`, `throwFor(type, btu)`, `unitDims(type, btu, spec)`, `fitCheck(state)` (pure), `mountRoomFit(root, {theme, onOpenModel})` → `{setModel(m, i), state, check}` | `#fitRoot` ทุกแบบ · ปุ่ม "ลองวางในห้องของคุณ" ใน productDetail (`onFit`) |
| `roomfit3d.js` ★09 | `wallFrame(wall, W, L)`, `createRoomFit3D(container, {theme})` → `{set(state, result), view('iso'\|'top'\|'front'), kick, snapshot, dispose}` | lazy จาก roomfit |
| `knowledge.js` ★09 | `GUIDES`, `mountKnowledge(root, {ids})` (ids = map key เครื่องมือ → id section ของแต่ละแบบ) | `#learnRoot` |
| `gl-pool.js` ★09 (r8, r15) | `track(renderer, el, {scene, redraw, name, onScale(pr)})` → `{release(), move(el)}` (หุ้ม `renderer.render` ให้วาดเฉพาะตอน live, สร้าง env map ใหม่หลัง restore, ล้าง dispose listener เก่า, จำกัด pixel ratio บนจอสัมผัส `PR_CAP`) · `glBudget()` → `{max, live, total}` · ★r8 `disposeDeep(root, keepMaterials)` · ★r15 **ความละเอียดปรับเอง** (วัดเฟรมที่มาช้า > 1 ใน 6 → ลด pixel ratio ทีละขั้น 100/85/72/60% ไม่ต่ำกว่า 0.75 · นิ่ง 8 วิ → เพิ่มกลับ · `onScale` ให้ฉากที่มี post chain/ขนาดจุดตามตาม) · **เฟรมแรกคอมไพล์ shader แบบขนาน** (`compileAsync` + `KHR_parallel_shader_compile` — canvas รอแบบมองไม่เห็นแล้วค่อยปรากฏ · เบราว์เซอร์ที่ไม่มี extension วาดทันทีแบบเดิม) + คอมไพล์ทุกอย่างในฉาก (รวมส่วนที่ซ่อน) ตอนผู้ใช้หยุดแตะ · ปิด `checkShaderErrors` นอกการทดสอบอัตโนมัติ · `glStats()` `glLock(level\|null)` `GL_STEPS` (แผงทดสอบ) · `warm(renderer, scene, camera, obj, target?)` วาดฉากหนึ่งครั้งให้ obj คอมไพล์ด้วยสภาพจริง (แสง/clipping/tone mapping) · `whenIdle(fn)` `whenCalm(fn, quiet)` (รอว่าง + ไม่มีการแตะ/เลื่อน · คิวเดียวทั้งหน้า ทำทีละงาน ไม่เริ่มใน 3 วิแรก) · `glFocus(el\|null)` (แผงสินค้าแสดง 3 มิติ → ฉากด้านหลังหยุดวาดชั่วคราว) · `disposeLater(root, keep)` (คืนหลังวาดของใหม่ 2 เฟรม — โปรแกรม shader ไม่ถูกลบแล้วคอมไพล์ซ้ำ) · `freeGeometry(root)` · `warmHidden(renderer, scene, camera, target?)` | เรียกใน `createACViewer`, `createRoomSim`, `createStage`, howitworks, materials, studio, throwsim, thaimap, roomfit3d |
| `wisp3d.js` ★09r3 | `createWisps(parent, {max, additive})` → `{begin, seg(x0..z1, r,g,b, a0,a1, w0,w1), end, mesh, setAdditive, dispose}` · `createHaze(parent, {max})` · `airTint(rgb, dark)` · `swirl(x,y,z,t,seed,out)` | ใช้ใน airflow3d, howitworks3d (SheetFlow/RadialFlow), ac3d (makeFlow) |
| `airflow3d.js` ★09r3 | เดิม + ประวัติตำแหน่ง (`hist`) วาดเป็นเส้นลม · `timeScale` (0.6 = แสดงช้ากว่าจริง) · `haze` · ความปั่นป่วนวาดตอนแสดงผล (ไม่แตะฟิสิกส์ → ระยะลมเท่าเดิม) · `prewarm(steps, dt)` | studio3d, throwsim3d, system3d, techstory, roomfit3d, jobscene3d · ★r4 `set({louver: null|0…1, hswing})` ตำแหน่งบานคงที่ / สวิงซ้ายขวา (ค่าเริ่มต้นเท่าเดิม) |
| `roomplan.js` ★09r3 (r7: +`meetingL` `cabinet` `gondola` · ห้องตัวอย่างเพิ่มของตามขนาดห้อง — ออฟฟิศเป็นแถวโต๊ะ ร้านเป็นทางเดินชั้นวาง) | `FURN`, `FURN_GROUPS`, `PRESETS`, `frame2`, `footprint`, `clampItem`, `overlaps`, `against`, `newId`, `presetLayout(id,W,L)`, `freeSpot(k,list,W,L,avoid)`, `layoutChecks(S,{t,d,thr,add})` | ไม่มี DOM — ทดสอบด้วย node ได้ |
| `roomfit3d.js` ★09r3 | + `select(id)` · opts `onEdit(kind, live)`, `onPick(id)`, `actions{rotate, remove, nextWall}` · `set(S, R, {live})` (ระหว่างลากไม่ settle ลมใหม่) | ลากเฟอร์นิเจอร์บนพื้น / หน้าต่าง-ประตูตามผนัง / แอร์ตามผนัง (สี่ทิศทาง: บนฝ้า) · คีย์บอร์ด ลูกศร/R/Delete/Esc |
| `siteplan.js` ★09r7 | `BUILDINGS`, `CEILINGS`, `WALL_MATS`, `ROUTES`, `OUT_LOCS`, `DRAINS`, `HATCHES`, `STOREY` (3 ม./ชั้น), `REACH` (3 ม.), `siteDefault()`, `routeDefault()`, `outdoorDefault()`, `perimPath`, `unitPort(S)`, `defaultExit(S)`, `routePlan(S)` → `{mode, asked, port, exit:{wall,along,y}, pts, kinds, by:{trunk,ceil,chase,up}, inLen, hole, outdoor:{along,baseY,valveY,aboveGround,loc}, outLen, total, rise, needPump}`, `siteWorks(S, plan)` → `[{code, th, qty, unit, why, kind: price\|survey\|opt\|warn\|info}]`, `resizeLayout(items, W0, L0, W1, L1)`, `encodeLayout(S)` / `decodeLayout(code)` (รหัส `SBP1.` + base64url), `dropFor(loc, exitY, H, floor)` | ไม่มี DOM/three — ทดสอบด้วย node ได้ · ราคาไม่อยู่ในไฟล์นี้: `roomfit.fitCheck` ดึงจาก `DATA.instByCode[code].ex` เฉพาะรายการที่ Pricebook มีราคา ที่เหลือแสดง "ประเมินหน้างาน" |
| `roomfit.js` ★09r7 | state เพิ่ม `site {building, floor, ceiling, plenum, wallMat, hatch{mode,x,z}, db, ext:[ผนังภายนอก]}` (ext เดาจากผนังที่ติดแอร์ + ผนังที่มีหน้าต่าง + หน้าร้าน จนกว่าลูกค้ากดเอง · ผนังภายในเจาะออกไม่ได้ → ท่อเดินไปผนังภายนอกให้อัตโนมัติ) · `route {mode, exit}` · `outdoor.loc` (+ `auto` ฐานตามตำแหน่ง, `sideSet`) · `drain` · `fitCheck` คืน `plan` + `works` (ความยาวท่อจากแนวท่อจริง) · คืน `{…, code(), open(code)}` | ส่วน 2 ห้องและอาคาร · 4 แนวท่อ/น้ำทิ้ง/ไฟ · 5 คอยล์ร้อน 6 ตำแหน่ง · 6 ผลตรวจ + งานเพิ่ม + "ส่งแบบห้องให้ทีมประเมิน" (`handoffBox` + รหัสแบบห้อง) · ปรับขนาดห้อง: ห้องตัวอย่างจัดใหม่ตามขนาด / ห้องที่จัดเองคงตำแหน่งสัมพัทธ์ |
| `roomfit3d.js` ★09r7 | `view('out')` มุมด้านนอก · ฝ้า 3 แบบ (เรียบ / ตาราง T-bar 60 ซม. / ปูนเปลือย) + กรอบช่องเหนือฝ้า · ช่องเซอร์วิสลากได้ (`'hatch'`) · จุดเจาะท่อลากได้ทุกผนัง (`'exit'`) · แนวท่อตามชนิด (ราง / เหนือฝ้า / ฝังผนัง) · คอยล์ร้อนตามตำแหน่ง (ระเบียง+ราวกันตก · แท่นวาง+บังตาระแนง · ขาแขวน · ที่สูง+ผนังอาคารชั้นล่าง · หลังคา · ฐานพื้นดิน) · ท่อน้ำทิ้ง + ปั๊ม · คนสูง 1.70 ม. ทุกห้อง · ป้ายขนาดห้อง · ป้ายไม่ทับกัน · ลากแอร์/หน้าต่าง/ประตูเลยมุม → ผนังถัดไป | onEdit kind เพิ่ม `'hatch'`, `'exit'` |
| `business.js` ★09r9 | `USP`, `SCEN`, `mountAmc(root, {hl})` (จุดเด่น 6 ข้อ + ตารางราคาขั้นบันไดพร้อมตัวอย่างงบ + เทียบแพ็กเกจ P1/P2/P3) · `mountSop(root, {hl})` (สัญญาหนึ่งปี 6 ขั้น + ขั้นตอนต่อเครื่องจาก `cleanSteps` เลือกประเภท/วิธี/แพ็กเกจ + ตัวอย่าง Service Report + เงื่อนไขสัญญา) · `mountProjects(root, {hl, onCatalog})` → `{set('new'\|'reno'\|'replace')}` (ขั้นตอนงาน + ประมาณการทีละห้อง: `recommendBtu` → ติดตั้งมาตรฐาน + ชุดท่อส่วนเกินจาก Pricebook + รายการประเมินหน้างาน → ใส่ใบเสนอราคา / ขอสำรวจ) | `#amcRoot` `#sopRoot` `#projRoot` (หน้า "สำหรับองค์กร") · สไตล์ `assets/business.css` |
| `jobguide.js` ★09r4 | `JOB_TYPES`, `TEAR`, `TRAY`, `DIRT0`, `cleanTimeline(type, level, pkg)`, `installTimeline(type, lv)` → `[{step, who:[lead, asst], state, done?}]` · `mountJobGuide(root, {theme, start, type, job})` → `{setJob, setLevel, setType, go, steps, advance, busy, ready}` (alias `mountCleanGuide`) | `#cleanRoot` ทุกแบบ: A `wall` · B `ceiling` · C `cassette` |
| `jobscene3d.js` ★09r4 | `createJobScene(container, {theme, type, job, onFrame})` → `{setType, setJob, show(state, {jump}), reset, busy, project, anchors, advance, dispose}` · state: `crew:[{s: spot, a: act, t: tool}×3]`, `beats:[{t, crew, set}]`, `off`, `dirt`, `spray:{by, at, chem}`, ค่าติดตั้ง `unitK/outK/pipeK/trunkK/drainK/wireK/gauges/n2/vac/needle` | lazy จาก jobguide · ชิ้นส่วนที่ถอดเดินทาง ช่าง→ผู้ช่วย→โต๊ะ (และกลับตอนประกอบ) อัตโนมัติจาก `off` |
| `crew3d.js` ★09r4 | `buildLadder(h)`, `createCrew(parent, {route, at, customer})` → `{go(i, spec), place(i, spec), tick, hand(i, side), mid(i), busy(i), toolTip(i, name), visible, dispose}` · spec `{x, z, face, act, tool, ladder:{at, face, top, lean}}` | สมาชิก 0 ช่างหัวหน้า · 1 ผู้ช่วย · 2 ลูกค้า |
| `brand3d.js` ★09r4 | `drawFujiva`, `drawSbp`, `matTex(dark)`, `chestTex`, `backTex`, `boxTex`, `bagTex`, `cardTex`, `decal(tex, w, h, o)` | jobscene3d, crew3d, tech3d (ป้ายเสื้อ) |
| `throwsim3d.js` ★09r4 | `createThrowSim(container, {theme, onReach, onStats, onSupply})` → `{setType('wall'\|'ceiling'\|'cassette'\|'floor'), setControl({power, mode, temp, fan, louver, hswing, dirty})}` · `mountThrowSim(root, {theme, type, style: 'remote'\|'panel'\|'glass', fallback})` | ผ่าน `mountHowItWorks(root, {throwStyle})` A remote · B panel · C glass |
| `units3d.js` ★09 | + `buildFloorUnit(M, {w,h,d, interior})` (★r4 interior: ฝาหน้า แผ่นกรอง ใบพัด โข่งลม คอยล์ ถาด ถอดได้) · `buildWallUnit` ใช้ตัวเครื่องโค้งพรีเมียม (ไม่มีโลโก้) เป็นค่าเริ่มต้น ยกเว้นสไตล์ blueprint | |

### 4.2 Schema ของ `assets/sbp-data.json` (ข้อมูลอัดแน่นด้วย string pool)

```jsonc
{
  "v": "SBP Pricebook 2569 · ดึงจาก…Final จริง · 29.09.2569 · public (standard rates only, approved models only)",
  "pf": ["type","brand","model","btu","priceExVat","installStdExVat","approved","series","system","refrigerant","pipeLiquid",
         "pipeGas","indoorDim","indoorKg","outdoorDim","outdoorKg","power","compressor","warranty","lead","outdoorModel","maxPipe","maxLift"],
  "pool": ["ME-Series", "..."],            // 1,216 สตริงที่ใช้ซ้ำ; ตัวเลขในแถว = index ใน pool, -1/null = ไม่มีค่า
  "prods": [["wall","AUX","ASW-09/DIM-1S",9500,7800,3800,1, 0,1,2,…]],     // 705 แถว ตามลำดับ pf; ราคา = ก่อน VAT
  "inst":  [["INS-W-9000-12000-STANDARD", catIdx, "ชื่อ", unitIdx, 3800|null, incIdx, excIdx, warrantyIdx, surveyIdx]],   // 173 แถว
  "clean": [[pkgIdx,"C1",typeIdx,rangeIdx,unitIdx, 650, null, null, wIdx, careIdx, docIdx, incIdx, excIdx, stIdx, "ชื่อ"]], // 234 แถว (sp, pj = null เสมอ)
  "rep":   [[catIdx,"ชื่อ",unitIdx, 850|null, null, null, wIdx, incIdx, excIdx, stIdx]],                               // 86 แถว
  "minBill": 4500                          // ยอดขั้นต่ำงานล้างต่อการเข้าหน้างาน (ก่อน VAT)
}
```
- `inst` มี 173 แถว (ตัด -MASS 21 ออกตั้งแต่ไฟล์) → `loadData()` ซ่อน `MAT-CU-L-*` อีก 6 → **เว็บแสดง 167 รายการ** · ไม่มีราคา 68 แถว (แสดง "ประเมินหน้างาน")
- `rep` ไม่มีราคา 30 แถว · `prods` อนุมัติแล้วทั้งหมด (9 รุ่นราคาอ้างอิงตลาดไม่อยู่ในไฟล์)
- `internal/sbp_real.json` (ภายใน) = `{prods[714], inst[194], clean[468], rep[86]}` แบบ object เต็ม มี `sp`/`pj` (อัตราพิเศษ/โครงการ) — **ใช้กับ tools_recon.py เท่านั้น**

### 4.3 โค้ดกฎธุรกิจที่ห้ามพัง (ตัดจาก `sbp-core.js` ตามจริง)

```js
// sbp-core.js บรรทัด 1–8
// SBP AirCare prototype core — shared data + business logic (no rendering).
// Data source: assets/sbp-data.json, extracted from the company's approved price files
//   "ใบเสนอราคาติดตั้งแอร์ Final จริง.xlsx" (714 models, 194 install/add-on items)
//   "ใบเสนอราคาล้างและซ่อม Final จริง.xlsx" (cleaning pricebook 3 packages × C1/C2, 86 repair items)
// All source prices are before VAT. The site shows VAT-inclusive prices first, with the pre-VAT figure beside it.

export const VAT = 0.07;
export const incVat = n => Math.round(n * (1 + VAT));
```

```js
// sbp-core.js บรรทัด 52–60 (ภายใน loadData) — ตัวกรองและการแปลงข้อความที่บังคับคำตัดสินเจ้าของ
  // install + add-on items
  // Owner decision (Rev.07): the web sells Standard + Premium installation only (premium-grade materials in every job);
  // the Basic/MASS tier stays in the Pricebook for the sales team. Copper brand shown as O-TWO (Pricebook to be updated to match).
  // Rev.08 owner decision: the web shows one copper spec only — O-TWO 0.70 mm. Type L / project-grade copper stays in the Pricebook (QTN/BOQ work) but is not listed on the web.
  const brand = t => t == null ? t : t.replace(/K Copper Type L/g, 'O-TWO').replace(/K Copper/g, 'O-TWO').replace(/ท่อน้ำยาทองแดง 0\.70 มม\./g, 'ท่อน้ำยาทองแดง O-TWO 0.70 มม.').replace(/ท่อ Type L หรือ Project-grade ใช้เมื่อระบุใน QTN\/BOQ;\s*ไม่รวมอัตโนมัติหากไม่ระบุ;\s*/g, '');
  DATA.inst = j.inst.map(([c, cat, n, u, p, inc, exc, w, sv]) => ({ code: c, cat: S(cat), name: brand(n), unit: S(u), ex: p, inc: brand(S(inc)), exc: S(exc), warranty: S(w), survey: S(sv) })).filter(i => !/-MASS$/.test(i.code) && !/^MAT-CU-L-/.test(i.code));
  DATA.instByCode = Object.fromEntries(DATA.inst.map(i => [i.code, i]));
  DATA.clean = j.clean.map(([pk, lv, ty, rg, u, s, sp, pj, w, care, doc, inc, exc, st, n]) => ({ pkg: S(pk), level: lv, ty: S(ty), type: TYPE_FROM_CLEAN[S(ty)] || null, range: S(rg), unit: S(u), rate: { s, sp, pj }, warranty: S(w), care: S(care), doc: S(doc), inc: S(inc), exc: S(exc), status: S(st), name: n }));
  DATA.rep = j.rep.map(([ty, n, u, s, sp, pj, w, inc, exc, st]) => ({ cat: S(ty), name: n.replace(/^ซ่อมแอร์:\s*/, ''), unit: S(u), rate: { s, sp, pj }, warranty: S(w), inc: S(inc), exc: S(exc), status: S(st) }));
```

```js
// sbp-core.js บรรทัด 202–235 (ค่าเดินทาง) และ 274–280 (อัตรามาตรฐานเท่านั้น + กำลังทีม)
// Travel rule outside the 5 core provinces — modelled on published fees of Thai AC service shops (market survey 29 ก.ย. 2569):
// 300 flat for the next ring (e.g. +300 นครปฐม/สมุทรสาคร), 800 for 61–80 km bands, 5–10 บาท/กม. beyond a free radius,
// ~3,000/day for 150–200 km jobs. Amounts are before VAT, per trip (one-way road km from HQ).
// waiveAt / minUnits are cost-based proposals (no shop publishes them) — owner to confirm.
export const TRAVEL = {
  roadFactor: 1.35,
  bands: [
    { id: 'Z1', maxKm: 60, fee: () => 300, waiveAt: 4, minUnits: 1, th: 'ไม่เกิน 60 กม.' },
    { id: 'Z2', maxKm: 100, fee: () => 800, waiveAt: 8, minUnits: 3, th: '61–100 กม.' },
    { id: 'Z3', maxKm: 150, fee: () => 1500, waiveAt: null, minUnits: 5, th: '101–150 กม.' },
  ],
  maxKm: 150,
  perKm: 10,
  farDay: 3000,
  source: 'สำรวจราคาที่ร้านแอร์ในไทยประกาศบนเว็บ 18 แหล่ง (29 ก.ย. 2569)',
};
export const TIER_TH = {
  core: { th: 'อยู่ในพื้นที่ให้บริการ', note: 'กรุงเทพฯ และปริมณฑล ไม่มีค่าเดินทางเพิ่ม' },
  extended: { th: 'รับงานได้ มีค่าเดินทางเพิ่ม', note: 'นอกกรุงเทพฯ และปริมณฑล คิดค่าเดินทางต่อเที่ยวตามช่วงระยะทางจากสำนักงานใหญ่ ยกเว้นเมื่อจำนวนเครื่องถึงเกณฑ์' },
  out: { th: 'เกินระยะให้บริการ', note: 'เกินระยะที่รับงานรายเครื่อง ฝากข้อมูลไว้เพื่อประเมินเป็นงานโครงการหรือสัญญา' },
  unknown: { th: 'ไม่พบชื่อพื้นที่นี้', note: 'ลองพิมพ์ชื่อเขตหรืออำเภอ หรือให้ทีมตรวจสอบจากที่อยู่จริง' },
};
const norm = s => (s || '').replace(/\s|เขต|อำเภอ|อ\.|จังหวัด|จ\./g, '').toLowerCase();
const hav = (a, b, c, d) => { const R = 6371, t = x => x * Math.PI / 180; const dl = t(c - a), dn = t(d - b); const s = Math.sin(dl / 2) ** 2 + Math.cos(t(a)) * Math.cos(t(c)) * Math.sin(dn / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(s)); };
export function travelFor(km) {
  const band = TRAVEL.bands.find(x => km <= x.maxKm);
  return band ? { fee: band.fee(km), band, minUnits: band.minUnits, waiveAt: band.waiveAt } : null;
}
// fee actually charged for a job with `units` machines (waived at volume); returns { fee, waived, short }
export function travelCharge(zone, units = 1) {
  if (!zone || zone.tier !== 'extended') return { fee: 0, waived: false, short: 0 };
  const waived = !!(zone.waiveAt && units >= zone.waiveAt);
  return { fee: waived ? 0 : zone.fee, waived, short: Math.max(0, (zone.minUnits || 1) - units) };
}
// …
// Public site shows the STANDARD rate only. Special / project rates need conditions + approval (Approval Matrix)
// and are never sent to the browser — the sales team offers them in the formal quotation.
export const VOLUME_LEVELS = [ { min: 0, key: 's', th: 'อัตรามาตรฐาน' } ];
export const VOLUME_HINT = 10;   // from this many units the page says "may qualify for a special rate — confirmed in the quotation"
// Crew productivity per team-day for standard cleaning (C1) — company manual §1.9 (SBP-GRW-001): wall 20–25, ceiling/cassette 12–16 → mid-points.
// Floor-standing uses the ceiling/cassette range; ducted uses its lower bound (no separate figure in the manual).
export const PRICING = { unitsPerTeamDay: { wall: 22, ceiling: 14, cassette: 14, floor: 14, duct: 12 } };
```

### 4.4 `build.py` (โค้ดเต็ม)

```python
#!/usr/bin/env python3
"""Build self-contained single-file versions of the SBP AirCare prototypes.

Each variant (a/b/c) becomes ONE html file: CSS inlined (fonts as data URIs), all JS modules
(incl. three.js and the lazily imported 3D studio) bundled by esbuild into one inline module,
price data inlined as globalThis.__SBP_DATA. No fetch, no relative links needed.

Outputs (dist/):
  offline/{a,b,c,index}.html   full documents, open by double-click (links between them work)
  art/{a,b,c}.html             same page for the Artifact tool (links -> artifact URLs from urls.json)
  art/index.html               A/B/C tester with the three variants embedded (gzip+base64, srcdoc)
usage: python3 build.py [--urls urls.json]
"""
import base64, gzip, json, os, re, subprocess, sys

ROOT = os.path.dirname(os.path.abspath(__file__))
A = os.path.join(ROOT, 'assets')
DIST = os.path.join(ROOT, 'dist')
os.makedirs(os.path.join(DIST, 'offline'), exist_ok=True)
os.makedirs(os.path.join(DIST, 'art'), exist_ok=True)
URLS = {}
if '--urls' in sys.argv:
    URLS = json.load(open(sys.argv[sys.argv.index('--urls') + 1]))

def read(p): return open(p, encoding='utf-8').read()

def css_inline(name):
    css = read(os.path.join(A, name))
    def dataurl(m):
        f = os.path.join(A, m.group(1))
        b = base64.b64encode(open(f, 'rb').read()).decode()
        return f"url(data:font/woff2;base64,{b})"
    return re.sub(r'url\((fonts/[^)]+\.woff2)\)', dataurl, css)

def bundle(js, name):
    entry = os.path.join(ROOT, f'_entry_{name}.mjs')
    open(entry, 'w', encoding='utf-8').write(js)
    try:
        out = subprocess.run(['npx', '--yes', 'esbuild@0.28.2', entry, '--bundle', '--format=esm', '--minify',
                              '--target=es2022', '--legal-comments=none', '--log-level=warning'],
                             cwd=ROOT, capture_output=True, text=True, check=True).stdout
    finally:
        os.remove(entry)
    return re.sub(r'</script', r'<\\/script', out, flags=re.I)

DATA = read(os.path.join(A, 'sbp-data.json'))
DATA_TAG = '<script>globalThis.__SBP_DATA=' + DATA.replace('</', '<\\/') + '</script>'
THGEO = read(os.path.join(A, 'thai-provinces.json'))
DATA_TAG += '<script>globalThis.__SBP_TH=' + THGEO.replace('</', '<\\/') + '</script>'
# official brand logo files (only when supplied with the brand owner's permission): assets/logos/<key>.png → globalThis.__SBP_LOGOS
LOGO_DIR = os.path.join(A, 'logos')
if os.path.isdir(LOGO_DIR):
    logos = {}
    for f in sorted(os.listdir(LOGO_DIR)):
        k, ext = os.path.splitext(f)
        if ext.lower() in ('.png', '.webp', '.svg'):
            mime = {'.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml'}[ext.lower()]
            logos[k.lower()] = f'data:{mime};base64,' + base64.b64encode(open(os.path.join(LOGO_DIR, f), 'rb').read()).decode()
    if logos:
        DATA_TAG += '<script>globalThis.__SBP_LOGOS=' + json.dumps(logos) + '</script>'
VNAME = {'a': 'A · Bento', 'b': 'B · Engineering', 'c': 'C · Showroom'}

def build_variant(v):
    html = read(os.path.join(ROOT, f'{v}.html'))
    # stylesheets -> inline
    html = re.sub(r'<link rel="stylesheet" href="assets/([\w.-]+\.css)">', lambda m: f'<style>{css_inline(m.group(1))}</style>', html)
    # the one module script -> bundled inline module
    m = re.search(r'<script type="module">(.*?)</script>', html, flags=re.S)
    assert m, v
    js = bundle(m.group(1), v)
    html = html[:m.start()] + DATA_TAG + '<script type="module">' + js + '</script>' + html[m.end():]
    assert 'assets/' not in re.sub(r'<script type="module">.*?</script>', '', html, flags=re.S) or True
    return html

def links(html, mode):
    """mode offline: keep ./a.html etc (hub -> index.html). art: artifact URLs in a new tab. embed: tell the parent tester."""
    if mode == 'offline':
        return html.replace('href="./"', 'href="./index.html"').replace('<body>', '<body><script>globalThis.SBP_HUB="./index.html"</script>', 1)
    if mode == 'art':
        for v in 'abc':
            u = URLS.get(v)
            html = html.replace(f'href="./{v}.html"', f'href="{u}" target="_blank" rel="noopener"' if u else 'href="#"')
        u = URLS.get('index')
        html = re.sub(r'(<body[^>]*>)', lambda m: m.group(1) + '<script>globalThis.SBP_HUB=' + json.dumps(u or '') + '</script>', html, count=1)
        return html.replace('href="./"', f'href="{u}" target="_blank" rel="noopener"' if u else 'href="#"')
    # embed inside the tester: variant links switch the tester's tab
    for v in 'abc':
        html = html.replace(f'href="./{v}.html"', f'href="#" data-sbp-go="{v}"')
    html = html.replace('href="./"', 'href="#" data-sbp-go="hub"')
    html = re.sub(r'(<body[^>]*>)', lambda m: m.group(1) + '<script>globalThis.SBP_HUB=""</script>', html, count=1)
    hook = "<script>document.addEventListener('click',e=>{const a=e.target.closest('[data-sbp-go]');if(!a)return;e.preventDefault();try{parent.postMessage({sbpGo:a.dataset.sbpGo},'*')}catch(_){}});</script>"
    return html.replace('</body>', hook + '</body>')

def strip_doc(html):
    """Artifact pages are wrapped in a skeleton at publish time: keep head styles/meta-less content + body."""
    head = re.search(r'<head>(.*?)</head>', html, flags=re.S).group(1)
    head = re.sub(r'<meta[^>]*>', '', head)
    title = re.search(r'<title>(.*?)</title>', head, flags=re.S)
    head = re.sub(r'<title>.*?</title>', '', head, flags=re.S)
    body_m = re.search(r'<body([^>]*)>(.*)</body>', html, flags=re.S)
    attrs, body = body_m.group(1), body_m.group(2)
    out = (f'<title>{title.group(1)}</title>' if title else '') + head + body
    if 'class=' in attrs:   # carry body classes over
        cls = re.search(r'class="([^"]*)"', attrs).group(1)
        out += f"<script>document.body.classList.add(...{json.dumps(cls.split())})</script>"
    return out

sizes = {}
built = {}
for v in 'abc':
    full = build_variant(v)
    built[v] = full
    open(os.path.join(DIST, 'offline', f'{v}.html'), 'w', encoding='utf-8').write(links(full, 'offline'))
    open(os.path.join(DIST, 'art', f'{v}.html'), 'w', encoding='utf-8').write(strip_doc(links(full, 'art')))
    sizes[v] = len(full.encode()) // 1024

# ---- tester (preview.html) with embedded variants ----
pv = read(os.path.join(ROOT, 'preview.html'))
pv = re.sub(r'<link rel="stylesheet" href="assets/([\w.-]+\.css)">', lambda m: f'<style>{css_inline(m.group(1))}</style>', pv)
packs = ''.join(
    f'<script type="application/octet-stream" id="pack-{v}">' + base64.b64encode(gzip.compress(links(built[v], 'embed').encode(), 9)).decode() + '</script>'
    for v in 'abc')
urls_tag = '<script>window.SBP_URLS=' + json.dumps(URLS) + '</script>'
art_pv = pv.replace('<body>', '<body>' + urls_tag + packs, 1)
open(os.path.join(DIST, 'art', 'index.html'), 'w', encoding='utf-8').write(strip_doc(art_pv))
open(os.path.join(DIST, 'offline', 'index.html'), 'w', encoding='utf-8').write(pv.replace('href="./"', 'href="./index.html"'))
sizes['tester'] = len(art_pv.encode()) // 1024
print(json.dumps({'variant_kb': sizes}))
```

### 4.5 `tools_recon.py` (โค้ดเต็ม — Rev.08.1 เปลี่ยน path เป็นแบบ relative)

```python
#!/usr/bin/env python3
"""Price reconciliation: every price the website can show vs the Pricebook extract (sbp_real.json, read from
ใบเสนอราคาติดตั้งแอร์ Final จริง.xlsx / ใบเสนอราคาล้างและซ่อม Final จริง.xlsx), plus the VAT rounding the site uses."""
import json, os, sys
# paths: web data inside the repo; the internal Pricebook extract (has special/project rates — NEVER commit or ship it)
# lives outside the web build: internal/sbp_real.json by default, or pass a path / set SBP_REAL.
HERE = os.path.dirname(os.path.abspath(__file__))
REAL = sys.argv[1] if len(sys.argv) > 1 else os.environ.get('SBP_REAL', os.path.join(HERE, 'internal', 'sbp_real.json'))
if not os.path.exists(REAL): sys.exit(f'missing internal Pricebook extract: {REAL} (see CLAUDE.md §7)')
W = json.load(open(os.path.join(HERE, 'assets', 'sbp-data.json'), encoding='utf-8')); R = json.load(open(REAL, encoding='utf-8'))
P = W['pool']; S = lambda i: None if i is None or i < 0 else P[i]
inc = lambda x: int(x * 1.07 + 0.5)          # JS Math.round(n*1.07) for positive n
bad = []; n = {}
real_p = {r['m']: r for r in R['prods']}
for r in W['prods']:
    t, b, m, btu, px, ix, ok = r[:7]; s = real_p.get(m)
    if not s: bad.append(('prod missing', m)); continue
    if abs(s['px'] - px) > 0.5: bad.append(('prod px', m, px, s['px']))
    if (s.get('ix') or None) != (ix or None) and abs((s.get('ix') or 0) - (ix or 0)) > 0.5: bad.append(('prod install', m, ix, s.get('ix')))
    if s.get('pv') and abs(inc(px) - s['pv']) > 1: bad.append(('prod VAT', m, inc(px), s['pv']))
    if not s.get('ok'): bad.append(('unapproved on web', m))
n['prods'] = len(W['prods']); n['prods_not_on_web'] = sum(1 for r in R['prods'] if not r.get('ok'))
real_i = {r['c']: r for r in R['inst']}
for r in W['inst']:
    s = real_i.get(r[0])
    if not s: bad.append(('inst missing', r[0])); continue
    if (s['p'] or None) != (r[4] or None) and abs((s['p'] or 0) - (r[4] or 0)) > 0.5: bad.append(('inst', r[0], r[4], s['p']))
n['inst'] = len(W['inst'])
key = lambda pk, lv, ty, rg, nm: (pk, lv, ty, rg, nm)
real_c = {key(r['pk'], r['lv'], r['ty'], r['rg'], r.get('n') or r.get('name')): r for r in R['clean']}
real_c2 = {}
for r in R['clean']: real_c2.setdefault((r['pk'], r['lv'], r['ty'], r['rg']), []).append(r)
for r in W['clean']:
    pk, lv, ty, rg, u, s_, sp, pj = S(r[0]), r[1], S(r[2]), S(r[3]), S(r[4]), r[5], r[6], r[7]
    cands = real_c2.get((pk, lv, ty, rg), [])
    if not any((c['s'] or None) == (s_ or None) or (c['s'] and s_ and abs(c['s'] - s_) < 0.5) for c in cands): bad.append(('clean', pk, lv, ty, rg, s_, [c['s'] for c in cands]))
    if sp is not None or pj is not None: bad.append(('special/project rate leaked', pk, lv, ty, rg))
n['clean'] = len(W['clean'])
real_r = {}
for r in R['rep']: real_r.setdefault(r['ty'], []).append(r['s'])
for r in W['rep']:
    if r[3] not in real_r.get(S(r[0]), []) and not (r[3] is None and None in real_r.get(S(r[0]), [])): bad.append(('rep', S(r[0]), r[1], r[3]))
    if r[4] is not None or r[5] is not None: bad.append(('rep special leaked', r[1]))
n['rep'] = len(W['rep'])
print(json.dumps({'checked': n, 'mismatches': len(bad)}, ensure_ascii=False))
for b in bad[:40]: print(b)
sys.exit(1 if bad else 0)
```

### 4.6 สัญญาของระบบ 3 มิติ Rev.08 (ต้องรู้ก่อนแก้ `techstory.js` / `system3d.js`)

**หน่วยและพิกัด:** เมตร, แกน y ขึ้น, ห้องบ้านจำลอง: ผนังหลัง z ≈ −1.9, ระเบียง x > 3, คอยล์เย็นติดผนังสูง ~2.1 ม., เพดาน 2.7 ม. (สี่ทิศทาง 3.34)

**โครงสร้าง 1 ขั้น (step) ใน `techstory.js`:**
```js
{
  t: 'ชื่อขั้น', form: 'อ้างอิงข้อในแบบฟอร์ม', what: 'ช่างทำอะไร', why: 'ทำไม', get: 'ลูกค้าได้อะไร',
  s: { ...BASE, ...stateOverrides },          // สถานะฉาก (ดู BASE ด้านล่าง)
  tech: [spot, act, tool],                    // spot ∈ tech3d.SPOTS: unit (บนบันได), unitFloor, breaker, bucket, cduValve, cduFront, cduLeft, front, boxes, door
                                              //   act = ท่าทำงาน, tool = เครื่องมือในมือ (gun, sprayer, meter, probe, tablet, remote, wrench, blower, torch, drill)
  cam: 'unitClose',                           // key ใน CAMS (overview, unit, unitClose, unitSide, breaker, parts, trunk, drain, cdu, cduValve, cduLeft, balcony, front, boxes)
  lab: [['ข้อความป้าย', 'anchorKey', warn?]], // ป้าย 2 คอลัมน์ ไม่ทับกัน มีเส้นชี้ ซ่อนเมื่อผนังบัง
  air: true,                                  // แสดงลม (เฉพาะขั้นที่เครื่องเดิน)
  ghost: true,                                // ช่างจางลง (0.22) เมื่อบังจุดสำคัญ
}
// BASE (สถานะตั้งต้น): power, run, parts, peek, unhang, inner, foam, spray, drain,
//   dFilter, dCoil, dBlower, dPan, dOut, dBack (ความสกปรก 0–1),
//   cloth, ladder, bag, bucket, washer, washerOut, pcb, boxes, marks, level, gauges, vac, n2 (เครื่องมือที่โชว์),
//   build (ขั้นการติดตั้ง: plate, hole, base, cdu, pipes, unit, nuts, power), lids, reveal, cust, chip, report, needle, ghost
// STORIES = { C1: () => 14 ขั้น, C2: () => 17 ขั้น (C1 + ปลดเครื่องลดระดับ ไม่ตัดท่อ + ทะเบียนชิ้นส่วน),
//             install: tier => 13 ขั้น ('STANDARD' | 'PREMIUM' ต่างกันที่ leak test / vacuum), repair: () => 10 ขั้น }
// CHIPS: ค่าตัวอย่างการบันทึก (before, after, commission, leak, leakStd, vac, amps, a4, dt …) — ต้องมีข้อความ
//   "ตัวเลขเป็นตัวอย่างการบันทึก ไม่ใช่เกณฑ์ผ่าน/ไม่ผ่าน" เสมอ
```

**`system3d.js` steps(type)** — 9 key ต่อประเภท: `power → intake → coil → water → fan → throw → gas → reject → loop` ข้อความต่างตามประเภท (ติดผนัง/แขวน/สี่ทิศทาง: พัดลม, ระยะลม, ปั๊มน้ำทิ้งของสี่ทิศทาง)

**`buildHome(scene, {type, theme})` คืนค่า:** `type, root, room, sys, props, walls, U (unit), unitG, hang, plate, OU, outG, cdu, valve, term, stand, trunk{base,lid,fit}, wallCaps, mini, rcbo, setPower(), lanes, meshes{k:{tail,ins,cu,core}|{tail,pipe}}, powerMeshes, powerPts, nuts, emitters, obstacles, roomBox, anchors, drainPos, penY, rebuildTails(), setReveal(), setXray(), MK, K, M, flow{gas,liq,drain,power,link}, dispose()`

**ข้อควรรู้เชิงเทคนิค:**
- ป้ายตัวอักษรบนท่อ/ฉนวน = `CanvasTexture` บน `TubeGeometry` (u ตามความยาว, v รอบท่อ; flipY → canvas y fraction f ↔ v = 1−f) แถบพิมพ์อยู่ที่ v≈0.72 จึงหมุนท่อ −2.0 rad รอบแกน x ให้หันหาผู้ชม · สัดส่วน canvas คำนวณจากเส้นรอบวง/ความยาว (ตัวอักษรไม่ยืด)
- เลนท่อในรางใช้ `laneLine()` (least-squares miter offset) ท่อไม่ซ้อนกัน
- ผนังตัดแบบบ้านตุ๊กตา; ป้ายถูกซ่อนเมื่อ raycast โดน `home.walls`
- ทุกฉาก boot แบบ lazy ด้วย `IntersectionObserver` และ pause เมื่อออกนอกจอ; `RM()` = prefers-reduced-motion → ไม่เล่นอัตโนมัติ
- `stage.advance(sec)` = เร่งเวลาให้ animation จบ (ใช้ในเทสต์/ภาพ screenshot)
- swiftshader (ไม่มี GPU) ช้ามาก: screenshot ฉาก 3 มิติใช้ 1–3 นาที → timeout ≥ 180,000 ms

**ช่องโลโก้ทางการ:** วาง `assets/logos/<key>.png` (key: `aeroflex, scg, yazaki, airpro, o-two, nano`; PNG โปร่งใส สูง ≥200 px) → `build.py` ฝังเป็น `globalThis.__SBP_LOGOS` → `matkit3d.logoImage(key)` พิมพ์โลโก้แทนตัวอักษรอัตโนมัติ · **ใช้ได้เมื่อมีหนังสืออนุญาตจากเจ้าของแบรนด์เท่านั้น** ถ้าไม่มีไฟล์ = พิมพ์ชื่อยี่ห้อเป็นตัวอักษรธรรมดา

---

## 5. UI/UX & Design Guidelines

### 5.1 Design tokens (ค่าจริงใน `:root` ของแต่ละแบบ)

| Token | A · Bento (light) | A (dark) | B · Engineering (light) | B (dark) | C · Showroom (dark — ค่าเริ่มต้น) | C (light) |
|---|---|---|---|---|---|---|
| พื้นหลัง | `--bg #EEF2F8` | `#0B111B` | `--paper #F4F7FB` | `#071630` | `--bg #090E17` · `--stage #0C1320` | `#EEF2F8` · `#E3EAF4` |
| การ์ด | `--tile #FFFFFF` · `--tile-2 #F6F8FB` | `#141B24` · `#1A232E` | `--sheet #FFFFFF` | `#0D2139` | `--panel #111A24` · `--panel-2 #172230` | `#FFFFFF` · `#F3F6FA` |
| ตัวอักษร | `--ink #15202C` · `--ink-2 #4F5D6D` · `--ink-3 #616C7A` | `#E7EDF4` · `#A9B6C4` · `#8A99AB` | `--ink #0E2238` · `#44576D` · `#616C7A` | `#E4EEF9` · `#A9BED6` · `#8EA3BD` | `--ink #EAF0F6` · `#A6B3C2` · `#8A99AB` | `#0F1C2B` · `#4B5B6E` · `#616C7A` |
| เส้น | `--line rgba(18,63,123,.10)` | `rgba(160,190,230,.12)` | `--rule #C9D5E3` · `--line #2C6CB8` (เส้นแบบ) | `#274567` · `#6FA8EE` | `rgba(150,190,230,.13)` | `rgba(18,63,123,.12)` |
| สีแบรนด์ (★r9 จากโลโก้: FUJIVA น้ำเงิน `#1B51A4`) | `--blue #163F80` · `--blue-2 #1B51A4` · `--blue-l #E7EEF9` | `#8DB2F2` · `#9BBDF5` | `--blue #163F80` · `--line #1B51A4` · `--blue-l #E5EDF9` | `#9CC4F5` · `#7FA8F5` | `--cool #7FA8F5` · `--cool-d #4D86E8` | `#1B51A4` · `#163F80` |
| CTA / accent (★r9 ส้ม SP `#EF4E2E` / FUJIVA `#F15A2B` = `--brand-or` ใช้กับของใหญ่/ตกแต่ง · พื้นที่มีตัวอักษรขาวใช้ `#C4401F` 5.1:1) | `--or #C4401F` · `--or-d #A9361A` · `--or-l #FDECE6` | `#F26A3D` (ตัวอักษร `#14203A`) | `--safety #C4401F` · `--safety-l #FDECE6` | `#F26A3D` (ตัวอักษร `#0E2240`) | `--heat #F26A3D` · `--heat-d #F15A2B` (ตัวอักษร `#0F1C2B`) | `#C4401F` (ตัวอักษรขาว) |
| สถานะ | `--ok #1B7A45` · `--warn #B4560D` · `--bad #B02A26` | ★r19 `#4ED39A` · `#FFB35C` · `#FF6B6B` (เดิมไม่กำหนด → ใช้สีสว่างบนพื้นมืด คอนทราสต์ไม่ผ่าน) | เหมือน A | ★r19 เหมือน A มืด | `#4ED39A` · `#FFB35C` · `#FF6B6B` | เหมือน A |
| มุมโค้ง | `--r 22px` · `--r-s 14px` · `--s-r 14px` | | `--s-r 4px` (แบบแปลน) | | `--r 18px` · `--s-r 12px` | |

**Alias tokens สำหรับโมดูลร่วม** — โมดูลร่วม (shared.css, studio.css, services.css และ UI ที่สร้างจาก JS) **ใช้เฉพาะ** `--s-card --s-card-2 --s-ink --s-ink-2 --s-ink-3 --s-line --s-accent --s-on-accent --s-accent-soft --s-ok --s-warn --s-bad --s-r --s-mono` ห้ามอ้าง token เฉพาะแบบ (เช่น `--tile`) จากโมดูลร่วม · แต่ละแบบ map alias เองใน `:root`

**Dark mode:** `@media (prefers-color-scheme: dark)` + `:root:not([data-theme="light"])` และ `:root[data-theme="dark"]` (C กลับด้าน: ค่าเริ่มต้นมืด) · 3D รับ `theme` ผ่าน cfg (`light` / `blueprint` / `dark`) · ★r19 ทุก token ที่เป็นสีตัวอักษร (รวม `--ok` `--warn` `--bad`) ต้องกำหนดค่าใหม่ในบล็อกมืดทั้งสองบล็อก — A/B เคยลืม ทำให้สถานะในธีมมืดคอนทราสต์ไม่ผ่าน

### 5.2 ฟอนต์

| แบบ | ตัวหลัก | หัวข้อ | ตัวเลข/ป้ายเทคนิค |
|---|---|---|---|
| A | Anuphan 400–700 | Anuphan | IBM Plex Mono (tabular-nums) |
| B | IBM Plex Sans Thai 400–700 | IBM Plex Sans Thai | IBM Plex Mono (ป้ายแบบแปลน — เจ้าของยังไม่ตัดสินว่าจะคงไว้) |
| C | Anuphan | **Kanit** 500 (`--display`) | IBM Plex Mono |
| ★r11 D | **Noto Sans Thai Looped** 400–650 (`--text`) | **Noto Sans Thai** variable แคบ 70–78% 700–760 (`--display`) | Noto Sans Thai (ตัวเลขกว้างเท่ากันอยู่แล้ว) — `--s-mono` ชี้ `--display` จึงไม่ฝัง IBM Plex Mono |
| ★r12 A2 / B2 / C2 / D2 | Noto Sans Thai Looped / Bai Jamjuree / Anuphan / Noto Sans Thai Looped | **Trirong** 300/500 · **Bai Jamjuree** 600 · **Fahkwang** 300/500 · **Noto Serif Thai** variable | ตัวเลขใช้ฟอนต์หัวข้อ + tabular-nums (ไม่ฝัง IBM Plex Mono) |
| ★r13 A3 / B3 / C3 | Noto Sans Thai Looped / IBM Plex Sans Thai / Anuphan | Noto Sans Thai · Bai Jamjuree 600 · Noto Serif Thai | สว่างอย่างเดียว (ตั้งใจ — เจ้าของเห็นว่ารุ่น 2 มืดเกิน) |

body: `400 16px/1.7` · self-hosted woff2 แยก subset Thai/Latin (`fonts.css`) · ห้ามโหลดฟอนต์จาก CDN

### 5.3 Layout & Responsive

- ทดสอบหลักที่ **1366×900** (desktop) และ **390×844** (มือถือ) — ต้องไม่มีการเลื่อนแนวนอนทั้งหน้า (ตารางกว้างเลื่อนในกรอบตัวเองได้ และกดโฟกัสด้วยคีย์บอร์ดได้)
- Breakpoints ที่ใช้จริง (max-width): 1100 · 1080 · 1000 · 980 · 900 · 860 · 760 · 640 · 600 · 560 · 520 · 420 · ฉาก 3 มิติใช้ `min-width:981px` เป็นโหมดจอกว้าง (คำอธิบายขั้นอยู่ด้านบนภาพ)
- `@media (pointer:coarse)`: ปุ่ม/ช่องกรอกสูง **≥ 44 px** (`.s-btn`, tabs, timeline ของ techstory)
- มือถือ: คำอธิบายขั้นในฉาก 3 มิติย่อ 3 บรรทัด แตะเพื่ออ่านต่อ (ไม่บังภาพ) · เมนูหัวข้อแบบแถบ (`mountMobileMenu`) · ปุ่มใบเสนอราคาลอย
- `safe-area-inset-bottom` สำหรับ iPhone · `scroll-padding-top: 70px` ให้หัวข้อไม่จมใต้ header

### 5.4 กฎ UX / Accessibility (WCAG 2.2 AA)

- contrast ≥ 4.5:1 ทุกตัวอักษร (ink-3 ถูกปรับใน Rev.07.1 แล้ว — ห้ามทำให้จางลง) · สถานะห้ามบอกด้วยความจาง (opacity) อย่างเดียว ใช้สี/เส้นประ
- หัวข้อไม่ข้ามระดับ h2 → h3 → h4 · มี `<main>` เดียว · ฉาก 3 มิติ `aria-hidden` บน canvas แต่มีข้อความทางเลือกครบ (อ่านขั้นตอนได้แม้ไม่มี WebGL)
- `prefers-reduced-motion`: ไม่หมุน/ไม่เล่นอัตโนมัติ ภาพนิ่งแทน, ไม่มี smooth scroll
- **เลิกใช้** เอฟเฟกต์ลอยขึ้นทีละหัวข้อ · ไม่มี "→" ท้ายปุ่ม · ป้ายควบคุมเป็นภาษาไทยที่ลูกค้าเข้าใจ (ไม่ใช้ภาษาอังกฤษตัวพิมพ์ใหญ่)
- การเคลื่อนไหวเก็บไว้ที่ภาพ 3 มิติที่มีความหมายเท่านั้น
- ★r18 **ตัวอักษรขั้นต่ำ 12 px (ข้อความภาษาไทย 12.5 px)** ทุกข้อความ HTML — ภาษาไทยต่ำกว่านี้วรรณยุกต์อ่านไม่ออก · ยกเว้นตัวเลข/ตัวอักษรละตินในแผนภาพ SVG ป้ายบนภาพ 3 มิติ และเครื่องหมายกรอบแบบ (B `.zone`) · `<small>` ที่ไม่ได้กำหนดขนาด = `max(12.5px, .833em)` (shared.css)
- ★r18 **จอสัมผัส (`pointer:coarse`) ทุกปุ่ม/ลิงก์/ช่องเลือกที่ใช้นิ้ว ≥ 44 px** (shared.css + แต่ละแบบ) · จุด/ป้ายชิ้นส่วนบนภาพ 3 มิติใช้ `::after` ขยายพื้นที่กดโดยไม่ขยายตัวป้าย
- ★r18 **หัวหน้าของทุกหน้า: ชื่อหน้า (h1) ใหญ่กว่าหัวข้อส่วน (h2) เสมอ** · ข้อมูลสำคัญ (`.sx-facts`) ห้ามหน้าตาเหมือนปุ่ม · หัวข้อภาษาไทยผ่าน `typeset.thaiPhrases` · เมนูหลักห้ามล้นที่ทุกความกว้าง (ตรวจ `nav.scrollWidth ≤ clientWidth`)

### 5.5 กฎภาพ 3 มิติ

- ทุกฉากจำลองต้องมีข้อความกำกับ **"แบบจำลองเพื่ออธิบาย"** — ห้ามสื่อว่าเป็นผลวัดจริงหรือรับประกันประหยัดไฟ
- ป้ายชิ้นส่วน: 2 คอลัมน์ซ้าย–ขวา **ไม่ทับกัน** มีเส้นชี้ ซ่อนเมื่อผนังบัง (`createLabels`)
- งานติดตั้งต้อง **เรียบร้อยแบบงานจริง**: ท่ออยู่ในรางครอบท่อปิดฝาตลอดแนว ไม่มีท่อเปลือย, ข้อต่อจริง (ข้องอแบน 90°, ข้องอฉาก, 45°, ฝาครอบผนัง, ฝาปิดปลาย), คอยล์ร้อนหันตรงแนวผนัง
- สีวัสดุ: ทองแดง O-TWO (หนา 0.70 มม.) · ฉนวน Aeroflex ดำพิมพ์ชื่อ · **ท่อน้ำทิ้ง PVC สีฟ้า** (SCG) · ราง Airpro ขาว · สาย THW น้ำตาล(L)/ฟ้า(N)/เขียวแถบเหลือง(G) · RCBO NANO
- ช่าง: ★r9 เสื้อน้ำเงินแบรนด์ `0x1b51a4` หมวก/กล่องเครื่องมือส้มแบรนด์ `0xef4e2e` (เดิม `0x1f4f8a` / `0xe2711d`) · ป้ายเสื้อ/กล่อง/แท็บเล็ตใช้โลโก้ทางการจาก `assets/logos/` (`brand3d.drawSbp` วางตรา SP + "SBP AirCare" · `drawFujiva` บนพื้นมืดมีแผ่นรองสีอ่อน) · ห้ามช่างบังจุดที่อธิบาย (ใช้ `ghost`)
- ลม: เส้นอนุภาคไหลตามทิศบานสวิง เย็น=ฟ้า อุ่น=ส้ม (`tempColor`) · เส้นทางในแบบ B: ลมอุ่น, ลมเย็น, น้ำยาเหลว (ท่อเล็ก), ไอน้ำยา (ท่อใหญ่), น้ำทิ้ง, ไฟฟ้า
- ★Rev.09 r3 (เจ้าของ: "ลมต้องเป็นธรรมชาติ ไม่ใช่เหมือนสาดน้ำ"): **ภาพลมทุกจุดวาดผ่าน `wisp3d.js`** — เส้นลมโปร่ง บาง เรียวท้าย สีจาง ไหลช้า (timeScale 0.6) กระจายและโค้งตามความปั่นป่วน · ห้ามกลับไปใช้จุด/ขีดสีน้ำเงินเข้ม · **น้ำ** (ฉีดล้าง น้ำทิ้ง) ใช้หยดน้ำ (Points) ให้ต่างจากลมชัดเจน · ความปั่นป่วนของลมทำตอนวาดเท่านั้น (ฟิสิกส์/ระยะลมใน throwsim ต้องเท่าเดิม: ติดผนัง ~7.5 · สี่ทิศทาง ~4.5 · แขวน ~11.5 ม. ที่ 16 วินาที)
- **ห้ามปั้นเลียนแบบดีไซน์/โลโก้ของผู้ผลิตแอร์ (Daikin, Carrier ฯลฯ) หรือแบรนด์วัสดุ** — ใช้ตัวเครื่องกลาง ๆ และชื่อยี่ห้อเป็นตัวอักษร

---

## 6. Specific Rules & Coding Standards

### 6.1 สไตล์โค้ด

- **ES modules ล้วน** (`import … from './x.js'` ต้องมีนามสกุล `.js`), ES2022, ไม่มี transpile ตอน dev
- 2 spaces · single quotes · มี semicolon · arrow functions · โค้ดค่อนข้างแน่น (one-liner) — **รักษาสไตล์เดิมของไฟล์** อย่า reformat ทั้งไฟล์ (diff จะอ่านไม่ออก)
- คอมเมนต์ภาษาอังกฤษ · ข้อความที่ผู้ใช้เห็นเป็นภาษาไทย · หัวไฟล์มีคอมเมนต์บอกหน้าที่ + แท็ก revision (เช่น `— Rev.08`) และคำตัดสินเจ้าของที่เกี่ยวข้อง
- DOM สร้างด้วย `h(tag, attrs, ...children)` จาก `sbp-core.js` (ไม่ใช้ innerHTML กับข้อมูลผู้ใช้) · `$(sel, root)` / `$$(sel, root)`

### 6.2 การตั้งชื่อ

| รูปแบบ | ใช้กับ | คืนค่า |
|---|---|---|
| `mountX(root, cfg)` | โมดูล UI ที่สร้าง markup ใน root | object ควบคุม (`setType`, `open`, `highlight` …) |
| `createX(container, opts)` | engine 3 มิติ / renderer | `{ …controls, advance?, dispose() }` |
| `buildX(…)` | สร้าง geometry/กลุ่ม THREE | `THREE.Group` หรือ object ของชิ้นส่วน |
| `UPPER_CASE` | ค่าคงที่/ตารางข้อมูล (`TYPES, STEPS, CAMS, BASE, CHIPS, SPOTS, TRAVEL, ZONES`) | |
| ย่อสั้นในขอบเขตแคบ | `V` (Vector3), `S` (pool lookup), `M`/`K`/`MK` (ชุดวัสดุ), `RM` (reduced motion) | |
| CSS class prefix | `s-` shared commerce · `st-` studio · `sv-` services · `hw-` how-it-works · `ts-` techstory · `sy3-` system3d · `mt3-` materials · `hl` ป้าย 3 มิติ · `tm-` แผนที่ · ★r19 ห้ามใช้ชื่อคลาสทั่วไปในโมดูลร่วม (เคยใช้ `.ping` ใน throwsim ชนกับ `.ping` ของ A → จอเครื่องหดเป็นจุด) | |
| id ของ type | `wall`, `ceiling`, `cassette`, `floor`, `duct` (ห้ามเปลี่ยน — ผูกกับข้อมูลและ Pricebook) | |

### 6.3 State management

- ไม่มี framework/store — state อยู่ใน closure ของแต่ละ `mountX`
- **cart** = singleton ใน `commerce.js` + `subs: Set` (callback เมื่อ `save()`) + `localStorage['sbp-quote-v2']` (ครอบ try/catch เสมอ ห้ามพึ่ง storage)
- หน้าทดสอบ: `localStorage['sbp-preview-v1']` · ★r5 เส้นทางลูกค้า: `localStorage['sbp-journey-v1']` (`{k, done}`)
- ฉาก 3 มิติ: object สถานะ (`st`, `T`) ค่อย ๆ lerp เข้าหาเป้าหมายทุกเฟรม — `go(i)` แค่ตั้งเป้า
- Global ที่อนุญาต: `globalThis.__SBP_DATA`, `__SBP_TH`, `__SBP_LOGOS` (ฝังโดย build), `SBP_HUB`, `window.SBP_URLS` · หน้าทดสอบใช้ `window.TS`, `window.READY` · **ห้ามเพิ่ม global อื่น** · ★r10 หน้าหลังบ้านเก็บข้อมูลเข้าใช้ใน `sessionStorage['sbp-staff-v1']` (ไม่ใช่ localStorage, ไม่ใส่ใน URL) · ระหว่างโมดูลใช้ CustomEvent `sbp:book` (cancelable) แทน global (เคยลบ `globalThis.__air` ออกแล้ว)

### 6.4 ข้อกำหนดของ build (ถ้าไม่ทำตาม `build.py` จะพัง)

- แต่ละ `a/b/c.html` มี `<script type="module">` **ตัวเดียว** (build.py assert) — ใส่ wiring ทั้งหมดในนั้น
- stylesheet ต้องเขียนแบบ `<link rel="stylesheet" href="assets/ชื่อ.css">` ตรงตัว (regex) · ฟอนต์อ้าง `url(fonts/….woff2)`
- ข้อมูลโหลดผ่าน `loadData()` (รองรับทั้ง fetch และ `__SBP_DATA`) — ถ้าเพิ่มไฟล์ข้อมูลใหม่ที่ fetch ต้องเพิ่มการฝังใน build.py ด้วย
- lazy `import('./x.js')` ใช้ได้ (esbuild รวมให้) · ลิงก์ระหว่างหน้าใช้ `./a.html`, `./b.html`, `./c.html`, `./` (build แปลงให้)

### 6.5 กติกา 3 มิติ

- boot แบบ lazy ด้วย `IntersectionObserver` · pause render เมื่อออกนอกจอ · `setPixelRatio(min(2, dpr))` · มี `dispose()` คืน GPU memory
- ต้องมี fallback เมื่อสร้าง WebGL ไม่ได้ (ข้อความ/ภาพนิ่ง ยังอ่านเนื้อหาได้ครบ)
- เคารพ `prefers-reduced-motion` ทุกฉาก
- งบ WebGL context: **≤ 3 live ต่อหน้า** (★r8: 4 บนเครื่องที่รายงาน RAM ≥ 4 GB, 2 เมื่อ ≤ 2 GB) — ★Rev.09 คุมโดย `gl-pool.js`: ทุก `new WebGLRenderer` ต้องเรียก `track(renderer, el, {scene, redraw})` (ฉากใหม่ต้องลงทะเบียนเสมอ) · ฉากไกลจอถูก `loseContext()` แล้ว restore เมื่อกลับมา (state เดิมไม่หาย) · smoke รายงาน `webglPeak`
- ห้ามแก้ไฟล์ three.js ที่ vendored (r170) · ถ้าจะอัปเกรด three ต้องทดสอบทุกฉาก

### 6.6 ⛔ กฎธุรกิจที่ห้ามแก้โดยไม่มีคำอนุมัติเป็นลายลักษณ์อักษรจากเจ้าของ

| # | กฎ | อยู่ที่ |
|---|---|---|
| 1 | ราคาต้นทางเป็น **ก่อน VAT** · ★Rev.09 r9 (คำอนุมัติเป็นลายลักษณ์อักษรของเจ้าของ 2 ต.ค. 2569: "ทุกราคาต้องเป็นตัวเลขกลมๆหลักร้อย และ ราคาก่อน vat ทุกอัน ยกเว้นลูกค้า b2b ที่จะเอาใบกำกับภาษี และ b2c ไม่เอาภาษี") เว็บแสดง **ราคาเดียว = ก่อน VAT ปัดเป็นหลักร้อย** (`r100` ครึ่งขึ้น: 650→700, 550→600 — ทำครั้งเดียวใน `loadData`) · บุคคลทั่วไปไม่ต้องการใบกำกับภาษี = ชำระตามราคาที่แสดง · นิติบุคคลที่ต้องการใบกำกับภาษี = + VAT 7% (`TAX_MODES`, `withTax`, `cart.tax`, `vatOf`) · `incVat` ใช้เฉพาะยอดใบกำกับภาษี ห้ามใช้เป็นราคาตั้ง · ตรวจด้วย `npm run pricing` | `sbp-core.js`, `commerce.js` |
| 2 | **ห้ามแก้ราคา/อัตราใด ๆ ใน `sbp-data.json`** โดยไม่มีคำยืนยันจากเจ้าของ — หลังแก้ต้องรัน `tools_recon.py` ได้ 0 ผิด (ชุดราคาใหม่ SBP-PRC-001 **ยังไม่อนุมัติให้ขึ้นเว็บ**) · ★r9 การปัดหลักร้อยเป็นชั้นแสดงผล — `sbp-data.json` ยังเท่ากับ Pricebook ทุกตัว (recon เทียบตรง + รายงาน `display_rounding_r100`) | ข้อมูล |
| 3 | เว็บแสดง **อัตรามาตรฐาน** — `sp`/`pj` (พิเศษ/โครงการ) ต้องเป็น `null` ในไฟล์ที่ส่งถึง browser · ★r9 (เจ้าของ 2 ต.ค. 2569: "ทำเป็นราคาขั้นบันได จำนวนและส่วนลด") สัญญาล้างรายปีมี **ราคาขั้นบันไดสาธารณะ** `VOLUME_TIERS`: 1–9 อัตรามาตรฐาน · 10–29 ลด 3% · 30–59 ลด 5% · 60–99 ลด 7% · 100+ ลด 7% + ขอราคาโครงการได้ — คิดจากค่าล้างต่อรอบ (ไม่รวมค่าเดินทาง) แล้วปัดหลักร้อย ยอดขั้นต่ำยังใช้ · **ทุกขั้นต้องไม่ต่ำกว่าอัตราพิเศษภายในทุกแถว** (`tools_recon.py` → `ladder_guard.below_special = 0`) · ห้ามเพิ่มขั้นเกิน 7% โดยไม่ตรวจกับ extract ภายใน | `sbp-data.json`, `VOLUME_TIERS`, `VOLUME_HINT` (=100) |
| 4 | ห้ามมีต้นทุนภายใน, กำไร, % ส่วนลดภายใน/อัตราอนุมัติ, รายชื่อลูกค้า, เงินเดือน ในโค้ดหรือข้อมูลฝั่ง browser (ยกเว้น % ของราคาขั้นบันไดสาธารณะใน #3 ที่เจ้าของอนุมัติ) | ทั้ง repo |
| 5 | รุ่นที่ขึ้นเว็บ = **อนุมัติแล้วเท่านั้น (705)** · 9 รุ่นราคาอ้างอิงตลาดห้ามขึ้น | data |
| 6 | ติดตั้งบนเว็บมี **มาตรฐาน / พรีเมียม** เท่านั้น (ระดับพื้นฐาน `-MASS` ไม่ขึ้นเว็บ) | `loadData` filter |
| 7 | ทองแดงบนเว็บ = **O-TWO หนา 0.70 มม.** เท่านั้น · แปลง "K Copper" → "O-TWO" · ซ่อน `MAT-CU-L-*` และคำว่า "Type L" ทุกที่ (Type L อยู่ใน Pricebook สำหรับ QTN/BOQ) | `brand()` ใน `loadData` |
| 8 | ยอดขั้นต่ำ **4,500 บาทก่อน VAT ใช้กับงานล้างเท่านั้น** | `minBill` |
| 9 | ค่าเดินทาง: 5 จังหวัดหลัก 0 · Z1 ≤60 กม. 300 (ยกเว้น ≥4 เครื่อง) · Z2 61–100 กม. 800 (ขั้นต่ำ 3, ยกเว้น ≥8) · Z3 101–150 กม. 1,500 (ขั้นต่ำ 5) · >150 กม. ไม่รับรายเครื่อง · ระยะ = เส้นตรง × 1.35 | `TRAVEL` |
| 10 | รับประกันงานติดตั้ง: **3 ปี** เมื่อซื้อเครื่องใหม่จากบริษัท / **1 ปี** เมื่อลูกค้าจัดหาเครื่องเอง (ตาม QTN) | ข้อความ |
| 11 | **คำต้องห้าม:** แก้หายแน่นอน · ไม่มีปัญหาอีกแน่นอน · ประหยัดไฟแน่นอน · ปลอดเชื้อ · สะอาด 100% · รับประกันเย็น · ล้างใหญ่ครบทุกจุด · ไม่มีค่าใช้จ่ายเพิ่มเติมทุกกรณี · อะไหล่เสียแน่นอน · เสร็จตามเวลาแน่นอน | `tests/textscan.mjs` |
| 12 | ค่าที่วัดในขั้นตอนช่าง = **ตัวอย่างการบันทึก** ไม่ใช่เกณฑ์ผ่าน/ไม่ผ่าน (งานจริงใช้ค่าตามคู่มือผู้ผลิตของรุ่น) · ห้ามเดาค่าแรงดัน/ขนาดท่อ/ขนาดสายไฟ/เบรกเกอร์ | `CHIPS` |
| 13 | ขั้นตอนช่างต้องตรงแบบฟอร์มบริษัท: ล้าง **SBP-SR-ACCL-UNI-001 Rev.07** (P1 Basic = T1 · P2 Standard Care = T2 + ภาพ + เกรด A–D · C2 ปลดเครื่องลดระดับ **ไม่ตัดท่อ** + ทะเบียนชิ้นส่วนบังคับ · รอบถัดไป 3/4/6/12 เดือน · ลงนาม 3 ฝ่าย) · ติดตั้ง **SBP-SR-ACIN-UNI-001 Rev.04** (Leak test, Vacuum micron/inHg + hold, ค่าหลังติดตั้ง, punch list) · ซ่อม: **ไม่ซ่อมก่อนลูกค้าอนุมัติ** | `techstory.js`, `services.js` |
| 14 | โลโก้: ไม่ดาวน์โหลด/ไม่วาดเลียนแบบ · ใช้ไฟล์ทางการ + หนังสืออนุญาตเท่านั้น · ★r9 โลโก้บริษัท SP "QUALITY BRAND" (`sbp.png`) และ FUJIVA (`fujiva.png`) เจ้าของส่งให้เอง 2 ต.ค. 2569 — ทำพื้นหลังโปร่งใสอย่างเดียว ห้ามแก้สี/รูปทรง · บนพื้นมืด FUJIVA วางบนแผ่นสีอ่อน (`--plate`) | `assets/logos/` |
| 15 | ยังไม่มีหน้าผลงาน/โลโก้ลูกค้า/รีวิว ในเฟสนี้ | — |
| 16 | ★Rev.09 (1 ต.ค. 2569) ล้างและติดตั้งบนเว็บครอบคลุมทุกประเภท **ยกเว้น VRV / VRF = ติดต่อแยก** — รายการ VRV/VRF ห้ามเข้าตะกร้า ใช้ปุ่ม "ติดต่อสอบถาม" (`isVRF`, `askTeam`) | `sbp-core.js`, `commerce.js` |
| 18 | ★Rev.09 r3→r4 ขั้นตอนในส่วน "ทีมช่าง ล้าง / ติดตั้ง" (`jobguide.js`) **ต้องมาจาก `services.cleanSteps` เท่านั้น** (แหล่งเดียวกับแบบฟอร์ม) — แก้ข้อความขั้นตอนที่ services.js · ภาพ 3 มิติผูกด้วย `id` ของขั้น · ความสกปรกเป็นภาพประกอบเสมอ | `services.js`, `cleanguide*.js` |
| 19 | ★Rev.09 r3 ผลตรวจจัดห้อง (`roomplan.layoutChecks`: ของบังทางลม ลมเป่าศีรษะ/ที่นั่ง ทับหน้าต่าง/ประตู) เป็น **คำแนะนำทั่วไปเพื่อความสบาย** ไม่ใช่ข้อกำหนดผู้ผลิต | `roomplan.js` |
| 17 | ★Rev.09 ค่าระยะติดตั้ง/ระยะลมในห้องจำลองติดตั้ง (`FIT_RULES`) เป็น **ค่าแนะนำทั่วไป** ต้องมีข้อความกำกับเสมอ ไม่ใช่ค่าจากผู้ผลิต — ห้ามเขียนว่าผ่าน/ไม่ผ่านตามมาตรฐานผู้ผลิต | `roomfit.js` |
| 20 | ★Rev.09 r4 ตราบริษัทในภาพ 3 มิติ: **FUJIVA / SBP AirCare / บริษัท สหบูรพากรุ๊ป จำกัด อยู่บนของของทีมช่างเท่านั้น** (เสื่อยาง ป้ายเสื้อ กล่องเครื่องมือ ถุงล้าง ป้ายกำลังให้บริการ แท็บเล็ต รีโมตจำลอง) ขนาดเล็กแบบไม่ชวนขาย · **ห้ามใส่ยี่ห้อใด ๆ บนตัวแอร์ของลูกค้า** ในฉากงานช่าง (`buildPremiumIndoor({logo:false})`, `buildOutdoor(M, {logo:false})`) | `brand3d.js`, `jobscene3d.js` |
| 21 | ★Rev.09 r4 วิธีทำต่อประเภทเครื่อง (`services.CLEAN_HOW` / `INSTALL_HOW`) และการแบ่งงานช่างหัวหน้า/ผู้ช่วย (`jobguide` WHO_*) เป็นแนวปฏิบัติทั่วไปใต้ขั้นตอนแบบฟอร์ม **รอหัวหน้าช่างตรวจ** — ห้ามเพิ่มคำสัญญา ราคา หรือค่าที่วัดได้ในข้อความเหล่านี้ · ค่าระยะลมแอร์ตู้ตั้ง ~8 ม. ในห้องจำลองเป็นค่าประมาณเพื่ออธิบาย | `services.js`, `jobguide.js`, `throwsim3d.js` |
| 23 | ★Rev.09 r10 **จองคิว / ticket**: หน้าเว็บบอกว่า "ส่งเข้าระบบแล้ว" ได้ **เฉพาะเมื่อหลังบ้านตอบเลขที่คำขอกลับมา** (ไม่เชื่อม/ส่งไม่ได้ = `handoffBox` + เหตุผล) · ไม่สัญญาเวลาตอบกลับหรือวันนัด — วันที่ลูกค้าเลือกเป็น "วันที่สะดวก" ทีมยืนยันเสมอ · ไม่แสดงเวลาทำการจนกว่าเจ้าของกำหนด · นอกเวลา/วันอาทิตย์ = ประเมินหน้างาน · ticket ส่งเฉพาะราคาที่ลูกค้าเห็น (ห้าม sp/pj/ต้นทุน) · `track` คืนเฉพาะสถานะ/วันนัด/"จัดทีมแล้ว" (ไม่มีชื่อทีม โน้ตภายใน ประวัติ) · ต้องติ๊กยินยอม (`CONSENT_TH`) ก่อนส่ง ยกเว้นความเห็นไม่ระบุตัวตน · `STAFF_TOKEN` อยู่ใน Script properties + sessionStorage เท่านั้น · หน้าหลังบ้านห้ามเผยแพร่เป็น Artifact | `ticket.js`, `booking.js`, `contact.js`, `backoffice/` |
| 22 | ★Rev.09 r9 หน้าองค์กร/งานโครงการ (`business.js`): ขั้นตอนต่อเครื่องมาจาก `services.cleanSteps` เท่านั้น · จุดเด่น (USP) อ้างได้เฉพาะที่มีเอกสาร (แบบฟอร์ม SBP-SR-ACCL-UNI-001 Rev.07 / SBP-SR-ACIN-UNI-001 Rev.04, เงื่อนไขแพ็กเกจ, `COMPANY`) — **ห้ามสัญญาเวลาเข้างาน (SLA) และห้ามอ้างถึงคู่แข่ง** จนกว่าเจ้าของกำหนด · ตัวอย่าง Service Report เป็น "ตัวอย่าง" ค่าในตารางเป็นตัวอย่างการบันทึก (#12) · งานโครงการ: ราคาจาก Pricebook (ติดตั้งมาตรฐาน + ชุดท่อส่วนเกิน) นอกนั้น "ประเมินหน้างาน" รวมมูลค่าเทิร์นเครื่องเดิม · ขนาดเครื่องในประมาณการ = `recommendBtu` (ค่าประมาณ) | `business.js` |

### 6.7 ขั้นตอนทุกครั้งที่แก้ (Definition of Done)

1. แก้ใน `assets/*` หรือ `a/b/c.html` → ทดสอบบน dev server (หลายไฟล์)
2. `npm run smoke && npm run smoke:mobile && npm run textscan` ต้องผ่าน · ถ้าแตะข้อมูลราคา `npm run recon` ต้อง 0 ผิด
3. ถ้าแก้ฉาก 3 มิติ: ถ่ายภาพจริงตรวจด้วยตา (`tests/story-shots.mjs` หรือหน้า `test-*.html`) ทั้ง desktop และมือถือ, ธีมสว่าง/มืด
4. `npm run build` → เปิด `dist/offline/*.html` ตรวจซ้ำ
5. อัปเดต revision tag ในหัวไฟล์ + บันทึกการเปลี่ยนแปลงใน `SBP-WEB-011_Dev_Handoff_Plan.md`
6. commit ข้อความชัด (เช่น `Rev.09: limit live WebGL contexts to 3 per page`)

---

## 7. Current Status & Pending Bugs

### 7.1 ทำเสร็จล่าสุด (Rev.08 → 08.1, 1 ต.ค. 2569)

- ✅ ห้องบ้านจำลองชุดเดียว (`install3d.js`) ใช้ร่วม B/C — ผนังตัดแบบบ้านตุ๊กตา รางครอบท่อปิดฝาตลอดแนว
- ✅ ช่างทำงาน 4 งาน (`tech3d.js`, `techstory.js`) ตามแบบฟอร์มบริษัท — C1 14 · C2 17 · ติดตั้ง 13 · ซ่อม 10 ขั้น
- ✅ แบบ B ลำดับการทำงาน 3 มิติ 9 ขั้นต่อประเภท (`system3d.js`)
- ✅ วัสดุเหมือนจริง (`matkit3d.js`, `materials3d.js`): O-TWO 0.70 · Aeroflex พิมพ์ชื่อ · PVC ฟ้า · THW 3 สี
- ✅ ขั้นตอนล้างแบบ A ตามหัวข้อแบบฟอร์ม + รายการตรวจ (`services.js`)
- ✅ ตัด "Type L" ออกจากทุกข้อความบนเว็บ (รวมชุดเหมา PIP-PKG-3878) · ช่องโลโก้ทางการ
- ✅ `tools_recon.py` path แบบ relative · เพิ่ม `tests/`, `package.json`, `.gitignore`
- ✅ ผลตรวจ: smoke 0 error ทุกหน้า (1366 + 390) · ไม่มี overflow แนวนอน · textscan สะอาด · recon: สินค้า 705 · ติดตั้ง 173 · ล้าง 234 · ซ่อม 86 → **0 ผิด**
- ✅ Build: a 2,297 KB · b 2,372 KB · c 2,434 KB · หน้าทดสอบ 4,032 KB · เผยแพร่ทั้ง 4 URL แล้ว

### 7.1b ทำเสร็จ Rev.09 (1 ต.ค. 2569 — งานใน Claude Code)

- ✅ **ลองวางแอร์ในห้องของคุณ** (`roomfit.js` + `roomfit3d.js`) ทั้ง 3 แบบ: เลือกรุ่นจาก catalog (หรือ FUJIVA ตัวอย่างตัวเครื่อง) · ห้อง กว้าง × ยาว × สูง · ผนัง/ตำแหน่ง/ความสูง · คอยล์ร้อน → เครื่องตามขนาดสเปก (มี 164 รุ่น ที่เหลือประมาณตามประเภท/BTU และแจ้งบนหน้า), เส้นระยะ, ลมเย็น, แนวท่อผ่านผนัง, ความยาวท่อ + ราคาท่อส่วนเกินจาก Pricebook, ผลตรวจ 5–7 ข้อ, ใส่ใบเสนอราคา/ขอสำรวจ · มุมมอง 3 มิติ / มุมบน / มองตรงผนัง · ใช้งานได้แม้ไม่มี WebGL (ผลตรวจอยู่ใน panel)
- ✅ **ช่องรูปสินค้าทุกรุ่น** (`product-media.js` + `product-media.json` + `assets/products/`) — ยังไม่มีรูป = ภาพเรนเดอร์ 3 มิติของตัวเครื่องกลางตามประเภท (ป้าย "ภาพประกอบ") · build คัดลอกรูปไป `dist/*/products/`
- ✅ **ตัวเครื่อง 3 มิติคมชัดขึ้น**: ตัวเครื่องติดผนังโค้งแบบพรีเมียมเป็นค่าเริ่มต้น (ไม่มีโลโก้ ยกเว้น FUJIVA) · เพิ่มแอร์ตู้ตั้งพื้น `buildFloorUnit`
- ✅ **ศูนย์ความรู้** (`knowledge.js`) 12 หัวข้อ บ้าน/องค์กร พร้อมปุ่ม "ลองเอง" ไปเครื่องมือที่เกี่ยวข้อง
- ✅ **VRV / VRF ติดต่อแยก** ทุกจุด (ศูนย์ราคา, การ์ดบริการ, FAQ, ฟอร์มติดต่อมีหัวข้อ)
- ✅ UX: แถบขั้นตอนลอยเหลือจุดเล็ก (ไม่บังภาพ 3 มิติ) · เมนูแบบ B ไม่ตัดบรรทัด · ภาพแอร์หน้าแรกแบบ C ไม่ทับหัวเรื่อง · ฟอร์มติดต่อมีเรื่อง/รายละเอียด
- ✅ ชุดลิงก์ทดลองพัฒนาแยก (`urls.dev.json`, `npm run build:dev`)
- ✅ **รอบ 2:** B1 แก้แล้ว (`gl-pool.js`, peak ≤ 3) · ลมในภาพ 3 มิติเป็นเส้นมีหาง (`ac3d.makeFlow`, `howitworks3d` SheetFlow/RadialFlow) · ภาพเรนเดอร์สินค้าจัดเฟรมตามสัดส่วน + ตู้ตั้งพื้นมีหน้ากากลม/จอ/ช่องลมกลับชัด + FUJIVA มีภาพตัวเครื่องพร้อมชื่อแบรนด์ · แถบขั้นตอนย้ายไปขอบซ้าย (จอ > 1240px) · มือถือ: ฉาก "ลองวางในห้อง" บูตได้ (เดิมไม่ขึ้นที่จอ ≤1000px เพราะ observer จับ element ที่เป็น `display:contents`), กล้องถอยตามสัดส่วนจอ, ป้ายระยะไม่ล้นกรอบ ซ่อนป้ายรองบนจอเล็ก (ค่าครบใน panel), ปุ่มเลือกเป็นช่องเท่ากัน
- ✅ ผลตรวจรอบ 2: smoke 0 error ทุกหน้า (1366 + 390) · ไม่มี overflow · `webglPeak` A/B/C = 3/3/3 (มือถือ 3/3/2) · textscan สะอาด · recon 0 ผิด
- ✅ **รอบ 3 (คำขอเจ้าของ 1 ต.ค. 2569):**
  - **ขั้นตอนล้าง C1 / C2 แยกเป็นส่วนของตัวเอง** (`#cleanflow` ทุกแบบ, เมนู "ขั้นตอนล้าง") — การ์ดเทียบ C1–C2 (ถอดอะไร ล้างอะไรในเครื่อง ไม่รวมอะไร จำนวนขั้น ราคามาตรฐานต่อเครื่องตามประเภท/ขนาด/แพ็กเกจ + ใส่ใบเสนอราคา) · โต๊ะถอดล้าง 3 มิติทีละขั้น (21 ขั้น C1 / 27 ขั้น C2 สำหรับ Standard Care) · ถาดชิ้นส่วน (อยู่ที่ไหน สะอาดแค่ไหน) · ไทม์ไลน์แยกเฟส ขั้นเฉพาะ C2 เด่นชัด · ลูกศรบนภาพ (มือถือ)
  - **ลมเป็นธรรมชาติ** ทุกฉาก (`wisp3d.js`) — เส้นลมโปร่งเรียวท้าย + ไอเย็นจาง ไหลช้า กระจายตัว แทนจุด/ขีดที่ดูเหมือนสาดน้ำ (ห้องจำลอง ระยะลม ช่างในห้อง ลำดับระบบ แอร์ทำงานอย่างไร ตัวเครื่อง) · ระยะลมที่คำนวณเท่าเดิม
  - **ห้องจำลองติดตั้งแบบ Sims**: ห้องตัวอย่าง 7 แบบ · เฟอร์นิเจอร์ 21 ชิ้น (เตียง ตู้ โซฟา ทีวี โต๊ะทำงาน โต๊ะประชุม ตู้เย็น ชั้นวางสินค้า หน้าต่าง ประตู …) · ลาก/หมุน/ลบในภาพ หรือจากรายการ (คีย์บอร์ดได้) · ลากแอร์ตามผนัง · ลมจริงไหลรอบเฟอร์นิเจอร์ · ผลตรวจเพิ่ม: ของสูงบังทางลม ของใต้เครื่อง ลมเป่าศีรษะขณะนอน/หน้าคนนั่ง ทับหน้าต่าง/ประตู · ของสูงชิดผนังที่ตัดออกจะจางลง · กล้องเห็นทั้งห้อง
  - แก้บั๊กภาพ: ผ้าม่านในห้องระยะลม/ห้องช่าง C เคยนอนตะแคง (กลายเป็นแผงลายขวาง) · ปั๊มสุญญากาศในงานติดตั้ง C เคยตั้งผิดด้าน · เมนู B ตัดหัวท้ายเมื่อยาวเกิน · โลโก้ A ตัดบรรทัด
  - ผลตรวจรอบ 3: smoke 0 error ทุกหน้า (1366 + 390) · ไม่มี overflow · `webglPeak` ≤ 3 · textscan สะอาด · recon 0 ผิด
- ✅ **รอบ 4 (คำขอเจ้าของ 1 ต.ค. 2569):**
  - **ทีมช่างล้าง / ติดตั้ง 3 มิติ** (`jobguide.js` + `jobscene3d.js` + `crew3d.js` แทน cleanguide*): ช่าง 2 คน + ลูกค้า ทำงานเป็นทีมทุกขั้น — ช่างหัวหน้าบนบันไดถอดชิ้นส่วนส่งลงมา ผู้ช่วยรับไปวางโต๊ะ ล้างในอ่าง จับถุงล้าง ล้างคอยล์ร้อน ประกอบกลับส่งขึ้นทีละชิ้น · ติดตั้ง 13 ขั้น (เทปแนว ขายึด/ก้านแขวน/เปิดฝ้า ยกสองคน คอยล์ร้อน ท่อในราง น้ำทิ้ง สายไฟ ไนโตรเจน Vacuum เปิดวาล์ว Test Run เก็บงาน ส่งมอบลงนาม)
  - **4 ประเภท 4 สถานที่**: ติดผนัง = ห้องนอนบ้าน · แขวนใต้ฝ้า = ร้านค้า · สี่ทิศทาง = คาเฟ่ · ตู้ตั้ง = ห้องประชุม/รับรองลูกค้า · เพิ่มวิธีล้างแขวน / สี่ทิศทาง / ตู้ตั้ง (ตู้ตั้งมีชิ้นส่วนภายในถอดได้) · การ์ดเทียบมีราคา Pricebook ทั้งงานล้างและติดตั้ง
  - **ตราบริษัทแบบไม่ชวนขาย**: เสื่อยาง FUJIVA ใต้จุดทำงาน · ป้ายเสื้อ SBP AirCare (อก) + บริษัท สหบูรพากรุ๊ป จำกัด (หลัง) ทั้งในฉากนี้และช่างแบบ C · กล่องเครื่องมือ · ถุงล้าง · ป้ายกำลังให้บริการ (ร้าน/คาเฟ่/สำนักงาน) · แท็บเล็ตรายงาน · ตัวแอร์ไม่มียี่ห้อ
  - **ลมเย็นไปทางไหน: 3 แบบ + สั่งงานได้**: A รีโมตมือถือ (จอ LCD) · B แผงควบคุมห้องติดผนัง (ค่าห้องเฉลี่ย ลมจ่าย ระยะลม คนสบาย) · C แผงสัมผัสกระจก (วงแหวนอุณหภูมิ) — เปิด/ปิด โหมด เย็น/ลดความชื้น/พัดลม/อัตโนมัติ อุณหภูมิ 16–30 ความแรงลม 5 ระดับ บานสวิงขึ้นลง (สวิง/ตำแหน่ง 1–5) สวิงซ้ายขวา · เลือกเครื่องได้ 4 ประเภทในส่วนนี้เอง (เพิ่มตู้ตั้ง) · จอเครื่องในห้องแสดงค่าที่สั่ง · ฟิสิกส์ลมเดิม (`airflow3d` เพิ่ม `louver` / `hswing` ค่าเริ่มต้นเท่าเดิม)
  - รอบ 4.1 (เก็บงาน): ช่างเดินอ้อมกันและอ้อมลูกค้า/บันได/โต๊ะ (`route(a, b, i)` + sidestep ใน crew3d) · ติดตั้งแอร์ตู้ตั้ง: ช่าง 2 คนหิ้วตัวเครื่องเดินไปวางจริง (`carry`) · ลูกค้ายืนกอดอกดูงาน · ลมในฉากช่างจางลง (`createAirflow({alpha})`) · วงแหวนแผงกระจกไม่ใช้ CSS filter
  - ผลตรวจรอบ 4: smoke 0 error ทุกหน้า (1366 + 390) · ไม่มี overflow · `webglPeak` ≤ 3 · textscan สะอาด · recon 0 ผิด
- ✅ **รอบ 5 — เตรียม Beta (คำขอเจ้าของ 2 ต.ค. 2569: "เน้น UX/UI และ feature ให้สมบูรณ์ ใช้งานได้จริง จัดเป็นหมวดหมู่ตาม workflow / customer journey")**
  - **6 หน้าตามการตัดสินใจของลูกค้า** (`site.js`) ทั้ง 3 แบบ: หน้าแรก · ซื้อแอร์ · ล้าง/ติดตั้ง/ซ่อม · สำหรับองค์กร · ความรู้·ลองเอง · ติดต่อเรา (B เรียงองค์กรก่อน + เมนูมีเลข) · ทุกหน้ามีหัวเรื่อง ทางกลับหน้าแรก ปุ่มไปหัวข้อในหน้า และการ์ด "ขั้นต่อไป" ท้ายหน้า · เมนูแท็บเล็ตเป็นแถวที่ 2 ของ header (เดิมหายช่วง 641–1080 px) · มือถือ: แถบล่าง เมนู / ติดต่อ / ใบเสนอราคา
  - **หน้าแรก "วันนี้ต้องการอะไร"**: ล้างแอร์ · ซื้อแอร์ใหม่ + ติดตั้ง · ติดตั้ง/ย้าย · แอร์มีปัญหา · องค์กร/สัญญารายปี · FUJIVA → กดแล้วระบบพาไปทีละขั้น (แถบเส้นทาง + ป้าย "ขั้นที่ n จาก N" ตรงจุดที่ไป + ปุ่มขั้นต่อไป) จำความคืบหน้าไว้
  - **ข้อมูลบริษัท** (`COMPANY` ใน sbp-core.js — แหล่งเดียว): ชื่อไทย/อังกฤษ ที่อยู่ 593 ถ.พระราม 2 โทร 02-459-3291-9 อีเมล Sahaburapa.official@gmail.com เว็บ www.sahaburapa.com · ที่มา: เว็บบริษัท/รายชื่อธุรกิจสาธารณะ (เปิด sahaburapa.com จากเครื่องพัฒนาไม่ได้) — **เจ้าของต้องยืนยัน** · ยังไม่แสดง เลขผู้เสียภาษี / LINE OA / เวลาทำการ จนกว่าเจ้าของส่งข้อมูล
  - **ส่งคำขอแบบซื่อตรง (แก้ B4 ระดับต้นแบบ)**: ฟอร์มติดต่อและใบเสนอราคาไม่บอกว่า "ส่งแล้ว" อีก — แสดงเลขอ้างอิง + สรุปให้คัดลอก/เปิดอีเมล + อีเมล/โทรของบริษัท · ตัด "คิวว่างถัดไป" (A) และ "สถานะทีมวันนี้" (B) ที่เป็นข้อมูลตัวอย่างออก · footer เขียนจาก `COMPANY` (เลิกใช้ "[ใส่เลขจริง]")
  - **แบบฟอร์มความเห็น Beta** (ปุ่ม "ให้ความเห็น" แถบบนและ footer): ใช้ง่าย 1–5 · หาเจอไหม · ส่วนที่ชอบ · ควรปรับ · ติดต่อกลับ → สรุปให้ส่งอีเมล (ระบุแบบ A/B/C และหน้าที่เปิดดู)
  - เครื่องมือทดสอบ: `smoke.mjs` / `textscan.mjs` ไล่ทุกหน้า (view) ของแต่ละแบบ (เดิมเห็นเฉพาะหน้าแรกหลังแบ่งหน้า) · หน้าทดสอบ A/B/C (`preview.html`) เพิ่มรายการทดลอง: เริ่มจากสิ่งที่ต้องการ · ทีมช่าง · ลองวางในห้อง · คัดลอกสรุปใบเสนอราคา · ส่งความเห็น และกระโดดไปหัวข้อในหน้าย่อยได้
  - แก้ระหว่างทาง: แคตตาล็อกเคยเขียน `#catalog` ลง URL ตั้งแต่โหลดหน้า (ตอนนี้เขียนเฉพาะหลังลูกค้ากรอง และเมื่อแคตตาล็อกแสดงอยู่) · แถบล่างมือถือเหลือ 3 ปุ่ม เมนู / ติดต่อ / ใบเสนอราคา (ปุ่ม LINE กลับมาเมื่อมีบัญชี LINE OA)
- ✅ **รอบ 6 — ยกระดับ UX/UI ทุกแบบ (คำขอเจ้าของ 2 ต.ค. 2569: ใช้สกิล UI/UX Pro Max + Frontend Design)**
  - **ค้นหาทั้งเว็บ** (ปุ่ม "ค้นหา" บน header หรือกด `/`): หน้า หัวข้อ เส้นทาง 705 รุ่น (ค้นตามขนาด BTU ±12%) ค่าบริการทุกรายการ (เปิดแท็บราคาพร้อมกรองให้) ความรู้ 12 หัวข้อ FAQ · คีย์บอร์ดครบ (combobox/listbox, Esc, กักโฟกัส)
  - **การ์ด "วันนี้ต้องการอะไร" มีราคาเริ่มต้นจาก Pricebook** และแสดงตามภาษาของแต่ละแบบ: A การ์ด bento · B ตารางทะเบียนแบบ (รหัส S-01… ขั้นตอนเป็นลำดับ ราคา ปุ่ม) · C โซนโชว์รูมกระจกมืด · ทั้งการ์ดกดได้ (ปุ่มเดียวคลุมการ์ด) · หัวเรื่องเป็น h3 ในรายการ
  - **แถบข้อเท็จจริงใต้หัวเรื่องทุกหน้า** (ราคาเริ่มต้น ล้าง/ติดตั้ง/ตรวจเช็ก, จำนวนรุ่น, ยอดขั้นต่ำงานล้าง, รับประกันติดตั้ง 3 ปีเมื่อซื้อเครื่องจากบริษัท, อัตราพิเศษตั้งแต่ 10 เครื่อง) — จากข้อมูลชุดเดียวกับเครื่องมือ
  - **ฟอร์มตรวจช่องกรอกเป็นภาษาไทยข้างช่อง** (ชื่อ เบอร์ 9–10 หลักขึ้นต้น 0 อีเมล จำนวน) ทั้งฟอร์มติดต่อและใบเสนอราคา · ทุกฟอร์มติดต่อบอกเบอร์/อีเมลบริษัทไว้ข้าง ๆ
  - **ไอคอน SVG ชุดเดียว** (`icons.js`) แทน ▶ ❚❚ ✓ ★ ✍ ในปุ่มเล่นขั้นตอน รายการตรวจ ผลตรวจห้อง ปุ่มเทียบรุ่น ฯลฯ
  - **A:** ตัดการ์ดตัวเลขรุ่นและแผนที่ย่อออกจาก hero (ซ้ำกับการ์ดเส้นทาง/หน้าติดต่อ) การ์ดเส้นทางจึงขึ้นมาใกล้จอแรก · **B:** ปุ่มควบคุมภาษาไทยทั้งหมด (เดิม OPEN / CMP / Exploded / Front / Iso / CLEANED) · ตัดข้อความสัญญาว่าแนบไฟล์ Excel ได้ (ไม่มีขั้นนั้นจริง)
  - **Accessibility (axe WCAG 2.2 AA ทุกหน้า):** แก้ ARIA รายการรุ่นใน "ลองวางในห้อง" · ขั้นตอนบริการที่ "ขึ้นกับแพ็กเกจ" เปลี่ยนจากตัวจาง (คอนทราสต์ไม่ผ่าน) เป็นกรอบเส้นประ · กักโฟกัสในหน้าต่างค้นหา/ความเห็น
  - ข้อความ: เมนูไม่มีจุดคั่น ("ล้าง ติดตั้ง ซ่อม", "ความรู้และทดลอง") · บริการติดตั้งเขียน "มาตรฐาน หรือพรีเมียม" (กฎ §6.6 #6 — เดิมมีคำว่าพื้นฐาน) · ขั้นตอนใช้บริการไม่อ้างว่าส่งทาง LINE · ซ่อนแถบขั้นตอนลอยด้านซ้ายเมื่อแบ่งหน้าแล้ว · แถบล่างมือถือ: เมนู / ติดต่อ / ใบเสนอราคา + ปุ่มค้นหาบน header (ปุ่มใบเสนอราคาบน header ซ่อนบนมือถือเพราะซ้ำกับแถบล่าง)
  - ผลตรวจรอบ 6: smoke 0 error ทุกหน้า (1366 + 390, ไล่ครบ 6 หน้า) · ไม่มี overflow · `webglPeak` ≤ 3 · textscan สะอาด · recon 0 ผิด · axe WCAG 2.2 AA 0 violations (A, B, C มืด/สว่าง)
- ✅ **รอบ 7 (คำขอเจ้าของ 2 ต.ค. 2569)**
  - **งานล้าง/ติดตั้งแอร์แขวน สี่ทิศทาง ตู้ตั้ง ให้ตรงหน้างานจริง** (`services.js`, `jobguide.js`, `jobscene3d.js`): ขั้น "ปลด/เข้าถึงเครื่อง" ต่อประเภท — แขวน = เปิดฝาครอบใต้เครื่อง · สี่ทิศทาง = ถอดหน้ากากตกแต่ง · ตู้ตั้ง = ถอดฝาหน้า/แผงข้าง (เครื่องอยู่ที่เดิม · เฉพาะติดผนังที่ปลดแขวนลอย) · ช่างหัวหน้า/ผู้ช่วยทำต่างกันต่อประเภท · ภาพ 3 มิติ: ตัวเครื่องโปร่งให้เห็นใบพัด/คอยล์ขณะเปิด · กล้องมุมต่ำมองขึ้นสำหรับเครื่องบนฝ้า · สี่ทิศทางติดหน้ากากก่อน Test Run · ศูนย์ขั้นตอนบริการเพิ่มแอร์ตู้ตั้งพื้น (ภาพตัด ชิ้นส่วน ขนาด 36–80k ค่าตรวจแจ้งก่อนนัด)
  - **ลองวางแอร์ในห้อง = แบบสำรวจหน้างาน** (`siteplan.js` ใหม่ + `roomfit*.js`): อาคาร/ชั้น · ฝ้า (ยิปซั่มฉาบเรียบ / ทีบาร์ / ไม่มีฝ้า) + ช่องเหนือฝ้า · ผนังที่ติดภายนอกอาคาร (แถบส้มบนสันผนัง — ผนังภายในเจาะออกไม่ได้) · วัสดุผนัง (อิฐ / คอนกรีต / ผนังเบา / กระจก) · แนวท่อ 4 แบบ (เจาะหลังเครื่อง / เดินลอยในราง / เดินบนฝ้า + ช่องเซอร์วิส / ฝังผนัง) ไปจุดเจาะที่เลือกบนผนังใดก็ได้ · คอยล์ร้อน 6 ตำแหน่ง (ระเบียงมีที่เดิน / แท่นวางไม่มีที่เดิน / ขาแขวน / ขาแขวนที่สูง / หลังคา / พื้นดิน) พร้อมความสูงจากพื้นดิน · น้ำทิ้ง 3 แบบ + ปั๊มเมื่อแนวท่อสูงกว่าจุดน้ำทิ้ง · ระยะตู้ไฟ → ความยาวท่อจากแนวจริง + **งานเพิ่มผูกรหัส Pricebook** (มีราคา = แสดงราคา · ไม่มีราคา = "ประเมินหน้างาน" · ไม่เดาขนาดสาย) → ใส่ใบเสนอราคาได้ทั้งรายการราคาและรายการขอประเมิน · **ส่งแบบห้องให้ทีมประเมิน** (สรุปครบทุกค่า + รหัสแบบห้อง `SBP1.` ที่ทีมเปิดแล้วเห็นแบบเดียวกัน) · ห้องใหญ่ขึ้นเฟอร์นิเจอร์เพิ่มตามจริง (ออฟฟิศเป็นแถวโต๊ะ ร้านเป็นทางเดินชั้นวาง ห้องประชุมโต๊ะ 10–12 ที่) · ลากแอร์/หน้าต่าง/ประตู/จุดเจาะเลยมุมไปผนังถัดไป · ลากช่องเซอร์วิสบนฝ้า · มุมมอง "ด้านนอก"
  - ค่าที่ใช้ (STOREY 3 ม./ชั้น, ระยะเอื้อม 3 ม. ตาม Pricebook, ตำแหน่งปั๊ม, ช่องฝ้าขั้นต่ำ 15 ซม.) เป็น **ค่าแนะนำทั่วไปเพื่อประมาณการ** ทีมช่างยืนยันหน้างาน · ไม่มีการเปลี่ยนราคาหรือ `sbp-data.json`
- ✅ **รอบ 8 — ความเร็ว / ค้าง / ภาพ (คำขอเจ้าของ 2 ต.ค. 2569: "หน่วง ช้า เปลี่ยนแอร์ติดผนัง→แขวน→สี่ทิศทาง→ตั้งตู้ บางทีไม่โหลด ค้าง ภาพมีปัญหา")** — วัดด้วยตัวนับ WebGL (shader/texture/buffer สร้าง–ลบ), long task, เวลาคลิกถึงเฟรม ทุกโมดูล ทั้ง 3 แบบ
  - **บั๊กที่ทำให้ค้าง:** ฉากทีมช่าง (`jobscene3d`) โยน error ทุกครั้งที่สลับประเภทจากเครื่องที่มีบันได (dispose ตัวห่อ `{L,h,spec}` แทนบันได) → ช่างไม่ถูกสร้างใหม่ ฉากหยุดวาด (ภาพค้าง) · ชิ้นส่วนเครื่องเก่าที่วางบนโต๊ะค้างอยู่หลังสลับ → แก้ทั้งคู่
  - **ไม่สร้างใหม่ทุกครั้ง:** ห้อง/สถานที่ต่อประเภทสร้างครั้งเดียวแล้วเก็บไว้ (ทีมช่าง · ลำดับการทำงาน B · เครื่องในห้องระยะลม) · คอยล์ร้อนในฉากทีมช่างสร้างครั้งเดียว · ลมใช้ `prewarm()` (คำนวณอย่างเดียว วาดครั้งเดียว) แทนการวาดซ้ำ 160–310 รอบ (ระยะลม · ลำดับ B · ห้องจำลอง · ช่าง C)
  - **ไม่รั่วหน่วยความจำ:** `gl-pool.disposeDeep()` คืน geometry + material + texture ที่ไม่ใช้ร่วม (ตัวเครื่อง/อุปกรณ์/ป้ายเสื้อ/เครื่องมือช่าง/ลองวางในห้อง) · หลัง context กลับมา ล้าง listener เก่าของ three.js (เดิมเตือน "object does not belong to this context" หลายร้อยครั้ง)
  - **ไม่ทำงานที่มองไม่เห็น:** เลือกประเภทในศูนย์บริการแล้วฉากอื่นที่อยู่นอกจอ (แอร์ทำงานอย่างไร · ระยะลม · ลำดับ B) อัปเดตเมื่อเลื่อนไปถึง · ตัวเครื่อง 3 มิติที่อยู่หน้าอื่นบูตเมื่อใกล้จอ (`mountViewer` คืนตัวแทนที่จำคำสั่งไว้) · แผนที่ไม่บล็อกการโหลดหน้า (เดิม `await mountThaiMap` ทำให้ทั้งหน้ารอ) · ภาพสินค้าเรนเดอร์เมื่อการ์ดใกล้จอ และพักระหว่างภาพ
  - **มือถือ:** ความละเอียดวาด ≤1.5× บนจอสัมผัส (≤1.25× เครื่อง RAM ≤3 GB / ≤4 คอร์) · เก็บฉากที่เลื่อนผ่านไว้จนกว่าต้องใช้ช่อง (ลดการโหลดซ้ำ) · live context สูงสุด 4 บนเครื่อง ≥4 GB (3 เมื่อไม่รู้ / iOS, 2 เมื่อ ≤2 GB)
  - **ขนาดไฟล์:** build ฝังเฉพาะฟอนต์ที่แต่ละแบบใช้ — A 2,807→2,436 KB · B 2,887→2,553 KB · C 2,946→2,790 KB · หน้าทดสอบ 4,540→3,304 KB
  - ผลวัด (คอมทดสอบ CPU-render): คลิกประเภทใน "แอร์ทำงานอย่างไร" 450–540 → 40–140 ms · ระยะลม 440–650 → 34–134 ms · ศูนย์บริการ (B) 860–1,150 → 3–5 ms · ลำดับ B ครั้งที่สองขึ้นไป ~1 s → 70–100 ms · error ระหว่างสลับ 8 → 0 · smoke เพิ่มการกดสลับประเภททุกโมดูล (กันถอยหลัง)

- ✅ **รอบ 9 — ราคา / หน้าองค์กร / งานโครงการ / แบรนด์ (คำขอเจ้าของ 2 ต.ค. 2569 พร้อมไฟล์โลโก้ FUJIVA + SP)**
  - **ราคาหลักร้อย ก่อน VAT ทุกราคา** (`r100` ใน `loadData`, Pricebook ไม่ถูกแก้): ราคาที่ขยับ — ล้าง 100 แถวที่ลงท้าย 50 ปัดขึ้น (สูงสุด +9.1%) · ติดตั้ง/วัสดุ 34 รายการ (ขึ้น 29 ลง 5 · อัตราต่อเมตรต่ำกว่า 100 บาท 4 รายการถูกปัดเป็น 100 เช่น สาย Yazaki 1.5 ตร.มม. 55→100 = +82% ← **รอเจ้าของยืนยัน**) · ค่าตรวจวินิจฉัยติดผนัง 850→900 · เครื่องทุกรุ่น/ค่าเดินทาง/ยอดขั้นต่ำเป็นหลักร้อยอยู่แล้ว
  - **ใบเสนอราคาเลือกผู้ซื้อ**: บุคคลทั่วไป (ไม่ต้องการใบกำกับภาษี ชำระตามราคา) / นิติบุคคล (ใบกำกับภาษี + VAT 7% · ช่องชื่อ–เลขผู้เสียภาษีแสดงเมื่อเลือก) · ทุกข้อความ "รวม VAT" เปลี่ยนเป็นราคาก่อน VAT (ศูนย์ราคา สินค้า ตัวคำนวณ ทีมช่าง ลองวางในห้อง ห้องจำลอง แผนที่ ค้นหา FAQ)
  - **ราคาขั้นบันไดสัญญารายปี** (`VOLUME_TIERS` 0/3/5/7% + 100 เครื่องขึ้นไปขอราคาโครงการ) ในตัวคำนวณ (ขั้นปัจจุบัน ประหยัดต่อปี เพิ่มอีกกี่เครื่องได้ขั้นถัดไป) และตารางตัวอย่างงบต่อปี · recon ยืนยันทุกขั้นไม่ต่ำกว่าอัตราพิเศษภายในทุกแถว
  - **หน้าองค์กรใหม่ 3 ส่วน** (`business.js`): `#amc` จุดเด่น 6 ข้อจากเอกสารจริง + ราคาขั้นบันได + เทียบแพ็กเกจ · `#sop` สัญญาหนึ่งปี 6 ขั้น + ขั้นตอนต่อเครื่อง/รายการตรวจจากแบบฟอร์ม (เลือกประเภท วิธีล้าง แพ็กเกจ) + ตัวอย่าง Service Report (Asset/Tag ค่าวัดก่อน–หลัง เกรด A–D ลงนาม 3 ฝ่าย) + เงื่อนไขสัญญา · `#projects` บ้าน/อาคารสร้างใหม่ (เดินท่อรอ 2 ช่วง) · รีโนเวตไม่มีแอร์เดิม · เปลี่ยนแอร์เดิม + เทิร์น — ขั้นตอนงาน เอกสารส่งมอบ ประมาณการทีละห้อง ใส่ใบเสนอราคา/ขอสำรวจ · หน้าแรกเพิ่มการ์ด S-06 "สร้างใหม่ / รีโนเวต / เปลี่ยนทั้งชุด" (เส้นทางใหม่ `project`)
  - **แบรนด์**: โลโก้ SP ที่ header ทุกแบบ + footer (SP + FUJIVA) + การ์ด FUJIVA (A) · สี A/B/C ปรับตามโลโก้ทั้งธีมสว่าง/มืด (น้ำเงิน FUJIVA `#1B51A4` · ส้ม SP/FUJIVA) คงคอนทราสต์ AA · ชุดช่าง/กล่องเครื่องมือ/ป้ายเสื้อในภาพ 3 มิติใช้สีและโลโก้จริง

- ✅ **รอบ 10 — ระบบจองคิว + ticket เข้าหลังบ้าน (คำขอเจ้าของ 2 ต.ค. 2569: "สร้างระบบจองคิวให้แบบส่ง ticket เข้าระบบหลังบ้านบริษัทได้")**
  - **หลังบ้าน = Google Sheet + Apps Script** (`backoffice/apps-script/Code.gs`): ทุกคำขอเป็น 1 แถวในชีต `Tickets` (35 คอลัมน์) เลขที่ `SBP-<ปี พ.ศ. 2 หลัก><เดือนวัน>-<ลำดับ>` · แจ้งอีเมลทีม (+LINE Messaging API, อีเมลรับเรื่องถึงลูกค้า ถ้าตั้งค่า) · public: create / track (เลขที่ + เบอร์) / slots (นับงานต่อช่วง ไม่มีชื่อ) · เจ้าหน้าที่: list / update ด้วย `STAFF_TOKEN` + ประวัติผู้แก้ · กันสูตรในชีต, เบอร์เป็นข้อความ, honeypot, จำกัด 5 ครั้ง/เบอร์/ชม. และ 120/10 นาที, LockService กันเลขซ้ำ · วิธีติดตั้ง `backoffice/README.md`
  - **ส่วน "จองคิว" `#booking`** (หน้า "ติดต่อเรา" ทั้ง 3 แบบ + ปุ่มแถบล่างมือถือ): งาน 7 แบบ + จำนวนเครื่องต่อประเภท + ระดับล้าง/แพ็กเกจ + อาการ/รหัส error + วันทำงานโดยประมาณ (งานล้าง จาก `PRICING.unitsPerTeamDay`) → แถบวันว่าง 14 วัน (เช้า/บ่าย เต็มกดไม่ได้) + วันสำรอง + ช่วง (นอกเวลา = มีค่าแรงเพิ่ม ประเมินหน้างาน · วันอาทิตย์แจ้งเช่นกัน) → ที่อยู่ + ตรวจพื้นที่ (`checkZone`) + อาคาร + ข้อจำกัดเข้าพื้นที่ → ผู้ติดต่อ + ใบกำกับภาษี + แนบรายการใบเสนอราคา + ยินยอม → เลขที่คำขอ + ไทม์ไลน์สถานะ · เส้นทางลูกค้า (ล้าง/ติดตั้ง/ซ่อม/องค์กร/โครงการ) ปิดท้ายด้วยจองคิว · ตะกร้ามีปุ่ม "จองคิวจากรายการนี้" · ปุ่มขอสำรวจในหน้าองค์กร/โครงการเปิดจองคิวพร้อมข้อมูล
  - **ฟอร์มเดิมเป็น ticket**: ติดต่อเรา → `inquiry` · ใบเสนอราคา → `quote` (รายการ + ยอดหลักร้อยก่อน VAT + VAT เฉพาะใบกำกับภาษี + พื้นที่/ค่าเดินทาง) · ความเห็น Beta → `feedback` (ไม่ระบุชื่อได้) · ข้อผิดพลาดที่แก้ได้แจ้งในฟอร์ม · ไม่เชื่อม/ล่ม → สรุปให้ส่งเอง + เหตุผล
  - **หน้าหลังบ้าน** `backoffice.html` (สีแบรนด์ สว่าง/มืด): ตัวเลขสรุป · ตัวกรอง · ตาราง · กำลังทีม 14 วัน (งาน/ความจุ) · รายละเอียดครบ · ยืนยันนัด/จัดทีม/วันนัด/โน้ตภายใน · คัดลอกข้อความยืนยันนัด · ประวัติ · build เป็นไฟล์เดียว `dist/offline/backoffice.html` (ไม่ทำเป็น Artifact)
  - **ทดสอบโดยไม่ต้องมีบัญชี Google**: `tools/gas-emu.mjs` รัน Code.gs ตัวจริง (จำลองการแปลงตัวเลข/สูตรของชีต) · `npm run test:backoffice` 44 ข้อ · `npm run backoffice` · `tests/booking-e2e.mjs` 21 ข้อ ผ่าน A 1366 สว่าง / B 1366 มืด / C 390 สว่าง
  - ข้อจำกัด: **Claude Artifact เรียกเว็บภายนอกไม่ได้** — ลิงก์ทดลองแสดงสรุปให้ส่งเองเสมอ · ส่งจริงเมื่อเปิดจากโดเมนบริษัท/ไฟล์ offline ที่ตั้ง `TICKET_ENDPOINT`

- ✅ **รอบ 11 — แบบ D · Studio (คำขอเจ้าของ 5 ต.ค. 2569: "ใช้เว็บ sbp-aircare-studio…chatgpt.site เอามาพัฒนาให้ดีกว่าเดิมทั้ง frontend และ UX/UI ที่ดียิ่งกว่าเว็บ 100,000$" → เลือก "สร้างแบบ D ใหม่")**
  - ⚠️ เว็บต้นแบบ `sbp-aircare-studio.sahaburapa-official.chatgpt.site` **เปิดจาก environment ไม่ได้** (network policy บล็อก รวมถึง web.archive.org) → สร้างส่วนที่ไม่ขึ้นกับต้นแบบก่อน รอเปิดสิทธิ์โดเมนหรือไฟล์จากเจ้าของเพื่อเทียบทีละส่วน
  - **ใบงาน** (`jobcard.js`) ใน hero: ล้าง (วิธี C1/C2 · 4 ประเภท × ขนาด × จำนวน · แพ็กเกจ) · ติดตั้ง (ประเภท · ขนาด · มาตรฐาน/พรีเมียม · จำนวน) · ซ่อม (ประเภท · อาการ · จำนวน → ค่าตรวจ) · สัญญาองค์กร (จำนวนต่อประเภท · รอบ/ปี · แพ็กเกจ → ราคาต่อปีขั้นบันได + เพิ่มอีกกี่เครื่องได้ขั้นถัดไป) → **จองคิว** (ส่งงาน จำนวน วิธีล้าง แพ็กเกจ หมายเหตุ ให้ฟอร์มจองคิว) หรือ **ใส่ใบเสนอราคา** · ยอดขั้นต่ำงานล้าง 4,500 แสดงเป็นบรรทัดแยก + "ในยอดนี้ล้างเพิ่มได้อีก N เครื่องโดยราคาไม่เปลี่ยน" · เลขที่คำขอขึ้นบนใบงานเมื่อหลังบ้านตอบกลับเท่านั้น · แถบสรุปลอยบนมือถือเมื่อใบงานพ้นจอ
  - **บท** ล้าง (C1/C2 เทียบกัน · ขั้นตอนจากแบบฟอร์มเลือกวิธี/ประเภท/แพ็กเกจ · ตารางราคาต่อเครื่องกดแล้วเข้าใบงาน · เทียบแพ็กเกจเอกสาร · ทีมช่าง 3 มิติเมื่อกด) · ติดตั้ง (ราคาตามขนาด · ขั้นตอน · วัสดุแต่ละระดับ · ลองวางในห้องเมื่อกด) · ซ่อม (ขั้นตอน · ค่าตรวจ · ตัวอย่างราคา · ราคาทั้งหมดในลิ้นชัก) · ซื้อแอร์ (แคตตาล็อก 705 รุ่น) · องค์กร (3 แท็บ: สัญญา+ราคาขั้นบันได / ขั้นตอน+Service Report / งานโครงการ) · จองคิว · พื้นที่ · คำถาม + ฟอร์มติดต่อ (ticket)
  - **ผลวัดความเร็ว** (`dist/offline`, มือถือ 390 px, CPU ช้าลง 4 เท่า, ก่อนรันชุดทดสอบอื่นพร้อมกัน): D แสดงผลแรก 0.8–0.95 วิ · โหลดเสร็จ (DCL) 1.3–1.4 วิ · เวลาที่หน้าค้าง (TBT) 0.59–0.66 วิ · DOM 363 โหนด — เทียบ A 1.1–1.8 วิ / 3.5–6.8 วิ / 4.0–6.2 วิ / 5,473 โหนด (B/C ใกล้เคียง A · วัดซ้ำหลายรอบ) · ไฟล์ D 2,060 KB (ไม่ฝังแผนที่และ IBM Plex Mono) · `build.py` ฝัง `__SBP_TH` เฉพาะหน้าที่ใช้แผนที่ 3 มิติ
  - ผลตรวจ D: smoke 0 error (1366 + 390, `webglPeak` 2/1) · ไม่เลื่อนแนวนอน · textscan สะอาด · axe WCAG 2.2 AA 0 (สว่าง/มืด/มือถือ) · `tests/d-flow.mjs` 16/16 · `booking-e2e` 21/21 (1366 สว่าง + 390 มืด)
  - แก้โมดูลร่วม (ไม่เปลี่ยนพฤติกรรม A/B/C): `booking.preset` รับ `level`/`pkg` + `mountBooking({onSent})` · `ticket.sourceTag` รู้จักแบบ D · `build.py` เลือกฟอนต์จากชื่อในเครื่องหมายคำพูด

- ✅ **รอบ 12 — รุ่นที่ 2: A2 · B2 · C2 · D2 (คำขอเจ้าของ 5 ต.ค. 2569 พร้อมลิงก์เอกสารอ้างอิง claude.ai/artifact/KstwqJu8GHdWS24GxBM8Ng)**
  - ⚠️ เอกสารอ้างอิงเปิดไม่ได้ (อยู่นอกองค์กร — Claude Docs ตอบว่าไม่มีสิทธิ์) และเว็บ chatgpt.site ยังถูก network policy บล็อก → สร้างจากคำบรรยายของเจ้าของ รอไฟล์/สิทธิ์เพื่อเทียบทีละส่วน
  - ⚠️ "4D / 5D / ยิ่งกว่า IMAX" บนเว็บทำได้ในระดับ: ภาพ 3 มิติเรียลไทม์ + แสง/เงา/ระยะชัด/bloom/เกรดสีแบบภาพยนตร์ + กล้องเคลื่อนแบบช็อต + เอียงตามเมาส์ + เสียงลม (กดเปิดเอง) · ภาพเหมือนจริงระดับภาพถ่ายต้องใช้ภาพถ่ายจริงหรือไฟล์ 3 มิติทางการของผู้ผลิต (ต้องมีสิทธิ์)
  - **ภาพ 3 มิติแบบภาพยนตร์** (`cinema3d.js` + `three-pp/`): 4 ฉาก 4 อารมณ์ · 5 มุมกล้องเปลี่ยนเอง (ภาพรวม ใกล้ ทางลม ภายใน ทั้งห้อง) · ลาก/เอียงตามเมาส์ · เปิด/ปิด โหมด สวิง มองทะลุ แยกชิ้นส่วนตามทิศชิ้นส่วนจริง ล้าง (ฝุ่น → ละอองน้ำ → สะอาด) · กล้องถอยอัตโนมัติบนจอแนวตั้ง · framing offset ให้ตัวเครื่องอยู่ข้างข้อความ · WebGL context เดียวต่อหน้า (`stage.js`)
  - **ปรึกษาอาการ** + **โชว์รูมทุกรุ่น** (ดู §4.1) · ภาพนิ่งเปิดหน้า (poster) ทำให้จอแรกไม่รอ WebGL
  - แก้โมดูลร่วมแบบไม่เปลี่ยนพฤติกรรมเดิม: `airflow3d.set({alpha})` · `gl-pool.track().move(el)` · `dstudio` บทล้าง/ติดตั้งรับ `pickTo`/`pickWhere` (ค่าเริ่มต้น "ใบงาน" ของแบบ D เดิม) · `build.py` สร้าง a2–d2 + index2 และฝัง poster
  - ผลตรวจรุ่นที่ 2: `npm run test:v2` 97/97 ทุกแบบ (A2/B2 1366 · C2/D2 390) · axe WCAG 2.2 AA 0 (1366 ทั้ง 4 แบบ + A2/D2 390) · smoke 0 error ไม่เลื่อนแนวนอน (1366 + 390, `webglPeak` ≤ 3 รวมเครื่องมือ 3 มิติที่เปิดเพิ่ม) · textscan สะอาด · แบบ D เดิม `test:d` 16/16 + smoke A/D ไม่ถอยหลัง
  - ความเร็ว (`dist/offline`, มือถือ 390 แบบจอสัมผัส, CPU ช้าลง 4 เท่า, 3 วินาทีแรก): แสดงผลแรก A2 0.36 · B2 0.72 · C2 0.54 · D2 0.70 วิ · เวลาที่หน้าค้าง (TBT) 0.39–0.54 วิ (แบบ D 0.44–0.58) — บนจอสัมผัส ภาพ 3 มิติเริ่มเมื่อเลื่อน/แตะหรือหลัง 3.5 วิ (ภาพนิ่งยืนแทน) · การเปิดเครื่องยนต์ 3 มิติใช้ main thread ~1 วิบน CPU ช้า 4 เท่า (แยกเป็น 2 ช่วง) · ไฟล์ A2 2.5 · B2 2.2 · C2 2.4 · D2 2.3 MB · หน้าทดสอบรุ่น 2 4.5 MB

- ✅ **รอบ 13 — รุ่นที่ 3: A3 · B3 · C3 (คำขอเจ้าของ 6 ต.ค. 2569 — ดู §1.3)**
  - ตัวสร้างหน้า `tools/v3gen.py` + `tools/v3/` · wiring `assets/v3site.js` (9 หน้า, โมดูลโหลดเมื่อเปิดหน้า) · สไตล์ร่วม `assets/v3.css` · หน้าเทียบ `preview3.html` · build.py: `V3`, ฝังภาพ `assets/photos/*.webp`, `index3` (ลิงก์อย่างเดียว)
  - site.js เพิ่มตัวเลือกแบบไม่เปลี่ยนพฤติกรรมเดิม (`viewDefs`, `facts`, `next`, `hubLabel`, รูปหัวหน้า, เส้นทาง `installflow|cleanflow` · `ask|howto`) — ตรวจซ้ำ A 1366 / C 390 smoke 0 error หลังแก้
  - ผลตรวจ: `test:v3` A3 84/84 · B3 86/86 · C3 (390) 83/83 · A3 (390) 84/84 · B3 จากไฟล์ build (`dist/offline`) 86/86 · booking e2e A3 21/21 · smoke 1366 + 390 ทั้ง 3 แบบ 9 หน้า 0 error ไม่เลื่อนแนวนอน (WebGL live 4, peak 5 เท่ารุ่นแรก) · textscan clean · axe WCAG 2.2 AA 0 ทุกหน้า (A3 1366/390 · B3 1366 · C3 390; ปรับ token `--warn` #9E4A0B, `--ok` #166A3B) · ไฟล์ build 2.6–2.8 MB ต่อแบบ, หน้าเทียบ 267 KB
  - ✅ ภาพประกอบ AI ครบ 11 ภาพ (7 ต.ค. 2569 หลังเจ้าของเปิด Network access ให้ `d8j0ntlcm91z4.cloudfront.net`): Higgsfield seedream_5_0_flash 0.5 เครดิต/ภาพ (แผนฟรี ส่งได้ครั้งละ 1 งาน) · ดาวน์โหลด PNG → ครอปตามสัดส่วนใน `photos.json` → webp (กว้าง ≤1,800) ที่ `assets/photos/` → `npm run v3` · hero-c ใช้ภาพทดลองเดิม (job 69ec42eb…) ครอป 21:9 · pg-install สร้างใหม่ 1 ครั้งให้เห็นแฟลร์นัต + บาร์บานแฟลร์ (ภาพแรกเครื่องมือไม่ตรงงานจริง) · เครดิตเหลือ 4

- ✅ **รอบ 14 — ตรวจและพัฒนาให้พร้อมทดลองใช้ทุกแบบ (คำขอเจ้าของ 6 ต.ค. 2569: "จัดทำให้เป็นเว็บพร้อมทดลองใช้งานทั้งหมด ตรวจเช็คพัฒนาให้หมด ทุกรูปแบบ")**
  - **หน้ารวมทดลองใช้** (`preview3.html` → `index3`): ทุกแบบ 11 แบบ (A3 B3 C3 · A B C D · A2–D2) + 6 งานให้ผู้ทดลองลองทำ + ตาราง 9 หน้า · build.py `HUB`: ปุ่ม "หน้ารวมทุกแบบ" ของทุกแบบชี้มาที่ `index3` (เมื่อ url set มี index3; offline = `index3.html`)
  - **ฟอร์มความเห็นทุกแบบ**: ย้ายจาก site.js ไป `assets/feedback.js` (`openFeedback`, `trapFocus`, `mountBeta`) · แบบ D และรุ่นที่ 2 ได้แถบ "ทดลองใช้ (Beta)" + ปุ่มให้ความเห็น + ลิงก์หน้ารวม (แถบอยู่ใน header เมื่อ header เป็น fixed เช่น A2) + ปุ่มให้ความเห็นท้ายหน้า (`[data-feedback]`)
  - แก้ที่พบ: v3 ขาดสไตล์ `.tile` (กล่องพื้นหลังของทุกส่วน) → เพิ่มใน v3.css · ลำดับหัวข้อท้ายเว็บ (h4 → h2 `.sx-fh`) · หัวหน้าที่อยู่นอก `<main>` (C #journey) ได้ role=region · C `--ink-3` #586477 (contrast) · C ป้ายชิ้นส่วนบนภาพหน้าแรกแสดงตลอดเฉพาะจอกว้าง (มือถือป้ายทับกัน) · B ตารางชิ้นส่วน: ชื่อชิ้นส่วนเป็นปุ่ม (แถวตารางมี aria-pressed ไม่ได้) — ⚠️ รอบแรกทำให้หน้า B ค้างเพราะ MutationObserver ฟังการเปลี่ยนที่ตัวเองเขียน → แก้เป็นฟังเฉพาะปุ่มชิ้นส่วนของภาพ + เขียนเมื่อค่าเปลี่ยน · D แถบใบงานล่างจอเป็น `<aside>` · C2 ชื่อรุ่นในโชว์รูมเป็น h2 เมื่ออยู่ใต้ h1 ตรง (`mountShowroom({hl})`)
  - ผลตรวจหลังแก้ (dev server): smoke 1366 + 390 ทั้ง 11 แบบ 0 error ไม่เลื่อนแนวนอน · textscan clean 11 แบบ · test:v3 A3 84/84 (1366, 390) · B3 86/86 · C3 83/83 · test:v2 97/97 (A2 B2 1366 · C2 D2 390) · test:d 16/16 (1366 light · 390 dark) · booking e2e A 21/21, B3 (390) 21/21 · pricing 2454 ราคา 0 ปัญหา · backoffice 44/44 · recon 0 mismatches (ราคาขั้นบันไดไม่ต่ำกว่าเกณฑ์ภายใน) · axe WCAG 2.2 AA + best-practice: 13 จาก 15 การตรวจ = 0 · เหลือ 2 ข้อชั่วคราว (A ความรู้: ป้ายจอรีโมตลอยบนภาพ 3 มิติขณะกระพริบ · A3 ซ่อม: ปุ่ม + ของรีโมตถูกแถบหัวเว็บบังขณะเลื่อน) · ไฟล์ build ทดสอบซ้ำ (dist/offline) A2 97/97 · C3 83/83 · D smoke 0 error
  - publish ชุดพัฒนาใหม่ทั้งหมด 14 ลิงก์ (a b c d index a2 b2 c2 d2 index2 a3 b3 c3 index3) · ชุดที่แชร์ (`urls.json`) ไม่ได้แตะ

- ✅ **รอบ 15 — 3 มิติครบทุกรุ่น + ลื่นทุกแบบ + โหมดทดสอบของเจ้าของ (คำขอเจ้าของ 6 ต.ค. 2569: "พัฒนาให้ละเอียดครบทุก Model และ เตรียมให้ผมทดสอบทุก version ในส่วนของการพัฒนา Lighting effect, Animation, Motion, Movement, 5D, 4D, 3D ให้ smooth ไม่สะดุดติด bug ใดๆ")**
  - ⚠️ ความหมายที่ใช้ (บอกเจ้าของตรง ๆ): 3D = โมเดลหมุน/ลาก/ซูมได้ · 4D = 3D ที่เคลื่อนไหวตามเวลา (ลม ทีมช่างทำงาน ขั้นตอนล้าง กล้องเคลื่อน) · 5D = 4D + ประสาทสัมผัสอื่นที่เว็บทำได้จริง คือเสียงลมในห้อง (WebAudio หลังคลิกเท่านั้น) และสั่นสั้น ๆ บนมือถือ Android (`navigator.vibrate` — iPhone ไม่รองรับ) · ไม่มีกลิ่น/ลม/น้ำจริง
  - **ดูรุ่นนี้แบบ 3 มิติ — ครบ 705 รุ่น ทุกแบบ** (`assets/model3d.js` ใน `productDetail`): ตัวเครื่องแบบกลางตามประเภท (ผนัง 351 · แขวน 178 · สี่ทิศทาง 153 · ตั้งพื้น 23) ขนาดตามสเปกเมื่อมี (164 รุ่น) ไม่มีโลโก้แบรนด์ · เปิด/ปิด โหมด สวิง 5 มุมกล้อง มองทะลุ แยกชิ้นส่วน ดูการล้าง เสียงลม · ภาพยนตร์ 3 มิติตัวเดียวต่อหน้าย้ายไปตามแผง (ไม่สร้าง renderer ใหม่ทุกครั้ง) · เปิดค้างไว้เมื่อเปลี่ยนรุ่น/ขนาด · ไม่มี WebGL → ซ่อนปุ่ม แสดงปุ่มเดิม "ดูข้างในแบบ 3 มิติ"
  - **แผงทดสอบความลื่น** (`assets/perfhud.js`, ปุ่ม "ทดสอบความลื่น" ในแถบ Beta ทั้ง 11 แบบ หรือ `#perftest` ท้ายลิงก์ · หน้ารวม index3 มีส่วนใหม่พร้อมลิงก์ทุกแบบ): ตัวเลขสด + กราฟเวลาเฟรม · ทัวร์อัตโนมัติทุกส่วน · ไล่ดูครบทุกรุ่น · ล็อกความละเอียด · ส่งผลให้ทีมผ่านฟอร์มความเห็น (`openFeedback({note})`)
  - **ความลื่น** (สาเหตุหลักที่วัดได้ = GPU คอมไพล์ shader ตอนกดสลับ/ฉากเปิดครั้งแรก):
    - `gl-pool`: ความละเอียดปรับเองตามเฟรมที่มาช้า · เฟรมแรกคอมไพล์ขนาน (ไม่บล็อกหน้า) · คอมไพล์ส่วนที่ซ่อนตอนผู้ใช้หยุดแตะ · ไม่อ่าน log shader นอกการทดสอบ
    - เตรียมล่วงหน้าตอนผู้ใช้หยุดแตะ (`whenCalm` + `warm`): หลักการทำงาน 3 ประเภท · ภาพยนตร์ 3 มิติ 4 ประเภท · ระบบแอร์ทั้งบ้าน (B) 3 บ้าน · สตูดิโอ 4 ประเภท · ทีมช่างหน้างาน 4 สถานที่ · ระยะลมในห้อง 4 ประเภท · ตัวเครื่อง/คอยล์ร้อน + มองทะลุ (ac3d) · ทุกฉาก: ส่วนที่ซ่อนอยู่ (อุปกรณ์ขั้นถัดไป งานติดตั้ง บ้านประเภทอื่น) คอมไพล์ตอนผู้ใช้หยุดแตะ (`warmHidden`)
    - ไม่สร้างซ้ำ: cinema3d เก็บตัวเครื่องไว้ต่อประเภท (เปลี่ยนรุ่น = ปรับขนาด) · `disposeLater` แทนการคืนทันที (ทีมช่าง, สตูดิโอ) ให้ shader ไม่ถูกลบแล้วคอมไพล์ใหม่ทุกครั้งที่สลับ · สตูดิโอคืน geometry ของเครื่องที่ถูกแทน (เดิมค้างบน GPU)
    - เปิด "ดูรุ่นนี้แบบ 3 มิติ" แล้วฉากอื่นในหน้าหยุดวาดชั่วคราว (`glFocus`) — GPU ทำงานให้ภาพเดียว · งานเตรียมล่วงหน้าทุกฉากเข้าคิวเดียว ทำทีละงานตอนผู้ใช้หยุดแตะ ไม่เริ่มใน 3 วิแรกของหน้า
    - แก้บั๊กที่พบระหว่างทดสอบ: ตัวลดความละเอียดเคยหยุดวัดเมื่อเฟรมช้ากว่า 0.5 วิ (เครื่องช้ามาก = ไม่เคยลด) → วัดต่อและตัดสินทุก 3 วิเมื่อเฟรมช้า · ฉากที่สร้างตอนระบบลดความละเอียดอยู่แล้ว เคยถูกเรียก callback ก่อนโมดูลพร้อม (ลองวางในห้องของ B บนมือถือขึ้นไม่ได้) → ตอนสร้างตั้งค่าเฉย ๆ ไม่เรียก callback · ภาพสินค้าคืน WebGL ทันทีหลังเรนเดอร์ (ไม่รอเข้ารหัสภาพ) ให้ WebGL พร้อมกันไม่เกินเดิม
    - ภาพสินค้า (product-media): เข้ารหัสภาพแบบ async (`toBlob`) + เก็บไว้ในเบราว์เซอร์หลังเข้าครั้งแรก (ครั้งต่อไปไม่ต้องสร้าง WebGL)
  - ผลวัด (เครื่องทดสอบ swiftshader, กดปุ่มหลังเปิดหน้า 45 วิ, จำลองการแตะก่อนกด — เวลา GPU คอมไพล์ shader ที่เกิด "ตอนกด"): หลักการทำงาน (B) สลับเป็นแขวน 4.8 วิ → 0 · สี่ทิศทาง 0.27 วิ → 0 · ทีมช่างหน้างาน (B) สลับงานล้าง→ติดตั้ง 1.9 วิ → 0 · สลับประเภท 4 แบบ 1.0–1.7 วิ ต่อครั้ง → 0 ทุกครั้ง · ภาพ 3 มิติหน้าแรก A แตะชิ้นส่วน (ชิ้นอื่นโปร่ง) 3.0 + 2.5 วิ → 0 · ดูข้างในเครื่อง 2.5 + 1.3 วิ → ≤ 1.1 วิ (ครั้งแรกเท่านั้น) (งานหลักของปุ่มเหลือ 0.1–0.4 วิบนเครื่องทดสอบ) · ครบทุกรุ่น 705/705 สร้างภาพได้ ไม่มีข้อผิดพลาด (ผนัง 351 · แขวน 178 · สี่ทิศทาง 153 · ตั้งพื้น 23; เปลี่ยนรุ่นเฉลี่ย 0.3–0.45 วิบน swiftshader จากเดิม ~2 วิ เพราะไม่สร้างตัวเครื่องใหม่) · ไม่มี GPU object เพิ่มระหว่างรอบกดซ้ำ (C ทุกส่วน 0)
  - ผลตรวจรอบสุดท้าย (dev server): smoke 1366 + 390 ทั้ง 11 แบบ 0 error ไม่เลื่อนแนวนอน (WebGL live ≤ 4) · textscan clean 11 แบบ · test:v3 A3 84/84 (1366, 390) · B3 86/86 · C3 83/83 · test:v2 97/97 ทั้ง 4 แบบ · test:d 16/16 (1366 สว่าง, 390 มืด) · ครบทุกรุ่น 705/705 · ไฟล์ build (`dist/offline/a3.html`): แผงทดสอบเปิดจาก `#perftest` ได้ ไล่ทุกรุ่นทำงาน "ดูรุ่นนี้แบบ 3 มิติ" ทำงาน
  - เครื่องมือวัด: `tests/perf3d.mjs` (ต่อส่วน: งานค้างตอนเปิด/ตอนกด, จังหวะเฟรม, GPU object ที่เพิ่มระหว่างรอบ 1→2 = รั่ว) · `tests/models3d.mjs` (ครบทุกรุ่นผ่านแผงทดสอบ) · ผลวัดก่อน/หลังดู §7.1b รอบ 15 ผลตรวจ (ด้านล่าง)
  - ⚠️ ข้อจำกัดที่ต้องรู้: เครื่องทดสอบอัตโนมัติใช้ WebGL แบบซอฟต์แวร์ (swiftshader) — ตัวเลขเฟรม/คอมไพล์ช้ากว่ามือถือจริงหลายเท่า ใช้เทียบก่อน/หลังเท่านั้น ต้องให้เจ้าของลองบนเครื่องจริงด้วยแผงทดสอบ · Safari ไม่รายงาน long task · iPhone ไม่สั่น


- ✅ **รอบ 17 — ภาพสมจริง + จัดหน้า แสง อารมณ์ภาพ A3–C3 (คำขอเจ้าของ 7 ต.ค. 2569: "ภาพไม่เสมือนจริงเลย มันดู Fake และ ไม่ Realistic … ไม่เอาแบบ AI จ๋าเกินและจัดตำแหน่ง จัดหน้ากระดาษ ทุกอย่าง พัฒนา Lighting Mood tone design และ effect ให้ละเอียดดีกว่านี้")**
  - **ภาพ**: สร้างใหม่ 8 ภาพแบบภาพถ่ายสารคดี (hero-a/b/c, pg-shop, pg-business, pg-contact, pg-install, pg-pricing) — prompt บังคับ "ภาพจริงที่เจ้าของบ้าน/ช่างถ่าย" ห้องไทยที่มีคนใช้ รางครอบท่อ PVC ของวางทั่วไป แสงผสม เกรน จัดเฟรมไม่เป๊ะ ไม่ใช่ CGI ไม่มี HDR ไม่มีโลโก้/ตัวอักษร · ภาพเดิม 3 ภาพเกรดใหม่ (pg-repair ครอปเหลือมือ+เกจ+วาล์ว) · `tools/photofinish.py` = ชุดเกรดเดียวกันทุกภาพ + inpaint ลบเครื่องหมายคล้ายยี่ห้อ (ภาพราคา: ตัวเครื่องติดผนังและตู้ตั้ง) · `photos.json` alt/prompt ตรงภาพใหม่ (ภาพสี่ช่อง: ร้านก๋วยเตี๋ยวออกมาเป็นสี่ทิศทาง ไม่ใช่แขวน — alt เขียนตามภาพจริง) · เครดิต Higgsfield = 0 (แผนฟรี)
  - **จัดหน้า/แสง/เอฟเฟกต์ (CSS เท่านั้น ไม่แตะ site.js — A/B/C ไม่เปลี่ยน)**: หัวทุกหน้าข้อความกึ่งกลางแนวตั้งข้างภาพ 3:2 · มือถือหัวเรื่องก่อนภาพ · ชั้นแสงต่อแบบผ่าน token `--ph-light/--ph-blend/--ph-shadow/--ph-filter/--ph-pos/--ph-cap-*` · ภาพเข้าที่ตอนเปิดหน้า + hero ขยับตามการเลื่อน (`animation-timeline: view()`) · A3 แถบแสงแดดลอดหน้าต่าง · B3 แผ่นภาพคู่มือ (กรอบเส้นห่าง ป้ายหมึก) hero 2:1 · C3 ภาพแขวนกรอบขาว + สปอตไลต์ · รายละเอียด HANDOFF §3.1d

- ✅ **รอบ 18 — A · B · C ต้นฉบับ ตรวจแบบวัดค่าและพัฒนาทุกจุด เน้น C (คำขอเจ้าของ 7 ต.ค. 2569: "ผมต้องการพัฒนา โมเดล A B C แต่มุ่งเน้นไปทาง C … ใช้ Frontier UX UI skill ทุกอย่าง … พัฒนา ทั้งความคมชัด รายละเอียดแต่ละส่วน โดยแบ่งเป็นการตรวจเช็คและพัฒนาทุกจุด" · ยืนยันว่าเป็นชุดต้นฉบับ A/B/C ไม่ใช่ A3–C3)**
  - **ตรวจ** (ui-ux-pro-max + frontend-design): ภาพหน้าจอทุกหน้า 1366/390 ธีมมืด/สว่าง + สคริปต์วัดค่าที่ความละเอียดจอจริง (DPR 2–3): ภาพ/canvas ที่ความละเอียดไม่พอ · ข้อความ < 12 px · เป้ากด < 44 px บนจอสัมผัส · ข้อความถูกตัด · เมนูล้น · error · เลื่อนแนวนอน — พบ: h1 ของหน้าเล็กกว่า h2 ส่วนแรกทุกหน้า · หัวข้อไทยฉีกคำ · ข้อมูลสำคัญหน้าตาเหมือนปุ่ม · ข้อความ 10–11.5 px 26–57 จุดต่อหน้า · เป้ากดเล็ก 23–65 จุดต่อหน้า (มือถือ) · 3 มิติบนมือถือ 1.5× · ภาพสินค้า 720 px · C มือถือจอแรกเป็นกล่องดำ · เมนู B ล้นทุกจอ, A/C ล้นช่วง 1081–1239 px
  - **แก้** (รายละเอียดใน HANDOFF §3.1 แถว ★r18): หัวหน้าทุกหน้าตามภาษาของแต่ละแบบ (C ทางเข้าโชว์รูม · A แบบ bento · B title block) · `typeset.js` ใหม่ · ตัวอักษรขั้นต่ำ · เป้ากด 44 px · `gl-pool.PR_CAP` 2× บนมือถือแรง (RAM ≥ 6 GB หรือ ≥ 6 คอร์เมื่อเบราว์เซอร์ไม่บอก RAM) · `product-media` 1080×720 + key แคชใหม่ `sbp-shots-r18` (ลบ `sbp-shots-r15`) · C hero มือถือ grid: หัวเรื่อง → ภาพ → ปุ่มควบคุม + เงาตัวเครื่องระหว่างโหลด · เมนูแถวที่ 2 ช่วงจอกลาง · ไม่แตะราคา/ข้อมูล/กฎธุรกิจ

- ✅ **รอบ 19 — เก็บงานค้างทั้งหมด + ทดสอบใหม่ครบทุกจุด (คำขอเจ้าของ 7 ต.ค. 2569: "ทดสอบแก้ไขทุกอย่างที่ยังไม่ได้ทำและ test ใหม่ครบทุกจุด")**
  - **แก้:** B3 มุมกล้องช่าง (C techstory — ดู §7.2) · C มือถือ ภาพ 3 มิติหน้าแรกกึ่งกลาง สูง 50vh · `ac3d` มุมมองต่อเนื่องระหว่างจอแนวตั้ง–แนวนอน (สัดส่วน 0.9–1.25 ตัวเครื่องเคยล้นขอบ) · **A/B ธีมมืดไม่มีสีสถานะ** (`--ok/--warn/--bad` ใช้สีของธีมสว่างบนพื้นมืด — axe A มืด 46 จุด: ราคาที่เพิ่มขึ้นในตารางเทียบ, "ประเมินหน้างาน", ผลตรวจ) → กำหนดค่ามืดเท่า C · **ชื่อคลาสชนกัน**: `.ping` ของ A (จุดสถานะเขียว 9 px) ทำให้จอเครื่องในห้องระยะลม (`throwsim3d`) หดเป็นจุดเขียวทุกครั้งที่กะพริบ → เปลี่ยนเป็น `.tsim-ping` + ซ่อนจอจนกว่าภาพ 3 มิติวางตำแหน่ง · ตัวอักษรที่ยังต่ำกว่าเกณฑ์: แผงควบคุม `.tctl-*` 12 px · ปุ่มเปิด/ปิดรีโมต 12.5 px · แถบสีอุณหภูมิ 12 px · เลขชิ้นส่วนบนภาพ 3 มิติ 12 px · แกนกราฟ `.pad .ax` (A/B) 12 px · ตัวอักษรกรอบแบบ B `.zone` 12 px (`aria-hidden`)
  - **ผลตรวจ (dev server, ทุกแบบ):** smoke 1366 + 390 ทั้ง 11 แบบ (22 รอบ) 0 error ไม่เลื่อนแนวนอน · textscan clean 11 แบบ · test:v3 A3 84/84 (1366, 390) · B3 86/86 · C3 83/83 · test:v2 A2 94/94 · B2 95/95 · C2 90/90 · D2 98/98 (รอบแรก D2 ไม่ผ่าน 1 ข้อ: แผนที่ 3 มิติสร้างไม่ทันใน 60 วิ ระหว่างรันชุดทดสอบอื่นพร้อมกัน — รันเดี่ยวผ่าน) · test:d 16/16 (1366 สว่าง · 390 มืด) · booking e2e 21/21 (A 1366 สว่าง · B 1366 มืด · C 390 มืด) · test:backoffice 44/44 · pricing 2,454 ราคา 0 ปัญหา · recon 0 mismatches (ราคาขั้นบันไดไม่ต่ำกว่าเกณฑ์ภายใน) · **axe WCAG 2.2 AA + best-practice** ทุกหน้า: A สว่าง/มืด 1366 = 0 · B สว่าง/มืด 1366 = 0 · C มืด/สว่าง 1366 = 0 · B สว่าง 390 = 0 · B มืด 390 = 0 · C มืด 390 = 0 · A3 1366 = 0 · A สว่าง 390 = 1 (`target-size`: ปุ่ม "ปลายทางน้ำทิ้ง" ถูกแถบล่างมือถือบังบางส่วน ณ ตำแหน่งเลื่อนตอนสแกน — วัดตรงเมื่ออยู่ในจอ 284×51 px ไม่มีอะไรทับ) · **วัดค่า (DPR 2 จอใหญ่ / 3 มือถือ)** A/B/C ทุกหน้า: ตัวอักษร < 12 px 0 (หลังแก้) · ปุ่ม < 44 px 0 (เหลือช่องดักบอท honeypot 1×1 ที่ซ่อนโดยตั้งใจ) · ข้อความถูกตัด 0 · เลื่อนแนวนอน 0 · ภาพ: โลโก้ FUJIVA 84% บนจอ 3× (ไฟล์ต้นฉบับกว้าง ~300 px — รอไฟล์ละเอียด §7.3 #18) · canvas 3 มิติ 60% = ระดับความละเอียดปรับเองของ swiftshader (ไม่ใช่ค่าบนเครื่องจริง) · ไฟล์ build (`dist/offline`) A/B/C เปิดได้ 0 error
  - ภาพตรวจด้วยตา: ติดตั้งขั้น 2/4/5/6 ที่ 1100×760 · 1366×900 · 390×844 · ตรวจซ่อมขั้น 7 · C มือถือหน้าแรก สว่าง/มืด
  - publish ชุดพัฒนาใหม่ทั้ง 14 ลิงก์ (`urls.dev.json`) · ชุดที่แชร์ (`urls.json`) ไม่ได้แตะ

### 7.2 บั๊ก / ปัญหาที่ยังค้าง (เรียงตามความสำคัญ)

| # | ปัญหา | ผลกระทบ | หลักฐาน / จุดที่ต้องดู |
|---|---|---|---|
| ~~B1~~ | ✅ **แก้แล้ว Rev.09** — `gl-pool.js` คุม live context ≤ 3 (เครื่อง `deviceMemory ≤ 2` = 2) · smoke ทุกหน้า: `webglPeak` ≤ 3 ทั้ง 1366 และ 390 · smoke นับใหม่จาก context ที่สร้างจริง (`webglCreated`) และที่ live (`webgl`) — context เลิกนับทันทีที่เรียก `loseContext()` (event มาช้าได้หลายวินาทีบน swiftshader) · ผ่านทั้งโหมดหลายไฟล์และไฟล์ build | ยังต้องทดสอบเครื่องจริง (B2) | `assets/gl-pool.js` · `tests/smoke.mjs` |
| B2 | **ยังไม่ทดสอบบนมือถือจริง** (ทดสอบแค่ headless swiftshader) — ไฟล์ละ ~2.3–2.4 MB + ฉาก 3 มิติหนัก | ความเร็วโหลด/เฟรมเรตบน Android ราคาประหยัดไม่ทราบ | ต้องทดสอบเครื่องจริง 2–3 รุ่น |
| ~~B3~~ | ✅ **แก้แล้ว r19** — `CAMS.boxes` / `CAMS.cdu` ถอยกล้องให้เห็นช่างทั้งตัว · ขั้นติดราง/เดินท่อ ช่างทำงานบนบันได (`unit` + `ladder: 1`) แทนยืนหลังผนังกั้น · ตั้งคอยล์ร้อน/ตรวจคอยล์ร้อน ช่างนั่งยอง (`crouch`) + `ghost` ในขั้นตั้งขาตั้ง | — | `node tests/story-shots.mjs out install 1,3,4,5 1100 760 dark` |
| B4 | 🟡 ★r10 **มีระบบ ticket แล้ว แต่ยังไม่ได้ติดตั้งในบัญชี Google บริษัท** และลิงก์ Artifact ส่งออกไม่ได้ — ระหว่างนี้แสดงสรุปให้ส่งเอง (`handoffBox`) | เปิด beta บน Artifact = ลีดยังขึ้นกับลูกค้า · ต้องติดตั้ง Apps Script + ตั้ง `TICKET_ENDPOINT` + โฮสต์บนโดเมนบริษัท | `backoffice/README.md`, `assets/ticket.js` |
| B5 | **สคริปต์แปลง Excel → `sbp-data.json` ไม่อยู่ใน repo** (ทำแบบ ad-hoc) | แก้ราคารอบหน้าต้องเขียนใหม่ เสี่ยงผิด | ดู §8 ข้อ 6 |
| B6 | `tools_recon.py` ต้องใช้ `internal/sbp_real.json` (มีอัตราพิเศษ/โครงการ — ไฟล์ภายใน ส่งแยกจาก zip) | รัน recon ไม่ได้ถ้าไม่มีไฟล์ | วางไฟล์ที่ `internal/` (gitignored) |
| B7 | ระยะทางใช้พิกัดอำเภอโดยประมาณ × 1.35 | ค่าเดินทางคลาดได้ในพื้นที่ขอบโซน | production ใช้ Google Distance Matrix |
| ~~B8~~ | ✅ r14 axe ทุกแบบ 0 · ✅ r19 best-practice ที่ค้าง 2 ข้อหมดแล้ว (ป้ายจอเครื่องในห้องระยะลมซ่อนจนกว่าวางตำแหน่ง · A3 ซ่อม 0) | — | axe wcag22aa + best-practice ทุกหน้า (scratch) |
| B9 | ไฟล์ legacy: `index.html`, `hub.tpl.html`, `hub.tpl2.html`, `hub-local.html` | สับสน | ลบหลังเจ้าของยืนยัน |
| B10 | หน้าทดสอบ (`dist/art/index.html`) 4 MB เพราะฝัง 3 แบบ (gzip+base64) | โหลดช้าบนมือถือ | ใช้ภายในเท่านั้น ไม่ขึ้นเว็บจริง |

### 7.3 เรื่องที่รอเจ้าของตัดสิน/ส่งข้อมูล (ห้ามเดา — ถ้าเจอให้ถามหรือข้าม)

1. ★r13 เลือกแบบจากหน้าเทียบ `index3` (ภาพประกอบรุ่นที่ 3 ครบแล้ว 7 ต.ค. 2569)
1. **เลือกแบบ A / B / C / D** (หรือผสม) · ★r12 หรือรุ่นที่ 2 **A2 / B2 / C2 / D2** (`preview2.html`) · ส่งสิทธิ์เปิดเอกสารอ้างอิง claude.ai/artifact/KstwqJu8GHdWS24GxBM8Ng (หรือ export/วางเนื้อหา) เพื่อเทียบทีละส่วน · ถ้าต้องการภาพสินค้าเหมือนจริงระดับภาพถ่าย: ภาพถ่ายจริงหรือไฟล์ 3 มิติทางการ (GLB) ของผู้ผลิตที่มีสิทธิ์ใช้ · ★r11 ส่งภาพหน้าจอหรือเปิดสิทธิ์โดเมนเว็บ SBP AirCare Studio (chatgpt.site) เพื่อเทียบกับแบบ D ทีละส่วน
2. **อนุมัตินำราคาใหม่ SBP-PRC-001 ขึ้นเว็บ** (ชุดเตรียมราคา 30 ก.ย. 2569 อยู่ใน Project docs) — ระบบตรวจความปลอดภัยของ Cowork ไม่อนุญาตให้แก้ราคาโดยไม่มีคำยืนยันชัดเจน · ★2 ต.ค. 2569 ตรวจแล้ว → **Rev.02** (workbook ผลตรวจ + ชุดสคริปต์ทำซ้ำ อยู่นอก repo — มีข้อมูลภายใน): Rev.01 ลดราคาจากตลาดแหล่งเดียว 131 รายการ + ขึ้นราคาจากการปัดเศษ 1 รายการ → แก้ใน engine แล้ว · รอเจ้าของตัดสิน 7 เรื่อง (C2 ล้างใหญ่ · ติดตั้งผนัง 9–24k · ค่าตรวจ · กติกาเครื่อง · +7%/+10% · อัตราภายใน · การปัดเศษ) · ข้อมูลจำลองบนเว็บผ่าน `loadData()` แล้ว แต่ **ยังไม่แตะ `sbp-data.json`**
3. **ความหนาท่อ 7/8"** ในชุดเหมา PIP-PKG-3878 (แอร์ 49,000–60,000 BTU) และตารางความหนาท่อ R32 ตามคู่มือผู้ผลิต — ถ้าบางขนาดต้องหนากว่า 0.70 มม. ต้องเพิ่มรายการใน Pricebook
4. **ไฟล์โลโก้ทางการ + หนังสืออนุญาต** 6 แบรนด์วัสดุ
5. **ราคา FUJIVA ทุกรุ่น** (แบรนด์บริษัท ยังไม่อยู่ใน Pricebook)
6. Pricebook ต้นทางยังเขียน "K Copper" 28 จุด — ต้องแก้เป็น O-TWO ให้ตรงเว็บ
7. หัวหน้าช่างอ่านทวนขั้นตอนช่าง 4 งาน · ภาพถ่ายงานจริงของทีม (งานละ 3–5 ภาพ)
8. อัตราฝุ่น/ตัวคูณแดดในห้องจำลองเป็นค่าตั้งต้น ควรปรับจากข้อมูลงานล้างจริง (ค่าก่อน–หลังล้าง T2 20–30 เครื่อง)
9. ห้องน้ำ / ห้องพักผู้ป่วย / ห้องควบคุมพิเศษ — บริษัทรับขอบเขตไหน (ตอนนี้ขึ้น "ต้องสำรวจก่อน")
10. ★Rev.09 **รูปสินค้าจริง** ทุกรุ่น/ซีรีส์ (วาง `assets/products/` + `product-media.json`) และรูป FUJIVA
11. ★Rev.09 **ขนาดคอยล์เย็น (indoorDim)** ขาด 541 จาก 705 รุ่น — ห้องจำลองติดตั้งใช้ขนาดประมาณแทน · ค่า `maxPipe` / `maxLift` ยังว่างทุกรุ่น
12. ★Rev.09 หัวหน้าช่างตรวจ `FIT_RULES` (ระยะห่างฝ้า/ผนัง ความสูงติดตั้ง ระยะลม) และเนื้อหาศูนย์ความรู้ 12 หัวข้อ · ★r7 ค่าในแบบสำรวจหน้างาน `siteplan.js` (ชั้นละ 3 ม. · ขาแขวนเกิน 3 ม. = งานสูง · ช่องฝ้าขั้นต่ำ 15 ซม. · ช่องเซอร์วิส 60×60 · เมื่อไรต้องใช้ปั๊มน้ำทิ้ง · งานเพิ่มที่ผูกกับรหัส Pricebook แต่ละกรณี) และกำหนดราคาให้รายการที่ยังเป็น "ประเมินหน้างาน" (CIV-CEIL, CIV-CORE, CIV-CHASE, CIV-PATCH, ACC-*, SUP-*) ถ้าต้องการให้ลูกค้าเห็นราคาประมาณ
13. ★Rev.09 r4 หัวหน้าช่างตรวจ `CLEAN_HOW` / `INSTALL_HOW` (วิธีทำต่อประเภท) และการแบ่งงานช่างหัวหน้า/ผู้ช่วยในส่วน "ทีมช่าง" · ไฟล์โลโก้ทางการ FUJIVA / SBP (`assets/logos/fujiva.png`, `sbp.png`) ถ้าต้องการใช้แทนตัวอักษร
14. ★Rev.09 r5 **ยืนยันข้อมูลบริษัท** (`COMPANY`): ที่อยู่ 593 ถ.พระราม 2 (ข้อความส่วนพื้นที่ยังเขียน "พระราม 2 ซอย 31" — ตรงกันไหม) · ส่ง เลขผู้เสียภาษี · LINE OA · เวลาทำการ · โลโก้บริษัท · ภาพทีม/หน้างานจริง
15. ★Rev.09 r9 **การปัดหลักร้อย** — ยืนยันวิธีปัด (ตอนนี้ปัดครึ่งขึ้น: 50 ขึ้นเป็น 100) และอัตราต่อเมตร/ต่อชิ้นที่ต่ำกว่า 100 บาท (สาย Yazaki 1.5/2.5 · สายดิน 2.5 · ท่อ PVC 3/4" ถูกปัดเป็น 100) — ทางเลือก: คงอัตราต่อเมตรเดิมแล้วปัดเฉพาะยอดรวมต่อบรรทัด · แนะนำแก้ Pricebook Excel ให้เป็นหลักร้อยตรงกับเว็บ เพื่อให้ใบเสนอราคาทีมขายตรงกัน
16. ★Rev.09 r9 **VAT ลูกค้าบุคคล (B2C) — ความเสี่ยงกำไร** — บริษัทจด VAT ต้องนำส่ง VAT ของยอดขาย B2C ด้วยแม้ไม่ออกใบกำกับภาษีเต็มรูป → เงินที่ลูกค้าบุคคลจ่ายถือว่ารวม VAT แล้ว รายได้สุทธิ = ราคา ÷ 1.07 · รายการที่เป็นหลักร้อยอยู่แล้ว (เครื่องทุกรุ่น ค่าติดตั้ง) รายได้สุทธิลด ~6.5% เทียบเดิม เช่น เครื่อง 9,500: เดิมลูกค้าจ่าย 10,165 (สุทธิ 9,500) ตอนนี้จ่าย 9,500 (สุทธิ 8,879) — เครื่องตั้งราคาตลาด +7% จึงแทบไม่เหลือส่วนต่าง · ค่าล้างที่ปัดขึ้นจาก …50 ชดเชยได้บางส่วน (650→700 สุทธิ 654) · **ต้องยืนยันกับนักบัญชี** และตัดสินว่าจะ (ก) คงตามนี้ (ข) ตั้งราคาเว็บเป็นราคารวม VAT สำหรับ B2C หรือ (ค) ปรับราคาเครื่องบนเว็บ
17. ★Rev.09 r9 **ราคาขั้นบันได** 3/5/7% — ยืนยันขั้นและเปอร์เซ็นต์ (ตัวเลขเทียบเกณฑ์ภายในอยู่ในผล recon ที่รันในเครื่อง ไม่บันทึกในเอกสาร) · จุดเด่นที่ต้องการเพิ่ม (เวลาเข้างานฉุกเฉิน / SLA, จำนวนทีม, ประกันภัยงาน) ต้องมีข้อมูลจริงก่อนขึ้นเว็บ · มูลค่าเทิร์นเครื่องเดิมใช้หลักเกณฑ์อะไร · ราคาสำหรับงานเดินท่อรอ (rough-in) และงานรื้อ (REM-*, DISPOSE, REF-PUMPDOWN) ถ้าต้องการให้เห็นราคาบนเว็บ
19. ★Rev.09 r10 **เปิดใช้ระบบจองคิว**: ติดตั้ง Apps Script ในบัญชี Google บริษัท (`backoffice/README.md`) · **ประกาศความเป็นส่วนตัว (PDPA)** + ระยะเวลาเก็บข้อมูล (ข้อความยินยอม `CONSENT_TH` เป็นร่าง) · `SLOT_CAPACITY` จำนวนงานต่อครึ่งวัน (ตอนนี้ 2 = ช่างประจำ 2 ทีม — งานสัญญา/โครงการใหญ่ใช้เกินครึ่งวัน ทีมปรับในหลังบ้าน) · รายชื่อทีม `TEAMS` · อีเมล/LINE ที่รับแจ้ง · จะโฮสต์เว็บที่ไหน (Artifact ส่ง ticket ไม่ได้) · เวลาทำการ (ยังไม่แสดง) · จะส่งอีเมลรับเรื่องถึงลูกค้าไหม (`CUSTOMER_ACK`)
18. ★Rev.09 r9 ไฟล์โลโก้ความละเอียดสูง (SVG หรือ PNG ≥ 600 px) ของ SP และ FUJIVA — ไฟล์ที่ได้ในแชตกว้าง ~300 px ใช้บนเว็บได้ แต่คมกว่าเมื่อมีไฟล์ต้นฉบับ

---

## 8. Next Steps (Immediate Roadmap)

> ทำตามลำดับ แต่ละข้อจบด้วย Definition of Done (§6.7) และ commit แยก

**Step 1 — ตั้ง repo และยืนยัน baseline (ครึ่งวัน)**
1. แตก zip → `git init` → commit baseline
2. วาง `internal/sbp_real.json` (ไฟล์ภายในที่ส่งแยก)
3. `npm install && npx playwright install chromium`
4. รัน `npm run smoke`, `smoke:mobile`, `textscan`, `recon` → ต้องผ่านครบ บันทึกผล (โดยเฉพาะจำนวน `webgl`) เป็นค่าอ้างอิง

**Step 2 — แก้ B1: จำกัด WebGL context ≤ 3 ต่อหน้า** ✅ ทำแล้ว Rev.09 (`gl-pool.js` ใช้ `WEBGL_lose_context` แทนการ dispose/สร้างใหม่ — ไม่ต้องแก้ทุกฉาก) — ข้อย่อยด้านล่างเป็นแผนเดิม
1. สร้าง `assets/gl-pool.js`: ตัวจัดการกลางที่ให้ฉากขอ/คืน renderer — เมื่อฉากออกนอกจอเกินระยะ (`rootMargin` ~1 หน้าจอ) ให้ `dispose()` ฉากและ `renderer.forceContextLoss()` แล้วสร้างใหม่เมื่อกลับมา (เก็บ state ขั้นปัจจุบันไว้)
2. ใช้กับ `ac3d.createACViewer`, `studio3d`, `howitworks3d`, `materials3d`, `thaimap3d`, `install3d.createStage` (techstory/system3d)
3. ยืนยันด้วย `tests/smoke.mjs`: `webgl ≤ 3` ทุกหน้า และไม่มี error · ตรวจว่ากลับขึ้นไปดูฉากเดิมแล้วยังอยู่ขั้นเดิม

**Step 3 — แก้ B3: มุมกล้องช่วงจอกลาง**
1. ไล่ถ่าย `tests/story-shots.mjs` ทุกเรื่อง ทุกขั้น ที่ 1366×900, 1100×760, 820×1180, 390×844
2. ปรับ `CAMS` / ตัวคูณระยะใน `createStage` / ใช้ `ghost` หรือซ่อนผนังกั้นชั่วคราวในขั้นที่ช่างอยู่หลังผนัง
3. ตรวจด้วยตาทุกภาพ: ช่างไม่โผล่ทะลุผนัง, ป้ายไม่ทับ, จุดที่อธิบายเห็นชัด

**Step 4 — ทดสอบมือถือจริงและ fallback (B2)**
1. ทดสอบ Android ระดับล่าง 2–3 เครื่อง + iPhone (Safari) ผ่าน dev server ในวง LAN
2. ถ้าเฟรมเรต < ~24 fps: ลด `pixelRatio` เป็น 1, ปิดเงา, ลดจำนวนอนุภาค หรือแสดงภาพนิ่ง/วิดีโอแทนอัตโนมัติ (ตรวจด้วย `navigator.hardwareConcurrency`, `deviceMemory`)

**Step 5 — รอคำตัดสินเจ้าของ (§7.3) — อย่าเดา**
- ถ้าเจ้าของ **อนุมัติ SBP-PRC-001**: แก้ `sbp-data.json` ด้วยสคริปต์ (ไม่แก้มือ) → `recon` ต้อง 0 ผิดเทียบ extract ใหม่ → `textscan` → build
- ถ้าได้ **ไฟล์โลโก้**: วางใน `assets/logos/` → build → ตรวจภาพโชว์รูมวัสดุ

**Step 6 — สคริปต์นำเข้า Pricebook (B5)**
1. เขียน `scripts/import_pricebook.py` (openpyxl): อ่าน `ใบเสนอราคาติดตั้งแอร์ Final จริง.xlsx` + `ใบเสนอราคาล้างและซ่อม Final จริง.xlsx` → สร้าง `internal/sbp_real.json` (เต็ม) และ `assets/sbp-data.json` (สาธารณะ)
2. กฎกรองใน public: เฉพาะรุ่นสถานะอนุมัติ · `sp`/`pj` = null · ตัด `-MASS` · คงรูปแบบ `pool` + ลำดับคอลัมน์ `pf` ตาม §4.2 ทุกตัว
3. ยืนยัน: รันกับไฟล์ Excel ปัจจุบันแล้ว `assets/sbp-data.json` ต้องเหมือนเดิม (diff ว่าง หรือต่างเฉพาะลำดับที่ไม่มีผล) และ `recon` = 0

**Step 7 — เมื่อเจ้าของเลือกแบบแล้ว: ย้ายไป production (ตามแผน §4 + §11 ของ Handoff Plan)**
1. Next.js App Router + TypeScript; ยก `sbp-core.js` + `studio-model.js` เป็น `lib/domain/*.ts` พร้อม unit test (ราคา VAT, โซน, ค่าเดินทาง, สัญญา, BTU)
2. 3D เป็น client component โหลดแบบ dynamic (`ssr:false`) ใช้ gl-pool จาก Step 2
3. ข้อมูลราคาใน PostgreSQL/Supabase นำเข้าด้วยสคริปต์ Step 6
4. API ใบเสนอราคา: คำนวณยอดซ้ำฝั่ง server, บันทึก Lead, แจ้ง LINE OA/อีเมลทีมขาย (แก้ B4)
5. Google Distance Matrix สำหรับระยะทาง (แก้ B7) · Analytics funnel (เพิ่มลงใบเสนอราคา, ส่งคำขอ, ใช้ตัวคำนวณสัญญา, ตรวจพื้นที่)
6. SEO: SSG หน้าสินค้า 705 รุ่น + schema.org Product/Offer (ราคารวม VAT)

### Prompt แรกที่แนะนำให้พิมพ์ใน Claude Code

```
อ่าน CLAUDE.md ให้ครบก่อน แล้วทำ Step 1 (ตั้ง repo + รัน baseline ทั้ง 4 ชุด) รายงานผลเป็นตาราง
จากนั้นเสนอแผนแก้ B1 (WebGL context ≤ 3 ต่อหน้า) ตาม Step 2 — ยังไม่ต้องแก้โค้ด จนกว่าฉันจะอนุมัติแผน
ห้ามแก้ราคาหรือกฎธุรกิจใน §6.6 ทุกข้อ ตอบเป็นภาษาไทย
```

---

_จบเอกสาร · อ้างอิงเพิ่มเติม: `SBP-WEB-011_Dev_Handoff_Plan.md` (§0 คำตัดสินเจ้าของ 19 ข้อ, §6A–6V สเปกทุกฟีเจอร์, §12 Acceptance checklist, §13 เรื่องค้าง)_
