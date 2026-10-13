/**
 * ระบบตรวจเช็กรถบรรทุก 6 ล้อ - หจก. ทั่วไทยขนส่งมงคล
 * Google Apps Script Backend (Code.gs)
 * อ้างอิงมาตรฐานแบบฟอร์ม: ใบรายการตรวจสภาพรถบรรทุกประจำวัน (Fleet TCC ชลบุรี)
 * พร้อมระบบ PDF Generator ส่งออกไฟล์ใบตรวจเข้า Google Drive อัตโนมัติ (รายวัน & รายเดือน)
 * ลิขสิทธิ์โดย: Mr.Taweesak.kom (062-3285963)
 */

const SPREADSHEET_ID = "1JM-i8_nrGR7-VDEY82QZ5l5JMJTIBOIsuqOSQSrcD3Y";
const DRIVE_FOLDER_ID = "1ryLhwkO1lnv-2qgLbDDl0XyVaq8S2Szs";

function doGet(e) {
  if (e && e.parameter) {
    if (e.parameter.action === "verify_driver") {
      const email = (e.parameter.email || "").trim().toLowerCase();
      return responseJSON(checkDriverRegistration(email));
    }

    // ฟังก์ชันสร้างรายงานสรุปรายเดือนแบบตารางรวม Actual ประจำวัน
    if (e.parameter.action === "generate_monthly_pdf") {
      const plate = (e.parameter.plate || "").trim();
      const monthYear = (e.parameter.month || Utilities.formatDate(new Date(), "Asia/Bangkok", "MM/yyyy")).trim();
      const email = (e.parameter.email || "").trim();
      return generateMonthlyTruckInspectionPdf(plate, monthYear, email);
    }

    // ฟังก์ชันตรวจสอบแถวข้อมูลใน Truck_Inspection_Logs สำหรับดีบัก
    if (e.parameter.action === "debug_recent_logs") {
      try {
        const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
        const logSheet = ss.getSheetByName("Truck_Inspection_Logs");
        if (!logSheet) return responseJSON({ status: "error", message: "Sheet not found" });
        const lastRow = logSheet.getLastRow();
        const startRow = Math.max(2, lastRow - 9);
        const numRows = lastRow - startRow + 1;
        if (numRows <= 0) return responseJSON({ status: "success", rows: [] });
        const rows = logSheet.getRange(startRow, 1, numRows, 10).getValues();
        const result = rows.map((r, idx) => ({
          row: startRow + idx,
          rawTimestamp: r[0],
          timestampType: typeof r[0],
          isDateInstance: r[0] instanceof Date,
          parsedDate: parseInspectionDateInfo(r[0]),
          driverId: r[1],
          driverName: r[2],
          email: r[3],
          plate: r[4],
          vehicleType: r[5],
          status: r[7]
        }));
        return responseJSON({ status: "success", totalRows: lastRow, recentRows: result });
      } catch (err) {
        return responseJSON({ status: "error", message: err.toString() });
      }
    }

    // ฟังก์ชันดึงประวัติการตรวจสภาพรถทั้งหมดจาก Sheet Truck_Inspection_Logs สำหรับหน้าเว็บ Real-time
    if (e.parameter.action === "list_truck_logs" || e.parameter.action === "get_truck_logs") {
      try {
        const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
        const logSheet = ss.getSheetByName("Truck_Inspection_Logs");
        if (!logSheet) return responseJSON({ status: "error", message: "Sheet not found" });
        const lastRow = logSheet.getLastRow();
        if (lastRow <= 1) return responseJSON({ status: "success", total: 0, logs: [] });
        const lastCol = Math.max(logSheet.getLastColumn(), 18);
        const rows = logSheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
        const logs = rows.map((r, idx) => {
          let ts = r[0];
          if (ts instanceof Date) {
            ts = Utilities.formatDate(ts, "Asia/Bangkok", "dd/MM/yyyy HH:mm:ss");
          } else {
            ts = (ts || "").toString().trim();
          }
          const dateStr = ts.split(' ')[0] || '';
          const timeStr = ts.split(' ')[1] || '';
          return {
            row: idx + 2,
            timestamp: ts,
            date: dateStr,
            time: timeStr,
            driverId: (r[1] || "").toString(),
            driverName: (r[2] || "").toString(),
            email: (r[3] || "").toString(),
            vehiclePlate: (r[4] || "").toString(),
            vehicleType: (r[5] || "").toString(),
            mileage: (r[6] !== undefined && r[6] !== null && r[6] !== '') ? (r[6].toString().includes('กม.') ? r[6].toString() : r[6].toString() + ' กม.') : '',
            status: (r[7] || "พร้อมใช้งาน").toString(),
            checklist: (r[8] || "").toString(),
            defectsNote: (r[9] || "ไม่มี").toString(),
            imgDashboard: (r[10] || "").toString(),
            imgFrontVehicle: (r[11] || "").toString(),
            imgDefect1: (r[12] || "").toString(),
            imgDefect2: (r[13] || "").toString(),
            pdfUrl: (r[14] || "").toString(),
            imgSeatbeltDriver: (r[15] || "").toString(),
            imgDashcam: (r[16] || "").toString(),
            imgSeatbeltAssistant: (r[17] || "").toString(),
            remarks: (r[9] || "ไม่มี").toString()
          };
        });
        return responseJSON({ status: "success", total: logs.length, logs: logs });
      } catch (err) {
        return responseJSON({ status: "error", message: err.toString() });
      }
    }
  }

  return responseJSON({
    status: "online",
    message: "TTMK Truck Inspection API & PDF Generator is active",
    timestamp: new Date().toISOString()
  });
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.tryLock(30000);

  try {
    if (!e || !e.postData || !e.postData.contents) {
      return responseJSON({ status: "error", message: "ไม่พบข้อมูลที่ส่งเข้ามา (Empty payload)" });
    }

    const data = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

    // 1. ตรวจสอบ Driver Registration
    const driverCheck = checkDriverRegistration(data.email, ss);
    if (driverCheck.status !== "success") {
      return responseJSON(driverCheck);
    }
    const driverInfo = driverCheck.data;

    // หากเป็นการ Verify Driver ผ่าน POST
    if (data.action === "verify_driver") {
      return responseJSON({
        status: "success",
        driverName: driverInfo.name,
        data: driverInfo
      });
    }

    // หากเป็นการสั่งสร้างรายงานรายเดือนผ่าน POST
    if (data.action === "generate_monthly_pdf") {
      const targetPlate = String(data.vehiclePlate || driverInfo.plate || "");
      const targetMonth = String(data.month || Utilities.formatDate(new Date(), "Asia/Bangkok", "MM/yyyy"));
      return generateMonthlyTruckInspectionPdf(targetPlate, targetMonth, data.email);
    }

    // 2. ตรวจสอบหรือสร้าง Sheet 'Truck_Inspection_Logs'
    let logSheet = ss.getSheetByName("Truck_Inspection_Logs");
    if (!logSheet) {
      logSheet = ss.insertSheet("Truck_Inspection_Logs");
      const headers = [
        "Timestamp", "Driver_ID", "Driver_Name", "Email", "Vehicle_Plate", 
        "Vehicle_Type", "Odometer", "Overall_Status", "Checklist_Summary", "Defects_Note",
        "Img_Dashboard", "Img_Front_Body", "Img_Defects_1", "Img_Defects_2", "PDF_Report_URL",
        "Img_Seatbelt", "Img_Dashcam"
      ];
      logSheet.appendRow(headers);
      logSheet.setFrozenRows(1);
      
      const headerRange = logSheet.getRange(1, 1, 1, headers.length);
      headerRange.setBackground("#0f172a");
      headerRange.setFontColor("#38bdf8");
      headerRange.setFontWeight("bold");
    }

    // 3. จัดการอัปโหลดไฟล์ภาพเข้า Google Drive
    const folder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
    const timeCode = Utilities.formatDate(new Date(), "Asia/Bangkok", "yyyyMMdd_HHmmss");
    const photoUrls = {};
    const photoBlobs = {};

    const imageKeys = ['dashboard', 'frontVehicle', 'defect_1', 'defect_2', 'defect_3', 'seatbelt', 'seatbeltDriver', 'seatbeltAssistant', 'dashcam'];
    for (let key of imageKeys) {
      if (data.images && data.images[key] && data.images[key].includes(",")) {
        try {
          const base64Data = data.images[key].split(",")[1];
          const decodedBytes = Utilities.base64Decode(base64Data);
          const fileName = `${timeCode}_${driverInfo.driverId}_${key}.jpg`;
          const blob = Utilities.newBlob(decodedBytes, "image/jpeg", fileName);
          const file = folder.createFile(blob);
          file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
          photoUrls[key] = file.getUrl();
          photoBlobs[key] = blob;
        } catch (imgErr) {
          photoUrls[key] = "Upload Error: " + imgErr.toString();
        }
      } else {
        photoUrls[key] = "-";
      }
    }

    // 4. สร้างเอกสาร PDF รายงานแบบฟอร์มประจำวัน อัตโนมัติ
    let pdfUrl = "-";
    try {
      const pdfBlob = generateFCAM032PdfReport(data, driverInfo, photoBlobs);
      const safePlate = String(data.vehiclePlate || driverInfo.plate || "70XXXX").replace(/[^a-zA-Z0-9ก-๙]/g, '');
      const pdfFileName = `TTMK_Daily_${timeCode}_${driverInfo.driverId}_${safePlate}.pdf`;
      const pdfFile = folder.createFile(pdfBlob.setName(pdfFileName));
      pdfFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      pdfUrl = pdfFile.getUrl();
    } catch (pdfErr) {
      pdfUrl = "PDF Gen Error: " + pdfErr.toString();
    }

    // 5. บันทึกผลลง Sheet 'Truck_Inspection_Logs'
    const timestamp = Utilities.formatDate(new Date(), "Asia/Bangkok", "dd/MM/yyyy HH:mm:ss");
    const seatbeltDriverUrl = photoUrls['seatbeltDriver'] || photoUrls['seatbelt'] || "-";
    const seatbeltAssistantUrl = photoUrls['seatbeltAssistant'] || "-";
    const dashcamUrl = photoUrls['dashcam'] || "-";

    try {
      if (logSheet.getLastColumn() < 18) {
        logSheet.getRange(1, 18).setValue("Img_Seatbelt_Assistant");
      }
    } catch(e) {}

    logSheet.appendRow([
      timestamp,
      driverInfo.driverId,
      driverInfo.name,
      data.email,
      data.vehiclePlate || driverInfo.plate,
      data.vehicleType,
      data.odometer,
      data.overallStatus,
      JSON.stringify(data.checklist || []),
      data.defectsNote || "ไม่มี",
      photoUrls['dashboard'],
      photoUrls['frontVehicle'],
      photoUrls['defect_1'],
      photoUrls['defect_2'],
      pdfUrl,
      seatbeltDriverUrl,
      dashcamUrl,
      seatbeltAssistantUrl
    ]);

    // 6. อัปเดตไฟล์รายงานสรุปรายเดือน (Monthly PDF Report) หลังบ้านอัตโนมัติทันที
    // ให้มีเพียงเดือนละ 1 ไฟล์ต่อ 1 ทะเบียนรถ ไม่ซ้ำซ้อนใน Google Drive
    let monthlyPdfUrl = "-";
    try {
      const currentMonthYear = Utilities.formatDate(new Date(), "Asia/Bangkok", "MM/yyyy");
      const targetPlate = String(data.vehiclePlate || driverInfo.plate || "");
      const autoMonthlyResult = updateOrCreateMonthlyReport(targetPlate, currentMonthYear, folder, null, data.email);
      monthlyPdfUrl = autoMonthlyResult.pdfUrl || "-";
    } catch (mErr) {
      Logger.log("Auto Monthly PDF Error: " + mErr.toString());
    }

    return responseJSON({
      status: "success",
      message: `บันทึกข้อมูลและสร้างใบตรวจ PDF สำเร็จ (${driverInfo.name})`,
      driverName: driverInfo.name,
      pdfUrl: pdfUrl,
      monthlyPdfUrl: monthlyPdfUrl,
      timestamp: timestamp
    });

  } catch (err) {
    return responseJSON({ status: "error", message: "Server Error: " + err.toString() });
  } finally {
    lock.releaseLock();
  }
}

