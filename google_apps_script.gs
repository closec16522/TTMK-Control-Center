/**
 * Google Apps Script for TTMK Control Center Dashboard
 * Google Sheet ID: 19Ve3nx5crTV4JJu05ZPqDI_04pBVOkRLNcf7wxfzC8o
 * Google Drive Folder ID: 1K_N2Wbrjoslm5MMc6jjRa488VgjDuWXf
 * 
 * ============================================================================
 * 🚀 ขั้นตอนการเปิดใช้งานฐานข้อมูลอัตโนมัติ (ครั้งแรกครั้งเดียว):
 * 1. เปิด Google Sheet ID: 19Ve3nx5crTV4JJu05ZPqDI_04pBVOkRLNcf7wxfzC8o
 * 2. ไปที่เมนู Extensions (ส่วนขยาย) -> Apps Script
 * 3. วางโค้ดทั้งหมดนี้ลงในไฟล์ Code.gs
 * 4. เลือกฟังก์ชัน "setupInitialDatabase" ด้านบน แล้วกดปุ่ม "Run (เรียกใช้)"
 *    -> ระบบจะสร้างแท็บตารางฐานข้อมูลและหัวข้อทั้งหมดลงใน Google Sheet ให้อัตโนมัติ!
 * 5. กดปุ่ม Deploy (ทำให้ใช้งานได้) -> New deployment (การทำให้ใช้งานได้ใหม่)
 * 6. เลือกประเภท: Web App (แอปเว็บ)
 *    - Execute as: Me (ฉัน)
 *    - Who has access: Anyone (ทุกคน)
 * 7. คัดลอก URL Web App ที่ได้ นำไปใส่ในตัวแปร WEB_APP_URL ในไฟล์ index.html
 * ============================================================================
 */

const SHEET_ID = '19Ve3nx5crTV4JJu05ZPqDI_04pBVOkRLNcf7wxfzC8o';
const DRIVE_FOLDER_ID = '1K_N2Wbrjoslm5MMc6jjRa488VgjDuWXf';

/**
 * 🛠️ ฟังก์ชันสร้างตารางฐานข้อมูลและหัวข้ออัตโนมัติทั้งหมดบน Google Sheet
 */
