/**
 * =========================================================================
 * GOOGLE APPS SCRIPT: TTMK ROUTE PLANNING & FLEET REST STOPS ENGINE
 * ระบบวางแผนการเดินรถ จุดพักรถมาตรฐาน SCGJWD และจัดเก็บหลักฐาน Google Drive
 * 
 * หจก. ทั่วไทยขนส่งมงคล (TTMK Transport & Logistics)
 * 
 * Google Sheet ID  : 1JM-i8_nrGR7-VDEY82QZ5l5JMJTIBOIsuqOSQSrcD3Y
 * Target Sheet Tab : Route_Plans
 * 
 * Google Drive Folders:
 * - Root Folder        : 1lM3KyJTSNvQlHWzbCVLS8QLlfQTfgpi0 (TTMK_Fleet_System)
 * - 01_Route_Plans_PDF : 1oaFFK-Xt35bnKUiLBJ3eJXeG12Npvnui (ใบแผนการเดินรถ A4)
 * - 02_Rest_Stop_Photo : 1V54IZ4H7w_rx0la5jFnfCxaoJICBmNfx (หลักฐานภาพจุดพัก)
 * 
 * วิธีใช้งาน:
 * 1. ใน Google Apps Script กดเครื่องหมาย "+" ข้างคำว่า "ไฟล์ (Files)" -> เลือก "สคริปต์ (Script)"
 * 2. ตั้งชื่อไฟล์ว่า "RoutePlanning" (จะได้ไฟล์ RoutePlanning.gs แยกอิสระจาก Maintenance)
 * 3. วางโค้ดชุดนี้ลงไป
 * 4. ที่เมนูฟังก์ชันด้านบน เลือก "initRoutePlansDataNow" แล้วกดปุ่ม "เรียกใช้ (Run)" 1 ครั้ง
 * =========================================================================
 */

const ROUTE_CONFIG = {
  SPREADSHEET_ID: "1JM-i8_nrGR7-VDEY82QZ5l5JMJTIBOIsuqOSQSrcD3Y",
  SHEET_NAME: "Route_Plans",
  DRIVE_ROOT_ID: "1lM3KyJTSNvQlHWzbCVLS8QLlfQTfgpi0",
  DRIVE_PDF_FOLDER_ID: "1oaFFK-Xt35bnKUiLBJ3eJXeG12Npvnui",
  DRIVE_PHOTO_FOLDER_ID: "1V54IZ4H7w_rx0la5jFnfCxaoJICBmNfx"
};

/**
 * จัดการคำขอ HTTP GET (ดึงข้อมูลเส้นทาง, ซิงค์ข้อมูล, หรือเริ่มระบบ)
 */
function doGet(e) {
  try {
    const params = e ? e.parameter : {};
    const action = params.action || "list_routes";

    // 1. ดึงข้อมูลเส้นทางทั้งหมดส่งกลับเป็น JSON
    if (action === "list_routes" || action === "get_routes") {
      const result = getRoutePlansFromSheet();
      return responseJSON(result);
    }

    // 2. สั่งนำเข้า 9 เส้นทางมาตรฐานผ่าน URL
    if (action === "init_routes" || action === "setup") {
      const msg = initRoutePlansDataNow();
      return responseJSON({ status: "success", message: msg });
    }

    // 3. Ping ทดสอบสถานะ
    if (action === "ping") {
      return responseJSON({
        status: "success",
        service: "TTMK Route Planning & Safety API",
        timestamp: new Date().toISOString()
      });
    }

    return responseJSON({ status: "error", message: "Unknown GET action: " + action });
  } catch (err) {
    return responseJSON({ status: "error", message: err.toString() });
  }
}

/**
 * จัดการคำขอ HTTP POST (เพิ่มเส้นทางใหม่, บันทึกไฟล์ PDF ใบแผนงาน, อัปโหลดรูปจุดพัก)
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

    const action = payload.action || "save_route";

    // 1. บันทึกเส้นทางใหม่ลง Google Sheet
    if (action === "save_route" || action === "add_route") {
      return responseJSON(saveNewRouteToSheet(payload));
    }

    // 2. อัปโหลดไฟล์ PDF แผนการเดินรถลงโฟลเดอร์ 01_Route_Plans_PDF
    if (action === "upload_route_pdf") {
      return responseJSON(uploadRoutePdfToDrive(payload));
    }

    // 3. อัปโหลดรูปถ่ายจุดพักรถลงโฟลเดอร์ 02_Rest_Stop_Evidence
    if (action === "upload_rest_stop_evidence") {
      return responseJSON(uploadRestStopPhotoToDrive(payload));
    }

    return responseJSON({ status: "error", message: "Unknown POST action: " + action });
  } catch (err) {
    return responseJSON({ status: "error", message: err.toString() });
  }
}

/**
 * ฟังก์ชันหลัก: นำเข้าข้อมูล 9 เส้นทางมาตรฐาน SCGJWD/TTMK ลงในชีต Route_Plans ทันที 1 คลิก
 */
