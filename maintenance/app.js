/**
 * =========================================================================
 * Mobile Driver App Logic - ระบบแจ้งซ่อมและบันทึกประวัติการบำรุงรักษา
 * หจก. ทั่วไทยขนส่งมงคล (Mr.Taweesak.kom - 062-3285963)
 * Mobile-First UX for Line OA & Truck Drivers
 * =========================================================================
 */

const CONFIG = {
  SPREADSHEET_ID: "1JM-i8_nrGR7-VDEY82QZ5l5JMJTIBOIsuqOSQSrcD3Y",
  DRIVE_FOLDER_ID: "1YRkTR9dMz0PxKgF60edVF56Ckq909fMF",
  SHEET_NAME: "Maintenance_log",
  DEFAULT_GAS_URL: "https://script.google.com/macros/s/AKfycbwvZxSw_p62y6ZwegF8iUiEdxyEJrF01yB37AumDHwgLcSFBoRSZUmwgvdtLJ-6hCFE/exec",
  STORAGE_KEY_LOGS: "TTMK_MAINTENANCE_LOGS",
  STORAGE_KEY_DRIVER: "TTMK_SAVED_DRIVER_EMAIL"
};

// Application State
const appState = {
  partItems: [],
  capturedImages: {
    billPhoto: null,
    defectPhoto: null
  },
  activeCameraStream: null,
  activeCameraTarget: null,
  cameraFacingMode: 'environment',
  currentDriver: null
};

// =========================================================================
// 1. INITIALIZATION ON DOM READY
// =========================================================================
document.addEventListener("DOMContentLoaded", () => {
  initDateDefaults();
  initDriverIdentity();
  initDefaultMobilePartCard();
});

function initDateDefaults() {
  const dateInput = document.getElementById("inspectionDate");
  if (dateInput) {
    dateInput.value = new Date().toISOString().split("T")[0];
  }
  generateNewTicketId();
}

function generateNewTicketId() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const rnd = Math.floor(100 + Math.random() * 900);
  const ticketId = `MNT-${y}${m}${day}-${rnd}`;
  const el = document.getElementById("formCurrentTicketId");
  if (el) el.textContent = ticketId;
  return ticketId;
}

