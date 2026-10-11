# คู่มือนำเว็บไซต์ SBP AirCare ขึ้นใช้งานจริง (สำหรับเจ้าของ)

> Rev.10 · 10 ต.ค. 2569 · บริษัท สหบูรพากรุ๊ป จำกัด · ใช้กับโฟลเดอร์ `sbp-aircare/` ของ repo
> ราคาผู้ให้บริการในคู่มือนี้ตรวจเมื่อ 9 ต.ค. 2569 (อัตรา ≈ 33.32 บาท/ดอลลาร์) — ราคาและหน้าจอของผู้ให้บริการเปลี่ยนได้ ให้ดูราคาจริงตอนสั่งซื้ออีกครั้ง

## ระบบนี้คืออะไร (อ่าน 1 นาที)

- **โปรแกรมเว็บ 1 ตัว** (Node.js โฟลเดอร์ `server/`) ทำหน้าที่แสดงหน้าเว็บ รับคำขอจองคิว/ใบเสนอราคา หน้าหลังบ้านของทีม (`/backoffice.html`) และรายการชำระเงิน
- **ฐานข้อมูลเป็นไฟล์เดียว** (SQLite) อยู่ในเครื่องเซิร์ฟเวอร์ — จึงต้องสำรองไฟล์นี้ออกนอกเครื่องทุกคืน (ขั้นที่ 8)
- **Caddy** อยู่หน้าโปรแกรม ทำ HTTPS (แม่กุญแจ) ให้อัตโนมัติ ต่ออายุใบรับรองเอง
- การชำระเงินเฟส 1 **ไม่ต้องมีผู้ให้บริการรับชำระ**: QR พร้อมเพย์เข้าบัญชีบริษัท · โอนเข้าบัญชี · ชำระหน้างานกับช่าง — ทุกยอดนับเมื่อเจ้าหน้าที่ตรวจกับบัญชีธนาคารแล้วกด "ยืนยันได้รับเงิน" เท่านั้น
- ค่าตั้งทั้งหมดอยู่ในไฟล์เดียว (`.env`) ตัวอย่างพร้อมคำอธิบายภาษาไทยทุกบรรทัดอยู่ที่ `deploy/.env.example`

### ไฟล์ในโฟลเดอร์ `deploy/`

| ไฟล์ | ใช้ทำอะไร |
|---|---|
| `DEPLOY_TH.md` | คู่มือนี้ |
| `.env.example` | ตัวอย่างค่าตั้งทุกตัว (คัดลอกแล้วกรอก) |
| `Dockerfile` · `compose.yaml` · `Caddyfile` | ทางที่ 1: Docker (แนะนำ) |
| `Dockerfile.render` (+ `render.yaml` ที่ root ของ repo) | ทางลัด: Render (ไม่ต้องมีโดเมน/เซิร์ฟเวอร์) |
| `systemd/aircare.service` · `systemd/aircare-backup.service` · `systemd/aircare-backup.timer` · `systemd/caddy-aircare.conf` | ทางที่ 2: Ubuntu + systemd |
| `aircare-cli.sh` | คำสั่งผู้ดูแล (สร้างบัญชีเจ้าหน้าที่ สำรอง/กู้คืน ฯลฯ) ใช้ได้ทั้งสองทาง |
| `offsite-backup.sh` | สำรองฐานข้อมูล + ส่งสำเนาไปเก็บบนคลาวด์ (rclone) ทุกคืน |

---

## ทางลัด · Render (เร็วที่สุด ไม่ต้องมีโดเมนหรือเซิร์ฟเวอร์ — ประมาณ 15 นาที)

เหมาะเมื่อต้องการเปิดเว็บใช้งานจริงทันที แล้วค่อยย้ายไปโดเมน/เซิร์ฟเวอร์ของบริษัทภายหลัง (ข้อมูลย้ายตามได้ด้วยไฟล์สำรอง)
Render สร้างเว็บจาก `render.yaml` (อยู่ที่ root ของ repo) ให้ทั้งหมด: HTTPS ที่ `https://sbp-aircare.onrender.com` (หรือชื่อใกล้เคียงที่ Render ให้)
ฐานข้อมูลอยู่บนดิสก์ถาวร 1 GB ที่ Render ถ่ายสำเนาทุกวัน และระบบทำสำเนาเพิ่มเองทุกคืน 03:15

**ค่าใช้จ่าย** โดยประมาณ: Starter 7 ดอลลาร์/เดือน + ดิสก์ 1 GB ประมาณ 0.25 ดอลลาร์/เดือน (ราว 250 บาท/เดือน) ดูราคาจริงที่ render.com/pricing
แผนฟรีของ Render **ไม่มีดิสก์ถาวร** ข้อมูลจะหายทุกครั้งที่ระบบเริ่มใหม่ จึงห้ามใช้รับลูกค้าจริง

1. สมัคร Render ที่ render.com ด้วยบัญชี GitHub ของบริษัท แล้วใส่บัตรสำหรับค่าบริการ
2. เปิดลิงก์ `https://render.com/deploy?repo=https://github.com/assavaniwestthanawat-arch/Project-design/tree/claude/focused-cerf-4t4idx`
   (ใช้ branch ที่มีโค้ดล่าสุด — เมื่อรวมโค้ดเข้า `main` แล้วใช้ลิงก์ที่ไม่มี `/tree/…`)
   - ถ้าลิงก์ไม่ขึ้นหน้าตั้งค่า: Render → **New** → **Blueprint** → เลือก repo `Project-design` และ branch เดียวกัน
   - ถ้า repo เป็นแบบส่วนตัว ให้อนุญาต Render เข้าถึง repo นี้เมื่อระบบถาม
3. Render ถามค่าตั้งครั้งเดียว:

   | ค่า | กรอกอะไร |
   |---|---|
   | `ADMIN_USER` · `ADMIN_NAME` · `ADMIN_PASSWORD` | บัญชีผู้ดูแลคนแรกของหลังบ้าน เช่น `owner` · `ธนวัฒน์` · รหัสผ่านอย่างน้อย 10 ตัว ระบบสร้างบัญชีนี้ครั้งเดียวตอนยังไม่มีเจ้าหน้าที่ |
   | `PROMPTPAY_ID` | เลขพร้อมเพย์ของบริษัท (เลขผู้เสียภาษี 13 หลัก) **เว้นว่าง = ปิด QR** |
   | `BANK_NAME` · `BANK_ACCOUNT_NAME` · `BANK_ACCOUNT_NO` | บัญชีรับโอนของบริษัท **เว้นว่าง = ปิดการโอน** (ชำระหน้างานยังใช้ได้) |
   | `NOTIFY_EMAIL` · `SMTP_HOST` · `SMTP_USER` · `SMTP_PASS` | อีเมลแจ้งทีมเมื่อมีคำขอใหม่ (Gmail: `smtp.gmail.com` + App Password ดูหัวข้อ "อีเมลแจ้งเตือน") **เว้นว่างได้** — คำขอยังเข้าหลังบ้านตามปกติ |

4. กด **Apply** แล้วรอ 3–5 นาที (หน้า Logs ขึ้น `SBP AirCare … home c.html`) → เปิดลิงก์ `….onrender.com` ของบริการ
5. เข้าหลังบ้านที่ `https://<ชื่อบริการ>.onrender.com/backoffice.html` ด้วยบัญชีผู้ดูแลจากข้อ 3
6. เพิ่มบัญชีเจ้าหน้าที่/ช่าง: หน้า Render ของบริการ → **Shell** แล้วพิมพ์
   ```
   setpriv --reuid=node --regid=node --init-groups node server/cli.mjs staff add office1 "ชื่อเจ้าหน้าที่" staff
   setpriv --reuid=node --regid=node --init-groups node server/cli.mjs staff add tech1 "ชื่อช่าง" tech
   ```
   (ระบบถามรหัสผ่าน · เปลี่ยนรหัส: `… server/cli.mjs staff passwd <ชื่อผู้ใช้>`) เมื่อเข้าใช้ได้แล้วลบค่า `ADMIN_PASSWORD` ออกจาก Environment ได้ — บัญชีไม่หาย
7. ทดลองครบวงจรก่อนบอกลูกค้า: จองคิวจากหน้าเว็บ → เปิดในหลังบ้าน → ยืนยันนัด → สร้างรายการชำระเงิน → ตรวจสถานะด้วยเลขที่คำขอ + เบอร์

