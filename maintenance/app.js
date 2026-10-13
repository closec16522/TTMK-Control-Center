/**
 * =========================================================================
 * Frontend Application Logic - ระบบแจ้งซ่อมและบันทึกข้อมูลการซ่อมบำรุงรถบรรทุก
 * หจก. ทั่วไทยขนส่งมงคล (Mr.Taweesak.kom - 062-3285963)
 * =========================================================================
 */

const CONFIG = {
  SPREADSHEET_ID: "1JM-i8_nrGR7-VDEY82QZ5l5JMJTIBOIsuqOSQSrcD3Y",
  DRIVE_FOLDER_ID: "1YRkTR9dMz0PxKgF60edVF56Ckq909fMF",
  SHEET_NAME: "Maintenance_log",
  // Google Apps Script Web App Deployment URL
  DEFAULT_GAS_URL: "https://script.google.com/macros/s/AKfycbwvZxSw_p62y6ZwegF8iUiEdxyEJrF01yB37AumDHwgLcSFBoRSZUmwgvdtLJ-6hCFE/exec",
  STORAGE_KEY_LOGS: "TTMK_MAINTENANCE_LOGS",
  STORAGE_KEY_DRIVER: "TTMK_SAVED_DRIVER_EMAIL"
};

// Application Global State
const appState = {
  currentTab: 'form',
  partItems: [],
  capturedImages: {
    billPhoto: null,
    defectPhoto: null,
    partsPhoto: null,
    finishedPhoto: null
  },
  maintenanceLogs: [],
  activeCameraStream: null,
  activeCameraTarget: null,
  cameraFacingMode: 'environment', // 'environment' (หลัง) or 'user' (หน้า)
  currentDriver: null
};

// รายการหมวดหมู่อะไหล่/งานบริการ
const PART_CATEGORIES = [
  "เปลี่ยนอะไหล่ใหม่ (แท้)",
  "อะไหล่เทียบ / OEM",
  "ซ่อม / ฟื้นฟูสภาพ",
  "ค่าแรงช่าง / บริการ",
  "น้ำมัน / ของเหลว",
  "ยางและกระทะล้อ",
  "ระบบเบรก / ลม",
  "ระบบไฟ / แบตเตอรี่"
];

// รายการหน่วยนับ
const PART_UNITS = ["ชิ้น", "ชุด", "เส้น", "ลิตร", "แกลลอน", "กระป๋อง", "อัน", "ข้าง", "คู่", "งาน / เที่ยว"];

// =========================================================================
// 1. INITIALIZATION ON DOM READY
// =========================================================================
document.addEventListener("DOMContentLoaded", () => {
  initDateDefaults();
  initDriverIdentity();
  initVehicleDropdown();
  initPartsTableDefaultRow();
  loadMaintenanceLogs();
});

/**
 * ตั้งค่าวันที่เริ่มต้นเป็นวันปัจจุบัน
 */
function initDateDefaults() {
  const dateInput = document.getElementById("inspectionDate");
  if (dateInput) {
    const today = new Date().toISOString().split("T")[0];
    dateInput.value = today;
  }
  generateNewTicketId();
}

/**
 * สุ่มสร้างหรือสร้าง Ticket ID ชั่วคราว
 */
function generateNewTicketId() {
  const d = new Date();
  const ymd = Utilities_formatYMD(d);
  const rnd = Math.floor(100 + Math.random() * 900);
  const ticketId = `MNT-${ymd}-${rnd}`;
  const el = document.getElementById("formCurrentTicketId");
  if (el) el.textContent = ticketId;
  return ticketId;
}

