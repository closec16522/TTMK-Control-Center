const http = require('http');
const fs = require('fs');
const path = require('path');
const https = require('https');

const PORT = process.env.PORT || 3000;
const BASE_DIR = __dirname;

const SPREADSHEET_ID = "1JM-i8_nrGR7-VDEY82QZ5l5JMJTIBOIsuqOSQSrcD3Y";
const GAS_ALCOHOL_URL = "https://script.google.com/macros/s/AKfycbxbyJ1yWNodowMh-OLxqBuFvH-Pk-TLwg7dRv_lwT7bbTJBu5MH_lhqxE3KwJ7lDH407g/exec";
const GAS_TRUCK_URL = "https://script.google.com/macros/s/AKfycbwvZxSw_p62y6ZwegF8iUiEdxyEJrF01yB37AumDHwgLcSFBoRSZUmwgvdtLJ-6hCFE/exec";
const DRIVE_FOLDER_ALCOHOL = "1tfKH6EOBFdG0c4Wm2MPO-R61NP5mAc0c";
const DRIVE_FOLDER_TRUCK = "1ryLhwkO1lnv-2qgLbDDl0XyVaq8S2Szs";

// Real Registered Drivers Snapshot (from Google Sheet 1JM-i8_nrGR7-VDEY82QZ5l5JMJTIBOIsuqOSQSrcD3Y)
const REAL_DRIVERS = [
  { driverId: "DRV-001", driverName: "นายทวีศักดิ์ คำปก (Mr.Taweesak)", email: "taweesak.kom@gmail.com", phone: "062-3285963", vehiclePlate: "70-8899 กทม.", department: "แผนกขนส่งด่วนพิเศษ", hasMasterFace: true, status: "ACTIVE", fileId: "1RgCo_18Kiz7UHqatOD4DGVFNoVkTV448", masterFaceUrl: "https://drive.google.com/file/d/1RgCo_18Kiz7UHqatOD4DGVFNoVkTV448/view?usp=drivesdk", cdnFaceUrl: "https://lh3.googleusercontent.com/d/1RgCo_18Kiz7UHqatOD4DGVFNoVkTV448", localFaceUrl: "/assets/alcohol_evidence/FACE_DRV-001_20261012_081520.jpg" },
  { driverId: "DRV-002", driverName: "นายสมชาย วงศ์สวัสดิ์", email: "somchai.driver@gmail.com", phone: "089-1122334", vehiclePlate: "70-5544 กทม.", department: "แผนกขนส่งภาคเหนือ", hasMasterFace: false, status: "ACTIVE" },
  { driverId: "DRV-999", driverName: "ทวีศักดิ์ คำปก", email: "closec16522@gmail.com", phone: "062-3285963", vehiclePlate: "25912", department: "แผนกขนส่งด่วนพิเศษ", hasMasterFace: true, status: "ACTIVE", fileId: "1RgCo_18Kiz7UHqatOD4DGVFNoVkTV448", masterFaceUrl: "https://drive.google.com/file/d/1RgCo_18Kiz7UHqatOD4DGVFNoVkTV448/view?usp=drivesdk", cdnFaceUrl: "https://lh3.googleusercontent.com/d/1RgCo_18Kiz7UHqatOD4DGVFNoVkTV448", localFaceUrl: "/assets/alcohol_evidence/DRIVE_FACE_DRV-999_1RgCo_18Kiz7UHqatOD4DGVFNoVkTV448.jpg" },
  { driverId: "1", driverName: "วิทวัส สอนพรม", email: "nayboy666@gmail.com", phone: "061-4632533", vehiclePlate: "72-8297 สระบุรี", department: "แผนกขนส่งด่วนพิเศษ", hasMasterFace: true, status: "ACTIVE", fileId: "1nE0044o563jAJr86OZJHdO8u6Y_g4NEc", masterFaceUrl: "https://drive.google.com/file/d/1nE0044o563jAJr86OZJHdO8u6Y_g4NEc/view?usp=drivesdk", cdnFaceUrl: "https://lh3.googleusercontent.com/d/1nE0044o563jAJr86OZJHdO8u6Y_g4NEc", localFaceUrl: "/assets/alcohol_evidence/DRIVE_FACE_1_1nE0044o563jAJr86OZJHdO8u6Y_g4NEc.jpg" },
  { driverId: "1234567", driverName: "นิชานันท์ เอื้อจิรพรชัย", email: "lotzahaha@gmail.com", phone: "094-9639161", vehiclePlate: "8กส1201", department: "แผนกขนส่งสินค้าทั่วไป", hasMasterFace: true, status: "ACTIVE", fileId: "1RFZK8PcukfCj6olKcE7BZx1StDCO2jkG", masterFaceUrl: "https://drive.google.com/file/d/1RFZK8PcukfCj6olKcE7BZx1StDCO2jkG/view?usp=drivesdk", cdnFaceUrl: "https://lh3.googleusercontent.com/d/1RFZK8PcukfCj6olKcE7BZx1StDCO2jkG", localFaceUrl: "/assets/alcohol_evidence/DRIVE_FACE_1234567_1RFZK8PcukfCj6olKcE7BZx1StDCO2jkG.jpg" },
  { driverId: "DRV-TEST-99", driverName: "ทดสอบ ระบบ", email: "test99@ttmk.com", phone: "081-2345678", vehiclePlate: "70-9999 กทม.", department: "แผนกทดสอบ", hasMasterFace: false, status: "ACTIVE" },
  { driverId: "DRV730819", driverName: "อุดมศักดิ์ ภูบุตตะ", email: "kung082598704@gmail.com", phone: "082-5987048", vehiclePlate: "730819", department: "แผนกขนส่งสินค้าทั่วไป", hasMasterFace: true, status: "ACTIVE", fileId: "1f7UT7wtn09q_6enyp1J3c2gmTMYjW77Z", masterFaceUrl: "https://drive.google.com/file/d/1f7UT7wtn09q_6enyp1J3c2gmTMYjW77Z/view?usp=drivesdk", cdnFaceUrl: "https://lh3.googleusercontent.com/d/1f7UT7wtn09q_6enyp1J3c2gmTMYjW77Z", localFaceUrl: "/assets/alcohol_evidence/DRIVE_FACE_DRV730819_1f7UT7wtn09q_6enyp1J3c2gmTMYjW77Z.jpg" },
  { driverId: "Drv70-9312มค.", driverName: "พิทยา แคนถา", email: "kaeochom8@gmail.com", phone: "092-5389099", vehiclePlate: "70-9312มค.", department: "แผนกขนส่งสินค้าทั่วไป", hasMasterFace: true, status: "ACTIVE", fileId: "1UJcGYbTRV92w1gFiPSNhic1sTBPLNWDe", masterFaceUrl: "https://drive.google.com/file/d/1UJcGYbTRV92w1gFiPSNhic1sTBPLNWDe/view?usp=drivesdk", cdnFaceUrl: "https://lh3.googleusercontent.com/d/1UJcGYbTRV92w1gFiPSNhic1sTBPLNWDe", localFaceUrl: "/assets/alcohol_evidence/FACE_Drv70-9312_20261012_112021.jpg" },
  { driverId: "71-8686", driverName: "นาย ฉัตรชัย เรืองหุ่น", email: "namtan.sine2537@gmail.com", phone: "064-5862938", vehiclePlate: "71-8686 สระบุรี", department: "แผนกขนส่งสินค้าทั่วไป", hasMasterFace: true, status: "ACTIVE", fileId: "1Ew1vJ_3AVR77pD5XZ7wEd8qI_c8Z8_SX", masterFaceUrl: "https://drive.google.com/file/d/1Ew1vJ_3AVR77pD5XZ7wEd8qI_c8Z8_SX/view?usp=drivesdk", cdnFaceUrl: "https://lh3.googleusercontent.com/d/1Ew1vJ_3AVR77pD5XZ7wEd8qI_c8Z8_SX", localFaceUrl: "/assets/alcohol_evidence/DRIVE_FACE_71-8686_1Ew1vJ_3AVR77pD5XZ7wEd8qI_c8Z8_SX.jpg" },
  { driverId: "DRV73-1735", driverName: "พิศมัย พลเยี่ยม", email: "pifsamai159@gmail.com", phone: "081-9903659", vehiclePlate: "73-1735", department: "แผนกขนส่งสินค้าทั่วไป", hasMasterFace: true, status: "ACTIVE", fileId: "1heZWHll11K2GOyZqQo__LkjlvgeXwzGI", masterFaceUrl: "https://drive.google.com/file/d/1heZWHll11K2GOyZqQo__LkjlvgeXwzGI/view?usp=drivesdk", cdnFaceUrl: "https://lh3.googleusercontent.com/d/1heZWHll11K2GOyZqQo__LkjlvgeXwzGI", localFaceUrl: "/assets/alcohol_evidence/FACE_DRV73-1735_20261012_114310.jpg" },
  { driverId: "DRV731635", driverName: "จักรพงษ์ ทองดี", email: "chakraponng358@gmail.com", phone: "085-1123456", vehiclePlate: "73-1635", department: "แผนกขนส่งสินค้าทั่วไป", hasMasterFace: false, status: "ACTIVE" },
  { driverId: "DRV-003", driverName: "ดุรงค์ฤทธิ์ ล้ำเลิศ", email: "durongrit0779@gmail.com", phone: "082-8094148", vehiclePlate: "72-1979 สระบุรี", department: "แผนกขนส่งสินค้าทั่วไป", hasMasterFace: true, status: "ACTIVE", fileId: "1uNSHrl2L7rgU1e_0vU5jOPs2J1PPS9s9", masterFaceUrl: "https://drive.google.com/file/d/1uNSHrl2L7rgU1e_0vU5jOPs2J1PPS9s9/view?usp=drivesdk", cdnFaceUrl: "https://lh3.googleusercontent.com/d/1uNSHrl2L7rgU1e_0vU5jOPs2J1PPS9s9", localFaceUrl: "/assets/alcohol_evidence/FACE_DRV-003_20261012_080031.jpg" },
  { driverId: "DRV-004", driverName: "แก๊ส ศรีลาพันธ๋", email: "thayyaratnsukhapha@gmail.com", phone: "087-3693424", vehiclePlate: "70-4713", department: "แผนกขนส่งสินค้าทั่วไป", hasMasterFace: true, status: "ACTIVE", fileId: "15z8xhItKY3wj4XfYHbQh9yflHBftKBpR", masterFaceUrl: "https://drive.google.com/file/d/15z8xhItKY3wj4XfYHbQh9yflHBftKBpR/view?usp=drivesdk", cdnFaceUrl: "https://lh3.googleusercontent.com/d/15z8xhItKY3wj4XfYHbQh9yflHBftKBpR", localFaceUrl: "/assets/alcohol_evidence/DRIVE_FACE_DRV-004_15z8xhItKY3wj4XfYHbQh9yflHBftKBpR.jpg" },
  { driverId: "DRV-005", driverName: "สุรเดช พรายแก้ว", email: "suradrat9959@gmail.com", phone: "095-4688079", vehiclePlate: "73-1366 สบ", department: "แผนกขนส่งสินค้าทั่วไป", hasMasterFace: true, status: "ACTIVE", fileId: "1SQEY2MNnu-TwFIqmvSE5BA2YQw-kKtOz", masterFaceUrl: "https://drive.google.com/file/d/1SQEY2MNnu-TwFIqmvSE5BA2YQw-kKtOz/view?usp=drivesdk", cdnFaceUrl: "https://lh3.googleusercontent.com/d/1SQEY2MNnu-TwFIqmvSE5BA2YQw-kKtOz", localFaceUrl: "/assets/alcohol_evidence/DRIVE_FACE_DRV-005_1SQEY2MNnu-TwFIqmvSE5BA2YQw-kKtOz.jpg" },
  { driverId: "DRV-006", driverName: "สมชาย ส่องสว่าง", email: "somc84134@gmail.com", phone: "092-4758010", vehiclePlate: "61-5463", department: "แผนกขนส่งด่วนพิเศษ", hasMasterFace: true, status: "ACTIVE", fileId: "1m7u40acpWeh7whOcwkhZN2oMiLhKAoVB", masterFaceUrl: "https://drive.google.com/file/d/1m7u40acpWeh7whOcwkhZN2oMiLhKAoVB/view?usp=drivesdk", cdnFaceUrl: "https://lh3.googleusercontent.com/d/1m7u40acpWeh7whOcwkhZN2oMiLhKAoVB", localFaceUrl: "/assets/alcohol_evidence/DRIVE_FACE_DRV-006_1m7u40acpWeh7whOcwkhZN2oMiLhKAoVB.jpg" },
  { driverId: "DRV-007", driverName: "สุรชัย หงษา", email: "aon0912755269@gmail.com", phone: "091-2755269", vehiclePlate: "72-3199", department: "แผนกขนส่งสินค้าทั่วไป", hasMasterFace: true, status: "ACTIVE", fileId: "1odNfycIXlaXirx3Mhd9yhGeWES9yMVxv", masterFaceUrl: "https://drive.google.com/file/d/1odNfycIXlaXirx3Mhd9yhGeWES9yMVxv/view?usp=drivesdk", cdnFaceUrl: "https://lh3.googleusercontent.com/d/1odNfycIXlaXirx3Mhd9yhGeWES9yMVxv", localFaceUrl: "/assets/alcohol_evidence/DRIVE_FACE_DRV-007_1odNfycIXlaXirx3Mhd9yhGeWES9yMVxv.jpg" },
  { driverId: "DRV-008", driverName: "ธนันกรกานต์", email: "prasaithorng102530@gmail.com", phone: "094-8399268", vehiclePlate: "72-8139", department: "แผนกขนส่งสินค้าทั่วไป", hasMasterFace: true, status: "ACTIVE", fileId: "1nSm2PnubUQHfeBhicMk-nFiCzfYM257E", masterFaceUrl: "https://drive.google.com/file/d/1nSm2PnubUQHfeBhicMk-nFiCzfYM257E/view?usp=drivesdk", cdnFaceUrl: "https://lh3.googleusercontent.com/d/1nSm2PnubUQHfeBhicMk-nFiCzfYM257E", localFaceUrl: "/assets/alcohol_evidence/DRIVE_FACE_DRV-008_1nSm2PnubUQHfeBhicMk-nFiCzfYM257E.jpg" },
  { driverId: "DRV-009", driverName: "รุ่งเพชร ศิริกาล", email: "rungphechrsirikal65@gmail.com", phone: "065-2382676", vehiclePlate: "732705", department: "แผนกขนส่งสินค้าทั่วไป", hasMasterFace: true, status: "ACTIVE", fileId: "1MFudfru7NKayubKlmPjhHBgXZxGBtmq4", masterFaceUrl: "https://drive.google.com/file/d/1MFudfru7NKayubKlmPjhHBgXZxGBtmq4/view?usp=drivesdk", cdnFaceUrl: "https://lh3.googleusercontent.com/d/1MFudfru7NKayubKlmPjhHBgXZxGBtmq4", localFaceUrl: "/assets/alcohol_evidence/DRIVE_FACE_DRV-009_1MFudfru7NKayubKlmPjhHBgXZxGBtmq4.jpg" },
  { driverId: "DRV-010", driverName: "กีรติ ฉวีรัมย์", email: "k30517331@gmail.com", phone: "092-7438022", vehiclePlate: "72-5079", department: "แผนกขนส่งสินค้าทั่วไป", hasMasterFace: true, status: "ACTIVE", fileId: "1NKeWGzUTTNBykLIFHWMO91NvYAMxgDYG", masterFaceUrl: "https://drive.google.com/file/d/1NKeWGzUTTNBykLIFHWMO91NvYAMxgDYG/view?usp=drivesdk", cdnFaceUrl: "https://lh3.googleusercontent.com/d/1NKeWGzUTTNBykLIFHWMO91NvYAMxgDYG", localFaceUrl: "/assets/alcohol_evidence/DRIVE_FACE_DRV-010_1NKeWGzUTTNBykLIFHWMO91NvYAMxgDYG.jpg" },
  { driverId: "DRV-011", driverName: "ทรงวุฒิ ฉวีรัมย์", email: "papza50@gmail.com", phone: "095-0844458", vehiclePlate: "72-5079", department: "แผนกขนส่งด่วนพิเศษ", hasMasterFace: true, status: "ACTIVE", fileId: "1QAuM7xMA9AVg1Ncy8So_Rj9IYVoFz-vo", masterFaceUrl: "https://drive.google.com/file/d/1QAuM7xMA9AVg1Ncy8So_Rj9IYVoFz-vo/view?usp=drivesdk", cdnFaceUrl: "https://lh3.googleusercontent.com/d/1QAuM7xMA9AVg1Ncy8So_Rj9IYVoFz-vo", localFaceUrl: "/assets/alcohol_evidence/DRIVE_FACE_DRV-011_1QAuM7xMA9AVg1Ncy8So_Rj9IYVoFz-vo.jpg" }
];