**อัปเดตเว็บ:** push โค้ดขึ้น branch ที่เลือก Render สร้างและเปิดเวอร์ชันใหม่เอง (เว็บหยุดราว 1 นาทีระหว่างสลับ เพราะใช้ดิสก์ถาวร)
**ใช้โดเมนของบริษัทภายหลัง:** Render → Settings → Custom Domains เพิ่มโดเมน ตั้ง DNS ตามที่ Render บอก แล้วเพิ่มค่า `SITE_URL=https://www.โดเมน` ใน Environment
**สำรองข้อมูล:** Render ถ่าย snapshot ดิสก์ทุกวันและเก็บอย่างน้อย 7 วัน (กู้คืนได้จากหน้า Disks ของบริการ) และระบบเก็บสำเนารายคืนไว้ใน `/data/backups` อีกชั้น · การส่งสำเนาออกนอกผู้ให้บริการทุกคืนทำตามขั้นที่ 8 เมื่อย้ายไปเซิร์ฟเวอร์ของบริษัท
**ถ้าลูกค้าเจอข้อความ "ทำรายการถี่เกินไป" บ่อยผิดปกติ:** ตั้ง `TRUST_PROXY_HOPS` เป็น `1` หรือ `3` ตามที่ทีมเทคนิคแนะนำ (ค่านี้บอกระบบว่าที่อยู่ IP ของผู้ใช้อยู่ตำแหน่งไหนหลังพร็อกซีของ Render)

---

## ขั้นที่ 1 · จดโดเมน

| | `.co.th` (แนะนำเป็นชื่อหลัก) | `.com` (เสริม ถ้าต้องการ) |
|---|---|---|
| ใครจดได้ | นิติบุคคลที่จดทะเบียนกับกรมพัฒนาธุรกิจการค้า (หรือจด VAT / มีเครื่องหมายการค้าจดทะเบียนในไทย) | ทุกคน |
| เอกสาร | เลขทะเบียนนิติบุคคล 13 หลัก (ไม่ต้องแนบหนังสือรับรอง) หรือแนบหนังสือรับรองบริษัท / ภ.พ.20 | ไม่ต้องใช้ |
| ชื่อ | ต้องมาจากชื่อบริษัท ชื่อโครงการ หรือเครื่องหมายการค้า (เต็มหรือย่อ) ห้ามสลับคำหรือเติมตัวอักษร/ตัวเลข เช่น `sahaburapa.co.th` — ตรวจชื่อภาษาอังกฤษที่จดทะเบียนก่อน | อิสระ |
| จดที่ | THNIC (www.thnic.co.th) หรือตัวแทนจดโดเมน .th — **จดที่ Cloudflare ไม่ได้** | Cloudflare Registrar (ไม่บวกเพิ่มจากราคากลาง ≈ US$10.46/ปี) หรือผู้รับจดทั่วไป |
| ค่าใช้จ่าย | 856 บาท/ปี (ราคาหน้าเว็บ THNIC) | ≈ 350 บาท/ปี |

**DNS (ที่ชี้ชื่อเว็บไปยังเซิร์ฟเวอร์)** — ใช้ Cloudflare แพ็กเกจฟรี (เพิ่มโดเมน → Cloudflare ให้ nameserver 2 ตัว → นำไปกรอกที่ THNIC/ผู้รับจด ซึ่ง .co.th ต้องมีอย่างน้อย 2 ตัวอยู่แล้ว) หรือใช้ DNS ของผู้รับจดก็ได้

เมื่อได้เลข IP ของเซิร์ฟเวอร์ (ขั้นที่ 2) ให้สร้างระเบียน:

| ชนิด | ชื่อ | ค่า | หมายเหตุ |
|---|---|---|---|
| A | `@` (ตัวโดเมนเอง) | IPv4 ของเซิร์ฟเวอร์ | จำเป็น |
| AAAA | `@` | IPv6 ของเซิร์ฟเวอร์ | ถ้าเซิร์ฟเวอร์มี IPv6 |
| A | `www` | IPv4 เดียวกัน | ถ้าจะใช้ www (เปิดบล็อก www ใน `deploy/Caddyfile` ด้วย) |

> ⚠️ ใน Cloudflare ให้ตั้ง Proxy status เป็น **DNS only** (ปิดรูปเมฆสีส้ม) ถ้าเปิดเมฆสีส้ม ระบบจะเห็นที่อยู่ IP ของลูกค้าผิด และการขอใบรับรอง HTTPS อาจไม่ผ่าน

---

## ขั้นที่ 2 · เช่าเซิร์ฟเวอร์

**แนะนำ: Vultr สิงคโปร์** (Vultr ไม่มีศูนย์ข้อมูลในไทย สิงคโปร์ใกล้ที่สุด)

1. สมัคร vultr.com → Deploy → **Cloud Compute (Shared CPU) · Regular Performance**
2. Location: **Singapore** · Image: **Ubuntu 24.04 LTS x64**
3. Plan: **1 vCPU · 2 GB RAM · 55 GB SSD · 2 TB transfer** (รหัส `vc2-1c-2gb`) US$10/เดือน
4. เปิด **Automatic Backups** (+20% = US$2/เดือน) ตั้งรอบรายวัน
5. ใส่ SSH key (ขั้นที่ 3 ข้อ 1) · ตั้งชื่อเครื่อง เช่น `sbp-aircare` → Deploy → จดเลข IPv4 (และ IPv6 ถ้ามี) ไปสร้างระเบียน DNS ในขั้นที่ 1

ค่าใช้จ่าย: US$12/เดือน + VAT 7% ที่ Vultr บวกเป็นบรรทัดแยก = **US$12.84 ≈ 428 บาท/เดือน** · ถ้าใส่เลขผู้เสียภาษีบริษัทในบัญชี Vultr ใบแจ้งหนี้จะไม่บวก VAT แต่บริษัทต้องนำส่ง VAT เอง (ภ.พ.36) — ให้นักบัญชียืนยัน
รวมโดเมน .co.th (≈ 71 บาท/เดือน) ≈ **500 บาท/เดือน** · ที่เก็บสำเนาบนคลาวด์และระบบเฝ้าระวังใช้แพ็กเกจฟรีได้ (ขั้นที่ 8, 10)

> ⚠️ Vultr เก็บ Automatic Backup ไว้แค่ **2 ชุดล่าสุด** (เลือกจำนวนเองไม่ได้) ใช้ย้อนทั้งเครื่องได้ราว 2 วันเท่านั้น — ประวัติฐานข้อมูลจริงมาจากสำเนานอกเครื่องในขั้นที่ 8
> Vultr ปิดเฉพาะพอร์ตอีเมล 25 · พอร์ต 465/587 ที่ Gmail ใช้ส่งได้ปกติ

**ตัวเลือกสำรอง:** AWS Lightsail สิงคโปร์ 2 GB (US$12: 2 vCPU, 60 GB, 3 TB) เปิด automatic snapshot รายวันได้ เก็บ 7 ชุดล่าสุด (ค่าพื้นที่ snapshot US$0.05/GB-เดือน คิดเพิ่ม) — ทดสอบส่งอีเมลพอร์ต 465 ก่อนใช้จริง
**ไม่แนะนำ:** DigitalOcean (ปิดพอร์ตอีเมล 25/465/587 ทุกเครื่อง → ระบบส่งอีเมลแจ้งเตือนไม่ได้)

> 📌 เซิร์ฟเวอร์ที่สิงคโปร์ = ข้อมูลลูกค้าเก็บนอกประเทศ ให้ที่ปรึกษากฎหมายยืนยันเรื่องการส่งข้อมูลไปต่างประเทศตาม PDPA (ขั้นที่ 12) ถ้าต้องเก็บในไทย ผู้ให้บริการในไทย (เช่น Z.com Thailand, Huawei Cloud Bangkok, NIPA Cloud) ใช้ได้เหมือนกัน แต่ต้องตรวจว่าเปิดพอร์ตอีเมล 465 และราคารวม VAT หรือไม่

---

## ขั้นที่ 3 · เตรียมเครื่อง (ทำทั้งสองทาง)

ทุกคำสั่งในคู่มือพิมพ์ในหน้าต่าง SSH ของเซิร์ฟเวอร์ คัดลอกทีละบล็อก (บรรทัดที่ขึ้นต้นด้วย `#` เป็นคำอธิบาย ไม่ต้องพิมพ์)

**1) SSH key (กุญแจเข้าเครื่องแทนรหัสผ่าน)** — บนคอมพิวเตอร์ของคุณ (Windows ใช้ PowerShell, Mac ใช้ Terminal):

