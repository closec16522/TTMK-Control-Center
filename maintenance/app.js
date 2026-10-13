/**
 * =========================================================================
 * Mobile Driver App Logic - ระบบแจ้งซ่อมบำรุงรถบรรทุก 6 ล้อ TTMK
 * หจก. ทั่วไทยขนส่งมงคล (Mr.Taweesak.kom - 062-3285963)
 * Mobile-First 2-Step Wizard & Auto-Registered Drivers Synchronization
 * =========================================================================
 */

const CONFIG = {
  SPREADSHEET_ID: "1JM-i8_nrGR7-VDEY82QZ5l5JMJTIBOIsuqOSQSrcD3Y",
  DRIVE_FOLDER_ID: "1YRkTR9dMz0PxKgF60edVF56Ckq909fMF",
  SHEET_NAME: "Maintenance_log",
  DRIVERS_SHEET: "Registered_Drivers",
  DEFAULT_GAS_URL: "https://script.google.com/macros/s/AKfycbwvZxSw_p62y6ZwegF8iUiEdxyEJrF01yB37AumDHwgLcSFBoRSZUmwgvdtLJ-6hCFE/exec",
  STORAGE_KEY_LOGS: "TTMK_MAINTENANCE_LOGS",
  STORAGE_KEY_DRIVER: "TTMK_SAVED_DRIVER_EMAIL",
  STORAGE_KEY_GARAGES: "TTMK_SAVED_GARAGES"
};

// Known Fleet Plates mapping for clean display
const FLEET_PLATES = [
  { plate: "70-8899 กทม.", short: "70-8899", brand: "ISUZU", type: "รถบรรทุก 6 ล้อตู้ทึบ (ดีเซล)" },
  { plate: "70-9312 กทม.", short: "70-9312", brand: "HINO", type: "รถบรรทุก 6 ล้อคอก (ดีเซล)" },
  { plate: "72-1979 สระบุรี", short: "72-1979", brand: "ISUZU", type: "รถบรรทุก 6 ล้อตู้ทึบ (ดีเซล)" },
  { plate: "72-8139 สระบุรี", short: "72-8139", brand: "ISUZU", type: "รถบรรทุก 6 ล้อตู้แห้ง (ดีเซล)" },
  { plate: "8กส1201 กทม.", short: "8กส1201", brand: "HINO", type: "รถบรรทุก 6 ล้อตู้ทึบ (ดีเซล)" },
  { plate: "70-5544 กทม.", short: "70-5544", brand: "ISUZU", type: "รถบรรทุก 6 ล้อตู้ทึบ (ดีเซล)" },
  { plate: "72-3199 สระบุรี", short: "72-3199", brand: "HINO", type: "รถบรรทุก 6 ล้อคอก (ดีเซล)" },
  { plate: "71-6543 อยุธยา", short: "71-6543", brand: "ISUZU", type: "รถบรรทุก 6 ล้อตู้ทึบ (ดีเซล)" },
  { plate: "73-2415 สระบุรี", short: "73-2415", brand: "ISUZU", type: "รถบรรทุก 6 ล้อตู้ทึบ (ดีเซล)" },
  { plate: "71-9820 กทม.", short: "71-9820", brand: "HINO", type: "รถบรรทุก 6 ล้อคอก (ดีเซล)" },
  { plate: "72-4411 นครปฐม", short: "72-4411", brand: "ISUZU", type: "รถบรรทุก 6 ล้อตู้แห้ง (ดีเซล)" },
  { plate: "73-9081 สระบุรี", short: "73-9081", brand: "ISUZU", type: "รถบรรทุก 6 ล้อตู้ทึบ (ดีเซล)" },
  { plate: "70-1122 กทม.", short: "70-1122", brand: "HINO", type: "รถบรรทุก 6 ล้อตู้ทึบ (ดีเซล)" },
  { plate: "72-9901 ฉะเชิงเทรา", short: "72-9901", brand: "ISUZU", type: "รถบรรทุก 6 ล้อคอก (ดีเซล)" },
  { plate: "73-0819 สระบุรี", short: "73-0819", brand: "ISUZU", type: "รถบรรทุก 6 ล้อตู้ทึบ (ดีเซล)" },
  { plate: "71-8686 สระบุรี", short: "71-8686", brand: "HINO", type: "รถบรรทุก 6 ล้อคอก (ดีเซล)" },
  { plate: "70-4713 สระบุรี", short: "70-4713", brand: "ISUZU", type: "รถบรรทุก 6 ล้อตู้ทึบ (ดีเซล)" },
  { plate: "73-1366 สระบุรี", short: "73-1366", brand: "HINO", type: "รถบรรทุก 6 ล้อคอก (ดีเซล)" },
  { plate: "73-2705 สระบุรี", short: "73-2705", brand: "ISUZU", type: "รถบรรทุก 6 ล้อตู้ทึบ (ดีเซล)" },
  { plate: "73-1735 สระบุรี", short: "73-1735", brand: "BYD T8", type: "รถบรรทุก 6 ล้อตู้ทึบ (EV 100%)" },
  { plate: "72-8297 สระบุรี", short: "72-8297", brand: "BYD T8", type: "รถบรรทุก 6 ล้อคอกผ้าใบ (EV 100%)" },
  { plate: "72-5079 สระบุรี", short: "72-5079", brand: "NEX Point", type: "รถบรรทุก 6 ล้อตู้แห้ง (EV 100%)" },
  { plate: "61-5463 กทม.", short: "61-5463", brand: "NEX Point", type: "รถบรรทุก 6 ล้อตู้ทึบ (EV 100%)" }
];