function initRoutePlansDataNow() {
  const ss = SpreadsheetApp.openById(ROUTE_CONFIG.SPREADSHEET_ID);
  let sheet = ss.getSheetByName(ROUTE_CONFIG.SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(ROUTE_CONFIG.SHEET_NAME);
  }

  const headers = [
    "Route_ID", "Route_Name", "Feed", "Customer", "Total_Distance_KM",
    "Total_Time_Hours", "Rest_Stops_Count", "Speed_Limit", "Waypoints_JSON",
    "Google_Maps_URL", "Reviewer", "Review_Date"
  ];

  // ตั้งค่าส่วนหัวตาราง สีกรมท่าเข้ม ตัวอักษรสีขาว หนา ตรึงแถว 1
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setBackground("#1e3a8a").setFontColor("#ffffff").setFontWeight("bold").setHorizontalAlignment("center");
  sheet.setFrozenRows(1);

  // ข้อมูลแผนการเดินรถครบทั้ง 9 เส้นทาง (ดึงจากระบบ TTMK Saraburi My Maps)
  const routeRows = [
    [
      "ROUTE-001",
      "ราชบุรี (TCSB/TCRB) – บจก.กลุ่มสยามบรรจุภัณฑ์ โรงงานชลบุรี",
      "FEED_01",
      "บจก. กลุ่มสยามบรรจุภัณฑ์ จำกัด (โรงงานชลบุรี)",
      358,
      "6 - 8 ชม.",
      4,
      80,
      JSON.stringify([
        {"order":0,"type":"origin","name":"โรงงานสยามบรรจุภัณฑ์ (TCSB) ราชบุรี","lat":14.5582,"lng":99.8166,"road":"ทล.4 (เพชรเกษม)","distanceKm":0,"recommendation":"ตรวจเช็คเอกสารและตรวจสภาพรถ F-CAM-032 ก่อนออกเดินทาง","hazard":"ระวังรถเข้า-ออกบริเวณปากทางเข้าโรงงาน","photoUrl":"assets/route_photos/scg_packaging_factory_hd.jpg"},
        {"order":1,"type":"rest","name":"ปั๊มเอสโซ่ อาร์.เอส.ออยล์ นครปฐม","lat":13.8213,"lng":100.0433,"road":"ถนนเพชรเกษม กม.56","distanceKm":56,"recommendation":"พักผ่อน 15-30 นาที ตรวจเช็คสายรัดสินค้า","hazard":"ระวังรถจักรยานยนต์และจุดกลับรถ","photoUrl":"assets/route_photos/esso_station_hd.jpg"},
        {"order":2,"type":"rest","name":"ปั๊มน้ำมันบางจาก - บจก. สินปิ่นเกล้า","lat":13.7861,"lng":100.35,"road":"ถนนบรมราชชนนี กม.92","distanceKm":92,"recommendation":"พักสายตา ตรวจเช็คระบบไฟส่องสว่างท้ายรถ","hazard":"ห้ามใช้ความเร็วเกิน 60 กม./ชม. ในช่องคู่ขนาน","photoUrl":"assets/route_photos/bangchak_station_hd.jpg"},
        {"order":3,"type":"rest","name":"Shell ออยล์นววงศ์ A บางนา","lat":13.5988,"lng":100.6503,"road":"ถนนบางนา-ตราด กม.82","distanceKm":82,"recommendation":"ตรวจความร้อนดุมล้อและระบบเบรก พักไม่น้อยกว่า 20 นาที","hazard":"ระวังจุดกลับรถและทางขึ้นสะพานยกระดับ","photoUrl":"assets/route_photos/shell_station_hd.jpg"},
        {"order":4,"type":"rest","name":"PTT Station ปตท.จิฟฟี่ ฉะเชิงเทรา-บางนา ตราด (กม.49)","lat":13.7452,"lng":101.0058,"road":"ถนนบางนา-ตราด กม.49 ขาออก","distanceKm":48,"recommendation":"จุดพักสุดท้ายก่อนถึงปลายทาง ลานจอดรถบรรทุกกว้างขวาง","hazard":"ระวังลมพัดขวางบนสะพานข้ามแม่น้ำบางปะกง","photoUrl":"assets/route_photos/ptt_station_hd.jpg"},
        {"order":5,"type":"destination","name":"บจก.กลุ่มสยามบรรจุภัณฑ์ โรงงานชลบุรี","lat":13.3648,"lng":100.9866,"road":"ถนนสุขุมวิท","distanceKm":80,"recommendation":"ดับเครื่องยนต์ ดึงเบรกมือ สวมใส่ PPE ครบชุด ส่งมอบเอกสาร POD","hazard":"ระวังรถบรรทุกตู้คอนเทนเนอร์เข้า-ออกนิคม","photoUrl":"assets/route_photos/scg_packaging_factory_hd.jpg"}
      ]),
      "https://www.google.com/maps/dir/?api=1&origin=14.5582,99.8166&destination=13.3648,100.9866&waypoints=13.8213,100.0433|13.7861,100.35|13.5988,100.6503|13.7452,101.0058&travelmode=driving",
      "Nichanan Aj. (SCGJWD Logistics)",
      "17.09.2567"
    ],
    [
      "ROUTE-SOUTH-DOWN",
      "สระบุรี (TCSB) – โรงงานผลิตภัณฑ์ปลากระป๋องสยาม จ.สตูล (ขาล่อง)",
      "FEED_SOUTH",
      "โรงงานผลิตภัณฑ์ปลากระป๋องสยาม จ.สตูล",
      1100,
      "15 - 18 ชม.",
      4,
      80,
      JSON.stringify([
        {"order":0,"type":"origin","name":"โรงงานสยามบรรจุภัณฑ์ (TCSB) สระบุรี","lat":14.583968,"lng":100.973825,"road":"ทล.1 พหลโยธิน","distanceKm":0,"recommendation":"ตรวจความพร้อมพนักงานขับรถและสภาพรถระยะไกล","hazard":"ระวังรถหนาแน่นช่วงต่างระดับสระบุรี","photoUrl":"assets/route_photos/scg_packaging_factory_hd.jpg"},
        {"order":1,"type":"rest","name":"ปั๊ม PT ถ.พระราม 2 ขาออก กม.55 (จ.สมุทรสงคราม)","lat":13.3855,"lng":99.988,"road":"ถ.พระราม 2 ขาออก กม.55","distanceKm":194,"recommendation":"เติมน้ำมัน ตรวจสายรัดสินค้า พักสายตา 30 นาที","hazard":"การจราจรถนนพระราม 2 หนาแน่น ระวังแนวก่อสร้าง","photoUrl":"assets/route_photos/pt_station_hd.jpg"},
        {"order":2,"type":"rest","name":"ESSO เขาน้อย (จ.ประจวบคีรีขันธ์)","lat":12.404338,"lng":99.923664,"road":"ทล.4 เพชรเกษม","distanceKm":146,"recommendation":"ตรวจอุณหภูมิดุมล้อและลมยาง พักรับประทานอาหาร","hazard":"ทางโค้งและจุดกลับรถช่วงเขาน้อย ความเร็วไม่เกิน 80 กม./ชม.","photoUrl":"assets/route_photos/esso_station_hd.jpg"},
        {"order":3,"type":"rest","name":"PTT ทุ่งคา (จ.ชุมพร)","lat":10.422068,"lng":99.130395,"road":"ทล.41 ขาล่อง","distanceKm":260,"recommendation":"พักผ่อน 30 นาที สลับพนักงานขับรถหรือพักสายตา","hazard":"ทางตรงยาวช่วงชุมพร เสี่ยงต่ออาการหลับใน","photoUrl":"assets/route_photos/ptt_station_hd.jpg"},
        {"order":4,"type":"rest","name":"PTT ปากแพรก อ.ทุ่งสง (จ.นครศรีธรรมราช)","lat":8.155067,"lng":99.696312,"road":"ทล.41 เชื่อม ทล.403","distanceKm":290,"recommendation":"จุดพักรถสุดท้ายก่อนเข้าสตูล ตรวจเช็ครอบคัน เติมน้ำมัน","hazard":"ทางแยกสัญญาณไฟทุ่งสง และเส้นทางขึ้น-ลงเขา","photoUrl":"assets/route_photos/ptt_station_hd.jpg"},
        {"order":5,"type":"destination","name":"โรงงานผลิตภัณฑ์ปลากระป๋องสยาม จ.สตูล","lat":6.658056,"lng":100.076994,"road":"ทล.406 สตูล","distanceKm":210,"recommendation":"ติดต่อป้อม รปภ. ดับเครื่อง ดึงเบรกมือ สวมใส่ PPE ครบชุด","hazard":"ถนนสายรอง 2 เลนสวน ระวังรถจักรยานยนต์ในพื้นที่","photoUrl":"assets/route_photos/siam_canned_fish_hd.jpg"}
      ]),
      "https://www.google.com/maps/dir/?api=1&origin=14.583968,100.973825&destination=6.658056,100.076994&waypoints=13.3855,99.988|12.404338,99.923664|10.422068,99.130395|8.155067,99.696312&travelmode=driving",
      "Nichanan Aj. (SCGJWD Logistics)",
      "17.09.2567"
    ],
    [
      "ROUTE-SOUTH-UP",
      "โรงงานผลิตภัณฑ์ปลากระป๋องสยาม จ.สตูล – สระบุรี (TCSB) (ขาขึ้น)",
      "FEED_SOUTH",
      "โรงงานสยามบรรจุภัณฑ์ (TCSB) สระบุรี",
      1100,
      "15 - 18 ชม.",
      4,
      80,
      JSON.stringify([
        {"order":0,"type":"origin","name":"โรงงานผลิตภัณฑ์ปลากระป๋องสยาม จ.สตูล","lat":6.658056,"lng":100.076994,"road":"ทล.406 สตูล","distanceKm":0,"recommendation":"ตรวจเช็คเอกสารขากลับและตรวจสภาพรถ F-CAM-032","hazard":"ระวังทางโค้งและทางแยกร่วมก่อนเข้าทางหลวงหลัก","photoUrl":"assets/route_photos/siam_canned_fish_hd.jpg"},
        {"order":1,"type":"rest","name":"PTT ทุ่งสง ขาขึ้น (ติดแม็คโคร) จ.นครศรีธรรมราช","lat":8.157909,"lng":99.666395,"road":"ทล.41 ขาขึ้น","distanceKm":215,"recommendation":"ตรวจสภาพยางและเบรก พักสายตา 30 นาที","hazard":"ทางแยกร่วมบายพาสทุ่งสง มีรถบรรทุกหนาแน่น","photoUrl":"assets/route_photos/ptt_station_hd.jpg"},
        {"order":2,"type":"rest","name":"PT หลังสวน ขาขึ้น (ติด HOMEMART) จ.ชุมพร","lat":9.943424,"lng":99.061969,"road":"ทล.41 ขาขึ้น","distanceKm":230,"recommendation":"พักรับประทานอาหาร เติมน้ำมัน ตรวจสายรัด","hazard":"ทางตรงยาว เสี่ยงต่ออาการหลับใน ความเร็ว ≤ 80 กม./ชม.","photoUrl":"assets/route_photos/pt_station_hd.jpg"},
        {"order":3,"type":"rest","name":"PT ประจวบฯ ขาขึ้น (ก่อนถึงด่านสิงขร) จ.ประจวบคีรีขันธ์","lat":11.741378,"lng":99.748831,"road":"ทล.4 เพชรเกษม ขาขึ้น","distanceKm":235,"recommendation":"ตรวจความร้อนดุมล้อและระบบเบรก พักสายตา 30 นาที","hazard":"ระวังจุดตรวจและด่านตรวจความเร็วทางหลวง","photoUrl":"assets/route_photos/pt_station_hd.jpg"},
        {"order":4,"type":"rest","name":"บางจาก ถ.พระราม 2 ขาเข้า กม.77 (จ.สมุทรสงคราม)","lat":13.348472,"lng":99.893725,"road":"ถ.พระราม 2 ขาเข้า กม.77","distanceKm":205,"recommendation":"จุดพักสุดท้ายก่อนเข้าเขตกรุงเทพฯ/ปริมณฑล","hazard":"ปริมาณรถหนาแน่นช่วงเข้าเขตพระราม 2 ระวังแนวก่อสร้าง","photoUrl":"assets/route_photos/bangchak_station_hd.jpg"},
        {"order":5,"type":"destination","name":"โรงงานสยามบรรจุภัณฑ์ (TCSB) สระบุรี","lat":14.583968,"lng":100.973825,"road":"ทล.1 พหลโยธิน","distanceKm":215,"recommendation":"ถึงจุดหมายปลายทาง คืนตู้/ลงสินค้า ส่งมอบเอกสาร รายงานจบเที่ยววิ่ง","hazard":"ระวังรถเข้า-ออกบริเวณปากทางเข้าโรงงาน","photoUrl":"assets/route_photos/scg_packaging_factory_hd.jpg"}
      ]),
      "https://www.google.com/maps/dir/?api=1&origin=6.658056,100.076994&destination=14.583968,100.973825&waypoints=8.157909,99.666395|9.943424,99.061969|11.741378,99.748831|13.348472,99.893725&travelmode=driving",
      "Nichanan Aj. (SCGJWD Logistics)",
      "17.09.2567"
    ],
    [
      "ROUTE-DOLE-WEST",
      "ราชบุรี (TCRB) – บจก.โดล ไทยแลนด์ (กุยบุรี ประจวบคีรีขันธ์)",
      "FEED_WEST",
      "บจก. โดล ไทยแลนด์ (Dole Thailand)",
      355,
      "5 - 6 ชม.",
      4,
      80,
      JSON.stringify([
        {"order":0,"type":"origin","name":"โรงงานสยามบรรจุภัณฑ์ (TCRB) ราชบุรี","lat":13.512634,"lng":99.614982,"road":"ทล.4 เพชรเกษม","distanceKm":0,"recommendation":"ตรวจเช็คเอกสาร ตรวจสภาพรถ F-CAM-032 และวัดแอลกอฮอล์","hazard":"ระวังรถเข้า-ออกบริเวณปากทางเข้าโรงงาน","photoUrl":"assets/route_photos/scg_packaging_factory_hd.jpg"},
        {"order":1,"type":"rest","name":"ปั๊มน้ำมัน ปตท. บ้านโป่ง (PTT Ban Pong)","lat":13.812474,"lng":99.862284,"road":"ทล.4 กม.68","distanceKm":38,"recommendation":"จุดพักระยะสั้น เติมน้ำมันและเช็คสภาพรถ","hazard":"ทางแยกสัญญาณไฟบ้านโป่ง ระวังรถตัดหน้า","photoUrl":"assets/route_photos/ptt_station_hd.jpg"},
        {"order":2,"type":"rest","name":"ปั๊มน้ำมัน เชลล์ ชะอำ (Shell Cha-am)","lat":12.796727,"lng":99.967843,"road":"ทล.4 เพชรเกษม กม.168","distanceKm":100,"recommendation":"จุดพักครึ่งทาง: พักรับประทานอาหาร พักสายตา 30 นาที ตรวจเช็คลมยาง","hazard":"ทางแยกร่วมชะอำ-หัวหิน ปริมาณรถหนาแน่น","photoUrl":"assets/route_photos/shell_station_hd.jpg"},
        {"order":3,"type":"rest","name":"ปั๊มน้ำมัน ปตท. ปราณบุรี (PTT Pranburi)","lat":12.375826,"lng":99.878658,"road":"ทล.4 เพชรเกษม กม.248","distanceKm":80,"recommendation":"จุดพักสำคัญก่อนเข้าเขตประจวบคีรีขันธ์ ตรวจดุมล้อและเบรก","hazard":"ทางแยกบายพาสปราณบุรี ระวังรถความเร็วสูง","photoUrl":"assets/route_photos/ptt_station_hd.jpg"},
        {"order":4,"type":"rest","name":"ปั๊มน้ำมัน ปตท. คลองวาฬ (PTT Khlong Wan)","lat":11.811658,"lng":99.778439,"road":"ทล.4 เพชรเกษม กม.318","distanceKm":70,"recommendation":"จุดพักสุดท้ายก่อนถึงโรงงาน พักสายตา 15 นาที","hazard":"ทางตรงยาวช่วงทับสะแก-กุยบุรี ระวังอาการหลับใน","photoUrl":"assets/route_photos/ptt_station_hd.jpg"},
        {"order":5,"type":"destination","name":"บริษัท โดล ไทยแลนด์ จำกัด (Dole Thailand)","lat":11.78048,"lng":99.76223,"road":"ทางหลวงเพชรเกษม กุยบุรี","distanceKm":67,"recommendation":"ดับเครื่อง ดึงเบรกมือ สวมอุปกรณ์ PPE ครบชุดก่อนเข้าโรงงาน","hazard":"ทางเข้าโรงงานมีรถบรรทุกผลไม้เข้า-ออกสม่ำเสมอ","photoUrl":"assets/route_photos/dole_thailand_hd.jpg"}
      ]),
      "https://www.google.com/maps/dir/?api=1&origin=13.512634,99.614982&destination=11.78048,99.76223&waypoints=13.812474,99.862284|12.796727,99.967843|12.375826,99.878658|11.811658,99.778439&travelmode=driving",
      "Nichanan Aj. (SCGJWD Logistics)",
      "17.09.2567"
    ],
    [
      "ROUTE-SHORT-NEO",
      "สระบุรี (TCSB) – บจก. นีโอ แฟคทอรี่ (ลำลูกกา)",
      "FEED_SHORT",
      "บจก. นีโอ แฟคทอรี่ (Neo Factory)",
      73.8,
      "1.2 - 1.5 ชม.",
      0,
      80,
      JSON.stringify([
        {"order":0,"type":"origin","name":"โรงงานสยามบรรจุภัณฑ์ (TCSB) สระบุรี","lat":14.583968,"lng":100.973825,"road":"ทล.1 พหลโยธิน","distanceKm":0,"recommendation":"จุดขึ้นสินค้า: ตรวจเช็คเอกสารและสายรัดสินค้าให้แน่นหนา (ระยะทาง < 150 กม.)","hazard":"ทางเข้าหนองแคเป็นถนนเส้นเล็ก ระวังรถมอเตอร์ไซค์","photoUrl":"assets/route_photos/scg_packaging_factory_hd.jpg"},
        {"order":1,"type":"destination","name":"บจก. นีโอ แฟคทอรี่ (ลำลูกกา คลอง 13)","lat":14.0789,"lng":100.892,"road":"ถนน 305 รังสิต-นครนายก เชื่อมคลอง 13","distanceKm":73.8,"recommendation":"ถึงจุดหมายปลายทาง: เทียบท่าโหลดสินค้า ดับเครื่อง สวมหมวกนิรภัย","hazard":"สะพานข้ามคลองและทางโค้งแคบ ใช้ความเร็วต่ำ","photoUrl":"assets/route_photos/neo_factory_hd.jpg"}
      ]),
      "https://www.google.com/maps/dir/?api=1&origin=14.583968,100.973825&destination=14.0789,100.892&travelmode=driving",
      "Nichanan Aj. (SCGJWD Logistics)",
      "17.09.2567"
    ],
    [
      "ROUTE-SHORT-CARGILL",
      "สระบุรี (TCSB) – บจก. คาร์กิลล์มีทส์ (ไทยแลนด์)",
      "FEED_SHORT",
      "บจก. คาร์กิลล์มีทส์ (ไทยแลนด์)",
      30,
      "45 - 60 นาที",
      0,
      80,
      JSON.stringify([
        {"order":0,"type":"origin","name":"โรงงานสยามบรรจุภัณฑ์ (TCSB) สระบุรี","lat":14.583968,"lng":100.973825,"road":"ทล.1 / ถนน 3188","distanceKm":0,"recommendation":"จุดขึ้นสินค้า: ตรวจเช็คตู้คอนเทนเนอร์/ผ้าใบคลุม (30 กม. ไม่มีจุดพักรถ)","hazard":"ถนนอดิเรกสารมีรถสัญจรในชุมชน ระวังคนข้ามถนน","photoUrl":"assets/route_photos/scg_packaging_factory_hd.jpg"},
        {"order":1,"type":"destination","name":"บจก. คาร์กิลล์มีทส์ (ไทยแลนด์)","lat":14.615,"lng":100.985,"road":"ถนน 3034 สระบุรี","distanceKm":30,"recommendation":"จุดส่งมอบ: ปฏิบัติตามมาตรฐาน Bio-Security และเทียบท่าโหลดสินค้า","hazard":"ทางเข้าโรงงานมีรถรับส่งพนักงานสัญจรช่วงเวลาเปลี่ยนกะ","photoUrl":"assets/route_photos/cargill_meats_hd.jpg"}
      ]),
      "https://www.google.com/maps/dir/?api=1&origin=14.583968,100.973825&destination=14.615,100.985&travelmode=driving",
      "Nichanan Aj. (SCGJWD Logistics)",
      "17.09.2567"
    ],
    [
      "ROUTE-SHORT-BFOODS",
      "สระบุรี (TCSB) – บจก. บีฟู้ดส์ โปรดักส์ (พัฒนานิคม)",
      "FEED_SHORT",
      "บจก. บีฟู้ดส์ โปรดักส์ อินเตอร์เนชั่นแนล",
      43,
      "45 - 60 นาที",
      0,
      80,
      JSON.stringify([
        {"order":0,"type":"origin","name":"โรงงานสยามบรรจุภัณฑ์ (TCSB) สระบุรี","lat":14.583968,"lng":100.973825,"road":"ทล.1 พหลโยธิน","distanceKm":0,"recommendation":"จุดขึ้นสินค้า: ตรวจสอบความพร้อม พขร. และยานพาหนะ","hazard":"ทางแยกร่วมสระบุรี-หล่มสัก ระวังรถบรรทุกหนัก","photoUrl":"assets/route_photos/scg_packaging_factory_hd.jpg"},
        {"order":1,"type":"destination","name":"บจก. บีฟู้ดส์ โปรดักส์ (ช่องสาริกา พัฒนานิคม)","lat":14.925,"lng":100.842,"road":"ต.ช่องสาริกา พัฒนานิคม ลพบุรี","distanceKm":43,"recommendation":"จุดส่งมอบสินค้า: ติดต่อป้อม รปภ. แลกบัตร และเทียบท่าโหลดสินค้า","hazard":"ทางเข้าซอยเทศบาลมีรถมอเตอร์ไซค์และรถเกษตรกรวิ่งสวนทาง","photoUrl":"assets/route_photos/cargill_meats_hd.jpg"}
      ]),
      "https://www.google.com/maps/dir/?api=1&origin=14.583968,100.973825&destination=14.925,100.842&travelmode=driving",
      "Nichanan Aj. (SCGJWD Logistics)",
      "17.09.2567"
    ],
    [
      "ROUTE-SHORT-AJINOMOTO",
      "สระบุรี (TCSB) – บ.อายิโนะโมะโต๊ะ เบทาโกร โฟรเซ่นฟู้ดส์",
      "FEED_SHORT",
      "บ.อายิโนะโมะโต๊ะ เบทาโกร โฟรเซ่นฟู้ดส์ (ไทยแลนด์)",
      37.9,
      "40 - 55 นาที",
      0,
      80,
      JSON.stringify([
        {"order":0,"type":"origin","name":"โรงงานสยามบรรจุภัณฑ์ (TCSB) สระบุรี","lat":14.583968,"lng":100.973825,"road":"ทล.1 พหลโยธิน","distanceKm":0,"recommendation":"จุดขึ้นสินค้า: ตรวจเช็คความสะอาดตู้บรรทุกสินค้า","hazard":"ปริมาณรถหนาแน่นช่วงทางแยกบายพาส","photoUrl":"assets/route_photos/scg_packaging_factory_hd.jpg"},
        {"order":1,"type":"destination","name":"บ.อายิโนะโมะโต๊ะ เบทาโกร โฟรเซ่นฟู้ดส์ (ไทยแลนด์)","lat":14.885,"lng":100.875,"road":"ถนน 3334 ลพบุรี","distanceKm":37.9,"recommendation":"ถึงจุดหมายปลายทาง: เข้าจุดตรวจสุขอนามัยโรงงาน และส่งมอบ POD","hazard":"ทางเลี้ยวเข้าโรงงานกระชั้นชิด ให้เปิดสัญญาณไฟเลี้ยวก่อนล่วงหน้า","photoUrl":"assets/route_photos/siam_canned_fish_hd.jpg"}
      ]),
      "https://www.google.com/maps/dir/?api=1&origin=14.583968,100.973825&destination=14.885,100.875&travelmode=driving",
      "Nichanan Aj. (SCGJWD Logistics)",
      "17.09.2567"
    ],
    [
      "ROUTE-SHORT-ROYAL",
      "สระบุรี (TCSB) – บมจ. โรแยล ซีรามิค อุตสาหกรรม (หนองแค)",
      "FEED_SHORT",
      "บมจ. โรแยล ซีรามิค อุตสาหกรรม (หนองแค)",
      35.6,
      "40 - 50 นาที",
      0,
      80,
      JSON.stringify([
        {"order":0,"type":"origin","name":"โรงงานสยามบรรจุภัณฑ์ (TCSB) สระบุรี","lat":14.583968,"lng":100.973825,"road":"ทล.1 พหลโยธิน","distanceKm":0,"recommendation":"จุดขึ้นสินค้า: ตรวจสอบการรัดกล่องบรรจุภัณฑ์เซรามิกอย่างแน่นหนา","hazard":"ทางเข้าหนองแคเป็นถนนเส้นเล็ก ระวังรถมอเตอร์ไซค์","photoUrl":"assets/route_photos/scg_packaging_factory_hd.jpg"},
        {"order":1,"type":"destination","name":"บมจ. โรแยล ซีรามิค อุตสาหกรรม (หนองแค)","lat":14.385,"lng":100.895,"road":"ถนนพหลโยธิน กม.89 อ.หนองแค สระบุรี","distanceKm":35.6,"recommendation":"ถึงจุดหมายปลายทาง: เทียบท่าโหลดกล่องสินค้ากระเบื้อง และลงชื่อส่งมอบเอกสาร","hazard":"ทางแยกคู่ขนานพหลโยธิน มีรถชะลอเลี้ยวเข้าเขตนิคมอุตสาหกรรม","photoUrl":"assets/route_photos/scg_packaging_factory_hd.jpg"}
      ]),
      "https://www.google.com/maps/dir/?api=1&origin=14.583968,100.973825&destination=14.385,100.895&travelmode=driving",
      "Nichanan Aj. (SCGJWD Logistics)",
      "17.09.2567"
    ]
  ];

  // ล้างข้อมูลแถวเก่าตั้งแต่แถวที่ 2 ลงไป (คงหัวตารางไว้)
  if (sheet.getLastRow() > 1) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).clearContent();
  }

  // บันทึกข้อมูลทั้ง 9 เส้นทาง
  sheet.getRange(2, 1, routeRows.length, headers.length).setValues(routeRows);

  // จัดรูปแบบตารางและความกว้างคอลัมน์ให้อ่านง่าย
  for (let c = 1; c <= headers.length; c++) sheet.setColumnWidth(c, 130);
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

  Logger.log("✅ เพิ่มข้อมูล 9 เส้นทางลงในแผ่นงาน Route_Plans สำเร็จแล้ว!");
  return "✅ นำเข้าข้อมูลแผนการเดินรถ 9 เส้นทางลง Google Sheet (Route_Plans) สำเร็จแล้ว!";
}

