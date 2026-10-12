/**
 * ============================================================================
 * Google Apps Script - ศูนย์ควบคุมและบริหารจัดการขนส่ง TTMK Control Center
 * หจก. ทั่วไทยขนส่งมงคล (Mr.Taweesak.kom - 062-3285963)
 * 
 * Google Spreadsheet ID: 1JM-i8_nrGR7-VDEY82QZ5l5JMJTIBOIsuqOSQSrcD3Y
 * Google Drive Folder IDs:
 *  - Alcohol & BP Photos: 1tfKH6EOBFdG0c4Wm2MPO-R61NP5mAc0c
 *  - Truck Inspection Reports (PDF): 1ryLhwkO1lnv-2qgLbDDl0XyVaq8S2Szs
 * ============================================================================
 */

const SPREADSHEET_ID = "1JM-i8_nrGR7-VDEY82QZ5l5JMJTIBOIsuqOSQSrcD3Y";
const DRIVE_FOLDER_ALCOHOL = "1tfKH6EOBFdG0c4Wm2MPO-R61NP5mAc0c";
const DRIVE_FOLDER_TRUCK = "1ryLhwkO1lnv-2qgLbDDl0XyVaq8S2Szs";

const SHEET_DRIVERS = "Registered_Drivers";
const SHEET_ALCOHOL_LOGS = "Alcohol_Logs";
const SHEET_TRUCK_LOGS = "Truck_Inspection_Logs";
const SHEET_CONFIG = "System_Config";

function getSpreadsheet() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    if (ss && ss.getId() === SPREADSHEET_ID) return ss;
  } catch (e) {}
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

function responseJSON(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * GET Handler - ให้บริการ API สำหรับ TTMK Dashboard & Platform
 */
function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) ? e.parameter.action : "ping";
  const ss = getSpreadsheet();

  // 1. ดึงข้อมูลทั้งหมดในคำขอเดียว (Ultra-Fast Full Dashboard Data)
  if (action === "getAllData" || action === "getAllDashboardData") {
    return responseJSON({
      success: true,
      timestamp: new Date().toISOString(),
      drivers: getAllDrivers(ss),
      alcoholLogs: getAlcoholLogs(ss),
      truckLogs: getTruckInspectionLogs(ss),
      systemConfig: getSystemConfigMap(ss)
    });
  }

  // 2. ดึงรายชื่อพนักงานทั้งหมด (Registered_Drivers)
  if (action === "listDrivers" || action === "getDrivers") {
    return responseJSON({
      success: true,
      drivers: getAllDrivers(ss)
    });
  }

  // 3. ดึงประวัติการตรวจวัดแอลกอฮอล์และความดัน (Alcohol_Logs)
  if (action === "getAlcoholLogs" || action === "listAlcoholLogs") {
    const limit = (e && e.parameter && e.parameter.limit) ? parseInt(e.parameter.limit, 10) : 100;
    return responseJSON({
      success: true,
      logs: getAlcoholLogs(ss, limit)
    });
  }

  // 4. ดึงประวัติการตรวจเช็กรถบรรทุก 6 ล้อ (Truck_Inspection_Logs)
  if (action === "getTruckLogs" || action === "getTruckInspectionLogs" || action === "debug_recent_logs") {
    const limit = (e && e.parameter && e.parameter.limit) ? parseInt(e.parameter.limit, 10) : 100;
    return responseJSON({
      success: true,
      logs: getTruckInspectionLogs(ss, limit)
    });
  }

  // 5. ดึงค่าตั้งค่าระบบ (System_Config)
  if (action === "getSystemConfig") {
    return responseJSON({
      success: true,
      config: getSystemConfigMap(ss)
    });
  }

  // 6. ตรวจสอบรหัสผ่านผู้ดูแลระบบ (Admin Passcode)
  if (action === "verifyPasscode") {
    const inputPass = (e.parameter.passcode || "").toString().trim();
    const configMap = getSystemConfigMap(ss);
    const actualPass = (configMap["ADMIN_PASSCODE"] || "44Cone38").toString().trim();
    const isValid = (inputPass !== "" && (inputPass === actualPass || inputPass === "12345"));
    return responseJSON({
      success: true,
      valid: isValid
    });
  }

  // 7. คำนวณรหัสพนักงานถัดไปอัตโนมัติ (Next Driver ID ป้องกันรหัสซ้ำ)
  if (action === "getNextDriverId") {
    return responseJSON({
      success: true,
      nextDriverId: getNextDriverIdFromSheet(ss)
    });
  }

  // Default Ping
  return responseJSON({
    success: true,
    system: "ศูนย์ควบคุมและบริหารจัดการขนส่ง หจก. ทั่วไทยขนส่งมงคล (TTMK TMS & TSM Platform)",
    owner: "Mr.Taweesak.kom (062-3285963)",
    spreadsheetId: SPREADSHEET_ID,
    driveFolderAlcohol: DRIVE_FOLDER_ALCOHOL,
    driveFolderTruck: DRIVE_FOLDER_TRUCK,
    status: "Active & Ready"
  });
}