// Application State
const appState = {
  currentStep: 1,
  partItems: [],
  capturedImages: {
    billPhoto: null,
    defectPhoto: null
  },
  activeCameraStream: null,
  activeCameraTarget: null,
  cameraFacingMode: 'environment',
  currentDriver: null,
  registeredDrivers: [],
  garagesList: []
};

// =========================================================================
// 1. INITIALIZATION ON DOM READY
// =========================================================================
document.addEventListener("DOMContentLoaded", async () => {
  initDateDefaults();
  initDefaultMobilePartCard();
  await loadRegisteredDrivers();
  await loadGaragesList();
  initDriverIdentity();
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

// =========================================================================
// 2. 2-STEP MOBILE WIZARD CONTROLLER
// =========================================================================

window.goToStep = function(step) {
  if (step === 2) {
    // Validate Step 1 inputs before advancing
    const plateInput = document.getElementById("vehiclePlate");
    const assignedDisplay = document.getElementById("assignedPlateDisplay");
    let plate = (plateInput?.value || "").trim();
    if (!plate && assignedDisplay && assignedDisplay.textContent) {
      plate = assignedDisplay.textContent.replace(/\(ขับแทน\)/g, '').trim();
      if (plateInput) plateInput.value = plate;
    }

    if (!plate || plate.includes("กำลังโหลด") || plate.includes("แตะเพื่อระบุ")) {
      Swal.fire({
        icon: 'warning',
        title: 'กรุณาระบุตัวตนผู้ขับ',
        text: 'กรุณาแตะที่ชื่อผู้ใช้งานเพื่อเข้าสู่ระบบ หรือแตะสลับคัน',
        background: '#0f172a',
        color: '#fff',
        confirmButtonColor: '#f59e0b'
      });
      return;
    }

    const odo = document.getElementById("odometer")?.value?.trim();
    const symptom = document.getElementById("symptomDescription")?.value?.trim();

    if (!odo || Number(odo) <= 0) {
      Swal.fire({
        icon: 'warning',
        title: 'กรุณากรอกเลขไมล์ปัจจุบัน',
        text: 'ระบุเลขไมล์สะสมของรถ เช่น 168450',
        background: '#0f172a',
        color: '#fff',
        confirmButtonColor: '#f59e0b'
      });
      document.getElementById("odometer")?.focus();
      return;
    }

    if (!symptom || symptom.length < 3) {
      Swal.fire({
        icon: 'warning',
        title: 'กรุณากรอกรายละเอียดอาการเสีย',
        text: 'พิมพ์อธิบายปัญหาหรือข้อบกพร่องที่พบสั้นๆ',
        background: '#0f172a',
        color: '#fff',
        confirmButtonColor: '#f59e0b'
      });
      document.getElementById("symptomDescription")?.focus();
      return;
    }
  }

  appState.currentStep = step;

  const page1 = document.getElementById("stepPage1");
  const page2 = document.getElementById("stepPage2");
  const tabBtn1 = document.getElementById("stepTab1");
  const tabBtn2 = document.getElementById("stepTab2");

  if (step === 1) {
    if (page1) page1.classList.remove("hidden");
    if (page2) page2.classList.add("hidden");

    if (tabBtn1) {
      tabBtn1.className = "flex-1 py-1.5 px-2 rounded-xl text-center font-bold text-xs transition bg-amber-500 text-slate-950 shadow-md flex items-center justify-center gap-1.5";
    }
    if (tabBtn2) {
      tabBtn2.className = "flex-1 py-1.5 px-2 rounded-xl text-center font-semibold text-xs transition text-slate-400 hover:text-white bg-slate-900 border border-slate-800 flex items-center justify-center gap-1.5";
    }
  } else {
    if (page1) page1.classList.add("hidden");
    if (page2) page2.classList.remove("hidden");

    if (tabBtn1) {
      tabBtn1.className = "flex-1 py-1.5 px-2 rounded-xl text-center font-semibold text-xs transition text-slate-400 hover:text-white bg-slate-900 border border-slate-800 flex items-center justify-center gap-1.5";
    }
    if (tabBtn2) {
      tabBtn2.className = "flex-1 py-1.5 px-2 rounded-xl text-center font-bold text-xs transition bg-amber-500 text-slate-950 shadow-md flex items-center justify-center gap-1.5";
    }
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
};

// =========================================================================
// 3. REGISTERED DRIVERS & AUTO VEHICLE ASSIGNMENT (Sheet: Registered_Drivers)
// =========================================================================

async function loadRegisteredDrivers() {
  try {
    const res = await fetch(`https://docs.google.com/spreadsheets/d/${CONFIG.SPREADSHEET_ID}/gviz/tq?tqx=out:json&sheet=${CONFIG.DRIVERS_SHEET}`);
    if (res.ok) {
      const text = await res.text();
      const startIdx = text.indexOf('{');
      const endIdx = text.lastIndexOf('}');
      if (startIdx >= 0 && endIdx >= 0) {
        const json = JSON.parse(text.substring(startIdx, endIdx + 1));
        const list = [];
        (json.table.rows || []).forEach(r => {
          const c = r.c;
          if (!c) return;
          const id = c[0] ? String(c[0].f || c[0].v || '').trim() : '';
          const name = c[1] ? String(c[1].f || c[1].v || '').trim() : '';
          const email = c[2] ? String(c[2].f || c[2].v || '').trim().toLowerCase() : '';
          const phone = c[3] ? String(c[3].f || c[3].v || '').trim() : '';
          const rawPlate = c[4] ? String(c[4].f || c[4].v || '').trim() : '';
          const dept = c[5] ? String(c[5].f || c[5].v || '').trim() : '';
          const status = c[6] ? String(c[6].f || c[6].v || '').trim() : 'ACTIVE';

          if (name || email) {
            list.push({
              driverId: id,
              driverName: name,
              email: email,
              phone: phone,
              rawPlate: rawPlate,
              department: dept,
              status: status
            });
          }
        });

        if (list.length > 0) {
          appState.registeredDrivers = list;
          localStorage.setItem("TTMK_REGISTERED_DRIVERS_CACHE", JSON.stringify(list));
          return list;
        }
      }
    }
  } catch(e) {
    console.warn("GViz drivers load failed, checking cache:", e);
  }

  try {
    const cached = localStorage.getItem("TTMK_REGISTERED_DRIVERS_CACHE");
    if (cached) {
      appState.registeredDrivers = JSON.parse(cached);
      return appState.registeredDrivers;
    }
  } catch(e) {}

  return [];
}

/**
 * ระบุตัวตนคนขับ และดึงทะเบียนรถประจำตัวจาก Registered_Drivers อัตโนมัติ
 */
function initDriverIdentity() {
  const urlParams = new URLSearchParams(window.location.search);
  const paramEmail = (urlParams.get("email") || "").trim().toLowerCase();

  let savedEmail = paramEmail || 
                   localStorage.getItem(CONFIG.STORAGE_KEY_DRIVER) || 
                   localStorage.getItem("TTMK_SAVED_DRIVER_EMAIL") ||
                   localStorage.getItem("TTMK_ACTIVE_USER_EMAIL") ||
                   localStorage.getItem("TTMK_LAST_EMAIL");

  if (savedEmail) {
    savedEmail = savedEmail.trim().toLowerCase();
  }

  let matchedDriver = null;
  if (savedEmail && appState.registeredDrivers.length > 0) {
    matchedDriver = appState.registeredDrivers.find(d => d.email === savedEmail);
  }

  if (matchedDriver) {
    applyDriverProfile(matchedDriver);
  } else if (savedEmail) {
    applyDriverProfile({
      driverId: "DRV-USER",
      driverName: savedEmail.split("@")[0],
      email: savedEmail,
      phone: "-",
      rawPlate: "70-8899"
    });
  } else {
    // ผู้ใช้งานครั้งแรก / ยังไม่มีการจำลองอีเมล -> ให้ระบุอีเมลของตนเอง
    const assignedPlateDisplay = document.getElementById("assignedPlateDisplay");
    if (assignedPlateDisplay) assignedPlateDisplay.textContent = "แตะเพื่อระบุอีเมลผู้แจ้ง";

    const assignedDriverDisplay = document.getElementById("assignedDriverDisplay");
    if (assignedDriverDisplay) assignedDriverDisplay.textContent = "ระบบจะดึงข้อมูลรถของท่านอัตโนมัติ";

    const headerName = document.getElementById("headerDriverName");
    if (headerName) headerName.textContent = "ระบุอีเมลผู้แจ้ง";

    setTimeout(() => {
      promptSwitchDriver();
    }, 350);
  }
}

/**
 * นำข้อมูลคนขับและรถที่ตรวจพบมาล็อกไว้ในแบบฟอร์มอัตโนมัติ 100%
 */
function applyDriverProfile(driver) {
  appState.currentDriver = driver;

  // 1. Resolve full vehicle plate format
  let fullPlate = driver.rawPlate || "70-8899 กทม.";
  let resolvedVehicleType = "รถบรรทุก 6 ล้อตู้ทึบ (ดีเซล)";

  const matchedFleet = FLEET_PLATES.find(f => 
    fullPlate.includes(f.short) || f.plate.includes(fullPlate) || fullPlate.includes(f.plate)
  );

  if (matchedFleet) {
    fullPlate = matchedFleet.plate;
    resolvedVehicleType = matchedFleet.type;
  } else if (!fullPlate.includes(" ")) {
    fullPlate = fullPlate + " สระบุรี";
  }

  // 2. Set hidden inputs for submit
  const plateSelect = document.getElementById("vehiclePlate");
  if (plateSelect) plateSelect.value = fullPlate;

  const typeInput = document.getElementById("vehicleType");
  if (typeInput) typeInput.value = resolvedVehicleType;

  const nameInput = document.getElementById("driverName");
  if (nameInput) nameInput.value = driver.driverName;

  const emailInput = document.getElementById("driverEmail");
  if (emailInput) emailInput.value = driver.email;

  const phoneInput = document.getElementById("driverPhone");
  if (phoneInput) phoneInput.value = driver.phone || "062-3285963";

  // 3. Update Assigned Truck Card UI
  const assignedPlateDisplay = document.getElementById("assignedPlateDisplay");
  if (assignedPlateDisplay) assignedPlateDisplay.textContent = fullPlate;

  const assignedDriverDisplay = document.getElementById("assignedDriverDisplay");
  if (assignedDriverDisplay) {
    assignedDriverDisplay.textContent = `${driver.driverName} • ${driver.phone || '-'}`;
  }

  const assignedDriverId = document.getElementById("assignedDriverId");
  if (assignedDriverId) {
    assignedDriverId.textContent = driver.driverId || "DRV";
  }

  // 4. Update Header UI
  const headerName = document.getElementById("headerDriverName");
  if (headerName) headerName.textContent = driver.driverName || driver.email;

  const dot = document.getElementById("driverStatusDot");
  if (dot) dot.className = "w-2 h-2 rounded-full bg-emerald-400 animate-pulse";

  // Remember this driver email for future app visits
  if (driver.email) {
    localStorage.setItem(CONFIG.STORAGE_KEY_DRIVER, driver.email);
    localStorage.setItem("TTMK_SAVED_DRIVER_EMAIL", driver.email);
    localStorage.setItem("TTMK_ACTIVE_USER_EMAIL", driver.email);
    localStorage.setItem("TTMK_LAST_EMAIL", driver.email);
  }
}

window.toggleSwitchPlate = function() {
  const fleetOptions = FLEET_PLATES.map(f => 
    `<option value="${f.plate}">${f.plate} (${f.type})</option>`
  ).join('');

  Swal.fire({
    title: 'สลับคัน (ขับแทน)',
    html: `
      <div class="text-left text-xs text-slate-300 space-y-3">
        <p>เลือกรถคันที่ท่านขับแทนในวันนี้:</p>
        <select id="swalSwitchPlateSelect" class="w-full p-2.5 rounded-xl border border-slate-700 bg-slate-900 text-white font-bold text-xs outline-none focus:border-amber-500">
          <option value="">-- เลือกรถในกองยาน TTMK --</option>
          ${fleetOptions}
          <option value="CUSTOM">-- พิมพ์ทะเบียนอื่น ๆ --</option>
        </select>
        <div id="swalCustomPlateBox" class="hidden pt-1">
          <label class="block text-[11px] text-slate-400 mb-1">พิมพ์ทะเบียนรถ:</label>
          <input type="text" id="swalCustomPlateInput" placeholder="เช่น 70-9999 กทม."
                 class="w-full p-2 rounded-xl border border-slate-700 bg-slate-900 text-amber-300 font-bold text-xs outline-none">
        </div>
      </div>
    `,
    didOpen: () => {
      const sel = document.getElementById('swalSwitchPlateSelect');
      const box = document.getElementById('swalCustomPlateBox');
      if (sel) {
        sel.addEventListener('change', () => {
          if (sel.value === 'CUSTOM') {
            box.classList.remove('hidden');
            document.getElementById('swalCustomPlateInput')?.focus();
          } else {
            box.classList.add('hidden');
          }
        });
      }
    },
    background: '#0f172a',
    color: '#fff',
    showCancelButton: true,
    confirmButtonText: 'ยืนยันสลับคัน',
    cancelButtonText: 'ยกเลิก',
    confirmButtonColor: '#f59e0b',
    cancelButtonColor: '#475569',
    preConfirm: () => {
      const sel = document.getElementById('swalSwitchPlateSelect').value;
      const custom = document.getElementById('swalCustomPlateInput')?.value?.trim();
      const chosen = (sel === 'CUSTOM' ? custom : sel);
      if (!chosen) {
        Swal.showValidationMessage('กรุณาเลือกรถที่ต้องการสลับคัน');
        return false;
      }
      return chosen;
    }
  }).then(result => {
    if (result.isConfirmed && result.value) {
      const newPlate = result.value;
      const plateInput = document.getElementById("vehiclePlate");
      if (plateInput) plateInput.value = newPlate;

      const display = document.getElementById("assignedPlateDisplay");
      if (display) display.textContent = newPlate + " (ขับแทน)";

      const matchedFleet = FLEET_PLATES.find(f => f.plate === newPlate);
      if (matchedFleet) {
        const typeInput = document.getElementById("vehicleType");
        if (typeInput) typeInput.value = matchedFleet.type;
      }

      Swal.fire({
        icon: 'success',
        title: 'สลับคันสำเร็จ',
        text: `เปลี่ยนเป็นทะเบียน: ${newPlate}`,
        timer: 1500,
        showConfirmButton: false,
        background: '#0f172a',
        color: '#fff'
      });
    }
  });
};

window.handlePlateChange = function() {};

window.promptSwitchDriver = function() {
  const currentEmail = appState.currentDriver ? appState.currentDriver.email : '';

  Swal.fire({
    title: 'เข้าสู่ระบบพนักงานขับรถ',
    html: `
      <div class="text-left text-xs text-slate-300 space-y-3">
        <label class="block text-slate-300 font-semibold">
          กรุณากรอกอีเมลของท่าน:
        </label>
        <div class="relative">
          <input type="email" id="swalDriverEmailInput" 
                 placeholder="เช่น your.email@gmail.com"
                 value="${escapeHtml(currentEmail)}"
                 class="w-full px-3.5 py-3 rounded-xl border border-slate-700 bg-slate-900 text-white text-sm font-medium outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500">
        </div>
        <p class="text-[11px] text-slate-400 leading-relaxed">
          <i class="fa-solid fa-circle-info text-amber-400 mr-1"></i>ระบบจะค้นหาทะเบียนรถประจำตัวและชื่อผู้ขับจากตาราง <b>Registered_Drivers</b> ให้อัตโนมัติ โดยท่านไม่ต้องเลือกทะเบียนเอง
        </p>
      </div>
    `,
    background: '#0f172a',
    color: '#fff',
    showCancelButton: true,
    confirmButtonText: 'เข้าสู่ระบบ',
    cancelButtonText: 'ยกเลิก',
    confirmButtonColor: '#f59e0b',
    cancelButtonColor: '#475569',
    didOpen: () => {
      const input = document.getElementById('swalDriverEmailInput');
      if (input) {
        input.focus();
        if (input.value) input.select();
      }
    },
    preConfirm: () => {
      const inputVal = (document.getElementById('swalDriverEmailInput').value || '').trim().toLowerCase();
      if (!inputVal) {
        Swal.showValidationMessage('กรุณากรอกอีเมลของท่าน');
        return false;
      }
      return inputVal;
    }
  }).then(result => {
    if (result.isConfirmed && result.value) {
      const email = result.value;
      const found = appState.registeredDrivers.find(d => d.email === email);
      if (found) {
        applyDriverProfile(found);
        Swal.fire({
          icon: 'success',
          title: 'เข้าสู่ระบบสำเร็จ',
          text: `ยินดีต้อนรับคุณ ${found.driverName} (รถประจำตัว: ${document.getElementById("vehiclePlate").value})`,
          timer: 2000,
          showConfirmButton: false,
          background: '#0f172a',
          color: '#fff'
        });
      } else {
        Swal.fire({
          icon: 'warning',
          title: 'ไม่พบอีเมลในระบบ',
          html: `<p class="text-xs text-slate-300">ไม่พบอีเมล <b>${escapeHtml(email)}</b> ในตาราง Registered_Drivers<br>กรุณาตรวจสอบการสะกดอีเมล หรือติดต่อผู้ดูแลระบบ</p>`,
          confirmButtonText: 'ลองใหม่อีกครั้ง',
          showCancelButton: true,
          cancelButtonText: 'ยกเลิก',
          confirmButtonColor: '#f59e0b',
          cancelButtonColor: '#475569',
          background: '#0f172a',
          color: '#fff'
        }).then(retry => {
          if (retry.isConfirmed) {
            promptSwitchDriver();
          }
        });
      }
    }
  });
};

// =========================================================================
// 4. GARAGES LIST & AUTO-COMPLETE (Sheet: Maintenance_log + Cache)
// =========================================================================

async function loadGaragesList() {
  const defaultGarages = [
    "ศูนย์บริการ TTMK สระบุรี",
    "ศูนย์บริการ อีซูซุ สระบุรี",
    "ศูนย์บริการ ฮีโน่ สระบุรี",
    "ร้านยางเจริญยนต์ สระบุรี",
    "อู่ช่างเล็ก ไดนาโม",
    "ศูนย์บริการ BYD / NEX Point EV"
  ];

  const garageSet = new Set(defaultGarages);

  // 1. Pull from localStorage
  try {
    const saved = localStorage.getItem(CONFIG.STORAGE_KEY_GARAGES);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) parsed.forEach(g => garageSet.add(g));
    }
  } catch(e) {}

  // 2. Query Google Sheet Maintenance_log Column 14 (Index 13: Garage_Name)
  try {
    const res = await fetch(`https://docs.google.com/spreadsheets/d/${CONFIG.SPREADSHEET_ID}/gviz/tq?tqx=out:json&sheet=${CONFIG.SHEET_NAME}`);
    if (res.ok) {
      const text = await res.text();
      const startIdx = text.indexOf('{');
      const endIdx = text.lastIndexOf('}');
      if (startIdx >= 0 && endIdx >= 0) {
        const json = JSON.parse(text.substring(startIdx, endIdx + 1));
        (json.table.rows || []).forEach(r => {
          if (r.c && r.c[13]) {
            const gName = String(r.c[13].f || r.c[13].v || '').trim();
            if (gName && gName.length > 2) garageSet.add(gName);
          }
        });
      }
    }
  } catch(e) {}

  appState.garagesList = Array.from(garageSet);

  // Populate HTML5 Datalist ONLY (no bulky chips)
  const datalist = document.getElementById("garageDatalist");
  if (datalist) {
    datalist.innerHTML = appState.garagesList.map(g => `<option value="${escapeHtml(g)}"></option>`).join('');
  }
}

window.selectGarageChip = function(name) {
  const input = document.getElementById("garageName");
  if (input) {
    input.value = name;
    input.focus();
  }
};

function saveGarageToCache(name) {
  if (!name || name.trim().length < 2) return;
  const clean = name.trim();
  if (!appState.garagesList.includes(clean)) {
    appState.garagesList.push(clean);
    try {
      localStorage.setItem(CONFIG.STORAGE_KEY_GARAGES, JSON.stringify(appState.garagesList));
    } catch(e) {}
  }
}

// =========================================================================
// 5. QUICK SYSTEM & SYMPTOM CHIPS
// =========================================================================

window.selectSystemChip = function(systemName, btnEl) {
  const hiddenInput = document.getElementById("systemAffected");
  if (hiddenInput) hiddenInput.value = systemName;

  const chips = document.querySelectorAll(".sys-chip");
  chips.forEach(c => {
    c.className = "sys-chip py-2 px-1.5 rounded-xl border text-[11px] font-bold flex flex-col items-center justify-center gap-0.5 transition active:scale-95 border-slate-700 bg-slate-800 text-slate-300";
  });

  if (btnEl) {
    btnEl.className = "sys-chip py-2 px-1.5 rounded-xl border text-[11px] font-bold flex flex-col items-center justify-center gap-0.5 transition active:scale-95 border-amber-500 bg-amber-500/20 text-amber-300 shadow-sm";
  }
};

window.appendSymptomText = function(text) {
  const txtArea = document.getElementById("symptomDescription");
  if (!txtArea) return;
  const current = txtArea.value.trim();
  if (current) {
    txtArea.value = current + ", " + text;
  } else {
    txtArea.value = text;
  }
  txtArea.focus();
};

// =========================================================================
// 6. DYNAMIC MULTI-PART MOBILE CARDS
// =========================================================================

function initDefaultMobilePartCard() {
  appState.partItems = [];
  addMobilePartCard("ผ้าเบรกหน้า (แท้)", 1, "ชุด", 3500);
}

window.addMobilePartCard = function(defaultName = "", defaultQty = 1, defaultUnit = "ชิ้น", defaultPrice = 0) {
  const id = Date.now() + Math.floor(Math.random() * 100);
  const newItem = {
    id: id,
    name: defaultName,
    qty: defaultQty,
    unit: defaultUnit,
    unitPrice: defaultPrice
  };
  appState.partItems.push(newItem);
  renderMobilePartCards();
  calculateFinancialTotals();
};

window.deleteMobilePartCard = function(id) {
  if (appState.partItems.length <= 1) {
    appState.partItems[0].name = "";
    appState.partItems[0].qty = 1;
    appState.partItems[0].unitPrice = 0;
    renderMobilePartCards();
    calculateFinancialTotals();
    return;
  }
  appState.partItems = appState.partItems.filter(item => item.id !== id);
  renderMobilePartCards();
  calculateFinancialTotals();
};

window.stepQty = function(id, delta) {
  const item = appState.partItems.find(x => x.id === id);
  if (!item) return;
  item.qty = Math.max(1, (parseInt(item.qty, 10) || 1) + delta);
  renderMobilePartCards();
  calculateFinancialTotals();
};

window.updatePartItem = function(id, field, value) {
  const item = appState.partItems.find(x => x.id === id);
  if (!item) return;
  if (field === "name" || field === "unit") {
    item[field] = value;
  } else if (field === "unitPrice") {
    item[field] = parseFloat(value) || 0;
  } else if (field === "qty") {
    item[field] = Math.max(1, parseInt(value, 10) || 1);
  }
  calculateFinancialTotals();
};

function renderMobilePartCards() {
  const container = document.getElementById("mobilePartsContainer");
  if (!container) return;

  container.innerHTML = appState.partItems.map((item, idx) => {
    const itemTotal = (item.qty * item.unitPrice).toLocaleString();
    return `
      <div class="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2 shadow-sm" data-id="${item.id}">
        
        <!-- Header: Number & Delete -->
        <div class="flex items-center justify-between text-xs font-bold text-slate-300">
          <span class="flex items-center gap-1.5 text-amber-400">
            <i class="fa-solid fa-tag"></i> รายการที่ ${idx + 1}
          </span>
          <button type="button" onclick="deleteMobilePartCard(${item.id})" class="text-slate-500 hover:text-red-400 p-1 text-xs">
            <i class="fa-solid fa-trash-can"></i> ลบ
          </button>
        </div>

        <!-- Part / Service Name -->
        <div>
          <input type="text" value="${escapeHtml(item.name)}" 
                 oninput="updatePartItem(${item.id}, 'name', this.value)"
                 placeholder="ชื่ออะไหล่ หรือ ค่าแรงช่าง เช่น ผ้าเบรก, ถ่ายน้ำมัน..."
                 class="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs font-semibold outline-none focus:border-amber-500">
        </div>

        <!-- Stepper Qty & Unit Price -->
        <div class="grid grid-cols-2 gap-2 text-xs">
          <!-- Stepper: Quantity -->
          <div>
            <label class="block text-[10px] text-slate-400 mb-1">จำนวน</label>
            <div class="flex items-center bg-slate-900 border border-slate-700 rounded-lg overflow-hidden">
              <button type="button" onclick="stepQty(${item.id}, -1)" class="w-8 py-1.5 bg-slate-800 active:bg-slate-700 text-white font-bold text-sm">-</button>
              <input type="number" min="1" value="${item.qty}"
                     onchange="updatePartItem(${item.id}, 'qty', this.value)"
                     class="w-full text-center bg-transparent text-white font-bold text-xs outline-none font-mono">
              <button type="button" onclick="stepQty(${item.id}, 1)" class="w-8 py-1.5 bg-slate-800 active:bg-slate-700 text-white font-bold text-sm">+</button>
            </div>
          </div>

          <!-- Unit Price (Baht) -->
          <div>
            <label class="block text-[10px] text-slate-400 mb-1">ราคา/หน่วย (บาท)</label>
            <input type="number" min="0" step="any" value="${item.unitPrice || ''}"
                   oninput="updatePartItem(${item.id}, 'unitPrice', this.value)"
                   placeholder="0"
                   class="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-right text-emerald-400 font-digital font-bold text-sm outline-none focus:border-amber-500">
          </div>
        </div>

        <!-- Subtotal of this item -->
        <div class="flex justify-between items-center pt-1 border-t border-slate-900 text-[11px] text-slate-400">
          <span>รวมรายการนี้:</span>
          <span class="font-digital text-xs text-white font-bold">${itemTotal} บาท</span>
        </div>

      </div>
    `;
  }).join('');
}

function calculateFinancialTotals() {
  let partsSubtotal = 0;
  let laborSubtotal = 0;

  appState.partItems.forEach(item => {
    const total = (item.qty || 1) * (item.unitPrice || 0);
    const n = (item.name || "").toLowerCase();
    if (n.includes("แรง") || n.includes("บริการ") || n.includes("service") || n.includes("labor")) {
      laborSubtotal += total;
    } else {
      partsSubtotal += total;
    }
  });

  const checkVat = document.getElementById("checkIncludeVat");
  const hasVat = checkVat && checkVat.checked;
  const rawSum = partsSubtotal + laborSubtotal;
  const vatAmount = hasVat ? rawSum * 0.07 : 0;
  const grandTotal = rawSum + vatAmount;

  const partsEl = document.getElementById("sumPartsCost");
  if (partsEl) partsEl.textContent = partsSubtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " บ.";

  const laborEl = document.getElementById("sumLaborCost");
  if (laborEl) laborEl.textContent = laborSubtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " บ.";

  const vatEl = document.getElementById("sumVatCost");
  if (vatEl) vatEl.textContent = vatAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " บ.";

  const totalEl = document.getElementById("sumTotalCost");
  if (totalEl) totalEl.textContent = grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " บ.";

  return { partsSubtotal, laborSubtotal, vatAmount, grandTotal };
}

// =========================================================================
// 7. CAMERA & IMAGE ATTACHMENT
// =========================================================================

window.triggerMobileCamera = async function(targetType) {
  appState.activeCameraTarget = targetType;
  const modal = document.getElementById("cameraModal");
  const title = document.getElementById("cameraModalTitle");
  if (title) {
    title.textContent = targetType === "billPhoto" ? "ถ่ายภาพบิลค่าซ่อม / ใบเสร็จ" : "ถ่ายภาพจุดที่ชำรุด";
  }
  if (modal) modal.classList.remove("hidden");

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: appState.cameraFacingMode,
        width: { ideal: 1280 },
        height: { ideal: 720 }
      },
      audio: false
    });
    appState.activeCameraStream = stream;
    const video = document.getElementById("liveCameraVideo");
    if (video) {
      video.srcObject = stream;
      video.play();
    }
  } catch (err) {
    console.warn("Camera getUserMedia error, fallback to file input:", err);
    closeCameraModal();
    // Simulate clicking file input
    const fileInputs = document.querySelectorAll('input[type="file"]');
    const idx = targetType === "billPhoto" ? 1 : 0;
    if (fileInputs[idx]) fileInputs[idx].click();
  }
};