```bash
ssh-keygen -t ed25519
# กด Enter ตามค่าเดิม แล้วตั้งรหัสผ่านของกุญแจ — ไฟล์ .pub คือกุญแจสาธารณะ นำข้อความในไฟล์ไปวางใน Vultr → Account → SSH Keys
ssh root@<IPv4 ของเซิร์ฟเวอร์>
```

**2) ปิดการเข้าด้วยรหัสผ่าน** (ทำหลังเข้าด้วยกุญแจได้แล้ว และเปิดหน้าต่าง SSH ค้างไว้ 1 หน้าต่างระหว่างทดสอบ):

```bash
printf 'PasswordAuthentication no\nPermitRootLogin prohibit-password\n' | sudo tee /etc/ssh/sshd_config.d/01-aircare.conf
sudo systemctl restart ssh
# เปิดหน้าต่างใหม่แล้ว ssh เข้าอีกครั้งให้ได้ก่อน จึงปิดหน้าต่างเดิม
```

**3) อัปเดตระบบ เวลาไทย และอัปเดตความปลอดภัยอัตโนมัติ**

```bash
sudo apt update && sudo apt -y upgrade
sudo timedatectl set-timezone Asia/Bangkok
sudo apt install -y unattended-upgrades git curl
sudo dpkg-reconfigure -plow unattended-upgrades
```

**4) ไฟร์วอลล์ — เปิดเฉพาะ SSH (22), HTTP (80), HTTPS (443)**

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443
sudo ufw enable
sudo ufw status
```

**5) ดึงโค้ดเว็บมาไว้ที่ `/opt/aircare`**

```bash
sudo mkdir -p /opt/aircare
sudo git clone https://github.com/assavaniwestthanawat-arch/Project-design.git /opt/aircare/repo
sudo ln -s /opt/aircare/repo/sbp-aircare /opt/aircare/sbp-aircare
cd /opt/aircare/sbp-aircare
```

ถ้า repo เป็นแบบส่วนตัว (private) ให้ใช้ Deploy key แทน:

```bash
sudo ssh-keygen -t ed25519 -N '' -f /root/.ssh/aircare_deploy
sudo cat /root/.ssh/aircare_deploy.pub
# นำข้อความไปวางที่ GitHub → repo → Settings → Deploy keys → Add deploy key (ไม่ต้องติ๊ก Allow write access)
sudo GIT_SSH_COMMAND='ssh -i /root/.ssh/aircare_deploy' git clone git@github.com:assavaniwestthanawat-arch/Project-design.git /opt/aircare/repo
sudo git -C /opt/aircare/repo config core.sshCommand 'ssh -i /root/.ssh/aircare_deploy'
sudo ln -s /opt/aircare/repo/sbp-aircare /opt/aircare/sbp-aircare
```

> ไฟล์ข้อมูลภายในของบริษัท (โฟลเดอร์ `internal/`) ไม่อยู่ใน repo และห้ามนำขึ้นเซิร์ฟเวอร์ · เว็บส่งไฟล์แบบ "อนุญาตเป็นรายไฟล์" เท่านั้น เอกสาร .md โฟลเดอร์ tests/ tools/ backoffice/ เปิดจากเว็บไม่ได้

จากนั้นเลือก **ทางที่ 1 (Docker — แนะนำ)** หรือ **ทางที่ 2 (Ubuntu + systemd)** อย่างใดอย่างหนึ่ง

---

## ขั้นที่ 4 · ทางที่ 1 (แนะนำ): Docker Compose

ทั้งเว็บและ Caddy อยู่ในกล่อง (container) อัปเดตด้วยคำสั่งเดียว ข้อมูลอยู่ใน Docker volume ชื่อ `sbp-aircare_aircare-data`

**1) ติดตั้ง Docker** (ตามเอกสารทางการ docs.docker.com/engine/install/ubuntu):

```bash
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}") stable" | sudo tee /etc/apt/sources.list.d/docker.list
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo docker run --rm hello-world
```

**2) สร้างไฟล์ค่าตั้ง แล้วกรอกตามขั้นที่ 6**

```bash
cd /opt/aircare/sbp-aircare
sudo cp deploy/.env.example deploy/.env
sudo chmod 600 deploy/.env
sudo nano deploy/.env
# บันทึก: Ctrl+O แล้ว Enter · ออก: Ctrl+X
```

ใน Docker ค่า `NODE_ENV` `HOST` `PORT` `DATA_DIR` `TRUST_PROXY` ถูกกำหนดใน `deploy/compose.yaml` ให้แล้ว (ค่าในไฟล์ .env ของ 5 ตัวนี้ไม่มีผล) ส่วนที่ต้องกรอกก่อนเปิดเว็บครั้งแรกคือ `SITE_URL` `SITE_DOMAIN` `ACME_EMAIL`

**3) เปิดเว็บ** (DNS ในขั้นที่ 1 ต้องชี้มาที่เครื่องนี้แล้ว เพื่อให้ได้ใบรับรอง HTTPS):

```bash
cd /opt/aircare/sbp-aircare
sudo docker compose -f deploy/compose.yaml up -d --build
sudo docker compose -f deploy/compose.yaml ps
# app ต้องขึ้น (healthy) ภายในราว 30 วินาที
curl -s https://<โดเมน>/healthz
# ต้องได้ {"ok":true,...}
```

ดูบันทึกการทำงาน: `sudo docker compose -f deploy/compose.yaml logs -f app` (หรือ `caddy`) · กด Ctrl+C เพื่อออก

> ⛔ ห้ามใช้ `docker compose down -v` หรือ `docker volume prune` — คำสั่งเหล่านี้ **ลบฐานข้อมูล** · หยุดเว็บชั่วคราวใช้ `sudo docker compose -f deploy/compose.yaml stop app`
> ⛔ ห้ามเพิ่ม `ports:` ให้บริการ `app` ใน compose.yaml — โปรแกรมต้องรับเฉพาะจาก Caddy (พอร์ตของ Docker ข้ามไฟร์วอลล์ ufw)

ต่อด้วยขั้นที่ 6 → 7 → 8

---

## ขั้นที่ 5 · ทางที่ 2: Ubuntu + systemd + Caddy

**1) ติดตั้ง Node.js 24** (NodeSource):

```bash
curl -fsSL https://deb.nodesource.com/setup_24.x -o /tmp/nodesource_setup.sh
sudo bash /tmp/nodesource_setup.sh
sudo apt install -y nodejs
node --version
# ต้องขึ้น v24.x
```

**2) ผู้ใช้ระบบและโฟลเดอร์ข้อมูล** (โปรแกรมไม่รันด้วย root และเขียนได้เฉพาะ `/var/lib/aircare`):

```bash
sudo useradd --system --user-group --home-dir /var/lib/aircare --shell /usr/sbin/nologin aircare
sudo install -d -o aircare -g aircare -m 750 /var/lib/aircare
sudo install -d -o root -g aircare -m 750 /etc/aircare
sudo install -m 600 /opt/aircare/sbp-aircare/deploy/.env.example /etc/aircare/aircare.env
sudo nano /etc/aircare/aircare.env
```

กรอกตามขั้นที่ 6 · ทางนี้ให้คงค่า `NODE_ENV=production` `HOST=127.0.0.1` `PORT=8080` `DATA_DIR=/var/lib/aircare` `TRUST_PROXY=1` ไว้ตามตัวอย่าง (`SITE_DOMAIN` และ `ACME_EMAIL` ในไฟล์นี้ไม่ถูกใช้ — ไปกรอกในข้อ 4)

**3) เปิดบริการเว็บ**

```bash
cd /opt/aircare/sbp-aircare
sudo cp deploy/systemd/aircare.service deploy/systemd/aircare-backup.service deploy/systemd/aircare-backup.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now aircare
sudo systemctl status aircare
curl -s http://127.0.0.1:8080/healthz
```

**4) ติดตั้ง Caddy** (ตามเอกสารทางการ caddyserver.com/docs/install หัวข้อ Debian, Ubuntu — ถ้าคำสั่งบนหน้าเว็บต่างจากนี้ ให้ยึดหน้าเว็บ):

```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo chmod o+r /usr/share/keyrings/caddy-stable-archive-keyring.gpg /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install -y caddy
```

ตั้งค่า Caddy ให้ส่งต่อไปยังเว็บ:

```bash
cd /opt/aircare/sbp-aircare
sudo cp deploy/Caddyfile /etc/caddy/Caddyfile
sudo mkdir -p /etc/systemd/system/caddy.service.d
sudo cp deploy/systemd/caddy-aircare.conf /etc/systemd/system/caddy.service.d/aircare.conf
sudo nano /etc/systemd/system/caddy.service.d/aircare.conf
# แก้ example.co.th เป็นโดเมนจริง และอีเมลผู้ดูแล
sudo install -d -o caddy -g caddy -m 750 /var/log/caddy
sudo systemctl daemon-reload
sudo systemctl restart caddy
curl -s https://<โดเมน>/healthz
```

ดูบันทึก: `journalctl -u aircare -f` · `journalctl -u caddy -f` (Ctrl+C เพื่อออก)
ตัวตั้งเวลาสำรองข้อมูล (`aircare-backup.timer`) เปิดในขั้นที่ 8

---

## ขั้นที่ 6 · กรอกค่าตั้ง (`deploy/.env` หรือ `/etc/aircare/aircare.env`)

กฎของไฟล์: `ชื่อ=ค่า` บรรทัดละตัว · คอมเมนต์อยู่บรรทัดของตัวเอง · ไม่ต้องใส่เครื่องหมายคำพูด · **ห้ามมีเครื่องหมาย `$` ในค่า** · ค่าว่าง = ใช้ค่าเริ่มต้นหรือปิดความสามารถนั้น
หลังแก้ไฟล์ทุกครั้ง: Docker `sudo docker compose -f deploy/compose.yaml up -d` · systemd `sudo systemctl restart aircare`

### เว็บไซต์

| ค่า | กรอกอย่างไร |
|---|---|
| `SITE_URL` | `https://` + โดเมน ไม่มี `/` ท้าย เช่น `https://sahaburapa.co.th` — ต้องเป็น https ไม่อย่างนั้นเว็บไม่ยอมเริ่ม |
| `SITE_DOMAIN` · `ACME_EMAIL` | (Docker) โดเมนอย่างเดียว เช่น `sahaburapa.co.th` และอีเมลผู้ดูแลที่รับแจ้งเรื่องใบรับรอง |
| `HOME_PAGE` | แบบที่เป็นหน้าแรก: `a.html` `b.html` `c.html` `d.html` (รุ่นแรก) · `a2.html`–`d2.html` (รุ่น 2) · `a3.html`–`c3.html` (รุ่น 3) — ค่าเริ่มต้น `c.html` จนกว่าเจ้าของเลือก |
| `PUBLIC_PAGES` | แบบอื่นที่ยังเปิดดูได้ คั่นด้วย `,` (ว่าง = เปิดทั้ง 11 แบบ ทุกแบบยกเว้นหน้าแรกตั้งไม่ให้ Google เก็บ) · ตอนเปิดจริงแนะนำใส่เฉพาะแบบที่เลือก เช่น `c.html` |
| `SITE_MODE` | `beta` หรือ `live` — ดูหัวข้อถัดไป |