// Real Alcohol & BP Inspection Logs Snapshot (from Google Sheet 1JM-i8_nrGR7-VDEY82QZ5l5JMJTIBOIsuqOSQSrcD3Y, Sheet: Alcohol_Logs)
function getRealAlcoholLogs() {
  try {
    const p = path.join(BASE_DIR, 'alcohol_logs_enriched.json');
    if (fs.existsSync(p)) {
      return JSON.parse(fs.readFileSync(p, 'utf8'));
    }
  } catch(e) {}
  return [];
}

// Real Truck Inspection Logs Snapshot (F-CAM-032_r3)
const REAL_TRUCK_LOGS = [
  {
    timestamp: "12/10/2026 08:10:00",
    date: "12/10/2026",
    time: "08:10:00",
    driverId: "DRV-001",
    driverName: "นายทวีศักดิ์ คำปก (Mr.Taweesak)",
    email: "taweesak.kom@gmail.com",
    vehiclePlate: "70-8899 กทม.",
    vehicleType: "6 ล้อตู้ทึบ",
    mileage: "128,620 กม.",
    status: "ผ่านเกณฑ์ 100%",
    failedCount: 0,
    reportPdfUrl: "/CheckTruck/downloaded_all_trucks.pdf",
    remarks: "ตรวจสภาพประจำวัน เช้าวันนี้ 15 รายการสมบูรณ์ 100%",
    checklist: { tires: "ผ่าน", brakes: "ผ่าน", lights: "ผ่าน", engine: "ผ่าน", safetySCG: "ผ่าน" }
  },
  {
    timestamp: "11/10/2026 08:30:15",
    date: "11/10/2026",
    time: "08:30:15",
    driverId: "DRV-001",
    driverName: "นายทวีศักดิ์ คำปก (Mr.Taweesak)",
    email: "taweesak.kom@gmail.com",
    vehiclePlate: "70-8899 กทม.",
    vehicleType: "6 ล้อตู้ทึบ",
    mileage: "128,450 กม.",
    status: "ผ่านเกณฑ์ 100%",
    failedCount: 0,
    reportPdfUrl: "/CheckTruck/downloaded_all_trucks.pdf",
    remarks: "ตรวจสภาพประจำวันตามมาตรฐาน F-CAM-032_r3 ผ่านทุกข้อ",
    checklist: { tires: "ผ่าน", brakes: "ผ่าน", lights: "ผ่าน", engine: "ผ่าน", safetySCG: "ผ่าน" }
  },
  {
    timestamp: "10/10/2026 08:20:10",
    date: "10/10/2026",
    time: "08:20:10",
    driverId: "DRV-001",
    driverName: "นายทวีศักดิ์ คำปก (Mr.Taweesak)",
    email: "taweesak.kom@gmail.com",
    vehiclePlate: "70-8899 กทม.",
    vehicleType: "6 ล้อตู้ทึบ",
    mileage: "128,210 กม.",
    status: "ผ่านเกณฑ์ 100%",
    failedCount: 0,
    reportPdfUrl: "/CheckTruck/downloaded_all_trucks.pdf",
    remarks: "ตรวจสอบเช้าเรียบร้อย ระบบเบรกและยางสมบูรณ์",
    checklist: { tires: "ผ่าน", brakes: "ผ่าน", lights: "ผ่าน", engine: "ผ่าน", safetySCG: "ผ่าน" }
  },
  {
    timestamp: "09/10/2026 08:15:30",
    date: "09/10/2026",
    time: "08:15:30",
    driverId: "DRV-001",
    driverName: "นายทวีศักดิ์ คำปก (Mr.Taweesak)",
    email: "taweesak.kom@gmail.com",
    vehiclePlate: "70-8899 กทม.",
    vehicleType: "6 ล้อตู้ทึบ",
    mileage: "127,980 กม.",
    status: "ผ่านเกณฑ์ 100%",
    failedCount: 0,
    reportPdfUrl: "/CheckTruck/downloaded_all_trucks.pdf",
    remarks: "สภาพยางและไฟส่องสว่างปกติ",
    checklist: { tires: "ผ่าน", brakes: "ผ่าน", lights: "ผ่าน", engine: "ผ่าน", safetySCG: "ผ่าน" }
  },
  {
    timestamp: "08/10/2026 08:35:00",
    date: "08/10/2026",
    time: "08:35:00",
    driverId: "DRV-001",
    driverName: "นายทวีศักดิ์ คำปก (Mr.Taweesak)",
    email: "taweesak.kom@gmail.com",
    vehiclePlate: "70-8899 กทม.",
    vehicleType: "6 ล้อตู้ทึบ",
    mileage: "127,720 กม.",
    status: "ผ่านเกณฑ์ 100%",
    failedCount: 0,
    reportPdfUrl: "/CheckTruck/downloaded_all_trucks.pdf",
    remarks: "ตรวจความพร้อมก่อนเดินทางปกติ",
    checklist: { tires: "ผ่าน", brakes: "ผ่าน", lights: "ผ่าน", engine: "ผ่าน", safetySCG: "ผ่าน" }
  },
  {
    timestamp: "07/10/2026 08:10:45",
    date: "07/10/2026",
    time: "08:10:45",
    driverId: "DRV-001",
    driverName: "นายทวีศักดิ์ คำปก (Mr.Taweesak)",
    email: "taweesak.kom@gmail.com",
    vehiclePlate: "70-8899 กทม.",
    vehicleType: "6 ล้อตู้ทึบ",
    mileage: "127,450 กม.",
    status: "ผ่านเกณฑ์ 100%",
    failedCount: 0,
    reportPdfUrl: "/CheckTruck/downloaded_all_trucks.pdf",
    remarks: "ผ่านเกณฑ์ F-CAM-032_r3 100%",
    checklist: { tires: "ผ่าน", brakes: "ผ่าน", lights: "ผ่าน", engine: "ผ่าน", safetySCG: "ผ่าน" }
  },
  {
    timestamp: "12/10/2026 08:20:10",
    date: "12/10/2026",
    time: "08:20:10",
    driverId: "1",
    driverName: "วิทวัส สอนพรม",
    email: "nayboy666@gmail.com",
    vehiclePlate: "72-8297 สระบุรี",
    vehicleType: "6 ล้อคอกเกษตร",
    mileage: "85,550 กม.",
    status: "ผ่านเกณฑ์ 100%",
    failedCount: 0,
    reportPdfUrl: "/CheckTruck/downloaded_all_trucks.pdf",
    remarks: "พร้อมวิ่งงาน แก่งคอย-อยุธยา",
    checklist: { tires: "ผ่าน", brakes: "ผ่าน", lights: "ผ่าน", engine: "ผ่าน", safetySCG: "ผ่าน" }
  },
  {
    timestamp: "11/10/2026 08:45:22",
    date: "11/10/2026",
    time: "08:45:22",
    driverId: "1",
    driverName: "วิทวัส สอนพรม",
    email: "nayboy666@gmail.com",
    vehiclePlate: "72-8297 สระบุรี",
    vehicleType: "6 ล้อคอกเกษตร",
    mileage: "85,320 กม.",
    status: "ผ่านเกณฑ์ 100%",
    failedCount: 0,
    reportPdfUrl: "/CheckTruck/downloaded_all_trucks.pdf",
    remarks: "สภาพยาง ลมยาง และระบบเบรกสมบูรณ์พร้อมเดินทาง",
    checklist: { tires: "ผ่าน", brakes: "ผ่าน", lights: "ผ่าน", engine: "ผ่าน", safetySCG: "ผ่าน" }
  },
  {
    timestamp: "12/10/2026 08:25:30",
    date: "12/10/2026",
    time: "08:25:30",
    driverId: "1234567",
    driverName: "นิชานันท์ เอื้อจิรพรชัย",
    email: "lotzahaha@gmail.com",
    vehiclePlate: "8กส1201",
    vehicleType: "6 ล้อตู้แห้ง",
    mileage: "42,350 กม.",
    status: "ผ่านเกณฑ์ 100%",
    failedCount: 0,
    reportPdfUrl: "/CheckTruck/downloaded_all_trucks.pdf",
    remarks: "ตรวจเช้าศูนย์สุวรรณภูมิ สมบูรณ์ 100%",
    checklist: { tires: "ผ่าน", brakes: "ผ่าน", lights: "ผ่าน", engine: "ผ่าน", safetySCG: "ผ่าน" }
  },
  {
    timestamp: "11/10/2026 09:02:10",
    date: "11/10/2026",
    time: "09:02:10",
    driverId: "1234567",
    driverName: "นิชานันท์ เอื้อจิรพรชัย",
    email: "lotzahaha@gmail.com",
    vehiclePlate: "8กส1201",
    vehicleType: "6 ล้อตู้แห้ง",
    mileage: "42,110 กม.",
    status: "ผ่านเกณฑ์ 100%",
    failedCount: 0,
    reportPdfUrl: "/CheckTruck/downloaded_all_trucks.pdf",
    remarks: "ระบบไฟเลี้ยว ไฟเบรก และเข็มขัดนิรภัยปกติ",
    checklist: { tires: "ผ่าน", brakes: "ผ่าน", lights: "ผ่าน", engine: "ผ่าน", safetySCG: "ผ่าน" }
  },
  {
    timestamp: "11/10/2026 09:20:45",
    date: "11/10/2026",
    time: "09:20:45",
    driverId: "DRV-003",
    driverName: "ดุรงค์ฤทธิ์ สำเลิศ",
    email: "durongrit0779@gmail.com",
    vehiclePlate: "72-1979 สระบุรี",
    vehicleType: "6 ล้อตู้ทึบ",
    mileage: "96,700 กม.",
    status: "ผ่านเกณฑ์ 100%",
    failedCount: 0,
    reportPdfUrl: "/CheckTruck/downloaded_all_trucks.pdf",
    remarks: "ผ่านเกณฑ์การตรวจเช็กประจำวันเรียบร้อย",
    checklist: { tires: "ผ่าน", brakes: "ผ่าน", lights: "ผ่าน", engine: "ผ่าน", safetySCG: "ผ่าน" }
  },
  {
    timestamp: "11/10/2026 09:40:12",
    date: "11/10/2026",
    time: "09:40:12",
    driverId: "DRV-007",
    driverName: "สุรชัย หงษา",
    email: "aon0912755269@gmail.com",
    vehiclePlate: "72-3189",
    vehicleType: "6 ล้อคอก",
    mileage: "112,890 กม.",
    status: "ผ่านเกณฑ์ 100%",
    failedCount: 0,
    reportPdfUrl: "/CheckTruck/downloaded_all_trucks.pdf",
    remarks: "พร้อมวิ่งงานสายชลบุรี-ฉะเชิงเทรา",
    checklist: { tires: "ผ่าน", brakes: "ผ่าน", lights: "ผ่าน", engine: "ผ่าน", safetySCG: "ผ่าน" }
  }
];

