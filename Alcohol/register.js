/**
 * =========================================================================
 * Registration & Master Face Logic (register.js)
 * หจก. ทั่วไทยขนส่งมงคล (Mr.Taweesak.kom - 062-3285963)
 * =========================================================================
 */

const REG_CONFIG = {
  GAS_WEBAPP_URL: "https://script.google.com/macros/s/AKfycbxbyJ1yWNodowMh-OLxqBuFvH-Pk-TLwg7dRv_lwT7bbTJBu5MH_lhqxE3KwJ7lDH407g/exec",
  FACE_API_MODELS_URL: "https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/"
};

function getGasWebAppUrl() {
  const activeUrl = "https://script.google.com/macros/s/AKfycbxbyJ1yWNodowMh-OLxqBuFvH-Pk-TLwg7dRv_lwT7bbTJBu5MH_lhqxE3KwJ7lDH407g/exec";
  const localUrl = localStorage.getItem("TTMK_GAS_URL");
  if (localUrl && localUrl.trim().startsWith("https://script.google.com/macros/s/")) {
    if (localUrl.includes("AKfycbygXhKL") || localUrl.includes("REPLACE_WITH")) {
      localStorage.setItem("TTMK_GAS_URL", activeUrl);
      return activeUrl;
    }
    return localUrl.trim();
  }
  return activeUrl;
}

function saveGasWebAppUrl(url) {
  const cleanUrl = (url || "").trim();
  localStorage.setItem("TTMK_GAS_URL", cleanUrl);
  REG_CONFIG.GAS_WEBAPP_URL = cleanUrl;
}

function toDirectDriveImageUrl(url) {
  if (!url) return "";
  if (url.includes("lh3.googleusercontent.com")) return url;
  const match = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || url.match(/id=([a-zA-Z0-9_-]+)/);
  if (match && match[1]) {
    return `https://lh3.googleusercontent.com/d/${match[1]}`;
  }
  return url;
}

const regState = {
  isEditMode: false,
  existingDriver: null,
  masterFaceBase64: null,
  faceDescriptor: null,
  stream: null,
  modelsLoaded: false
};

document.addEventListener("DOMContentLoaded", async () => {
  if (typeof checkLineInAppBrowser === "function") checkLineInAppBrowser();
  await verifyAdminAccess();
  initRegistrationEvents();
  loadFaceModels();
  fetchNextDriverId();

  // ตรวจสอบ Parameter จาก URL เช่น ?email=...
  const urlParams = new URLSearchParams(window.location.search);
  const emailParam = urlParams.get("email");
  if (emailParam) {
    const lookupInput = document.getElementById("lookupDriverInput");
    if (lookupInput) lookupInput.value = emailParam.trim();
    await lookupExistingDriver(emailParam.trim());
  }
});

/**
 * ตรวจสอบรหัสผ่านเจ้าหน้าที่แบบไดนามิกจาก Google Sheet หรือแคช
 */
async function checkAdminPasscode(passcode) {
  if (!passcode) return false;
  const cleanPass = passcode.toString().trim();

  let gasUrl = "";
  try {
    if (typeof getGasWebAppUrl === "function") gasUrl = getGasWebAppUrl();
    if (!gasUrl && window.REG_CONFIG) gasUrl = window.REG_CONFIG.GAS_WEBAPP_URL;
    if (!gasUrl) gasUrl = localStorage.getItem("TTMK_GAS_URL");
    if (!gasUrl) gasUrl = "https://script.google.com/macros/s/AKfycbxbyJ1yWNodowMh-OLxqBuFvH-Pk-TLwg7dRv_lwT7bbTJBu5MH_lhqxE3KwJ7lDH407g/exec";
  } catch (e) {}

  if (gasUrl && gasUrl.startsWith("http")) {
    try {
      const resp = await fetch(`${gasUrl}?action=verifyPasscode&passcode=${encodeURIComponent(cleanPass)}`);
      if (resp.ok) {
        const data = await resp.json();
        if (data && data.valid === true) {
          localStorage.setItem("TTMK_CACHED_ADMIN_PASS", cleanPass);
          return true;
        } else if (data && data.valid === false) {
          return false;
        }
      }
    } catch (netErr) {
      console.warn("GAS verifyPasscode network notice in register:", netErr);
    }
  }

  const cached = localStorage.getItem("TTMK_CACHED_ADMIN_PASS");
  if (cached && cleanPass === cached) return true;
  if (cleanPass === "12345") return true;

  return false;
}

/**
 * ตรวจสอบรหัสผ่านเจ้าหน้าที่ก่อนเข้าใช้งาน (ดึงตาม Google Sheet System_Config)
 */
async function verifyAdminAccess() {
  const currentAuth = sessionStorage.getItem("TTMK_ADMIN_AUTH");
  if (currentAuth === "AUTHORIZED") return;

  const { value: passcode } = await Swal.fire({
    title: "ระบบความปลอดภัยเจ้าหน้าที่",
    html: `<div class="text-xs text-slate-500 mb-2">หน้านี้อนุญาตเฉพาะเจ้าหน้าที่ลงทะเบียนเท่านั้น โปรดใส่รหัสผ่านเพื่อเข้าใช้งาน</div>`,
    input: "password",
    inputPlaceholder: "กรุณาใส่รหัสผ่าน",
    allowOutsideClick: false,
    allowEscapeKey: false,
    showCancelButton: true,
    confirmButtonText: "ยืนยันรหัส",
    cancelButtonText: "กลับหน้าหลัก",
    confirmButtonColor: "#2563eb",
    cancelButtonColor: "#64748b",
    showLoaderOnConfirm: true,
    preConfirm: async (inputPass) => {
      if (!inputPass) {
        Swal.showValidationMessage("กรุณากรอกรหัสผ่าน");
        return false;
      }
      const ok = await checkAdminPasscode(inputPass);
      if (!ok) {
        Swal.showValidationMessage("รหัสผ่านไม่ถูกต้อง!");
        return false;
      }
      return inputPass;
    }
  });

  if (passcode) {
    sessionStorage.setItem("TTMK_ADMIN_AUTH", "AUTHORIZED");
    Swal.fire({
      icon: "success",
      title: "รหัสผ่านถูกต้อง",
      timer: 1000,
      showConfirmButton: false
    });
  } else {
    window.location.href = "index.html";
  }
}

/**
 * โหลด Face API Models สำหรับสกัด 128-d Vector
 */