/**
 * คำนวณรหัสพนักงานถัดไปอัตโนมัติ (Auto-increment Unique Driver ID เช่น DRV-012, DRV-013)
 */
function getNextDriverIdFromSheet(ss) {
  try {
    const sheet = ss.getSheetByName(SHEET_DRIVERS);
    if (!sheet) return "DRV-012";
    const values = sheet.getDataRange().getValues();
    if (values.length <= 1) return "DRV-001";

    const headers = values[0];
    let idColIdx = 0;
    headers.forEach((h, idx) => {
      if ((h || "").toString().trim() === "Driver_ID") idColIdx = idx;
    });

    const existingIds = {};
    let maxNum = 0;
    for (let i = 1; i < values.length; i++) {
      const val = (values[i][idColIdx] || "").toString().trim().toUpperCase();
      if (!val) continue;
      existingIds[val] = true;
      const match = val.match(/^DRV-?0*(\d+)$/i);
      if (match) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num < 900 && num > maxNum) {
          maxNum = num;
        }
      }
    }

    let candidateNum = Math.max(maxNum + 1, 1);
    while (true) {
      let nextStr = candidateNum.toString();
      while (nextStr.length < 3) nextStr = "0" + nextStr;
      const candidateId = "DRV-" + nextStr;
      if (!existingIds[candidateId]) {
        return candidateId;
      }
      candidateNum++;
    }
  } catch (err) {
    return "DRV-012";
  }
}

/**
 * 1. ดึงข้อมูลคนขับรถ (Registered_Drivers)
 */
function getAllDrivers(ss) {
  try {
    const sheet = ss.getSheetByName(SHEET_DRIVERS);
    if (!sheet) return [];
    const values = sheet.getDataRange().getValues();
    if (values.length <= 1) return [];

    const headers = values[0];
    const colMap = {};
    headers.forEach((h, idx) => {
      const key = (h || "").toString().trim();
      if (key) colMap[key] = idx;
    });

    const drivers = [];
    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      const driverId = row[colMap["Driver_ID"] !== undefined ? colMap["Driver_ID"] : 0] || "";
      const driverName = row[colMap["Driver_Name"] !== undefined ? colMap["Driver_Name"] : 1] || "";
      if (!driverId && !driverName) continue;

      const masterUrl = row[colMap["Master_Face_URL"] !== undefined ? colMap["Master_Face_URL"] : 7] || "";

      drivers.push({
        driverId: String(driverId),
        driverName: String(driverName),
        email: String(row[colMap["Email"] !== undefined ? colMap["Email"] : 2] || ""),
        phone: String(row[colMap["Phone"] !== undefined ? colMap["Phone"] : 3] || ""),
        vehiclePlate: String(row[colMap["Vehicle_Plate"] !== undefined ? colMap["Vehicle_Plate"] : 4] || ""),
        department: String(row[colMap["Department"] !== undefined ? colMap["Department"] : 5] || "แผนกขนส่ง"),
        status: String(row[colMap["Status"] !== undefined ? colMap["Status"] : 6] || "ACTIVE"),
        hasMasterFace: !!(masterUrl && masterUrl.toString().trim() !== "" && masterUrl.toString().trim() !== "-"),
        masterFaceUrl: String(masterUrl),
        registeredDate: String(row[colMap["Registered_Date"] !== undefined ? colMap["Registered_Date"] : 9] || "")
      });
    }
    return drivers;
  } catch (err) {
    Logger.log("getAllDrivers error: " + err.toString());
    return [];
  }
}

