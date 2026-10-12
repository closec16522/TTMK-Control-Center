/**
 * =========================================================================
 * Google Apps Script - ระบบตรวจวัดแอลกอฮอล์และสุขภาพ พนักงานขับรถขนส่ง
 * หจก. ทั่วไทยขนส่งมงคล (Mr.Taweesak.kom - 062-3285963)
 * 
 * Google Sheet ID: 1JM-i8_nrGR7-VDEY82QZ5l5JMJTIBOIsuqOSQSrcD3Y
 * Google Drive Folder ID: 1tfKH6EOBFdG0c4Wm2MPO-R61NP5mAc0c
 * =========================================================================
 */

var SPREADSHEET_ID = ""; // ปลอดภัย: ไม่ใส่ ID บน GitHub (ระบบดึงอัตโนมัติจาก getActiveSpreadsheet)
var DRIVE_FOLDER_ID = ""; // ปลอดภัย: ดึงจากแผ่น System_Config ใน Google Sheet

/**
 * ดึง Google Spreadsheet ปัจจุบันโดยอัตโนมัติ
 */
function getAppSpreadsheet() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    if (ss) return ss;
  } catch (e) {}
  var id = getSystemConfig("SPREADSHEET_ID", "1JM-i8_nrGR7-VDEY82QZ5l5JMJTIBOIsuqOSQSrcD3Y");
  return SpreadsheetApp.openById(id);
}

/**
 * ดึง Google Drive Folder สำหรับบันทึกรูปภาพ
 */
function getAppDriveFolder() {
  var id = getSystemConfig("DRIVE_FOLDER_ID", "1tfKH6EOBFdG0c4Wm2MPO-R61NP5mAc0c");
  return DriveApp.getFolderById(id);
}

var SHEET_LOGS = "Alcohol_Logs";
var SHEET_DRIVERS = "Registered_Drivers";
var SHEET_CONFIG = "System_Config"; // แผ่นเก็บคีย์ลับและค่าคอนฟิกทั้งหมด (Gemini Key, LINE, Telegram) ไม่เปิดเผยบน GitHub

// ค่า Default เบื้องต้น (จะถูก Override อัตโนมัติด้วยค่าจากแผ่น System_Config ใน Google Sheet)
var NOTIFICATION_CONFIG = {
  TELEGRAM_BOT_TOKEN: "",
  TELEGRAM_CHAT_ID: "",
  LINE_CHANNEL_ACCESS_TOKEN: "",
  LINE_TARGET_ID: "",
  LINE_NOTIFY_TOKEN: "",
  ALERT_ON_FAIL_ONLY: false
};

/**
 * ฟังก์ชันเริ่มต้นสร้างตารางและหัวคอลัมน์อัตโนมัติ (รองรับการอัปเกรดตารางเดิม)
 */
function initialSetup() {
  var ss = getAppSpreadsheet();
  
  // 1. ชีต Alcohol_Logs
  var logSheet = ss.getSheetByName(SHEET_LOGS);
  if (!logSheet) {
    logSheet = ss.insertSheet(SHEET_LOGS);
  }
  
  var logHeaders = [
    "Timestamp",
    "Date",
    "Time",
    "Driver_ID",
    "Driver_Name",
    "Email",
    "Phone",
    "Vehicle_Plate",
    "Alcohol_Value",
    "Status",
    "BP_SYS",
    "BP_DIA",
    "BP_Pulse",
    "BP_Status",
    "Overall_Status",
    "Face_Match_Percent",
    "Report_Card_URL",
    "Face_Photo_URL",
    "Meter_Photo_URL",
    "BP_Photo_URL",
    "GPS_Coordinates",
    "Google_Maps_Link",
    "Verification_Method",
    "Remarks"
  ];
  
  ensureColumnsMatch(logSheet, logHeaders, "#1E3A8A");

  // 2. ชีต Registered_Drivers (ทะเบียนพนักงาน พร้อมรูปต้นแบบ 1:1)
  var driverSheet = ss.getSheetByName(SHEET_DRIVERS);
  if (!driverSheet) {
    driverSheet = ss.insertSheet(SHEET_DRIVERS);
  }
  
  var driverHeaders = [
    "Driver_ID",
    "Driver_Name",
    "Email",
    "Phone",
    "Vehicle_Plate",
    "Department",
    "Status",
    "Master_Face_URL",
    "Face_Descriptor_JSON",
    "Registered_Date"
  ];
  
  ensureColumnsMatch(driverSheet, driverHeaders, "#065F46");

  // 3. ชีต System_Config (เก็บ Key ลับ ทั้งหมด เช่น Gemini, Line, Telegram ไม่ให้อยู่บน GitHub)
  var configSheet = ss.getSheetByName(SHEET_CONFIG);
  if (!configSheet) {
    configSheet = ss.insertSheet(SHEET_CONFIG);
  }
  var configHeaders = ["Config_Key", "Config_Value", "Description", "Last_Updated"];
  ensureColumnsMatch(configSheet, configHeaders, "#4C1D95");
  initDefaultSystemConfigs(configSheet);
  
  return "Setup & Column Migration Completed Successfully";
}

/**
 * สร้างค่าเริ่มต้นในตาราง System_Config หากยังไม่มี
 */
function initDefaultSystemConfigs(configSheet) {
  var data = configSheet.getDataRange().getValues();
  var existingKeys = {};
  for (var i = 1; i < data.length; i++) {
    var k = (data[i][0] || "").toString().trim();
    if (k) existingKeys[k] = true;
  }
  
  var defaults = [
    ["GEMINI_API_KEY", "", "Google Gemini Vision API Key (ระบุคีย์ลับของคุณในช่องนี้ เพื่อเปิดใช้งาน AI)"],
    ["GEMINI_MODEL", "gemini-2.5-flash", "โมเดล Gemini สำหรับประมวลผลรูปภาพ"],
    ["ADMIN_PASSCODE", "44Cone38", "รหัสผ่านเจ้าหน้าที่สำหรับลงทะเบียนและตั้งค่า"],
    ["TELEGRAM_BOT_TOKEN", "", "Telegram Bot Token สำหรับส่งการ์ดรายงาน"],
    ["TELEGRAM_CHAT_ID", "", "Telegram Chat ID ของกลุ่ม"],
    ["LINE_CHANNEL_ACCESS_TOKEN", "", "LINE Messaging API Channel Access Token"],
    ["LINE_TARGET_ID", "", "LINE User ID หรือ Group ID สำหรับรับรายงาน"],
    ["LINE_NOTIFY_TOKEN", "", "LINE Notify Token (เดิม)"],
    ["ALERT_ON_FAIL_ONLY", "false", "แจ้งเตือนเฉพาะเคสไม่ผ่านเท่านั้น (true/false)"]
  ];
  
  var nowStr = Utilities.formatDate(new Date(), "Asia/Bangkok", "yyyy-MM-dd HH:mm:ss");
  defaults.forEach(function(row) {
    if (!existingKeys[row[0]]) {
      configSheet.appendRow([row[0], row[1], row[2], nowStr]);
    }
  });
}