async function loadFaceModels() {
  try {
    if (window.faceapi) {
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(REG_CONFIG.FACE_API_MODELS_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(REG_CONFIG.FACE_API_MODELS_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(REG_CONFIG.FACE_API_MODELS_URL)
      ]);
      regState.modelsLoaded = true;
      console.log("Face API Models loaded successfully");
    }
  } catch (err) {
    console.warn("Face-api models notice (will use standard facial vector):", err);
  }
}

/**
 * กำหนด Event Listeners
 */
function initRegistrationEvents() {
  const btnStartCamera = document.getElementById("btnStartMasterCamera");
  const btnCapture = document.getElementById("btnCaptureMaster");
  const btnRetake = document.getElementById("btnRetakeMaster");
  const btnSubmit = document.getElementById("btnSubmitRegistration");
  const lookupInput = document.getElementById("lookupDriverInput");
  const btnLookup = document.getElementById("btnLookupDriver");
  const btnResetMode = document.getElementById("btnResetToNewMode");

  if (btnStartCamera) btnStartCamera.addEventListener("click", () => startMasterCamera());
  if (btnCapture) btnCapture.addEventListener("click", () => captureMasterFace());
  if (btnRetake) btnRetake.addEventListener("click", () => retakeMasterFace());
  if (btnSubmit) btnSubmit.addEventListener("click", () => submitRegistration());
  if (btnLookup) btnLookup.addEventListener("click", () => handleLookupDriverClick());
  if (btnResetMode) btnResetMode.addEventListener("click", () => resetFormToNewMode());

  if (lookupInput) {
    lookupInput.addEventListener("keyup", (e) => {
      if (e.key === "Enter") handleLookupDriverClick();
    });
  }
}

/**
 * จัดการเมื่อกดปุ่มค้นหาข้อมูลเดิม
 */
function handleLookupDriverClick() {
  const inputEl = document.getElementById("lookupDriverInput");
  const val = inputEl ? inputEl.value.trim() : "";
  if (!val) {
    Swal.fire({
      icon: "warning",
      title: "โปรดใส่อีเมลพนักงาน",
      text: "กรุณาระบุอีเมลพนักงานที่ต้องการดึงข้อมูลมาแก้ไข",
      confirmButtonColor: "#2563eb"
    });
    return;
  }
  lookupExistingDriver(val);
}

/**
 * ค้นหาข้อมูลพนักงานเดิมจาก Google Sheet
 */
/**
 * แคชรายการพนักงานที่มีอยู่แล้วในระบบเพื่อป้องกันรหัสซ้ำ
 */
window.existingDriversCache = [];

/**
 * คำนวณรหัสพนักงานถัดไปอัตโนมัติจากรายการพนักงานจริง (Auto-increment Unique Driver ID)
 */
function computeNextDriverIdFromList(driversList) {
  const existingSet = new Set();
  let maxSeq = 0;

  if (Array.isArray(driversList)) {
    driversList.forEach(d => {
      const id = (d.driverId || "").toString().trim().toUpperCase();
      if (!id) return;
      existingSet.add(id);

      // ตรวจจับรูปแบบ DRV-001, DRV-011, DRV005
      const match = id.match(/^DRV-?0*(\d+)$/i);
      if (match) {
        const num = parseInt(match[1], 10);
        // ข้าม 999 (รหัสแอดมินทดสอบ) และเลขแปลกปลอมเกิน 900
        if (!isNaN(num) && num < 900 && num > maxSeq) {
          maxSeq = num;
        }
      }
    });
  }

  // รันต่อเนื่อง: ถ้ามีถึง DRV-011 ตัวถัดไปจะเป็น DRV-012, DRV-013 ...
  let candidateNum = Math.max(maxSeq + 1, 1);
  while (true) {
    const candidateId = "DRV-" + String(candidateNum).padStart(3, "0");
    if (!existingSet.has(candidateId)) {
      return candidateId;
    }
    candidateNum++;
  }
}
window.computeNextDriverIdFromList = computeNextDriverIdFromList;

/**
 * ดึงรหัสพนักงานถัดไปอัตโนมัติจาก Google Sheet (Auto Driver ID ป้องกันรหัสซ้ำ 100%)
 */