/**
 * 1. สร้างไฟล์ PDF ใบรายงานตรวจสภาพรถประจำวัน (Daily Inspection Report)
 * จัดหน้าขนาด A4 Landscape (แนวนอน) เต็มหน้ากระดาษ พร้อมกล่องภาพถ่ายความพร้อม 3 ช่องมุมบนขวา
 */
function generateFCAM032PdfReport(data, driverInfo, photoBlobs) {
  const timestamp = Utilities.formatDate(new Date(), "Asia/Bangkok", "dd/MM/yyyy HH:mm:ss");
  const plate = String(data.vehiclePlate || driverInfo.plate || "70-XXXX");
  const driverName = String(driverInfo.name || "ไม่ระบุ");
  const driverId = String(driverInfo.driverId || "EMP-N/A");
  const odo = data.odometer || "-";
  const vType = data.vehicleType || "ICE (ดีเซล/น้ำมัน)";
  const status = data.overallStatus || "พร้อมใช้งาน";
  const note = data.defectsNote || "ไม่มี";

  // --- กล่องภาพถ่ายความพร้อมในห้องโดยสาร (Pre-Departure Readiness Evidence) ---
  const hasNoAssistant = Boolean(
    data.hasNoAssistant ||
    (data.cabinReadiness && data.cabinReadiness.noAssistant)
  );

  function getImageBase64(imgOrBlob) {
    if (!imgOrBlob) return null;
    try {
      if (typeof imgOrBlob === 'string') {
        if (imgOrBlob.startsWith('data:image')) {
          return imgOrBlob;
        }
        if (imgOrBlob.length > 100 && !imgOrBlob.startsWith('http')) {
          return 'data:image/jpeg;base64,' + imgOrBlob;
        }
      } else if (imgOrBlob.getBytes) {
        return 'data:image/jpeg;base64,' + Utilities.base64Encode(imgOrBlob.getBytes());
      }
    } catch(e) {}
    return null;
  }

  const seatbeltDriverSrc = getImageBase64(
    (data.images && (data.images.seatbeltDriver || data.images.seatbelt)) ||
    (photoBlobs && (photoBlobs.seatbeltDriver || photoBlobs.seatbelt))
  );

  const seatbeltAssistantSrc = getImageBase64(
    (data.images && data.images.seatbeltAssistant) ||
    (photoBlobs && photoBlobs.seatbeltAssistant)
  );

  const dashcamSrc = getImageBase64(
    (data.images && data.images.dashcam) ||
    (photoBlobs && photoBlobs.dashcam)
  );

  let cabinPhotoBoxesHtml = "";
  if (hasNoAssistant) {
    // กรณีเที่ยวนี้ไม่มี ผขถ. -> ปรับแสดง 2 ช่องแบบเต็มพื้นที่ (เข็มขัด พขร. + กล้องหน้ารถ)
    cabinPhotoBoxesHtml = `
      <tr>
        <td style="width: 50%; border: 1px solid #94a3b8; padding: 2px; text-align: center; vertical-align: top; background: #f8fafc;">
          <div style="font-size: 8px; font-weight: bold; color: #0f172a; line-height: 1.1;">1. เข็มขัดนิรภัย พขร.</div>
          <div style="font-size: 7px; color: #b45309; margin-bottom: 2px;">(ไม่มี ผขถ. - มีเฉพาะ พขร.)</div>
          <table style="width: 100%; height: 68px; border: 1px solid #cbd5e1; background: #ffffff; border-collapse: collapse;">
            <tr>
              <td align="center" valign="middle" style="padding: 1px; height: 68px;">
                ${seatbeltDriverSrc 
                  ? `<img src="${seatbeltDriverSrc}" style="max-width: 96%; max-height: 65px; display: block; margin: 0 auto;" />`
                  : `<div style="color: #94a3b8; font-size: 7.5px; text-align: center;">[ ไม่มีภาพ ]</div>`
                }
              </td>
            </tr>
          </table>
        </td>
        <td style="width: 50%; border: 1px solid #94a3b8; padding: 2px; text-align: center; vertical-align: top; background: #f8fafc;">
          <div style="font-size: 8px; font-weight: bold; color: #0f172a; line-height: 1.1;">2. กล้องบันทึกหน้ารถ</div>
          <div style="font-size: 7px; color: #16a34a; margin-bottom: 2px;">ไฟ REC ปกติ</div>
          <table style="width: 100%; height: 68px; border: 1px solid #cbd5e1; background: #ffffff; border-collapse: collapse;">
            <tr>
              <td align="center" valign="middle" style="padding: 1px; height: 68px;">
                ${dashcamSrc 
                  ? `<img src="${dashcamSrc}" style="max-width: 96%; max-height: 65px; display: block; margin: 0 auto;" />`
                  : `<div style="color: #94a3b8; font-size: 7.5px; text-align: center;">[ ไม่มีภาพ ]</div>`
                }
              </td>
            </tr>
          </table>
        </td>
      </tr>
    `;
  } else {
    // กรณีมีทั้ง พขร. และ ผขถ. -> แสดง 3 ช่อง (เข็มขัด พขร. + เข็มขัด ผขถ. + กล้องหน้ารถ)
    cabinPhotoBoxesHtml = `
      <tr>
        <td style="width: 33.33%; border: 1px solid #94a3b8; padding: 2px; text-align: center; vertical-align: top; background: #f8fafc;">
          <div style="font-size: 7.8px; font-weight: bold; color: #0f172a; line-height: 1.1;">1. เข็มขัดนิรภัย (พขร.)</div>
          <div style="font-size: 6.8px; color: #0369a1; margin-bottom: 2px;">พนักงานขับรถ</div>
          <table style="width: 100%; height: 68px; border: 1px solid #cbd5e1; background: #ffffff; border-collapse: collapse;">
            <tr>
              <td align="center" valign="middle" style="padding: 1px; height: 68px;">
                ${seatbeltDriverSrc 
                  ? `<img src="${seatbeltDriverSrc}" style="max-width: 96%; max-height: 65px; display: block; margin: 0 auto;" />`
                  : `<div style="color: #94a3b8; font-size: 7.5px; text-align: center;">[ ไม่มีภาพ ]</div>`
                }
              </td>
            </tr>
          </table>
        </td>
        <td style="width: 33.33%; border: 1px solid #94a3b8; padding: 2px; text-align: center; vertical-align: top; background: #f8fafc;">
          <div style="font-size: 7.8px; font-weight: bold; color: #0f172a; line-height: 1.1;">2. เข็มขัดนิรภัย (ผขถ.)</div>
          <div style="font-size: 6.8px; color: #0369a1; margin-bottom: 2px;">พนักงานท้ายรถ</div>
          <table style="width: 100%; height: 68px; border: 1px solid #cbd5e1; background: #ffffff; border-collapse: collapse;">
            <tr>
              <td align="center" valign="middle" style="padding: 1px; height: 68px;">
                ${seatbeltAssistantSrc 
                  ? `<img src="${seatbeltAssistantSrc}" style="max-width: 96%; max-height: 65px; display: block; margin: 0 auto;" />`
                  : `<div style="color: #94a3b8; font-size: 7.5px; text-align: center;">[ ไม่มีภาพ ]</div>`
                }
              </td>
            </tr>
          </table>
        </td>
        <td style="width: 33.33%; border: 1px solid #94a3b8; padding: 2px; text-align: center; vertical-align: top; background: #f8fafc;">
          <div style="font-size: 7.8px; font-weight: bold; color: #0f172a; line-height: 1.1;">3. กล้องหน้ารถ</div>
          <div style="font-size: 6.8px; color: #16a34a; margin-bottom: 2px;">ไฟ REC ปกติ</div>
          <table style="width: 100%; height: 68px; border: 1px solid #cbd5e1; background: #ffffff; border-collapse: collapse;">
            <tr>
              <td align="center" valign="middle" style="padding: 1px; height: 68px;">
                ${dashcamSrc 
                  ? `<img src="${dashcamSrc}" style="max-width: 96%; max-height: 65px; display: block; margin: 0 auto;" />`
                  : `<div style="color: #94a3b8; font-size: 7.5px; text-align: center;">[ ไม่มีภาพ ]</div>`
                }
              </td>
            </tr>
          </table>
        </td>
      </tr>
    `;
  }

  // --- รายการตรวจมาตรฐาน 27 ข้อ ตามแบบฟอร์ม F-CAM-032 (เรียงลำดับ 1 ถึง 27 จากน้อยไปมาก ครบถ้วน 100%) ---
  const isEV = String(vType).includes("EV");

  const officialInspectionItems = [
    // หมวด A: สภาพรถและอุปกรณ์ทั่วไป (ข้อ 1 - 9)
    { no: 1, section: "หมวด A", title: "ระดับน้ำมันเบรคและคลัตซ์ พร้อมใช้งาน ไม่รั่วซึม" },
    { no: 2, section: "หมวด A", title: "ที่ปัดน้ำฝนและระดับน้ำฉีดกระจก พร้อมใช้งาน" },
    { no: 3, section: "หมวด A", title: "เบรคมือใช้งานได้ปกติ ล็อกแน่นหนา" },
    { no: 4, section: "หมวด A", title: "ระบบเบรคใช้งานได้ปกติ ไม่มีเสียงลมรั่ว" },
    { no: 5, section: "หมวด A", title: "Safety Belt เข็มขัดนิรภัย ใช้งานได้ปกติ ล็อกแน่นหนา" },
    { no: 6, section: "หมวด A", title: "กระจกหน้า / กระจกมองข้าง / กระจกมองหลัง / กระจกมองมุม" },
    { no: 7, section: "หมวด A", title: "ไฟส่องสว่างหน้ารถ และไฟสัญญาณพร้อมใช้งาน ไม่แตกหัก" },
    { no: 8, section: "หมวด A", title: "สภาพยางรถ 6 ล้อ (ดอกยางหน้า > 3 มม., ยางหลัง > 2 มม., น็อตแน่น)" },
    { no: 9, section: "หมวด A", title: "สัญญาณแตร ทำงานเสียงดังชัดเจน" },

    // หมวด B: อุปกรณ์มาตรฐานประจำรถ (ข้อ 10 - 17)
    { no: 10, section: "หมวด B", title: "หมอนรองล้อ 2 อัน มีประจำรถพร้อมใช้งาน" },
    { no: 11, section: "หมวด B", title: isEV ? "สภาพแบตเตอร์รี่ EV ใต้ท้องรถ เคสไม่บุบ ไม่แตกร้าว" : "กรวยยางสะท้อนแสง 2 อัน มีประจำรถพร้อมใช้งาน" },
    { no: 12, section: "หมวด B", title: isEV ? "จุดข้อต่อ, ปลั๊ก, สายไฟแรงสูงสีส้ม แน่นหนา ไม่หลุดหลวม" : "ถังดับเพลิง ขนาด 10 ปอนด์ พร้อมใช้งาน เกจ์เขียว" },
    { no: 13, section: "หมวด B", title: "กล้องหน้ารถ, กล้องในรถและเมมโมรี่การ์ด พร้อมบันทึกซ้ำ" },
    { no: 14, section: "หมวด B", title: "ไฟกระพริบฉุกเฉิน ป้ายสามเหลี่ยมสะท้อนแสง" },
    { no: 15, section: "หมวด B", title: "ระบบ GPS ทำงานปกติ ส่งสัญญาณระบุตำแหน่งได้" },
    { no: 16, section: "หมวด B", title: "ผ้าแดง (แขวนท้ายรถ) มีประจำรถพร้อมใช้งาน" },
    { no: 17, section: "หมวด B", title: "สติกเกอร์เตือน \"อย่าลืมล็อคกลอนประตูตู้\" ติดชัดเจน" },

    // หมวด C: อุปกรณ์ประจำตัว พขร. (ข้อ 18 - 21)
    { no: 18, section: "หมวด C", title: "1. เครื่องแบบบริษัท SCG JWD สวมใส่ถูกต้องเรียบร้อย" },
    { no: 19, section: "หมวด C", title: "2. รองเท้าเซฟตี้ สวมใส่พร้อมปฏิบัติงาน" },
    { no: 20, section: "หมวด C", title: "3. บัตรประจำตัวที่บริษัท SCG JWD ออกให้ พกติดตัว" },
    { no: 21, section: "หมวด C", title: "4. โทรศัพท์มือถือ แบตเตอรี่พร้อมใช้งาน" },

    // หมวด D: อุปกรณ์ประจำรถ & สภาพตู้บรรทุก (ข้อ 22 - 27)
    { no: 22, section: "หมวด D", title: "เครื่องมือประจำรถ ครบชุดพร้อมใช้งาน" },
    { no: 23, section: "หมวด D", title: "ระดับน้ำมันเครื่อง อยู่ในเกณฑ์ปกติ" },
    { no: 24, section: "หมวด D", title: isEV ? "ระดับน้ำยาหล่อเย็นระบายความร้อนระบบแบตเตอรี่ EV" : "ระดับน้ำในหม้อน้ำระบายความร้อน & ระดับน้ำแบตเตอรี่" },
    { no: 25, section: "หมวด D", title: "ผ้าใบสะอาดไม่มีรอยรั่ว, สภาพตู้อยู่ในสภาพดี ไม่บุบ ไม่เป็นรู" },
    { no: 26, section: "หมวด D", title: "พื้นรถสะอาด ไม่มีเศษกรวด หิน ดิน ทราย ไม่มีกลิ่น" },
    { no: 27, section: "หมวด D", title: isEV ? "เสื้อมอเตอร์ไฟฟ้า e-Axle ท้ายรถ & ไฟท้าย/ไฟเบรก สมบูรณ์" : "หลอดไฟท้าย/ไฟเบรก/ไฟเลี้ยวหลัง สมบูรณ์ ไม่แตก ไม่ดับ" }
  ];

  const clientChecklist = Array.isArray(data.checklist) ? data.checklist : [];

  function checkItemStatus(itemNo, itemTitle) {
    const match = clientChecklist.find(q => {
      const qNo = parseInt(q.no, 10);
      if (!isNaN(qNo) && qNo === itemNo) return true;
      const qText = String(q.text || q.question || "");
      return qText.includes(itemTitle.substring(0, 8));
    });
    if (match && match.status === "DEFECT") {
      return "DEFECT";
    }
    return "PASS";
  }

  function renderChecklistCol(items) {
    let rowsHtml = "";
    items.forEach((item, index) => {
      const isDefect = checkItemStatus(item.no, item.title) === "DEFECT";
      const icon = isDefect ? "<b style='color:#dc2626; font-size:8px;'>[X] ชำรุด</b>" : "<span style='color:#15803d; font-weight:bold; font-size:8px;'>[/] ปกติดี</span>";
      const rowBg = isDefect ? "#fee2e2" : (index % 2 === 0 ? "#f8fafc" : "#ffffff");
      rowsHtml += `
        <tr style="background-color: ${rowBg};">
          <td style="border: 1px solid #94a3b8; padding: 2px 2px; text-align: center; font-size: 8px; font-weight: bold; color: #0284c7;">${item.no}</td>
          <td style="border: 1px solid #94a3b8; padding: 2px 4px; font-size: 8px; line-height: 1.2; color: #0f172a;">${item.title}</td>
          <td style="border: 1px solid #94a3b8; padding: 2px 2px; text-align: center; font-size: 7.8px;">${icon}</td>
        </tr>
      `;
    });
    return rowsHtml;
  }

  const leftColRows = renderChecklistCol(officialInspectionItems.slice(0, 14)); // ข้อ 1 ถึง 14
  const rightColRows = renderChecklistCol(officialInspectionItems.slice(14));  // ข้อ 15 ถึง 27

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        @page {
          size: A4 landscape;
          margin: 4mm 6mm 3mm 6mm;
        }
        * {
          box-sizing: border-box;
        }
        body {
          font-family: 'Sarabun', 'TH Sarabun New', 'Garuda', 'Tahoma', sans-serif;
          color: #0f172a;
          margin: 0;
          padding: 0;
          font-size: 8px;
          line-height: 1.2;
        }
        .header-box {
          border-bottom: 2px solid #0284c7;
          padding-bottom: 2px;
          margin-bottom: 3px;
        }
        .title {
          font-size: 14px;
          font-weight: bold;
          color: #0f172a;
          margin: 0;
        }
        .sub-title {
          font-size: 8.5px;
          color: #334155;
          font-weight: bold;
          margin-top: 1px;
        }
        .info-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 8px;
        }
        .info-table td {
          padding: 2px 4px;
          border: 1px solid #94a3b8;
        }
        .info-header {
          background-color: #f1f5f9;
          font-weight: bold;
          color: #1e293b;
        }
        .check-table {
          width: 100%;
          border-collapse: collapse;
        }
        .check-table th {
          background-color: #0f172a;
          color: #ffffff;
          padding: 2.5px 3px;
          font-size: 8px;
          border: 1px solid #334155;
        }
        .footer-sign {
          width: 100%;
          margin-top: 3px;
          border-collapse: collapse;
          font-size: 8px;
        }
        .footer-sign td {
          width: 33.33%;
          text-align: center;
          padding: 3px 6px;
          border: 1px solid #94a3b8;
          background-color: #f8fafc;
        }
      </style>
    </head>
    <body>
      <div class="header-box">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="vertical-align: bottom;">
              <h1 class="title">หจก. ทั่วไทยขนส่งมงคล (TTMK LOGISTICS)</h1>
              <div class="sub-title">ใบรายการตรวจสภาพรถบรรทุก 6 ล้อ ประจำวัน (แบบฟอร์ม F-CAM-032_r3)</div>
            </td>
            <td style="text-align: right; vertical-align: bottom; font-size: 8px; color: #64748b;">
              TSM Safety Standard • ตรวจก่อนปฏิบัติหน้าที่ประจำวัน
            </td>
          </tr>
        </table>
      </div>

      <!-- ส่วนข้อมูลทั่วไป (ซ้าย 48%) + หมวดความพร้อมในห้องโดยสาร 3 กล่องภาพถ่าย (ขวา 52%) -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 3px;">
        <tr>
          <!-- ข้อมูลทั่วไป (ซ้าย 48%) -->
          <td style="width: 48%; vertical-align: top; padding-right: 3px;">
            <table class="info-table">
              <tr>
                <td class="info-header" style="width: 24%;">พนักงานขับรถ:</td>
                <td style="width: 44%;"><b>${driverName}</b> (${driverId})</td>
                <td class="info-header" style="width: 16%;">ทะเบียนรถ:</td>
                <td style="width: 16%; color: #b45309; font-weight: bold; font-size: 10px;">${plate}</td>
              </tr>
              <tr>
                <td class="info-header">วัน-เวลาที่ตรวจ:</td>
                <td>${timestamp}</td>
                <td class="info-header">เลขไมล์:</td>
                <td><b>${odo}</b> กม.</td>
              </tr>
              <tr>
                <td class="info-header">ประเภทรถ/ระบบ:</td>
                <td><b>${vType}</b></td>
                <td class="info-header">ผลประเมินรวม:</td>
                <td><b style="color: ${status === 'พร้อมใช้งาน' ? '#16a34a' : '#dc2626'}; font-size: 9px;">${status}</b></td>
              </tr>
              <tr>
                <td class="info-header">หมายเหตุแจ้งซ่อม:</td>
                <td colspan="3" style="color: #475569; font-size: 7.5px;">${note}</td>
              </tr>
            </table>
          </td>

          <!-- หมวดความพร้อมในห้องโดยสารก่อนออกรถ 3 กล่องภาพถ่าย (ขวา 52%) -->
          <td style="width: 52%; vertical-align: top; padding-left: 2px;">
            <div style="border: 1.5px solid #0284c7; border-radius: 4px; overflow: hidden; background-color: #ffffff;">
              <div style="background-color: #0f172a; color: #38bdf8; padding: 2.5px 4px; font-size: 8px; font-weight: bold; text-align: center; letter-spacing: 0.3px;">
                ★ หมวดความพร้อมในห้องโดยสารก่อนออกรถ (Pre-Departure Readiness) - TSM Standard
              </div>
              <table style="width: 100%; border-collapse: collapse; table-layout: fixed;">
                ${cabinPhotoBoxesHtml}
              </table>
            </div>
          </td>
        </tr>
      </table>

      <!-- ตารางรายการตรวจสภาพรถ 2 คอลัมน์ (ซ้าย-ขวา) เต็มหน้ากระดาษแนวนอน -->
      <table style="width: 100%; border-collapse: collapse; margin-top: 1px;">
        <tr>
          <!-- คอลัมน์ซ้าย (ข้อ 1 ถึง 14) -->
          <td style="width: 50%; vertical-align: top; padding-right: 2px;">
            <table class="check-table">
              <thead>
                <tr>
                  <th style="width: 7%;">ข้อ</th>
                  <th style="width: 75%;">รายการตรวจสภาพรถบรรทุกประจำวัน (ข้อ 1 - 14)</th>
                  <th style="width: 18%;">ผลตรวจ</th>
                </tr>
              </thead>
              <tbody>
                ${leftColRows}
              </tbody>
            </table>
          </td>

          <!-- คอลัมน์ขวา (ข้อ 15 ถึง 27) -->
          <td style="width: 50%; vertical-align: top; padding-left: 2px;">
            <table class="check-table">
              <thead>
                <tr>
                  <th style="width: 7%;">ข้อ</th>
                  <th style="width: 75%;">รายการตรวจสภาพรถบรรทุกประจำวัน (ข้อ 15 - 27)</th>
                  <th style="width: 18%;">ผลตรวจ</th>
                </tr>
              </thead>
              <tbody>
                ${rightColRows}
              </tbody>
            </table>
          </td>
        </tr>
      </table>

      <!-- ส่วนลงชื่อท้ายเอกสาร -->
      <table class="footer-sign">
        <tr>
          <td>
            ลงชื่อ ...................................................<br>
            ( <b>${driverName}</b> )<br>
            พนักงานขับรถผู้ตรวจ
          </td>
          <td>
            ลงชื่อ ...................................................<br>
            ( ................................................... )<br>
            หัวหน้างาน / ผู้ตรวจสอบ (Spot Check)
          </td>
          <td>
            ลงชื่อ ...................................................<br>
            ( <b>นางสาว.นิชานันท์ เอื้อจิรพรชัย</b> )<br>
            ผู้รับเหมาขนส่ง / TTMK
          </td>
        </tr>
      </table>
      <div style="text-align: right; font-size: 7px; color: #94a3b8; margin-top: 2px;">
        &copy; copyright , Mr.Taweesak.kom (0623285963) • TTMK Safety Logistics System
      </div>
    </body>
    </html>
  `;

  return Utilities.newBlob(htmlContent, 'text/html', 'report.html').getAs('application/pdf');
}

/**
 * ฟังก์ชันช่วยแปลงและตรวจสอบวันเดือนปีจากข้อมูลใน Sheet
 * รองรับทั้ง Date object, dd/MM/yyyy, yyyy-MM-dd, พ.ศ. (ปี 25xx) และ ค.ศ. (20xx)
 */
function parseInspectionDateInfo(rawVal) {
  if (!rawVal) return null;
  let d = null;
  let m = null;
  let y = null;

  if (rawVal instanceof Date) {
    if (isNaN(rawVal.getTime())) return null;
    const dStr = Utilities.formatDate(rawVal, "Asia/Bangkok", "d/M/yyyy");
    const p = dStr.split('/');
    d = parseInt(p[0], 10);
    m = parseInt(p[1], 10);
    y = parseInt(p[2], 10);
  } else {
    const str = String(rawVal).trim();
    const dmy = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if (dmy) {
      d = parseInt(dmy[1], 10);
      m = parseInt(dmy[2], 10);
      y = parseInt(dmy[3], 10);
    } else {
      const ymd = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
      if (ymd) {
        y = parseInt(ymd[1], 10);
        m = parseInt(ymd[2], 10);
        d = parseInt(ymd[3], 10);
      } else {
        const dt = new Date(str);
        if (!isNaN(dt.getTime())) {
          const dStr = Utilities.formatDate(dt, "Asia/Bangkok", "d/M/yyyy");
          const p = dStr.split('/');
          d = parseInt(p[0], 10);
          m = parseInt(p[1], 10);
          y = parseInt(p[2], 10);
        }
      }
    }
  }

  if (d === null || m === null || y === null) return null;

  // หากเป็นปี พ.ศ. (เช่น 2569) ให้แปลงเป็น ค.ศ. (2026) เพื่อให้ตรงมาตรฐานเดียวกันเสมอ
  if (y > 2400) {
    y = y - 543;
  }

  return {
    day: d,
    month: m,
    year: y,
    dateStr: Utilities.formatString("%02d/%02d/%d", d, m, y)
  };
}

/**
 * 2. สร้าง HTML รายงานสรุปรายเดือนแบบแนวนอน (A4 Landscape)
 * ตามแบบฟอร์มมาตรฐาน Excel (Sheet: daily Checklist)
 */
function buildMonthlyReportHtml(targetPlate, targetMonthYear, ssInstance, optionalEmail) {
  const ss = ssInstance || SpreadsheetApp.openById(SPREADSHEET_ID);
  const logSheet = ss.getSheetByName("Truck_Inspection_Logs");
  if (!logSheet) return null;

  const logData = logSheet.getDataRange().getValues();

  // แปลงเดือนและปีเป้าหมาย (เช่น "10/2026" หรือ "10/2569" หรือ "10")
  let targetMonth = null;
  let targetYear = null;
  if (typeof targetMonthYear === 'string') {
    const parts = targetMonthYear.split(/[\/\-]/);
    if (parts.length === 2) {
      if (parts[0].length === 4) {
        targetYear = parseInt(parts[0], 10);
        targetMonth = parseInt(parts[1], 10);
      } else {
        targetMonth = parseInt(parts[0], 10);
        targetYear = parseInt(parts[1], 10);
      }
    } else if (parts.length === 1 && parts[0]) {
      targetMonth = parseInt(parts[0], 10);
    }
  }
  if (!targetMonth || !targetYear) {
    const now = new Date();
    if (!targetMonth) targetMonth = now.getMonth() + 1;
    if (!targetYear) targetYear = now.getFullYear();
  }

  // ปรับปีเป้าหมายเป็น ค.ศ. หากผู้ใช้ระบุเป็น พ.ศ.
  if (targetYear > 2400) {
    targetYear = targetYear - 543;
  }

  const cleanTargetPlate = (targetPlate || "").replace(/[^a-zA-Z0-9ก-๙]/g, '').toLowerCase();
  const cleanEmail = (optionalEmail || "").trim().toLowerCase();

  const dailyInspections = {}; // { [day]: { status, driverName, plate, dateStr, checklist } }
  let matchedDriverName = "-";
  let matchedPlate = targetPlate || "-";

  for (let i = 1; i < logData.length; i++) {
    const rawDate = logData[i][0];
    const dmy = parseInspectionDateInfo(rawDate);
    if (!dmy) continue;

    // ตรวจสอบเดือนและปี (รองรับทั้งปี ค.ศ. และเทียบเคียงเดือน)
    if (dmy.month !== targetMonth) continue;
    if (targetYear && dmy.year !== targetYear) continue;

    const rowPlateRaw = String(logData[i][4] || "");
    const rowPlateClean = rowPlateRaw.replace(/[^a-zA-Z0-9ก-๙]/g, '').toLowerCase();
    const rowEmail = String(logData[i][3] || "").trim().toLowerCase();

    // ตรวจสอบการจับคู่รถหรือคนขับ
    const isMatch = !cleanTargetPlate ||
                    rowPlateClean.includes(cleanTargetPlate) ||
                    cleanTargetPlate.includes(rowPlateClean) ||
                    (cleanEmail && rowEmail === cleanEmail);

    if (isMatch) {
      if (logData[i][2]) matchedDriverName = String(logData[i][2]);
      if (rowPlateRaw) matchedPlate = rowPlateRaw;

      let parsedChecklist = [];
      try {
        parsedChecklist = JSON.parse(logData[i][8] || "[]");
      } catch(e) {}

      const isPass = (logData[i][7] === "พร้อมใช้งาน");

      dailyInspections[dmy.day] = {
        status: isPass ? "PASS" : "DEFECT",
        driverName: logData[i][2] || matchedDriverName,
        plate: rowPlateRaw || matchedPlate,
        odometer: logData[i][6],
        dateStr: dmy.dateStr,
        checklist: parsedChecklist
      };
    }
  }

  // คำนวณข้อมูลสำหรับรอบตรวจรายสัปดาห์ (Section D)
  // สัปดาห์ที่ 1: วันที่ 1-7
  // สัปดาห์ที่ 2: วันที่ 8-14
  // สัปดาห์ที่ 3: วันที่ 15-21
  // สัปดาห์ที่ 4: วันที่ 22-31
  const weekInfo = {
    1: { dateStr: "", status: "" },
    2: { dateStr: "", status: "" },
    3: { dateStr: "", status: "" },
    4: { dateStr: "", status: "" }
  };

  for (let d = 1; d <= 31; d++) {
    if (dailyInspections[d]) {
      let w = 1;
      if (d >= 1 && d <= 7) w = 1;
      else if (d >= 8 && d <= 14) w = 2;
      else if (d >= 15 && d <= 21) w = 3;
      else w = 4;

      if (!weekInfo[w].dateStr) {
        weekInfo[w].dateStr = dailyInspections[d].dateStr;
        weekInfo[w].status = dailyInspections[d].status;
      }
    }
  }

  // รายการตรวจ A, B, C ตาม Excel Template
  const sectionA = [
    { no: "1", title: "ระดับน้ำมันเบรคและคลัตซ์ พร้อมใช้งาน", major: true },
    { no: "2", title: "ที่ปัดน้ำฝนพร้อมใช้งาน", major: true },
    { no: "3", title: "เบรคมือใช้งานได้ปกติ", major: true },
    { no: "4", title: "ระบบเบรคใช้งานได้ปกติ", major: true },
    { no: "5", title: "Safety Belt เข็มขัดนิรภัย ใช้งานได้ปกติ", major: true },
    { no: "6", title: "กระจกหน้า / กระจกมองข้าง / กระจกมองหลัง / กระจกมองมุม", major: true },
    { no: "7", title: "ไฟส่องสว่างหน้ารถ และไฟสัญญาณพร้อมใช้งาน", major: true },
    { no: "8", title: "สภาพยางรถ (งดจ่ายงานกรณีสภาพยางล้อหน้าไม่ผ่าน)", major: true },
    { no: "9", title: "สัญญาณแตร", major: true },
    { no: "10", title: "กล้องถอยหลัง (ถ้ามี)", major: true },
    { no: "11", title: "สภาพแบตเตอร์รี่ EV", major: true, isEV: true },
    { no: "12", title: "จุดข้อต่อ , ปลั๊ก , สายไฟ ที่ต่อจากแบตเตอร์รี่", major: true, isEV: true },
    { no: "13", title: "ตรวจเช็คไฟหน้าปัด , ไม่มี ไฟโชว์ ผิดปกติ", major: true, isEV: true }
  ];

  const sectionB = [
    { no: "10", title: "หมอนรองล้อ 2 อัน", major: true },
    { no: "11", title: "กรวยยางสะท้อนแสง 2 อัน", major: true },
    { no: "12", title: "ถังดับเพลิง ขนาด 10 ปอนด์ พร้อมใช้งาน", major: true },
    { no: "13", title: "กล้องหน้ารถ,กล้องในรถและเมมโมรี่การ์ด พร้อมใช้งาน และมีการบันทึกซ้ำ", major: true },
    { no: "14", title: "ไฟกระพริบฉุกเฉิน ป้ายสามเหลี่ยม", major: true },
    { no: "15", title: "GPS", major: true },
    { no: "16", title: "ผ้าแดง(แขวนท้ายรถ)", major: true },
    { no: "17", title: "สติกเกอร์เตือน \" อย่าลืมล็อคกลอนประตูตู้ \"", major: false }
  ];

  const sectionC = [
    { no: "18", title: "1. เครื่องแบบบริษัท SCG JWD", major: false },
    { no: "19", title: "2. รองเท้าเซฟตี้", major: false },
    { no: "20", title: "3. บัตรประจำตัวที่บริษัท SCG JWD ออกให้", major: false },
    { no: "21", title: "4. โทรศัพท์มือถือ", major: false }
  ];

  const sectionCabin = [
    { no: "P1", title: "Safety Belt เข็มขัดนิรภัย คาดเรียบร้อย (พขร. & ผขถ.)", major: true, isCabin: true },
    { no: "P2", title: "กล้องหน้ารถขณะสตาร์ตเครื่อง ไฟ REC พร้อมทำงานบันทึกตลอดทาง", major: true, isCabin: true },
    { no: "P3", title: "ภาพถ่ายหลักฐานความพร้อมในห้องโดยสารครบถ้วนตามเกณฑ์ TSM", major: true, isCabin: true }
  ];

  const sectionD = [
    { no: "22", title: "เครื่องมือประจำรถ" },
    { no: "23", title: "ระดับน้ำมันเครื่อง" },
    { no: "24", title: "ระดับน้ำแบตเตอรี่" },
    { no: "25", title: "ผ้าใบสะอาดไม่มีรอยรั่ว,สภาพตู้อยู่ในสภาพดี , ไม่บุบ , ไม่เป็นรู,พื้นรถสะอาด" },
    { no: "26", title: "พื้นรถสะอาด ไม่มีเศษกรวด หิน ดิน ทรายไม่มีกลิ่น" },
    { no: "27", title: "หลอดไฟอยู่ในสภาพสมบูรณ์ ไม่แตก,ไม่ดับ" }
  ];

  // Helper สำหรับสร้างเครื่องหมายในแต่ละเซลล์วันที่
  function renderCellMark(dayInsp, item) {
    if (!dayInsp) return "";
    if (item.isCabin) {
      if (dayInsp.status === "PASS") {
        return `<span style="color:#15803d; font-weight:bold; font-size:8.5px;">✓</span>`;
      }
      return `<span style="color:#b91c1c; font-weight:bold; font-size:8.5px;">✗</span>`;
    }
    if (dayInsp.status === "PASS") {
      return `<span style="color:#15803d; font-weight:bold; font-size:8.5px;">/</span>`;
    }
    if (dayInsp.checklist && dayInsp.checklist.length > 0) {
      const match = dayInsp.checklist.find(q => {
        const qNo = String(q.no || "");
        const qText = String(q.question || "");
        return qNo === String(item.no) || qText.includes(item.title.substring(0, 8));
      });
      if (match && match.status === "DEFECT") {
        return `<span style="color:#b91c1c; font-weight:bold; font-size:8.5px;">X</span>`;
      }
    }
    return `<span style="color:#15803d; font-weight:bold; font-size:8.5px;">/</span>`;
  }

  // สร้าง Header วันที่ 1 ถึง 31
  let dayHeadersHtml = "";
  let dashRowHtml = "";
  for (let d = 1; d <= 31; d++) {
    dayHeadersHtml += `<th style="width: 1.8%; font-size: 7.5px; padding: 2px 0; border: 1px solid #475569; text-align: center;">${d}</th>`;
    dashRowHtml += `<td style="border: 1px solid #475569; text-align: center; color: #94a3b8; font-size: 7.5px;">-</td>`;
  }

  // สร้างแถวเนื้อหาของตาราง
  function renderSectionRows(items) {
    let html = "";
    items.forEach((item, idx) => {
      const isAlt = idx % 2 === 1;
      const rowBg = isAlt ? "#f8fafc" : "#ffffff";
      const titleStyle = item.isCabin ? "color: #0369a1; font-weight: bold;" : (item.isEV ? "color: #b91c1c; font-weight: bold;" : "color: #0f172a;");
      const majorMark = item.major ? `<span style="color: #dc2626; font-weight: bold; font-size: 8.5px;">✓</span>` : `-`;

      let cells = "";
      for (let d = 1; d <= 31; d++) {
        const mark = renderCellMark(dailyInspections[d], item);
        cells += `<td style="text-align: center; font-size: 8px; padding: 0.5px 0; border: 1px solid #94a3b8;">${mark}</td>`;
      }

      html += `
        <tr style="background-color: ${rowBg};">
          <td style="text-align: center; font-size: 8px; padding: 1.2px 1px; border: 1px solid #94a3b8; font-weight: bold;">${item.no}</td>
          <td style="font-size: 8px; padding: 1.2px 3px; border: 1px solid #94a3b8; white-space: nowrap; ${titleStyle}">${item.title}</td>
          <td style="text-align: center; font-size: 8px; padding: 1.2px 0; border: 1px solid #94a3b8;">${majorMark}</td>
          ${cells}
          <td style="border: 1px solid #94a3b8; font-size: 7px; text-align: center;"></td>
          <td style="border: 1px solid #94a3b8; font-size: 7px; text-align: center;"></td>
        </tr>
      `;
    });
    return html;
  }

  // แถวลงชื่อใต้ Section C
  let driverSignCells = "";
  let supervisorSignCells = "";
  for (let d = 1; d <= 31; d++) {
    if (dailyInspections[d]) {
      driverSignCells += `<td style="text-align: center; font-size: 7px; padding: 0.5px 0; border: 1px solid #94a3b8; color: #0284c7; font-weight: bold;">✓</td>`;
      supervisorSignCells += `<td style="text-align: center; font-size: 7px; padding: 0.5px 0; border: 1px solid #94a3b8; color: #475569;">✓</td>`;
    } else {
      driverSignCells += `<td style="border: 1px solid #94a3b8;"></td>`;
      supervisorSignCells += `<td style="border: 1px solid #94a3b8;"></td>`;
    }
  }

  // แถวตรวจประจำสัปดาห์ (Section D)
  let weeklyRowsHtml = "";
  sectionD.forEach((wItem, idx) => {
    const rowBg = idx % 2 === 1 ? "#f8fafc" : "#ffffff";
    let weekCells = "";
    for (let w = 1; w <= 4; w++) {
      let mark = "";
      if (weekInfo[w].status === "PASS") {
        mark = `<span style="color:#15803d; font-weight:bold; font-size:8.5px;">/</span>`;
      } else if (weekInfo[w].status === "DEFECT") {
        mark = `<span style="color:#b91c1c; font-weight:bold; font-size:8.5px;">X</span>`;
      }
      weekCells += `<td style="text-align: center; border: 1px solid #94a3b8; padding: 1.5px 2px;">${mark}</td>`;
    }

    weeklyRowsHtml += `
      <tr style="background-color: ${rowBg};">
        <td style="text-align: center; font-size: 8px; padding: 1.5px 1px; border: 1px solid #94a3b8; font-weight: bold;">${wItem.no}</td>
        <td style="font-size: 8px; padding: 1.5px 4px; border: 1px solid #94a3b8; color: #0f172a;">${wItem.title}</td>
        ${weekCells}
        <td style="border: 1px solid #94a3b8; text-align: center; font-size: 7.5px;"></td>
      </tr>
    `;
  });

  const tireSvgHtml = `
    <div style="text-align: center; padding: 1px 0;">
      <svg width="85" height="40" viewBox="0 0 100 48" style="display: inline-block;">
        <rect x="25" y="5" width="50" height="2" fill="#64748b" />
        <rect x="18" y="2" width="7" height="8" rx="1" fill="#1e293b" />
        <rect x="75" y="2" width="7" height="8" rx="1" fill="#1e293b" />
        <text x="3" y="8" font-size="5" fill="#334155">3 มม.</text>
        <text x="83" y="8" font-size="5" fill="#334155">3 มม.</text>
        <line x1="50" y1="7" x2="50" y2="30" stroke="#94a3b8" stroke-width="1.5" />
        <rect x="20" y="30" width="60" height="2" fill="#64748b" />
        <rect x="11" y="26" width="6" height="9" rx="1" fill="#1e293b" />
        <rect x="18" y="26" width="6" height="9" rx="1" fill="#1e293b" />
        <rect x="76" y="26" width="6" height="9" rx="1" fill="#1e293b" />
        <rect x="83" y="26" width="6" height="9" rx="1" fill="#1e293b" />
        <text x="0" y="33" font-size="5" fill="#334155">2 มม.</text>
        <text x="90" y="33" font-size="5" fill="#334155">2 มม.</text>
        <text x="50" y="44" font-size="4.5" fill="#475569" text-anchor="middle">ผังวัดความลึกดอกยาง 6 ล้อ</text>
      </svg>
    </div>
  `;

  weeklyRowsHtml += `
    <tr style="background-color: #ffffff;">
      <td style="text-align: center; font-size: 7.5px; border: 1px solid #94a3b8; font-weight: bold;">ผัง</td>
      <td style="font-size: 7.5px; padding: 1px 4px; border: 1px solid #94a3b8; color: #475569;">
        <b>ผังตรวจดอกยาง 6 ล้อ (ประจำสัปดาห์):</b><br>
        <span style="font-size: 7px; color: #64748b;">(ล้อหน้า &ge; 3 มม., ล้อหลัง &ge; 2 มม.)</span>
      </td>
      <td style="border: 1px solid #94a3b8; vertical-align: middle;">${tireSvgHtml}</td>
      <td style="border: 1px solid #94a3b8; vertical-align: middle;">${tireSvgHtml}</td>
      <td style="border: 1px solid #94a3b8; vertical-align: middle;">${tireSvgHtml}</td>
      <td style="border: 1px solid #94a3b8; vertical-align: middle;">${tireSvgHtml}</td>
      <td style="border: 1px solid #94a3b8; vertical-align: middle;">${tireSvgHtml}</td>
    </tr>
  `;

  const monthDisplayStr = Utilities.formatString("%02d/%d", targetMonth, targetYear);
  const plateDisplayStr = matchedPlate || targetPlate || "-";

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        @page {
          size: A4 landscape;
          margin: 4mm 5mm 3mm 5mm;
        }
        * {
          box-sizing: border-box;
        }
        body {
          font-family: 'Sarabun', 'TH Sarabun New', 'Garuda', 'Tahoma', sans-serif;
          color: #0f172a;
          margin: 0;
          padding: 0;
          font-size: 8px;
          line-height: 1.18;
        }
        .main-matrix {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 2px;
        }
        .weekly-matrix {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 2px;
        }
        .sec-header {
          background-color: #1e293b;
          color: #ffffff;
          font-weight: bold;
          font-size: 8px;
        }
        .sec-header td {
          border: 1px solid #475569;
          padding: 1.5px 3px;
        }
        .sign-table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 2px;
          font-size: 8px;
        }
        .sign-table td {
          width: 33.33%;
          text-align: center;
          padding: 2.5px 6px;
          border: 1px solid #94a3b8;
          background-color: #f8fafc;
        }
      </style>
    </head>
    <body>

      <!-- ส่วนหัวกระดาษแบบฟอร์ม -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 2px;">
        <tr>
          <td style="width: 52%; vertical-align: top;">
            <div style="font-size: 13px; font-weight: bold; color: #0f172a;">ใบรายการตรวจสภาพรถบรรทุกประจำวัน</div>
            <div style="font-size: 8px; margin-top: 1px; color: #334155;">
              ประเภทรถ: &nbsp;&nbsp; [ &nbsp; ] ปิคอัพ &nbsp;&nbsp;&nbsp;&nbsp; [ <b style="color: #0f172a;">✓</b> ] <b>6 ล้อ</b> &nbsp;&nbsp;&nbsp;&nbsp; [ &nbsp; ] 10 ล้อ &nbsp;&nbsp;&nbsp;&nbsp; [ &nbsp; ] 18 ล้อ
            </div>
            <div style="font-size: 7.5px; color: #475569; margin-top: 1px;">
              สัญลักษณ์: <b style="color: #15803d;">/</b> = ดี (ปกติ) &nbsp;|&nbsp; <b style="color: #b91c1c;">X</b> = บกพร่อง (ต้องซ่อม)
            </div>
          </td>
          <td style="width: 48%; text-align: right; vertical-align: top; font-size: 8px; line-height: 1.25;">
            <div>ประจำเดือน: <b style="font-size: 9.5px; color: #0f172a;">${monthDisplayStr}</b> &nbsp;|&nbsp; ทะเบียนรถ: <b style="font-size: 10px; color: #b45309;">${plateDisplayStr}</b></div>
            <div>พนักงานขับรถ (พขร.): <b>${matchedDriverName}</b></div>
            <div>ผู้รับเหมาขนส่ง / TTMK: <b>นางสาว.นิชานันท์ เอื้อจิรพรชัย</b></div>
          </td>
        </tr>
      </table>

      <!-- ตารางตรวจรายวัน Matrix วันที่ 1 - 31 -->
      <table class="main-matrix">
        <thead>
          <tr style="background-color: #0f172a; color: #ffffff;">
            <th style="width: 2.2%; font-size: 7.5px; padding: 2px 1px; border: 1px solid #475569; text-align: center;">ลำดับ</th>
            <th style="width: 28%; font-size: 8px; padding: 2px 3px; border: 1px solid #475569; text-align: left;">รายการตรวจสภาพรถบรรทุกประจำวัน</th>
            <th style="width: 2.6%; font-size: 7.5px; padding: 2px 1px; border: 1px solid #475569; text-align: center;">Major</th>
            ${dayHeadersHtml}
            <th style="width: 5.6%; font-size: 7px; padding: 2px 1px; border: 1px solid #475569; text-align: center;">วันกำหนดแก้ไข</th>
            <th style="width: 5.6%; font-size: 7px; padding: 2px 1px; border: 1px solid #475569; text-align: center;">Spot Check</th>
          </tr>
        </thead>
        <tbody>
          <!-- หมวด A -->
          <tr class="sec-header">
            <td style="text-align: center; font-weight: bold;">A</td>
            <td colspan="2">A. สภาพรถและอุปกรณ์ทั่วไป</td>
            ${dashRowHtml}
            <td></td>
            <td></td>
          </tr>
          ${renderSectionRows(sectionA)}

          <!-- หมวด B -->
          <tr class="sec-header">
            <td style="text-align: center; font-weight: bold;">B</td>
            <td colspan="2">B. อุปกรณ์มาตรฐานประจำรถ</td>
            ${dashRowHtml}
            <td></td>
            <td></td>
          </tr>
          ${renderSectionRows(sectionB)}

          <!-- หมวด C -->
          <tr class="sec-header">
            <td style="text-align: center; font-weight: bold;">C</td>
            <td colspan="2">C. อุปกรณ์ประจำตัว พขร.</td>
            ${dashRowHtml}
            <td></td>
            <td></td>
          </tr>
          ${renderSectionRows(sectionC)}

          <!-- หมวดความพร้อมในห้องโดยสารก่อนออกรถ -->
          <tr class="sec-header" style="background-color: #0284c7; color: #ffffff;">
            <td style="text-align: center; font-weight: bold; font-size: 8.5px;">★</td>
            <td colspan="2" style="font-weight: bold; font-size: 8.5px; letter-spacing: 0.3px;">★ หมวดความพร้อมในห้องโดยสารก่อนออกรถ (Pre-Departure Readiness) - TSM Standard</td>
            ${dashRowHtml}
            <td></td>
            <td></td>
          </tr>
          ${renderSectionRows(sectionCabin)}

          <!-- แถวลงชื่อ พขร. รายวัน -->
          <tr style="background-color: #f1f5f9; font-weight: bold;">
            <td style="border: 1px solid #94a3b8;"></td>
            <td colspan="2" style="font-size: 7.5px; padding: 1.5px 3px; border: 1px solid #94a3b8; color: #0f172a;">พนักงานขับรถ ลงชื่อตรวจ</td>
            ${driverSignCells}
            <td style="border: 1px solid #94a3b8;"></td>
            <td style="border: 1px solid #94a3b8;"></td>
          </tr>

          <!-- แถวลงชื่อ ผู้รับเหมา / SCG JWD รายวัน -->
          <tr style="background-color: #ffffff;">
            <td style="border: 1px solid #94a3b8;"></td>
            <td colspan="2" style="font-size: 7.5px; padding: 1.5px 3px; border: 1px solid #94a3b8; color: #475569;">ผู้รับเหมา / SCG JWD ลงชื่อตรวจสอบ</td>
            ${supervisorSignCells}
            <td style="border: 1px solid #94a3b8;"></td>
            <td style="border: 1px solid #94a3b8;"></td>
          </tr>
        </tbody>
      </table>

      <!-- ตารางตรวจรายสัปดาห์ (Section D) -->
      <table class="weekly-matrix">
        <thead>
          <tr style="background-color: #0f172a; color: #ffffff;">
            <th style="width: 2.2%; font-size: 7.5px; padding: 1.5px 1px; border: 1px solid #475569; text-align: center;">ลำดับ</th>
            <th style="width: 30.6%; font-size: 8px; padding: 1.5px 4px; border: 1px solid #475569; text-align: left;">รายการตรวจสภาพรถบรรทุกประจำสัปดาห์</th>
            <th style="width: 14%; font-size: 7.5px; padding: 1.5px 2px; border: 1px solid #475569; text-align: center;">สัปดาห์ที่ 1 ${weekInfo[1].dateStr ? 'วันที่ ' + weekInfo[1].dateStr : 'วันที่ ………………'}</th>
            <th style="width: 14%; font-size: 7.5px; padding: 1.5px 2px; border: 1px solid #475569; text-align: center;">สัปดาห์ที่ 2 ${weekInfo[2].dateStr ? 'วันที่ ' + weekInfo[2].dateStr : 'วันที่ ………………'}</th>
            <th style="width: 14%; font-size: 7.5px; padding: 1.5px 2px; border: 1px solid #475569; text-align: center;">สัปดาห์ที่ 3 ${weekInfo[3].dateStr ? 'วันที่ ' + weekInfo[3].dateStr : 'วันที่ ………………'}</th>
            <th style="width: 14%; font-size: 7.5px; padding: 1.5px 2px; border: 1px solid #475569; text-align: center;">สัปดาห์ที่ 4 ${weekInfo[4].dateStr ? 'วันที่ ' + weekInfo[4].dateStr : 'วันที่ ………………'}</th>
            <th style="width: 11.2%; font-size: 7.5px; padding: 1.5px 2px; border: 1px solid #475569; text-align: center;">Spot Check</th>
          </tr>
        </thead>
        <tbody>
          ${weeklyRowsHtml}
        </tbody>
      </table>

      <!-- ส่วนลงชื่อสรุปท้ายเอกสาร -->
      <table class="sign-table">
        <tr>
          <td>
            ลงชื่อ ...................................................<br>
            ( <b>${matchedDriverName}</b> )<br>
            พนักงานขับรถประจำคัน
          </td>
          <td>
            ลงชื่อ ...................................................<br>
            ( ................................................... )<br>
            หัวหน้างาน / ผู้ตรวจสอบ (Spot Check)
          </td>
          <td>
            ลงชื่อ ...................................................<br>
            ( <b>นางสาว.นิชานันท์ เอื้อจิรพรชัย</b> )<br>
            ผู้รับเหมาขนส่ง / TTMK
          </td>
        </tr>
      </table>

      <!-- ลิขสิทธิ์ผู้พัฒนา -->
      <div style="text-align: right; font-size: 6.5px; color: #94a3b8; margin-top: 1px;">
        &copy; copyright , Mr.Taweesak.kom (0623285963)
      </div>

    </body>
    </html>
  `;
}

