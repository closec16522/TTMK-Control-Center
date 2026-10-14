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
  DRIVE_FOLDER_ID: "1lM3KyJTSNvQlHWzbCVLS8QLlfQTfgpi0",
  DRIVE_FOLDERS: {
    ROOT: "1lM3KyJTSNvQlHWzbCVLS8QLlfQTfgpi0",
    ROUTE_PLANS_PDF: "1oaFFK-Xt35bnKUiLBJ3eJXeG12Npvnui",
    REST_STOP_EVIDENCE: "1V54IZ4H7w_rx0la5jFnfCxaoJICBmNfx",
    ALCOHOL_EVIDENCE: "1bCPdf6So1ZRz60L_zPFNQo_nEKLleqbS"
  },
  SHEET_NAME: "Maintenance_log",
  DRIVERS_SHEET: "Registered_Drivers",
  ROUTE_PLANS_SHEET: "Route_Plans"
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

    if (action === "setup" || action === "create_sheet" || action === "init_sheet") {
      const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
      const sheet = getOrCreateMaintenanceSheet(ss);
      return responseJSON({
        status: "success",
        message: "สร้างแผ่นงาน Maintenance_log เรียบร้อยแล้ว พร้อมหัวตารางทั้ง 29 รายการ",
        sheetName: sheet.getName()
      });
    }

    if (action === "create_fleet_sheet" || action === "setup_fleet") {
      const msg = createFleetVehiclesSheetNow();
      return responseJSON({ status: "success", message: msg });
    }

    if (action === "init_route_plans" || action === "setup_routes" || action === "init_routes") {
      const msg = initRoutePlansDataNow();
      return responseJSON({ status: "success", message: msg });
    }

    if (action === "list_route_plans" || action === "get_routes") {
      return responseJSON(getRoutePlansFromSheet());
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
 * ฟังก์ชันสำหรับกด "เรียกใช้ (Run)" บน Google Apps Script เพื่อสร้างแผ่นงาน Maintenance_log ทันที 1 คลิก
 */
function createMaintenanceSheetNow() {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const sheet = getOrCreateMaintenanceSheet(ss);
  Logger.log("✅ สร้างแผ่นงาน " + sheet.getName() + " สำเร็จแล้ว!");
  return "✅ สร้างแผ่นงาน Maintenance_log เรียบร้อยแล้ว พร้อมหัวตารางทั้ง 29 คอลัมน์!";
}

/**
 * ฟังก์ชันสร้างแผ่นงาน Fleet_Vehicles ใน Google Sheet เพื่อบันทึกข้อมูลรถบรรทุก 6 ล้อ TTMK Fleet Master
 */
function createFleetVehiclesSheetNow() {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  let sheet = ss.getSheetByName("Fleet_Vehicles");
  if (!sheet) {
    sheet = ss.insertSheet("Fleet_Vehicles");
  }

  const headers = [
    "Fleet_ID", "Vehicle_Plate", "Province", "Brand", "Body_Type",
    "Fuel_Type", "Engine_Spec", "Assigned_Driver", "Odometer", "Status",
    "GPS_Location", "Last_Updated"
  ];

  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setBackground("#1e3a8a");
  headerRange.setFontColor("#f8fafc");
  headerRange.setFontWeight("bold");
  headerRange.setHorizontalAlignment("center");
  sheet.setFrozenRows(1);

  // ข้อมูลกองรถเริ่มต้น 18 คัน (4 EV 100% / 14 ดีเซล Euro 5)
  const initialFleet = [
    ["TTMK-EV-01", "73-1735", "สระบุรี", "BYD T8", "รถบรรทุก 6 ล้อตู้ทึบ EV", "EV", "Electric Motor 180kW (CATL 255kWh)", "พิศมัย พลเยี่ยม", 48250, "พร้อมใช้งาน", "14.5835, 100.9737", "2026-10-13"],
    ["TTMK-EV-02", "72-8297", "สระบุรี", "BYD T8", "รถบรรทุก 6 ล้อคอกผ้าใบ EV", "EV", "Electric Motor 180kW (CATL 255kWh)", "วิทวัส สอนพรม", 52100, "กำลังวิ่งงาน", "13.6925, 99.9284", "2026-10-13"],
    ["TTMK-EV-03", "72-5079", "สระบุรี", "NEX Point", "รถบรรทุก 6 ล้อตู้แห้ง EV", "EV", "Electric Motor 160kW (BYD Blade 220kWh)", "ทรงวุฒิ ฉวีรัมย์", 39180, "พร้อมใช้งาน", "13.7202, 99.8940", "2026-10-13"],
    ["TTMK-EV-04", "61-5463", "กทม.", "NEX Point", "รถบรรทุก 6 ล้อตู้ทึบ EV", "EV", "Electric Motor 160kW (BYD Blade 220kWh)", "วิวัฒน์ อุ่นสว่าง", 28400, "พร้อมใช้งาน", "13.7563, 100.5018", "2026-10-13"],
    ["TTMK-DSL-01", "70-8899", "กทม.", "ISUZU Forward", "รถบรรทุก 6 ล้อตู้ทึบ", "Diesel", "ISUZU 4HK1-TCS 210PS Euro 5", "ทวีศักดิ์ คำปก", 168400, "พร้อมใช้งาน", "13.7563, 100.5018", "2026-10-13"],
    ["TTMK-DSL-02", "70-9312", "กทม.", "HINO 500", "รถบรรทุก 6 ล้อคอก", "Diesel", "HINO J08E-WD 240PS Euro 5", "อรรถพล ยอดสิงห์", 142100, "กำลังวิ่งงาน", "13.6526, 100.2738", "2026-10-13"],
    ["TTMK-DSL-03", "72-1979", "สระบุรี", "ISUZU Forward", "รถบรรทุก 6 ล้อตู้ทึบ", "Diesel", "ISUZU FTR 240PS Euro 5", "ดุรงค์ฤทธิ์ สำเลิศ", 155300, "พร้อมใช้งาน", "13.5501, 100.3359", "2026-10-13"],
    ["TTMK-DSL-04", "72-8139", "สระบุรี", "ISUZU Forward", "รถบรรทุก 6 ล้อตู้แห้ง", "Diesel", "ISUZU FTR 240PS Euro 5", "สมร มหาพันธ์", 139800, "พร้อมใช้งาน", "13.6688, 100.0854", "2026-10-13"],
    ["TTMK-DSL-05", "8กส1201", "กทม.", "HINO FC9J", "รถบรรทุก 6 ล้อตู้ทึบ", "Diesel", "HINO FC9J 210PS", "นิชานันท์ เอื้อจิรพรชัย", 112500, "พร้อมใช้งาน", "13.6900, 100.7501", "2026-10-13"],
    ["TTMK-DSL-06", "70-5544", "กทม.", "ISUZU Forward", "รถบรรทุก 6 ล้อตู้ทึบ", "Diesel", "ISUZU FTR 240PS", "สมชาย วงศ์สวัสดิ์", 178200, "กำลังวิ่งงาน", "15.6987, 100.1220", "2026-10-13"],
    ["TTMK-DSL-07", "72-3199", "สระบุรี", "HINO Victor", "รถบรรทุก 6 ล้อคอก", "Diesel", "HINO Victor 240PS", "สุรชัย หงษา", 145000, "พร้อมใช้งาน", "13.0827, 100.8800", "2026-10-13"],
    ["TTMK-DSL-08", "71-6543", "อยุธยา", "ISUZU Forward", "รถบรรทุก 6 ล้อตู้ทึบ", "Diesel", "ISUZU FTR 240PS", "ธนวัฒน์ ใจดี", 124300, "พร้อมใช้งาน", "14.3532, 100.5684", "2026-10-13"],
    ["TTMK-DSL-09", "73-2415", "สระบุรี", "ISUZU Forward", "รถบรรทุก 6 ล้อตู้ทึบ", "Diesel", "ISUZU FTR 240PS", "ธีระพงษ์ ศรีสุข", 161200, "ซ่อมบำรุง", "14.5289, 100.9101", "2026-10-13"],
    ["TTMK-DSL-10", "71-9820", "กทม.", "HINO FC9J", "รถบรรทุก 6 ล้อคอก", "Diesel", "HINO FC9J 210PS", "อนันต์ บุญรอด", 133900, "พร้อมใช้งาน", "13.7563, 100.5018", "2026-10-13"],
    ["TTMK-DSL-11", "72-4411", "นครปฐม", "ISUZU Forward", "รถบรรทุก 6 ล้อตู้แห้ง", "Diesel", "ISUZU 4HK1-TCS 210PS", "ประเสริฐ สุขสวัสดิ์", 149000, "พร้อมใช้งาน", "13.8199, 100.0443", "2026-10-13"],
    ["TTMK-DSL-12", "73-9081", "สระบุรี", "ISUZU Forward", "รถบรรทุก 6 ล้อตู้ทึบ", "Diesel", "ISUZU FTR 240PS", "มานะ ชนะศึก", 182300, "กำลังวิ่งงาน", "14.5835, 100.9737", "2026-10-13"],
    ["TTMK-DSL-13", "70-1122", "กทม.", "HINO 500", "รถบรรทุก 6 ล้อตู้ทึบ", "Diesel", "HINO 500 Dominator 210PS", "กิตติศักดิ์ เจริญดี", 98400, "พร้อมใช้งาน", "13.6526, 100.2738", "2026-10-13"],
    ["TTMK-DSL-14", "72-9901", "ฉะเชิงเทรา", "ISUZU Forward", "รถบรรทุก 6 ล้อคอก", "Diesel", "ISUZU FTR 240PS", "วิเชียร สมบูรณ์", 154200, "ซ่อมบำรุง", "13.6904, 101.0779", "2026-10-13"]
  ];

  if (sheet.getLastRow() <= 1) {
    sheet.getRange(2, 1, initialFleet.length, headers.length).setValues(initialFleet);
  }

  for (let c = 1; c <= headers.length; c++) sheet.setColumnWidth(c, 130);
  sheet.setColumnWidth(4, 160);
  sheet.setColumnWidth(5, 180);
  sheet.setColumnWidth(7, 240);

  Logger.log("✅ สร้างแผ่นงาน Fleet_Vehicles เรียบร้อยแล้ว!");
  return "✅ สร้างแผ่นงาน Fleet_Vehicles เรียบร้อยแล้ว พร้อมข้อมูลรถ 18 คัน!";
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


/**
 * =========================================================================
 * ฟังก์ชันนำเข้าข้อมูลแผนการเดินรถ 9 เส้นทางลงในแผ่นงาน Route_Plans อัตโนมัติ
 * หจก. ทั่วไทยขนส่งมงคล (TTMK Route Planning & Safety)
 * 
 * วิธีใช้งาน:
 * 1. วางโค้ดนี้ลงใน Google Apps Script (Code.gs)
 * 2. เลือกฟังก์ชัน "initRoutePlansDataNow" จากเมนูด้านบน
 * 3. กดปุ่ม "เรียกใช้ (Run)" -> ข้อมูลทั้ง 9 เส้นทางจะเข้า Google Sheet ทันที!
 * =========================================================================
 */
function initRoutePlansDataNow() {
  const SPREADSHEET_ID = "1JM-i8_nrGR7-VDEY82QZ5l5JMJTIBOIsuqOSQSrcD3Y";
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName("Route_Plans");
  if (!sheet) {
    sheet = ss.insertSheet("Route_Plans");
  }

  const headers = [
    "Route_ID", "Route_Name", "Feed", "Customer", "Total_Distance_KM",
    "Total_Time_Hours", "Rest_Stops_Count", "Speed_Limit", "Waypoints_JSON",
    "Google_Maps_URL", "Reviewer", "Review_Date"
  ];

  // ตรวจสอบและตั้งค่าหัวตาราง
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setBackground("#1e3a8a").setFontColor("#ffffff").setFontWeight("bold").setHorizontalAlignment("center");
  sheet.setFrozenRows(1);

  // ข้อมูลแผนการเดินรถครบทั้ง 9 เส้นทาง (ดึงจากระบบ TTMK Saraburi My Maps)
  const routeRows = [
    ["ROUTE-001", "ราชบุรี (TCSB/TCRB) – บจก.กลุ่มสยามบรรจุภัณฑ์ โรงงานชลบุรี", "FEED_01", "บจก. กลุ่มสยามบรรจุภัณฑ์ จำกัด (โรงงานชลบุรี)", 358, "6 - 8 ชม.", 4, 80, "[{\"order\": 0, \"type\": \"origin\", \"name\": \"โรงงานสยามบรรจุภัณฑ์ (TCSB) ราชบุรี\", \"lat\": 14.5582, \"lng\": 99.8166, \"road\": \"ทล.4 (เพชรเกษม)\", \"distanceKm\": 0, \"recommendation\": \"จุดเริ่มต้น: ตรวจเช็คเอกสารใบกำกับสินค้า ตรวจความพร้อมพนักงานขับรถ (วัดแอลกอฮอล์/ความดัน) และตรวจสภาพรถ F-CAM-032 ก่อนออกเดินทาง\", \"hazard\": \"ระวังรถเข้า-ออกบริเวณปากทางเข้าโรงงาน ใช้ความเร็วไม่เกิน 20 กม./ชม. ในพื้นที่โรงงาน\", \"photoUrl\": \"assets/route_photos/scg_packaging_factory_hd.jpg\"}, {\"order\": 1, \"type\": \"rest\", \"name\": \"ปั๊มเอสโซ่ อาร์.เอส.ออยล์ นครปฐม\", \"lat\": 13.8213, \"lng\": 100.0433, \"road\": \"ถนนเพชรเกษม (ถนนหมายเลข 4 กม.56)\", \"distanceKm\": 56, \"recommendation\": \"เติมน้ำมันและพักผ่อน 15-30 นาที ตรวจเช็คความตึงสายรัดสินค้า และตรวจเช็คลมยาง\", \"hazard\": \"อาจมีรถหนาแน่นช่วงเวลาสูงสุด ระวังรถจักรยานยนต์และจุดกลับรถ\", \"photoUrl\": \"assets/route_photos/esso_station_hd.jpg\"}, {\"order\": 2, \"type\": \"rest\", \"name\": \"ปั๊มน้ำมันบางจาก - บจก. สินปิ่นเกล้า\", \"lat\": 13.7861, \"lng\": 100.35, \"road\": \"ถนนบรมราชชนนี กม.92\", \"distanceKm\": 92, \"recommendation\": \"เติมน้ำมันและพักผ่อน ดื่มน้ำ พักสายตา ตรวจเช็คระบบไฟส่องสว่างท้ายรถ\", \"hazard\": \"ถนนบรมราชชนนีอาจมีการจราจรหนาแน่น ห้ามใช้ความเร็วเกิน 60 กม./ชม. ในช่องทางคู่ขนาน\", \"photoUrl\": \"assets/route_photos/bangchak_station_hd.jpg\"}, {\"order\": 3, \"type\": \"rest\", \"name\": \"Shell ออยล์นววงศ์ A บางนา\", \"lat\": 13.5988, \"lng\": 100.6503, \"road\": \"ถนนบางนา-ตราด กม.82 (ทล.34 กม.22)\", \"distanceKm\": 82, \"recommendation\": \"เติมน้ำมันและพักผ่อน ตรวจสอบความร้อนของดุมล้อและระบบเบรก พักสายตาไม่น้อยกว่า 20 นาที\", \"hazard\": \"อาจมีการจราจรหนาแน่นช่วงเวลาเร่งด่วน ระวังจุดกลับรถและทางขึ้นสะพานยกระดับ\", \"photoUrl\": \"assets/route_photos/shell_station_hd.jpg\"}, {\"order\": 4, \"type\": \"rest\", \"name\": \"PTT Station ปตท.จิฟฟี่ ฉะเชิงเทรา-บางนา ตราด (กม.49)\", \"lat\": 13.7452, \"lng\": 101.0058, \"road\": \"ถนนบางนา-ตราด (กม.49 ขาออก)\", \"distanceKm\": 48, \"recommendation\": \"เติมน้ำมันและพักผ่อน (จุดพักสุดท้ายก่อนถึงปลายทาง) ปั๊มขนาดใหญ่ มีลานจอดรถบรรทุกกว้างขวาง ตรวจเช็คความเรียบร้อยสินค้า\", \"hazard\": \"อาจมีการจราจรหนาแน่นช่วงเวลาเร่งด่วน ระวังลมพัดขวางบนสะพานข้ามแม่น้ำบางปะกง\", \"photoUrl\": \"assets/route_photos/ptt_station_hd.jpg\"}, {\"order\": 5, \"type\": \"destination\", \"name\": \"บจก.กลุ่มสยามบรรจุภัณฑ์ โรงงานชลบุรี\", \"lat\": 13.3648, \"lng\": 100.9866, \"road\": \"ถนนสุขุมวิท\", \"distanceKm\": 80, \"recommendation\": \"ถึงจุดหมายปลายทาง: ดับเครื่องยนต์ ดึงเบรกมือ สวมใส่อุปกรณ์ PPE (หมวก, เสื้อสะท้อนแสง, รองเท้าเซฟตี้) ครบชุดก่อนลงจากรถ และส่งมอบเอกสารใบส่งของ (POD)\", \"hazard\": \"ตรวจสอบสภาพถนนและสภาพการจราจร ระวังรถบรรทุกตู้คอนเทนเนอร์เข้า-ออกนิคมอุตสาหกรรม\", \"photoUrl\": \"assets/route_photos/scg_packaging_factory_hd.jpg\"}]", "https://www.google.com/maps/dir/?api=1&origin=14.5582,99.8166&destination=13.3648,100.9866&waypoints=13.8213,100.0433|13.7861,100.35|13.5988,100.6503|13.7452,101.0058&travelmode=driving", "Nichanan Aj. (SCGJWD Logistics)", "17.09.2567"],
    ["ROUTE-SOUTH-DOWN", "สระบุรี (TCSB) – โรงงานผลิตภัณฑ์ปลากระป๋องสยาม จ.สตูล (ขาล่อง)", "FEED_SOUTH", "โรงงานผลิตภัณฑ์ปลากระป๋องสยาม จ.สตูล", 1100, "15 - 18 ชม.", 4, 80, "[{\"order\": 0, \"type\": \"origin\", \"name\": \"โรงงานสยามบรรจุภัณฑ์ (TCSB) สระบุรี\", \"lat\": 14.583968, \"lng\": 100.973825, \"road\": \"ทล.1 พหลโยธิน\", \"distanceKm\": 0, \"recommendation\": \"จุดเริ่มต้น: ตรวจเช็คเอกสารใบกำกับสินค้า ตรวจความพร้อมพนักงานขับรถ (วัดแอลกอฮอล์/ความดัน) และตรวจสภาพรถ F-CAM-032 ก่อนออกเดินทางระยะไกล\", \"hazard\": \"ระวังรถหนาแน่นช่วงต่างระดับสระบุรีและถนนวงแหวนกาญจนาภิเษก\", \"photoUrl\": \"assets/route_photos/scg_packaging_factory_hd.jpg\"}, {\"order\": 1, \"type\": \"rest\", \"name\": \"ปั๊ม PT ถ.พระราม 2 ขาออก กม.55 (จ.สมุทรสงคราม)\", \"lat\": 13.3855, \"lng\": 99.988, \"road\": \"ถ.พระราม 2 ขาออก กม.55\", \"distanceKm\": 194, \"recommendation\": \"จุดพักรถที่ 1: เติมน้ำมัน ตรวจเช็คความตึงของสายรัดสินค้า พักสายตา 30 นาที ดื่มน้ำ ล้างหน้า\", \"hazard\": \"การจราจรถนนพระราม 2 หนาแน่น ระวังแนวก่อสร้างทางยกระดับ\", \"photoUrl\": \"assets/route_photos/pt_station_hd.jpg\"}, {\"order\": 2, \"type\": \"rest\", \"name\": \"ESSO เขาน้อย (จ.ประจวบคีรีขันธ์)\", \"lat\": 12.404338, \"lng\": 99.923664, \"road\": \"ทล.4 เพชรเกษม\", \"distanceKm\": 146, \"recommendation\": \"จุดพักรถที่ 2: ตรวจเช็คอุณหภูมิดุมล้อและลมยาง พักรับประทานอาหาร\", \"hazard\": \"ทางโค้งและจุดกลับรถช่วงเขาน้อย ใช้ความเร็วไม่เกิน 80 กม./ชม.\", \"photoUrl\": \"assets/route_photos/esso_station_hd.jpg\"}, {\"order\": 3, \"type\": \"rest\", \"name\": \"PTT ทุ่งคา (จ.ชุมพร)\", \"lat\": 10.422068, \"lng\": 99.130395, \"road\": \"ทล.41 ขาล่อง\", \"distanceKm\": 260, \"recommendation\": \"จุดพักรถที่ 3: พักผ่อน 30 นาที สลับพนักงานขับรถหรือพักสายตา ตรวจระบบไฟสัญญาณ\", \"hazard\": \"ทางตรงยาวช่วงชุมพร เสี่ยงต่ออาการหลับใน แนะนำให้หยุดพักล้างหน้า\", \"photoUrl\": \"assets/route_photos/ptt_station_hd.jpg\"}, {\"order\": 4, \"type\": \"rest\", \"name\": \"PTT ปากแพรก อ.ทุ่งสง (จ.นครศรีธรรมราช)\", \"lat\": 8.155067, \"lng\": 99.696312, \"road\": \"ทล.41 เชื่อม ทล.403\", \"distanceKm\": 290, \"recommendation\": \"จุดพักรถที่ 4 (จุดพักสุดท้ายก่อนเข้าสตูล): ตรวจเช็คความเรียบร้อยรอบคัน เติมน้ำมันให้พร้อม\", \"hazard\": \"ทางแยกสัญญาณไฟทุ่งสง และเส้นทางขึ้น-ลงเขาเขตพัทลุง-ตรัง\", \"photoUrl\": \"assets/route_photos/ptt_station_hd.jpg\"}, {\"order\": 5, \"type\": \"destination\", \"name\": \"โรงงานผลิตภัณฑ์ปลากระป๋องสยาม จ.สตูล\", \"lat\": 6.658056, \"lng\": 100.076994, \"road\": \"ทล.406 สตูล\", \"distanceKm\": 210, \"recommendation\": \"ถึงจุดหมายปลายทาง: ติดต่อป้อม รปภ. ดับเครื่อง ดึงเบรกมือ สวมอุปกรณ์ PPE ครบชุดก่อนลงจากรถ และส่งมอบเอกสารใบส่งของ (POD)\", \"hazard\": \"ถนนสายรอง 2 เลนสวน ระวังรถจักรยานยนต์และรถเกษตรกรในพื้นที่\", \"photoUrl\": \"assets/route_photos/siam_canned_fish_hd.jpg\"}]", "https://www.google.com/maps/dir/?api=1&origin=14.583968,100.973825&destination=6.658056,100.076994&waypoints=13.3855,99.988|12.404338,99.923664|10.422068,99.130395|8.155067,99.696312&travelmode=driving", "Nichanan Aj. (SCGJWD Logistics)", "17.09.2567"],
    ["ROUTE-SOUTH-UP", "โรงงานผลิตภัณฑ์ปลากระป๋องสยาม จ.สตูล – สระบุรี (TCSB) (ขาขึ้น)", "FEED_SOUTH", "โรงงานสยามบรรจุภัณฑ์ (TCSB) สระบุรี", 1100, "15 - 18 ชม.", 4, 80, "[{\"order\": 0, \"type\": \"origin\", \"name\": \"โรงงานผลิตภัณฑ์ปลากระป๋องสยาม จ.สตูล\", \"lat\": 6.658056, \"lng\": 100.076994, \"road\": \"ทล.406 สตูล\", \"distanceKm\": 0, \"recommendation\": \"จุดเริ่มต้นขาขึ้น: ตรวจเช็คเอกสารขากลับ ตรวจความพร้อมพนักงานขับรถ และตรวจสภาพรถ F-CAM-032 ก่อนออกเดินทาง\", \"hazard\": \"ระวังทางโค้งและทางแยกร่วมก่อนเข้าทางหลวงสายหลัก\", \"photoUrl\": \"assets/route_photos/siam_canned_fish_hd.jpg\"}, {\"order\": 1, \"type\": \"rest\", \"name\": \"PTT ทุ่งสง ขาขึ้น (ติดแม็คโคร) จ.นครศรีธรรมราช\", \"lat\": 8.157909, \"lng\": 99.666395, \"road\": \"ทล.41 ขาขึ้น\", \"distanceKm\": 215, \"recommendation\": \"จุดพักรถที่ 1: ตรวจเช็คสภาพยางและระบบเบรก พักสายตา 30 นาที ดื่มน้ำ\", \"hazard\": \"ทางแยกร่วมบายพาสทุ่งสง มีรถบรรทุกหนาแน่น\", \"photoUrl\": \"assets/route_photos/ptt_station_hd.jpg\"}, {\"order\": 2, \"type\": \"rest\", \"name\": \"PT หลังสวน ขาขึ้น (ติด HOMEMART) จ.ชุมพร\", \"lat\": 9.943424, \"lng\": 99.061969, \"road\": \"ทล.41 ขาขึ้น\", \"distanceKm\": 230, \"recommendation\": \"จุดพักรถที่ 2: พักรับประทานอาหาร เติมน้ำมัน ตรวจเช็คสายรัด\", \"hazard\": \"ทางตรงยาว เสี่ยงต่ออาการหลับใน รักษาความเร็วไม่เกิน 80 กม./ชม.\", \"photoUrl\": \"assets/route_photos/pt_station_hd.jpg\"}, {\"order\": 3, \"type\": \"rest\", \"name\": \"PT ประจวบฯ ขาขึ้น (ก่อนถึงด่านสิงขร) จ.ประจวบคีรีขันธ์\", \"lat\": 11.741378, \"lng\": 99.748831, \"road\": \"ทล.4 เพชรเกษม ขาขึ้น\", \"distanceKm\": 235, \"recommendation\": \"จุดพักรถที่ 3: ตรวจสอบความร้อนของดุมล้อและระบบเบรก พักสายตา 30 นาที\", \"hazard\": \"ระวังจุดตรวจและด่านตรวจความเร็วทางหลวง\", \"photoUrl\": \"assets/route_photos/pt_station_hd.jpg\"}, {\"order\": 4, \"type\": \"rest\", \"name\": \"บางจาก ถ.พระราม 2 ขาเข้า กม.77 (จ.สมุทรสงคราม)\", \"lat\": 13.348472, \"lng\": 99.893725, \"road\": \"ถ.พระราม 2 ขาเข้า กม.77\", \"distanceKm\": 205, \"recommendation\": \"จุดพักรถที่ 4 (จุดพักสุดท้ายก่อนถึงสระบุรี): ตรวจสอบความพร้อมก่อนเข้าเขตกรุงเทพฯ/ปริมณฑล\", \"hazard\": \"ปริมาณรถหนาแน่นช่วงเข้าเขตพระราม 2 ระวังแนวก่อสร้าง\", \"photoUrl\": \"assets/route_photos/bangchak_station_hd.jpg\"}, {\"order\": 5, \"type\": \"destination\", \"name\": \"โรงงานสยามบรรจุภัณฑ์ (TCSB) สระบุรี\", \"lat\": 14.583968, \"lng\": 100.973825, \"road\": \"ทล.1 พหลโยธิน\", \"distanceKm\": 215, \"recommendation\": \"ถึงจุดหมายปลายทาง: คืนตู้/ลงสินค้า ส่งมอบเอกสาร รายงานสถานะจบเที่ยววิ่ง\", \"hazard\": \"ระวังรถเข้า-ออกบริเวณปากทางเข้าโรงงาน\", \"photoUrl\": \"assets/route_photos/scg_packaging_factory_hd.jpg\"}]", "https://www.google.com/maps/dir/?api=1&origin=6.658056,100.076994&destination=14.583968,100.973825&waypoints=8.157909,99.666395|9.943424,99.061969|11.741378,99.748831|13.348472,99.893725&travelmode=driving", "Nichanan Aj. (SCGJWD Logistics)", "17.09.2567"],
    ["ROUTE-DOLE-WEST", "ราชบุรี (TCRB) – บจก.โดล ไทยแลนด์ (กุยบุรี ประจวบคีรีขันธ์)", "FEED_WEST", "บจก. โดล ไทยแลนด์ (Dole Thailand)", 355, "5 - 6 ชม.", 4, 80, "[{\"order\": 0, \"type\": \"origin\", \"name\": \"โรงงานสยามบรรจุภัณฑ์ (TCRB) ราชบุรี\", \"lat\": 13.512634, \"lng\": 99.614982, \"road\": \"ทล.4 เพชรเกษม\", \"distanceKm\": 0, \"recommendation\": \"จุดเริ่มต้น: ตรวจเช็คเอกสารใบส่งของ ตรวจสภาพรถ F-CAM-032 และวัดแอลกอฮอล์/ความดัน\", \"hazard\": \"ระวังรถเข้า-ออกบริเวณปากทางเข้าโรงงาน\", \"photoUrl\": \"assets/route_photos/scg_packaging_factory_hd.jpg\"}, {\"order\": 1, \"type\": \"rest\", \"name\": \"ปั๊มน้ำมัน ปตท. บ้านโป่ง (PTT Ban Pong)\", \"lat\": 13.812474, \"lng\": 99.862284, \"road\": \"ทล.4 กม.68\", \"distanceKm\": 38, \"recommendation\": \"จุดพักระยะสั้น: เติมน้ำมันและเช็คสภาพรถก่อนเดินทางไกลสู่ภาคใต้\", \"hazard\": \"ทางแยกสัญญาณไฟบ้านโป่ง ระวังรถตัดหน้า\", \"photoUrl\": \"assets/route_photos/ptt_station_hd.jpg\"}, {\"order\": 2, \"type\": \"rest\", \"name\": \"ปั๊มน้ำมัน เชลล์ ชะอำ (Shell Cha-am)\", \"lat\": 12.796727, \"lng\": 99.967843, \"road\": \"ทล.4 เพชรเกษม กม.168\", \"distanceKm\": 100, \"recommendation\": \"จุดพักครึ่งทาง: พักรับประทานอาหาร พักสายตา 30 นาที ตรวจเช็คลมยางและสายรัดสินค้า\", \"hazard\": \"ทางแยกร่วมชะอำ-หัวหิน ปริมาณรถหนาแน่นช่วงวันหยุด\", \"photoUrl\": \"assets/route_photos/shell_station_hd.jpg\"}, {\"order\": 3, \"type\": \"rest\", \"name\": \"ปั๊มน้ำมัน ปตท. ปราณบุรี (PTT Pranburi)\", \"lat\": 12.375826, \"lng\": 99.878658, \"road\": \"ทล.4 เพชรเกษม กม.248\", \"distanceKm\": 80, \"recommendation\": \"จุดพักสำคัญก่อนเข้าเขตประจวบคีรีขันธ์: ตรวจสอบความร้อนของดุมล้อและระบบเบรก\", \"hazard\": \"ทางแยกบายพาสปราณบุรี ระวังรถความเร็วสูง\", \"photoUrl\": \"assets/route_photos/ptt_station_hd.jpg\"}, {\"order\": 4, \"type\": \"rest\", \"name\": \"ปั๊มน้ำมัน ปตท. คลองวาฬ (PTT Khlong Wan)\", \"lat\": 11.811658, \"lng\": 99.778439, \"road\": \"ทล.4 เพชรเกษม กม.318\", \"distanceKm\": 70, \"recommendation\": \"จุดพักสุดท้ายก่อนถึงโรงงาน: พักสายตา 15 นาที ตรวจเช็คความเรียบร้อยของสินค้า\", \"hazard\": \"ทางตรงยาวช่วงทับสะแก-กุยบุรี ระวังอาการหลับใน\", \"photoUrl\": \"assets/route_photos/ptt_station_hd.jpg\"}, {\"order\": 5, \"type\": \"destination\", \"name\": \"บริษัท โดล ไทยแลนด์ จำกัด (Dole Thailand)\", \"lat\": 11.78048, \"lng\": 99.76223, \"road\": \"ทางหลวงเพชรเกษม กุยบุรี\", \"distanceKm\": 67, \"recommendation\": \"จุดหมายปลายทาง: ดับเครื่อง ดึงเบรกมือ สวมอุปกรณ์ PPE ครบชุดก่อนเข้าโรงงานอาหารแปรรูป\", \"hazard\": \"ทางเข้าโรงงานมีรถบรรทุกผลไม้และรถเกษตรกรเข้า-ออกสม่ำเสมอ\", \"photoUrl\": \"assets/route_photos/dole_thailand_hd.jpg\"}]", "https://www.google.com/maps/dir/?api=1&origin=13.512634,99.614982&destination=11.78048,99.76223&waypoints=13.812474,99.862284|12.796727,99.967843|12.375826,99.878658|11.811658,99.778439&travelmode=driving", "Nichanan Aj. (SCGJWD Logistics)", "17.09.2567"],
    ["ROUTE-SHORT-NEO", "สระบุรี (TCSB) – บจก. นีโอ แฟคทอรี่ (ลำลูกกา)", "FEED_SHORT", "บจก. นีโอ แฟคทอรี่ (Neo Factory)", 73.8, "1.2 - 1.5 ชม.", 0, 80, "[{\"order\": 0, \"type\": \"origin\", \"name\": \"โรงงานสยามบรรจุภัณฑ์ (TCSB) สระบุรี\", \"lat\": 14.583968, \"lng\": 100.973825, \"road\": \"ทล.1 พหลโยธิน\", \"distanceKm\": 0, \"recommendation\": \"จุดขึ้นสินค้า: ตรวจเช็คเอกสารและสายรัดสินค้าให้แน่นหนา (เส้นทางระยะสั้น < 150 กม. ไม่มีจุดพักรถตามเกณฑ์)\", \"hazard\": \"ทางเข้าหนองแคเป็นถนนเส้นเล็ก ระวังรถมอเตอร์ไซค์และทางแคบ\", \"photoUrl\": \"assets/route_photos/scg_packaging_factory_hd.jpg\"}, {\"order\": 1, \"type\": \"destination\", \"name\": \"บจก. นีโอ แฟคทอรี่ (ลำลูกกา คลอง 13)\", \"lat\": 14.0789, \"lng\": 100.892, \"road\": \"ถนน 305 รังสิต-นครนายก เชื่อมคลอง 13\", \"distanceKm\": 73.8, \"recommendation\": \"ถึงจุดหมายปลายทาง: เทียบท่าโหลดสินค้า ดับเครื่อง สวมหมวกนิรภัยและรองเท้าเซฟตี้\", \"hazard\": \"สะพานข้ามคลองและทางโค้งแคบ ใช้ความเร็วต่ำ\", \"photoUrl\": \"assets/route_photos/neo_factory_hd.jpg\"}]", "https://www.google.com/maps/dir/?api=1&origin=14.583968,100.973825&destination=14.0789,100.892&travelmode=driving", "Nichanan Aj. (SCGJWD Logistics)", "17.09.2567"],
    ["ROUTE-SHORT-CARGILL", "สระบุรี (TCSB) – บจก. คาร์กิลล์มีทส์ (ไทยแลนด์)", "FEED_SHORT", "บจก. คาร์กิลล์มีทส์ (ไทยแลนด์)", 30, "45 - 60 นาที", 0, 80, "[{\"order\": 0, \"type\": \"origin\", \"name\": \"โรงงานสยามบรรจุภัณฑ์ (TCSB) สระบุรี\", \"lat\": 14.583968, \"lng\": 100.973825, \"road\": \"ทล.1 / ถนน 3188\", \"distanceKm\": 0, \"recommendation\": \"จุดขึ้นสินค้า: ตรวจเช็คตู้คอนเทนเนอร์/ผ้าใบคลุม (ระยะทาง 30 กม. ไม่มีจุดพักรถ)\", \"hazard\": \"ถนนอดิเรกสารมีรถสัญจรในชุมชน ระวังคนข้ามถนน\", \"photoUrl\": \"assets/route_photos/scg_packaging_factory_hd.jpg\"}, {\"order\": 1, \"type\": \"destination\", \"name\": \"บจก. คาร์กิลล์มีทส์ (ไทยแลนด์)\", \"lat\": 14.615, \"lng\": 100.985, \"road\": \"ถนน 3034 สระบุรี\", \"distanceKm\": 30, \"recommendation\": \"จุดส่งมอบ: ปฏิบัติตามมาตรฐาน Bio-Security และเทียบท่าโหลดสินค้า\", \"hazard\": \"ทางเข้าโรงงานมีรถรับส่งพนักงานสัญจรช่วงเวลาเปลี่ยนกะ\", \"photoUrl\": \"assets/route_photos/cargill_meats_hd.jpg\"}]", "https://www.google.com/maps/dir/?api=1&origin=14.583968,100.973825&destination=14.615,100.985&travelmode=driving", "Nichanan Aj. (SCGJWD Logistics)", "17.09.2567"],
    ["ROUTE-SHORT-BFOODS", "สระบุรี (TCSB) – บจก. บีฟู้ดส์ โปรดักส์ (พัฒนานิคม)", "FEED_SHORT", "บจก. บีฟู้ดส์ โปรดักส์ อินเตอร์เนชั่นแนล", 43, "45 - 60 นาที", 0, 80, "[{\"order\": 0, \"type\": \"origin\", \"name\": \"โรงงานสยามบรรจุภัณฑ์ (TCSB) สระบุรี\", \"lat\": 14.583968, \"lng\": 100.973825, \"road\": \"ทล.1 พหลโยธิน\", \"distanceKm\": 0, \"recommendation\": \"จุดขึ้นสินค้า: ตรวจสอบความพร้อม พขร. และยานพาหนะ (ระยะทาง 43 กม. ไม่มีจุดพักรถ)\", \"hazard\": \"ทางแยกร่วมสระบุรี-หล่มสัก ระวังรถบรรทุกหนัก\", \"photoUrl\": \"assets/route_photos/scg_packaging_factory_hd.jpg\"}, {\"order\": 1, \"type\": \"destination\", \"name\": \"บจก. บีฟู้ดส์ โปรดักส์ (ช่องสาริกา พัฒนานิคม)\", \"lat\": 14.925, \"lng\": 100.842, \"road\": \"ต.ช่องสาริกา พัฒนานิคม ลพบุรี\", \"distanceKm\": 43, \"recommendation\": \"จุดส่งมอบสินค้า: ติดต่อป้อม รปภ. แลกบัตร และเทียบท่าโหลดสินค้าตามช่องที่กำหนด\", \"hazard\": \"ทางเข้าซอยเทศบาลมีรถมอเตอร์ไซค์และรถเกษตรกรวิ่งสวนทาง\", \"photoUrl\": \"assets/route_photos/cargill_meats_hd.jpg\"}]", "https://www.google.com/maps/dir/?api=1&origin=14.583968,100.973825&destination=14.925,100.842&travelmode=driving", "Nichanan Aj. (SCGJWD Logistics)", "17.09.2567"],
    ["ROUTE-SHORT-AJINOMOTO", "สระบุรี (TCSB) – บ.อายิโนะโมะโต๊ะ เบทาโกร โฟรเซ่นฟู้ดส์", "FEED_SHORT", "บ.อายิโนะโมะโต๊ะ เบทาโกร โฟรเซ่นฟู้ดส์ (ไทยแลนด์)", 37.9, "40 - 55 นาที", 0, 80, "[{\"order\": 0, \"type\": \"origin\", \"name\": \"โรงงานสยามบรรจุภัณฑ์ (TCSB) สระบุรี\", \"lat\": 14.583968, \"lng\": 100.973825, \"road\": \"ทล.1 พหลโยธิน\", \"distanceKm\": 0, \"recommendation\": \"จุดขึ้นสินค้า: ตรวจเช็คความสะอาดตู้บรรทุกสินค้า (ระยะทาง 37.9 กม. ไม่มีจุดพักรถ)\", \"hazard\": \"ปริมาณรถหนาแน่นช่วงทางแยกบายพาส\", \"photoUrl\": \"assets/route_photos/scg_packaging_factory_hd.jpg\"}, {\"order\": 1, \"type\": \"destination\", \"name\": \"บ.อายิโนะโมะโต๊ะ เบทาโกร โฟรเซ่นฟู้ดส์ (ไทยแลนด์)\", \"lat\": 14.885, \"lng\": 100.875, \"road\": \"ถนน 3334 ลพบุรี\", \"distanceKm\": 37.9, \"recommendation\": \"ถึงจุดหมายปลายทาง: เข้าจุดตรวจสุขอนามัยโรงงานอาหารแช่แข็ง และส่งมอบ POD\", \"hazard\": \"ทางเลี้ยวเข้าโรงงานกระชั้นชิด ให้เปิดสัญญาณไฟเลี้ยวก่อนล่วงหน้า\", \"photoUrl\": \"assets/route_photos/siam_canned_fish_hd.jpg\"}]", "https://www.google.com/maps/dir/?api=1&origin=14.583968,100.973825&destination=14.885,100.875&travelmode=driving", "Nichanan Aj. (SCGJWD Logistics)", "17.09.2567"],
    ["ROUTE-SHORT-ROYAL", "สระบุรี (TCSB) – บมจ. โรแยล ซีรามิค อุตสาหกรรม (หนองแค)", "FEED_SHORT", "บมจ. โรแยล ซีรามิค อุตสาหกรรม (หนองแค)", 35.6, "40 - 50 นาที", 0, 80, "[{\"order\": 0, \"type\": \"origin\", \"name\": \"โรงงานสยามบรรจุภัณฑ์ (TCSB) สระบุรี\", \"lat\": 14.583968, \"lng\": 100.973825, \"road\": \"ทล.1 พหลโยธิน\", \"distanceKm\": 0, \"recommendation\": \"จุดขึ้นสินค้า: ตรวจสอบการรัดกล่องบรรจุภัณฑ์เซรามิกอย่างแน่นหนา (ระยะทาง 35.6 กม. ไม่มีจุดพักรถ)\", \"hazard\": \"ทางเข้าหนองแคเป็นถนนเส้นเล็ก ระวังรถมอเตอร์ไซค์\", \"photoUrl\": \"assets/route_photos/scg_packaging_factory_hd.jpg\"}, {\"order\": 1, \"type\": \"destination\", \"name\": \"บมจ. โรแยล ซีรามิค อุตสาหกรรม (หนองแค)\", \"lat\": 14.385, \"lng\": 100.895, \"road\": \"ถนนพหลโยธิน กม.89 อ.หนองแค สระบุรี\", \"distanceKm\": 35.6, \"recommendation\": \"ถึงจุดหมายปลายทาง: เทียบท่าโหลดกล่องสินค้ากระเบื้องเซรามิก และลงชื่อส่งมอบเอกสาร\", \"hazard\": \"ทางแยกคู่ขนานพหลโยธิน มีรถชะลอเลี้ยวเข้าเขตนิคมอุตสาหกรรม\", \"photoUrl\": \"assets/route_photos/scg_packaging_factory_hd.jpg\"}]", "https://www.google.com/maps/dir/?api=1&origin=14.583968,100.973825&destination=14.385,100.895&travelmode=driving", "Nichanan Aj. (SCGJWD Logistics)", "17.09.2567"],
  ];

  // ล้างข้อมูลแถวเก่าตั้งแต่แถวที่ 2 ลงไป (คงหัวตารางไว้)
  if (sheet.getLastRow() > 1) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).clearContent();
  }

  // บันทึกข้อมูลทั้ง 9 เส้นทาง
  sheet.getRange(2, 1, routeRows.length, headers.length).setValues(routeRows);

  // จัดรูปแบบตารางและความกว้างคอลัมน์
  sheet.setColumnWidth(1, 140); // Route_ID
  sheet.setColumnWidth(2, 280); // Route_Name
  sheet.setColumnWidth(3, 110); // Feed
  sheet.setColumnWidth(4, 220); // Customer
  sheet.setColumnWidth(5, 130); // Total_Distance_KM
  sheet.setColumnWidth(6, 120); // Total_Time_Hours
  sheet.setColumnWidth(7, 120); // Rest_Stops_Count
  sheet.setColumnWidth(8, 100); // Speed_Limit
  sheet.setColumnWidth(9, 200); // Waypoints_JSON
  sheet.setColumnWidth(10, 250); // Google_Maps_URL
  sheet.setColumnWidth(11, 160); // Reviewer
  sheet.setColumnWidth(12, 110); // Review_Date

  Logger.log("✅ เพิ่มข้อมูลแผนการเดินรถครบทั้ง 9 เส้นทางลงในแผ่นงาน Route_Plans สำเร็จแล้ว!");
  return "✅ นำเข้าข้อมูลแผนการเดินรถ 9 เส้นทางลง Google Sheet (Route_Plans) สำเร็จแล้ว!";
}

/**
 * ฟังก์ชันดึงข้อมูลเส้นทางเพื่อเชื่อมต่อกับหน้าเว็บแบบ Realtime
 */
function getRoutePlansFromSheet() {
  const SPREADSHEET_ID = "1JM-i8_nrGR7-VDEY82QZ5l5JMJTIBOIsuqOSQSrcD3Y";
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName("Route_Plans");
  if (!sheet || sheet.getLastRow() <= 1) {
    return { status: "success", routes: [] };
  }

  const values = sheet.getDataRange().getValues();
  const routes = [];
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    let waypoints = [];
    try {
      waypoints = typeof row[8] === "string" ? JSON.parse(row[8]) : row[8];
    } catch(e) {}

    routes.push({
      id: row[0],
      name: row[1],
      feed: row[2],
      customer: row[3],
      totalDistanceKm: row[4],
      estimatedTime: row[5],
      restStopsCount: row[6],
      speedLimit: row[7],
      waypoints: waypoints,
      googleMapsUrl: row[9],
      reviewer: row[10],
      reviewDate: row[11]
    });
  }

  return { status: "success", total: routes.length, routes: routes };
}
