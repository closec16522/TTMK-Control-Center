/**
 * =========================================================================
 * Google Apps Script - ระบบแจ้งซ่อมและบันทึกข้อมูลการซ่อมบำรุงรถบรรทุก
 * หจก. ทั่วไทยขนส่งมงคล (TTMK Maintenance Management System)
 * =========================================================================
 * 
 * Google Sheet ID : 1JM-i8_nrGR7-VDEY82QZ5l5JMJTIBOIsuqOSQSrcD3Y
 * Target Sheet    : Maintenance_log
 * Google Drive ID : 1YRkTR9dMz0PxKgF60edVF56Ckq909fMF (เก็บรูปภาพ, รายงาน, บิลค่าซ่อม)
 * 
 * ลิขสิทธิ์โดย: Mr.Taweesak.kom (062-3285963)
 */

const CONFIG = {
  SPREADSHEET_ID: "1JM-i8_nrGR7-VDEY82QZ5l5JMJTIBOIsuqOSQSrcD3Y",
  DRIVE_FOLDER_ID: "1YRkTR9dMz0PxKgF60edVF56Ckq909fMF",
  SHEET_NAME: "Maintenance_log",
  DRIVERS_SHEET: "Registered_Drivers"
};

/**
 * จัดการคำขอแบบ HTTP GET
 */
function doGet(e) {
  try {
    const params = e ? e.parameter : {};
    const action = params.action || "list_logs";

    if (action === "list_logs" || action === "get_logs") {
      return getMaintenanceLogs(params);
    }

    if (action === "get_ticket") {
      return getMaintenanceTicket(params.ticketId || params.id);
    }

    if (action === "verify_driver") {
      const email = (params.email || "").trim().toLowerCase();
      return verifyDriver(email);
    }

    if (action === "ping") {
      return responseJSON({
        status: "success",
        message: "TTMK Maintenance API is running",
        timestamp: new Date().toISOString()
      });
    }

    return responseJSON({ status: "error", message: "Unknown GET action: " + action });
  } catch (err) {
    return responseJSON({ status: "error", message: err.toString() });
  }
}

/**
 * จัดการคำขอแบบ HTTP POST (บันทึกแจ้งซ่อม, อัปโหลดรูปภาพและบิล)
 */
function doPost(e) {
  try {
    let payload = null;
    if (e && e.postData && e.postData.contents) {
      payload = JSON.parse(e.postData.contents);
    } else {
      payload = e.parameter;
    }

    if (!payload) {
      return responseJSON({ status: "error", message: "No payload provided" });
    }

    const action = payload.action || "save_maintenance";

    if (action === "save_maintenance" || action === "create_ticket") {
      return saveMaintenanceRecord(payload);
    }

    if (action === "update_status") {
      return updateTicketStatus(payload.ticketId, payload.status, payload.remarks);
    }

    return responseJSON({ status: "error", message: "Unknown POST action: " + action });
  } catch (err) {
    return responseJSON({ status: "error", message: err.toString() });
  }
}

/**
 * ตรวจสอบหรือสร้างแผ่นงาน Maintenance_log อัตโนมัติ พร้อมจัดรูปแบบส่วนหัวตาราง
 */