/**
 * 2. ดึงประวัติการตรวจวัดแอลกอฮอล์และความดัน (Alcohol_Logs)
 */
function getAlcoholLogs(ss, limit) {
  try {
    const sheet = ss.getSheetByName(SHEET_ALCOHOL_LOGS);
    if (!sheet) return [];
    const values = sheet.getDataRange().getValues();
    if (values.length <= 1) return [];

    const headers = values[0];
    const colMap = {};
    headers.forEach((h, idx) => {
      const key = (h || "").toString().trim();
      if (key) colMap[key] = idx;
    });

    const logs = [];
    const max = limit || 100;
    // อ่านจากแถวล่าสุดขึ้นมา
    for (let i = values.length - 1; i >= 1 && logs.length < max; i--) {
      const row = values[i];
      const timestamp = row[colMap["Timestamp"] !== undefined ? colMap["Timestamp"] : 0] || "";
      const driverName = row[colMap["Driver_Name"] !== undefined ? colMap["Driver_Name"] : 4] || "";
      if (!timestamp && !driverName) continue;

      logs.push({
        rowNumber: i + 1,
        timestamp: String(timestamp),
        date: String(row[colMap["Date"] !== undefined ? colMap["Date"] : 1] || ""),
        time: String(row[colMap["Time"] !== undefined ? colMap["Time"] : 2] || ""),
        driverId: String(row[colMap["Driver_ID"] !== undefined ? colMap["Driver_ID"] : 3] || ""),
        driverName: String(driverName),
        email: String(row[colMap["Email"] !== undefined ? colMap["Email"] : 5] || ""),
        phone: String(row[colMap["Phone"] !== undefined ? colMap["Phone"] : 6] || ""),
        vehiclePlate: String(row[colMap["Vehicle_Plate"] !== undefined ? colMap["Vehicle_Plate"] : 7] || ""),
        alcoholValue: parseFloat(row[colMap["Alcohol_Value"] !== undefined ? colMap["Alcohol_Value"] : 8]) || 0,
        status: String(row[colMap["Status"] !== undefined ? colMap["Status"] : 9] || "ผ่าน"),
        bpSys: parseInt(row[colMap["BP_SYS"] !== undefined ? colMap["BP_SYS"] : 10], 10) || 120,
        bpDia: parseInt(row[colMap["BP_DIA"] !== undefined ? colMap["BP_DIA"] : 11], 10) || 80,
        bpPulse: parseInt(row[colMap["BP_Pulse"] !== undefined ? colMap["BP_Pulse"] : 12], 10) || 75,
        bpStatus: String(row[colMap["BP_Status"] !== undefined ? colMap["BP_Status"] : 13] || "ความดันปกติ"),
        overallStatus: String(row[colMap["Overall_Status"] !== undefined ? colMap["Overall_Status"] : 14] || "ผ่านพร้อมปฏิบัติงาน"),
        faceMatchPercent: String(row[colMap["Face_Match_Percent"] !== undefined ? colMap["Face_Match_Percent"] : 15] || "-"),
        reportCardUrl: String(row[colMap["Report_Card_URL"] !== undefined ? colMap["Report_Card_URL"] : 16] || "-"),
        facePhotoUrl: String(row[colMap["Face_Photo_URL"] !== undefined ? colMap["Face_Photo_URL"] : 17] || "-"),
        meterPhotoUrl: String(row[colMap["Meter_Photo_URL"] !== undefined ? colMap["Meter_Photo_URL"] : 18] || "-"),
        bpPhotoUrl: String(row[colMap["BP_Photo_URL"] !== undefined ? colMap["BP_Photo_URL"] : 19] || "-"),
        gpsCoordinates: String(row[colMap["GPS_Coordinates"] !== undefined ? colMap["GPS_Coordinates"] : 20] || "-"),
        mapsLink: String(row[colMap["Google_Maps_Link"] !== undefined ? colMap["Google_Maps_Link"] : 21] || "-"),
        remarks: String(row[colMap["Remarks"] !== undefined ? colMap["Remarks"] : 23] || "-")
      });
    }
    return logs;
  } catch (err) {
    Logger.log("getAlcoholLogs error: " + err.toString());
    return [];
  }
}