/**
 * 3. ฟังก์ชันสร้างหรืออัปเดตไฟล์รายงานสรุปรายเดือนใน Google Drive
 * โดยรักษาเงื่อนไข: ให้มีเพียง 1 ไฟล์ต่อเดือนต่อ 1 ทะเบียนรถ ไม่สร้างซ้ำซ้อน
 */
function updateOrCreateMonthlyReport(targetPlate, targetMonthYear, folderInstance, prebuiltHtml, optionalEmail) {
  try {
    const folder = folderInstance || DriveApp.getFolderById(DRIVE_FOLDER_ID);
    let monthlyHtml = prebuiltHtml;

    if (!monthlyHtml) {
      monthlyHtml = buildMonthlyReportHtml(targetPlate, targetMonthYear, null, optionalEmail);
      if (!monthlyHtml) {
        return { status: "error", message: "ไม่สามารถสร้างเอกสารสรุปรายเดือนได้ (ไม่พบข้อมูล Sheet)" };
      }
    }

    const pdfBlob = Utilities.newBlob(monthlyHtml, 'text/html', 'monthly.html').getAs('application/pdf');
    const safePlate = (targetPlate || "").replace(/[^a-zA-Z0-9ก-๙]/g, '') || "TRUCK";
    const cleanMonth = targetMonthYear.replace(/[^0-9]/g, '');
    const fileName = `TTMK_Monthly_${cleanMonth}_${safePlate}.pdf`;

    // ตรวจสอบว่ามีไฟล์ชื่อนี้ใน Google Drive แล้วหรือไม่
    // ถ้ามีอยู่แล้ว ให้ลบไฟล์เก่าทิ้ง เพื่อแทนที่ด้วยไฟล์อัปเดตล่าสุด (เดือนละ 1 ไฟล์ ไม่ซ้ำกัน)
    const existingFiles = folder.getFilesByName(fileName);
    while (existingFiles.hasNext()) {
      const oldFile = existingFiles.next();
      oldFile.setTrashed(true);
    }

    const pdfFile = folder.createFile(pdfBlob.setName(fileName));
    pdfFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    return {
      status: "success",
      message: `บันทึกรายงานสรุปรายเดือนสำเร็จ (${targetPlate})`,
      pdfUrl: pdfFile.getUrl(),
      fileName: fileName
    };

  } catch(e) {
    return { status: "error", message: e.toString() };
  }
}