function getOrCreateMaintenanceSheet(ss) {
  let sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEET_NAME);
    
    // กำหนดหัวคอลัมน์มาตรฐานทั้ง 29 รายการ
    const headers = [
      "Timestamp",             // 1. วันเวลาที่บันทึก
      "Ticket_ID",             // 2. รหัสใบแจ้งซ่อม (MNT-YYYYMMDD-XXXX)
      "Inspection_Date",      // 3. วันที่แจ้งซ่อม / ตรวจพบ
      "Vehicle_Plate",         // 4. ทะเบียนรถ
      "Vehicle_Type",          // 5. ประเภทรถ (ดีเซล 6 ล้อ / EV 6 ล้อ)
      "Odometer",              // 6. เลขไมล์ปัจจุบัน
      "Driver_Name",           // 7. ผู้แจ้งซ่อม / พขร.
      "Driver_Email",          // 8. อีเมลผู้แจ้ง
      "Driver_Phone",          // 9. เบอร์โทรติดต่อ
      "Maintenance_Type",      // 10. ประเภทงานซ่อม (ฉุกเฉิน, PM, สึกหรอ, Defect)
      "Urgency",               // 11. ความเร่งด่วน (ปกติ, ด่วน, ด่วนที่สุด)
      "System_Affected",       // 12. ระบบที่ชำรุด (เบรก, เครื่องยนต์, ยาง, ไฟ ฯลฯ)
      "Symptom_Description",   // 13. รายละเอียดอาการเสีย
      "Garage_Name",           // 14. ชื่ออู่ / ศูนย์บริการ
      "Mechanic_Name",         // 15. ชื่อช่างผู้ซ่อม
      "Garage_Phone",          // 16. เบอร์โทรอู่
      "Items_Count",           // 17. จำนวนรายการอะไหล่/งานซ่อม
      "Items_Detail_JSON",     // 18. รายละเอียดอะไหล่ทั้งหมด (JSON)
      "Items_Summary_Text",    // 19. สรุปรายการอะไหล่แบบข้อความ
      "Parts_Cost",            // 20. ยอดรวมค่าอะไหล่ (บาท)
      "Labor_Cost",            // 21. ยอดรวมค่าแรง (บาท)
      "Vat_Amount",            // 22. ภาษีมูลค่าเพิ่ม (บาท)
      "Total_Cost",            // 23. ยอดสุทธิทั้งสิ้น (บาท)
      "Status",                // 24. สถานะงานซ่อม (รอดำเนินการ, กำลังซ่อม, ซ่อมเสร็จแล้ว, ปิดงาน)
      "Bill_Photo_Url",        // 25. ลิงก์รูปบิลค่าซ่อม / ใบเสร็จ ใน Google Drive
      "Defect_Photo_Url",      // 26. ลิงก์รูปอาการเสีย
      "Parts_Photo_Url",       // 27. ลิงก์รูปอะไหล่ที่เปลี่ยน
      "Finished_Photo_Url",    // 28. ลิงก์รูปหลังซ่อมเสร็จ
      "Remarks"                // 29. หมายเหตุเพิ่มเติม
    ];

    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    
    // ตกแต่งหัวตาราง: พื้นหลังสีกรมท่าเข้ม ตัวอักษรสีขาว หนา ตรึงแถวบนสุด
    const headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setBackground("#0f172a");
    headerRange.setFontColor("#f8fafc");
    headerRange.setFontWeight("bold");
    headerRange.setFontSize(10);
    headerRange.setHorizontalAlignment("center");
    sheet.setFrozenRows(1);
    
    // ตั้งค่าความกว้างคอลัมน์อัตโนมัติเบื้องต้น
    for (let c = 1; c <= headers.length; c++) {
      sheet.setColumnWidth(c, 130);
    }
    sheet.setColumnWidth(2, 160); // Ticket ID
    sheet.setColumnWidth(13, 240); // Symptom
    sheet.setColumnWidth(18, 200); // Items JSON
    sheet.setColumnWidth(19, 250); // Items Summary
  }
  return sheet;
}

/**
 * บันทึกข้อมูลการซ่อมบำรุงและอัปโหลดรูปภาพลง Google Drive
 */