/**
 * ดึงข้อมูลเส้นทางทั้งหมดจากชีต Route_Plans ส่งออกเป็น JSON
 */
function getRoutePlansFromSheet() {
  const ss = SpreadsheetApp.openById(ROUTE_CONFIG.SPREADSHEET_ID);
  const sheet = ss.getSheetByName(ROUTE_CONFIG.SHEET_NAME);
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

/**
 * เพิ่มเส้นทางใหม่ลง Google Sheet
 */
function saveNewRouteToSheet(data) {
  const ss = SpreadsheetApp.openById(ROUTE_CONFIG.SPREADSHEET_ID);
  const sheet = ss.getSheetByName(ROUTE_CONFIG.SHEET_NAME);
  if (!sheet) throw new Error("ไม่พบแผ่นงาน Route_Plans");

  const row = [
    data.id || ("ROUTE-" + Date.now()),
    data.name || "-",
    data.feed || "FEED_01",
    data.customer || "-",
    Number(data.totalDistanceKm) || 0,
    data.estimatedTime || "-",
    Number(data.restStopsCount) || 0,
    Number(data.speedLimit) || 80,
    JSON.stringify(data.waypoints || []),
    data.googleMapsUrl || "-",
    data.reviewer || "Nichanan Aj.",
    data.reviewDate || Utilities.formatDate(new Date(), "Asia/Bangkok", "dd.MM.yyyy")
  ];

  sheet.appendRow(row);
  return { status: "success", message: "บันทึกเส้นทางใหม่สำเร็จ", routeId: row[0] };
}

/**
 * บันทึกไฟล์ PDF ใบกำหนดเวลาเดินรถ A4 ลง Google Drive โฟลเดอร์ 01_Route_Plans_PDF
 */
function uploadRoutePdfToDrive(payload) {
  if (!payload.base64Pdf) throw new Error("ไม่พบข้อมูล Base64 PDF");
  const folder = DriveApp.getFolderById(ROUTE_CONFIG.DRIVE_PDF_FOLDER_ID);
  const filename = payload.filename || `RoutePlan_${Date.now()}.pdf`;
  const bytes = Utilities.base64Decode(payload.base64Pdf);
  const blob = Utilities.newBlob(bytes, "application/pdf", filename);
  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  return {
    status: "success",
    fileId: file.getId(),
    url: file.getUrl(),
    downloadUrl: file.getDownloadUrl()
  };
}

/**
 * บันทึกรูปภาพหลักฐานจุดพักรถลง Google Drive โฟลเดอร์ 02_Rest_Stop_Evidence
 */
function uploadRestStopPhotoToDrive(payload) {
  if (!payload.base64Photo) throw new Error("ไม่พบข้อมูล Base64 Photo");
  const folder = DriveApp.getFolderById(ROUTE_CONFIG.DRIVE_PHOTO_FOLDER_ID);
  const filename = payload.filename || `RestStop_${Date.now()}.jpg`;
  const cleanBase64 = payload.base64Photo.indexOf(",") > -1 ? payload.base64Photo.split(",")[1] : payload.base64Photo;
  const bytes = Utilities.base64Decode(cleanBase64);
  const blob = Utilities.newBlob(bytes, "image/jpeg", filename);
  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  return {
    status: "success",
    fileId: file.getId(),
    url: file.getUrl()
  };
}

/**
 * ผู้ช่วยส่งค่าผลลัพธ์แบบ JSON
 */
function responseJSON(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