**เมื่อไรควรเปลี่ยน `SITE_MODE` จาก `beta` เป็น `live`**

- `beta` (ค่าเริ่มต้น) แสดงส่วนของช่วงทดลอง: แถบ "ทดลองใช้ (Beta)" พร้อมปุ่มให้ความเห็น ปุ่มสลับแบบ A/B/C และลิงก์หน้ารวมทุกแบบ — เหมาะกับให้ทีมและผู้ทดลองใช้เท่านั้น
- ⚠️ โหมด `beta` ไม่ใช่ระบบจำลอง: บนเซิร์ฟเวอร์นี้ฟอร์มจองคิว/ขอใบเสนอราคา **ส่งเข้าระบบจริง** และรายการเงินเป็นของจริง — อย่าเผยแพร่ลิงก์ให้ลูกค้าทั่วไปขณะยังเป็น `beta`
- `live` ซ่อนส่วนเหล่านั้นทั้งหมดและใช้ชื่อหน้าสำหรับลูกค้า — เปลี่ยนเมื่อ (1) เลือกแบบหน้าแรกแล้ว (2) ที่ปรึกษากฎหมายตรวจหน้า privacy/terms/refund แล้ว (3) ผ่านรายการตรวจในขั้นที่ 9 ครบ (4) พร้อมรับลูกค้าจริง — พร้อมกันนั้นตั้ง `PUBLIC_PAGES` ให้เหลือเฉพาะแบบที่เลือก

### การชำระเงิน

| ค่า | กรอกอย่างไร |
|---|---|
| `PROMPTPAY_ID` | **เลขประจำตัวผู้เสียภาษีของบริษัท 13 หลัก** ที่ผูกพร้อมเพย์กับบัญชีธนาคารบริษัทแล้ว (ติดต่อธนาคารเพื่อลงทะเบียนพร้อมเพย์นิติบุคคล) · ว่าง = ไม่แสดง QR พร้อมเพย์ |
| `PAYEE_NAME` | ชื่อผู้รับเงินที่ลูกค้าเห็น (ค่าเริ่มต้น บริษัท สหบูรพากรุ๊ป จำกัด) |
| `BANK_NAME` · `BANK_ACCOUNT_NAME` · `BANK_ACCOUNT_NO` | ธนาคาร ชื่อบัญชี (ว่าง = ใช้ `PAYEE_NAME`) และเลขบัญชีบริษัท · ไม่มีเลขบัญชี = ไม่แสดงวิธีโอน |
| `PAY_ONSITE` | `1` = ลูกค้าเลือกชำระหน้างานกับช่างได้ |
| `PAY_REQUEST_DAYS` | รายการชำระเงินชำระได้กี่วัน (ค่าเริ่มต้น 7) |

ยอดที่ระบบแนะนำตอนสร้างรายการเรียกเก็บมาจากราคาฝั่งเซิร์ฟเวอร์: ราคาก่อน VAT สำหรับลูกค้าที่ไม่ขอใบกำกับภาษี และ + VAT 7% เฉพาะลูกค้าที่ขอใบกำกับภาษี · ถ้ามีรายการ "ประเมินหน้างาน" สินค้า สัญญารายปี หรือพื้นที่ที่ต้องยืนยัน ระบบไม่แนะนำยอด เจ้าหน้าที่ต้องกรอกยอดที่ยืนยันกับลูกค้าแล้ว

### อีเมลแจ้งเตือน (Gmail ของบริษัท)