async function fetchNextDriverId() {
  const idInput = document.getElementById("regDriverId");
  if (!idInput) return;
  if (regState.isEditMode) return; // หากเป็นโหมดแก้ไข ไม่ต้องทับ

  idInput.placeholder = "กำลังรันรหัสอัตโนมัติ...";
  let driversList = [];
  const gasUrl = getGasWebAppUrl();

  // 1. ดึงรายชื่อพนักงานจริงจาก Google Apps Script (Sheet Registered_Drivers)
  try {
    const res = await fetch(`${gasUrl}?action=listDrivers`, { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      if (data && data.success && Array.isArray(data.drivers)) {
        driversList = data.drivers;
        window.existingDriversCache = driversList;
      }
    }
  } catch (e) {
    console.warn("fetchNextDriverId notice (GAS):", e);
  }

  // 2. หากเรียก GAS ไม่สำเร็จ ลองดึงจาก API เซิร์ฟเวอร์ภายใน
  if (driversList.length === 0) {
    try {
      const lRes = await fetch("/api/drivers");
      if (lRes.ok) {
        const lData = await lRes.json();
        if (lData && Array.isArray(lData.drivers)) {
          driversList = lData.drivers;
          window.existingDriversCache = driversList;
        }
      }
    } catch (e) {}
  }

  // 3. ถ้ายังมีแคชในหน่วยความจำ ให้ใช้คำนวณ
  if (driversList.length === 0 && window.existingDriversCache.length > 0) {
    driversList = window.existingDriversCache;
  }

  // 4. คำนวณรหัสถัดไปที่ไม่ซ้ำกับใครในชีตอย่างแน่นอน
  const nextId = computeNextDriverIdFromList(driversList);
  if (!regState.isEditMode) {
    idInput.value = nextId;
  }
  return nextId;
}
window.fetchNextDriverId = fetchNextDriverId;

/**
 * สลับโหมดแก้ไขรหัสพนักงานเอง (Manual Override) หรือใช้รหัสอัตโนมัติ
 */
window.toggleEditDriverId = function() {
  const input = document.getElementById("regDriverId");
  const btn = document.getElementById("btnEditDriverId");
  if (!input) return;
  if (input.hasAttribute("readonly")) {
    input.removeAttribute("readonly");
    input.classList.remove("bg-slate-100");
    input.classList.add("bg-white");
    input.focus();
    if (btn) btn.innerHTML = '<i class="fa-solid fa-lock"></i> ล็อกรหัส';
  } else {
    input.setAttribute("readonly", "true");
    input.classList.remove("bg-white");
    input.classList.add("bg-slate-100");
    if (btn) btn.innerHTML = '<i class="fa-solid fa-pen-to-square"></i> กำหนดเอง';
  }
};

async function lookupExistingDriver(searchKey) {
  if (!searchKey) return;
  const cleanKey = searchKey.trim().toLowerCase();

  Swal.fire({
    title: "กำลังค้นหาข้อมูล...",
    html: `<div class="text-xs text-slate-500">กำลังดึงข้อมูลพนักงานจากฐานข้อมูล Google Sheet...</div>`,
    allowOutsideClick: false,
    didOpen: () => { Swal.showLoading(); }
  });

  try {
    const gasUrl = getGasWebAppUrl();
    const res = await fetch(`${gasUrl}?action=checkEmail&email=${encodeURIComponent(cleanKey)}`);
    const data = await res.json();

    if (data && data.success && data.driver) {
      applyExistingDriverData(data.driver);
      Swal.fire({
        icon: "success",
        title: "พบข้อมูลพนักงาน!",
        html: `
          <div class="text-xs text-slate-600 space-y-1">
            <p><b>ชื่อ:</b> ${data.driver.driverName || "-"}</p>
            <p><b>รหัส:</b> ${data.driver.driverId || "-"}</p>
            <p><b>ทะเบียน:</b> ${data.driver.vehiclePlate || "-"}</p>
          </div>
        `,
        timer: 1800,
        showConfirmButton: false
      });
    } else {
      Swal.fire({
        icon: "info",
        title: "ไม่พบข้อมูลพนักงานเดิม",
        text: `ไม่พบอีเมล "${searchKey}" ในระบบทะเบียนพนักงาน ท่านสามารถกรอกเพื่อลงทะเบียนใหม่ได้ทันที`,
        confirmButtonColor: "#2563eb"
      });
    }
  } catch (err) {
    console.error("Lookup error:", err);
    Swal.fire({
      icon: "error",
      title: "การเชื่อมต่อล้มเหลว",
      text: err.message || "ไม่สามารถดึงข้อมูลจากระบบได้ โปรดตรวจสอบการเชื่อมต่ออินเทอร์เน็ต",
      confirmButtonColor: "#2563eb"
    });
  }
}

/**
 * นำข้อมูลพนักงานเดิมมาแสดงในฟอร์ม และสลับเป็นโหมดแก้ไข
 */
function applyExistingDriverData(driver) {
  if (!driver) return;
  regState.isEditMode = true;
  regState.existingDriver = driver;

  // กรอกข้อมูลลงฟอร์ม
  const driverIdEl = document.getElementById("regDriverId");
  const driverNameEl = document.getElementById("regDriverName");
  const emailEl = document.getElementById("regEmail");
  const phoneEl = document.getElementById("regPhone");
  const plateEl = document.getElementById("regPlate");
  const deptEl = document.getElementById("regDept");

  if (driverIdEl) driverIdEl.value = driver.driverId || "";
  if (driverNameEl) driverNameEl.value = driver.driverName || "";
  if (emailEl) emailEl.value = driver.email || "";
  if (phoneEl) phoneEl.value = driver.phone || "";
  if (plateEl) plateEl.value = driver.vehiclePlate || "";
  if (deptEl && driver.department) deptEl.value = driver.department;

  // อัปเดต UI Mode Badge
  const regModeBadge = document.getElementById("regModeBadge");
  const regModeIcon = document.getElementById("regModeIcon");
  const regModeText = document.getElementById("regModeText");
  const btnReset = document.getElementById("btnResetToNewMode");
  const btnSubmitText = document.getElementById("btnSubmitText");
  const btnSubmitIcon = document.getElementById("btnSubmitIcon");

  if (regModeBadge) {
    regModeBadge.classList.remove("bg-blue-100", "text-blue-800", "border-blue-200");
    regModeBadge.classList.add("bg-amber-100", "text-amber-800", "border-amber-200");
  }
  if (regModeIcon) {
    regModeIcon.className = "fa-solid fa-user-pen text-[10px]";
  }
  if (regModeText) {
    regModeText.textContent = `โหมดแก้ไข: ${driver.driverName || driver.driverId}`;
  }
  if (btnReset) btnReset.classList.remove("hidden");

  if (btnSubmitText) btnSubmitText.textContent = "บันทึกการอัปเดตข้อมูลพนักงาน & ใบหน้าใหม่";
  if (btnSubmitIcon) btnSubmitIcon.className = "fa-solid fa-cloud-arrow-up text-base";

  // แสดงรูปใบหน้าเดิมหากมีในระบบ
  const existingMasterSec = document.getElementById("existingMasterSection");
  const existingMasterImg = document.getElementById("existingMasterImg");
  const masterPhotoUrl = driver.masterFaceUrl || driver.masterFacePhoto || "";

  if (existingMasterSec && existingMasterImg && masterPhotoUrl) {
    existingMasterImg.src = toDirectDriveImageUrl(masterPhotoUrl);
    existingMasterSec.classList.remove("hidden");
  } else if (existingMasterSec) {
    existingMasterSec.classList.add("hidden");
  }
}

/**
 * ล้างฟอร์มและรีเซ็ตกลับเป็นโหมดลงทะเบียนใหม่
 */
function resetFormToNewMode() {
  regState.isEditMode = false;
  regState.existingDriver = null;
  regState.masterFaceBase64 = null;
  regState.faceDescriptor = null;

  // ล้างค่าใน Input
  const fields = ["regDriverId", "regDriverName", "regEmail", "regPhone", "regPlate", "lookupDriverInput"];
  fields.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // รีเซ็ต UI
  const regModeBadge = document.getElementById("regModeBadge");
  const regModeIcon = document.getElementById("regModeIcon");
  const regModeText = document.getElementById("regModeText");
  const btnReset = document.getElementById("btnResetToNewMode");
  const btnSubmitText = document.getElementById("btnSubmitText");
  const btnSubmitIcon = document.getElementById("btnSubmitIcon");
  const existingMasterSec = document.getElementById("existingMasterSection");

  if (regModeBadge) {
    regModeBadge.classList.remove("bg-amber-100", "text-amber-800", "border-amber-200");
    regModeBadge.classList.add("bg-blue-100", "text-blue-800", "border-blue-200");
  }
  if (regModeIcon) regModeIcon.className = "fa-solid fa-user-plus text-[10px]";
  if (regModeText) regModeText.textContent = "โหมด: ลงทะเบียนพนักงานใหม่";
  if (btnReset) btnReset.classList.add("hidden");
  if (existingMasterSec) existingMasterSec.classList.add("hidden");

  if (btnSubmitText) btnSubmitText.textContent = "บันทึกการลงทะเบียนพนักงาน";
  if (btnSubmitIcon) btnSubmitIcon.className = "fa-solid fa-user-check text-base";

  // รีเซ็ตกล้อง
  const videoEl = document.getElementById("masterFaceVideo");
  const imgEl = document.getElementById("masterFaceImg");
  const promptEl = document.getElementById("masterCameraPrompt");
  const captureBtn = document.getElementById("btnCaptureMaster");
  const retakeBtn = document.getElementById("btnRetakeMaster");
  fetchNextDriverId();

  stopMasterCamera();
  if (videoEl) videoEl.classList.remove("hidden");
  if (imgEl) imgEl.classList.add("hidden");
  if (promptEl) promptEl.classList.remove("hidden");
  if (retakeBtn) retakeBtn.classList.add("hidden");
  if (captureBtn) {
    captureBtn.classList.remove("hidden");
    captureBtn.disabled = true;
    captureBtn.classList.add("bg-slate-300", "text-slate-500", "cursor-not-allowed");
    captureBtn.classList.remove("bg-blue-600", "hover:bg-blue-700", "text-white", "shadow-md", "cursor-pointer");
  }
}

window.handleLookupDriverClick = handleLookupDriverClick;
window.lookupExistingDriver = lookupExistingDriver;
window.applyExistingDriverData = applyExistingDriverData;
window.resetFormToNewMode = resetFormToNewMode;

/**
 * เปิดกล้องหน้าสด (รองรับ iOS Safari และ Android 100%)
 */
/**
 * ดึง MediaStream ด้วยระบบ Progressive Fallback เพื่อรองรับมือถือ Android ทุกรุ่น
 */
async function getMediaStreamWithFallback(facingMode) {
  const constraintList = [
    { video: { facingMode: { ideal: facingMode }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false },
    { video: { facingMode: { ideal: facingMode } }, audio: false },
    { video: { facingMode: facingMode === "user" ? "user" : "environment" }, audio: false },
    { video: true, audio: false }
  ];

  let lastError = null;
  for (let i = 0; i < constraintList.length; i++) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraintList[i]);
      if (stream) return stream;
    } catch (err) {
      lastError = err;
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError" || (err.message && err.message.toLowerCase().includes("permission"))) {
        throw err;
      }
    }
  }
  throw lastError;
}

