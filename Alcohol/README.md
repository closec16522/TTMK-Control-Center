# ระบบตรวจวัดแอลกอฮอล์ พนักงานขับรถขนส่ง
### หจก. ทั่วไทยขนส่งมงคล (Mr.Taweesak.kom - 062-3285963)

ระบบ Web Application สำหรับตรวจสอบและบันทึกผลการตรวจวัดระดับแอลกอฮอล์ของพนักงานขับรถก่อนออกปฏิบัติหน้าที่ ทำงานบน **GitHub Pages** เชื่อมต่อฐานข้อมูล **Google Sheets** และจัดเก็บรูปภาพบน **Google Drive**

---

## 🌟 คุณสมบัติเด่นของระบบ (Key Features)

1. **ทำงานบน GitHub Pages:** รองรับทั้งสมาร์ตโฟน (iOS / Android) และคอมพิวเตอร์ผ่าน Web Browser ทุกแพลตฟอร์ม
2. **กล้องสด WebRTC (Strict Live Camera):** บังคับเปิดกล้องและถ่ายภาพสดจากอุปกรณ์เท่านั้น **ไม่อนุญาตให้กดเลือกภาพจากอัลบั้ม/คลังภาพในมือถือ**
3. **ระบบสแกนและตรวจสอบ 2 ขั้นตอน:**
   - **รูปที่ 1 (Face Check-in):** กล้องหน้า ถ่ายภาพใบหน้าพนักงาน พร้อมระบบตรวจสอบความสว่างและความชัดเจน
   - **รูปที่ 2 (Breathalyzer Meter):** กล้องหลัง ถ่ายภาพหน้าปัดดิจิทัลเครื่องเป่าแอลกอฮอล์ พร้อมระบบ **AI / OCR (Tesseract.js)** วิเคราะห์ตัวเลขระดับแอลกอฮอล์อัตโนมัติ
4. **เกณฑ์ความปลอดภัยสูงสุด:**
   - ระดับแอลกอฮอล์ต้องเป็น **0.00 mg%** ถึงจะประเมิน **"ผ่าน"**
   - หากตรวจพบค่าเกิน 0.00 mg% ระบบจะแสดงสถานะ **"ไม่ผ่าน"** พร้อมแถบเตือนสีแดงและบันทึกประวัติทันที
5. **ระบบยืนยันตัวตนด้วย Email:** ตรวจสอบความถูกต้องกับตารางทะเบียนพนักงาน (`Registered_Drivers`)
6. **พิกัด GPS อัตโนมัติ:** บันทึกละติจูด-ลองจิจูด และสร้างลิงก์ Google Maps ให้ตรวจสอบตำแหน่งได้ทันที
7. **แจ้งเตือนด้วย SweetAlert2:** ดีไซน์การแจ้งเตือนระดับมืออาชีพ สวยงาม เข้าใจง่าย
8. **ดีไซน์ด้วย Tailwind CSS:** ทันสมัย Responsive รองรับหน้าจอมือถือ 100%

---

## 📂 รหัสเชื่อมโยงฐานข้อมูล (Database & Storage IDs)

- **Google Sheet ID:** `1JM-i8_nrGR7-VDEY82QZ5l5JMJTIBOIsuqOSQSrcD3Y`
- **Google Drive Folder ID:** `1tfKH6EOBFdG0c4Wm2MPO-R61NP5mAc0c`

---

## 🛠️ ขั้นตอนการติดตั้งและการ Deploy (Setup Guide)

### ขั้นตอนที่ 1: ติดตั้ง Google Apps Script (Backend)