1. บัญชี Google ที่ใช้ส่ง ต้องเปิด **การยืนยันแบบ 2 ขั้นตอน** (myaccount.google.com → ความปลอดภัย)
2. สร้าง **App Password** ที่ myaccount.google.com/apppasswords ตั้งชื่อ เช่น "SBP AirCare" → ได้รหัส 16 ตัว (Google ไม่รับรหัสผ่านปกติของบัญชีสำหรับการส่งแบบนี้แล้ว)
3. กรอก (ตัวอย่าง — เปลี่ยนเป็นบัญชีจริง · `SMTP_PASS` คือรหัส 16 ตัว พิมพ์ติดกันไม่มีเว้นวรรค · `NOTIFY_EMAIL` หลายอีเมลคั่นด้วย `,`):

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=service@example.co.th
SMTP_PASS=abcdefghijklmnop
MAIL_FROM=SBP AirCare <service@example.co.th>
NOTIFY_EMAIL=office@example.co.th,owner@example.co.th
```

- `CUSTOMER_ACK=1` ส่งอีเมลรับเรื่องถึงลูกค้าที่กรอกอีเมล (ข้อความไม่ระบุเวลาตอบกลับหรือวันนัด) · `CUSTOMER_NOTIFY=1` แจ้งลูกค้าเมื่อสถานะ/วันนัดเปลี่ยน เมื่อมีรายการชำระเงิน และเมื่อบริษัทยืนยันรับเงินแล้ว — ทั้งสองค่าเริ่มต้นปิด เจ้าของเลือกเปิดเอง
- อีเมลทุกฉบับเข้าคิวในฐานข้อมูลก่อนแล้วระบบทยอยส่ง ถ้าส่งไม่ผ่านจะลองใหม่เองหลายรอบ (ดูคิวที่ค้างด้วย `sudo deploy/aircare-cli.sh outbox`)
- Gmail มีเพดานจำนวนอีเมลต่อวัน (Google Workspace ระบุ 2,000 ฉบับ/วัน) เกินพอสำหรับแจ้งเตือน
- ถ้ากรอก `SMTP_HOST` แต่ไม่กรอก `SMTP_USER`/`SMTP_PASS` เว็บจะไม่ยอมเริ่ม (ตั้งใจให้รู้ตัว)

### LINE (ถ้าต้องการแจ้งทีมทาง LINE)

ใช้ LINE Messaging API ของ LINE Official Account บริษัท (บริการ LINE Notify ปิดไปแล้ว)

1. LINE Official Account Manager → ตั้งค่า → Messaging API → เปิดใช้งาน
2. developers.line.biz → channel ของ OA → แท็บ **Messaging API** → ออก **Channel access token (long-lived)** → กรอกเป็น `LINE_TOKEN`
3. แท็บ **Basic settings** → **Your user ID** (ขึ้นต้นด้วย U) → กรอกเป็น `LINE_TO`
4. ผู้รับต้องเพิ่ม LINE OA ของบริษัทเป็นเพื่อนก่อน

ข้อจำกัด: ส่งถึงผู้รับได้ 1 คนตาม User ID (การส่งเข้ากลุ่มต้องมี webhook ซึ่งระบบนี้ยังไม่มี) · ข้อความ push นับในโควตาข้อความรายเดือนของแพ็กเกจ LINE OA

### เจ้าหน้าที่ คิวงาน ข้อมูล

| ค่า | กรอกอย่างไร |
|---|---|
| `STAFF_TOKEN` | **เว้นว่าง** แล้วใช้บัญชีรายคน (ขั้นที่ 7) — ถ้าใส่ต้องยาวอย่างน้อย 24 ตัว |
| `SLOT_CAPACITY` | จำนวนงานต่อครึ่งวัน (เช้า/บ่าย) ที่แถบวันว่างใช้ — ให้เจ้าของ/หัวหน้าช่างกำหนด (เริ่มต้น 2) |
| `TEAMS` | รายชื่อทีมแบบ JSON เช่น `["ทีม 1","ทีม 2","ผู้รับเหมา"]` (ว่าง = ค่านี้) |
| `BACKUP_AT` · `BACKUP_KEEP` | เวลาสำรองในตัวโปรแกรมทุกคืน (เริ่มต้น 03:00) และจำนวนสำเนาที่เก็บในเครื่อง (เริ่มต้น 30) |
| `RETENTION_DAYS` | ลบข้อมูลส่วนบุคคลของคำขอที่เก่ากว่า N วันและจบแล้ว (หรือไม่มีการแก้ไขเกิน N วัน) · คำขอที่มีรายการเงินเก็บไว้อย่างน้อย 5 ปี · ยอดเงินและเลขใบเสร็จไม่ถูกลบ · `0` = ไม่ลบ — รอกำหนดกับที่ปรึกษากฎหมาย · ทำวันละครั้งหลัง 03:30 น. (ไม่ขึ้นกับ `BACKUP_AT`) |
| `RCLONE_REMOTE` · `RCLONE_CONFIG` · `OFFSITE_KEEP_DAYS` · `HC_PING_URL` | สำเนานอกเครื่อง (ขั้นที่ 8) |
| `OMISE_*` | ผู้ให้บริการรับชำระออนไลน์ เฟส 2 — **เว้นว่างไว้** (ขั้นที่ 12) |

### ถ้าเว็บไม่ยอมเริ่ม

ในโหมดใช้งานจริง โปรแกรมตรวจค่าก่อนเริ่ม ถ้าไม่ปลอดภัยจะหยุดและเขียนบรรทัด `✗` ในบันทึก (Docker `logs app` · systemd `journalctl -u aircare`):

| ข้อความ | แก้ |
|---|---|
| `SITE_URL must be the public https:// address in production` | ใส่ `SITE_URL=https://โดเมน` |
| `STAFF_TOKEN must be at least 24 characters…` | เว้นว่าง `STAFF_TOKEN=` |
| `SMTP_USER and SMTP_PASS are required when SMTP_HOST is set` | กรอกบัญชีและ App Password หรือเว้น `SMTP_HOST` ว่าง |
| `OMISE_WEBHOOK_SECRET is required when OMISE_SECRET_KEY is set` | กรอกทั้งคู่หรือเว้นว่างทั้งคู่ |

บรรทัด `⚠` เป็นคำเตือน เว็บยังทำงาน เช่น ยังไม่ตั้ง `PROMPTPAY_ID` (ไม่แสดง QR) หรือยังไม่ตั้ง `NOTIFY_EMAIL`/`LINE_TOKEN` (คำขอใหม่เห็นได้ในหลังบ้านเท่านั้น)

---

## ขั้นที่ 7 · สร้างบัญชีเจ้าหน้าที่

ใช้ `deploy/aircare-cli.sh` (ทั้งสองทางใช้คำสั่งเดียวกัน) — ระบบถามรหัสผ่าน (อย่างน้อย 10 ตัว ไม่แสดงบนจอ) ชื่อผู้ใช้เป็น a-z 0-9 . _ - ยาว 3–40 ตัว

```bash
cd /opt/aircare/sbp-aircare
sudo deploy/aircare-cli.sh staff add owner "ธนวัฒน์" admin
sudo deploy/aircare-cli.sh staff add office1 "ชื่อเจ้าหน้าที่" staff
sudo deploy/aircare-cli.sh staff add tech1 "ชื่อช่าง" tech
sudo deploy/aircare-cli.sh staff list
```

| บทบาท | ทำอะไรได้ |
|---|---|
| `admin` ผู้ดูแล | ทุกอย่าง รวมถึง **บันทึกการคืนเงิน** |
| `staff` เจ้าหน้าที่ | คิวและสถานะงาน · สร้าง/ยกเลิกรายการเรียกเก็บ · บันทึกรับเงิน (นับทันทีพร้อมเลขที่ใบเสร็จ) · ยืนยัน/ปฏิเสธยอดที่ลูกค้าแจ้งโอน |
| `tech` ช่าง | คิวและสถานะงาน · บันทึกเงินที่รับหน้างาน → **รอสำนักงานตรวจยอด** ก่อนนับ |

คำสั่งอื่น: `staff passwd <ผู้ใช้>` เปลี่ยนรหัสผ่าน (ออกจากระบบทุกเครื่อง) · `staff disable <ผู้ใช้>` ปิดบัญชีคนที่ลาออก · `staff enable <ผู้ใช้>`
เข้าหลังบ้านที่ `https://<โดเมน>/backoffice.html` · ล็อกอินอยู่ได้ 12 ชั่วโมง · ใส่รหัสผิดหลายครั้งระบบให้รอสักครู่

---

## ขั้นที่ 8 · สำรองข้อมูลนอกเครื่อง (ทำก่อนเปิดจริง)

ระบบสำรองฐานข้อมูลทุกคืนแบบไม่ต้องหยุดเว็บ และตรวจทุกสำเนา (`PRAGMA integrity_check`) ก่อนนับว่าสำเร็จ — มี 2 รอบต่อคืน:

- **03:00** ในตัวโปรแกรม (`BACKUP_AT`) เก็บในเครื่อง `BACKUP_KEEP` ชุด (Docker: ใน volume ที่ `/data/backups` · systemd: `/var/lib/aircare/backups`)
- **03:15** `deploy/offsite-backup.sh` สำรองอีกชุด แล้ว **ส่งขึ้นที่เก็บไฟล์บนคลาวด์** และลบสำเนาบนคลาวด์ที่เก่ากว่า `OFFSITE_KEEP_DAYS` วัน (สำเนาล่าสุด 7 ชุดไม่ถูกลบเสมอ)
- ในเครื่องจึงมี 2 ชุดต่อคืน: `BACKUP_KEEP=30` ≈ ย้อนได้ 15 วันในเครื่อง · บนคลาวด์ย้อนได้ `OFFSITE_KEEP_DAYS` วัน

### 8.1 สร้างที่เก็บไฟล์ (เลือกอย่างใดอย่างหนึ่ง — ฐานข้อมูลขนาดเล็ก อยู่ในส่วนฟรีได้)

**Cloudflare R2** (ฟรี 10 GB-เดือน ไม่มีค่าดาวน์โหลด):
1. Cloudflare → R2 → Create bucket ชื่อ `sbp-aircare-backup`
2. R2 → Manage API tokens → Create API token → สิทธิ์ **Object Read & Write** เฉพาะ bucket นี้ → จด Access Key ID, Secret Access Key และ endpoint `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`

**Backblaze B2** (ฟรี 10 GB แรก): สร้าง bucket แบบ Private → Application Keys → สร้าง key เฉพาะ bucket นี้ → จด keyID และ applicationKey

### 8.2 ติดตั้ง rclone และใส่รหัสเข้าที่เก็บไฟล์