function Utilities_formatYMD(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

/**
 * ดึงข้อมูลพนักงานขับรถจากระบบความจำเดียวกันกับ Alcohol & CheckTruck
 */
function initDriverIdentity() {
  let savedEmail = localStorage.getItem(CONFIG.STORAGE_KEY_DRIVER) || localStorage.getItem("TTMK_LAST_EMAIL");
  let savedProfile = null;
  try {
    const raw = localStorage.getItem("TTMK_DRIVER_PROFILE");
    if (raw) savedProfile = JSON.parse(raw);
  } catch (e) {}

  if (savedProfile && savedProfile.email) {
    applyDriverData(savedProfile);
  } else if (savedEmail && savedEmail.trim().length > 3) {
    applyDriverEmail(savedEmail.trim().toLowerCase());
  } else {
    // ถ้าไม่เคยล็อกอิน ให้แสดงสถานะรอระบุตัวตน
    updateDriverHeaderUI(null);
  }
}

function applyDriverData(driver) {
  appState.currentDriver = driver;
  const nameInput = document.getElementById("driverName");
  const emailInput = document.getElementById("driverEmail");
  const phoneInput = document.getElementById("driverPhone");
  const plateSelect = document.getElementById("vehiclePlate");

  if (nameInput) nameInput.value = driver.driverName || driver.name || "";
  if (emailInput) emailInput.value = driver.email || "";
  if (phoneInput) phoneInput.value = driver.phone || "";

  if (plateSelect && driver.vehiclePlate) {
    for (let opt of plateSelect.options) {
      if (opt.value.includes(driver.vehiclePlate) || driver.vehiclePlate.includes(opt.value)) {
        plateSelect.value = opt.value;
        break;
      }
    }
  }

  updateDriverHeaderUI(driver);
}

function applyDriverEmail(email) {
  const emailInput = document.getElementById("driverEmail");
  if (emailInput) emailInput.value = email;
  const username = email.split('@')[0];
  const mockDriver = {
    driverName: "พนักงานขับรถ " + username,
    email: email,
    phone: "062-3285963"
  };
  appState.currentDriver = mockDriver;
  const nameInput = document.getElementById("driverName");
  if (nameInput && !nameInput.value) nameInput.value = mockDriver.driverName;
  updateDriverHeaderUI(mockDriver);
}

function updateDriverHeaderUI(driver) {
  const headerName = document.getElementById("headerDriverName");
  const dot = document.getElementById("driverStatusDot");
  if (!driver || !driver.email) {
    if (headerName) headerName.textContent = "ระบุตัวตน";
    if (dot) dot.className = "w-2 h-2 rounded-full bg-slate-400";
  } else {
    if (headerName) headerName.textContent = driver.driverName || driver.name || driver.email;
    if (dot) dot.className = "w-2 h-2 rounded-full bg-emerald-400 animate-pulse";
  }
}

/**
 * เด้งหน้าต่างระบุหรือเปลี่ยนผู้ขับขี่
 */
window.promptSwitchDriver = function() {
  Swal.fire({
    title: 'ระบุตัวตนผู้แจ้งซ่อม / พขร.',
    html: `
      <div class="text-left text-xs text-slate-600 space-y-2">
        <p>กรุณากรอกอีเมลของท่านที่ลงทะเบียนในระบบเพื่อดึงข้อมูลอัตโนมัติ:</p>
        <input type="email" id="swalDriverEmailInput" placeholder="เช่น driver@gmail.com"
               class="w-full p-2.5 rounded-lg border border-slate-300 text-xs font-mono outline-none focus:ring-2 focus:ring-blue-500">
      </div>
    `,
    showCancelButton: true,
    confirmButtonText: 'ยืนยันตัวตน',
    cancelButtonText: 'ยกเลิก',
    confirmButtonColor: '#f59e0b',
    preConfirm: () => {
      const email = document.getElementById('swalDriverEmailInput').value.trim();
      if (!email || !email.includes('@')) {
        Swal.showValidationMessage('กรุณากรอกอีเมลให้ถูกต้อง');
        return false;
      }
      return email.toLowerCase();
    }
  }).then((res) => {
    if (res.isConfirmed && res.value) {
      localStorage.setItem(CONFIG.STORAGE_KEY_DRIVER, res.value);
      localStorage.setItem("TTMK_LAST_EMAIL", res.value);
      applyDriverEmail(res.value);
      Swal.fire({
        icon: 'success',
        title: 'ระบุตัวตนเรียบร้อย',
        timer: 1200,
        showConfirmButton: false
      });
    }
  });
};

/**
 * จัดการเมื่อเปลี่ยนตัวเลือกทะเบียนรถ
 */
window.handlePlateChange = function() {
  const plateSelect = document.getElementById("vehiclePlate");
  const customInput = document.getElementById("customPlateInput");
  const vehicleType = document.getElementById("vehicleType");

  if (!plateSelect) return;

  if (plateSelect.value === "OTHER") {
    customInput.classList.remove("hidden");
    customInput.focus();
  } else {
    customInput.classList.add("hidden");
  }

  // ปรับประเภทรถอัตโนมัติตามทะเบียน
  if (plateSelect.value.includes("EV") || plateSelect.value.includes("73-1735") || plateSelect.value.includes("72-8297") || plateSelect.value.includes("72-5079") || plateSelect.value.includes("61-5463")) {
    vehicleType.value = "รถบรรทุก 6 ล้อ EV (ไฟฟ้า 100%)";
  } else if (plateSelect.value.includes("คอก")) {
    vehicleType.value = "รถบรรทุก 6 ล้อคอกผ้าใบ (ดีเซล)";
  } else {
    vehicleType.value = "รถบรรทุก 6 ล้อตู้ทึบ (ดีเซล)";
  }
};

/**
 * ดึงทะเบียนรถเข้าไปใส่ในตัวกรองประวัติ
 */
function initVehicleDropdown() {
  const filterPlate = document.getElementById("filterPlate");
  const plateSelect = document.getElementById("vehiclePlate");
  if (!filterPlate || !plateSelect) return;

  // คัดลอก options จาก vehiclePlate
  const uniquePlates = new Set();
  for (let opt of plateSelect.options) {
    if (opt.value && opt.value !== "OTHER" && opt.value !== "") {
      const clean = opt.value.split(" ")[0];
      uniquePlates.add(clean);
    }
  }

  uniquePlates.forEach(p => {
    const opt = document.createElement("option");
    opt.value = p;
    opt.textContent = "ทะเบียน " + p;
    filterPlate.appendChild(opt);
  });
}

// =========================================================================
// 2. DYNAMIC PARTS REPEATER TABLE (+ เพิ่มรายการ)
// =========================================================================

function initPartsTableDefaultRow() {
  appState.partItems = [];
  addPartRow({
    name: "เปลี่ยนถ่ายน้ำมันเครื่อง & กรองน้ำมันเครื่อง",
    category: "น้ำมัน / ของเหลว",
    qty: 1,
    unit: "ชุด",
    unitPrice: 2800
  });
}

window.addPartRow = function(initData = null) {
  const newId = "part_" + Date.now() + "_" + Math.floor(Math.random() * 1000);
  const item = {
    id: newId,
    name: initData ? initData.name : "",
    category: initData ? initData.category : "เปลี่ยนอะไหล่ใหม่ (แท้)",
    qty: initData ? initData.qty : 1,
    unit: initData ? initData.unit : "ชิ้น",
    unitPrice: initData ? initData.unitPrice : 0,
    total: 0
  };
  item.total = Number(item.qty || 1) * Number(item.unitPrice || 0);

  appState.partItems.push(item);
  renderPartsTableRows();
  calculateFinancialTotals();
};

window.removePartRow = function(id) {
  if (appState.partItems.length <= 1) {
    Swal.fire({
      icon: 'info',
      title: 'ต้องมีรายการอย่างน้อย 1 รายการ',
      text: 'หากเป็นงานซ่อมทั่วไป สามารถระบุเป็นรายการค่าแรงหรือค่าบริการได้ครับ',
      timer: 1600,
      showConfirmButton: false
    });
    return;
  }
  appState.partItems = appState.partItems.filter(it => it.id !== id);
  renderPartsTableRows();
  calculateFinancialTotals();
};

window.updatePartField = function(id, field, value) {
  const item = appState.partItems.find(it => it.id === id);
  if (!item) return;

  if (field === 'qty' || field === 'unitPrice') {
    item[field] = parseFloat(value) || 0;
    item.total = item.qty * item.unitPrice;
    const totalCell = document.getElementById(`part_total_${id}`);
    if (totalCell) totalCell.textContent = Number(item.total).toLocaleString('th-TH', { minimumFractionDigits: 2 });
  } else {
    item[field] = value;
  }

  calculateFinancialTotals();
};

function renderPartsTableRows() {
  const tbody = document.getElementById("partsTableBody");
  if (!tbody) return;

  tbody.innerHTML = "";

  appState.partItems.forEach((item, index) => {
    const tr = document.createElement("tr");
    tr.className = "hover:bg-slate-50 transition border-b border-slate-100";

    const catOptions = PART_CATEGORIES.map(c => 
      `<option value="${c}" ${c === item.category ? 'selected' : ''}>${c}</option>`
    ).join("");

    const unitOptions = PART_UNITS.map(u => 
      `<option value="${u}" ${u === item.unit ? 'selected' : ''}>${u}</option>`
    ).join("");

    tr.innerHTML = `
      <td class="py-2 px-3 text-center text-slate-400 font-mono font-bold">${index + 1}</td>
      <td class="py-2 px-3">
        <input type="text" value="${escapeHtml(item.name)}" placeholder="เช่น ผ้าเบรกหน้าซ้าย, สายพาน, ยาง 295/80R22.5"
               onchange="updatePartField('${item.id}', 'name', this.value)"
               class="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 focus:border-blue-500 outline-none text-xs text-slate-800">
      </td>
      <td class="py-2 px-3">
        <select onchange="updatePartField('${item.id}', 'category', this.value)"
                class="w-full px-2 py-1.5 rounded-lg border border-slate-200 outline-none text-xs bg-white text-slate-700">
          ${catOptions}
        </select>
      </td>
      <td class="py-2 px-3 text-center">
        <input type="number" min="1" step="1" value="${item.qty}"
               oninput="updatePartField('${item.id}', 'qty', this.value)"
               class="w-16 px-2 py-1.5 text-center font-mono rounded-lg border border-slate-200 focus:border-blue-500 outline-none text-xs">
      </td>
      <td class="py-2 px-3">
        <select onchange="updatePartField('${item.id}', 'unit', this.value)"
                class="w-full px-2 py-1.5 rounded-lg border border-slate-200 outline-none text-xs bg-white text-slate-700">
          ${unitOptions}
        </select>
      </td>
      <td class="py-2 px-3 text-right">
        <input type="number" min="0" step="any" value="${item.unitPrice}"
               oninput="updatePartField('${item.id}', 'unitPrice', this.value)"
               class="w-24 px-2 py-1.5 text-right font-mono font-bold rounded-lg border border-slate-200 focus:border-blue-500 outline-none text-xs">
      </td>
      <td class="py-2 px-3 text-right font-mono font-bold text-slate-900" id="part_total_${item.id}">
        ${Number(item.total).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
      </td>
      <td class="py-2 px-3 text-center">
        <button type="button" onclick="removePartRow('${item.id}')"
                class="p-1.5 text-slate-400 hover:text-red-600 rounded-lg transition" title="ลบรายการนี้">
          <i class="fa-solid fa-trash-can text-xs"></i>
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

/**
 * คำนวณยอดเงินรวมทั้งหมด
 */
window.calculateFinancialTotals = function() {
  let partsSubtotal = 0;
  let laborSubtotal = 0;

  appState.partItems.forEach(item => {
    const lineTotal = Number(item.qty || 0) * Number(item.unitPrice || 0);
    if (item.category.includes("ค่าแรง") || item.category.includes("บริการ")) {
      laborSubtotal += lineTotal;
    } else {
      partsSubtotal += lineTotal;
    }
  });

  const includeVat = document.getElementById("checkIncludeVat") ? document.getElementById("checkIncludeVat").checked : false;
  const subtotal = partsSubtotal + laborSubtotal;
  const vatAmount = includeVat ? subtotal * 0.07 : 0;
  const grandTotal = subtotal + vatAmount;

  const sumPartsEl = document.getElementById("sumPartsCost");
  const sumLaborEl = document.getElementById("sumLaborCost");
  const sumVatEl = document.getElementById("sumVatCost");
  const sumTotalEl = document.getElementById("sumTotalCost");

  if (sumPartsEl) sumPartsEl.textContent = partsSubtotal.toLocaleString('th-TH', { minimumFractionDigits: 2 }) + " บาท";
  if (sumLaborEl) sumLaborEl.textContent = laborSubtotal.toLocaleString('th-TH', { minimumFractionDigits: 2 }) + " บาท";
  if (sumVatEl) sumVatEl.textContent = vatAmount.toLocaleString('th-TH', { minimumFractionDigits: 2 }) + " บาท";
  if (sumTotalEl) sumTotalEl.textContent = grandTotal.toLocaleString('th-TH', { minimumFractionDigits: 2 }) + " บาท";

  return { partsSubtotal, laborSubtotal, vatAmount, grandTotal };
};

// =========================================================================
// 3. ATTACHMENTS & IMAGE COMPRESSION (CANVAS)
// =========================================================================

window.handleFileUpload = function(event, targetType) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    compressImageBase64(e.target.result, (compressedData) => {
      setPhotoData(targetType, compressedData);
    });
  };
  reader.readAsDataURL(file);
};

window.clearPhoto = function(targetType) {
  appState.capturedImages[targetType] = null;
  const prevImg = document.getElementById("preview" + capitalize(targetType));
  const ph = document.getElementById("placeholder" + capitalize(targetType));
  if (prevImg) {
    prevImg.src = "";
    prevImg.classList.add("hidden");
  }
  if (ph) ph.classList.remove("hidden");
};

function setPhotoData(targetType, base64) {
  appState.capturedImages[targetType] = base64;
  const prevImg = document.getElementById("preview" + capitalize(targetType));
  const ph = document.getElementById("placeholder" + capitalize(targetType));
  if (prevImg) {
    prevImg.src = base64;
    prevImg.classList.remove("hidden");
  }
  if (ph) ph.classList.add("hidden");
}

function compressImageBase64(dataUrl, callback) {
  const img = new Image();
  img.onload = function() {
    const canvas = document.getElementById("hiddenCompressCanvas") || document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    let width = img.width;
    let height = img.height;
    const maxDim = 1280;

    if (width > maxDim || height > maxDim) {
      if (width > height) {
        height = Math.round((height * maxDim) / width);
        width = maxDim;
      } else {
        width = Math.round((width * maxDim) / height);
        height = maxDim;
      }
    }

    canvas.width = width;
    canvas.height = height;
    ctx.drawImage(img, 0, 0, width, height);

    const compressed = canvas.toDataURL("image/jpeg", 0.75);
    callback(compressed);
  };
  img.src = dataUrl;
}

// Live Camera Functions
window.triggerCameraCapture = async function(targetType) {
  appState.activeCameraTarget = targetType;
  const modal = document.getElementById("cameraModal");
  const modalTitle = document.getElementById("cameraModalTitle");
  if (modalTitle) {
    const titles = {
      billPhoto: "ถ่ายภาพบิลค่าซ่อม / ใบเสร็จรับเงิน",
      defectPhoto: "ถ่ายภาพจุดที่ชำรุดก่อนซ่อม",
      partsPhoto: "ถ่ายภาพอะไหล่ที่เปลี่ยน",
      finishedPhoto: "ถ่ายภาพงานหลังซ่อมเสร็จ"
    };
    modalTitle.textContent = titles[targetType] || "ถ่ายภาพสด";
  }

  modal.classList.remove("hidden");
  startCameraStream();
};

window.closeCameraModal = function() {
  stopCameraStream();
  const modal = document.getElementById("cameraModal");
  if (modal) modal.classList.add("hidden");
  appState.activeCameraTarget = null;
};

window.switchCameraFacing = function() {
  appState.cameraFacingMode = appState.cameraFacingMode === 'environment' ? 'user' : 'environment';
  startCameraStream();
};

async function startCameraStream() {
  stopCameraStream();
  const video = document.getElementById("liveCameraVideo");
  if (!video) return;

  try {
    const constraints = {
      video: {
        facingMode: appState.cameraFacingMode,
        width: { ideal: 1280 },
        height: { ideal: 960 }
      },
      audio: false
    };
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    appState.activeCameraStream = stream;
    video.srcObject = stream;
  } catch (err) {
    console.error("Camera access error:", err);
    Swal.fire({
      icon: 'warning',
      title: 'ไม่สามารถเปิดกล้องได้',
      text: 'กรุณาตรวจสอบสิทธิ์การใช้งานกล้อง หรือใช้ปุ่ม "อัปโหลด" เพื่อเลือกภาพจากคลังรูปภาพ',
      confirmButtonColor: '#f59e0b'
    });
    closeCameraModal();
  }
}

function stopCameraStream() {
  if (appState.activeCameraStream) {
    appState.activeCameraStream.getTracks().forEach(t => t.stop());
    appState.activeCameraStream = null;
  }
}

window.snapCameraPhoto = function() {
  const video = document.getElementById("liveCameraVideo");
  if (!video || !appState.activeCameraTarget) return;

  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth || 640;
  canvas.height = video.videoHeight || 480;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  const raw = canvas.toDataURL("image/jpeg", 0.85);
  compressImageBase64(raw, (compressed) => {
    setPhotoData(appState.activeCameraTarget, compressed);
    closeCameraModal();
  });
};

// =========================================================================
// 4. FORM SUBMISSION TO GOOGLE APPS SCRIPT & GOOGLE SHEET
// =========================================================================

window.handleFormSubmit = async function(event) {
  event.preventDefault();

  const plateSelect = document.getElementById("vehiclePlate");
  const customInput = document.getElementById("customPlateInput");
  let plate = plateSelect.value === "OTHER" ? customInput.value.trim() : plateSelect.value.trim();

  if (!plate) {
    Swal.fire({ icon: 'warning', title: 'กรุณาระบุทะเบียนรถ', confirmButtonColor: '#f59e0b' });
    return;
  }

  const odo = document.getElementById("odometer").value.trim();
  const date = document.getElementById("inspectionDate").value;
  const driverName = document.getElementById("driverName").value.trim();
  const driverEmail = document.getElementById("driverEmail").value.trim();
  const symptom = document.getElementById("symptomDescription").value.trim();

  // ตรวจสอบความถูกต้องของรายการอะไหล่
  if (appState.partItems.length === 0 || !appState.partItems[0].name.trim()) {
    Swal.fire({
      icon: 'warning',
      title: 'กรุณาระบุรายการอะไหล่หรือบริการอย่างน้อย 1 รายการ',
      confirmButtonColor: '#f59e0b'
    });
    return;
  }

  // คำนวณยอดเงินรวม
  const totals = calculateFinancialTotals();

  // สร้างหรือดึง Ticket ID
  const ticketId = document.getElementById("formCurrentTicketId").textContent.trim() || generateNewTicketId();

  // ยืนยันการส่งข้อมูล
  const confirmResult = await Swal.fire({
    title: 'ยืนยันการบันทึกงานซ่อม?',
    html: `
      <div class="text-left text-xs text-slate-600 space-y-1.5 font-sans">
        <p><b>รหัสใบแจ้งซ่อม:</b> <span class="font-mono font-bold text-blue-900">${ticketId}</span></p>
        <p><b>ทะเบียนรถ:</b> <span class="font-bold text-amber-700">${plate}</span></p>
        <p><b>ผู้แจ้งซ่อม:</b> ${driverName}</p>
        <p><b>จำนวนรายการ:</b> ${appState.partItems.length} รายการ</p>
        <p><b>ยอดรวมสุทธิ:</b> <span class="font-mono font-bold text-emerald-600">${totals.grandTotal.toLocaleString()} บาท</span></p>
        <p class="text-[11px] text-slate-400 pt-1">* ข้อมูลจะถูกบันทึกลงชีต <b>Maintenance_log</b> และส่งรูปเข้า Google Drive</p>
      </div>
    `,
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: 'บันทึกข้อมูล',
    cancelButtonText: 'แก้ไขข้อมูลก่อน',
    confirmButtonColor: '#059669',
    cancelButtonColor: '#64748b'
  });

  if (!confirmResult.isConfirmed) return;

  // แสดง Loading Alert
  Swal.fire({
    title: 'กำลังส่งข้อมูลเข้าระบบ...',
    html: `
      <div class="text-xs text-slate-500 font-sans space-y-2 mt-2">
        <p>กำลังบันทึกข้อมูลลง Google Sheet และอัปโหลดไฟล์รูปภาพ/บิลไปยัง Google Drive...</p>
        <div class="w-8 h-8 mx-auto border-4 border-amber-500 border-t-transparent rounded-full animate-spin mt-2"></div>
      </div>
    `,
    allowOutsideClick: false,
    showConfirmButton: false
  });

  const payload = {
    action: "save_maintenance",
    ticketId: ticketId,
    inspectionDate: date,
    vehiclePlate: plate,
    vehicleType: document.getElementById("vehicleType").value,
    odometer: odo,
    driverName: driverName,
    driverEmail: driverEmail,
    driverPhone: document.getElementById("driverPhone").value.trim(),
    status: document.getElementById("ticketStatus").value,
    maintenanceType: document.getElementById("maintenanceType").value,
    systemAffected: document.getElementById("systemAffected").value,
    urgency: document.getElementById("urgency").value,
    symptom: symptom,
    garageName: document.getElementById("garageName").value.trim(),
    mechanicName: document.getElementById("mechanicName").value.trim(),
    garagePhone: document.getElementById("garagePhone").value.trim(),
    warrantyPeriod: document.getElementById("warrantyPeriod").value.trim(),
    remarks: document.getElementById("ticketRemarks").value.trim(),
    items: appState.partItems,
    partsCost: totals.partsSubtotal,
    laborCost: totals.laborSubtotal,
    vatAmount: totals.vatAmount,
    totalCost: totals.grandTotal,
    images: appState.capturedImages
  };

  try {
    const gasUrl = getMaintenanceGasUrl();
    const res = await fetch(gasUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    });
    const result = await res.json();

    if (result && result.status === 'success') {
      // บันทึกลง LocalStorage เสมอ เพื่อให้หน้าเว็บเรียกดูได้ทันที
      saveTicketToLocalCache(payload, result);

      Swal.fire({
        icon: 'success',
        title: 'บันทึกข้อมูลสำเร็จ!',
        html: `
          <div class="text-left text-xs text-slate-600 space-y-2 font-sans">
            <p>บันทึกข้อมูลลง Google Sheet <b class="text-emerald-700">Maintenance_log</b> เรียบร้อย</p>
            <p>รหัสใบแจ้งซ่อม: <b class="font-mono text-blue-900">${ticketId}</b></p>
            <div class="pt-2 flex flex-col gap-1.5">
              <a href="${result.sheetUrl || `https://docs.google.com/spreadsheets/d/${CONFIG.SPREADSHEET_ID}/edit`}" target="_blank"
                 class="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-lg text-center font-bold border border-emerald-200 transition">
                <i class="fa-solid fa-table-cells mr-1"></i> เปิดดู Google Sheet
              </a>
              <a href="${result.driveFolderUrl || `https://drive.google.com/drive/folders/${CONFIG.DRIVE_FOLDER_ID}`}" target="_blank"
                 class="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-800 rounded-lg text-center font-bold border border-blue-200 transition">
                <i class="fa-brands fa-google-drive mr-1"></i> เปิดดูรูปภาพและบิลใน Drive
              </a>
            </div>
          </div>
        `,
        confirmButtonText: 'ดูตัวอย่างใบแจ้งซ่อม A4',
        showCancelButton: true,
        cancelButtonText: 'ปิดหน้าต่าง',
        confirmButtonColor: '#f59e0b',
        cancelButtonColor: '#64748b'
      }).then((swalRes) => {
        if (swalRes.isConfirmed) {
          prepareA4PreviewFromTicket(payload);
          switchNavTab('print');
        } else {
          resetForm();
          switchNavTab('history');
        }
      });
    } else {
      throw new Error(result ? result.message : 'Unknown error from server');
    }
  } catch (netErr) {
    console.warn("GAS POST network warning, falling back to local cache:", netErr);
    // กรณีออฟไลน์ หรือยังไม่ได้กด Deploy GAS ให้บันทึกลง LocalCache เพื่อไม่ให้ข้อมูลสูญหาย
    saveTicketToLocalCache(payload, { localOnly: true });

    Swal.fire({
      icon: 'info',
      title: 'บันทึกข้อมูลในอุปกรณ์สำเร็จ (Local Stored)',
      html: `
        <div class="text-left text-xs text-slate-600 space-y-2">
          <p>บันทึกรหัสใบแจ้งซ่อม <b class="font-mono text-blue-900">${ticketId}</b> ในเครื่องแล้ว</p>
          <p class="text-slate-500">ท่านสามารถดูข้อมูล พิมพ์ใบแจ้งซ่อม A4 หรือส่งออกได้ทันที</p>
        </div>
      `,
      confirmButtonText: 'ดูใบแจ้งซ่อม A4',
      confirmButtonColor: '#f59e0b'
    }).then(() => {
      prepareA4PreviewFromTicket(payload);
      switchNavTab('print');
    });
  }
};

function saveTicketToLocalCache(payload, serverResult) {
  let logs = [];
  try {
    const raw = localStorage.getItem(CONFIG.STORAGE_KEY_LOGS);
    if (raw) logs = JSON.parse(raw);
  } catch (e) {}

  const cachedTicket = {
    ...payload,
    billUrl: serverResult.billUrl || payload.images?.billPhoto || "",
    defectUrl: serverResult.defectUrl || payload.images?.defectPhoto || "",
    partsUrl: serverResult.partsUrl || payload.images?.partsPhoto || "",
    finishedUrl: serverResult.finishedUrl || payload.images?.finishedPhoto || "",
    timestamp: new Date().toLocaleString('th-TH')
  };

  // กรองตัวซ้ำออกถ้ามี ticketId เดียวกัน
  logs = logs.filter(l => l.ticketId !== payload.ticketId);
  logs.unshift(cachedTicket);

  localStorage.setItem(CONFIG.STORAGE_KEY_LOGS, JSON.stringify(logs));
  loadMaintenanceLogs();
}

// =========================================================================
// 5. MAINTENANCE HISTORY & SEARCH TABLE
// =========================================================================

async function loadMaintenanceLogs() {
  let logs = [];
  
  // 1. ดึงจาก LocalStorage ก่อนเพื่อความเร็ว
  try {
    const raw = localStorage.getItem(CONFIG.STORAGE_KEY_LOGS);
    if (raw) logs = JSON.parse(raw);
  } catch (e) {}

  // 2. ถ้ายังไม่มี ให้ใส่ตัวอย่างเริ่มต้นของกองรถ TTMK ให้ดูเข้าใจง่าย
  if (logs.length === 0) {
    logs = getSeedMaintenanceLogs();
    localStorage.setItem(CONFIG.STORAGE_KEY_LOGS, JSON.stringify(logs));
  }

  appState.maintenanceLogs = logs;
  renderHistoryTable();
  updateHistoryKPIs();

  // 3. ซิงก์จาก Google Sheet ในเบื้องหลัง
  fetchMaintenanceLogs(false);
}

window.fetchMaintenanceLogs = async function(showToast = false) {
  const spinner = document.getElementById("syncSpinner");
  if (spinner) spinner.classList.add("animate-spin");

  try {
    const gasUrl = getMaintenanceGasUrl();
    const res = await fetch(`${gasUrl}?action=list_logs`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    const data = await res.json();

    if (data && data.status === 'success' && Array.isArray(data.logs)) {
      if (data.logs.length > 0) {
        // ผสานข้อมูลจาก Sheet เข้ากับแคชในเครื่อง
        const remoteIds = new Set(data.logs.map(l => l.ticketId));
        const localsToKeep = appState.maintenanceLogs.filter(l => !remoteIds.has(l.ticketId));
        appState.maintenanceLogs = [...data.logs, ...localsToKeep];
        localStorage.setItem(CONFIG.STORAGE_KEY_LOGS, JSON.stringify(appState.maintenanceLogs));
      }
      renderHistoryTable();
      updateHistoryKPIs();

      if (showToast) {
        Swal.fire({
          toast: true,
          position: 'top-end',
          icon: 'success',
          title: `ซิงก์ข้อมูล Sheet สำเร็จ (${data.total || data.logs.length} รายการ)`,
          showConfirmButton: false,
          timer: 1800
        });
      }
    }
  } catch (err) {
    console.warn("Sync logs notice:", err);
  } finally {
    if (spinner) spinner.classList.remove("animate-spin");
  }
};

window.renderHistoryTable = function() {
  const tbody = document.getElementById("historyTableBody");
  const emptyState = document.getElementById("historyEmptyState");
  if (!tbody) return;

  const searchKeyword = (document.getElementById("searchInput")?.value || "").toLowerCase().trim();
  const filterStatus = document.getElementById("filterStatus")?.value || "ALL";
  const filterPlate = document.getElementById("filterPlate")?.value || "ALL";

  let filtered = appState.maintenanceLogs.filter(log => {
    // กรองตาม Keyword
    const textAll = `${log.ticketId} ${log.vehiclePlate} ${log.driverName} ${log.symptom} ${log.garageName} ${log.mechanicName}`.toLowerCase();
    if (searchKeyword && !textAll.includes(searchKeyword)) return false;

    // กรองตามสถานะ
    if (filterStatus !== "ALL" && log.status !== filterStatus) return false;

    // กรองตามทะเบียนรถ
    if (filterPlate !== "ALL" && !log.vehiclePlate.includes(filterPlate)) return false;

    return true;
  });

  // อัปเดต badge นับจำนวน
  const badgeCount = document.getElementById("badgeHistoryCount");
  if (badgeCount) badgeCount.textContent = filtered.length;

  if (filtered.length === 0) {
    tbody.innerHTML = "";
    if (emptyState) emptyState.classList.remove("hidden");
    return;
  }

  if (emptyState) emptyState.classList.add("hidden");
  tbody.innerHTML = "";

  filtered.forEach(log => {
    const tr = document.createElement("tr");
    tr.className = "hover:bg-slate-50 transition border-b border-slate-100 text-slate-700";

    const statusBadge = getStatusBadgeHTML(log.status);
    const hasBill = log.billUrl || (log.images && log.images.billPhoto);
    const costText = Number(log.totalCost || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 });

    tr.innerHTML = `
      <td class="py-3 px-4">
        <span class="font-mono font-bold text-blue-900 block">${escapeHtml(log.ticketId)}</span>
        <span class="text-[10px] text-slate-400 font-mono">${escapeHtml(log.inspectionDate || log.date || '-')}</span>
      </td>
      <td class="py-3 px-3">
        <span class="font-bold text-slate-900 block">${escapeHtml(log.vehiclePlate)}</span>
        <span class="text-[10px] text-slate-400">${escapeHtml(log.vehicleType || '-')}</span>
      </td>
      <td class="py-3 px-3">
        <span class="font-semibold text-slate-800 block">${escapeHtml(log.driverName)}</span>
        <span class="text-[10px] text-slate-400 font-mono">${escapeHtml(log.driverPhone || '-')}</span>
      </td>
      <td class="py-3 px-3">
        <p class="font-medium text-slate-800 truncate max-w-[220px]" title="${escapeHtml(log.symptom)}">
          ${escapeHtml(log.symptom)}
        </p>
        <span class="text-[10px] text-slate-500 font-sans block">
          ${log.items?.length || log.itemsCount || 1} รายการ &bull; ${escapeHtml(log.garageName || 'อู่ทั่วไป')}
        </span>
      </td>
      <td class="py-3 px-3 text-right font-mono font-bold text-slate-900">
        ${costText} บ.
      </td>
      <td class="py-3 px-3 text-center">
        ${hasBill ? `
          <button type="button" onclick="previewBillPhotoModal('${log.ticketId}')" class="px-2 py-1 rounded bg-amber-100 hover:bg-amber-200 text-amber-800 font-bold text-[10px] transition" title="คลิกดูบิลค่าซ่อม">
            <i class="fa-solid fa-receipt mr-0.5"></i> บิลแนบ
          </button>
        ` : `
          <span class="text-slate-300 text-[10px]">-</span>
        `}
      </td>
      <td class="py-3 px-3 text-center">
        ${statusBadge}
      </td>
      <td class="py-3 px-3 text-center">
        <div class="flex items-center justify-center gap-1">
          <button type="button" onclick="viewTicketModal('${log.ticketId}')" class="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition" title="ดูรายละเอียด">
            <i class="fa-solid fa-eye text-xs"></i>
          </button>
          <button type="button" onclick="printTicketFromHistory('${log.ticketId}')" class="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg transition" title="พิมพ์ใบแจ้งซ่อม A4">
            <i class="fa-solid fa-print text-xs"></i>
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
};

function getStatusBadgeHTML(status) {
  if (status === 'ซ่อมเสร็จแล้ว') {
    return `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">ซ่อมเสร็จแล้ว</span>`;
  } else if (status === 'กำลังซ่อม') {
    return `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">อยู่ระหว่างซ่อม</span>`;
  } else if (status === 'รอดำเนินการ') {
    return `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">รอดำเนินการ</span>`;
  }
  return `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">${escapeHtml(status || 'ทั่วไป')}</span>`;
}

function updateHistoryKPIs() {
  const logs = appState.maintenanceLogs || [];
  let totalCost = 0;
  let pendingCount = 0;
  let completedCount = 0;

  logs.forEach(l => {
    totalCost += Number(l.totalCost || 0);
    if (l.status === 'รอดำเนินการ' || l.status === 'กำลังซ่อม') pendingCount++;
    if (l.status === 'ซ่อมเสร็จแล้ว' || l.status === 'ปิดงานสมบูรณ์') completedCount++;
  });

  const statTotalTickets = document.getElementById("statTotalTickets");
  const statPendingTickets = document.getElementById("statPendingTickets");
  const statCompletedTickets = document.getElementById("statCompletedTickets");
  const statTotalCost = document.getElementById("statTotalCost");

  if (statTotalTickets) statTotalTickets.textContent = logs.length;
  if (statPendingTickets) statPendingTickets.textContent = pendingCount;
  if (statCompletedTickets) statCompletedTickets.textContent = completedCount;
  if (statTotalCost) statTotalCost.textContent = totalCost.toLocaleString('th-TH', { maximumFractionDigits: 0 }) + " บ.";
}

// =========================================================================
// 6. VIEW DETAILS & BILL MODAL
// =========================================================================

window.viewTicketModal = function(ticketId) {
  const ticket = appState.maintenanceLogs.find(l => l.ticketId === ticketId);
  if (!ticket) return;

  const itemsHtml = (ticket.items && ticket.items.length > 0)
    ? ticket.items.map((it, idx) => `
        <div class="flex justify-between items-center py-1 border-b border-slate-100 text-xs">
          <span>${idx + 1}. <b>${escapeHtml(it.name)}</b> (${it.qty} ${it.unit})</span>
          <span class="font-mono font-bold">${Number(it.total || 0).toLocaleString()} บ.</span>
        </div>
      `).join("")
    : `<p class="text-xs text-slate-400">ไม่มีรายการแจกแจง</p>`;

  const billSrc = ticket.billUrl || (ticket.images && ticket.images.billPhoto);

  Swal.fire({
    title: `งานแจ้งซ่อม: ${ticket.ticketId}`,
    html: `
      <div class="text-left text-xs text-slate-700 space-y-3 font-sans max-h-[70vh] overflow-y-auto p-1">
        
        <div class="bg-slate-50 p-2.5 rounded-xl border border-slate-200 grid grid-cols-2 gap-2">
          <div><span class="text-slate-400">ทะเบียนรถ:</span> <b>${ticket.vehiclePlate}</b></div>
          <div><span class="text-slate-400">วันที่:</span> <b>${ticket.inspectionDate || ticket.date}</b></div>
          <div><span class="text-slate-400">ผู้แจ้ง:</span> ${ticket.driverName}</div>
          <div><span class="text-slate-400">เลขไมล์:</span> ${Number(ticket.odometer || 0).toLocaleString()} กม.</div>
          <div><span class="text-slate-400">ศูนย์บริการ:</span> ${ticket.garageName || '-'}</div>
          <div><span class="text-slate-400">สถานะ:</span> ${ticket.status}</div>
        </div>

        <div>
          <span class="font-bold text-slate-800 block mb-1">อาการเสีย / ปัญหา:</span>
          <p class="bg-amber-50 p-2 rounded-lg border border-amber-200 text-amber-900 leading-relaxed">${ticket.symptom}</p>
        </div>

        <div>
          <span class="font-bold text-slate-800 block mb-1">รายการอะไหล่และค่าแรง:</span>
          <div class="bg-white p-2 rounded-lg border border-slate-200 space-y-1">
            ${itemsHtml}
            <div class="flex justify-between items-center pt-2 font-bold text-emerald-700">
              <span>ยอดรวมทั้งสิ้น (สุทธิ):</span>
              <span class="font-mono text-sm">${Number(ticket.totalCost || 0).toLocaleString()} บาท</span>
            </div>
          </div>
        </div>

        ${billSrc ? `
          <div>
            <span class="font-bold text-slate-800 block mb-1">บิลค่าซ่อม / ใบเสร็จ:</span>
            <div class="w-full aspect-[4/3] bg-black rounded-lg overflow-hidden border border-slate-300">
              <img src="${billSrc}" alt="บิลค่าซ่อม" class="w-full h-full object-contain cursor-pointer" onclick="window.open('${billSrc}', '_blank')">
            </div>
          </div>
        ` : ''}

      </div>
    `,
    width: '32rem',
    showCancelButton: true,
    confirmButtonText: 'พิมพ์ใบแจ้งซ่อม A4',
    cancelButtonText: 'ปิด',
    confirmButtonColor: '#f59e0b',
    cancelButtonColor: '#64748b'
  }).then((res) => {
    if (res.isConfirmed) {
      printTicketFromHistory(ticketId);
    }
  });
};

window.previewBillPhotoModal = function(ticketId) {
  const ticket = appState.maintenanceLogs.find(l => l.ticketId === ticketId);
  if (!ticket) return;
  const billSrc = ticket.billUrl || (ticket.images && ticket.images.billPhoto);
  if (!billSrc) return;

  Swal.fire({
    title: `บิลค่าซ่อม: ${ticket.vehiclePlate}`,
    imageUrl: billSrc,
    imageAlt: 'บิลค่าซ่อม',
    showCloseButton: true,
    confirmButtonText: 'เปิดภาพขนาดเต็ม',
    confirmButtonColor: '#f59e0b'
  }).then((res) => {
    if (res.isConfirmed) window.open(billSrc, '_blank');
  });
};

// =========================================================================
// 7. PRINTABLE A4 JOB ORDER GENERATOR
// =========================================================================

window.printTicketFromHistory = function(ticketId) {
  const ticket = appState.maintenanceLogs.find(l => l.ticketId === ticketId);
  if (!ticket) return;
  prepareA4PreviewFromTicket(ticket);
  switchNavTab('print');
};

window.prepareA4PreviewFromCurrentForm = function() {
  const plateSelect = document.getElementById("vehiclePlate");
  const customInput = document.getElementById("customPlateInput");
  let plate = plateSelect.value === "OTHER" ? customInput.value.trim() : plateSelect.value.trim();

  const currentPayload = {
    ticketId: document.getElementById("formCurrentTicketId")?.textContent.trim() || generateNewTicketId(),
    inspectionDate: document.getElementById("inspectionDate")?.value || new Date().toISOString().split("T")[0],
    vehiclePlate: plate || "70-8899 กทม.",
    vehicleType: document.getElementById("vehicleType")?.value || "รถบรรทุก 6 ล้อตู้ทึบ",
    odometer: document.getElementById("odometer")?.value || "-",
    driverName: document.getElementById("driverName")?.value || "นายทวีศักดิ์ คำปก",
    maintenanceType: document.getElementById("maintenanceType")?.value || "ซ่อมบำรุงตามระยะทาง",
    systemAffected: document.getElementById("systemAffected")?.value || "ระบบเบรก",
    garageName: document.getElementById("garageName")?.value || "อู่มงคลการช่าง",
    mechanicName: document.getElementById("mechanicName")?.value || "ช่างผู้ตรวจซ่อม",
    garagePhone: document.getElementById("garagePhone")?.value || "-",
    symptom: document.getElementById("symptomDescription")?.value || "ไม่มีการระบุอาการเสีย",
    warrantyPeriod: document.getElementById("warrantyPeriod")?.value || "-",
    remarks: document.getElementById("ticketRemarks")?.value || "-",
    items: appState.partItems,
    images: appState.capturedImages
  };

  prepareA4PreviewFromTicket(currentPayload);
  switchNavTab('print');
};

function prepareA4PreviewFromTicket(ticket) {
  document.getElementById("printTicketId").textContent = ticket.ticketId || "MNT-NEW";
  document.getElementById("printDate").textContent = ticket.inspectionDate || ticket.date || "-";
  document.getElementById("printPlate").textContent = ticket.vehiclePlate || "-";
  document.getElementById("printVehicleType").textContent = ticket.vehicleType || "รถบรรทุก 6 ล้อ";
  document.getElementById("printOdo").textContent = Number(ticket.odometer || 0).toLocaleString() + " กม.";
  document.getElementById("printDriverName").textContent = ticket.driverName || "-";
  document.getElementById("printMntType").textContent = ticket.maintenanceType || "ซ่อมบำรุงตามระยะ";
  document.getElementById("printSystem").textContent = ticket.systemAffected || "ทั่วไป";
  document.getElementById("printGarage").textContent = ticket.garageName || "อู่ทั่วไป";
  document.getElementById("printMechanic").textContent = `${ticket.mechanicName || 'ช่างประจำอู่'} (โทร. ${ticket.garagePhone || '-'})`;
  document.getElementById("printSymptom").textContent = ticket.symptom || "-";
  document.getElementById("printWarranty").textContent = ticket.warrantyPeriod || "-";
  document.getElementById("printRemarks").textContent = ticket.remarks || "-";

  document.getElementById("printSignDriver").textContent = ticket.driverName || "พนักงานขับรถ";
  document.getElementById("printSignMechanic").textContent = ticket.mechanicName || "ช่างผู้ดำเนินการ";

  // ตารางรายการอะไหล่
  const tbody = document.getElementById("printPartsTableBody");
  tbody.innerHTML = "";

  const items = (ticket.items && ticket.items.length > 0) ? ticket.items : [
    { name: ticket.symptom || "งานบริการซ่อมบำรุง", category: "บริการ", qty: 1, unitPrice: ticket.totalCost || 0, total: ticket.totalCost || 0 }
  ];

  let sumParts = 0;
  let sumLabor = 0;

  items.forEach((it, idx) => {
    const total = Number(it.total || ((it.qty || 1) * (it.unitPrice || 0)));
    if ((it.category || '').includes("ค่าแรง") || (it.category || '').includes("บริการ")) {
      sumLabor += total;
    } else {
      sumParts += total;
    }

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="border border-slate-300 py-1.5 px-2 text-center font-mono">${idx + 1}</td>
      <td class="border border-slate-300 py-1.5 px-2 font-medium">${escapeHtml(it.name)}</td>
      <td class="border border-slate-300 py-1.5 px-2 text-slate-600">${escapeHtml(it.category || 'อะไหล่')}</td>
      <td class="border border-slate-300 py-1.5 px-2 text-center font-mono">${it.qty || 1} ${escapeHtml(it.unit || 'ชิ้น')}</td>
      <td class="border border-slate-300 py-1.5 px-2 text-right font-mono">${Number(it.unitPrice || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}</td>
      <td class="border border-slate-300 py-1.5 px-2 text-right font-mono font-bold">${total.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</td>
    `;
    tbody.appendChild(tr);
  });

  const vat = Number(ticket.vatAmount || 0);
  const totalGrand = Number(ticket.totalCost || (sumParts + sumLabor + vat));

  document.getElementById("printSumParts").textContent = sumParts.toLocaleString('th-TH', { minimumFractionDigits: 2 });
  document.getElementById("printSumLabor").textContent = sumLabor.toLocaleString('th-TH', { minimumFractionDigits: 2 });
  document.getElementById("printSumVat").textContent = vat.toLocaleString('th-TH', { minimumFractionDigits: 2 });
  document.getElementById("printSumTotal").textContent = totalGrand.toLocaleString('th-TH', { minimumFractionDigits: 2 }) + " บาท";

  // ภาพแนบในเอกสาร A4
  const photoStrip = document.getElementById("printPhotoStrip");
  photoStrip.innerHTML = "";
  const photos = [
    { label: "บิลค่าซ่อม / ใบเสร็จ", src: ticket.billUrl || (ticket.images && ticket.images.billPhoto) },
    { label: "จุดที่ชำรุด", src: ticket.defectUrl || (ticket.images && ticket.images.defectPhoto) },
    { label: "อะไหล่ที่เปลี่ยน", src: ticket.partsUrl || (ticket.images && ticket.images.partsPhoto) },
    { label: "หลังซ่อมเสร็จ", src: ticket.finishedUrl || (ticket.images && ticket.images.finishedPhoto) }
  ];

  photos.forEach(p => {
    if (p.src) {
      const div = document.createElement("div");
      div.className = "border border-slate-200 rounded p-1 text-center bg-slate-50";
      div.innerHTML = `
        <div class="aspect-[4/3] w-full overflow-hidden rounded bg-slate-200">
          <img src="${p.src}" alt="${p.label}" class="w-full h-full object-cover">
        </div>
        <p class="text-[9px] font-sans text-slate-600 mt-0.5 truncate">${p.label}</p>
      `;
      photoStrip.appendChild(div);
    }
  });

  if (photoStrip.children.length === 0) {
    photoStrip.classList.add("hidden");
  } else {
    photoStrip.classList.remove("hidden");
  }
}

// =========================================================================
// 8. TABS & FORM RESET
// =========================================================================

window.switchNavTab = function(tabName) {
  appState.currentTab = tabName;

  document.querySelectorAll(".nav-tab-btn").forEach(btn => {
    btn.classList.remove("active", "bg-amber-500", "text-white", "shadow-sm");
    btn.classList.add("text-slate-600", "hover:text-slate-900", "hover:bg-slate-100");
  });

  const activeBtn = document.getElementById("tabBtn" + capitalize(tabName));
  if (activeBtn) {
    activeBtn.classList.add("active", "bg-amber-500", "text-white", "shadow-sm");
    activeBtn.classList.remove("text-slate-600", "hover:text-slate-900", "hover:bg-slate-100");
  }

  document.querySelectorAll(".tab-section").forEach(sec => sec.classList.add("hidden"));
  const activeSec = document.getElementById("section" + capitalize(tabName));
  if (activeSec) activeSec.classList.remove("hidden");

  window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.resetForm = function() {
  document.getElementById("maintenanceForm").reset();
  initDateDefaults();
  initPartsTableDefaultRow();
  appState.capturedImages = { billPhoto: null, defectPhoto: null, partsPhoto: null, finishedPhoto: null };
  ['billPhoto', 'defectPhoto', 'partsPhoto', 'finishedPhoto'].forEach(clearPhoto);
  initDriverIdentity();
};

// =========================================================================
// 9. UTILITIES & INITIAL SEED DATA
// =========================================================================

function getMaintenanceGasUrl() {
  const localUrl = localStorage.getItem("TTMK_MAINTENANCE_GAS_URL");
  if (localUrl && localUrl.startsWith("https://script.google.com/macros/s/")) {
    return localUrl.trim();
  }
  return CONFIG.DEFAULT_GAS_URL;
}

function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function escapeHtml(text) {
  if (!text) return "";
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getSeedMaintenanceLogs() {
  return [
    {
      ticketId: "MNT-20261011-001",
      inspectionDate: "11/10/2026",
      vehiclePlate: "70-8899 กทม.",
      vehicleType: "รถบรรทุก 6 ล้อตู้ทึบ (ดีเซล)",
      odometer: "168,400",
      driverName: "ทวีศักดิ์ คำปก",
      driverEmail: "taweesak.kom@gmail.com",
      driverPhone: "062-3285963",
      maintenanceType: "ซ่อมบำรุงตามระยะทาง (PM)",
      systemAffected: "ระบบเบรกและลมเบรก",
      urgency: "ด่วน",
      symptom: "ผ้าเบรกหน้าซ้ายสึกบาง มีเสียงเสียดสีเวลาเหยียบเบรก ลมเบรกขึ้นช้าผิดปกติ",
      garageName: "อู่มงคลการช่าง สระบุรี",
      mechanicName: "ช่างสมชาย มั่งมี",
      garagePhone: "036-123456",
      status: "ซ่อมเสร็จแล้ว",
      itemsCount: 3,
      items: [
        { name: "ผ้าเบรกหน้าแท้ ISUZU FTR", category: "เปลี่ยนอะไหล่ใหม่ (แท้)", qty: 1, unit: "ชุด", unitPrice: 2400, total: 2400 },
        { name: "เจียรจานเบรกคู่หน้า", category: "ค่าแรงช่าง / บริการ", qty: 2, unit: "ข้าง", unitPrice: 400, total: 800 },
        { name: "ตรวจเช็กและเปลี่ยนซีลหม้อลมเบรก", category: "ซ่อม / ฟื้นฟูสภาพ", qty: 1, unit: "ชุด", unitPrice: 650, total: 650 }
      ],
      partsCost: 2400,
      laborCost: 1450,
      vatAmount: 269.5,
      totalCost: 4119.5,
      warrantyPeriod: "3 เดือน หรือ 10,000 กม.",
      remarks: "ทดสอบเบรกบนถนนจริงหลังซ่อม ประสิทธิภาพเบรกสมบูรณ์ 100%"
    },
    {
      ticketId: "MNT-20261008-002",
      inspectionDate: "08/10/2026",
      vehiclePlate: "72-8297 สระบุรี",
      vehicleType: "รถบรรทุก 6 ล้อ EV (ไฟฟ้า 100%)",
      odometer: "52,100",
      driverName: "วิทวัส สอนพรม",
      driverEmail: "nayboy.wit@gmail.com",
      driverPhone: "061-4632533",
      maintenanceType: "ซ่อมบำรุงตามระยะทาง (PM)",
      systemAffected: "แบตเตอรี่และระบบขับเคลื่อน EV",
      urgency: "ปกติ",
      symptom: "ตรวจเช็กตามรอบ 50,000 กม. เปลี่ยนน้ำยาหล่อเย็นระบบแบตเตอรี่ CATL และเช็กความตึงสายไฟแรงสูง",
      garageName: "ศูนย์บริการ BYD Commercial Vehicle สระบุรี",
      mechanicName: "วิศวกรธีรเดช",
      garagePhone: "036-999888",
      status: "ซ่อมเสร็จแล้ว",
      itemsCount: 2,
      items: [
        { name: "น้ำยาหล่อเย็นเกรดเฉพาะแบตเตอรี่ EV (Glycol)", category: "น้ำมัน / ของเหลว", qty: 10, unit: "ลิตร", unitPrice: 320, total: 3200 },
        { name: "ค่าบริการตรวจสอบระบบวิเคราะห์ OBD-EV High Voltage", category: "ค่าแรงช่าง / บริการ", qty: 1, unit: "งาน / เที่ยว", unitPrice: 1200, total: 1200 }
      ],
      partsCost: 3200,
      laborCost: 1200,
      vatAmount: 308,
      totalCost: 4708,
      warrantyPeriod: "6 เดือน",
      remarks: "สุขภาพแบตเตอรี่ State of Health (SOH) อยู่ที่ 98.4% สภาพดีเยี่ยม"
    },
    {
      ticketId: "MNT-20261005-003",
      inspectionDate: "05/10/2026",
      vehiclePlate: "70-9312 กทม.",
      vehicleType: "รถบรรทุก 6 ล้อคอก (ดีเซล)",
      odometer: "142,100",
      driverName: "อรรถพล ยอดสิงห์",
      driverEmail: "attapon.drv@gmail.com",
      driverPhone: "089-1122334",
      maintenanceType: "ซ่อมฉุกเฉิน / รถเสียระหว่างทาง (Breakdown)",
      systemAffected: "ยางและกระทะล้อ",
      urgency: "ด่วนที่สุด",
      symptom: "ยางหลังซ้ายเส้นนอกโดนเหล็กทิ่มรั่วบนทางหลวงสายเอเชีย",
      garageName: "บริการปะยางด่วน 24 ชม. อยุธยา",
      mechanicName: "ช่างเอกชัย",
      garagePhone: "081-5554433",
      status: "ซ่อมเสร็จแล้ว",
      itemsCount: 2,
      items: [
        { name: "ปะยางสตรีมร้อนพร้อมถอดใส่ถ่วงล้อ", category: "ค่าแรงช่าง / บริการ", qty: 1, unit: "เส้น", unitPrice: 450, total: 450 },
        { name: "เปลี่ยนจุ๊บลมเหล็กแรงดันสูง", category: "เปลี่ยนอะไหล่ใหม่ (แท้)", qty: 1, unit: "ชิ้น", unitPrice: 120, total: 120 }
      ],
      partsCost: 120,
      laborCost: 450,
      vatAmount: 0,
      totalCost: 570,
      warrantyPeriod: "1 เดือน",
      remarks: "เปลี่ยนยางอะไหล่และปะยางเสร็จ วิ่งต่อได้ตามกำหนด"
    }
  ];
}