function saveMaintenanceRecord(data) {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const sheet = getOrCreateMaintenanceSheet(ss);

  const now = new Date();
  const timeFormatted = Utilities.formatDate(now, "Asia/Bangkok", "dd/MM/yyyy HH:mm:ss");
  const dateCode = Utilities.formatDate(now, "Asia/Bangkok", "yyyyMMdd");

  // สร้าง Ticket ID อัตโนมัติ (เช่น MNT-20261013-001)
  const lastRow = sheet.getLastRow();
  const seq = String(Math.max(1, lastRow)).padStart(3, '0');
  const ticketId = data.ticketId || `MNT-${dateCode}-${seq}`;

  // เตรียมโฟลเดอร์ Google Drive
  let folder = null;
  try {
    folder = DriveApp.getFolderById(CONFIG.DRIVE_FOLDER_ID);
  } catch (fe) {
    console.warn("Could not open target folder, creating or using fallback:", fe);
    folder = DriveApp.getRootFolder();
  }

  // อัปโหลดรูปภาพประกอบและบิลค่าซ่อม (Base64 -> Drive File)
  const images = data.images || {};
  let billUrl = data.billUrl || "";
  let defectUrl = data.defectUrl || "";
  let partsUrl = data.partsUrl || "";
  let finishedUrl = data.finishedUrl || "";

  function saveBase64Image(base64Data, prefix) {
    if (!base64Data || !base64Data.includes("base64,")) return "";
    try {
      const parts = base64Data.split("base64,");
      const mimeMatch = parts[0].match(/:(.*?);/);
      const mimeType = mimeMatch ? mimeMatch[1] : "image/jpeg";
      const decodedBytes = Utilities.base64Decode(parts[1]);
      const blob = Utilities.newBlob(decodedBytes, mimeType, `${prefix}_${ticketId}_${dateCode}.jpg`);
      const file = folder.createFile(blob);
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      return file.getUrl();
    } catch (err) {
      console.warn("Error uploading image " + prefix + ":", err);
      return "";
    }
  }

  if (images.billPhoto) billUrl = saveBase64Image(images.billPhoto, "BILL");
  if (images.defectPhoto) defectUrl = saveBase64Image(images.defectPhoto, "DEFECT");
  if (images.partsPhoto) partsUrl = saveBase64Image(images.partsPhoto, "PARTS");
  if (images.finishedPhoto) finishedUrl = saveBase64Image(images.finishedPhoto, "FINISHED");

  // ประมวลผลรายการอะไหล่หลายรายการ
  const items = Array.isArray(data.items) ? data.items : [];
  const itemsCount = items.length;
  const itemsDetailJSON = JSON.stringify(items);
  
  // สร้างข้อความสรุปรายการอะไหล่แบบอ่านง่าย
  let itemsSummary = "";
  if (items.length > 0) {
    itemsSummary = items.map((it, idx) => {
      const name = it.name || it.item || "อะไหล่";
      const qty = it.qty || 1;
      const unit = it.unit || "ชิ้น";
      const total = Number(it.total || (qty * (it.unitPrice || 0))).toLocaleString();
      return `${idx + 1}. ${name} (${qty} ${unit}) ${total}บ.`;
    }).join("\n");
  } else {
    itemsSummary = data.symptom || "ไม่มีรายการอะไหล่ระบุ";
  }

  const partsCost = Number(data.partsCost || 0);
  const laborCost = Number(data.laborCost || 0);
  const vatAmount = Number(data.vatAmount || 0);
  const totalCost = Number(data.totalCost || (partsCost + laborCost + vatAmount));

  // แถวข้อมูลพร้อมบันทึก
  const rowData = [
    timeFormatted,                             // 1. Timestamp
    ticketId,                                  // 2. Ticket_ID
    data.inspectionDate || data.date || Utilities.formatDate(now, "Asia/Bangkok", "dd/MM/yyyy"), // 3. Inspection_Date
    data.vehiclePlate || "-",                  // 4. Vehicle_Plate
    data.vehicleType || "รถบรรทุก 6 ล้อ",       // 5. Vehicle_Type
    data.odometer || "-",                      // 6. Odometer
    data.driverName || "-",                    // 7. Driver_Name
    data.driverEmail || "-",                   // 8. Driver_Email
    data.driverPhone || "-",                   // 9. Driver_Phone
    data.maintenanceType || "ซ่อมทั่วไป",      // 10. Maintenance_Type
    data.urgency || "ปกติ",                    // 11. Urgency
    data.systemAffected || "ทั่วไป",           // 12. System_Affected
    data.symptom || data.symptomDescription || "-", // 13. Symptom_Description
    data.garageName || "ศูนย์บริการทั่วไป",    // 14. Garage_Name
    data.mechanicName || "-",                  // 15. Mechanic_Name
    data.garagePhone || "-",                   // 16. Garage_Phone
    itemsCount,                                // 17. Items_Count
    itemsDetailJSON,                           // 18. Items_Detail_JSON
    itemsSummary,                              // 19. Items_Summary_Text
    partsCost,                                 // 20. Parts_Cost
    laborCost,                                 // 21. Labor_Cost
    vatAmount,                                 // 22. Vat_Amount
    totalCost,                                 // 23. Total_Cost
    data.status || "ซ่อมเสร็จแล้ว",             // 24. Status
    billUrl,                                   // 25. Bill_Photo_Url
    defectUrl,                                 // 26. Defect_Photo_Url
    partsUrl,                                  // 27. Parts_Photo_Url
    finishedUrl,                               // 28. Finished_Photo_Url
    data.remarks || ""                         // 29. Remarks
  ];

  sheet.appendRow(rowData);
  const newRow = sheet.getLastRow();

  return responseJSON({
    status: "success",
    message: "บันทึกข้อมูลการซ่อมบำรุงเรียบร้อยแล้ว",
    ticketId: ticketId,
    row: newRow,
    driveFolderUrl: `https://drive.google.com/drive/folders/${CONFIG.DRIVE_FOLDER_ID}`,
    sheetUrl: `https://docs.google.com/spreadsheets/d/${CONFIG.SPREADSHEET_ID}/edit#gid=${sheet.getSheetId()}`,
    billUrl: billUrl,
    defectUrl: defectUrl,
    partsUrl: partsUrl,
    finishedUrl: finishedUrl,
    totalCost: totalCost,
    itemsCount: itemsCount
  });
}