```bash
sudo apt install -y rclone
sudo mkdir -p /etc/aircare
# R2 (แทนค่าในวงเล็บเหลี่ยม):
sudo rclone config create r2 s3 provider=Cloudflare access_key_id=[ACCESS_KEY_ID] secret_access_key=[SECRET] endpoint=https://[ACCOUNT_ID].r2.cloudflarestorage.com acl=private no_check_bucket=true --config /etc/aircare/rclone.conf
# หรือ B2:
# sudo rclone config create b2 b2 account=[KEY_ID] key=[APPLICATION_KEY] hard_delete=true --config /etc/aircare/rclone.conf
sudo rclone --config /etc/aircare/rclone.conf ls r2:sbp-aircare-backup
# B2: sudo rclone --config /etc/aircare/rclone.conf ls b2:<ชื่อ bucket>
# ไม่มี error = เชื่อมได้ (bucket ใหม่จะยังว่าง)
```

ทางที่ 2 (systemd) เพิ่ม: `sudo chown root:aircare /etc/aircare/rclone.conf && sudo chmod 640 /etc/aircare/rclone.conf` (ให้ผู้ใช้ aircare อ่านได้)

กรอกในไฟล์ค่าตั้ง: `RCLONE_REMOTE=r2:sbp-aircare-backup/db` (หรือ `b2:<ชื่อ bucket>/db`) · `RCLONE_CONFIG=/etc/aircare/rclone.conf`

### 8.3 แจ้งเตือนเมื่อสำรองไม่สำเร็จ (แนะนำ)

healthchecks.io (แพ็กเกจฟรี 20 รายการ) → Add Check → Period 1 วัน, Grace 2 ชั่วโมง → คัดลอก Ping URL → กรอก `HC_PING_URL=` — ถ้าคืนไหนสำรองไม่สำเร็จหรือไม่ได้ทำงาน ระบบนั้นจะส่งอีเมลแจ้ง

### 8.4 ตั้งเวลาทุกคืน และลองรันทันที

ทางที่ 1 (Docker) — ใช้ cron ของเครื่อง (เวลาไทยจากขั้นที่ 3):

```bash
echo '15 3 * * * root AIRCARE_DOCKER=1 /opt/aircare/sbp-aircare/deploy/offsite-backup.sh >> /var/log/aircare-backup.log 2>&1' | sudo tee /etc/cron.d/aircare-backup
sudo AIRCARE_DOCKER=1 /opt/aircare/sbp-aircare/deploy/offsite-backup.sh
```

ทางที่ 2 (systemd):

```bash
sudo systemctl enable --now aircare-backup.timer
sudo systemctl start aircare-backup
journalctl -u aircare-backup -n 20
systemctl list-timers aircare-backup.timer
```

ผลที่ถูกต้อง: บรรทัด `✓ local copy …` `✓ off-site copy …` `✓ remote keeps …` · ถ้าขึ้น `⚠ RCLONE_REMOTE is not set` แปลว่าได้สำเนาในเครื่องแล้วแต่ยังไม่ได้ส่งออกนอกเครื่อง (สถานะงานจะเป็น failed จนกว่าจะตั้ง)

---

## ขั้นที่ 9 · รายการตรวจก่อนเปิดจริง

ทำครบทุกข้อ (ขณะยังเป็น `SITE_MODE=beta` และยังไม่ประกาศลิงก์)

- [ ] **เว็บและ HTTPS** — `https://<โดเมน>/healthz` ได้ `{"ok":true,…}` · เบราว์เซอร์ขึ้นแม่กุญแจ · พิมพ์ `http://<โดเมน>` แล้วถูกพาไป https เอง
- [ ] **หน้าเว็บ** — หน้าแรกเป็นแบบที่เลือก · `/privacy.html` `/terms.html` `/refund.html` เปิดได้
- [ ] **หลังบ้าน** — `https://<โดเมน>/backoffice.html` เข้าด้วยบัญชี admin ได้
- [ ] **ทดลองจองคิว** — จองบนหน้าเว็บด้วยชื่อ เบอร์ และอีเมลของคุณเอง → หน้าเว็บแสดงเลขที่คำขอ (แสดงเฉพาะเมื่อระบบรับเรื่องแล้วจริง) → คำขอขึ้นในหลังบ้าน → อีเมล/LINE ถึงทีม (ถ้าตั้งไว้) → ลองเปลี่ยนสถานะและวันนัด → ลูกค้าได้อีเมล (ถ้า `CUSTOMER_NOTIFY=1`)
- [ ] **ทดลองรับเงินพร้อมเพย์ 1 บาท**
  1. หลังบ้าน → เปิดคำขอทดลอง → การชำระเงิน → **สร้างรายการเรียกเก็บ** ประเภท ชำระเต็มจำนวน ยอด `1`
  2. หน้าเว็บ → **ตรวจสถานะคำขอ** (เลขที่คำขอ + เบอร์โทร) → เลือก **สแกน QR พร้อมเพย์**
  3. สแกนด้วยแอปธนาคาร → ตรวจว่า **ชื่อผู้รับเป็นบัญชีบริษัท และยอด 1.00 บาท** → ชำระ → กด **แจ้งว่าโอนแล้ว**
  4. หลังบ้าน → รายการขึ้น "รอตรวจยอด" → ตรวจ statement ธนาคารว่ามียอดเข้าจริง → **ยืนยันได้รับเงิน** → ได้เลขที่ใบเสร็จ `RC…`
  5. ลองวิธี "โอนเข้าบัญชีบริษัท" แบบเดียวกัน (ตรวจชื่อธนาคาร/เลขบัญชีที่แสดง)
- [ ] **ทดลองบันทึกคืนเงิน** (บัญชี admin) — โอน 1 บาทคืนเข้าบัญชีผู้ทดลองเอง → หลังบ้าน → **บันทึกการคืนเงิน** วิธี "โอนคืนเข้าบัญชีลูกค้า" ใส่เลขอ้างอิงการโอนและเหตุผล → สถานะการเงินของคำขอเป็น "คืนเงินแล้ว"
- [ ] **สำรองและตรวจสำเนา** — รันขั้นที่ 8.4 แล้ว:
  ```bash
  cd /opt/aircare/sbp-aircare
  sudo deploy/aircare-cli.sh backup
  # Docker: ใช้ชื่อไฟล์ที่ขึ้นในบรรทัด "file" ตรง ๆ (/data/backups/…) · systemd: /var/lib/aircare/backups/…
  sudo deploy/aircare-cli.sh verify-backup /data/backups/aircare-YYYYMMDD-HHMMSS.sqlite
  sudo rclone --config /etc/aircare/rclone.conf ls r2:sbp-aircare-backup/db
  ```
  `verify-backup` ต้องได้ `"ok": true` `"integrity": "ok"` พร้อมจำนวนคำขอ/การชำระเงิน · ไฟล์ต้องอยู่บนคลาวด์
- [ ] **ซ้อมกู้คืนกับสำเนา** (หัวข้อถัดไป) — บันทึกว่าใช้เวลากี่นาที
- [ ] **ข้อมูลทดสอบ** — ระบบไม่ลบรายการเงิน (ยกเลิก/คืนเงินเป็นรายการใหม่เสมอ) เลขที่ใบเสร็จของการทดสอบจึงคงอยู่ เลือกอย่างใดอย่างหนึ่ง: (ก) แจ้งนักบัญชีว่าเลขที่ใบเสร็จนั้นเป็นการทดสอบ 1 บาทที่คืนแล้ว หรือ (ข) เริ่มฐานข้อมูลใหม่ก่อนเปิดจริง (หัวข้อ "เริ่มฐานข้อมูลใหม่" ด้านล่าง)

### ซ้อมกู้คืน (ทำกับสำเนา ไม่แตะฐานข้อมูลจริง)

หาไฟล์ล่าสุดบนคลาวด์: `sudo rclone --config /etc/aircare/rclone.conf lsf r2:sbp-aircare-backup/db | sort | tail -1`

ทางที่ 1 (Docker):

```bash
sudo mkdir -p /root/drill
sudo rclone --config /etc/aircare/rclone.conf copy r2:sbp-aircare-backup/db/aircare-YYYYMMDD-HHMMSS.sqlite /root/drill/
sudo docker run --rm --user root -v /root/drill:/drill sbp-aircare:latest node --disable-warning=ExperimentalWarning server/cli.mjs verify-backup /drill/aircare-YYYYMMDD-HHMMSS.sqlite
sudo docker run --rm -d --name aircare-drill --user root -p 127.0.0.1:8099:8080 -v /root/drill:/drill -e NODE_ENV=development -e DATA_DIR=/drill -e DB_FILE=/drill/aircare-YYYYMMDD-HHMMSS.sqlite sbp-aircare:latest
curl -s http://127.0.0.1:8099/healthz
sudo docker rm -f aircare-drill && sudo rm -rf /root/drill
```