/**
 * ดึงค่า Config จากชีต System_Config (พร้อมระบบ Cache 5 นาทีเพื่อความรวดเร็ว)
 */
function getSystemConfig(key, defaultValue) {
  try {
    var cache = CacheService.getScriptCache();
    var cached = cache.get("CFG_" + key);
    if (cached !== null) return cached;
    
    var ss = null;
    try {
      ss = SpreadsheetApp.getActiveSpreadsheet();
    } catch (e) {}
    if (!ss && SPREADSHEET_ID) {
      ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    }
    if (!ss) return defaultValue || "";
    var sheet = ss.getSheetByName(SHEET_CONFIG);
    if (!sheet) {
      initialSetup();
      sheet = ss.getSheetByName(SHEET_CONFIG);
    }
    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (data[i][0].toString().trim() === key) {
        var cacheTtl = (key === "ADMIN_PASSCODE") ? 5 : 300;
        cache.put("CFG_" + key, val, cacheTtl); // รหัสผ่านแคช 5 วินาทีเพื่อให้แก้ในชีตแล้วมีผลทันที คีย์อื่นแคช 5 นาที
        return val || (defaultValue || "");
      }
    }
  } catch (e) {
    Logger.log("getSystemConfig error: " + e.message);
  }
  return defaultValue || "";
}

/**
 * Google Gemini 2.5 Flash Vision AI Proxy (Secure Gateway)
 * ทำงานฝั่ง Google Apps Script โดยใช้ API Key ที่ซ่อนอยู่ใน Google Sheet อย่างปลอดภัย 100%
 */
function callGeminiFromGas(params) {
  var apiKey = getSystemConfig("GEMINI_API_KEY", "");
  if (!apiKey || apiKey.length < 10) {
    throw new Error("ไม่พบ GEMINI_API_KEY ในชีต System_Config กรุณาระบุ API Key");
  }

  var preferredModel = getSystemConfig("GEMINI_MODEL", "gemini-2.0-flash");
  var candidateModels = [
    preferredModel,
    "gemini-2.0-flash",
    "gemini-2.5-flash",
    "gemini-1.5-flash-latest",
    "gemini-1.5-flash"
  ];

  var modelsToTry = [];
  candidateModels.forEach(function(m) {
    if (m && modelsToTry.indexOf(m) === -1) modelsToTry.push(m);
  });
  
  var parts = [];
  if (params.prompt) {
    parts.push({ text: params.prompt });
  }
  
  if (params.imageBase64) {
    var clean1 = params.imageBase64.indexOf(",") > -1 ? params.imageBase64.split(",")[1] : params.imageBase64;
    parts.push({
      inline_data: {
        mime_type: "image/jpeg",
        data: clean1
      }
    });
  }
  
  if (params.image2Base64) {
    var clean2 = params.image2Base64.indexOf(",") > -1 ? params.image2Base64.split(",")[1] : params.image2Base64;
    parts.push({
      inline_data: {
        mime_type: "image/jpeg",
        data: clean2
      }
    });
  }
  
  var payload = {
    contents: [{ parts: parts }],
    generationConfig: {
      response_mime_type: "application/json",
      temperature: 0.1
    }
  };
  
  if (params.systemInstruction) {
    payload.systemInstruction = {
      parts: [{ text: params.systemInstruction }]
    };
  }
  
  var options = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  var lastError = "";
  for (var i = 0; i < modelsToTry.length; i++) {
    var modelName = modelsToTry[i];
    var endpoint = "https://generativelanguage.googleapis.com/v1beta/models/" + modelName + ":generateContent?key=" + apiKey;
    try {
      var response = UrlFetchApp.fetch(endpoint, options);
      var code = response.getResponseCode();
      var text = response.getContentText();
      
      if (code === 200) {
        var json = JSON.parse(text);
        var candidateText = json.candidates && json.candidates[0] && json.candidates[0].content && json.candidates[0].content.parts && json.candidates[0].content.parts[0].text;
        if (candidateText) {
          return JSON.parse(candidateText);
        }
      } else {
        lastError = "Model " + modelName + " Error (" + code + "): " + text.slice(0, 180);
        Logger.log(lastError);
      }
    } catch (e) {
      lastError = e.message;
      Logger.log("Model " + modelName + " exception: " + e.message);
    }
  }

  throw new Error("Gemini AI Error: " + lastError);
}

/**
 * ฟังก์ชันตรวจสอบและเพิ่มคอลัมน์ที่ขาดหายไปในชีตเดิม โดยไม่ลบข้อมูลเดิม
 */
function ensureColumnsMatch(sheet, requiredHeaders, headerBgColor) {
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(requiredHeaders);
    var range = sheet.getRange(1, 1, 1, requiredHeaders.length);
    range.setBackground(headerBgColor)
         .setFontColor("#FFFFFF")
         .setFontWeight("bold")
         .setHorizontalAlignment("center");
    sheet.setFrozenRows(1);
    for (var i = 1; i <= requiredHeaders.length; i++) {
      sheet.setColumnWidth(i, 150);
    }
    return;
  }

  // กรณีมีหัวตารางอยู่แล้ว ให้ตรวจสอบคอลัมน์ที่ยังไม่มีแล้วเพิ่มต่อท้าย
  var lastCol = Math.max(1, sheet.getLastColumn());
  var currentHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var currentHeaderMap = {};
  for (var c = 0; c < currentHeaders.length; c++) {
    currentHeaderMap[currentHeaders[c].toString().trim()] = c + 1;
  }

  for (var r = 0; r < requiredHeaders.length; r++) {
    var reqName = requiredHeaders[r];
    if (!currentHeaderMap[reqName]) {
      var newColIdx = sheet.getLastColumn() + 1;
      sheet.insertColumnAfter(sheet.getLastColumn());
      var cell = sheet.getRange(1, newColIdx);
      cell.setValue(reqName)
          .setBackground(headerBgColor)
          .setFontColor("#FFFFFF")
          .setFontWeight("bold")
          .setHorizontalAlignment("center");
      sheet.setColumnWidth(newColIdx, 160);
      currentHeaderMap[reqName] = newColIdx;
    }
  }
}

/**
 * คืนค่า Map ตำแหน่งคอลัมน์ตามชื่อ Header (รองรับทั้งชื่อภาษาอังกฤษและภาษาไทย)
 */