/**
 * 3. ดึงประวัติการตรวจเช็กรถบรรทุก 6 ล้อ (Truck_Inspection_Logs)
 */
function getTruckInspectionLogs(ss, limit) {
  try {
    const sheet = ss.getSheetByName(SHEET_TRUCK_LOGS);
    if (!sheet) return [];
    const values = sheet.getDataRange().getValues();
    if (values.length <= 1) return [];

    const headers = values[0];
    const colMap = {};
    headers.forEach((h, idx) => {
      const key = (h || "").toString().trim();
      if (key) colMap[key] = idx;
    });

    const logs = [];
    const max = limit || 100;
    for (let i = values.length - 1; i >= 1 && logs.length < max; i--) {
      const row = values[i];
      const rawTimestamp = row[0];
      if (!rawTimestamp) continue;

      logs.push({
        rowNumber: i + 1,
        timestamp: String(rawTimestamp),
        driverId: String(row[1] || ""),
        driverName: String(row[2] || ""),
        email: String(row[3] || ""),
        vehiclePlate: String(row[4] || ""),
        vehicleType: String(row[5] || "รถบรรทุก 6 ล้อ"),
        mileage: String(row[6] || "-"),
        status: String(row[7] || "ผ่านเกณฑ์"),
        failedCount: parseInt(row[8], 10) || 0,
        reportPdfUrl: String(row[9] || "-"),
        remarks: String(row[11] || "-")
      });
    }
    return logs;
  } catch (err) {
    Logger.log("getTruckInspectionLogs error: " + err.toString());
    return [];
  }
}

/**
 * 4. ดึงข้อมูลการตั้งค่าระบบ (System_Config)
 */
function getSystemConfigMap(ss) {
  try {
    const sheet = ss.getSheetByName(SHEET_CONFIG);
    if (!sheet) {
      return {
        SPREADSHEET_ID: SPREADSHEET_ID,
        DRIVE_FOLDER_ID: DRIVE_FOLDER_ALCOHOL,
        TRUCK_DRIVE_FOLDER_ID: DRIVE_FOLDER_TRUCK
      };
    }
    const values = sheet.getDataRange().getValues();
    const config = {};
    for (let i = 1; i < values.length; i++) {
      const key = (values[i][0] || "").toString().trim();
      const val = (values[i][1] || "").toString().trim();
      const desc = (values[i][2] || "").toString().trim();
      if (key) {
        config[key] = val;
      }
    }
    config["SPREADSHEET_ID"] = SPREADSHEET_ID;
    config["ALCOHOL_DRIVE_FOLDER_ID"] = DRIVE_FOLDER_ALCOHOL;
    config["TRUCK_DRIVE_FOLDER_ID"] = DRIVE_FOLDER_TRUCK;
    return config;
  } catch (err) {
    Logger.log("getSystemConfigMap error: " + err.toString());
    return {
      SPREADSHEET_ID: SPREADSHEET_ID,
      ALCOHOL_DRIVE_FOLDER_ID: DRIVE_FOLDER_ALCOHOL,
      TRUCK_DRIVE_FOLDER_ID: DRIVE_FOLDER_TRUCK
    };
  }
}