ทางที่ 2 (systemd):

```bash
cd /opt/aircare/sbp-aircare
sudo -u aircare mkdir -p /var/lib/aircare/drill
sudo -u aircare rclone --config /etc/aircare/rclone.conf copy r2:sbp-aircare-backup/db/aircare-YYYYMMDD-HHMMSS.sqlite /var/lib/aircare/drill/
sudo deploy/aircare-cli.sh verify-backup /var/lib/aircare/drill/aircare-YYYYMMDD-HHMMSS.sqlite
sudo -u aircare env NODE_ENV=development PORT=8099 DATA_DIR=/var/lib/aircare/drill DB_FILE=/var/lib/aircare/drill/aircare-YYYYMMDD-HHMMSS.sqlite node --disable-warning=ExperimentalWarning server/index.mjs
# เปิดหน้าต่าง SSH ที่ 2: curl -s http://127.0.0.1:8099/healthz  แล้วกลับมากด Ctrl+C
sudo rm -rf /var/lib/aircare/drill
```

ผ่านเมื่อ: `verify-backup` ได้ `"ok": true` และจำนวนคำขอใกล้เคียงกับในหลังบ้าน · `healthz` ของชุดซ้อมได้ `{"ok":true…}` — ชุดซ้อมไม่ได้รับไฟล์ค่าตั้ง จึงไม่ส่งอีเมลหรือ LINE ออกไปหาใคร · ทำซ้ำเดือนละครั้ง

---

## ขั้นที่ 10 · เฝ้าระวัง

- **UptimeRobot** (uptimerobot.com) → New Monitor → ชนิด **Keyword** → URL `https://<โดเมน>/healthz` → Keyword `"ok":true` → แจ้งเมื่อไม่พบคำนี้ → ทุก 5 นาที → ใส่อีเมลผู้รับแจ้ง · แพ็กเกจฟรีมี 50 monitor (เงื่อนไขการใช้ ณ มิ.ย. 2569 ระบุว่าใช้เชิงธุรกิจได้ แต่หน้าราคาเขียนว่าเหมาะกับงานส่วนตัว — ถ้าต้องการชัดเจนใช้แพ็กเกจ Solo ≈ US$12/เดือนแบบรายปี) · ถ้าแพ็กเกจมีการเตือนใบรับรอง SSL ใกล้หมดอายุ ให้เปิดด้วย
- **Healthchecks.io** — แจ้งเมื่อการสำรองคืนไหนไม่สำเร็จ (ขั้นที่ 8.3)
- `outboxPending` ใน `/healthz` = จำนวนอีเมล/LINE ที่รอส่ง ถ้าค้างสูงนาน ๆ ดูสาเหตุด้วย `sudo deploy/aircare-cli.sh outbox` (คอลัมน์ lastError)
- เดือนละครั้ง: `df -h` (พื้นที่ดิสก์) · ซ้อมกู้คืน · ดูว่าใบแจ้งหนี้ Vultr/โดเมนยังตัดบัตรได้

---

## ขั้นที่ 11 · อัปเดตเว็บและเครื่อง

สำรองก่อนทุกครั้ง: `sudo deploy/aircare-cli.sh backup` — โครงสร้างฐานข้อมูลปรับให้อัตโนมัติตอนโปรแกรมเริ่ม

ทางที่ 1 (Docker):

```bash
cd /opt/aircare/repo && sudo git pull
cd /opt/aircare/sbp-aircare && sudo docker compose -f deploy/compose.yaml up -d --build
sudo docker compose -f deploy/compose.yaml ps
curl -s https://<โดเมน>/healthz
# อัปเดต Caddy: sudo docker compose -f deploy/compose.yaml pull caddy && sudo docker compose -f deploy/compose.yaml up -d
# ลบ image เก่าที่ไม่ใช้: sudo docker image prune -f
```

ทางที่ 2 (systemd):

```bash
cd /opt/aircare/repo && sudo git pull
cd /opt/aircare/sbp-aircare
# ถ้าไฟล์ใน deploy/systemd/ เปลี่ยน: sudo cp deploy/systemd/aircare*.service deploy/systemd/aircare-backup.timer /etc/systemd/system/ && sudo systemctl daemon-reload
sudo systemctl restart aircare
curl -s http://127.0.0.1:8080/healthz
# Caddy และ Node.js อัปเดตผ่าน: sudo apt update && sudo apt upgrade
```

ระบบปฏิบัติการ: unattended-upgrades ลงแพตช์ความปลอดภัยเอง · ถ้ามีไฟล์ `/var/run/reboot-required` ให้ `sudo reboot` ช่วงกลางคืน — เว็บและ Caddy เริ่มเองหลังเครื่องเปิด

---

## ขั้นที่ 12 · สิ่งที่เจ้าของต้องตัดสินใจ/จัดหา ก่อนเปิดจริง

1. **เลือกแบบหน้าแรก** (`HOME_PAGE`) และวันเปลี่ยน `SITE_MODE=live`
2. **ที่ปรึกษากฎหมาย (PDPA)** ตรวจ `privacy.html` `terms.html` `refund.html` (ช่องที่เจ้าของต้องกรอกอยู่ในคอมเมนต์หัวไฟล์) และตัดสิน: ระยะเวลาเก็บข้อมูล (`RETENTION_DAYS`) · การเก็บข้อมูลบนเซิร์ฟเวอร์สิงคโปร์และที่เก็บไฟล์ R2/B2 นอกประเทศ · ระยะเก็บบันทึกการเข้าใช้ (Caddy เก็บไว้สูงสุด 90 วัน ในไฟล์ `aircare-access.log` มีที่อยู่ IP — ตรวจทั้งหน้าที่ตาม พ.ร.บ.คอมพิวเตอร์ มาตรา 26 และ PDPA)
3. **พร้อมเพย์และบัญชีธนาคาร** — ผูกพร้อมเพย์กับเลขผู้เสียภาษีบริษัท · เลขบัญชี · ตรวจชื่อที่แอปธนาคารแสดงตอนสแกน
4. **มัดจำและการยกเลิก** — กำหนดเงื่อนไขมัดจำ การยกเลิก และการคืนเงิน (ระบบสร้างรายการ "มัดจำ" ได้ แต่ไม่กำหนดยอดมัดจำให้เอง เจ้าหน้าที่กรอกยอดตามนโยบาย) และให้ `refund.html` ตรงกับนโยบาย
5. **นักบัญชี** — ระบบออกเลขที่ใบเสร็จ (`RC<ปี><เดือน>-NNNN`) และหน้าลูกค้าแสดงเลขที่ใบเสร็จกับยอด แต่ยังไม่ออกเอกสารใบเสร็จ/ใบกำกับภาษีเต็มรูป ให้ยืนยันวิธีออกเอกสาร · ยืนยันเรื่อง VAT ลูกค้าบุคคล (ราคาบนเว็บเป็นราคาก่อน VAT · + VAT เฉพาะผู้ขอใบกำกับภาษี) และ VAT ของบริการต่างประเทศ (Vultr)
6. **ข้อมูลแจ้งเตือน** — อีเมลทีม (`NOTIFY_EMAIL`) · Gmail + App Password · LINE OA (ถ้าใช้) · จะส่งอีเมลถึงลูกค้าหรือไม่ (`CUSTOMER_ACK` / `CUSTOMER_NOTIFY`)
7. **คิวงาน** — `SLOT_CAPACITY` (งานต่อครึ่งวัน) และรายชื่อทีม (`TEAMS`) · เวลาทำการยังไม่แสดงบนเว็บจนกว่าเจ้าของกำหนด
8. **ชำระออนไลน์ผ่านผู้ให้บริการ (เฟส 2)** — สมัครบัญชีร้านค้า (merchant) ของ Omise (ระบบมีตัวเชื่อม Omise ปิดอยู่จนกว่าจะใส่คีย์) หรือ Beam (ยังไม่มีตัวเชื่อม ต้องพัฒนาเพิ่ม) · **ทดสอบด้วยคีย์ทดสอบ (`skey_test_…`) ครบทุกขั้นก่อน** · ตั้ง webhook ใน Omise เป็น `https://<โดเมน>/api/webhooks/omise` และใส่ `OMISE_WEBHOOK_SECRET` · พร้อมเพย์ผ่าน Omise คืนเงินผ่าน Omise ไม่ได้ (คืนด้วยการโอนแล้วบันทึกในหลังบ้าน) · เมื่อผ่านแล้วจึงเปลี่ยนเป็นคีย์จริง