function getColumnIndexMap(sheet) {
  var lastCol = Math.max(1, sheet.getLastColumn());
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var map = {};
  for (var i = 0; i < headers.length; i++) {
    var rawKey = headers[i].toString().trim();
    if (!rawKey) continue;
    var colIdx = i + 1;
    map[rawKey] = colIdx;
    
    // แมปชื่อเรียกอื่นๆ ให้ตรงกันเสมอ
    var lower = rawKey.toLowerCase();
    if (lower.indexOf("driver_id") > -1 || lower.indexOf("driverid") > -1 || rawKey.indexOf("รหัส") > -1) {
      map["Driver_ID"] = colIdx;
    }
    if (lower.indexOf("driver_name") > -1 || lower.indexOf("drivername") > -1 || rawKey.indexOf("ชื่อ") > -1) {
      map["Driver_Name"] = colIdx;
    }
    if (lower.indexOf("email") > -1 || rawKey.indexOf("อีเมล") > -1) {
      map["Email"] = colIdx;
    }
    if (lower.indexOf("phone") > -1 || lower.indexOf("tel") > -1 || rawKey.indexOf("โทร") > -1) {
      map["Phone"] = colIdx;
    }
    if (lower.indexOf("vehicle") > -1 || lower.indexOf("plate") > -1 || rawKey.indexOf("ทะเบียน") > -1) {
      map["Vehicle_Plate"] = colIdx;
    }
    if (lower.indexOf("dept") > -1 || lower.indexOf("department") > -1 || rawKey.indexOf("แผนก") > -1) {
      map["Department"] = colIdx;
    }
    if (lower.indexOf("status") > -1 || rawKey.indexOf("สถานะ") > -1) {
      map["Status"] = colIdx;
    }
    if (lower.indexOf("master_face") > -1 || lower.indexOf("face_url") > -1 || rawKey.indexOf("รูป") > -1) {
      map["Master_Face_URL"] = colIdx;
    }
    if (lower.indexOf("descriptor") > -1 || lower.indexOf("vector") > -1 || rawKey.indexOf("เวกเตอร์") > -1) {
      map["Face_Descriptor_JSON"] = colIdx;
    }
    if (lower.indexOf("registered_date") > -1 || lower.indexOf("reg_date") > -1 || rawKey.indexOf("วันที่") > -1) {
      map["Registered_Date"] = colIdx;
    }
  }
  return map;
}

/**
 * จัดการคำขอแบบ GET
 */
function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) ? e.parameter.action : "ping";
  
  if (action === "setup") {
    var setupResult = initialSetup();
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      message: setupResult
    })).setMimeType(ContentService.MimeType.JSON);
  }
  
  if (action === "checkEmail") {
    var email = (e.parameter.email || "").trim().toLowerCase();
    var driver = findDriverByEmail(email);
    
    return ContentService.createTextOutput(JSON.stringify({
      success: driver !== null,
      driver: driver,
      message: driver ? "พบข้อมูลพนักงานในระบบ" : "ไม่พบอีเมลนี้ในระบบทะเบียนพนักงาน"
    })).setMimeType(ContentService.MimeType.JSON);
  }

  if (action === "listDrivers") {
    var drivers = getAllDrivers();
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      drivers: drivers
    })).setMimeType(ContentService.MimeType.JSON);
  }

  // ตรวจสอบรหัสผ่านแอดมินจาก Google Sheet System_Config
  if (action === "verifyPasscode") {
    var inputPass = (e.parameter.passcode || "").toString().trim();
    var actualPass = getSystemConfig("ADMIN_PASSCODE", "44Cone38").toString().trim();
    var isValid = (inputPass !== "" && inputPass === actualPass);
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      valid: isValid
    })).setMimeType(ContentService.MimeType.JSON);
  }

  // สร้างรหัสพนักงานอัตโนมัติ (Auto-increment Driver ID เช่น DRV-003, DRV-004)
  if (action === "getNextDriverId") {
    var nextId = getNextDriverIdFromSheet();
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      nextDriverId: nextId
    })).setMimeType(ContentService.MimeType.JSON);
  }

  return ContentService.createTextOutput(JSON.stringify({
    success: true,
    system: "ระบบตรวจวัดแอลกอฮอล์และความพร้อมพนักงาน หจก. ทั่วไทยขนส่งมงคล",
    owner: "Mr.Taweesak.kom (062-3285963)",
    status: "Service is online"
  })).setMimeType(ContentService.MimeType.JSON);
}

/**
 * ค้นหาข้อมูลพนักงานจาก Email (ค้นหาตามชื่อ Header คอลัมน์)
 */
/**
 * คำนวณรหัสพนักงานถัดไปอัตโนมัติ (Auto-increment Driver ID เช่น DRV-003, DRV-004)
 */
function getNextDriverIdFromSheet() {
  try {
    var ss = getAppSpreadsheet();
    var sheet = ss.getSheetByName(SHEET_DRIVERS);
    if (!sheet) return "DRV-012";
    
    var colMap = getColumnIndexMap(sheet);
    var idColIdx = (colMap["Driver_ID"] || 1) - 1;
    var data = sheet.getDataRange().getValues();
    if (data.length <= 1) return "DRV-001";
    
    var existingIds = {};
    var maxNum = 0;
    for (var i = 1; i < data.length; i++) {
      var val = (data[i][idColIdx] || "").toString().trim().toUpperCase();
      if (!val) continue;
      existingIds[val] = true;
      
      var match = val.match(/^DRV-?0*(\d+)$/i);
      if (match) {
        var num = parseInt(match[1], 10);
        if (!isNaN(num) && num < 900 && num > maxNum) {
          maxNum = num;
        }
      }
    }
    
    var candidateNum = Math.max(maxNum + 1, 1);
    while (true) {
      var nextStr = candidateNum.toString();
      while (nextStr.length < 3) {
        nextStr = "0" + nextStr;
      }
      var candidateId = "DRV-" + nextStr;
      if (!existingIds[candidateId]) {
        return candidateId;
      }
      candidateNum++;
    }
  } catch (e) {
    return "DRV-012";
  }
}

