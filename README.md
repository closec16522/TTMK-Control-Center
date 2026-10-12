# 🚚 หจก. ทั่วไทยขนส่งมงคล (TTMK)
## ศูนย์ควบคุมการขนส่งและ TSM Safety Enterprise Platform

ระบบบริหารจัดการกองยานพาหนะและควบคุมความปลอดภัย TSM ครบวงจร พัฒนาด้วยมาตรฐานดีไซน์และ Template เดียวกับระบบ **Smart Inspection (Alcohol Check)** รองรับการทำงานแบบเรียบลื่น (60fps Butter-Smooth) และเชื่อมโยงฐานข้อมูลจริงแบบ Multi-Cloud ผ่าน Google Spreadsheet และ Google Drive

---

### 🌐 ที่อยู่และลิงก์ระบบภายใน Local Server (`http://localhost:3000/`)

| ระบบ | ลิงก์ภายในระบบ | รายละเอียดการทำงาน |
| :--- | :--- | :--- |
| **🏢 TTMK Control Center (ศูนย์ควบคุมหลัก)** | [`http://localhost:3000/`](http://localhost:3000/) | หน้าแดชบอร์ดหลัก ออกแบบด้วย Template แบบเดียวกับ Smart Inspection มี 6 แท็บทำงาน |
| **🍺 ระบบตรวจวัดแอลกอฮอล์และสุขภาพ** | [`http://localhost:3000/Alcohol/index.html`](http://localhost:3000/Alcohol/index.html) | ตรวจจับใบหน้า 1:1, AI OCR หน้าปัดเครื่องเป่า, ตรวจวัดความดัน SYS/DIA |
| **🚛 ระบบตรวจสภาพรถ 6 ล้อ 3D** | [`http://localhost:3000/CheckTruck/index.html`](http://localhost:3000/CheckTruck/index.html) | Digital Twin 3D Inspection มาตรฐาน F-CAM-032_r3 ส่งออกรายงาน PDF รายวัน/รายเดือน |
| **👤 ลงทะเบียนพนักงานขับรถใหม่** | [`http://localhost:3000/Alcohol/register.html`](http://localhost:3000/Alcohol/register.html) | ถ่ายรูปใบหน้าต้นแบบ 1:1 และบันทึกข้อมูลเข้า Google Sheet ทันที |

---

### 🗄️ การเชื่อมต่อฐานข้อมูล Google Spreadsheet & Google Drive จริง

- **Google Spreadsheet ID**: `1JM-i8_nrGR7-VDEY82QZ5l5JMJTIBOIsuqOSQSrcD3Y`
  - **`Registered_Drivers`**: ฐานข้อมูลพนักงานขับรถจริงทั้งหมด 20 ราย พร้อมรูปต้นแบบ 1:1
  - **`Alcohol_Logs`**: ประวัติการเป่าแอลกอฮอล์และค่าความดันโลหิตรายวัน
  - **`Truck_Inspection_Logs`**: รายการตรวจเช็กสภาพรถ 6 ล้อ และผลการตรวจ 15 จุด
  - **`System_Config`**: ค่าตั้งค่าระบบ (Admin Passcode, Notification Tokens, Google Drive Folder IDs)
- **Google Drive Folder ID (ข้อมูลการตรวจวัดแอลกอฮอล์และความดัน)**:
  - `1tfKH6EOBFdG0c4Wm2MPO-R61NP5mAc0c`
- **Google Drive Folder ID (ข้อมูลการตรวจสอบรถบรรทุก Report รายวันและรายเดือน)**:
  - `1ryLhwkO1lnv-2qgLbDDl0XyVaq8S2Szs`

---

### 🚀 การเริ่มเซิร์ฟเวอร์พัฒนาในเครื่อง (Local Dev Server)

ดับเบิลคลิกไฟล์ `start_dev_server.bat` หรือเปิด PowerShell แล้วสั่ง:
```bash
node server.js
```
เปิดบราวเซอร์ไปที่: `http://localhost:3000/`

ลิขสิทธิ์ระบบ: **Mr.Taweesak.kom (062-3285963) - หจก. ทั่วไทยขนส่งมงคล**