---

## ขั้นที่ 13 · แก้ปัญหาเบื้องต้น

| อาการ | ตรวจ/แก้ |
|---|---|
| เปิดเว็บไม่ได้เลย | `sudo docker compose -f deploy/compose.yaml ps` / `systemctl status aircare caddy` · ดูบันทึก (บรรทัด `✗` → ขั้นที่ 6 "ถ้าเว็บไม่ยอมเริ่ม") |
| ไม่มีแม่กุญแจ / ใบรับรองไม่ออก | ระเบียน A ชี้ IP ถูกไหม (`dig +short <โดเมน>`) · พอร์ต 80/443 เปิดไหม (`sudo ufw status` และไฟร์วอลล์ของ Vultr ถ้าตั้งไว้) · Cloudflare ต้องเป็น DNS only · ดูบันทึก caddy · อย่ารีสตาร์ต Caddy ถี่ ๆ (Let's Encrypt จำกัดจำนวนครั้ง Caddy ลองใหม่เอง) |
| 502 Bad Gateway | Caddy ทำงานแต่โปรแกรมเว็บหยุด → ดูบันทึก app/aircare แล้วเริ่มใหม่ |
| ไม่มีอีเมลแจ้งเตือน | `sudo deploy/aircare-cli.sh outbox` ดู lastError · ตรวจ App Password · ผู้ให้บริการเซิร์ฟเวอร์ปิดพอร์ต 465 หรือไม่ · ไม่มี `SMTP_HOST` = ระบบไม่ส่งอีเมลเลย |
| LINE ไม่เข้า | lastError `line 401` = token ผิด/หมดอายุ · `line 400` = User ID ผิดหรือยังไม่เพิ่มเพื่อน OA |
| เจ้าหน้าที่เข้าระบบไม่ได้ | "ลองเข้าสู่ระบบหลายครั้งเกินไป" = รอราว 15 นาที · ลืมรหัส: `sudo deploy/aircare-cli.sh staff passwd <ผู้ใช้>` · `staff list` ดูว่าบัญชีถูกปิด (active 0) หรือไม่ |
| ลูกค้าไม่เห็น QR พร้อมเพย์ | `PROMPTPAY_ID` ว่างหรือไม่ใช่ตัวเลข 10/13/15 หลัก (บันทึกตอนเริ่มมี `⚠ PROMPTPAY_ID not set`) |
| งานสำรองข้อมูล failed | Docker: `tail -50 /var/log/aircare-backup.log` · systemd: `journalctl -u aircare-backup -n 50` · บรรทัด `✗` บอกขั้นที่พัง (เช่น rclone ไม่ได้ติดตั้ง รหัส R2/B2 ผิด) |
| ดิสก์เต็ม | `df -h` · Docker: `sudo docker image prune -f` และ `sudo docker builder prune -f` (**ห้าม** `docker volume prune`) · ลด `BACKUP_KEEP` |

### กู้คืนฐานข้อมูลจริง (เมื่อเกิดเหตุ)

คำสั่ง `restore` ตรวจไฟล์สำเนาก่อน (ไฟล์เสียจะไม่ถูกนำมาใช้) และเก็บฐานข้อมูลเดิมไว้เป็น `aircare.sqlite.before-restore-<เวลา>` เสมอ

ทางที่ 1 (Docker):

```bash
cd /opt/aircare/sbp-aircare
sudo docker compose -f deploy/compose.yaml stop app
# สำเนาในเครื่อง: ดูรายชื่อ
sudo docker compose -f deploy/compose.yaml run --rm --no-deps app ls -1 /data/backups
# หรือสำเนาจากคลาวด์: ดาวน์โหลดแล้วคัดลอกเข้า volume
sudo rclone --config /etc/aircare/rclone.conf copy r2:sbp-aircare-backup/db/aircare-YYYYMMDD-HHMMSS.sqlite /root/restore/
sudo docker compose -f deploy/compose.yaml cp /root/restore/aircare-YYYYMMDD-HHMMSS.sqlite app:/data/backups/
# กู้คืน แล้วเปิดเว็บ
sudo deploy/aircare-cli.sh restore /data/backups/aircare-YYYYMMDD-HHMMSS.sqlite
sudo docker compose -f deploy/compose.yaml start app
curl -s https://<โดเมน>/healthz
```

ทางที่ 2 (systemd):

```bash
cd /opt/aircare/sbp-aircare
sudo systemctl stop aircare
sudo ls -1 /var/lib/aircare/backups
# หรือจากคลาวด์: sudo -u aircare rclone --config /etc/aircare/rclone.conf copy r2:sbp-aircare-backup/db/aircare-YYYYMMDD-HHMMSS.sqlite /var/lib/aircare/backups/
sudo deploy/aircare-cli.sh restore /var/lib/aircare/backups/aircare-YYYYMMDD-HHMMSS.sqlite
sudo systemctl start aircare
curl -s http://127.0.0.1:8080/healthz
```

ถ้าเครื่องเสียทั้งเครื่อง: ย้อนด้วย Automatic Backup ของ Vultr (2 ชุดล่าสุด) หรือสร้างเครื่องใหม่ตามขั้นที่ 3–8 แล้วกู้คืนจากคลาวด์ตามด้านบน

### เริ่มฐานข้อมูลใหม่ (เช่น หลังทดสอบ ก่อนเปิดจริง)

ย้ายไฟล์ฐานข้อมูลเดิมไปเก็บ (ไม่ลบ) แล้วเริ่มเว็บ ระบบสร้างฐานข้อมูลว่างให้ — **บัญชีเจ้าหน้าที่ต้องสร้างใหม่ (ขั้นที่ 7)** และเลขที่ใบเสร็จเริ่มนับใหม่

```bash
# Docker
sudo docker compose -f deploy/compose.yaml stop app
sudo docker compose -f deploy/compose.yaml run --rm --no-deps app sh -c 'mkdir -p /data/test-run && mv /data/aircare.sqlite* /data/test-run/'
sudo docker compose -f deploy/compose.yaml start app
# systemd
sudo systemctl stop aircare
sudo -u aircare mkdir -p /var/lib/aircare/test-run && sudo sh -c 'mv /var/lib/aircare/aircare.sqlite* /var/lib/aircare/test-run/'
sudo systemctl start aircare
```

---

## ภาคผนวก · คำสั่งที่ใช้บ่อย

ทำในโฟลเดอร์ `/opt/aircare/sbp-aircare` (`cd /opt/aircare/sbp-aircare`)

| งาน | Docker | systemd |
|---|---|---|
| สถานะ | `sudo docker compose -f deploy/compose.yaml ps` | `systemctl status aircare caddy` |
| บันทึกการทำงาน | `sudo docker compose -f deploy/compose.yaml logs -f app` | `journalctl -u aircare -f` |
| เริ่มใหม่หลังแก้ค่าตั้ง | `sudo docker compose -f deploy/compose.yaml up -d` | `sudo systemctl restart aircare` |
| สำรองทันที | `sudo deploy/aircare-cli.sh backup` | เหมือนกัน |
| สำรอง + ส่งขึ้นคลาวด์ทันที | `sudo AIRCARE_DOCKER=1 deploy/offsite-backup.sh` | `sudo systemctl start aircare-backup` |
| คิวอีเมล/LINE ที่ค้าง | `sudo deploy/aircare-cli.sh outbox` | เหมือนกัน |
| ขอข้อมูลส่วนบุคคลของลูกค้า (PDPA) | `sudo deploy/aircare-cli.sh export <เลขที่คำขอ>` | เหมือนกัน |
| ลบข้อมูลส่วนบุคคลตามคำขอ (ยอดเงินยังเก็บ) | `sudo deploy/aircare-cli.sh anonymize <เลขที่คำขอ>` | เหมือนกัน |

ห้ามส่งไฟล์ค่าตั้ง (`.env`), `rclone.conf` หรือไฟล์ฐานข้อมูล/สำเนา ทางแชตหรืออีเมล และห้ามนำขึ้น git — ไฟล์เหล่านี้มีรหัสผ่านหรือข้อมูลลูกค้า
