# 🚚 TTMK Control Center Dashboard

ระบบบริหารจัดการและควบคุมระบบขนส่ง TTMK Control Center Dashboard พัฒนาด้วย HTML, Tailwind CSS, Font Awesome, Chart.js และ SweetAlert2 พร้อมระบบเชื่อมต่อฐานข้อมูล Google Sheets และ Google Drive แบบ Real-time

---

## 🗄️ การสร้างตารางฐานข้อมูลบน Google Sheet (ID: `19Ve3nx5crTV4JJu05ZPqDI_04pBVOkRLNcf7wxfzC8o`)

### ขั้นตอนสร้างตารางฐานข้อมูลอัตโนมัติ 7 แท็บ:
1. เปิด **Google Sheet**: `https://docs.google.com/spreadsheets/d/19Ve3nx5crTV4JJu05ZPqDI_04pBVOkRLNcf7wxfzC8o/edit`
2. คลิกเมนู **ส่วนขยาย (Extensions)** ➔ **Apps Script**
3. คัดลอกโค้ดทั้งหมดในไฟล์ `google_apps_script.gs` วางลงในไฟล์ `Code.gs`
4. ที่เมนูดร็อปดาวน์ฟังก์ชันด้านบน เลือก **`setupInitialDatabase`** แล้วกดปุ่ม **`Run (เรียกใช้)`**
   👉 *ระบบจะสร้างตารางฐานข้อมูล 7 แท็บ พร้อมหัวข้อสีสันสวยงามและข้อมูลเริ่มต้นลง Google Sheet ทันที!*
5. กดปุ่ม **Deploy (ทำให้ใช้งานได้)** ➔ **New deployment (การทำให้ใช้งานได้ใหม่)**
   - ประเภท: **Web App (แอปเว็บ)**
   - Execute as: **Me (ฉัน)**
   - Who has access: **Anyone (ทุกคน)**
6. คัดลอก URL Web App ที่ได้ นำมาวางในตัวแปร `WEB_APP_URL` ในไฟล์ `index.html`

---

## 📋 แท็บตารางฐานข้อมูลที่ถูกสร้างใน Google Sheet:
1. **`Inspections`**: บันทึกผลสุ่มตรวจความปลอดภัยประจำวัน
2. **`Maintenance`**: บันทึกงานซ่อมบำรุง + ลิงก์รูปถ่ายใบเสร็จและจุดซ่อมใน Google Drive
3. **`SCG_Alerts`**: บันทึกการแจ้งเตือนด่วน (Fatigue / Overspeed / Route Dev.)
4. **`Expenses`**: บันทึกการเบิกจ่ายค่าน้ำมันและค่าใช้จ่ายรายทาง
5. **`Vehicles`**: คลังข้อมูลทะเบียนรถและกำหนด PM
6. **`Employees`**: คลังข้อมูลพนักงานผขร.
7. **`Master_Data`**: บันทึกการตั้งค่าตัวเลือกในระบบ (ประเภทรถ / ประเภทงาน) และ LINE Token