function findDriverByEmail(email) {
  if (!email) return null;
  try {
    var ss = getAppSpreadsheet();
    var sheet = ss.getSheetByName(SHEET_DRIVERS);
    if (!sheet) {
      initialSetup();
      sheet = ss.getSheetByName(SHEET_DRIVERS);
    }
    
    initialSetup(); // อัปเกรดคอลัมน์เสมอ
    var colMap = getColumnIndexMap(sheet);
    var data = sheet.getDataRange().getValues();
    if (data.length <= 1) return null;
    
    var idCol = (colMap["Driver_ID"] || 1) - 1;
    var nameCol = (colMap["Driver_Name"] || 2) - 1;
    var emailColIdx = (colMap["Email"] || 3) - 1;
    var phoneCol = (colMap["Phone"] || 4) - 1;
    var plateCol = (colMap["Vehicle_Plate"] || 5) - 1;
    var deptCol = (colMap["Department"] || 6) - 1;
    var statusCol = (colMap["Status"] || 7) - 1;
    var masterCol = (colMap["Master_Face_URL"] || 8) - 1;
    var descCol = (colMap["Face_Descriptor_JSON"] || 9) - 1;
    var dateCol = (colMap["Registered_Date"] || 10) - 1;
    
    for (var i = 1; i < data.length; i++) {
      var rowEmail = (data[i][emailColIdx] || "").toString().trim().toLowerCase();
      if (rowEmail === email) {
        return {
          driverId: data[i][idCol] || "",
          driverName: data[i][nameCol] || "",
          email: data[i][emailColIdx] || "",
          phone: data[i][phoneCol] || "",
          vehiclePlate: data[i][plateCol] || "",
          department: data[i][deptCol] || "",
          status: data[i][statusCol] || "ACTIVE",
          masterFaceUrl: data[i][masterCol] || "",
          faceDescriptor: data[i][descCol] || "",
          registeredDate: data[i][dateCol] || ""
        };
      }
    }
    return null;
  } catch (err) {
    Logger.log("Error finding driver: " + err.message);
    return null;
  }
}

/**
 * ดึงรายชื่อพนักงานทั้งหมด
 */
function getAllDrivers() {
  try {
    var ss = getAppSpreadsheet();
    var sheet = ss.getSheetByName(SHEET_DRIVERS);
    if (!sheet) return [];
    
    var colMap = getColumnIndexMap(sheet);
    var data = sheet.getDataRange().getValues();
    var list = [];
    for (var i = 1; i < data.length; i++) {
      list.push({
        driverId: data[i][(colMap["Driver_ID"] || 1) - 1],
        driverName: data[i][(colMap["Driver_Name"] || 2) - 1],
        email: data[i][(colMap["Email"] || 3) - 1],
        phone: data[i][(colMap["Phone"] || 4) - 1],
        vehiclePlate: data[i][(colMap["Vehicle_Plate"] || 5) - 1],
        department: data[i][(colMap["Department"] || 6) - 1],
        hasMasterFace: colMap["Master_Face_URL"] ? !!data[i][colMap["Master_Face_URL"] - 1] : false,
        status: data[i][(colMap["Status"] || 7) - 1]
      });
    }
    return list;
  } catch (e) {
    return [];
  }
}

/**
 * จัดการคำขอแบบ POST (ลงทะเบียนพนักงาน & บันทึกผลตรวจวัดแอลกอฮอล์ + ความดัน)
 */