window.snapCameraPhoto = function() {
  const video = document.getElementById("liveCameraVideo");
  if (!video || !appState.activeCameraStream) return;

  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth || 1280;
  canvas.height = video.videoHeight || 720;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  const rawBase64 = canvas.toDataURL("image/jpeg", 0.9);
  compressImageBase64(rawBase64, (compressed) => {
    setPhotoData(appState.activeCameraTarget, compressed);
    closeCameraModal();
  });
};

window.switchCameraFacing = function() {
  appState.cameraFacingMode = appState.cameraFacingMode === 'user' ? 'environment' : 'user';
  if (appState.activeCameraStream) {
    appState.activeCameraStream.getTracks().forEach(t => t.stop());
  }
  triggerMobileCamera(appState.activeCameraTarget);
};

window.closeCameraModal = function() {
  const modal = document.getElementById("cameraModal");
  if (modal) modal.classList.add("hidden");
  if (appState.activeCameraStream) {
    appState.activeCameraStream.getTracks().forEach(t => t.stop());
    appState.activeCameraStream = null;
  }
};

window.handleFileUpload = function(event, targetType) {
  const file = event.target.files && event.target.files[0];
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
// 8. FORM SUBMISSION TO GOOGLE APPS SCRIPT
// =========================================================================

window.handleMobileFormSubmit = async function(event) {
  event.preventDefault();

  const plateInput = document.getElementById("vehiclePlate");
  const assignedDisplay = document.getElementById("assignedPlateDisplay");
  let plate = (plateInput?.value || "").trim();
  if (!plate && assignedDisplay && assignedDisplay.textContent) {
    plate = assignedDisplay.textContent.replace(/\(ขับแทน\)/g, '').trim();
    if (plateInput) plateInput.value = plate;
  }

  if (!plate || plate.includes("กำลังโหลด") || plate.includes("แตะเพื่อระบุ")) {
    goToStep(1);
    Swal.fire({ icon: 'warning', title: 'กรุณาระบุตัวตนผู้ขับ', text: 'กรุณาเข้าสู่ระบบด้วยอีเมลเพื่อดึงข้อมูลรถ หรือแตะสลับคัน', background: '#0f172a', color: '#fff', confirmButtonColor: '#f59e0b' });
    return;
  }

  const odo = document.getElementById("odometer").value.trim();
  const date = document.getElementById("inspectionDate").value;
  const symptom = document.getElementById("symptomDescription").value.trim();

  if (!odo || !symptom) {
    goToStep(1);
    Swal.fire({ icon: 'warning', title: 'กรุณากรอกข้อมูลขั้นตอนที่ 1 ให้ครบ', background: '#0f172a', color: '#fff', confirmButtonColor: '#f59e0b' });
    return;
  }

  // Check garage name on Step 2
  const garageName = document.getElementById("garageName").value.trim();
  if (!garageName) {
    Swal.fire({
      icon: 'warning',
      title: 'กรุณาระบุชื่ออู่หรือศูนย์บริการ',
      text: 'แตะเลือกจากชิป หรือพิมพ์ชื่ออู่ที่เข้าซ่อม',
      background: '#0f172a',
      color: '#fff',
      confirmButtonColor: '#f59e0b'
    });
    document.getElementById("garageName").focus();
    return;
  }

  // Check parts items
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

  // Save garage to memory list for future selection
  saveGarageToCache(garageName);

  // Financial totals
  const totals = calculateFinancialTotals();
  const ticketId = document.getElementById("formCurrentTicketId").textContent.trim() || generateNewTicketId();
  const driverName = document.getElementById("driverName").value.trim() || (appState.currentDriver ? appState.currentDriver.driverName : "พนักงานขับรถ");

  // Confirmation dialog
  const confirmResult = await Swal.fire({
    title: 'ยืนยันส่งข้อมูลแจ้งซ่อม?',
    html: `
      <div class="text-left text-xs text-slate-300 space-y-1.5">
        <p><b>ทะเบียนรถ:</b> <span class="font-bold text-amber-400">${plate}</span></p>
        <p><b>พนักงานขับรถ:</b> ${escapeHtml(driverName)}</p>
        <p><b>เลขไมล์:</b> ${Number(odo).toLocaleString()} กม.</p>
        <p><b>อู่ซ่อม:</b> ${escapeHtml(garageName)}</p>
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

  const emailVal = (document.getElementById("driverEmail")?.value || 
                    appState.currentDriver?.email || 
                    localStorage.getItem(CONFIG.STORAGE_KEY_DRIVER) || 
                    localStorage.getItem("TTMK_ACTIVE_USER_EMAIL") || 
                    "closec16522@gmail.com").trim().toLowerCase();

  const payload = {
    action: "save_maintenance",
    email: emailVal,
    driverEmail: emailVal,
    ticketId: ticketId,
    inspectionDate: date,
    vehiclePlate: plate,
    vehicleType: document.getElementById("vehicleType")?.value || "รถบรรทุก 6 ล้อ",
    odometer: odo,
    driverName: driverName,
    driverPhone: document.getElementById("driverPhone")?.value?.trim() || "-",
    status: document.getElementById("ticketStatus")?.value || "ซ่อมเสร็จแล้ว",
    maintenanceType: document.getElementById("maintenanceType")?.value || "ตรวจซ่อมทั่วไป",
    systemAffected: document.getElementById("systemAffected")?.value || "ไม่ระบุ",
    urgency: document.getElementById("urgency")?.value || "ปกติ",
    symptom: symptom,
    symptomDescription: symptom,
    garageName: garageName,
    mechanicName: document.getElementById("mechanicName")?.value?.trim() || "-",
    garagePhone: document.getElementById("garagePhone")?.value?.trim() || "-",
    items: appState.partItems,
    parts: appState.partItems,
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
            <p class="text-[10px] text-slate-400">* บันทึกลง Google Sheet (Maintenance_log) เรียบร้อยแล้ว</p>
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
      const errMsg = result?.message || 'Server error';
      saveLocalTicketCache(payload, { serverError: errMsg });
      Swal.fire({
        icon: 'error',
        title: 'บันทึกลง Sheet ไม่สำเร็จ',
        html: `
          <div class="text-left text-xs text-slate-300 space-y-2">
            <p class="text-red-400 font-semibold">ข้อความจากเซิร์ฟเวอร์ Google Apps Script:</p>
            <p class="p-2 bg-slate-900 rounded-lg text-slate-200 font-mono text-[11px] border border-slate-700">${escapeHtml(errMsg)}</p>
            <p class="text-[11px] text-slate-400 leading-relaxed">* กรุณาเปิด Apps Script แล้วกด <b>Deploy > Manage Deployments > แก้ไขเป็นเวอร์ชันใหม่</b> เพื่ออัปเดตระบบ</p>
          </div>
        `,
        background: '#0f172a',
        color: '#fff',
        confirmButtonText: 'ตกลง',
        confirmButtonColor: '#ea580c'
      });
    }
  } catch (err) {
    console.warn("GAS save fallback to local:", err);
    saveLocalTicketCache(payload, { localOnly: true, networkError: err.toString() });

    Swal.fire({
      icon: 'warning',
      title: 'เครือข่ายขัดข้อง (บันทึกในเครื่องแล้ว)',
      html: `
        <div class="text-left text-xs text-slate-300 space-y-1.5">
          <p>รหัสแจ้งซ่อม: <b class="font-digital text-amber-400">${ticketId}</b></p>
          <p class="text-slate-400">บันทึกข้อมูลและรูปภาพในเครื่องเรียบร้อยแล้ว</p>
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
  try {
    const saved = localStorage.getItem(CONFIG.STORAGE_KEY_LOGS);
    const logs = saved ? JSON.parse(saved) : [];
    logs.unshift({
      ...payload,
      createdAt: new Date().toISOString(),
      serverResult: serverResult
    });
    localStorage.setItem(CONFIG.STORAGE_KEY_LOGS, JSON.stringify(logs.slice(0, 30)));
  } catch(e) {}
}

function resetMobileForm() {
  document.getElementById("symptomDescription").value = "";
  document.getElementById("odometer").value = "";
  document.getElementById("garageName").value = "";
  document.getElementById("mechanicName").value = "";
  document.getElementById("garagePhone").value = "";
  clearPhoto("billPhoto");
  clearPhoto("defectPhoto");
  generateNewTicketId();
  initDefaultMobilePartCard();
  goToStep(1);
}

// =========================================================================
// 9. UTILITY HELPERS
// =========================================================================

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function capitalize(s) {
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1);
}