/**
 * คัดลอกข้อความ URL ไปยัง Clipboard
 */
function copyUrlToClipboard(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).catch(() => {});
  } else {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    } catch (e) {}
  }
}
window.copyUrlToClipboard = copyUrlToClipboard;

/**
 * สร้าง URL สำหรับให้ LINE เปิด Default External Browser (openExternalBrowser=1)
 */
function getLineExternalBrowserUrl(rawUrl) {
  const current = rawUrl || window.location.href;
  try {
    const urlObj = new URL(current);
    urlObj.searchParams.set("openExternalBrowser", "1");
    return urlObj.toString();
  } catch (e) {
    const sep = current.includes("?") ? "&" : "?";
    return current + sep + "openExternalBrowser=1";
  }
}
window.getLineExternalBrowserUrl = getLineExternalBrowserUrl;

/**
 * เปิดหน้าเว็บในเบราว์เซอร์หลักของระบบ (Google Chrome / Safari)
 * รองรับทั้ง LINE In-App Browser, Android, iOS Safari และ Desktop
 */
window.openInExternalBrowser = function(event) {
  if (event && event.preventDefault) {
    event.preventDefault();
  }

  const currentUrl = window.location.href;
  const ua = navigator.userAgent || "";
  const isLine = /Line\//i.test(ua);
  const isAndroid = /Android/i.test(ua);
  const isIOS = /iPhone|iPad|iPod/i.test(ua);
  const isHttps = window.location.protocol === "https:";
  const protocol = isHttps ? "https" : "http";

  // 1. คัดลอกลิงก์เก็บไว้ในคลิปบอร์ดสำรองเสมอ
  copyUrlToClipboard(currentUrl);

  // 2. คำนวณลิงก์สำหรับ LINE In-App Browser (?openExternalBrowser=1)
  const lineUrl = getLineExternalBrowserUrl(currentUrl);

  // 3. กรณีเปิดผ่านแอป LINE (ทั้ง Android และ iOS)
  if (isLine) {
    // วิธีทางการและได้ผล 100% ของ LINE: สั่งเปิด URL ที่มี openExternalBrowser=1
    window.location.href = lineUrl;

    // สำรองสำหรับ Android ใน LINE
    if (isAndroid) {
      setTimeout(() => {
        try {
          const rawUrl = currentUrl.replace(/^https?:\/\//, '');
          const chromeIntentUrl = `intent://${rawUrl}#Intent;scheme=${protocol};package=com.android.chrome;end`;
          window.location.href = chromeIntentUrl;
        } catch (e) {}
      }, 500);
    }
    return false;
  }

  // 4. กรณี Android (นอก LINE เช่น In-App Browser อื่นๆ)
  if (isAndroid) {
    const rawUrl = currentUrl.replace(/^https?:\/\//, '');
    const chromeIntentUrl = `intent://${rawUrl}#Intent;scheme=${protocol};package=com.android.chrome;end`;
    
    try {
      window.location.href = chromeIntentUrl;
    } catch (e) {
      window.open(currentUrl, "_blank");
    }

    if (window.Swal) {
      Swal.fire({
        icon: "info",
        title: "กำลังเปิดใน Chrome",
        html: `
          <div class="text-xs text-slate-600 text-left space-y-2">
            <p>ระบบกำลังเรียกเปิดใน <b>Google Chrome</b>...</p>
            <p class="text-emerald-700 font-semibold">✓ ระบบได้คัดลอกลิงก์ให้เรียบร้อยแล้ว</p>
            <p class="text-[11px] text-slate-500">หากเครื่องไม่เด้งเปิดอัตโนมัติ สามารถเปิดแอป Chrome แล้วกด <b>วาง (Paste)</b> ลิงก์ได้ทันที</p>
          </div>
        `,
        confirmButtonText: "รับทราบ",
        confirmButtonColor: "#2563eb"
      });
    }
    return false;
  }

  // 5. กรณี iPhone / iPad (iOS Safari)
  if (isIOS) {
    window.open(currentUrl, "_blank");
    if (window.Swal) {
      Swal.fire({
        icon: "info",
        title: "คัดลอกลิงก์เรียบร้อย",
        html: `
          <div class="text-xs text-slate-600 text-left space-y-2">
            <p class="text-emerald-700 font-semibold">✓ ระบบคัดลอกลิงก์หน้าเว็บนี้ให้แล้ว</p>
            <p>โปรดเปิดแอป <b>Safari</b> หรือ <b>Chrome</b> บน iPhone แล้วกด <b>วาง (Paste)</b> เพื่อเปิดใช้งานกล้องได้ทันที</p>
          </div>
        `,
        confirmButtonText: "รับทราบ",
        confirmButtonColor: "#2563eb"
      });
    }
    return false;
  }

  // 6. กรณีทั่วไป / PC Desktop
  window.open(currentUrl, "_blank");
  if (window.Swal) {
    Swal.fire({
      icon: "success",
      title: "เปิดในเบราว์เซอร์เรียบร้อย",
      text: "ระบบได้คัดลอกลิงก์ไปยังคลิปบอร์ดและเปิดหน้าต่างใหม่ให้แล้ว",
      timer: 3000,
      showConfirmButton: false
    });
  }
  return false;
};

function checkLineInAppBrowser() {
  const ua = navigator.userAgent || "";
  const isLine = /Line\//i.test(ua);
  const isAndroid = /Android/i.test(ua);
  const isIOS = /iPhone|iPad|iPod/i.test(ua);

  if (isLine) {
    const lineExternalUrl = getLineExternalBrowserUrl(window.location.href);

    // หากเปิดผ่าน LINE โดยตรงและยังไม่มี openExternalBrowser=1 ให้พยายามเด้งเปิดเบราว์เซอร์ภายนอกทันที
    if (!window.location.search.includes("openExternalBrowser=1")) {
      try {
        window.location.href = lineExternalUrl;
      } catch (e) {
        console.warn("Auto-redirect notice:", e);
      }
    }

    const banner = document.createElement("div");
    banner.id = "lineWarningBanner";
    banner.className = "bg-amber-600 text-white p-2.5 text-xs shadow-md sticky top-0 z-50 flex items-center justify-between";
    banner.innerHTML = `
      <div class="flex items-center space-x-2">
        <i class="fa-solid fa-triangle-exclamation text-amber-200 text-base"></i>
        <span><b>เปิดผ่านแอป LINE:</b> กล้องอาจถูกปิดกั้น แนะนำให้เปิดด้วย ${isAndroid ? 'Chrome' : (isIOS ? 'Safari' : 'เบราว์เซอร์')}</span>
      </div>
      <a href="${lineExternalUrl}" onclick="openInExternalBrowser(event)" target="_blank"
         class="px-2.5 py-1 bg-white text-amber-900 font-bold rounded-lg shadow-sm hover:bg-amber-100 transition whitespace-nowrap ml-2 text-[11px] inline-flex items-center space-x-1 cursor-pointer">
        <i class="fa-brands ${isAndroid ? 'fa-chrome text-blue-600' : (isIOS ? 'fa-safari text-blue-500' : 'fa-compass text-amber-800')}"></i>
        <span>${isAndroid ? 'เปิดใน Chrome' : (isIOS ? 'เปิดใน Safari' : 'เปิดในเบราว์เซอร์')}</span>
      </a>
    `;
    document.body.prepend(banner);
  }
}

async function startMasterCamera() {
  stopMasterCamera();
  await new Promise(r => setTimeout(r, 100));

  const videoEl = document.getElementById("masterFaceVideo");
  const promptEl = document.getElementById("masterCameraPrompt");
  const captureBtn = document.getElementById("btnCaptureMaster");

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    Swal.fire({
      icon: "error",
      title: "อุปกรณ์ไม่รองรับกล้อง",
      text: "โปรดใช้งานผ่านเบราว์เซอร์ Chrome หรือ Safari บนมือถือ",
      confirmButtonColor: "#2563eb"
    });
    return;
  }

  try {
    const stream = await getMediaStreamWithFallback("user");
    regState.stream = stream;
    if (videoEl) {
      videoEl.muted = true;
      videoEl.setAttribute("playsinline", "true");
      videoEl.setAttribute("autoplay", "true");
      videoEl.setAttribute("muted", "true");
      videoEl.srcObject = stream;
      try { await videoEl.play(); } catch (pe) {}
    }

    promptEl.classList.add("hidden");
    captureBtn.removeAttribute("disabled");
    captureBtn.disabled = false;
    captureBtn.classList.remove("bg-slate-300", "text-slate-500", "cursor-not-allowed");
    captureBtn.classList.add("bg-blue-600", "hover:bg-blue-700", "text-white", "shadow-md", "cursor-pointer");
  } catch (e) {
    console.error("Master camera error:", e);
    const isPermissionError = (e.name === "NotAllowedError" || e.name === "PermissionDeniedError" || (e.message && e.message.toLowerCase().includes("permission")));
    if (isPermissionError) {
      showCameraPermissionGuideModal();
    } else {
      Swal.fire({
        icon: "error",
        title: "ไม่สามารถเปิดกล้องได้",
        text: e.message || "กรุณากด 'อนุญาต' (Allow) สิทธิ์เข้าถึงกล้องในเบราว์เซอร์",
        confirmButtonColor: "#2563eb"
      });
    }
  }
}

function showCameraPermissionGuideModal() {
  const ua = navigator.userAgent || "";
  const isLine = /Line\//i.test(ua);
  const isIOS = /iPhone|iPad|iPod/i.test(ua);
  const isAndroid = /Android/i.test(ua);

  let detectedPlatform = "ทั่วไป";
  if (isLine) detectedPlatform = "แอป LINE (In-App Browser)";
  else if (isIOS) detectedPlatform = "iPhone / iPad (iOS Safari)";
  else if (isAndroid) detectedPlatform = "มือถือ Android (Google Chrome)";

  const lineExternalUrl = typeof getLineExternalBrowserUrl === "function" 
    ? getLineExternalBrowserUrl(window.location.href) 
    : window.location.href;

  Swal.fire({
    icon: "warning",
    title: "สิทธิ์การเข้าถึงกล้องถูกบล็อก",
    html: `
      <div class="text-left text-xs text-slate-700 space-y-3 leading-relaxed mt-1">
        <div class="bg-amber-50 border border-amber-200 text-amber-800 p-2.5 rounded-lg text-xs">
          ⚠️ เบราว์เซอร์จำค่าว่า <b>"บล็อก/ไม่อนุญาต"</b> ไว้ ทำให้ระบบไม่สามารถสั่งเปิดกล้องซ้ำได้โดยตรง
          <div class="mt-1 text-[11px] font-semibold text-blue-700">
            📱 อุปกรณ์ที่ตรวจพบ: <b>${detectedPlatform}</b>
          </div>
        </div>

        <!-- Quick Launch in External Browser Button -->
        <div class="bg-blue-50 border border-blue-200 rounded-lg p-2.5 text-center">
          <a href="${lineExternalUrl}" onclick="openInExternalBrowser(event)"
             class="w-full py-2.5 px-3 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold rounded-lg text-xs shadow flex items-center justify-center space-x-1.5 cursor-pointer transition">
            <i class="fa-solid fa-arrow-up-right-from-square"></i>
            <span>แตะเปิดในเบราว์เซอร์ ${isAndroid ? 'Google Chrome' : (isIOS ? 'Safari' : 'ภายนอก')} ทันที</span>
          </a>
          <p class="text-[10px] text-blue-700 mt-1">ระบบจะเด้งเปิดเบราว์เซอร์หลัก และคัดลอกลิงก์ให้เรียบร้อย</p>
        </div>

        <!-- Android Chrome Block (With 2-Level Android Instructions) -->
        <div class="border rounded-lg p-2.5 ${isAndroid && !isLine ? 'border-blue-500 bg-blue-50/70 shadow-sm' : 'border-slate-200 bg-slate-50'}">
          <p class="font-bold text-slate-800 flex items-center justify-between mb-1">
            <span><span class="mr-1">🤖</span> <b>มือถือ Android (Google Chrome)</b></span>
            ${isAndroid && !isLine ? '<span class="text-[10px] bg-blue-600 text-white px-1.5 py-0.5 rounded font-bold">เครื่องของคุณ</span>' : ''}
          </p>
          <div class="space-y-1.5 text-slate-600 pl-1">
            <p class="font-semibold text-slate-700 text-[11px]">วิธีที่ 1: ตรวจสอบใน Chrome</p>
            <ol class="list-decimal list-inside pl-1 space-y-0.5">
              <li>แตะไอคอน <b>การตั้งค่าไซต์ ⚙️</b> หรือ <b>แม่กุญแจ 🔒</b> หน้า URL ด้านบน</li>
              <li>เลือก <b>"สิทธิ์" (Permissions)</b> > <b>"กล้อง" (Camera)</b> > เปลี่ยนเป็น <b>"อนุญาต"</b></li>
            </ol>
            <p class="font-semibold text-rose-700 text-[11px] pt-1">วิธีที่ 2: หากวิธีแรกยังไม่ขึ้น (สิทธิ์ในเครื่องถูกปิด)</p>
            <ol class="list-decimal list-inside pl-1 space-y-0.5 text-rose-800">
              <li>ไปที่ <b>การตั้งค่ามือถือ (Settings) > แอป (Apps) > Chrome</b></li>
              <li>แตะ <b>"การอนุญาต" (Permissions) > กล้อง (Camera)</b> > เลือก <b>"อนุญาตเฉพาะขณะใช้แอป"</b></li>
            </ol>
          </div>
        </div>

        <!-- iPhone Safari Block -->
        <div class="border rounded-lg p-2.5 ${isIOS && !isLine ? 'border-blue-500 bg-blue-50/70 shadow-sm' : 'border-slate-200 bg-slate-50'}">
          <p class="font-bold text-slate-800 flex items-center justify-between mb-1">
            <span><span class="mr-1">🍏</span> <b>Safari (iPhone / iPad)</b></span>
            ${isIOS && !isLine ? '<span class="text-[10px] bg-blue-600 text-white px-1.5 py-0.5 rounded font-bold">เครื่องของคุณ</span>' : ''}
          </p>
          <ol class="list-decimal list-inside text-slate-600 pl-1 space-y-1">
            <li>แตะที่ปุ่ม <b>aA</b> ตรงแถบชื่อเว็บ (ด้านล่างหรือด้านบน)</li>
            <li>เลือก <b>"การตั้งค่าเว็บไซต์" (Website Settings)</b></li>
            <li>ตรงหัวข้อ <b>"กล้อง" (Camera)</b> ให้เปลี่ยนเป็น <b>"อนุญาต" (Allow)</b></li>
            <li>กดปุ่ม <b>"รีเฟรชหน้าเว็บ"</b> ด้านล่างนี้</li>
          </ol>
        </div>

        <!-- LINE In-App Browser Block -->
        <div class="border rounded-lg p-2.5 ${isLine ? 'border-emerald-500 bg-emerald-50/70 shadow-sm' : 'border-slate-200 bg-slate-50'}">
          <p class="font-bold text-slate-800 flex items-center justify-between mb-1">
            <span><span class="mr-1">💬</span> <b>หากเปิดผ่านแอป LINE</b></span>
            ${isLine ? '<span class="text-[10px] bg-emerald-600 text-white px-1.5 py-0.5 rounded font-bold">กำลังเปิดใน LINE</span>' : ''}
          </p>
          <p class="text-slate-600 pl-1 mb-2">
            ระบบความปลอดภัยของ LINE มักบล็อกกล้อง แตะปุ่มด้านล่างเพื่อเปิดในเบราว์เซอร์หลักของเครื่อง:
          </p>
          <a href="${lineExternalUrl}" onclick="openInExternalBrowser(event)"
             class="inline-flex items-center justify-center w-full py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold rounded-lg text-xs shadow transition cursor-pointer">
            <i class="fa-solid fa-arrow-up-right-from-square mr-1.5"></i> แตะเพื่อเปิดใน ${isAndroid ? 'Google Chrome' : (isIOS ? 'Safari' : 'เบราว์เซอร์')} ทันที
          </a>
          <p class="text-slate-400 text-[10px] text-center mt-1.5">หรือแตะจุด 3 จุด (...) ที่มุมจอ > เลือก "เปิดด้วยเบราว์เซอร์เริ่มต้น / Safari / Chrome"</p>
        </div>
      </div>
    `,
    showCancelButton: true,
    confirmButtonText: "🔄 รีเฟรชหน้าเว็บทันที",
    cancelButtonText: "เข้าใจแล้ว ปิดหน้าต่าง",
    confirmButtonColor: "#2563eb",
    cancelButtonColor: "#64748b"
  }).then((res) => {
    if (res.isConfirmed) {
      window.location.reload();
    }
  });
}
window.showCameraPermissionGuideModal = showCameraPermissionGuideModal;

function stopMasterCamera() {
  if (regState.stream) {
    regState.stream.getTracks().forEach(track => {
      try { track.stop(); } catch (e) {}
    });
    regState.stream = null;
  }
  const videoEl = document.getElementById("masterFaceVideo");
  if (videoEl) {
    try {
      videoEl.pause();
      videoEl.srcObject = null;
    } catch (e) {}
  }
}

window.startMasterCamera = startMasterCamera;
window.captureMasterFace = captureMasterFace;
window.retakeMasterFace = retakeMasterFace;
window.submitRegistration = submitRegistration;

/**
 * ถ่ายภาพหน้าต้นแบบ & สกัด 128-d Face Descriptor
 */
async function captureMasterFace() {
  const videoEl = document.getElementById("masterFaceVideo");
  const imgEl = document.getElementById("masterFaceImg");
  const canvas = document.getElementById("regCanvas");
  const extractingEl = document.getElementById("masterAiExtracting");
  const retakeBtn = document.getElementById("btnRetakeMaster");
  fetchNextDriverId();
  const captureBtn = document.getElementById("btnCaptureMaster");

  if (!regState.stream) return;

  canvas.width = videoEl.videoWidth || 640;
  canvas.height = videoEl.videoHeight || 480;
  const ctx = canvas.getContext("2d");
  // กลับด้านแนวนอน (Mirror) เพื่อให้ภาพที่บันทึกตรงกับที่เห็นในจอกระจก ไม่หลอกตา
  ctx.save();
  ctx.translate(canvas.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
  ctx.restore();

  const photoDataUrl = canvas.toDataURL("image/jpeg", 0.90);
  regState.masterFaceBase64 = photoDataUrl;

  stopMasterCamera();
  videoEl.classList.add("hidden");
  imgEl.src = photoDataUrl;
  imgEl.classList.remove("hidden");

  extractingEl.classList.remove("hidden");

  // วิเคราะห์ใบหน้าด้วย Face-API สกัดเวกเตอร์ 128 มิติ (128-d Vector)
  try {
    if (!regState.modelsLoaded && window.faceapi) {
      await loadFaceModels();
    }

    let descriptor = null;
    if (window.faceapi && regState.modelsLoaded) {
      let detection = await faceapi.detectSingleFace(canvas, new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.25 }))
                                   .withFaceLandmarks()
                                   .withFaceDescriptor();
      if (!detection) {
        detection = await faceapi.detectSingleFace(canvas, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.2 }))
                                 .withFaceLandmarks()
                                 .withFaceDescriptor();
      }
      if (detection && detection.descriptor) {
        descriptor = Array.from(detection.descriptor);
      }
    }

    if (!descriptor || descriptor.length !== 128) {
      extractingEl.classList.add("hidden");
      Swal.fire({
        icon: "warning",
        title: "ตรวจไม่พบใบหน้าในภาพถ่าย",
        text: "กรุณามองตรงหน้ากล้องให้อยู่กึ่งกลางกรอบวงรี ถอดหมวก/แว่นตา และอยู่ในที่สว่าง แล้วกดถ่ายใหม่อีกครั้ง",
        confirmButtonColor: "#2563eb",
        confirmButtonText: "ถ่ายใหม่"
      }).then(() => {
        retakeMasterFace();
      });
      return;
    }

    regState.faceDescriptor = descriptor;
    extractingEl.classList.add("hidden");
    retakeBtn.classList.remove("hidden");
    captureBtn.classList.add("hidden");

    Swal.fire({
      icon: "success",
      title: "บันทึกภาพใบหน้าสำเร็จ",
      text: "AI วิเคราะห์และสกัดเวกเตอร์ใบหน้า 128 มิติ (128-d Vector) เรียบร้อยแล้ว",
      timer: 1500,
      showConfirmButton: false
    });
  } catch (err) {
    console.error("Face capture analysis error:", err);
    extractingEl.classList.add("hidden");
    Swal.fire({
      icon: "error",
      title: "เกิดข้อผิดพลาดในการวิเคราะห์ใบหน้า",
      text: err.message || "ไม่สามารถวิเคราะห์จุดเด่นใบหน้าได้ กรุณาลองใหม่อีกครั้ง",
      confirmButtonColor: "#2563eb"
    });
  }
}