function doPost(e) {
  // -------------------------------------------------------------
  // 1. FAST RESPONSE: LINE Webhook Verify ทันที (ป้องกัน Timeout ภายใน 0.05 วินาที)
  // -------------------------------------------------------------
  if (e && e.postData && e.postData.contents) {
    try {
      var rawCheck = e.postData.contents;
      if (rawCheck.indexOf('"events"') > -1) {
        var linePayload = JSON.parse(rawCheck);
        if (linePayload.events && Array.isArray(linePayload.events)) {
          // หากเป็นการกดปุ่ม Verify จาก LINE Developers (events ว่างเปล่า []) ตอบกลับทันที 100%!
          if (linePayload.events.length === 0) {
            return ContentService.createTextOutput(JSON.stringify({ status: "ok" }))
              .setMimeType(ContentService.MimeType.JSON);
          }
          // หากมีอีเวนต์จริง (เช่น แอดมินดึงบอทเข้ากลุ่ม หรือพิมพ์ขอ ID)
          handleLineWebhookEvents(linePayload.events);
          return ContentService.createTextOutput(JSON.stringify({ status: "ok" }))
            .setMimeType(ContentService.MimeType.JSON);
        }
      }
    } catch (lineFastErr) {
      Logger.log("Fast Line Webhook error: " + lineFastErr.toString());
    }
  }

  // -------------------------------------------------------------
  // 2. ปฏิบัติการปกติ: บันทึกข้อมูลและประมวลผล AI
  // -------------------------------------------------------------
  var lock = LockService.getScriptLock();
  lock.tryLock(30000);
  
  try {
    var rawData = e.postData.contents;
    var payload = JSON.parse(rawData);
    var action = payload.action || "submitAlcoholTest";
    
    var folder = getAppDriveFolder();
    var ss = getAppSpreadsheet();
    var now = new Date();
    
    // -------------------------------------------------------------
    // ACTION 0: Gemini AI Vision Proxy (API Gateway ซ่อนคีย์ลับจาก GitHub)
    // -------------------------------------------------------------
    if (action === "geminiProxy") {
      var geminiResult = callGeminiFromGas(payload);
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        data: geminiResult
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // -------------------------------------------------------------
    // ACTION 0.5: ตรวจสอบรหัสผ่านแอดมินจาก Google Sheet System_Config
    // -------------------------------------------------------------
    if (action === "verifyPasscode") {
      var postPass = (payload.passcode || "").toString().trim();
      var actualPassPost = getSystemConfig("ADMIN_PASSCODE", "44Cone38").toString().trim();
      var isPassValid = (postPass !== "" && postPass === actualPassPost);
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        valid: isPassValid
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // -------------------------------------------------------------
    // ACTION 1: ลงทะเบียนพนักงานใหม่ / อัปเดตรูปหน้าต้นแบบ (Register Master Face)
    // -------------------------------------------------------------
    if (action === "registerDriver") {
      var driverSheet = ss.getSheetByName(SHEET_DRIVERS);
      if (!driverSheet) {
        initialSetup();
        driverSheet = ss.getSheetByName(SHEET_DRIVERS);
      }
      
      initialSetup(); // รับประกันว่ามีคอลัมน์ครบ
      var colMap = getColumnIndexMap(driverSheet);
      
      var regDriverId = (payload.driverId || "").toString().trim();
      if (!regDriverId || regDriverId.toUpperCase() === "AUTO" || regDriverId === "-") {
        regDriverId = getNextDriverIdFromSheet();
      }
      var regName = payload.driverName || "ไม่ระบุชื่อ";
      var regEmail = (payload.email || "").trim().toLowerCase();
      var regPhone = payload.phone || "-";
      var regPlate = payload.vehiclePlate || "-";
      var regDept = payload.department || "แผนกขนส่ง";
      var descriptorJson = payload.faceDescriptorJson || "";
      var dateStr = Utilities.formatDate(now, "Asia/Bangkok", "yyyy-MM-dd HH:mm:ss");
      
      // บันทึกรูปหน้าต้นแบบ (Master Face) ลง Google Drive
      var masterFaceUrl = "";
      if (payload.masterFaceImageBase64) {
        var masterFileName = "MASTER_FACE_" + regDriverId + "_" + Utilities.formatDate(now, "Asia/Bangkok", "yyyyMMdd_HHmmss") + ".jpg";
        var masterFile = saveBase64ToDrive(payload.masterFaceImageBase64, masterFileName, folder);
        masterFaceUrl = masterFile.getUrl();
      }
      
      // ดึงหมายเลขคอลัมน์มาตรฐาน (หากไม่พบคอลัมน์ใน Sheet ให้ใช้ลำดับ 1 ถึง 10 ตามค่าเริ่มต้น)
      var idCol = colMap["Driver_ID"] || 1;
      var nameCol = colMap["Driver_Name"] || 2;
      var emailCol = colMap["Email"] || 3;
      var phoneCol = colMap["Phone"] || 4;
      var plateCol = colMap["Vehicle_Plate"] || 5;
      var deptCol = colMap["Department"] || 6;
      var statusCol = colMap["Status"] || 7;
      var masterCol = colMap["Master_Face_URL"] || 8;
      var descCol = colMap["Face_Descriptor_JSON"] || 9;
      var regDateCol = colMap["Registered_Date"] || 10;
      
      // ตรวจสอบว่ามีอีเมลนี้อยู่แล้วหรือไม่
      var emailColIdx = emailCol - 1;
      var driverData = driverSheet.getDataRange().getValues();
      var targetRow = -1;
      for (var k = 1; k < driverData.length; k++) {
        if ((driverData[k][emailColIdx] || "").toString().trim().toLowerCase() === regEmail) {
          targetRow = k + 1; // 1-based row index
          break;
        }
      }
      
      // ป้องกันรหัสพนักงานซ้ำกับผู้อื่นเด็ดขาด
      if (targetRow === -1) {
        var idColIdx = (colMap["Driver_ID"] || 1) - 1;
        var isDuplicateId = false;
        for (var dIdx = 1; dIdx < driverData.length; dIdx++) {
          var existId = (driverData[dIdx][idColIdx] || "").toString().trim().toUpperCase();
          if (existId && existId === regDriverId.toUpperCase()) {
            isDuplicateId = true;
            break;
          }
        }
        if (isDuplicateId || !regDriverId || regDriverId.toUpperCase() === "AUTO" || regDriverId === "-") {
          regDriverId = getNextDriverIdFromSheet();
        }
      }
      
      if (targetRow > 0) {
        // อัปเดตแถวเดิม
        driverSheet.getRange(targetRow, idCol).setValue(regDriverId);
        driverSheet.getRange(targetRow, nameCol).setValue(regName);
        driverSheet.getRange(targetRow, phoneCol).setValue(regPhone);
        driverSheet.getRange(targetRow, plateCol).setValue(regPlate);
        driverSheet.getRange(targetRow, deptCol).setValue(regDept);
        driverSheet.getRange(targetRow, statusCol).setValue("ACTIVE");
        if (masterFaceUrl) driverSheet.getRange(targetRow, masterCol).setValue(masterFaceUrl);
        if (descriptorJson) driverSheet.getRange(targetRow, descCol).setValue(descriptorJson);
        driverSheet.getRange(targetRow, regDateCol).setValue(dateStr);
      } else {
        // เพิ่มแถวใหม่
        var maxCol = Math.max(driverSheet.getLastColumn(), 10);
        var newRow = [];
        for (var c = 0; c < maxCol; c++) newRow.push("");
        
        newRow[idCol - 1] = regDriverId;
        newRow[nameCol - 1] = regName;
        newRow[emailCol - 1] = regEmail;
        newRow[phoneCol - 1] = regPhone;
        newRow[plateCol - 1] = regPlate;
        newRow[deptCol - 1] = regDept;
        newRow[statusCol - 1] = "ACTIVE";
        newRow[masterCol - 1] = masterFaceUrl;
        newRow[descCol - 1] = descriptorJson;
        newRow[regDateCol - 1] = dateStr;
        
        driverSheet.appendRow(newRow);
      }
      
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        message: "ลงทะเบียนพนักงานและบันทึกใบหน้าต้นแบบลง Google Drive สำเร็จ",
        driverId: regDriverId,
        masterFaceUrl: masterFaceUrl
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // -------------------------------------------------------------
    // ACTION 2: บันทึกผลตรวจวัดแอลกอฮอล์ + ความดันโลหิต (Submit Alcohol & BP Test)
    // -------------------------------------------------------------
    var logSheet = ss.getSheetByName(SHEET_LOGS);
    if (!logSheet) {
      initialSetup();
      logSheet = ss.getSheetByName(SHEET_LOGS);
    }
    
    initialSetup(); // อัปเกรดคอลัมน์อัตโนมัติ
    var logColMap = getColumnIndexMap(logSheet);
    
    var logDate = Utilities.formatDate(now, "Asia/Bangkok", "yyyy-MM-dd");
    var logTime = Utilities.formatDate(now, "Asia/Bangkok", "HH:mm:ss");
    var fullTimestamp = Utilities.formatDate(now, "Asia/Bangkok", "yyyy-MM-dd HH:mm:ss");
    
    var driverId = payload.driverId || "UNKNOWN";
    var driverName = payload.driverName || "ไม่ระบุชื่อ";
    var email = (payload.email || "").trim();
    var phone = payload.phone || "-";
    var vehiclePlate = payload.vehiclePlate || "-";
    var alcoholVal = parseFloat(payload.alcoholValue || 0).toFixed(2);
    var alcoholStatus = payload.status || (parseFloat(alcoholVal) < 0.01 ? "ผ่าน" : "ไม่ผ่าน");
    
    // ข้อมูลความดันโลหิตและชีพจร (Blood Pressure & Pulse)
    var bpSys = payload.bpSys ? parseInt(payload.bpSys) : 120;
    var bpDia = payload.bpDia ? parseInt(payload.bpDia) : 80;
    var bpPulse = payload.bpPulse ? parseInt(payload.bpPulse) : 75;
    var bpStatus = payload.bpStatus || (bpSys < 140 && bpDia < 90 ? "ความดันปกติ" : "ความดันสูง");
    var overallStatus = (alcoholStatus === "ผ่าน" && bpStatus === "ความดันปกติ") ? "ผ่านพร้อมปฏิบัติงาน" : "ไม่ผ่านเกณฑ์";
    
    var matchPercent = payload.faceMatchPercent || "-";
    var lat = payload.latitude || "";
    var lng = payload.longitude || "";
    var gps = (lat && lng) ? (lat + ", " + lng) : "-";
    var mapsUrl = (lat && lng) ? ("https://maps.google.com/?q=" + lat + "," + lng) : "-";
    var method = payload.verificationMethod || "Face 1:1 Matching & AI OCR";
    var remarks = payload.remarks || "-";

    // 1. จัดเก็บภาพรายงานสรุปรวม (Composite Report Card Image)
    var reportPhotoUrl = "-";
    if (payload.reportImageBase64) {
      var reportFileName = "REPORT_" + driverId + "_" + Utilities.formatDate(now, "Asia/Bangkok", "yyyyMMdd_HHmmss") + ".jpg";
      var reportFile = saveBase64ToDrive(payload.reportImageBase64, reportFileName, folder);
      try {
        reportFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      } catch (shareErr) {}
      reportPhotoUrl = reportFile.getUrl();
    }

    // ⚡ ส่ง Alert ทันทีตรงนี้ เพื่อให้ LINE แจ้งเตือนเข้าไวที่สุด (ภายใน 1-2 วินาที)
    var alertText = "📋 [รายงานตรวจวัดพนักงานขับรถขนส่ง]\n" +
                    "🏢 หจก. ทั่วไทยขนส่งมงคล\n" +
                    "👤 พนักงาน: " + driverName + " (" + driverId + ")\n" +
                    "🚚 ทะเบียน: " + vehiclePlate + "\n" +
                    "🍺 แอลกอฮอล์: " + alcoholVal + " mg% (" + alcoholStatus + ")\n" +
                    "💓 ความดัน: " + bpSys + "/" + bpDia + " mmHg (ชีพจร " + bpPulse + " bpm) • " + bpStatus + "\n" +
                    "🎯 สรุปผล: " + overallStatus + "\n" +
                    "📍 พิกัด GPS: " + gps + "\n" +
                    "⏰ เวลา: " + fullTimestamp + "\n" +
                    (reportPhotoUrl !== "-" ? "🖼️ รูปรายงาน: " + reportPhotoUrl : "");

    var alertOnFailOnly = (getSystemConfig("ALERT_ON_FAIL_ONLY", "false") === "true");
    var isUrgentAlert = (overallStatus !== "ผ่านพร้อมปฏิบัติงาน");
    if (!alertOnFailOnly || isUrgentAlert) {
      var lineAlertData = {
        alertText: alertText,
        driverName: driverName,
        driverId: driverId,
        vehiclePlate: vehiclePlate,
        alcoholVal: alcoholVal,
        alcoholStatus: alcoholStatus,
        bpSys: bpSys,
        bpDia: bpDia,
        bpPulse: bpPulse,
        bpStatus: bpStatus,
        overallStatus: overallStatus,
        fullTimestamp: fullTimestamp,
        reportPhotoUrl: reportPhotoUrl
      };
      try {
        sendLineAlert(lineAlertData);
      } catch (lineErr) {
        Logger.log("LINE alert error: " + lineErr.message);
      }
      try {
        sendTelegramAlert(alertText, reportPhotoUrl !== "-" ? reportPhotoUrl : null);
      } catch (tgErr) {
        Logger.log("Telegram alert error: " + tgErr.message);
      }
    }

    // 2. จัดเก็บภาพถ่ายใบหน้า Check-in
    var facePhotoUrl = "-";
    if (payload.faceImageBase64) {
      var faceFileName = "FACE_" + driverId + "_" + Utilities.formatDate(now, "Asia/Bangkok", "yyyyMMdd_HHmmss") + ".jpg";
      var faceFile = saveBase64ToDrive(payload.faceImageBase64, faceFileName, folder);
      facePhotoUrl = faceFile.getUrl();
    }
    
    // 3. จัดเก็บภาพหน้าปัดเครื่องเป่า
    var meterPhotoUrl = "-";
    if (payload.meterImageBase64) {
      var meterFileName = "METER_" + driverId + "_" + Utilities.formatDate(now, "Asia/Bangkok", "yyyyMMdd_HHmmss") + ".jpg";
      var meterFile = saveBase64ToDrive(payload.meterImageBase64, meterFileName, folder);
      meterPhotoUrl = meterFile.getUrl();
    }

    // 4. จัดเก็บภาพหน้าปัดเครื่องวัดความดัน
    var bpPhotoUrl = "-";
    if (payload.bpPhotoBase64) {
      var bpFileName = "BP_" + driverId + "_" + Utilities.formatDate(now, "Asia/Bangkok", "yyyyMMdd_HHmmss") + ".jpg";
      var bpFile = saveBase64ToDrive(payload.bpPhotoBase64, bpFileName, folder);
      bpPhotoUrl = bpFile.getUrl();
    }

    // สร้างแถวข้อมูลตามตำแหน่งคอลัมน์จริงใน Google Sheet
    var logMaxCol = logSheet.getLastColumn();
    var logRow = [];
    for (var m = 1; m <= logMaxCol; m++) logRow.push("");

    if (logColMap["Timestamp"]) logRow[logColMap["Timestamp"] - 1] = fullTimestamp;
    if (logColMap["Date"]) logRow[logColMap["Date"] - 1] = logDate;
    if (logColMap["Time"]) logRow[logColMap["Time"] - 1] = logTime;
    if (logColMap["Driver_ID"]) logRow[logColMap["Driver_ID"] - 1] = driverId;
    if (logColMap["Driver_Name"]) logRow[logColMap["Driver_Name"] - 1] = driverName;
    if (logColMap["Email"]) logRow[logColMap["Email"] - 1] = email;
    if (logColMap["Phone"]) logRow[logColMap["Phone"] - 1] = phone;
    if (logColMap["Vehicle_Plate"]) logRow[logColMap["Vehicle_Plate"] - 1] = vehiclePlate;
    if (logColMap["Alcohol_Value"]) logRow[logColMap["Alcohol_Value"] - 1] = alcoholVal;
    if (logColMap["Status"]) logRow[logColMap["Status"] - 1] = alcoholStatus;
    if (logColMap["BP_SYS"]) logRow[logColMap["BP_SYS"] - 1] = bpSys;
    if (logColMap["BP_DIA"]) logRow[logColMap["BP_DIA"] - 1] = bpDia;
    if (logColMap["BP_Pulse"]) logRow[logColMap["BP_Pulse"] - 1] = bpPulse;
    if (logColMap["BP_Status"]) logRow[logColMap["BP_Status"] - 1] = bpStatus;
    if (logColMap["Overall_Status"]) logRow[logColMap["Overall_Status"] - 1] = overallStatus;
    if (logColMap["Face_Match_Percent"]) logRow[logColMap["Face_Match_Percent"] - 1] = matchPercent;
    if (logColMap["Report_Card_URL"]) logRow[logColMap["Report_Card_URL"] - 1] = reportPhotoUrl;
    if (logColMap["Face_Photo_URL"]) logRow[logColMap["Face_Photo_URL"] - 1] = facePhotoUrl;
    if (logColMap["Meter_Photo_URL"]) logRow[logColMap["Meter_Photo_URL"] - 1] = meterPhotoUrl;
    if (logColMap["BP_Photo_URL"]) logRow[logColMap["BP_Photo_URL"] - 1] = bpPhotoUrl;
    if (logColMap["GPS_Coordinates"]) logRow[logColMap["GPS_Coordinates"] - 1] = gps;
    if (logColMap["Google_Maps_Link"]) logRow[logColMap["Google_Maps_Link"] - 1] = mapsUrl;
    if (logColMap["Verification_Method"]) logRow[logColMap["Verification_Method"] - 1] = method;
    if (logColMap["Remarks"]) logRow[logColMap["Remarks"] - 1] = remarks;

    logSheet.appendRow(logRow);
    
    var lastRow = logSheet.getLastRow();
    if (overallStatus !== "ผ่านพร้อมปฏิบัติงาน") {
      logSheet.getRange(lastRow, 1, 1, logMaxCol).setBackground("#FEE2E2"); // สีแดงอ่อน
    } else {
      logSheet.getRange(lastRow, 1, 1, logMaxCol).setBackground("#ECFDF5"); // สีเขียวอ่อน
    }

    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      message: "บันทึกผลตรวจและจัดเก็บรูปภาพรายงานลง Google Drive สำเร็จ",
      timestamp: fullTimestamp,
      status: alcoholStatus,
      alcoholValue: alcoholVal,
      bpStatus: bpStatus,
      overallStatus: overallStatus,
      faceMatchPercent: matchPercent,
      reportPhotoUrl: reportPhotoUrl,
      facePhotoUrl: facePhotoUrl,
      meterPhotoUrl: meterPhotoUrl,
      bpPhotoUrl: bpPhotoUrl
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (err) {
    Logger.log("Error doPost: " + err.toString());
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
    
  } finally {
    lock.releaseLock();
  }
}

/**
 * ส่งข้อความแจ้งเตือนผ่าน Telegram Bot
 */
function sendTelegramAlert(message, photoUrl) {
  var botToken = getSystemConfig("TELEGRAM_BOT_TOKEN", NOTIFICATION_CONFIG.TELEGRAM_BOT_TOKEN);
  var chatId = getSystemConfig("TELEGRAM_CHAT_ID", NOTIFICATION_CONFIG.TELEGRAM_CHAT_ID);
  if (!botToken || !chatId) return;

  var url = "https://api.telegram.org/bot" + botToken + "/sendMessage";
  var payload = {
    chat_id: chatId,
    text: message,
    parse_mode: "HTML"
  };

  UrlFetchApp.fetch(url, {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
}

/**
 * ส่งข้อความแจ้งเตือนผ่าน LINE Messaging API หรือ LINE Notify
 */
function sendLineAlert(data) {
  var lineChannelToken = getSystemConfig("LINE_CHANNEL_ACCESS_TOKEN", NOTIFICATION_CONFIG.LINE_CHANNEL_ACCESS_TOKEN);
  var lineTargetId = getSystemConfig("LINE_TARGET_ID", NOTIFICATION_CONFIG.LINE_TARGET_ID);
  var lineNotifyToken = getSystemConfig("LINE_NOTIFY_TOKEN", NOTIFICATION_CONFIG.LINE_NOTIFY_TOKEN);

  var alertObj = (typeof data === "object") ? data : { alertText: data.toString() };
  var isFail = alertObj.overallStatus !== "ผ่านพร้อมปฏิบัติงาน";
  var headerColor = isFail ? "#DC2626" : "#059669";
  var headerTitle = isFail ? "⚠️ แจ้งเตือน: ผลตรวจไม่ผ่านเกณฑ์!" : "✅ ผลตรวจสุขภาพพร้อมปฏิบัติงาน";

  // 1. LINE Messaging API (ส่งการ์ด Flex Message สวยงามพร้อมปุ่มเปิดดูรูปรายงาน)
  if (lineChannelToken && lineTargetId) {
    var flexBubble = {
      type: "bubble",
      size: "mega",
      header: {
        type: "box",
        layout: "vertical",
        backgroundColor: headerColor,
        paddingAll: "16px",
        contents: [
          {
            type: "text",
            text: headerTitle,
            color: "#FFFFFF",
            weight: "bold",
            size: "md"
          },
          {
            type: "text",
            text: "หจก. ทั่วไทยขนส่งมงคล (Smart Inspection)",
            color: "#F1F5F9",
            size: "xxs",
            margin: "xs"
          }
        ]
      },
      body: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: [
          {
            type: "box",
            layout: "horizontal",
            contents: [
              { type: "text", text: "พนักงาน:", color: "#64748B", size: "xs", flex: 3 },
              { type: "text", text: (alertObj.driverName || "-") + " (" + (alertObj.driverId || "-") + ")", weight: "bold", color: "#1E293B", size: "xs", flex: 6 }
            ]
          },
          {
            type: "box",
            layout: "horizontal",
            contents: [
              { type: "text", text: "ทะเบียนรถ:", color: "#64748B", size: "xs", flex: 3 },
              { type: "text", text: alertObj.vehiclePlate || "-", weight: "bold", color: "#1E293B", size: "xs", flex: 6 }
            ]
          },
          {
            type: "separator",
            margin: "sm"
          },
          {
            type: "box",
            layout: "horizontal",
            contents: [
              { type: "text", text: "แอลกอฮอล์:", color: "#64748B", size: "xs", flex: 3 },
              {
                type: "text",
                text: (alertObj.alcoholVal || "0.00") + " mg% (" + (alertObj.alcoholStatus || "-") + ")",
                weight: "bold",
                color: (parseFloat(alertObj.alcoholVal) > 0 || alertObj.alcoholStatus !== "ผ่าน") ? "#DC2626" : "#059669",
                size: "xs",
                flex: 6
              }
            ]
          },
          {
            type: "box",
            layout: "horizontal",
            contents: [
              { type: "text", text: "ความดัน/ชีพจร:", color: "#64748B", size: "xs", flex: 3 },
              {
                type: "text",
                text: alertObj.bpSys + "/" + alertObj.bpDia + " mmHg (" + alertObj.bpPulse + " bpm)",
                weight: "bold",
                color: "#1E293B",
                size: "xs",
                flex: 6
              }
            ]
          },
          {
            type: "box",
            layout: "horizontal",
            contents: [
              { type: "text", text: "ผลประเมิน:", color: "#64748B", size: "xs", flex: 3 },
              {
                type: "text",
                text: alertObj.overallStatus || "-",
                weight: "bold",
                color: isFail ? "#DC2626" : "#059669",
                size: "xs",
                flex: 6
              }
            ]
          },
          {
            type: "box",
            layout: "horizontal",
            contents: [
              { type: "text", text: "เวลาตรวจ:", color: "#64748B", size: "xxs", flex: 3 },
              { type: "text", text: alertObj.fullTimestamp || "-", color: "#94A3B8", size: "xxs", flex: 6 }
            ]
          }
        ]
      }
    };

    if (alertObj.reportPhotoUrl && alertObj.reportPhotoUrl !== "-") {
      flexBubble.footer = {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: [
          {
            type: "button",
            style: "primary",
            color: isFail ? "#DC2626" : "#2563EB",
            height: "sm",
            action: {
              type: "uri",
              label: "📄 ดูรูปรายงานสรุปตรวจวัด",
              uri: alertObj.reportPhotoUrl
            }
          }
        ]
      };
    }

    var pushUrl = "https://api.line.me/v2/bot/message/push";
    var pushPayload = {
      to: lineTargetId,
      messages: [
        {
          type: "flex",
          altText: (isFail ? "⚠️ [ด่วน] ผลตรวจไม่ผ่าน: " : "✅ ผลตรวจพร้อมปฏิบัติงาน: ") + alertObj.driverName + " (" + alertObj.vehiclePlate + ")",
          contents: flexBubble
        }
      ]
    };

    try {
      var pushRes = UrlFetchApp.fetch(pushUrl, {
        method: "post",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + lineChannelToken
        },
        payload: JSON.stringify(pushPayload),
        muteHttpExceptions: true
      });
      Logger.log("LINE Flex Card Push response (" + pushRes.getResponseCode() + "): " + pushRes.getContentText());
      if (pushRes.getResponseCode() === 200) return;

      // หาก LINE ปฏิเสธ Flex Card ให้ส่งแบบ Text Message ทันทีเพื่อไม่ให้พลาดการแจ้งเตือน
      var fallbackPayload = {
        to: lineTargetId,
        messages: [
          {
            type: "text",
            text: alertObj.alertText || "รายงานตรวจวัดพนักงานขับรถ"
          }
        ]
      };
      UrlFetchApp.fetch(pushUrl, {
        method: "post",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + lineChannelToken
        },
        payload: JSON.stringify(fallbackPayload),
        muteHttpExceptions: true
      });
      return;
    } catch (pushErr) {
      Logger.log("LINE Push error: " + pushErr.message);
    }
  }

  // 2. Fallback: LINE Notify
  if (lineNotifyToken) {
    var notifyUrl = "https://notify-api.line.me/api/notify";
    var notifyPayload = { message: alertObj.alertText || "รายงานตรวจวัดพนักงานขับรถ" };
    if (alertObj.reportPhotoUrl && alertObj.reportPhotoUrl !== "-") {
      notifyPayload.imageThumbnail = alertObj.reportPhotoUrl;
      notifyPayload.imageFullsize = alertObj.reportPhotoUrl;
    }
    UrlFetchApp.fetch(notifyUrl, {
      method: "post",
      headers: {
        "Authorization": "Bearer " + lineNotifyToken
      },
      payload: notifyPayload,
      muteHttpExceptions: true
    });
  }
}

/**
 * ฟังก์ชันบันทึก Base64 Image ลงใน Google Drive
 */
function saveBase64ToDrive(base64Data, filename, folder) {
  var cleanBase64 = base64Data;
  var mimeType = "image/jpeg";
  
  if (base64Data.indexOf("data:") === 0) {
    var parts = base64Data.split(",");
    var mimeMatch = parts[0].match(/:(.*?);/);
    if (mimeMatch && mimeMatch[1]) {
      mimeType = mimeMatch[1];
    }
    cleanBase64 = parts[1];
  }
  
  var decoded = Utilities.base64Decode(cleanBase64);
  var blob = Utilities.newBlob(decoded, mimeType, filename);
  var file = folder.createFile(blob);
  
  try {
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch(e) {
    Logger.log("Sharing error: " + e.message);
  }
  
  return file;
}

/**
 * จัดการอีเวนต์ขาเข้าจาก LINE Webhook (ตอบกลับอัตโนมัติ & ช่วยหา Group ID / User ID)
 */
function handleLineWebhookEvents(events) {
  var lineChannelToken = getSystemConfig("LINE_CHANNEL_ACCESS_TOKEN", NOTIFICATION_CONFIG.LINE_CHANNEL_ACCESS_TOKEN);
  if (!lineChannelToken) return;

  for (var i = 0; i < events.length; i++) {
    var event = events[i];
    var replyToken = event.replyToken;
    var source = event.source || {};
    var targetId = source.groupId || source.roomId || source.userId || "";

    // เมื่อแอดมินดึงบอตเข้ากลุ่ม (Join Group)
    if (event.type === "join") {
      replyLineMessage(replyToken, lineChannelToken, 
        "🚚 สวัสดีครับ! บอทตรวจวัดแอลกอฮอล์ หจก. ทั่วไทยขนส่งมงคล เข้าร่วมกลุ่มเรียบร้อยแล้ว\n\n" +
        "📌 รหัสกลุ่มของคุณ (LINE_TARGET_ID):\n" + targetId + "\n\n" +
        "👉 นำรหัสนี้ไปใส่ใน Google Sheet แผ่น System_Config ช่อง LINE_TARGET_ID เพื่อรับการแจ้งเตือนรายงานเข้ากลุ่มนี้ได้ทันทีครับ"
      );
    }

    // เมื่อมีคนพิมพ์ข้อความหาบอต (Message)
    else if (event.type === "message" && event.message && event.message.type === "text") {
      var userText = (event.message.text || "").trim().toLowerCase();
      if (userText === "id" || userText.indexOf("group") > -1 || userText.indexOf("ไอดี") > -1 || userText.indexOf("รหัส") > -1) {
        replyLineMessage(replyToken, lineChannelToken,
          "📌 รหัสสำหรับรับแจ้งเตือนของคุณ:\n" + targetId + "\n\n" +
          "ประเภท: " + (source.groupId ? "รหัสกลุ่ม (Group ID)" : "รหัสส่วนตัว (User ID)") + "\n\n" +
          "👉 นำรหัสนี้ไปใส่ใน Google Sheet แผ่น System_Config ช่อง LINE_TARGET_ID ได้เลยครับ"
        );
      }
    }
  }
}

/**
 * ฟังก์ชันตอบกลับข้อความ LINE Messaging API (Reply Message)
 */
function replyLineMessage(replyToken, channelAccessToken, textMessage) {
  if (!replyToken || !channelAccessToken) return;
  var url = "https://api.line.me/v2/bot/message/reply";
  var payload = {
    replyToken: replyToken,
    messages: [{ type: "text", text: textMessage }]
  };
  try {
    UrlFetchApp.fetch(url, {
      method: "post",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + channelAccessToken
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
  } catch (err) {
    Logger.log("replyLineMessage error: " + err.message);
  }
}