1. เปิดเว็บไซต์ [script.google.com](https://script.google.com) แล้วคลิก **"New project" (โครงการใหม่)**
2. ตั้งชื่อโครงการ เช่น `Alcohol-Inspection-Backend-TTMK`
3. ลบโค้ดเดิมในไฟล์ `Code.gs` ออกทั้งหมด แล้วคัดลอกโค้ดจากไฟล์ `c:\TTMK\Alcohol\Code.gs` ไปวางแทนที่
4. กดปุ่ม **Save (บันทึก)**
5. คลิกเลือกฟังก์ชัน `initialSetup` จากดรอปดาวน์ด้านบน แล้วกด **Run (เรียกใช้)** 
   - ระบบจะขอสิทธิ์เข้าถึง Google Sheets และ Google Drive (ให้กด Review Permissions -> เลือกบัญชี Google -> Advanced -> Go to ... (unsafe) -> Allow)
   - สคริปต์จะสร้างตาราง `Alcohol_Logs` และ `Registered_Drivers` พร้อมกำหนดหัวคอลัมน์ให้อัตโนมัติทันที
6. กดปุ่มสีน้ำเงิน **Deploy (การทำให้ใช้งานได้)** -> เลือก **New deployment (การทำให้ใช้งานได้รายการใหม่)**
   - ประเภท (Select type): เลือกรูปฟันเฟือง -> **Web app (เว็บแอป)**
   - Description: `v1.0.0`
   - Execute as (ดำเนินการในฐานะ): **Me (ฉัน - your_email@gmail.com)**
   - Who has access (ผู้มีสิทธิ์เข้าถึง): **Anyone (ทุกคน)** *(สำคัญมาก เพื่อให้ GitHub Pages ส่งข้อมูลเข้ามาได้)*
   - กดปุ่ม **Deploy**
7. คัดลอก **Web app URL** ที่ได้ (ขึ้นต้นด้วย `https://script.google.com/macros/s/.../exec`)

---

### ขั้นตอนที่ 2: นำ Web App URL มาใส่ในโปรเจกต์ Frontend

1. เปิดไฟล์ `c:\TTMK\Alcohol\app.js`
2. บรรทัดที่ 12 ในออบเจกต์ `CONFIG`:
   ```javascript
   GAS_WEBAPP_URL: "https://script.google.com/macros/s/ใส่_URL_ที่ได้จากขั้นตอนที่_1/exec",
   ```
3. บันทึกไฟล์ `app.js`

---

### ขั้นตอนที่ 3: อัปโหลดขึ้น GitHub และเปิด GitHub Pages (Frontend Hosting)

1. สร้าง Repository ใหม่บน [GitHub.com](https://github.com) เช่น ชื่อ `alcohol-check`
2. อัปโหลดไฟล์ในโฟลเดอร์ `c:\TTMK\Alcohol\` ขึ้นไป:
   - `index.html`
   - `app.js`
   - `style.css`
   - `README.md`
3. ไปที่เมนู **Settings** ของ Repository บน GitHub -> คลิกแถบ **Pages** ทางด้านซ้าย
4. ในส่วน **Build and deployment**:
   - Source: เลือก **Deploy from a branch**
   - Branch: เลือก **main** (หรือ `master`) และโฟลเดอร์ `/(root)`
   - กด **Save**
5. รอประมาณ 1-2 นาที GitHub จะสร้างลิงก์ WebApp ให้ เช่น `https://username.github.io/alcohol-check/`
6. สามารถส่งลิงก์หรือสร้าง QR Code ให้พนักงานขับรถเปิดใช้งานบนมือถือได้ทันที

---

## 📊 โครงสร้างหัวคอลัมน์ใน Google Sheet (`Alcohol_Logs`)

| คอลัมน์ | ชื่อ Header | รายละเอียด |
| :--- | :--- | :--- |
| A | `Timestamp` | วันที่และเวลาที่บันทึกผล |
| B | `Date` | วันที่ตรวจ (YYYY-MM-DD) |
| C | `Time` | เวลาที่ตรวจ (HH:mm:ss) |
| D | `Driver_ID` | รหัสพนักงานขับรถ |
| E | `Driver_Name` | ชื่อ - นามสกุล พนักงาน |
| F | `Email` | อีเมลพนักงาน |
| G | `Phone` | เบอร์โทรศัพท์ |
| H | `Vehicle_Plate` | ทะเบียนรถ |
| I | `Alcohol_Value` | ค่าระดับแอลกอฮอล์ (mg%) |
| J | `Status` | ผ่าน / ไม่ผ่าน |
| K | `Face_Match_Percent` | ระดับความตรงของใบหน้า 1:1 (%) |
| L | `Face_Photo_URL` | ลิงก์ดูภาพถ่ายใบหน้าใน Google Drive |
| M | `Meter_Photo_URL` | ลิงก์ดูภาพถ่ายหน้าปัดเครื่องเป่าใน Google Drive |
| N | `GPS_Coordinates` | พิกัดละติจูด, ลองจิจูด |
| O | `Google_Maps_Link` | ลิงก์ดูตำแหน่งบน Google Maps |
| P | `Verification_Method` | วิธีการตรวจสอบ |
| Q | `Remarks` | หมายเหตุ |

---

## 🔒 ลิขสิทธิ์และผู้รับผิดชอบ

```
copyright , Mr.Taweesak.kom (0623285963)
หจก. ทั่วไทยขนส่งมงคล
```