function setupInitialDatabase() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  
  // 1. แท็บ Inspections (ตรวจความปลอดภัย)
  createSheetWithHeaders(ss, 'Inspections', 
    ['Timestamp', 'Date_Time', 'Vehicle_Reg', 'Driver_Name', 'Seatbelt_Status', 'Phone_Usage'],
    [
      [new Date().toLocaleString('th-TH'), 'วันนี้ 08:30', '70-1234', 'อำนาจ ชูส่ง', 'คาดเข็มขัด', 'ไม่ใช้โทรศัพท์'],
      [new Date().toLocaleString('th-TH'), 'เมื่อวาน 15:00', '72-5566', 'สมชาย ใจดี', 'คาดเข็มขัด', 'ใช้โทรศัพท์']
    ]
  );

  // 2. แท็บ Maintenance (ซ่อมบำรุง)
  createSheetWithHeaders(ss, 'Maintenance', 
    ['Timestamp', 'Truck_Reg', 'Service_Location', 'Date', 'Odometer', 'Items_JSON', 'Total_Price', 'Receipt_Image_Drive_URL', 'Repair_Image_Drive_URL'],
    [
      [new Date().toLocaleString('th-TH'), '70-1234', 'อู่ ช.การช่าง', '2026-09-02', '125400', '[{"type":"PM","desc":"เปลี่ยนถ่ายน้ำมันเครื่อง 10L","price":"3500"}]', '3,500.00', 'https://drive.google.com/', 'https://drive.google.com/']
    ]
  );

  // 3. แท็บ SCG_Alerts (แจ้งเตือนฉุกเฉิน)
  createSheetWithHeaders(ss, 'SCG_Alerts', 
    ['Timestamp', 'Alert_Time', 'Truck_Reg', 'Driver_Name', 'Alert_Type', 'Description', 'Status', 'Resolution_Note'],
    [
      [new Date().toLocaleString('th-TH'), '14:30', '72-5566', 'สมชาย ใจดี', 'Fatigue (หลับใน)', 'AI ตรวจจับหลับตา > 2 วิ', 'รอจัดการ', ''],
      [new Date().toLocaleString('th-TH'), '13:15', '71-9988', 'วิชัย รักงาน', 'Overspeed', 'ความเร็ว 95 กม./ชม.', 'เรียบร้อย', 'ตักเตือนเรียบร้อย']
    ]
  );

  // 4. แท็บ Expenses (เบิกจ่ายพนักงาน)
  createSheetWithHeaders(ss, 'Expenses', 
    ['Timestamp', 'Date', 'Employee_ID', 'Employee_Name', 'Expense_Type', 'Amount', 'Ref_Invoice_No'],
    [
      [new Date().toLocaleString('th-TH'), '2026-09-02', 'EMP001', 'สมชาย ใจดี', 'ค่าน้ำมันเชื้อเพลิง', '1,500.00', 'INV-001']
    ]
  );

  // 5. แท็บ Vehicles (คลังรถ)
  createSheetWithHeaders(ss, 'Vehicles', 
    ['Truck_Reg', 'Vehicle_Type', 'Status', 'Assigned_Driver', 'PM_Distance_Km'],
    [
      ['70-1234', '6 ล้อคอก', 'Online', 'อำนาจ ชูส่ง', 'เลยกำหนด (ด่วน)'],
      ['71-9988', '10 ล้อ', 'Online', 'วิชัย รักงาน', '3,200 กม.'],
      ['72-5566', '6 ล้อตู้ทึบ', 'Online', 'สมชาย ใจดี', '1,500 กม.']
    ]
  );

  // 6. แท็บ Employees (พนักงาน)
  createSheetWithHeaders(ss, 'Employees', 
    ['Employee_ID', 'Full_Name', 'Role', 'Assigned_Truck', 'Status'],
    [
      ['EMP001', 'สมชาย ใจดี', 'Driver / ผขร.', '72-5566', 'Active'],
      ['EMP002', 'วิชัย รักงาน', 'Driver / ผขร.', '71-9988', 'Active']
    ]
  );

  // 7. แท็บ Master_Data (การตั้งค่า & ตัวเลือก & LINE Token)
  createSheetWithHeaders(ss, 'Master_Data', 
    ['Category', 'Key_Name', 'Value_JSON', 'Updated_At'],
    [
      ['SYSTEM_CONFIG', 'LINE_NOTIFY_TOKEN', '', new Date().toLocaleString('th-TH')],
      ['MASTER_DATA', 'VEHICLE_TYPES', '["6 ล้อตู้ทึบ","6 ล้อคอก","10 ล้อ","หัวลาก 18 ล้อ","รถกระบะตู้เย็น"]', new Date().toLocaleString('th-TH')],
      ['MASTER_DATA', 'WORK_TYPES', '["PM (น้ำมันเครื่อง)","ยาง / ล้อ","เบรก / ช่วงล่าง","ระบบไฟ / แบตเตอรี่","เครื่องยนต์","อื่นๆ"]', new Date().toLocaleString('th-TH')]
    ]
  );

  // ลบ Sheet1 เริ่มต้นที่ว่างอยู่ออก
  const defaultSheet = ss.getSheetByName('Sheet1');
  if (defaultSheet && ss.getSheets().length > 1) {
    try { ss.deleteSheet(defaultSheet); } catch (e) {}
  }

  Logger.log("✅ สร้างฐานข้อมูลทั้งหมดบน Google Sheet เรียบร้อยแล้ว!");
}

/**
 * ฟังก์ชันช่วยสร้างแท็บและจัดสไตล์หัวข้อตาราง
 */