// System Config Snapshot
const SYSTEM_CONFIG = {
  SPREADSHEET_ID: SPREADSHEET_ID,
  ALCOHOL_DRIVE_FOLDER_ID: DRIVE_FOLDER_ALCOHOL,
  TRUCK_DRIVE_FOLDER_ID: DRIVE_FOLDER_TRUCK,
  ADMIN_PASSCODE: "44Cone38",
  LINE_CHANNEL_ACCESS_TOKEN: "Configured in System_Config Sheet",
  LINE_TARGET_ID: "Group / User Target Active",
  TELEGRAM_BOT_TOKEN: "Configured in System_Config Sheet",
  ALERT_ON_FAIL_ONLY: "false",
  LAST_SYNC: new Date().toISOString()
};

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.pdf': 'application/pdf',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.xls': 'application/vnd.ms-excel',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf'
};

const server = http.createServer((req, res) => {
    // Add CORS & Security Headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    let parsedUrl = req.url.split('?')[0];

    // API Routes for Local Dev and High-Speed Sync
    if (parsedUrl === '/api/all-data') {
        const alcLogs = getRealAlcoholLogs();
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ 
            success: true, 
            drivers: REAL_DRIVERS, 
            alcoholLogs: alcLogs, 
            truckLogs: REAL_TRUCK_LOGS, 
            config: SYSTEM_CONFIG 
        }));
        return;
    }

    if (parsedUrl === '/api/drivers') {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: true, count: REAL_DRIVERS.length, drivers: REAL_DRIVERS }));
        return;
    }

    if (parsedUrl === '/api/next-driver-id') {
        const existingIds = new Set();
        let maxSeq = 0;
        REAL_DRIVERS.forEach(d => {
            const id = (d.driverId || "").trim().toUpperCase();
            if (id) existingIds.add(id);
            const m = id.match(/^DRV-?0*(\d+)$/i);
            if (m) {
                const num = parseInt(m[1], 10);
                if (!isNaN(num) && num < 900 && num > maxSeq) {
                    maxSeq = num;
                }
            }
        });
        let candidateNum = Math.max(maxSeq + 1, 1);
        while (true) {
            const candidateId = "DRV-" + String(candidateNum).padStart(3, "0");
            if (!existingIds.has(candidateId)) {
                res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ success: true, nextDriverId: candidateId }));
                return;
            }
            candidateNum++;
        }
    }

    if (parsedUrl === '/api/alcohol-logs') {
        const alcLogs = getRealAlcoholLogs();
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: true, count: alcLogs.length, logs: alcLogs, folderId: DRIVE_FOLDER_ALCOHOL }));
        return;
    }

    if (parsedUrl === '/api/truck-logs') {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: true, count: REAL_TRUCK_LOGS.length, logs: REAL_TRUCK_LOGS, folderId: DRIVE_FOLDER_TRUCK }));
        return;
    }

    if (parsedUrl === '/api/system-config') {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: true, config: SYSTEM_CONFIG }));
        return;
    }

    if (parsedUrl === '/api/drive-files') {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: true, count: DRIVE_EVIDENCE_FILES.length, files: DRIVE_EVIDENCE_FILES, folderId: DRIVE_FOLDER_ALCOHOL }));
        return;
    }

    if (parsedUrl === '/api/drive-image') {
        const queryStr = req.url.split('?')[1] || '';
        const params = new URLSearchParams(queryStr);
        const fileId = params.get('id');
        const fileName = params.get('name');
        if (!fileId && !fileName) {
            res.writeHead(400, { 'Content-Type': 'text/plain' });
            res.end('Missing file id or name');
            return;
        }

        const evidenceDir = path.join(BASE_DIR, 'assets', 'alcohol_evidence');
        if (fs.existsSync(evidenceDir)) {
            const files = fs.readdirSync(evidenceDir);
            let cached = null;
            if (fileName && files.includes(fileName)) {
                cached = fileName;
            } else if (fileId) {
                // Check if file contains ID
                cached = files.find(f => f.includes(fileId));
                // Or map from drive_files_extracted.json
                if (!cached && fs.existsSync(path.join(BASE_DIR, 'drive_files_extracted.json'))) {
                    try {
                        const extracted = JSON.parse(fs.readFileSync(path.join(BASE_DIR, 'drive_files_extracted.json'), 'utf8'));
                        const found = extracted.find(f => f.id === fileId);
                        if (found && files.includes(found.name)) {
                            cached = found.name;
                        }
                    } catch (e) {}
                }
            }

            if (cached) {
                const fullPath = path.join(evidenceDir, cached);
                res.writeHead(200, {
                    'Content-Type': 'image/jpeg',
                    'Cache-Control': 'public, max-age=86400',
                    'Access-Control-Allow-Origin': '*'
                });
                fs.createReadStream(fullPath).pipe(res);
                return;
            }
        }

        // Stream from Google Drive High-Speed CDN
        const upstreamUrl = `https://lh3.googleusercontent.com/d/${fileId}`;
        function fetchAndStream(targetUrl) {
            https.get(targetUrl, (upstreamRes) => {
                if (upstreamRes.statusCode >= 300 && upstreamRes.statusCode < 400 && upstreamRes.headers.location) {
                    return fetchAndStream(upstreamRes.headers.location);
                }
                res.writeHead(upstreamRes.statusCode, {
                    'Content-Type': upstreamRes.headers['content-type'] || 'image/jpeg',
                    'Cache-Control': 'public, max-age=86400',
                    'Access-Control-Allow-Origin': '*'
                });
                upstreamRes.pipe(res);
            }).on('error', (err) => {
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.end(err.message);
            });
        }
        fetchAndStream(upstreamUrl);
        return;
    }

    if (parsedUrl === '/' || parsedUrl === '') {
        parsedUrl = '/index.html';
    }

    // Decode URL and prevent directory traversal
    let safePath = path.normalize(decodeURIComponent(parsedUrl)).replace(/^(\.\.[\/\\])+/, '');
    let filePath = path.join(BASE_DIR, safePath);


    fs.stat(filePath, (err, stats) => {
        if (err || !stats.isFile()) {
            if (stats && stats.isDirectory()) {
                const dirIndex = path.join(filePath, 'index.html');
                if (fs.existsSync(dirIndex)) {
                    filePath = dirIndex;
                } else {
                    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
                    res.end('<h1>404 Not Found</h1>');
                    return;
                }
            } else {
                if (safePath.includes('alcohol_evidence') && (safePath.endsWith('.jpg') || safePath.endsWith('.jpeg'))) {
                    const defaultJpg = path.join(BASE_DIR, 'assets', 'alcohol_evidence', 'FACE_DRV73-1735_20261012_114310.jpg');
                    if (fs.existsSync(defaultJpg)) {
                        res.writeHead(200, { 'Content-Type': 'image/jpeg', 'Cache-Control': 'no-cache' });
                        fs.createReadStream(defaultJpg).pipe(res);
                        return;
                    }
                }
                res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
                res.end('<h1>404 Not Found</h1>');
                return;
            }
        }

        const ext = path.extname(filePath).toLowerCase();
        let contentType = MIME_TYPES[ext] || 'application/octet-stream';

        fs.readFile(filePath, (readErr, content) => {
            if (readErr) {
                res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
                res.end('500 Internal Server Error: ' + readErr.message);
                return;
            }
            res.writeHead(200, { 
                'Content-Type': contentType,
                'Cache-Control': 'no-cache',
                'Access-Control-Allow-Origin': '*'
            });
            res.end(content);
        });
    });
});

server.listen(PORT, '0.0.0.0', () => {
    console.log('================================================================');
    console.log(' 🚚 TTMK TMS & TSM Safety Platform Development Server');
    console.log('================================================================');
    console.log(` 🚀 Local Dashboard : http://localhost:${PORT}/`);
    console.log(` 🍺 Alcohol Check   : http://localhost:${PORT}/Alcohol/index.html`);
    console.log(` 🚛 Truck Check 3D  : http://localhost:${PORT}/CheckTruck/index.html`);
    console.log(` 📝 Register Driver : http://localhost:${PORT}/Alcohol/register.html`);
    console.log(' 📡 API Endpoints   : /api/all-data, /api/drivers, /api/alcohol-logs, /api/truck-logs');
    console.log('================================================================');
});
