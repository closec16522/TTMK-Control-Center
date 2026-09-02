/**
 * Google Apps Script for TTMK Control Center Dashboard
 * Google Sheet ID: 19Ve3nx5crTV4JJu05ZPqDI_04pBVOkRLNcf7wxfzC8o
 * Google Drive Folder ID: 1K_N2Wbrjoslm5MMc6jjRa488VgjDuWXf
 * 
 * คำแนะนำการใช้งาน:
 * 1. เปิด Google Sheet ID: 19Ve3nx5crTV4JJu05ZPqDI_04pBVOkRLNcf7wxfzC8o
 * 2. ไปที่เมนู Extensions (ส่วนขยาย) -> Apps Script
 * 3. คัดลอกโค้ดทั้งหมดนี้ไปวางแทนที่ใน Code.gs
 * 4. กดปุ่ม Deploy (ทำให้ใช้งานได้) -> New deployment (การทำให้ใช้งานได้ใหม่)
 * 5. เลือกประเภท: Web App (แอปเว็บ)
 *    - Execute as: Me (ฉัน)
 *    - Who has access: Anyone (ทุกคน)
 * 6. คัดลอก URL Web App ที่ได้ นำไปใส่ในตัวแปร WEB_APP_URL ในไฟล์ control_center_dashboard.html
 */

const SHEET_ID = '19Ve3nx5crTV4JJu05ZPqDI_04pBVOkRLNcf7wxfzC8o';
const DRIVE_FOLDER_ID = '1K_N2Wbrjoslm5MMc6jjRa488VgjDuWXf';

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
      if (action === 'maintenance') {
        sheet.appendRow(['Timestamp', 'Truck', 'Location', 'Date', 'Odometer', 'Items_JSON', 'Total_Price', 'Receipt_Image_URL', 'Repair_Image_URL']);
      } else if (action === 'inspection') {
        sheet.appendRow(['Timestamp', 'Vehicle', 'Driver', 'Seatbelt', 'Phone']);
      } else if (action === 'expense') {
        sheet.appendRow(['Timestamp', 'Date', 'Employee', 'Type', 'Amount', 'Ref_No']);
      } else {
        sheet.appendRow(['Timestamp', 'Action', 'Data_JSON']);
      }
    }

    if (action === 'maintenance') {
      // อัปโหลดรูปภาพไปยัง Google Drive Folder
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
        data.vehicle || data['insp-vehicle'] || '',
        data.driver || data['insp-driver'] || '',
        data.seatbelt || '',
        data.phone || ''
      ]);
    } else if (action === 'expense') {
      sheet.appendRow([
        data.timestamp || new Date().toLocaleString('th-TH'),
        data.date || '',
        data.employee || '',
        data.exp_type || '',
        data.amount || '',
        data.ref_no || ''
      ]);
    } else {
      sheet.appendRow([
        data.timestamp || new Date().toLocaleString('th-TH'),
        action,
        JSON.stringify(data)
      ]);
    }

    return ContentService.createTextOutput(JSON.stringify({ status: 'success', message: 'บันทึกข้อมูลและอัปโหลดรูปภาพลง Drive เรียบร้อยแล้ว' }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * แปลง Base64 และสร้างไฟล์รูปภาพลง Google Drive Folder ID: 1K_N2Wbrjoslm5MMc6jjRa488VgjDuWXf
 */
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