/**
 * Endpoint สำหรับเรียกสร้างรายงานสรุปรายเดือน
 */
function generateMonthlyTruckInspectionPdf(targetPlate, targetMonthYear, optionalEmail) {
  try {
    const result = updateOrCreateMonthlyReport(targetPlate, targetMonthYear, null, null, optionalEmail);
    return responseJSON(result);
  } catch(err) {
    return responseJSON({ status: "error", message: "Monthly PDF Error: " + err.toString() });
  }
}

function checkDriverRegistration(email, spreadsheetInstance) {
  try {
    const ss = spreadsheetInstance || SpreadsheetApp.openById(SPREADSHEET_ID);
    const regSheet = ss.getSheetByName("Registered_Drivers");
    if (!regSheet) {
      return { status: "error", message: "ไม่พบ Sheet 'Registered_Drivers' ในระบบฐานข้อมูล" };
    }

    const regData = regSheet.getDataRange().getValues();
    const targetEmail = (email || "").toString().trim().toLowerCase();

    for (let i = 1; i < regData.length; i++) {
      const emailInSheet = (regData[i][2] || "").toString().trim().toLowerCase();
      if (emailInSheet === targetEmail) {
        const status = (regData[i][6] || "ACTIVE").toString().trim().toUpperCase();
        if (status !== "ACTIVE") {
          return { status: "error", message: "บัญชีของท่านถูกระงับ (Status ไม่ใช่ ACTIVE)" };
        }
        return {
          status: "success",
          data: {
            driverId: regData[i][0] || "EMP-N/A",
            name: regData[i][1] || "ไม่ระบุชื่อ",
            email: regData[i][2],
            phone: regData[i][3] || "-",
            plate: regData[i][4] || ""
          }
        };
      }
    }

    return { 
      status: "error", 
      message: `อีเมล [${email}] ยังไม่ได้ลงทะเบียนในระบบ Registered_Drivers กรุณาติดต่อแอดมิน` 
    };
  } catch (e) {
    return { status: "error", message: e.toString() };
  }
}

function responseJSON(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