/**
 * ดึงรายการประวัติการซ่อมบำรุงจาก Sheet Maintenance_log
 */
function getMaintenanceLogs(params) {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  
  if (!sheet) {
    return responseJSON({ status: "success", total: 0, logs: [] });
  }

  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) {
    return responseJSON({ status: "success", total: 0, logs: [] });
  }

  const lastCol = sheet.getLastColumn();
  const rows = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

  let logs = rows.map((r, idx) => {
    let rawItems = [];
    try {
      if (r[17] && typeof r[17] === "string" && r[17].startsWith("[")) {
        rawItems = JSON.parse(r[17]);
      }
    } catch (e) {}

    return {
      row: idx + 2,
      timestamp: String(r[0] || ""),
      ticketId: String(r[1] || ""),
      date: String(r[2] || ""),
      vehiclePlate: String(r[3] || ""),
      vehicleType: String(r[4] || ""),
      odometer: String(r[5] || ""),
      driverName: String(r[6] || ""),
      driverEmail: String(r[7] || ""),
      driverPhone: String(r[8] || ""),
      maintenanceType: String(r[9] || ""),
      urgency: String(r[10] || ""),
      systemAffected: String(r[11] || ""),
      symptom: String(r[12] || ""),
      garageName: String(r[13] || ""),
      mechanicName: String(r[14] || ""),
      garagePhone: String(r[15] || ""),
      itemsCount: Number(r[16] || 0),
      items: rawItems,
      itemsSummary: String(r[18] || ""),
      partsCost: Number(r[19] || 0),
      laborCost: Number(r[20] || 0),
      vatAmount: Number(r[21] || 0),
      totalCost: Number(r[22] || 0),
      status: String(r[23] || "ซ่อมเสร็จแล้ว"),
      billUrl: String(r[24] || ""),
      defectUrl: String(r[25] || ""),
      partsUrl: String(r[26] || ""),
      finishedUrl: String(r[27] || ""),
      remarks: String(r[28] || "")
    };
  });

  // กรองตามทะเบียนรถ (ถ้ามีระบุ)
  if (params && params.plate) {
    const cleanPlate = params.plate.trim();
    logs = logs.filter(l => l.vehiclePlate.includes(cleanPlate));
  }

  // เรียงลำดับจากล่าสุดไปเก่าสุด
  logs.reverse();

  return responseJSON({
    status: "success",
    total: logs.length,
    logs: logs
  });
}

/**
 * ดึงข้อมูลงานซ่อมตามรหัส Ticket ID
 */
function getMaintenanceTicket(ticketId) {
  if (!ticketId) return responseJSON({ status: "error", message: "Missing ticketId" });
  const allLogs = getMaintenanceLogs({});
  const found = (allLogs.logs || []).find(l => l.ticketId === ticketId);
  if (!found) return responseJSON({ status: "error", message: "Ticket not found" });
  return responseJSON({ status: "success", ticket: found });
}

/**
 * ตรวจสอบพนักงานขับรถจากชีต Registered_Drivers
 */
function verifyDriver(email) {
  if (!email) return responseJSON({ status: "error", message: "Missing email" });
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName(CONFIG.DRIVERS_SHEET);
    if (!sheet) return responseJSON({ status: "error", message: "Drivers sheet not found" });
    const rows = sheet.getDataRange().getValues();
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      const rEmail = String(r[3] || "").trim().toLowerCase();
      if (rEmail === email) {
        return responseJSON({
          status: "success",
          driver: {
            driverId: r[0],
            driverName: r[1],
            phone: r[2],
            email: rEmail,
            plate: r[4] || "",
            status: r[5] || "ACTIVE"
          }
        });
      }
    }
    return responseJSON({ status: "not_found", message: "Driver not registered" });
  } catch (err) {
    return responseJSON({ status: "error", message: err.toString() });
  }
}

/**
 * Helper ส่งข้อมูลกลับเป็น JSON พร้อม CORS Headers
 */
function responseJSON(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