/**
 * ซิงก์ตัวตนพนักงานขับรถจากระบบความจำเดียวกันกับ CheckTruck และ Alcohol
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
    if (headerName) headerName.textContent = "ระบุคนขับ";
    if (dot) dot.className = "w-2 h-2 rounded-full bg-slate-500";
  } else {
    if (headerName) headerName.textContent = driver.driverName || driver.name || driver.email;
    if (dot) dot.className = "w-2 h-2 rounded-full bg-emerald-400 animate-pulse";
  }
}

window.promptSwitchDriver = function() {
  Swal.fire({
    title: 'ระบุตัวตนคนขับรถ',
    html: `
      <div class="text-left text-xs text-slate-300 space-y-2">
        <p>กรุณากรอกอีเมลของท่านเพื่อจำชื่อและทะเบียนรถอัตโนมัติ:</p>
        <input type="email" id="swalDriverEmailInput" placeholder="เช่น driver@gmail.com"
               class="w-full p-2.5 rounded-xl border border-slate-700 bg-slate-900 text-white text-xs font-mono outline-none focus:border-amber-500">
      </div>
    `,
    background: '#0f172a',
    color: '#fff',
    showCancelButton: true,
    confirmButtonText: 'ยืนยัน',
    cancelButtonText: 'ยกเลิก',
    confirmButtonColor: '#f59e0b',
    cancelButtonColor: '#64748b',
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
        title: 'บันทึกคนขับเรียบร้อย',
        timer: 1200,
        showConfirmButton: false,
        background: '#0f172a',
        color: '#fff'
      });
    }
  });
};

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

  if (plateSelect.value.includes("EV") || plateSelect.value.includes("73-1735") || plateSelect.value.includes("72-8297") || plateSelect.value.includes("72-5079") || plateSelect.value.includes("61-5463")) {
    vehicleType.value = "รถบรรทุก 6 ล้อ EV (ไฟฟ้า 100%)";
  } else if (plateSelect.value.includes("คอก")) {
    vehicleType.value = "รถบรรทุก 6 ล้อคอกผ้าใบ (ดีเซล)";
  } else {
    vehicleType.value = "รถบรรทุก 6 ล้อตู้ทึบ (ดีเซล)";
  }
};

// =========================================================================
// 2. QUICK CHIP SELECTION & SYMPTOM TAGS
// =========================================================================

window.selectSystemChip = function(systemName, btn) {
  document.getElementById("systemAffected").value = systemName;
  document.querySelectorAll(".sys-chip").forEach(el => {
    el.className = "sys-chip py-2 px-1.5 rounded-xl border text-[11px] font-bold flex flex-col items-center justify-center gap-0.5 transition active:scale-95 border-slate-700 bg-slate-800 text-slate-300";
  });
  if (btn) {
    btn.className = "sys-chip py-2 px-1.5 rounded-xl border text-[11px] font-bold flex flex-col items-center justify-center gap-0.5 transition active:scale-95 border-amber-500 bg-amber-500/20 text-amber-300 shadow-sm";
  }
};

window.appendSymptomText = function(text) {
  const textarea = document.getElementById("symptomDescription");
  if (!textarea) return;
  const current = textarea.value.trim();
  if (!current) {
    textarea.value = text;
  } else if (!current.includes(text)) {
    textarea.value = current + ", " + text;
  }
  textarea.focus();
};

// =========================================================================
// 3. MOBILE DYNAMIC PARTS CARDS (+ เพิ่มรายการ)
// =========================================================================

function initDefaultMobilePartCard() {
  appState.partItems = [];
  addMobilePartCard({
    name: "ผ้าเบรกหน้า (แท้)",
    category: "ระบบเบรก / ลม",
    qty: 1,
    unit: "ชุด",
    unitPrice: 2400
  });
}

window.addMobilePartCard = function(initData = null) {
  const newId = "part_" + Date.now() + "_" + Math.floor(Math.random() * 1000);
  const item = {
    id: newId,
    name: initData ? initData.name : "",
    category: initData ? initData.category : "เปลี่ยนอะไหล่ใหม่",
    qty: initData ? initData.qty : 1,
    unit: initData ? initData.unit : "ชิ้น",
    unitPrice: initData ? initData.unitPrice : 0,
    total: 0
  };
  item.total = Number(item.qty || 1) * Number(item.unitPrice || 0);

  appState.partItems.push(item);
  renderMobilePartsCards();
  calculateFinancialTotals();
};

window.removeMobilePartCard = function(id) {
  if (appState.partItems.length <= 1) {
    Swal.fire({
      icon: 'info',
      title: 'ต้องมีรายการอย่างน้อย 1 รายการ',
      text: 'หากเป็นงานบริการ สามารถระบุเป็นรายการค่าแรงหรือค่าซ่อมได้ครับ',
      timer: 1500,
      showConfirmButton: false,
      background: '#0f172a',
      color: '#fff'
    });
    return;
  }
  appState.partItems = appState.partItems.filter(it => it.id !== id);
  renderMobilePartsCards();
  calculateFinancialTotals();
};

window.updateMobilePartField = function(id, field, value) {
  const item = appState.partItems.find(it => it.id === id);
  if (!item) return;

  if (field === 'qty' || field === 'unitPrice') {
    item[field] = parseFloat(value) || 0;
    item.total = item.qty * item.unitPrice;
    const totalEl = document.getElementById(`card_total_${id}`);
    if (totalEl) totalEl.textContent = Number(item.total).toLocaleString('th-TH', { minimumFractionDigits: 2 }) + " บ.";
  } else {
    item[field] = value;
  }

  calculateFinancialTotals();
};

window.stepQty = function(id, delta) {
  const item = appState.partItems.find(it => it.id === id);
  if (!item) return;
  const current = Number(item.qty || 1);
  const next = Math.max(1, current + delta);
  item.qty = next;
  item.total = item.qty * item.unitPrice;

  const inputEl = document.getElementById(`input_qty_${id}`);
  if (inputEl) inputEl.value = next;
  const totalEl = document.getElementById(`card_total_${id}`);
  if (totalEl) totalEl.textContent = Number(item.total).toLocaleString('th-TH', { minimumFractionDigits: 2 }) + " บ.";

  calculateFinancialTotals();
};

function renderMobilePartsCards() {
  const container = document.getElementById("mobilePartsContainer");
  if (!container) return;

  container.innerHTML = "";

  appState.partItems.forEach((item, index) => {
    const card = document.createElement("div");
    card.className = "bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2 relative";

    card.innerHTML = `
      <!-- Card Top: Item # & Remove Button -->
      <div class="flex items-center justify-between text-xs pb-1.5 border-b border-slate-800">
        <span class="font-bold text-amber-400 flex items-center gap-1">
          <i class="fa-solid fa-tag text-[10px]"></i> รายการที่ ${index + 1}
        </span>
        <button type="button" onclick="removeMobilePartCard('${item.id}')"
                class="text-slate-400 hover:text-red-400 text-xs px-1.5 py-0.5 rounded transition">
          <i class="fa-solid fa-trash-can mr-0.5"></i> ลบ
        </button>
      </div>

      <!-- Item Name Input (Big & Clear) -->
      <div>
        <input type="text" value="${escapeHtml(item.name)}" placeholder="ชื่ออะไหล่ หรือ งานบริการ เช่น ผ้าเบรกหน้า..."
               onchange="updateMobilePartField('${item.id}', 'name', this.value)"
               class="w-full px-3 py-2 rounded-xl border border-slate-700 bg-slate-900 text-white font-bold text-xs outline-none focus:border-amber-500">
      </div>

      <!-- Quantity Stepper & Price Row -->
      <div class="grid grid-cols-2 gap-2 text-xs">
        <!-- Qty with Touch Stepper [-] [+] -->
        <div class="flex flex-col">
          <span class="text-[10px] text-slate-400 mb-1">จำนวน</span>
          <div class="flex items-center bg-slate-900 border border-slate-700 rounded-xl overflow-hidden">
            <button type="button" onclick="stepQty('${item.id}', -1)"
                    class="w-9 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold active:scale-95 text-xs">-</button>
            <input type="number" id="input_qty_${item.id}" min="1" value="${item.qty}"
                   oninput="updateMobilePartField('${item.id}', 'qty', this.value)"
                   class="w-full text-center bg-transparent text-white font-digital font-bold text-sm outline-none">
            <button type="button" onclick="stepQty('${item.id}', 1)"
                    class="w-9 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold active:scale-95 text-xs">+</button>
          </div>
        </div>

        <!-- Unit Price Input -->
        <div class="flex flex-col">
          <span class="text-[10px] text-slate-400 mb-1">ราคา/หน่วย (บาท)</span>
          <input type="number" min="0" step="any" value="${item.unitPrice}" placeholder="0" inputmode="decimal"
                 oninput="updateMobilePartField('${item.id}', 'unitPrice', this.value)"
                 class="w-full px-3 py-2 text-right bg-slate-900 border border-slate-700 rounded-xl text-white font-digital font-bold text-sm outline-none focus:border-amber-500">
        </div>
      </div>

      <!-- Line Total Display -->
      <div class="flex items-center justify-between pt-1 border-t border-slate-800/80 text-xs">
        <span class="text-[11px] text-slate-400">รวมรายการนี้:</span>
        <span class="font-digital font-bold text-amber-300" id="card_total_${item.id}">
          ${Number(item.total).toLocaleString('th-TH', { minimumFractionDigits: 2 })} บ.
        </span>
      </div>
    `;
    container.appendChild(card);
  });
}

function calculateFinancialTotals() {
  let partsSubtotal = 0;
  let laborSubtotal = 0;

  appState.partItems.forEach(item => {
    const lineTotal = Number(item.qty || 0) * Number(item.unitPrice || 0);
    if ((item.name || '').includes("ค่าแรง") || (item.name || '').includes("บริการ")) {
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

  if (sumPartsEl) sumPartsEl.textContent = partsSubtotal.toLocaleString('th-TH', { minimumFractionDigits: 2 }) + " บ.";
  if (sumLaborEl) sumLaborEl.textContent = laborSubtotal.toLocaleString('th-TH', { minimumFractionDigits: 2 }) + " บ.";
  if (sumVatEl) sumVatEl.textContent = vatAmount.toLocaleString('th-TH', { minimumFractionDigits: 2 }) + " บ.";
  if (sumTotalEl) sumTotalEl.textContent = grandTotal.toLocaleString('th-TH', { minimumFractionDigits: 2 }) + " บ.";

  return { partsSubtotal, laborSubtotal, vatAmount, grandTotal };
}

// =========================================================================
// 4. MOBILE CAMERA & IMAGE COMPRESSION
// =========================================================================

window.triggerMobileCamera = function(targetType) {
  appState.activeCameraTarget = targetType;
  const modal = document.getElementById("cameraModal");
  const modalTitle = document.getElementById("cameraModalTitle");
  if (modalTitle) {
    modalTitle.textContent = targetType === 'billPhoto' ? 'ถ่ายรูปบิลค่าซ่อม / ใบเสร็จ' : 'ถ่ายรูปจุดชำรุด';
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
    console.error("Camera error:", err);
    Swal.fire({
      icon: 'warning',
      title: 'ไม่สามารถเปิดกล้องได้',
      text: 'กรุณาแตะปุ่ม "เลือกภาพ" เพื่อถ่ายผ่านแอปกล้องมือถือ',
      background: '#0f172a',
      color: '#fff',
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

window.handleFileUpload = function(event, targetType) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    compressImageBase64(e.target.result, (compressed) => {
      setPhotoData(targetType, compressed);
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
    const maxDim = 1200;

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

    const compressed = canvas.toDataURL("image/jpeg", 0.72);
    callback(compressed);
  };
  img.src = dataUrl;
}

// =========================================================================
// 5. SUBMIT TO GOOGLE APPS SCRIPT & CLOUD STORAGE
// =========================================================================

window.handleMobileFormSubmit = async function(event) {
  event.preventDefault();

  const plateSelect = document.getElementById("vehiclePlate");
  const customInput = document.getElementById("customPlateInput");
  let plate = plateSelect.value === "OTHER" ? customInput.value.trim() : plateSelect.value.trim();

  if (!plate) {
    Swal.fire({ icon: 'warning', title: 'กรุณาเลือกทะเบียนรถ', background: '#0f172a', color: '#fff', confirmButtonColor: '#f59e0b' });
    return;
  }

  const odo = document.getElementById("odometer").value.trim();
  const date = document.getElementById("inspectionDate").value;
  const symptom = document.getElementById("symptomDescription").value.trim();

  // ตรวจสอบรายการอะไหล่
  if (appState.partItems.length === 0 || !appState.partItems[0].name.trim()) {
    Swal.fire({
      icon: 'warning',
      title: 'กรุณากรอกรายการอะไหล่หรือค่าซ่อมอย่างน้อย 1 รายการ',
      background: '#0f172a',
      color: '#fff',
      confirmButtonColor: '#f59e0b'
    });
    return;
  }

  // คำนวณยอดเงินรวม
  const totals = calculateFinancialTotals();
  const ticketId = document.getElementById("formCurrentTicketId").textContent.trim() || generateNewTicketId();
  const driverName = document.getElementById("driverName").value.trim() || "พนักงานขับรถ";

  // ยืนยันการส่งข้อมูล
  const confirmResult = await Swal.fire({
    title: 'ยืนยันส่งข้อมูลแจ้งซ่อม?',
    html: `
      <div class="text-left text-xs text-slate-300 space-y-1.5">
        <p><b>ทะเบียน:</b> <span class="font-bold text-amber-400">${plate}</span></p>
        <p><b>เลขไมล์:</b> ${Number(odo).toLocaleString()} กม.</p>
        <p><b>อาการ:</b> ${escapeHtml(symptom)}</p>
        <p><b>จำนวนอะไหล่:</b> ${appState.partItems.length} รายการ</p>
        <p><b>ยอดรวมสุทธิ:</b> <span class="font-digital text-emerald-400 font-bold">${totals.grandTotal.toLocaleString()} บาท</span></p>
      </div>
    `,
    icon: 'question',
    background: '#0f172a',
    color: '#fff',
    showCancelButton: true,
    confirmButtonText: 'ยืนยันและส่งข้อมูล',
    cancelButtonText: 'กลับไปแก้ไข',
    confirmButtonColor: '#ea580c',
    cancelButtonColor: '#64748b'
  });

  if (!confirmResult.isConfirmed) return;

  // Loader
  Swal.fire({
    title: 'กำลังส่งข้อมูลแจ้งซ่อม...',
    html: `
      <div class="text-xs text-slate-400 space-y-2 mt-2">
        <p>กำลังบันทึกลง Sheet Maintenance_log และอัปโหลดบิลเข้า Google Drive...</p>
        <div class="w-8 h-8 mx-auto border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    `,
    background: '#0f172a',
    color: '#fff',
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
    driverEmail: document.getElementById("driverEmail").value.trim(),
    driverPhone: document.getElementById("driverPhone").value.trim(),
    status: document.getElementById("ticketStatus").value,
    maintenanceType: document.getElementById("maintenanceType").value,
    systemAffected: document.getElementById("systemAffected").value,
    urgency: document.getElementById("urgency").value,
    symptom: symptom,
    garageName: document.getElementById("garageName").value.trim(),
    mechanicName: document.getElementById("mechanicName").value.trim(),
    items: appState.partItems,
    partsCost: totals.partsSubtotal,
    laborCost: totals.laborSubtotal,
    vatAmount: totals.vatAmount,
    totalCost: totals.grandTotal,
    images: appState.capturedImages
  };

  try {
    const gasUrl = CONFIG.DEFAULT_GAS_URL;
    const res = await fetch(gasUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    });
    const result = await res.json();

    if (result && result.status === 'success') {
      saveLocalTicketCache(payload, result);

      Swal.fire({
        icon: 'success',
        title: 'ส่งแจ้งซ่อมสำเร็จ!',
        html: `
          <div class="text-left text-xs text-slate-300 space-y-2">
            <p>บันทึกงานซ่อมรหัส: <b class="font-digital text-amber-400">${ticketId}</b></p>
            <p>ยอดรวม: <b class="text-emerald-400">${totals.grandTotal.toLocaleString()} บาท</b></p>
            <p class="text-[10px] text-slate-400">* ระบบจัดเก็บข้อมูลลง Google Sheet และ Google Drive เรียบร้อยแล้ว</p>
          </div>
        `,
        background: '#0f172a',
        color: '#fff',
        confirmButtonText: 'เสร็จสิ้น (แจ้งซ่อมคันอื่น)',
        confirmButtonColor: '#ea580c'
      }).then(() => {
        resetMobileForm();
      });
    } else {
      throw new Error(result?.message || 'Server error');
    }
  } catch (err) {
    console.warn("GAS save fallback to local:", err);
    saveLocalTicketCache(payload, { localOnly: true });

    Swal.fire({
      icon: 'success',
      title: 'บันทึกข้อมูลเรียบร้อย (เครื่องจำไว้แล้ว)',
      html: `
        <div class="text-left text-xs text-slate-300 space-y-1.5">
          <p>รหัสแจ้งซ่อม: <b class="font-digital text-amber-400">${ticketId}</b></p>
          <p class="text-slate-400">ข้อมูลและรูปภาพถูกบันทึกในอุปกรณ์เรียบร้อยแล้ว</p>
        </div>
      `,
      background: '#0f172a',
      color: '#fff',
      confirmButtonText: 'ตกลง',
      confirmButtonColor: '#ea580c'
    }).then(() => {
      resetMobileForm();
    });
  }
};

function saveLocalTicketCache(payload, serverResult) {
  let logs = [];
  try {
    const raw = localStorage.getItem(CONFIG.STORAGE_KEY_LOGS);
    if (raw) logs = JSON.parse(raw);
  } catch (e) {}

  const item = {
    ...payload,
    billUrl: serverResult.billUrl || payload.images?.billPhoto || "",
    defectUrl: serverResult.defectUrl || payload.images?.defectPhoto || "",
    timestamp: new Date().toLocaleString('th-TH')
  };

  logs = logs.filter(l => l.ticketId !== payload.ticketId);
  logs.unshift(item);
  localStorage.setItem(CONFIG.STORAGE_KEY_LOGS, JSON.stringify(logs));
}

function resetMobileForm() {
  document.getElementById("mobileMntForm").reset();
  initDateDefaults();
  initDriverIdentity();
  initDefaultMobilePartCard();
  appState.capturedImages = { billPhoto: null, defectPhoto: null };
  clearPhoto('billPhoto');
  clearPhoto('defectPhoto');
}

// =========================================================================
// 6. QUICK DRIVER HISTORY MODAL
// =========================================================================

window.openDriverHistoryModal = function() {
  let logs = [];
  try {
    const raw = localStorage.getItem(CONFIG.STORAGE_KEY_LOGS);
    if (raw) logs = JSON.parse(raw);
  } catch (e) {}

  if (logs.length === 0) {
    Swal.fire({
      icon: 'info',
      title: 'ยังไม่มีประวัติการแจ้งซ่อม',
      text: 'เมื่อท่านส่งแจ้งซ่อม ข้อมูลจะปรากฏในหน้านี้ครับ',
      background: '#0f172a',
      color: '#fff',
      confirmButtonColor: '#f59e0b'
    });
    return;
  }

  const listHtml = logs.slice(0, 5).map(l => `
    <div class="bg-slate-900 p-2.5 rounded-xl border border-slate-800 text-left space-y-1">
      <div class="flex justify-between items-center text-xs">
        <span class="font-bold text-amber-400">${l.vehiclePlate}</span>
        <span class="font-digital text-slate-400 text-[10px]">${l.inspectionDate || l.date || ''}</span>
      </div>
      <p class="text-xs text-white truncate">${escapeHtml(l.symptom)}</p>
      <div class="flex justify-between items-center text-[11px] pt-1 border-t border-slate-800 text-slate-400">
        <span>${l.items?.length || 1} รายการ &bull; ${escapeHtml(l.garageName || 'อู่ทั่วไป')}</span>
        <span class="font-digital text-emerald-400 font-bold">${Number(l.totalCost || 0).toLocaleString()} บ.</span>
      </div>
    </div>
  `).join("");

  Swal.fire({
    title: 'ประวัติการแจ้งซ่อมล่าสุด',
    html: `
      <div class="space-y-2 max-h-[60vh] overflow-y-auto no-scrollbar pt-1">
        ${listHtml}
      </div>
    `,
    background: '#0f172a',
    color: '#fff',
    confirmButtonText: 'ปิด',
    confirmButtonColor: '#64748b'
  });
};

// Utilities
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