function createSheetWithHeaders(ss, sheetName, headers, initialRows = []) {
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  } else {
    sheet.clear();
  }

  sheet.appendRow(headers);
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setFontWeight('bold');
  headerRange.setBackground('#2D3142');
  headerRange.setFontColor('#FFFFFF');

  if (initialRows.length > 0) {
    initialRows.forEach(row => sheet.appendRow(row));
  }

  for (let i = 1; i <= headers.length; i++) {
    sheet.setColumnWidth(i, 160);
  }
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.openById(SHEET_ID);
    const action = data.action || 'default';
    
    let sheetName = 'General_Logs';
    if (action === 'inspection') sheetName = 'Inspections';
    else if (action === 'maintenance') sheetName = 'Maintenance';
    else if (action === 'expense') sheetName = 'Expenses';
    else if (action === 'vehicle') sheetName = 'Vehicles';
    else if (action === 'employee') sheetName = 'Employees';

    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
    }

    if (action === 'maintenance') {
      let receiptUrl = '';
      let repairUrl = '';

      if (data.receipt_image && data.receipt_image.indexOf('data:image') === 0) {
        receiptUrl = saveImageToDrive(data.receipt_image, `Receipt_${data.truck || 'truck'}_${Date.now()}.jpg`);
      }

      if (data.repair_image && data.repair_image.indexOf('data:image') === 0) {
        repairUrl = saveImageToDrive(data.repair_image, `Repair_${data.truck || 'truck'}_${Date.now()}.jpg`);
      }

      sheet.appendRow([
        data.timestamp || new Date().toLocaleString('th-TH'),
        data.truck || '',
        data.location || '',
        data.date || '',
        data.odometer || '',
        JSON.stringify(data.items || []),
        data.totalPrice || '0.00',
        receiptUrl,
        repairUrl
      ]);
    } else if (action === 'inspection') {
      sheet.appendRow([
        data.timestamp || new Date().toLocaleString('th-TH'),
        data.date || new Date().toLocaleString('th-TH'),
        data.vehicle || data['insp-vehicle'] || '',
        data.driver || data['insp-driver'] || '',
        data.seatbelt ? 'คาดเข็มขัด' : 'ไม่คาดเข็มขัด',
        data.phone ? 'ใช้โทรศัพท์' : 'ไม่ใช้โทรศัพท์'
      ]);
    } else if (action === 'expense') {
      sheet.appendRow([
        data.timestamp || new Date().toLocaleString('th-TH'),
        data.date || '',
        data.employee || '',
        data.emp_name || '',
        data.exp_type || '',
        data.amount || '',
        data.ref_no || ''
      ]);
    } else if (action === 'excel_import') {
      let excelSheet = ss.getSheetByName('Billing_Excel_Imports');
      if (!excelSheet) {
        excelSheet = ss.insertSheet('Billing_Excel_Imports');
        excelSheet.appendRow(['Timestamp', 'File_Name', 'Date', 'Truck_Reg', 'Driver_Name', 'Zone_Destination', 'Price', 'Status']);
        const headerRange = excelSheet.getRange(1, 1, 1, 8);
        headerRange.setFontWeight('bold');
        headerRange.setBackground('#2D3142');
        headerRange.setFontColor('#FFFFFF');
      }
      if (data.data && Array.isArray(data.data)) {
        data.data.forEach(item => {
          excelSheet.appendRow([
            data.timestamp || new Date().toLocaleString('th-TH'),
            data.fileName || 'Excel_Upload',
            item.date || '',
            item.truck || '',
            item.driver || '',
            item.zone || '',
            item.price || 0,
            item.status || 'รอทำเบิก'
          ]);
        });
      }
    } else {

    return ContentService.createTextOutput(JSON.stringify({ status: 'success', message: 'บันทึกข้อมูลสำเร็จ' }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function saveImageToDrive(base64Data, filename) {
  try {
    const folder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
    const splitData = base64Data.split(',');
    const contentType = splitData[0].match(/:(.*?);/)[1];
    const bytes = Utilities.base64Decode(splitData[1]);
    const blob = Utilities.newBlob(bytes, contentType, filename);
    const file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return file.getUrl();
  } catch (e) {
    Logger.log("Error saving image to Drive: " + e.toString());
    return "Error saving image: " + e.toString();
  }
}

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({ status: 'ok', sheetId: SHEET_ID, folderId: DRIVE_FOLDER_ID }))
    .setMimeType(ContentService.MimeType.JSON);
}