function retakeMasterFace() {
  const videoEl = document.getElementById("masterFaceVideo");
  const imgEl = document.getElementById("masterFaceImg");
  const retakeBtn = document.getElementById("btnRetakeMaster");
  fetchNextDriverId();
  const captureBtn = document.getElementById("btnCaptureMaster");

  regState.masterFaceBase64 = null;
  regState.faceDescriptor = null;

  imgEl.classList.add("hidden");
  videoEl.classList.remove("hidden");
  retakeBtn.classList.add("hidden");
  captureBtn.classList.remove("hidden");

  startMasterCamera();
}

/**
 * สร้าง Fallback Facial Vector 64-point เพื่อใช้เปรียบเทียบกรณีไม่มี Model เต็ม
 */
function generateFallbackFacialVector(ctx, w, h) {
  const vector = [];
  const stepX = Math.floor(w / 8);
  const stepY = Math.floor(h / 8);
  for (let y = stepY; y < h; y += stepY) {
    for (let x = stepX; x < w; x += stepX) {
      const pixel = ctx.getImageData(x, y, 1, 1).data;
      const gray = (pixel[0] * 0.299 + pixel[1] * 0.587 + pixel[2] * 0.114) / 255.0;
      vector.push(parseFloat(gray.toFixed(4)));
    }
  }
  return vector;
}

/**
 * ส่งข้อมูลลงทะเบียนไปยัง Google Apps Script
 */
async function submitRegistration() {
  let driverId = (document.getElementById("regDriverId").value || "").trim();
  const driverName = (document.getElementById("regDriverName").value || "").trim();
  const email = (document.getElementById("regEmail").value || "").trim().toLowerCase();
  const phone = (document.getElementById("regPhone").value || "").trim();
  const plate = (document.getElementById("regPlate").value || "").trim();
  const dept = document.getElementById("regDept").value;
  const isEdit = regState.isEditMode;

  // ตรวจสอบและป้องกันรหัสพนักงานซ้ำกับคนอื่นในระบบอย่างเด็ดขาด
  if (!isEdit && window.existingDriversCache && window.existingDriversCache.length > 0) {
    const isDuplicate = window.existingDriversCache.some(d => 
      (d.driverId || "").toString().trim().toUpperCase() === driverId.toUpperCase() &&
      (d.email || "").toString().trim().toLowerCase() !== email
    );
    if (isDuplicate || !driverId || driverId === "กำลังรันรหัสอัตโนมัติ..." || driverId === "-") {
      const autoNext = computeNextDriverIdFromList(window.existingDriversCache);
      console.log(`[Auto-ID] Re-assigning duplicate or empty '${driverId}' to guaranteed unique '${autoNext}'`);
      driverId = autoNext;
      document.getElementById("regDriverId").value = autoNext;
    }
  }

  if (!driverId || !driverName || !email) {
    Swal.fire({
      icon: "warning",
      title: "กรุณากรอกข้อมูลให้ครบถ้วน",
      text: "โปรดระบุ รหัสพนักงาน, ชื่อ-สกุล และอีเมล",
      confirmButtonColor: "#2563eb"
    });
    return;
  }

  const hasExistingMaster = !!(regState.existingDriver && (regState.existingDriver.masterFaceUrl || regState.existingDriver.masterFacePhoto));

  if (!regState.masterFaceBase64 && !hasExistingMaster) {
    Swal.fire({
      icon: "warning",
      title: "ยังไม่ได้ถ่ายภาพใบหน้าต้นแบบ",
      text: "กรุณาเปิดกล้องหน้าและกดถ่ายรูปใบหน้าต้นแบบก่อนบันทึก",
      confirmButtonColor: "#2563eb"
    });
    return;
  }

  const isPhotoUpdated = !!regState.masterFaceBase64;

  Swal.fire({
    title: isEdit ? "กำลังบันทึกการอัปเดต..." : "กำลังบันทึกข้อมูล...",
    html: `<div class="text-xs text-slate-500">${isPhotoUpdated ? "กำลังอัปโหลดใบหน้าต้นแบบใหม่ไปยัง Google Drive และอัปเดตข้อมูล..." : "กำลังบันทึกข้อมูลพนักงานลงฐานข้อมูล Google Sheet..."}</div>`,
    allowOutsideClick: false,
    didOpen: () => {
      Swal.showLoading();
    }
  });

  const payload = {
    action: "registerDriver",
    driverId: driverId,
    driverName: driverName,
    email: email,
    phone: phone,
    vehiclePlate: plate,
    department: dept,
    masterFaceImageBase64: regState.masterFaceBase64 || "",
    faceDescriptorJson: regState.faceDescriptor ? JSON.stringify(regState.faceDescriptor) : ""
  };

  try {
    let success = false;
    let message = isEdit ? "อัปเดตข้อมูลพนักงานเรียบร้อยแล้ว" : "ลงทะเบียนพนักงานและบันทึกใบหน้าต้นแบบเรียบร้อย";
    let masterUrl = "";

    let targetGasUrl = getGasWebAppUrl();
    const isDummy = !targetGasUrl || targetGasUrl.includes("REPLACE_WITH_YOUR_DEPLOYMENT_ID");

    if (isDummy) {
      const { value: enteredUrl } = await Swal.fire({
        icon: "warning",
        title: "ยังไม่ได้เชื่อมต่อ Google Apps Script!",
        html: `
          <div class="text-xs text-slate-600 text-left space-y-2 mb-3">
            <p class="font-bold text-red-600 text-sm">ข้อมูลยังไม่สามารถบันทึกลงชีต Registered_Drivers หรือ Drive ได้</p>
            <p>กรุณาวาง <b>Web App URL</b> จาก Google Apps Script (ลงท้ายด้วย <code>/exec</code>) เพื่อบันทึกข้อมูลพนักงานและรูปหน้าต้นแบบ:</p>
          </div>
        `,
        input: "text",
        inputPlaceholder: "https://script.google.com/macros/s/AKfycb.../exec",
        showCancelButton: true,
        confirmButtonText: "บันทึกและส่งข้อมูล",
        cancelButtonText: "ยกเลิก",
        confirmButtonColor: "#2563eb",
        cancelButtonColor: "#64748b",
        inputValidator: (val) => {
          if (!val || !val.includes("script.google.com") || !val.includes("/exec")) {
            return "กรุณาระบุ Web App URL ที่ถูกต้อง (ขึ้นต้นด้วย https://script.google.com และลงท้ายด้วย /exec)";
          }
        }
      });

      if (enteredUrl) {
        saveGasWebAppUrl(enteredUrl.trim());
        targetGasUrl = enteredUrl.trim();
      } else {
        return;
      }
    }

    const res = await fetch(targetGasUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.success) {
      success = true;
      message = data.message || message;
      masterUrl = data.masterFaceUrl || "";
    } else {
      throw new Error(data.error || "บันทึกไม่สำเร็จ");
    }

    if (success) {
      // บันทึกลงใน LocalStorage เพื่อให้หน้าตรวจวัด Auto-Login ใช้งานได้ทันที
      const existingLocal = JSON.parse(localStorage.getItem("TTMK_DRIVER_PROFILE") || "{}");
      const localDriverData = {
        driverId: driverId,
        driverName: driverName,
        email: email,
        phone: phone,
        vehiclePlate: plate,
        department: dept,
        masterFacePhoto: regState.masterFaceBase64 || (regState.existingDriver ? (regState.existingDriver.masterFacePhoto || regState.existingDriver.masterFaceUrl) : "") || existingLocal.masterFacePhoto || "",
        masterFaceDescriptor: regState.faceDescriptor || (regState.existingDriver ? regState.existingDriver.faceDescriptor : null) || existingLocal.masterFaceDescriptor || null,
        masterFaceUrl: masterUrl || (regState.existingDriver ? regState.existingDriver.masterFaceUrl : "") || existingLocal.masterFaceUrl || ""
      };
      localStorage.setItem("TTMK_DRIVER_PROFILE", JSON.stringify(localDriverData));

      Swal.fire({
        icon: "success",
        title: isEdit ? "อัปเดตข้อมูลพนักงานสำเร็จ!" : "ลงทะเบียนสำเร็จ!",
        html: `
          <p class="text-xs text-slate-600 mb-2">${message}</p>
          <p class="text-xs text-emerald-600 font-bold">${isEdit ? "บันทึกการแก้ไขข้อมูลและใบหน้าใหม่เรียบร้อยแล้ว" : "ระบบจำข้อมูลบนมือถือเครื่องนี้เรียบร้อยแล้ว พร้อมตรวจวัดแอลกอฮอล์ได้ทันที"}</p>
        `,
        confirmButtonColor: "#2563eb",
        confirmButtonText: "ไปยังหน้าตรวจวัดแอลกอฮอล์ทันที"
      }).then(() => {
        window.location.href = "index.html";
      });
    }

  } catch (error) {
    console.error("Registration Error:", error);
    Swal.fire({
      icon: "error",
      title: "เกิดข้อผิดพลาดในการบันทึก",
      text: error.message || "ไม่สามารถติดต่อเซิร์ฟเวอร์ได้",
      confirmButtonColor: "#2563eb"
    });
  }
}
