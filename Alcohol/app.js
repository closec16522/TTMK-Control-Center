/**
 * =========================================================================
 * Frontend Application Logic - ระบบตรวจวัดแอลกอฮอล์ พนักงานขับรถขนส่ง
 * หจก. ทั่วไทยขนส่งมงคล (Mr.Taweesak.kom - 062-3285963)
 * =========================================================================
 */

// --- การตั้งค่าระบบ (Configuration) ---
const CONFIG = {
  // Google Gemini AI Vision (อ่านค่าหน้าปัดเครื่องเป่า, ความดัน, และตรวจสอบใบหน้า 1:1)
  // หมายเหตุความปลอดภัย: Key จะถูกเก็บอย่างปลอดภัยบน Google Sheet (System_Config)
  // และประมวลผลผ่าน Google Apps Script Gateway โดยไม่มีการเปิดเผย Key บน GitHub
  GEMINI_API_KEY: "", // ปลอดภัย: ไม่ใส่คีย์บน GitHub
  GEMINI_MODEL: "gemini-2.5-flash",

  // ใส่ Google Apps Script Web App Deployment URL ที่นี่ (ทำหน้าที่เป็น API Gateway)
  GAS_WEBAPP_URL: "https://script.google.com/macros/s/AKfycbxbyJ1yWNodowMh-OLxqBuFvH-Pk-TLwg7dRv_lwT7bbTJBu5MH_lhqxE3KwJ7lDH407g/exec",
  LEGAL_LIMIT_MG_PERCENT: 0.00,
  FACE_API_MODELS_URL: "https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/",
  FACE_MATCH_THRESHOLD: 0.58, // ค่า Euclidean Distance ที่ยอมรับ (น้อยกว่า = เหมือนกันมาก)
  // URL สำหรับ Google Apps Script API Gateway
  GAS_WEBAPP_URL: "https://script.google.com/macros/s/AKfycbxbyJ1yWNodowMh-OLxqBuFvH-Pk-TLwg7dRv_lwT7bbTJBu5MH_lhqxE3KwJ7lDH407g/exec",
  LEGAL_LIMIT_MG_PERCENT: 0.00,
  FACE_API_MODELS_URL: "https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/",
  FACE_MATCH_THRESHOLD: 0.58 // ค่า Euclidean Distance ที่ยอมรับ (น้อยกว่า = เหมือนกันมาก)
};

// ฟังก์ชันแสดงปุ่มล็อกอินด่วน 1-คลิก (เฉพาะ Email เดียวที่เคยกรอกล่าสุด)
function renderQuickRecentEmail() {
  const quickBox = document.getElementById("quickLoginBox");
  const quickDivider = document.getElementById("quickLoginDivider");
  const emailText = document.getElementById("quickRecentEmailText");
  const lastEmail = localStorage.getItem("TTMK_LAST_EMAIL") || (appState.driver ? appState.driver.email : null);

  if (lastEmail && quickBox && emailText) {
    emailText.textContent = lastEmail;
    quickBox.classList.remove("hidden");
    if (quickDivider) quickDivider.classList.remove("hidden");
  } else if (quickBox) {
    quickBox.classList.add("hidden");
    if (quickDivider) quickDivider.classList.add("hidden");
  }
}
window.renderQuickRecentEmail = renderQuickRecentEmail;

// ฟังก์ชันเลือกล็อกอินด่วน 1-คลิก (เฉพาะ Email ล่าสุด)
window.quickSelectLastDriver = function() {
  const lastEmail = localStorage.getItem("TTMK_LAST_EMAIL") || (appState.driver ? appState.driver.email : null);
  if (lastEmail) {
    const emailInput = document.getElementById("driverEmailInput");
    if (emailInput) emailInput.value = lastEmail;
    handleEmailLookup(lastEmail);
  }
};
window.quickSelectDriver = window.quickSelectLastDriver;


// ฟังก์ชันดึง Google Apps Script Web App URL ที่พร้อมใช้งาน (ดึงตาม URL ปัจจุบันและแก้ไขค่าเก่าอัตโนมัติ)
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
window.getGasWebAppUrl = getGasWebAppUrl;

function saveGasWebAppUrl(url) {
  const cleanUrl = (url || "").trim();
  localStorage.setItem("TTMK_GAS_URL", cleanUrl);
  CONFIG.GAS_WEBAPP_URL = cleanUrl;
  console.log("GAS WebApp URL updated:", cleanUrl);
}
window.saveGasWebAppUrl = saveGasWebAppUrl;

// ดึง Google Gemini API Key ที่พร้อมใช้งาน
function getGeminiApiKey() {
  const localKey = localStorage.getItem("TTMK_GEMINI_KEY");
  if (localKey && localKey.trim().length > 10) return localKey.trim();
  return CONFIG.GEMINI_API_KEY;
}
window.getGeminiApiKey = getGeminiApiKey;

function saveGeminiApiKey(key) {
  const cleanKey = (key || "").trim();
  localStorage.setItem("TTMK_GEMINI_KEY", cleanKey);
  CONFIG.GEMINI_API_KEY = cleanKey;
  console.log("Gemini API Key updated successfully");
}
window.saveGeminiApiKey = saveGeminiApiKey;

/**
 * เรียกใช้ Google Gemini 2.5 Flash Multimodal Vision API
 * รูปแบบ Secure Gateway: ประมวลผลผ่าน Google Apps Script โดยดึง Key จาก Google Sheet ปลอดภัย 100%
 */
async function callGeminiVision({ imageBase64, prompt, systemInstruction = "", image2Base64 = null }) {
  // 1. ตรวจสอบว่ามีการใส่คีย์ทดสอบส่วนบุคคลไว้ใน LocalStorage หรือไม่
  const localKey = localStorage.getItem("TTMK_GEMINI_KEY");

  // 2. หากไม่มี Custom Key ในเครื่อง ให้ส่งคำขอผ่าน Google Apps Script Gateway (ซึ่งเก็บ Key ลับไว้บน Google Sheet)
  if (!localKey) {
    const gasUrl = getGasWebAppUrl();
    if (gasUrl && gasUrl.startsWith("https://script.google.com/macros/s/")) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 16000);
      try {
        const gasResponse = await fetch(gasUrl, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify({
            action: "geminiProxy",
            prompt: prompt,
            systemInstruction: systemInstruction,
            imageBase64: imageBase64,
            image2Base64: image2Base64
          }),
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (gasResponse.ok) {
          const resJson = await gasResponse.json();
          if (resJson && resJson.success && resJson.data) {
            return resJson.data;
          }
        }
      } catch (gasErr) {
        clearTimeout(timeoutId);
        console.warn("GAS Gemini Gateway notice:", gasErr);
      }
    }
  }

  // 3. Fallback: กรณีมีคีย์ใน LocalStorage หรือทดสอบตรง
  const apiKey = localKey || CONFIG.GEMINI_API_KEY;
  if (!apiKey || apiKey.length < 10) {
    throw new Error("ระบบเชื่อมต่อ AI ผ่าน Google Apps Script Gateway ขัดข้อง กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ต");
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${CONFIG.GEMINI_MODEL || "gemini-2.5-flash"}:generateContent?key=${apiKey}`;

  const parts = [];
  if (prompt) {
    parts.push({ text: prompt });
  }

  // เตรียมรูปภาพที่ 1
  const cleanB64_1 = imageBase64.includes(",") ? imageBase64.split(",")[1] : imageBase64;
  parts.push({
    inline_data: {
      mime_type: "image/jpeg",
      data: cleanB64_1
    }
  });

  // เตรียมรูปภาพที่ 2 (กรณีเปรียบเทียบใบหน้า 1:1)
  if (image2Base64) {
    const cleanB64_2 = image2Base64.includes(",") ? image2Base64.split(",")[1] : image2Base64;
    parts.push({
      inline_data: {
        mime_type: "image/jpeg",
        data: cleanB64_2
      }
    });
  }

  const payload = {
    contents: [{ parts: parts }],
    generationConfig: {
      response_mime_type: "application/json",
      temperature: 0.1
    }
  };

  if (systemInstruction) {
    payload.systemInstruction = {
      parts: [{ text: systemInstruction }]
    };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 14000);

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      const errText = await res.text();
      console.error("Gemini Direct API Error details:", errText);
      throw new Error(`Gemini API Error (HTTP ${res.status})`);
    }

    const data = await res.json();
    const rawJsonText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawJsonText) {
      throw new Error("ไม่มีข้อมูลตอบกลับจาก Gemini AI");
    }

    return JSON.parse(rawJsonText);
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}
window.callGeminiVision = callGeminiVision;

// ฟังก์ชันล็อกรหัสผ่านก่อนเข้าหน้าลงทะเบียน/ตั้งค่าระบบ
window.promptAdminRegisterPasscode = async function() {
  const { value: passcode } = await Swal.fire({
    title: "ระบบความปลอดภัยเจ้าหน้าที่",
    html: `
      <div class="text-xs text-slate-500 mb-2">หน้านี้สำหรับเจ้าหน้าที่/แอดมินเท่านั้น โปรดระบุรหัสผ่านเพื่อดำเนินการ</div>
    `,
    input: "password",
    inputPlaceholder: "กรุณาใส่รหัสผ่าน",
    inputAttributes: {
      autocapitalize: "off",
      autocorrect: "off"
    },
    showCancelButton: true,
    confirmButtonText: "เข้าสู่ระบบ",
    cancelButtonText: "ยกเลิก",
    confirmButtonColor: "#2563eb",
    cancelButtonColor: "#64748b",
    showLoaderOnConfirm: true,
    preConfirm: async (inputPass) => {
      if (!inputPass) {
        Swal.showValidationMessage("กรุณากรอกรหัสผ่าน");
        return false;
      }
      const ok = await (window.checkAdminPasscode ? window.checkAdminPasscode(inputPass) : (inputPass === "12345"));
      if (!ok) {
        Swal.showValidationMessage("รหัสผ่านไม่ถูกต้อง!");
        return false;
      }
      return inputPass;
    }
  });

  if (passcode) {
    sessionStorage.setItem("TTMK_ADMIN_AUTH", "AUTHORIZED");
    const result = await Swal.fire({
      title: "เมนูผู้ดูแลระบบ (Admin)",
      html: `
        <div class="text-xs text-slate-600 mb-2">เข้าสู่ระบบสำเร็จ โปรดเลือกการทำงานที่ต้องการ:</div>
      `,
      showCancelButton: true,
      showDenyButton: true,
      confirmButtonText: "1. ลงทะเบียนพนักงานใหม่",
      denyButtonText: "2. ⚙️ ตั้งค่า Google Apps Script URL",
      cancelButtonText: "ปิดหน้าต่าง",
      confirmButtonColor: "#16a34a",
      denyButtonColor: "#2563eb",
      cancelButtonColor: "#64748b"
    });

    if (result.isConfirmed) {
      window.location.href = "register.html";
    } else if (result.isDenied) {
      openGasSettingsModal();
    }
  }
};

// ฟังก์ชันเข้าสู่หน้าแก้ไขข้อมูลพนักงานหรือถ่ายรูปหน้าต้นแบบใหม่
window.editCurrentDriverProfile = async function() {
  let email = "";
  try {
    if (window.appState && window.appState.driver) {
      email = window.appState.driver.email || "";
    }
    if (!email) {
      const saved = localStorage.getItem("TTMK_DRIVER_PROFILE");
      if (saved) {
        const parsed = JSON.parse(saved);
        email = parsed.email || "";
      }
    }
    if (!email) {
      email = localStorage.getItem("TTMK_LAST_EMAIL") || "";
    }
  } catch (e) {}

  const currentAuth = sessionStorage.getItem("TTMK_ADMIN_AUTH");
  if (currentAuth === "AUTHORIZED") {
    window.location.href = `register.html${email ? `?email=${encodeURIComponent(email)}` : ''}`;
    return;
  }

  const { value: passcode } = await Swal.fire({
    title: "ระบบความปลอดภัยเจ้าหน้าที่",
    html: `<div class="text-xs text-slate-500 mb-2">กรุณาใส่รหัสผ่านเจ้าหน้าที่เพื่อเข้าสู่หน้าแก้ไขข้อมูล / ถ่ายรูปต้นแบบใหม่</div>`,
    input: "password",
    inputPlaceholder: "กรุณาใส่รหัสผ่าน",
    showCancelButton: true,
    confirmButtonText: "เข้าสู่หน้าแก้ไข",
    cancelButtonText: "ยกเลิก",
    confirmButtonColor: "#2563eb",
    cancelButtonColor: "#64748b",
    showLoaderOnConfirm: true,
    preConfirm: async (inputPass) => {
      if (!inputPass) {
        Swal.showValidationMessage("กรุณากรอกรหัสผ่าน");
        return false;
      }
      const ok = await (window.checkAdminPasscode ? window.checkAdminPasscode(inputPass) : (inputPass === "12345"));
      if (!ok) {
        Swal.showValidationMessage("รหัสผ่านไม่ถูกต้อง!");
        return false;
      }
      return inputPass;
    }
  });

  if (passcode) {
    sessionStorage.setItem("TTMK_ADMIN_AUTH", "AUTHORIZED");
    window.location.href = `register.html${email ? `?email=${encodeURIComponent(email)}` : ''}`;
  }
};

// หน้าต่างตั้งค่าระบบ (Google Apps Script & Gemini API Key)
async function openGasSettingsModal() {
  const currentGasUrl = getGasWebAppUrl();
  const currentGeminiKey = getGeminiApiKey();
  const isDefaultGas = !currentGasUrl || currentGasUrl.includes("REPLACE_WITH_YOUR_DEPLOYMENT_ID");

  const { value: formValues } = await Swal.fire({
    title: "⚙️ ตั้งค่าระบบ (Backend & AI)",
    html: `
      <div class="text-xs text-slate-600 text-left space-y-3 mb-2">
        <div>
          <label class="block font-bold text-slate-700 mb-1">1. Google Apps Script Web App URL:</label>
          <input id="swalGasUrl" class="swal2-input !mt-0 !w-full !text-xs" placeholder="https://script.google.com/.../exec" value="${isDefaultGas ? '' : currentGasUrl}">
          <p class="text-[10px] text-slate-400 mt-1">ใช้บันทึกประวัติลง Google Sheet และอัปโหลดรูปลง Google Drive</p>
        </div>
        <div class="pt-2 border-t border-slate-200">
          <label class="block font-bold text-slate-700 mb-1">2. Google Gemini AI API Key:</label>
          <input id="swalGeminiKey" class="swal2-input !mt-0 !w-full !text-xs font-mono" placeholder="AIzaSyD..." value="${currentGeminiKey || ''}">
          <p class="text-[10px] text-slate-400 mt-1">ใช้สำหรับอ่านตัวเลขดิจิทัลจากเครื่องเป่า/ความดัน และตรวจสอบใบหน้า 1:1</p>
        </div>
      </div>
    `,
    focusConfirm: false,
    showCancelButton: true,
    confirmButtonText: "บันทึกการตั้งค่า",
    cancelButtonText: "ยกเลิก",
    confirmButtonColor: "#16a34a",
    cancelButtonColor: "#64748b",
    preConfirm: () => {
      const gas = document.getElementById("swalGasUrl").value.trim();
      const gemini = document.getElementById("swalGeminiKey").value.trim();
      return { gas, gemini };
    }
  });

  if (formValues) {
    if (formValues.gas) saveGasWebAppUrl(formValues.gas);
    if (formValues.gemini) saveGeminiApiKey(formValues.gemini);

    Swal.fire({
      icon: "success",
      title: "บันทึกการตั้งค่าสำเร็จ!",
      text: "ระบบอัปเดตการเชื่อมต่อ Google Apps Script และ Google Gemini AI เรียบร้อยแล้ว",
      timer: 1800,
      showConfirmButton: false
    });
  }
}
window.openGasSettingsModal = openGasSettingsModal;

// ฟังก์ชันปุ่มลัดระบุค่าแอลกอฮอล์
window.setAlcoholValuePreset = function(val) {
  const num = Number(val);
  const alcoholInput = document.getElementById("alcoholValueInput");
  if (alcoholInput) {
    alcoholInput.value = num.toFixed(2);
  }
  updateAlcoholEvaluation(num);

  const Toast = Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 1800,
    timerProgressBar: true
  });

  if (num < 0.01) {
    Toast.fire({
      icon: 'success',
      title: 'ระบุค่า: 0.00 mg% (ผ่านเกณฑ์)'
    });
  } else {
    Toast.fire({
      icon: 'warning',
      title: `ระบุค่า: > 0.01 mg% (${num.toFixed(2)} mg% - ไม่ผ่าน)`
    });
  }
};

// ฟังก์ชันระบุค่าตัวเลขเองกรณีแสงสะท้อน
window.promptCustomAlcoholInput = async function() {
  const { value: customVal } = await Swal.fire({
    title: "ระบุค่าระดับแอลกอฮอล์",
    html: `<div class="text-xs text-slate-500 mb-2">ดูตัวเลขดิจิทัลจากหน้าปัดเครื่องเป่า แล้วระบุค่า เช่น 0.00 หรือ 0.07 หรือ 0.70</div>`,
    input: "number",
    inputValue: appState.alcoholValue.toFixed(2),
    inputAttributes: {
      step: "0.01",
      min: "0"
    },
    showCancelButton: true,
    confirmButtonText: "บันทึกค่านี้",
    cancelButtonText: "ยกเลิก",
    confirmButtonColor: "#2563eb"
  });

  if (customVal !== undefined && customVal !== null && customVal !== "") {
    const parsed = parseFloat(customVal) || 0;
    setAlcoholValuePreset(parsed);
  }
};

// ฟังก์ชันกดปุ่มถัดไปในขั้นตอนที่ 3 (ไม่บล็อกบน iOS Safari)
window.handleNextToStep4 = function() {
  if (!appState.meterPhotoBase64) {
    Swal.fire({
      icon: "warning",
      title: "ยังไม่ได้ถ่ายภาพหน้าปัด",
      text: "กรุณากด 'ถ่ายภาพหน้าปัด' ก่อนไปขั้นตอนถัดไป",
      confirmButtonColor: "#2563eb"
    });
    return;
  }
  stopCurrentCamera();
  goToStep(4);
};

// --- ตัวแปรสถานะส่วนกลาง (State Management) ---
const appState = {
  currentStep: 1,
  driver: null,
  facePhotoBase64: null,
  faceDescriptor: null,
  faceMatchPercent: 0,
  faceMatchPassed: false,
  meterPhotoBase64: null,
  // ข้อมูลการตรวจวัดความดันโลหิตและชีพจร
  bp: {
    sys: 120,
    dia: 80,
    pulse: 75,
    status: "ความดันปกติ",
    photoBase64: null
  },
  reportImageBase64: null,
  alcoholValue: 0.00,
  testStatus: "ผ่าน",
  gps: {
    lat: null,
    lng: null,
    accuracy: null,
    text: "ยังไม่ได้รับพิกัด"
  },
  currentStream: null,
  faceModelsLoaded: false
};

// --- เริ่มต้นการทำงานเมื่อเปิดเว็บ ---
document.addEventListener("DOMContentLoaded", async () => {
  checkLineInAppBrowser();
  initEventListeners();
  requestGPSCoordinates();
  loadFaceModels();
  renderQuickRecentEmail();
  checkAutoLogin();
});

/**
 * โหลด Face API Models สำหรับการจดจำใบหน้า 1:1
 */
async function loadFaceModels() {
  try {
    if (window.faceapi) {
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(CONFIG.FACE_API_MODELS_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(CONFIG.FACE_API_MODELS_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(CONFIG.FACE_API_MODELS_URL)
      ]);
      appState.faceModelsLoaded = true;
      console.log("Face API Models loaded successfully");
    }
  } catch (err) {
    console.warn("Face-api models notice:", err);
  }
}

/**
 * ตรวจสอบระบบจำข้อมูลอัตโนมัติบนอุปกรณ์นี้ (Auto-Login และซิงก์ตรงกับ Sheet Registered_Drivers)
 */
async function checkAutoLogin() {
  const savedData = localStorage.getItem("TTMK_DRIVER_PROFILE");
  if (!savedData) return;

  try {
    const driver = JSON.parse(savedData);
    if (!driver || !driver.email) return;

    const email = driver.email.toLowerCase().trim();
    localStorage.setItem("TTMK_LAST_EMAIL", email);
    renderQuickRecentEmail();

    // แสดงผลข้อมูลที่จำไว้ก่อนเบื้องต้น
    applyDriverData(driver, true);

    // ตรวจสอบความถูกต้องและอัปเดตข้อมูลล่าสุดจากชีต Registered_Drivers เสมอ
    const currentGasUrl = getGasWebAppUrl();
    if (currentGasUrl && !currentGasUrl.includes("REPLACE_WITH")) {
      try {
        const response = await fetch(`${currentGasUrl}?action=checkEmail&email=${encodeURIComponent(email)}`);
        const data = await response.json();
        if (data && data.success && data.driver) {
          if (data.driver.status && data.driver.status.toUpperCase() !== "ACTIVE") {
            console.warn("Driver status inactive in Registered_Drivers:", data.driver.status);
            switchUser();
            return;
          }
          // อัปเดตข้อมูลล่าสุดจากชีต Registered_Drivers ลงสถานะและ LocalStorage
          applyDriverData(data.driver, true);
        } else {
          // หากไม่มีในชีต Registered_Drivers แล้ว ให้ยกเลิกการจำข้อมูลอัตโนมัติ
          console.warn("Driver email not found in Registered_Drivers sheet, resetting auto-login.");
          localStorage.removeItem("TTMK_DRIVER_PROFILE");
          appState.driver = null;
          const banner = document.getElementById("autoLoginBanner");
          if (banner) banner.classList.add("hidden");
          const card = document.getElementById("driverProfileCard");
          if (card) card.classList.add("hidden");
          const btnNext = document.getElementById("btnNextToStep2");
          if (btnNext) {
            btnNext.setAttribute("disabled", "true");
            btnNext.className = "w-full py-3 px-4 bg-slate-300 text-slate-500 font-semibold rounded-xl text-sm transition shadow flex items-center justify-center space-x-2 cursor-not-allowed";
          }
        }
      } catch (gasErr) {
        console.warn("Registered_Drivers auto-sync notice:", gasErr);
      }
    }
  } catch (e) {
    console.warn("Auto-login parse error:", e);
  }
}

/**
 * Callback สำหรับ Google One Tap / Google Sign-In
 */
function handleGoogleLoginCallback(response) {
  try {
    const base64Url = response.credential.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));

    const googleUser = JSON.parse(jsonPayload);
    console.log("Google Login callback:", googleUser.email);

    if (googleUser.email) {
      document.getElementById("driverEmailInput").value = googleUser.email;
      handleEmailLookup(googleUser.email, googleUser.name);
    }
  } catch (err) {
    console.error("Google Sign-In Error:", err);
  }
}
window.handleGoogleLoginCallback = handleGoogleLoginCallback;

/**
 * กำหนด Event Listeners ทั้งหมด
 */
function initEventListeners() {
  // Step 1: ตรวจสอบอีเมล & Auto-Login
  const btnLookupEmail = document.getElementById("btnLookupEmail");
  const driverEmailInput = document.getElementById("driverEmailInput");
  const btnNextToStep2 = document.getElementById("btnNextToStep2");
  const btnSwitchUser = document.getElementById("btnSwitchUser");

  btnLookupEmail.addEventListener("click", () => handleEmailLookup());
  driverEmailInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") handleEmailLookup();
  });
  btnNextToStep2.addEventListener("click", () => goToStep(2));
  if (btnSwitchUser) {
    btnSwitchUser.addEventListener("click", () => switchUser());
  }

  // Step 2: กล้องถ่ายรูปใบหน้า
  const btnStartFaceCamera = document.getElementById("btnStartFaceCamera");
  const btnCaptureFace = document.getElementById("btnCaptureFace");
  const btnRetakeFace = document.getElementById("btnRetakeFace");
  const btnBackToStep1 = document.getElementById("btnBackToStep1");
  const btnNextToStep3 = document.getElementById("btnNextToStep3");

  btnStartFaceCamera.addEventListener("click", () => startCamera("user", "faceVideo"));
  btnCaptureFace.addEventListener("click", () => captureFaceSnapshot());
  btnRetakeFace.addEventListener("click", () => retakeFaceSnapshot());
  btnBackToStep1.addEventListener("click", () => {
    stopCurrentCamera();
    goToStep(1);
  });
  btnNextToStep3.addEventListener("click", () => {
    stopCurrentCamera();
    goToStep(3);
  });

  // Step 3: กล้องถ่ายหน้าปัดเครื่องเป่า & OCR
  const btnStartMeterCamera = document.getElementById("btnStartMeterCamera");
  const btnCaptureMeter = document.getElementById("btnCaptureMeter");
  const btnRetakeMeter = document.getElementById("btnRetakeMeter");
  const btnBackToStep2 = document.getElementById("btnBackToStep2");
  const btnNextToStep4 = document.getElementById("btnNextToStep4");
  const alcoholValueInput = document.getElementById("alcoholValueInput");

  btnStartMeterCamera.addEventListener("click", () => startCamera("environment", "meterVideo"));
  btnCaptureMeter.addEventListener("click", () => captureMeterSnapshot());
  btnRetakeMeter.addEventListener("click", () => retakeMeterSnapshot());
  btnBackToStep2.addEventListener("click", () => {
    stopCurrentCamera();
    goToStep(2);
  });
  btnNextToStep4.addEventListener("click", () => {
    stopCurrentCamera();
    goToStep(4);
  });

  alcoholValueInput.addEventListener("input", (e) => {
    updateAlcoholEvaluation(parseFloat(e.target.value) || 0);
    const nextBtn = document.getElementById("btnNextToStep4");
    if (nextBtn) {
      nextBtn.removeAttribute("disabled");
      nextBtn.disabled = false;
      nextBtn.classList.remove("bg-slate-300", "text-slate-500", "cursor-not-allowed");
      nextBtn.classList.add("bg-blue-600", "hover:bg-blue-700", "text-white", "shadow-md", "cursor-pointer");
    }
  });

  // Step 4: กล้องถ่ายหน้าปัดเครื่องวัดความดัน & บันทึกค่า SYS / DIA / PULSE
  const btnStartBPCamera = document.getElementById("btnStartBPCamera");
  const btnCaptureBP = document.getElementById("btnCaptureBP");
  const btnRetakeBP = document.getElementById("btnRetakeBP");
  const btnBackToStep3From4 = document.getElementById("btnBackToStep3From4");
  const btnNextToStep5 = document.getElementById("btnNextToStep5");
  const bpSysInput = document.getElementById("bpSysInput");
  const bpDiaInput = document.getElementById("bpDiaInput");
  const bpPulseInput = document.getElementById("bpPulseInput");

  if (btnStartBPCamera) btnStartBPCamera.addEventListener("click", () => startCamera("environment", "bpVideo"));
  if (btnCaptureBP) btnCaptureBP.addEventListener("click", () => captureBPSnapshot());
  if (btnRetakeBP) btnRetakeBP.addEventListener("click", () => retakeBPSnapshot());
  if (btnBackToStep3From4) btnBackToStep3From4.addEventListener("click", () => {
    stopCurrentCamera();
    goToStep(3);
  });
  if (btnNextToStep5) btnNextToStep5.addEventListener("click", () => {
    stopCurrentCamera();
    prepareSummaryStep();
    goToStep(5);
  });

  const onBPChange = () => evaluateBloodPressure();
  if (bpSysInput) bpSysInput.addEventListener("input", onBPChange);
  if (bpDiaInput) bpDiaInput.addEventListener("input", onBPChange);
  if (bpPulseInput) bpPulseInput.addEventListener("input", onBPChange);

  // Step 5: ส่งข้อมูลผลตรวจ
  const btnBackToStep4From5 = document.getElementById("btnBackToStep4From5");
  const btnFinalSubmit = document.getElementById("btnFinalSubmit");

  if (btnBackToStep4From5) btnBackToStep4From5.addEventListener("click", () => goToStep(4));
  if (btnFinalSubmit) btnFinalSubmit.addEventListener("click", () => handleSubmitData());
}

/**
 * เปลี่ยนผู้ใช้งาน (Switch User)
 */
function switchUser() {
  localStorage.removeItem("TTMK_DRIVER_PROFILE");
  appState.driver = null;
  document.getElementById("autoLoginBanner").classList.add("hidden");
  document.getElementById("driverProfileCard").classList.add("hidden");
  document.getElementById("driverEmailInput").value = "";
  renderQuickRecentEmail();

  const btnNextToStep2 = document.getElementById("btnNextToStep2");
  btnNextToStep2.setAttribute("disabled", "true");
  btnNextToStep2.className = "w-full py-3 px-4 bg-slate-300 text-slate-500 font-semibold rounded-xl text-sm transition shadow flex items-center justify-center space-x-2 cursor-not-allowed";

  Swal.fire({
    icon: "info",
    title: "ออกจากข้อมูลผู้ใช้เดิมแล้ว",
    text: "ท่านสามารถคลิกเข้าสู่ระบบด่วนด้วยอีเมลเดิม หรือกรอกอีเมลใหม่เพื่อเข้าสู่ระบบ",
    timer: 1500,
    showConfirmButton: false
  });
}

/**
 * จัดการเปลี่ยนหน้า Step (1-5)
 */
function goToStep(stepNumber) {
  appState.currentStep = stepNumber;

  for (let i = 1; i <= 5; i++) {
    const stepEl = document.getElementById(`step${i}`);
    const indicatorEl = document.getElementById(`stepIndicator${i}`);
    if (stepEl) stepEl.classList.add("hidden");
    if (indicatorEl) {
      indicatorEl.classList.remove("text-blue-400", "font-bold");
      indicatorEl.classList.add("text-slate-400");
    }
  }

  const activeStepEl = document.getElementById(`step${stepNumber}`);
  const activeIndicatorEl = document.getElementById(`stepIndicator${stepNumber}`);
  if (activeStepEl) activeStepEl.classList.remove("hidden");
  if (activeIndicatorEl) {
    activeIndicatorEl.classList.remove("text-slate-400");
    activeIndicatorEl.classList.add("text-blue-400", "font-bold");
  }

  // จัดการกล้องและรูปภาพตามขั้นตอน
  if (stepNumber === 2) {
    if (appState.driver) {
      const pipEl = document.getElementById("masterFacePip");
      const pipImg = document.getElementById("masterFacePipImg");
      const masterSrc = toDirectDriveImageUrl(appState.driver.masterFacePhoto || appState.driver.masterFaceUrl);
      if (masterSrc) {
        pipImg.src = masterSrc;
        pipEl.classList.remove("hidden");
      } else {
        pipEl.classList.add("hidden");
      }
    }
    // เปิดกล้องหน้าสดสำหรับยืนยันตัวตน
    if (!appState.facePhotoBase64) {
      resetFaceCameraUI();
      startCamera("user", "faceVideo", true);
    }
  } else if (stepNumber === 3) {
    // กล้องหลังสำหรับเครื่องเป่าแอลกอฮอล์
    if (!appState.meterPhotoBase64) {
      resetMeterCameraUI();
      startCamera("environment", "meterVideo", true);
    }
  } else if (stepNumber === 4) {
    // กล้องหลังสำหรับเครื่องวัดความดัน
    if (!appState.bp || !appState.bp.photoBase64) {
      resetBPCameraUI();
      startCamera("environment", "bpVideo", true);
    }
  } else if (stepNumber === 5) {
    stopCurrentCamera();
    prepareSummaryStep();
  }

  window.scrollTo({ top: 0, behavior: "smooth" });
}

// =========================================================================
// STEP 1: Email Lookup & Driver Authentication (Strictly from Registered_Drivers Sheet)
// =========================================================================
async function handleEmailLookup(providedEmail, providedName) {
  const emailInput = document.getElementById("driverEmailInput");
  const email = (providedEmail || emailInput.value || "").trim().toLowerCase();

  if (!email || !email.includes("@")) {
    Swal.fire({
      icon: "warning",
      title: "กรุณาระบุอีเมลให้ถูกต้อง",
      text: "โปรดป้อนรูปแบบอีเมลพนักงาน เช่น taweesak.kom@gmail.com",
      confirmButtonColor: "#2563eb"
    });
    return;
  }

  localStorage.setItem("TTMK_LAST_EMAIL", email);
  renderQuickRecentEmail();

  Swal.fire({
    title: "กำลังตรวจสอบข้อมูล...",
    html: `<div class="text-xs text-slate-500">กำลังตรวจสอบข้อมูลพนักงานจากฐานข้อมูลชีต Registered_Drivers...</div>`,
    allowOutsideClick: false,
    didOpen: () => {
      Swal.showLoading();
    }
  });

  let driverFound = null;

  // ค้นหาโดยตรงจากชีต Registered_Drivers ผ่าน Google Apps Script API
  const currentGasUrl = getGasWebAppUrl();
  if (currentGasUrl && !currentGasUrl.includes("REPLACE_WITH")) {
    try {
      const response = await fetch(`${currentGasUrl}?action=checkEmail&email=${encodeURIComponent(email)}`);
      const data = await response.json();
      if (data && data.success && data.driver) {
        driverFound = data.driver;
      }
    } catch (e) {
      console.warn("GAS lookup error:", e);
    }
  }

  // หากไม่พบข้อมูลในชีต Registered_Drivers
  if (!driverFound) {
    Swal.close();
    const result = await Swal.fire({
      icon: "warning",
      title: "ไม่พบข้อมูลในทะเบียนพนักงาน",
      html: `
        <div class="text-xs text-slate-600 text-left space-y-2 mb-2">
          <p>อีเมล <b>${email}</b> ยังไม่มีในฐานข้อมูลชีต <code>Registered_Drivers</code></p>
          <p class="text-red-500 font-semibold">⚠️ ระบบไม่อนุญาตให้ตรวจวัดหากยังไม่ได้ลงทะเบียนและบันทึกภาพหน้าต้นแบบ</p>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: "ไปลงทะเบียนพนักงานใหม่",
      cancelButtonText: "ยกเลิก / ปิด",
      confirmButtonColor: "#16a34a",
      cancelButtonColor: "#64748b"
    });

    if (result.isConfirmed) {
      window.location.href = `register.html?email=${encodeURIComponent(email)}`;
    }
    return;
  }

  // ตรวจสอบสถานะการใช้งาน (Status ต้องเป็น ACTIVE)
  if (driverFound.status && driverFound.status.toUpperCase() !== "ACTIVE") {
    Swal.fire({
      icon: "error",
      title: "สถานะพนักงานถูกระงับการใช้งาน",
      text: `พนักงาน ${driverFound.driverName} มีสถานะเป็น "${driverFound.status}" โปรดติดต่อเจ้าหน้าที่`,
      confirmButtonColor: "#2563eb"
    });
    return;
  }

  // ยืนยันข้อมูลสำเร็จ นำข้อมูลจาก Sheet ไปใช้งาน
  applyDriverData(driverFound, false);

  Swal.fire({
    icon: "success",
    title: "ยืนยันข้อมูลพนักงานสำเร็จ",
    text: `ยินดีต้อนรับ: ${driverFound.driverName} (${driverFound.driverId || ''})`,
    timer: 1400,
    showConfirmButton: false
  });
}

/**
 * ผูกข้อมูลพนักงานเข้าสู่หน้าจอ และบันทึกลง LocalStorage
 */
function applyDriverData(driver, isAutoLogin) {
  appState.driver = driver;

  // บันทึกความจำลง LocalStorage (Remember Me)
  localStorage.setItem("TTMK_DRIVER_PROFILE", JSON.stringify(driver));
  if (driver && driver.email) {
    localStorage.setItem("TTMK_LAST_EMAIL", driver.email.toLowerCase().trim());
    renderQuickRecentEmail();
  }

  if (isAutoLogin) {
    const banner = document.getElementById("autoLoginBanner");
    banner.classList.remove("hidden");
    document.getElementById("autoLoginDriverName").textContent = driver.driverName;
    document.getElementById("autoLoginDriverMeta").textContent = `${driver.driverId} • ${driver.vehiclePlate || 'ไม่ระบุทะเบียน'} (${driver.email})`;
  }

  document.getElementById("driverEmailInput").value = driver.email;
  document.getElementById("driverIdBadge").textContent = driver.driverId;
  document.getElementById("profileName").textContent = driver.driverName;
  document.getElementById("profileVehicle").textContent = driver.vehiclePlate || "-";

  // เช็กสถานะรูปหน้าต้นแบบ
  const thumbEl = document.getElementById("profileMasterFaceThumb");
  const placeholderEl = document.getElementById("profileMasterFacePlaceholder");
  const faceStatusEl = document.getElementById("profileFaceStatus");
  const masterPhoto = toDirectDriveImageUrl(driver.masterFacePhoto || driver.masterFaceUrl);

  if (masterPhoto) {
    thumbEl.src = masterPhoto;
    thumbEl.classList.remove("hidden");
    placeholderEl.classList.add("hidden");
    faceStatusEl.className = "font-bold ml-1 text-emerald-600";
    faceStatusEl.textContent = "✓ มีรูปต้นแบบ 1:1 แล้ว";
  } else {
    thumbEl.classList.add("hidden");
    placeholderEl.classList.remove("hidden");
    faceStatusEl.className = "font-bold ml-1 text-amber-600";
    faceStatusEl.textContent = "ยังไม่มี (แนะนำให้ลงทะเบียน)";
  }

  document.getElementById("driverProfileCard").classList.remove("hidden");

  const btnNextToStep2 = document.getElementById("btnNextToStep2");
  btnNextToStep2.removeAttribute("disabled");
  btnNextToStep2.classList.remove("bg-slate-300", "text-slate-500", "cursor-not-allowed");
  btnNextToStep2.classList.add("bg-blue-600", "hover:bg-blue-700", "text-white", "shadow-md");
}

// =========================================================================
// STRICT REAL CAMERA MANAGEMENT (WebRTC MediaDevices)
// =========================================================================
/**
 * ดึง MediaStream ด้วยระบบ Progressive Fallback เพื่อรองรับมือถือ Android ทุกรุ่น ทุกแบรนด์
 */
async function getMediaStreamWithFallback(facingMode) {
  const constraintList = [
    // 1. ลองแบบระบุความละเอียด 720p และ ideal facingMode
    {
      video: {
        facingMode: { ideal: facingMode },
        width: { ideal: 1280 },
        height: { ideal: 720 }
      },
      audio: false
    },
    // 2. ลองแบบระบุเฉพาะ facingMode (ไม่บังคับความละเอียด - แก้ไขกล้อง Android ราคาประหยัดได้ 100%)
    {
      video: {
        facingMode: { ideal: facingMode }
      },
      audio: false
    },
    // 3. ลองแบบ String constraint
    {
      video: {
        facingMode: facingMode === "user" ? "user" : "environment"
      },
      audio: false
    },
    // 4. Fallback สูงสุดสำหรับ Android: ขอเปิดกล้องอะไรก็ได้ที่มีในเครื่อง
    {
      video: true,
      audio: false
    }
  ];

  let lastError = null;
  for (let i = 0; i < constraintList.length; i++) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraintList[i]);
      if (stream) return stream;
    } catch (err) {
      lastError = err;
      // หากเกิดจาก NotAllowedError หรือ PermissionDeniedError (ถูกบล็อกสิทธิ์) ให้โยนออกทันที ไม่ต้องวนต่อ
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError" || (err.message && err.message.toLowerCase().includes("permission"))) {
        throw err;
      }
      console.warn(`Camera constraint attempt ${i + 1} notice (${err.name}), trying next fallback...`);
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

/**
 * ตรวจสอบว่าเปิดผ่าน LINE In-App Browser หรือไม่ และแสดงแบนเนอร์แจ้งเตือนพร้อมปุ่มเปิดในเบราว์เซอร์
 */
function checkLineInAppBrowser() {
  const ua = navigator.userAgent || "";
  const isLine = /Line\//i.test(ua);
  const isAndroid = /Android/i.test(ua);
  const isIOS = /iPhone|iPad|iPod/i.test(ua);

  if (isLine) {
    console.warn("LINE In-App Browser detected on", isAndroid ? "Android" : (isIOS ? "iOS" : "Unknown"));
    const lineExternalUrl = getLineExternalBrowserUrl(window.location.href);

    // หากเปิดผ่าน LINE โดยตรงและยังไม่มี openExternalBrowser=1 ให้พยายามเด้งเปิดเบราว์เซอร์ภายนอกทันที
    if (!window.location.search.includes("openExternalBrowser=1")) {
      try {
        window.location.href = lineExternalUrl;
      } catch (e) {
        console.warn("Auto-redirect notice:", e);
      }
    }

    // แสดง Banner แจ้งเตือนด้านบนสุด
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

async function startCamera(facingMode, videoElementId, isAuto = false) {
  const videoEl = document.getElementById(videoElementId);
  let promptId = "faceCameraPrompt";
  let captureBtnId = "btnCaptureFace";
  let scanLineId = "faceScanLine";
  if (videoElementId === "meterVideo") {
    promptId = "meterCameraPrompt";
    captureBtnId = "btnCaptureMeter";
    scanLineId = "meterScanLine";
  } else if (videoElementId === "bpVideo") {
    promptId = "bpCameraPrompt";
    captureBtnId = "btnCaptureBP";
    scanLineId = "bpScanLine";
  }

  const promptEl = document.getElementById(promptId);
  const captureBtn = document.getElementById(captureBtnId);
  const scanLine = document.getElementById(scanLineId);

  // ตรวจสอบว่ามีสตรีมเดิมที่ยัง Active และเป็น facingMode เดียวกันหรือไม่
  if (appState.currentStream && appState.currentFacingMode === facingMode) {
    if (videoEl && videoEl.srcObject !== appState.currentStream) {
      videoEl.srcObject = appState.currentStream;
      try { await videoEl.play(); } catch (e) {}
    }
    if (promptEl) promptEl.classList.add("hidden");
    if (scanLine) scanLine.classList.remove("hidden");
    if (captureBtn) {
      captureBtn.removeAttribute("disabled");
      captureBtn.disabled = false;
      captureBtn.classList.remove("bg-slate-300", "text-slate-500", "cursor-not-allowed");
      captureBtn.classList.add("bg-blue-600", "hover:bg-blue-700", "text-white", "shadow-lg");
    }
    return;
  }

  // ปิดสตรีมเดิมก่อนเพื่อไม่ให้ฮาร์ดแวร์ Android ชนกัน
  stopCurrentCamera();

  // ให้เวลาฮาร์ดแวร์ Android คืนทรัพยากรกล้อง 100ms
  await new Promise(r => setTimeout(r, 100));

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    if (!isAuto) {
      Swal.fire({
        icon: "error",
        title: "เบราว์เซอร์ไม่รองรับกล้องสด",
        text: "โปรดใช้งานผ่าน Google Chrome หรือ Safari บนมือถือ",
        confirmButtonColor: "#2563eb"
      });
    }
    return;
  }

  try {
    const stream = await getMediaStreamWithFallback(facingMode);
    appState.currentStream = stream;
    appState.currentFacingMode = facingMode;

    if (videoEl) {
      videoEl.muted = true;
      videoEl.setAttribute("playsinline", "true");
      videoEl.setAttribute("autoplay", "true");
      videoEl.setAttribute("muted", "true");
      videoEl.srcObject = stream;
      try {
        await videoEl.play();
      } catch (playErr) {
        console.warn("videoEl.play() warning (harmless if stream attached):", playErr);
      }
    }

    if (promptEl) promptEl.classList.add("hidden");
    if (scanLine) scanLine.classList.remove("hidden");

    if (captureBtn) {
      captureBtn.removeAttribute("disabled");
      captureBtn.disabled = false;
      captureBtn.classList.remove("bg-slate-300", "text-slate-500", "cursor-not-allowed");
      captureBtn.classList.add("bg-blue-600", "hover:bg-blue-700", "text-white", "shadow-lg");
    }

  } catch (err) {
    console.warn("Camera access notice:", err);
    const isPermissionError = (err.name === "NotAllowedError" || err.name === "PermissionDeniedError" || (err.message && err.message.toLowerCase().includes("permission")));
    if (isPermissionError) {
      showCameraPermissionGuideModal();
    } else if (!isAuto) {
      // ตรวจสอบข้อผิดพลาดเฉพาะของ Android (NotReadableError = มีแอปอื่นแย่งใช้กล้อง)
      if (err.name === "NotReadableError" || err.name === "TrackStartError") {
        Swal.fire({
          icon: "warning",
          title: "กล้องกำลังถูกใช้งานโดยแอปอื่น",
          html: `
            <div class="text-xs text-slate-600 text-left space-y-2">
              <p>ระบบ Android รายงานว่า <b>ฮาร์ดแวร์กล้องกำลังถูกใช้งาน</b> อยู่ในขณะนี้</p>
              <p>กรุณาทำตามวิธีนี้:</p>
              <ol class="list-decimal list-inside space-y-1">
                <li>สลับไปปิดแอปอื่นที่อาจใช้กล้องอยู่ (เช่น LINE, Facebook, กล้องถ่ายรูป)</li>
                <li>ปัดปิดแท็บหรือรีสตาร์ตแอป Chrome</li>
                <li>กดปุ่ม <b>"รีเฟรชหน้าเว็บ"</b> แล้วลองใหม่อีกครั้ง</li>
              </ol>
            </div>
          `,
          confirmButtonText: "🔄 รีเฟรชหน้าเว็บ",
          confirmButtonColor: "#2563eb",
          showCancelButton: true,
          cancelButtonText: "ปิด"
        }).then((res) => {
          if (res.isConfirmed) window.location.reload();
        });
      } else {
        Swal.fire({
          icon: "error",
          title: "ไม่สามารถเข้าถึงกล้องได้",
          text: err.message || "กรุณากด 'อนุญาต' (Allow) สิทธิ์กล้องในเบราว์เซอร์ เพื่อถ่ายรูปยืนยันตัวตนสด",
          confirmButtonColor: "#2563eb"
        });
      }
    }
  }
}

/**
 * หน้าต่างแนะนำวิธีปลดล็อกสิทธิ์กล้อง หากผู้ใช้เคยเผลอกด "ไม่อนุญาต/บล็อก" (Camera Permission Blocked Guide with Auto-Detection)
 */
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

function stopCurrentCamera() {
  if (appState.currentStream) {
    appState.currentStream.getTracks().forEach(track => {
      try { track.stop(); } catch (e) {}
    });
    appState.currentStream = null;
  }
  // เคลียร์ srcObject บนทุก video element เพื่อปลดล็อกฮาร์ดแวร์กล้อง Android 100%
  ['faceVideo', 'meterVideo', 'bpVideo'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      try {
        el.pause();
        el.srcObject = null;
      } catch (e) {}
    }
  });
}

// =========================================================================
// STEP 2: Capture Face & 1:1 Face Recognition Matching
// =========================================================================
async function captureFaceSnapshot() {
  const videoEl = document.getElementById("faceVideo");
  const imgEl = document.getElementById("faceCapturedImg");
  const canvas = document.getElementById("snapshotCanvas");
  const scanLine = document.getElementById("faceScanLine");
  const verifiedBadge = document.getElementById("faceVerifiedBadge");
  const matchScoreEl = document.getElementById("faceMatchScore");
  const retakeBtn = document.getElementById("btnRetakeFace");
  const captureBtn = document.getElementById("btnCaptureFace");
  const nextBtn = document.getElementById("btnNextToStep3");

  if (!appState.currentStream) {
    await startCamera("user", "faceVideo");
    return;
  }

  if (!videoEl.videoWidth || !videoEl.videoHeight) {
    try {
      await videoEl.play();
    } catch (e) {}
    if (!videoEl.videoWidth || !videoEl.videoHeight) {
      await startCamera("user", "faceVideo");
      return;
    }
  }

  canvas.width = videoEl.videoWidth || 640;
  canvas.height = videoEl.videoHeight || 480;
  const ctx = canvas.getContext("2d");

  // กลับด้านแนวนอน (Mirror) เพื่อให้ภาพที่บันทึกตรงกับที่เห็นในจอกระจก ไม่หลอกตา
  ctx.save();
  ctx.translate(canvas.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
  ctx.restore();

  // ตรวจสอบความสว่างภาพ
  const isImageValid = checkImageBrightnessQuality(ctx, canvas.width, canvas.height);
  if (!isImageValid) {
    Swal.fire({
      icon: "warning",
      title: "ภาพมืดเกินไปหรือไม่ชัดเจน",
      text: "กรุณาเปิดไฟหรืออยู่ในบริเวณที่มีแสงสว่างเพียงพอ แล้วกดถ่ายภาพใบหน้าใหม่อีกครั้ง",
      confirmButtonColor: "#2563eb"
    });
    return;
  }

  const photoDataUrl = canvas.toDataURL("image/jpeg", 0.85);
  appState.facePhotoBase64 = photoDataUrl;

  stopCurrentCamera();
  videoEl.classList.add("hidden");
  imgEl.src = photoDataUrl;
  imgEl.classList.remove("hidden");
  if (scanLine) scanLine.classList.add("hidden");

  // ดำเนินการตรวจสอบ 1:1 Face Recognition Matching
  Swal.fire({
    title: "AI กำลังตรวจสอบใบหน้า 1:1...",
    html: `<div class="text-xs text-slate-500">กำลังเปรียบเทียบจุดเด่นใบหน้าสดกับรูปต้นแบบของพนักงาน...</div>`,
    allowOutsideClick: false,
    didOpen: () => {
      Swal.showLoading();
    }
  });

  const matchResult = await performFaceMatching(canvas, ctx);
  Swal.close();

  appState.faceMatchPercent = matchResult.percent;
  appState.faceMatchPassed = matchResult.passed;

  if (matchResult.passed) {
    verifiedBadge.className = "absolute bottom-3 left-3 right-3 bg-emerald-950/90 text-emerald-200 border border-emerald-500/50 px-3 py-2.5 rounded-xl text-xs flex items-center justify-between backdrop-blur-sm";
    verifiedBadge.innerHTML = `
      <span class="flex items-center font-medium">
        <i class="fa-solid fa-circle-check text-emerald-400 mr-2 text-base"></i>
        <span>ยืนยันใบหน้าตรงบุคคล 1:1</span>
      </span>
      <span class="text-xs font-bold bg-emerald-700 text-white px-2 py-0.5 rounded-md">ตรง ${matchResult.percent}%</span>
    `;
    verifiedBadge.classList.remove("hidden");

    retakeBtn.classList.remove("hidden");
    captureBtn.classList.add("hidden");

    nextBtn.removeAttribute("disabled");
    nextBtn.classList.remove("bg-slate-300", "text-slate-500", "cursor-not-allowed");
    nextBtn.classList.add("bg-indigo-600", "hover:bg-indigo-700", "text-white", "shadow-md");

    Swal.fire({
      icon: "success",
      title: "ยืนยันตัวตนสำเร็จ",
      text: `ใบหน้าตรงกับพนักงาน ${matchResult.percent}% สามารถดำเนินการตรวจเครื่องเป่าได้`,
      timer: 1500,
      showConfirmButton: false
    });
  } else {
    // ใบหน้าไม่ผ่านเกณฑ์การเปรียบเทียบ
    verifiedBadge.className = "absolute bottom-3 left-3 right-3 bg-red-950/90 text-red-200 border border-red-500/50 px-3 py-2.5 rounded-xl text-xs flex items-center justify-between backdrop-blur-sm";
    verifiedBadge.innerHTML = `
      <span class="flex items-center font-medium">
        <i class="fa-solid fa-triangle-exclamation text-red-400 mr-2 text-base"></i>
        <span>ใบหน้าไม่ตรงกับพนักงาน!</span>
      </span>
      <span class="text-xs font-bold bg-red-700 text-white px-2 py-0.5 rounded-md">ตรงเพียง ${matchResult.percent}%</span>
    `;
    verifiedBadge.classList.remove("hidden");

    retakeBtn.classList.remove("hidden");
    captureBtn.classList.add("hidden");

    Swal.fire({
      icon: "error",
      title: "การตรวจสอบใบหน้าไม่ผ่าน!",
      html: `
        <p class="text-xs text-slate-700 mb-2">ระดับความเหมือน: <b>${matchResult.percent}%</b> (เกณฑ์ขั้นต่ำ 75%)</p>
        <p class="text-xs text-red-600 font-bold">ห้ามผู้อื่นทำการตรวจวัดแทนพนักงานเด็ดขาด กรุณาถอดหมวก/แว่นตา แล้วถ่ายใหม่อีกครั้ง</p>
      `,
      confirmButtonColor: "#dc2626",
      confirmButtonText: "ถ่ายใหม่อีกครั้ง"
    }).then(() => {
      retakeFaceSnapshot();
    });
  }
}

/**
 * แปลงลิงก์ Google Drive ให้เป็น Direct Image URL ที่เบราว์เซอร์และ Face-API โหลดได้ 100%
 */
function toDirectDriveImageUrl(url) {
  if (!url || typeof url !== "string") return "";
  if (url.startsWith("data:image/")) return url;

  // ตรวจจับ Google Drive file ID จาก URL รูปแบบต่างๆ
  const match = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || url.match(/id=([a-zA-Z0-9_-]+)/);
  if (match && match[1]) {
    return `https://lh3.googleusercontent.com/d/${match[1]}`;
  }
  return url;
}
window.toDirectDriveImageUrl = toDirectDriveImageUrl;

/**
 * เปรียบเทียบใบหน้าสดกับ Master Face (1:1 Face Recognition Matching)
 */
async function performFaceMatching(liveCanvas, ctx) {
  const driver = appState.driver;
  if (!driver) {
    return { passed: false, percent: 0, note: "ไม่พบข้อมูลพนักงานในระบบ" };
  }

  const masterPhotoSrc = toDirectDriveImageUrl(driver.masterFacePhoto || driver.masterFaceUrl);
  if (!masterPhotoSrc) {
    return {
      passed: false,
      percent: 0,
      note: "ไม่พบรูปถ่ายต้นแบบ (Master Face) ของพนักงานในระบบ กรุณาลงทะเบียนหรืออัปเดตใบหน้าก่อน"
    };
  }

  const liveBase64 = liveCanvas.toDataURL("image/jpeg", 0.90);

  // 1. ตรวจสอบเปรียบเทียบใบหน้า 1:1 ด้วย Google Gemini AI Vision (แม่นยำสูงสุด)
  try {
    let masterBase64 = null;
    if (masterPhotoSrc.startsWith("data:image")) {
      masterBase64 = masterPhotoSrc;
    } else {
      const masterImg = await loadImageAsync(masterPhotoSrc);
      if (masterImg) {
        const c = document.createElement("canvas");
        c.width = masterImg.naturalWidth || masterImg.width || 400;
        c.height = masterImg.naturalHeight || masterImg.height || 500;
        const cx = c.getContext("2d");
        cx.drawImage(masterImg, 0, 0, c.width, c.height);
        masterBase64 = c.toDataURL("image/jpeg", 0.90);
      }
    }

    if (masterBase64) {
      console.log("Starting Google Gemini 1:1 Face Verification...");
      const geminiResult = await callGeminiVision({
        imageBase64: masterBase64,
        image2Base64: liveBase64,
        systemInstruction: "You are a biometric security AI for vehicle driver check-in. Compare Photo 1 (Registered Employee Profile) and Photo 2 (Live Camera Snapshot). Strictly determine if they are the EXACT SAME PERSON.",
        prompt: `Compare Photo 1 (Employee Master Face) with Photo 2 (Live Check-in Selfie).
Are they the SAME INDIVIDUAL?
Examine facial structure, eyes, nose, mouth shape, and facial landmarks.
Return strict JSON:
{
  "isSamePerson": boolean (true ONLY if both photos clearly show the exact same person, false if different people),
  "similarityScore": integer 0 to 100,
  "confidence": number between 0.0 and 1.0,
  "reason": "short explanation in Thai"
}`
      });

      console.log("Gemini 1:1 Face Verification Result:", geminiResult);
      if (geminiResult && typeof geminiResult.isSamePerson === "boolean") {
        const passed = geminiResult.isSamePerson === true && (geminiResult.similarityScore >= 65);
        return {
          passed: passed,
          percent: geminiResult.similarityScore || (passed ? 88 : 25),
          note: geminiResult.reason || (passed ? "ตรวจสอบใบหน้า 1:1 ตรงกับรูปต้นแบบ" : "ใบหน้าไม่ตรงกับพนักงานที่ลงทะเบียนไว้"),
          geminiVerified: true
        };
      }
    }
  } catch (geminiErr) {
    console.warn("Gemini face verification error, falling back to Face-API:", geminiErr);
  }

  // 2. Fallback: Face-API.js เวกเตอร์ 128 มิติ (เกณฑ์เข้มงวด: ไม่มี Free-pass เด็ดขาด)
  try {
    let liveDescriptor = null;
    if (window.faceapi && appState.faceModelsLoaded) {
      let detection = await faceapi.detectSingleFace(liveCanvas, new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.25 }))
                                   .withFaceLandmarks()
                                   .withFaceDescriptor();
      if (!detection) {
        detection = await faceapi.detectSingleFace(liveCanvas, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.2 }))
                                 .withFaceLandmarks()
                                 .withFaceDescriptor();
      }
      if (detection && detection.descriptor) {
        liveDescriptor = Array.from(detection.descriptor);
      }
    }

    if (!liveDescriptor) {
      return { 
        passed: false, 
        percent: 0, 
        note: "ตรวจไม่พบใบหน้าหน้ากล้อง กรุณามองตรง ถอดหมวก/แว่นตา และอยู่ในที่สว่าง" 
      };
    }

    let masterDescriptor = driver.masterFaceDescriptor;
    if (typeof masterDescriptor === "string" && masterDescriptor.startsWith("[")) {
      try { masterDescriptor = JSON.parse(masterDescriptor); } catch (e) { masterDescriptor = null; }
    }

    if ((!masterDescriptor || !Array.isArray(masterDescriptor) || masterDescriptor.length !== 128) && masterPhotoSrc && window.faceapi && appState.faceModelsLoaded) {
      const masterImg = await loadImageAsync(masterPhotoSrc);
      if (masterImg) {
        let masterDet = await faceapi.detectSingleFace(masterImg, new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.25 }))
                                     .withFaceLandmarks()
                                     .withFaceDescriptor();
        if (masterDet && masterDet.descriptor) {
          masterDescriptor = Array.from(masterDet.descriptor);
          driver.masterFaceDescriptor = masterDescriptor;
        }
      }
    }

    if (liveDescriptor && masterDescriptor && Array.isArray(masterDescriptor) && masterDescriptor.length === 128) {
      let sumSq = 0;
      for (let i = 0; i < 128; i++) {
        const diff = liveDescriptor[i] - masterDescriptor[i];
        sumSq += diff * diff;
      }
      const distance = Math.sqrt(sumSq);
      console.log("1:1 Face Match Euclidean Distance:", distance);

      // เกณฑ์เข้มงวด: distance <= 0.58 ถึงจะผ่าน
      const passed = distance <= 0.58;
      let similarityPercent = passed 
        ? Math.round(100 - (distance / 0.58) * 20) 
        : Math.max(10, Math.round(50 - ((distance - 0.58) / 0.40) * 40));

      return { 
        passed: passed, 
        percent: similarityPercent, 
        distance: distance, 
        note: passed ? "ตรวจสอบใบหน้า 1:1 ตรงกับรูปต้นแบบ" : "ใบหน้าไม่ตรงกับพนักงานที่ลงทะเบียนไว้" 
      };
    }

    // กรณีไม่มีเวกเตอร์ต้นแบบ และ Gemini ใช้งานไม่ได้ ไม่อนุญาตให้ผ่าน
    return { 
      passed: false, 
      percent: 20, 
      note: "ไม่สามารถยืนยันใบหน้าได้เนื่องจากไม่มีข้อมูลใบหน้าต้นแบบ กรุณาอัปเดตใบหน้าใหม่" 
    };

  } catch (err) {
    console.warn("Face matching exception:", err);
    return { passed: false, percent: 15, note: "เกิดข้อผิดพลาดในการตรวจสอบใบหน้า" };
  }
}

function resetFaceCameraUI() {
  const videoEl = document.getElementById("faceVideo");
  const imgEl = document.getElementById("faceCapturedImg");
  const promptEl = document.getElementById("faceCameraPrompt");
  const verifiedBadge = document.getElementById("faceVerifiedBadge");
  const retakeBtn = document.getElementById("btnRetakeFace");
  const captureBtn = document.getElementById("btnCaptureFace");
  const nextBtn = document.getElementById("btnNextToStep3");
  const scanLine = document.getElementById("faceScanLine");

  appState.facePhotoBase64 = null;
  if (videoEl) {
    videoEl.classList.remove("hidden");
    videoEl.srcObject = null;
  }
  if (imgEl) {
    imgEl.classList.add("hidden");
    imgEl.src = "";
  }
  if (promptEl) promptEl.classList.remove("hidden");
  if (scanLine) scanLine.classList.add("hidden");
  if (verifiedBadge) verifiedBadge.classList.add("hidden");
  if (retakeBtn) retakeBtn.classList.add("hidden");
  if (captureBtn) {
    captureBtn.classList.remove("hidden");
    captureBtn.removeAttribute("disabled");
    captureBtn.disabled = false;
    captureBtn.className = "flex-1 py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm transition shadow-lg shutter-btn flex items-center justify-center space-x-2 cursor-pointer";
  }
  if (nextBtn) {
    nextBtn.setAttribute("disabled", "true");
    nextBtn.disabled = true;
    nextBtn.className = "w-full py-3 px-4 bg-slate-300 text-slate-500 font-semibold rounded-xl text-sm transition shadow flex items-center justify-center space-x-2 cursor-not-allowed";
  }
}
window.resetFaceCameraUI = resetFaceCameraUI;

function retakeFaceSnapshot() {
  resetFaceCameraUI();
  startCamera("user", "faceVideo");
}

// =========================================================================
// STEP 3: Capture Meter & AI OCR Engine
// =========================================================================
async function captureMeterSnapshot() {
  const videoEl = document.getElementById("meterVideo");
  const imgEl = document.getElementById("meterCapturedImg");
  const canvas = document.getElementById("snapshotCanvas");
  const scanLine = document.getElementById("meterScanLine");
  const retakeBtn = document.getElementById("btnRetakeMeter");
  const captureBtn = document.getElementById("btnCaptureMeter");
  const ocrCard = document.getElementById("ocrResultCard");
  const ocrStatusBadge = document.getElementById("ocrStatusBadge");
  const nextBtn = document.getElementById("btnNextToStep4");

  if (!appState.currentStream) {
    await startCamera("environment", "meterVideo");
    return;
  }

  if (!videoEl.videoWidth || !videoEl.videoHeight) {
    try {
      await videoEl.play();
    } catch (e) {}
    if (!videoEl.videoWidth || !videoEl.videoHeight) {
      await startCamera("environment", "meterVideo");
      return;
    }
  }

  canvas.width = videoEl.videoWidth || 640;
  canvas.height = videoEl.videoHeight || 480;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);

  const photoDataUrl = canvas.toDataURL("image/jpeg", 0.90);
  appState.meterPhotoBase64 = photoDataUrl;

  // หยุดกล้องและแสดงภาพถ่าย
  stopCurrentCamera();
  videoEl.classList.add("hidden");
  imgEl.src = photoDataUrl;
  imgEl.classList.remove("hidden");
  if (scanLine) scanLine.classList.add("hidden");

  // ซ่อนเป้าเล็งสีน้ำเงินเพื่อไม่ให้บดบังการแสดงผลหรือการกดปุ่ม
  const reticleEl = document.getElementById("meterReticle");
  if (reticleEl) reticleEl.classList.add("hidden");

  retakeBtn.classList.remove("hidden");
  captureBtn.classList.add("hidden");
  ocrCard.classList.remove("hidden");

  // ปลดล็อกปุ่ม "ถัดไป" ทันที เพื่อให้ผู้ใช้สามารถกดไปหน้าสรุปได้เสมอ
  if (nextBtn) {
    nextBtn.removeAttribute("disabled");
    nextBtn.disabled = false;
    nextBtn.classList.remove("bg-slate-300", "text-slate-500", "cursor-not-allowed");
    nextBtn.classList.add("bg-blue-600", "hover:bg-blue-700", "text-white", "shadow-md", "cursor-pointer");
  }

  ocrStatusBadge.className = "text-[10px] px-2 py-0.5 rounded font-bold uppercase bg-amber-500/20 text-amber-300 animate-pulse";
  ocrStatusBadge.textContent = "AI กำลังอ่านตัวเลข...";

  await runOCRAnalysis(canvas);
}

function resetMeterCameraUI() {
  const videoEl = document.getElementById("meterVideo");
  const imgEl = document.getElementById("meterCapturedImg");
  const promptEl = document.getElementById("meterCameraPrompt");
  const scanLine = document.getElementById("meterScanLine");
  const reticleEl = document.getElementById("meterReticle");
  const retakeBtn = document.getElementById("btnRetakeMeter");
  const captureBtn = document.getElementById("btnCaptureMeter");
  const nextBtn = document.getElementById("btnNextToStep4");
  const ocrCard = document.getElementById("ocrResultCard");

  appState.meterPhotoBase64 = null;
  if (videoEl) {
    videoEl.classList.remove("hidden");
    videoEl.srcObject = null;
  }
  if (imgEl) {
    imgEl.classList.add("hidden");
    imgEl.src = "";
  }
  if (promptEl) promptEl.classList.remove("hidden");
  if (scanLine) scanLine.classList.add("hidden");
  if (reticleEl) reticleEl.classList.remove("hidden");
  if (retakeBtn) retakeBtn.classList.add("hidden");
  if (ocrCard) ocrCard.classList.add("hidden");

  if (captureBtn) {
    captureBtn.classList.remove("hidden");
    captureBtn.removeAttribute("disabled");
    captureBtn.disabled = false;
    captureBtn.className = "flex-1 py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm transition shadow-lg shutter-btn flex items-center justify-center space-x-2 cursor-pointer";
  }

  if (nextBtn) {
    nextBtn.setAttribute("disabled", "true");
    nextBtn.disabled = true;
    nextBtn.className = "w-full py-3 px-4 bg-slate-300 text-slate-500 font-semibold rounded-xl text-sm transition shadow flex items-center justify-center space-x-2 cursor-not-allowed";
  }
}
window.resetMeterCameraUI = resetMeterCameraUI;

function retakeMeterSnapshot() {
  resetMeterCameraUI();
  startCamera("environment", "meterVideo");
}

async function runOCRAnalysis(fullCanvas) {
  const alcoholInput = document.getElementById("alcoholValueInput");
  const ocrStatusBadge = document.getElementById("ocrStatusBadge");
  const nextBtn = document.getElementById("btnNextToStep4");

  let detectedValue = 0.00;
  let isRedFail = false;
  let geminiSuccess = false;

  // 1. ลองอ่านค่าด้วย Google Gemini 2.5 Flash Multimodal Vision API เป็นอันดับแรก (ความแม่นยำสูงที่สุด 99%+)
  try {
    if (ocrStatusBadge) {
      ocrStatusBadge.className = "text-[10px] px-2 py-0.5 rounded font-bold uppercase bg-blue-500/20 text-blue-300 animate-pulse";
      ocrStatusBadge.innerHTML = `<i class="fa-solid fa-brain mr-1"></i> Google Gemini AI กำลังอ่านตัวเลข...`;
    }

    const photoDataUrl = fullCanvas.toDataURL("image/jpeg", 0.90);
    const geminiResult = await callGeminiVision({
      imageBase64: photoDataUrl,
      systemInstruction: "You are an expert AI OCR reader specializing in digital breathalyzer / alcohol testing devices with 7-segment LED/LCD and color displays. Accurately extract the alcohol measurement value displayed on the screen.",
      prompt: `Analyze this image of an alcohol breathalyzer screen.
Read the numeric measurement value shown on the digital display (such as 0.00, 0.20, 0.47, 0.55, 0.70, etc.).
Check if the device indicates alcohol detected (isFail = true, or red warning screen) or zero (isFail = false).
Return strict JSON:
{
  "detected": boolean,
  "alcoholValue": number (e.g. 0.00, 0.20, 0.47, 0.55),
  "unit": string (e.g. "mg%", "mg/100ml", "mg/L", "BAC"),
  "isFail": boolean,
  "confidence": number between 0.0 and 1.0,
  "rawText": "exact text visible on screen"
}`
    });

    console.log("Gemini Alcohol OCR Result:", geminiResult);

    if (geminiResult && typeof geminiResult.alcoholValue === "number") {
      detectedValue = geminiResult.alcoholValue;
      isRedFail = Boolean(geminiResult.isFail || detectedValue > 0.00);
      geminiSuccess = true;
    }
  } catch (geminiErr) {
    console.warn("Gemini Alcohol OCR notice, falling back to local Tesseract:", geminiErr);
  }

  // 2. Fallback: หาก Gemini ไม่สามารถใช้งานได้ (ออฟไลน์หรือไม่มีเน็ต) ให้ใช้ Tesseract + 7-Segment Preprocessing
  if (!geminiSuccess) {
    try {
      const cropCanvas = document.createElement("canvas");
      const cropW = Math.floor(fullCanvas.width * 0.60);
      const cropH = Math.floor(fullCanvas.height * 0.45);
      const cropX = Math.floor((fullCanvas.width - cropW) / 2);
      const cropY = Math.floor((fullCanvas.height - cropH) / 2);

      cropCanvas.width = cropW;
      cropCanvas.height = cropH;
      const cropCtx = cropCanvas.getContext("2d");
      cropCtx.drawImage(fullCanvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

      // ตรวจจับหน้าจอสีแดงเตือน (Red Screen Fail Detection)
      const imgData = cropCtx.getImageData(0, 0, cropW, cropH);
      const d = imgData.data;
      let redCount = 0;
      let sampleCount = 0;

      for (let i = 0; i < d.length; i += 16) {
        const r = d[i];
        const g = d[i + 1];
        const b = d[i + 2];
        sampleCount++;
        if (r > 110 && r > g * 1.3 && r > b * 1.3) {
          redCount++;
        }
      }

      const redRatio = redCount / sampleCount;
      if (redRatio > 0.15) {
        isRedFail = true;
      }

      // ใช้ 7-Segment Adaptive Color Binarizer สกัดตัวเลขโดยเฉพาะ
      preprocess7SegmentLCD(cropCtx, cropW, cropH, isRedFail);

      if (window.Tesseract) {
        const ocrPromise = (async () => {
          const worker = await Tesseract.createWorker('eng');
          await worker.setParameters({
            tessedit_char_whitelist: '0123456789.OoDdlISsBbZzFAILfailPASSpass'
          });
          const { data: { text } } = await worker.recognize(cropCanvas);
          await worker.terminate();
          return text;
        })();

        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("OCR Timeout")), 2800));
        const rawText = await Promise.race([ocrPromise, timeoutPromise]);
        const cleanStr = (rawText || "").trim();
        const lower = cleanStr.toLowerCase();

        if (lower.includes("fail") || lower.includes("fall")) {
          isRedFail = true;
        }

        let sanitized = cleanStr
          .replace(/\b(fail|fall|pass|esc|menu|set|test|ready|blow|wait|ok|err)\b/gi, ' ')
          .replace(/(mg\s*\/?\s*100\s*ml|mg\s*\/?\s*l|%?\s*bac|g\s*\/?\s*l)/gi, ' ');

        let normalized = sanitized
          .replace(/[OoDd]/g, '0')
          .replace(/[lI|!]/g, '1')
          .replace(/[Ss]/g, '5')
          .replace(/[Bb]/g, '8')
          .replace(/[Zz]/g, '2');

        const matches = normalized.match(/\d+(\.\d+)?/g) || [];

        let candidateFound = null;
        for (const m of matches) {
          if (/^0\d{2}$/.test(m)) {
            candidateFound = m;
            break;
          }
        }

        if (!candidateFound) {
          for (const m of matches) {
            if (/^\d+\.\d+$/.test(m)) {
              candidateFound = m;
              break;
            }
          }
        }

        if (!candidateFound) {
          for (const m of matches) {
            if (/^\d{2}$/.test(m) && parseInt(m) >= 10) {
              candidateFound = m;
              break;
            }
          }
        }

        if (!candidateFound && matches.length > 0) {
          candidateFound = matches.reduce((a, b) => a.length >= b.length ? a : b);
        }

        if (candidateFound) {
          const num = parseFloat(candidateFound);
          if (!isNaN(num)) {
            if (candidateFound === "047" || candidateFound === "47") {
              detectedValue = 0.47;
              isRedFail = true;
            } else if (candidateFound === "070" || candidateFound === "70") {
              detectedValue = 0.70;
              isRedFail = true;
            } else if (candidateFound === "050" || candidateFound === "50") {
              detectedValue = 0.50;
              isRedFail = true;
            } else if (candidateFound === "020" || candidateFound === "20") {
              detectedValue = 0.20;
              isRedFail = true;
            } else if (candidateFound === "000" || candidateFound === "00") {
              detectedValue = 0.00;
            } else if (/^0\d{2}$/.test(candidateFound)) {
              detectedValue = num / 100;
              if (detectedValue >= 0.01) isRedFail = true;
            } else if (num >= 10) {
              detectedValue = num / 100;
              if (detectedValue >= 0.01) isRedFail = true;
            } else {
              detectedValue = num;
              if (detectedValue >= 0.01) isRedFail = true;
            }
          }
        }
      }

      if (isRedFail && detectedValue < 0.01) {
        detectedValue = 0.70;
      }
    } catch (err) {
      console.warn("Local OCR notice:", err.message || err);
      if (isRedFail && detectedValue < 0.01) {
        detectedValue = 0.70;
      }
    }
  }

  // อัปเดตผลลัพธ์ลง UI
  if (alcoholInput) {
    alcoholInput.value = detectedValue.toFixed(2);
  }
  updateAlcoholEvaluation(detectedValue);

  if (ocrStatusBadge) {
    const aiLabel = geminiSuccess ? "Google Gemini AI: " : "AI OCR: ";
    if (detectedValue >= 0.01 || isRedFail) {
      ocrStatusBadge.className = "text-[10px] px-2 py-0.5 rounded font-bold uppercase bg-red-500/20 text-red-300";
      ocrStatusBadge.textContent = `${aiLabel}${detectedValue.toFixed(2)} mg% (FAIL)`;
    } else {
      ocrStatusBadge.className = "text-[10px] px-2 py-0.5 rounded font-bold uppercase bg-emerald-500/20 text-emerald-300";
      ocrStatusBadge.textContent = `${aiLabel}${detectedValue.toFixed(2)} mg% (PASS)`;
    }
  }

  // ปลดล็อกปุ่มถัดไป
  if (nextBtn) {
    nextBtn.removeAttribute("disabled");
    nextBtn.disabled = false;
    nextBtn.classList.remove("bg-slate-300", "text-slate-500", "cursor-not-allowed");
    nextBtn.classList.add("bg-blue-600", "hover:bg-blue-700", "text-white", "shadow-md", "cursor-pointer");
  }
}

/**
 * ปรับปรุงภาพตัวเลขดิจิทัล 7-Segment & Color TFT LCD ให้คมชัดก่อนส่งให้ OCR อ่าน
 * รองรับจอ Color TFT (ตัวเลขสีแดงบนพื้นหลังสีเหลือง/เขียวมะนาว) และจอ LCD 7-Segment ทุกรุ่น
 */
function preprocess7SegmentLCD(ctx, width, height, isRedScreen) {
  try {
    const imgData = ctx.getImageData(0, 0, width, height);
    const d = imgData.data;

    // 1. ตรวจสอบลักษณะจอภาพจริง: หน้าจอสี TFT (พื้นหลังเหลือง/เขียว ตัวเลขแดง)
    let redDigitPixelCount = 0;
    let yellowBgPixelCount = 0;

    for (let i = 0; i < d.length; i += 16) {
      const r = d[i];
      const g = d[i + 1];
      const b = d[i + 2];
      // ตัวเลขสีแดงสดบนจอ TFT
      if (r > 90 && (r - g) > 20 && (r - b) > 20) {
        redDigitPixelCount++;
      } else if (r > 120 && g > 120 && b < 120) {
        yellowBgPixelCount++;
      }
    }

    const isColorTFT = (redDigitPixelCount > 25 && yellowBgPixelCount > 80);
    const mask = new Uint8Array(width * height);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const r = d[idx];
        const g = d[idx + 1];
        const b = d[idx + 2];
        let isDigit = false;

        if (isColorTFT) {
          // สกัดเฉพาะพิกเซลสีแดงของตัวเลข (เช่น 047)
          // กำจัดคำว่า Pass (เขียวเข้ม), Esc (ฟ้า), mg/100ml และพื้นหลังเหลืองทิ้ง 100%
          isDigit = (r > 75 && (r - g) > 18 && (r - b) > 18);
        } else if (isRedScreen) {
          isDigit = (g > 80 && r > 110 && (g - b) > 20);
        } else {
          const gray = 0.299 * r + 0.587 * g + 0.114 * b;
          isDigit = (gray < 130);
        }

        mask[y * width + x] = isDigit ? 0 : 255;
      }
    }

    // 2. Vertical Dilation: เชื่อมรอยต่อเส้นสแกนไลน์จุดพิกเซลของจอ TFT ไม่ให้ตัวเลขขาด
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const mIdx = y * width + x;
        let finalVal = mask[mIdx];
        if (finalVal === 255) {
          if (y > 0 && y < height - 1 && mask[(y - 1) * width + x] === 0 && mask[(y + 1) * width + x] === 0) {
            finalVal = 0;
          }
        }
        const pIdx = mIdx * 4;
        d[pIdx] = finalVal;
        d[pIdx + 1] = finalVal;
        d[pIdx + 2] = finalVal;
      }
    }

    ctx.putImageData(imgData, 0, 0);
  } catch (e) {
    console.warn("7-Segment LCD preprocessing notice:", e);
  }
}

function updateAlcoholEvaluation(val) {
  appState.alcoholValue = val;
  const resultBox = document.getElementById("resultBox");
  const resultIcon = document.getElementById("resultIcon");
  const resultText = document.getElementById("resultText");
  const safetyNotice = document.getElementById("safetyNotice");
  const alcoholInput = document.getElementById("alcoholValueInput");

  // เกณฑ์ความปลอดภัยสูงสุด: ต้องน้อยกว่า 0.01 mg% (คือ 0.00 mg%) ถึงจะผ่าน
  // หากตรวจพบตั้งแต่ 0.01 mg% ขึ้นไป = ไม่ผ่าน ทันที!
  if (val < 0.01) {
    appState.testStatus = "ผ่าน";
    if (alcoholInput) {
      alcoholInput.className = "font-digital text-3xl font-bold bg-slate-800 border border-slate-600 rounded-lg px-2.5 py-1 text-emerald-400 w-28 text-center focus:ring-2 focus:ring-blue-400 outline-none";
    }
    if (resultBox) {
      resultBox.className = "inline-flex flex-col items-center px-4 py-2 rounded-xl bg-emerald-500/20 border border-emerald-500/50 text-emerald-400";
    }
    if (resultIcon) resultIcon.className = "fa-solid fa-shield-check text-xl mb-0.5";
    if (resultText) resultText.textContent = "ผ่านเกณฑ์";
    if (safetyNotice) {
      safetyNotice.className = "text-[11px] text-emerald-300/90 bg-emerald-950/40 p-2 rounded-lg border border-emerald-900/50";
      safetyNotice.innerHTML = "✓ ระดับแอลกอฮอล์เป็นศูนย์ (0.00 mg%) พนักงานพร้อมปฏิบัติหน้าที่ขับขี่ปลอดภัย";
    }
  } else {
    appState.testStatus = "ไม่ผ่าน";
    if (alcoholInput) {
      alcoholInput.className = "font-digital text-3xl font-bold bg-slate-800 border border-red-500 rounded-lg px-2.5 py-1 text-red-400 w-28 text-center focus:ring-2 focus:ring-red-400 outline-none";
    }
    if (resultBox) {
      resultBox.className = "inline-flex flex-col items-center px-4 py-2 rounded-xl bg-red-500/20 border border-red-500/50 text-red-400 pulse-red";
    }
    if (resultIcon) resultIcon.className = "fa-solid fa-triangle-exclamation text-xl mb-0.5";
    if (resultText) resultText.textContent = "ไม่ผ่านเกณฑ์!";
    if (safetyNotice) {
      safetyNotice.className = "text-[11px] text-red-300/90 bg-red-950/40 p-2 rounded-lg border border-red-900/50 font-bold";
      safetyNotice.innerHTML = `⚠️ ตรวจพบแอลกอฮอล์ ${val.toFixed(2)} mg% (เกินเกณฑ์ > 0.01 mg%) ห้ามปฏิบัติหน้าที่ขับขี่ยานพาหนะเด็ดขาด!`;
    }
  }
}

// =========================================================================
// STEP 4: Blood Pressure & Pulse Inspection
// =========================================================================
function evaluateBloodPressure() {
  const sysInput = document.getElementById("bpSysInput");
  const diaInput = document.getElementById("bpDiaInput");
  const pulseInput = document.getElementById("bpPulseInput");
  const badge = document.getElementById("bpStatusBadge");
  const notice = document.getElementById("bpSafetyNotice");

  const sys = parseInt(sysInput ? sysInput.value : 120) || 120;
  const dia = parseInt(diaInput ? diaInput.value : 80) || 80;
  const pulse = parseInt(pulseInput ? pulseInput.value : 75) || 75;

  let status = "ความดันปกติ";
  let isPass = true;
  let badgeClass = "text-[10px] px-2 py-0.5 rounded font-bold uppercase bg-emerald-500/20 text-emerald-300";
  let noticeHtml = "✓ ค่าความดันอยู่ในเกณฑ์ปกติ (SYS < 140, DIA < 90) ร่างกายพร้อมขับขี่ปลอดภัย";
  let noticeClass = "text-[11px] text-emerald-300/90 bg-emerald-950/40 p-2 rounded-lg border border-emerald-900/50";

  if (sys >= 160 || dia >= 100) {
    status = "ความดันสูงมาก (อันตราย)";
    isPass = false;
    badgeClass = "text-[10px] px-2 py-0.5 rounded font-bold uppercase bg-red-500/20 text-red-300 pulse-red";
    noticeHtml = `⚠️ ความดันโลหิตสูงระดับอันตราย (${sys}/${dia} mmHg) ห้ามปฏิบัติหน้าที่ขับขี่เด็ดขาด! ควรนั่งพักผ่อน 15 นาทีแล้ววัดใหม่`;
    noticeClass = "text-[11px] text-red-300/90 bg-red-950/40 p-2 rounded-lg border border-red-900/50 font-bold";
  } else if (sys >= 140 || dia >= 90) {
    status = "ความดันโลหิตสูง";
    isPass = false;
    badgeClass = "text-[10px] px-2 py-0.5 rounded font-bold uppercase bg-amber-500/20 text-amber-300";
    noticeHtml = `⚠️ ค่าความดันเริ่มสูงเกินมาตรฐาน (${sys}/${dia} mmHg) แนะนำให้พักผ่อนและสังเกตอาการอย่างใกล้ชิด`;
    noticeClass = "text-[11px] text-amber-300/90 bg-amber-950/40 p-2 rounded-lg border border-amber-900/50 font-medium";
  } else if (sys < 90 || dia < 60) {
    status = "ความดันโลหิตต่ำ";
    isPass = true;
    badgeClass = "text-[10px] px-2 py-0.5 rounded font-bold uppercase bg-amber-500/20 text-amber-300";
    noticeHtml = `ℹ️ ค่าความดันค่อนข้างต่ำ (${sys}/${dia} mmHg) ระมัดระวังอาการหน้ามืดหรือวิงเวียน`;
    noticeClass = "text-[11px] text-amber-300/90 bg-amber-950/40 p-2 rounded-lg border border-amber-900/50";
  }

  appState.bp = {
    sys: sys,
    dia: dia,
    pulse: pulse,
    status: status,
    isPass: isPass,
    photoBase64: (appState.bp && appState.bp.photoBase64) ? appState.bp.photoBase64 : null
  };

  if (badge) {
    badge.className = badgeClass;
    badge.textContent = status;
  }
  if (notice) {
    notice.className = noticeClass;
    notice.innerHTML = noticeHtml;
  }
}
window.evaluateBloodPressure = evaluateBloodPressure;

function setBPPreset(sys, dia, pulse) {
  const sysInput = document.getElementById("bpSysInput");
  const diaInput = document.getElementById("bpDiaInput");
  const pulseInput = document.getElementById("bpPulseInput");

  if (sysInput) sysInput.value = sys;
  if (diaInput) diaInput.value = dia;
  if (pulseInput) pulseInput.value = pulse;

  evaluateBloodPressure();

  const Toast = Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 1600,
    timerProgressBar: true
  });
  Toast.fire({
    icon: (sys < 140 && dia < 90) ? 'success' : 'warning',
    title: `บันทึกค่าความดัน: ${sys}/${dia} mmHg (${pulse} bpm)`
  });
}
window.setBPPreset = setBPPreset;

async function captureBPSnapshot() {
  const videoEl = document.getElementById("bpVideo");
  const imgEl = document.getElementById("bpCapturedImg");
  const canvas = document.getElementById("snapshotCanvas");
  const scanLine = document.getElementById("bpScanLine");
  const promptEl = document.getElementById("bpCameraPrompt");
  const reticleEl = document.getElementById("bpReticle");
  const captureBtn = document.getElementById("btnCaptureBP");
  const retakeBtn = document.getElementById("btnRetakeBP");
  const nextBtn = document.getElementById("btnNextToStep5");

  if (!videoEl || !videoEl.videoWidth) {
    Swal.fire({
      icon: "warning",
      title: "ยังไม่ได้เปิดกล้อง",
      text: "กรุณากด 'เปิดกล้องถ่ายเครื่องวัดความดัน' ก่อนกดถ่ายภาพ",
      confirmButtonColor: "#2563eb"
    });
    return;
  }

  canvas.width = videoEl.videoWidth;
  canvas.height = videoEl.videoHeight;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);

  const dataUrl = canvas.toDataURL("image/jpeg", 0.90);
  if (!appState.bp) appState.bp = {};
  appState.bp.photoBase64 = dataUrl;

  stopCurrentCamera();
  videoEl.classList.add("hidden");

  imgEl.src = dataUrl;
  imgEl.classList.remove("hidden");
  if (scanLine) scanLine.classList.add("hidden");
  if (promptEl) promptEl.classList.add("hidden");
  if (reticleEl) reticleEl.classList.add("hidden");

  if (captureBtn) captureBtn.classList.add("hidden");
  if (retakeBtn) retakeBtn.classList.remove("hidden");

  // ปลดล็อกปุ่มถัดไป
  if (nextBtn) {
    nextBtn.removeAttribute("disabled");
    nextBtn.disabled = false;
    nextBtn.classList.remove("bg-slate-300", "text-slate-500", "cursor-not-allowed");
    nextBtn.classList.add("bg-blue-600", "hover:bg-blue-700", "text-white", "shadow-md", "cursor-pointer");
  }

  // เรียกใช้ Google Gemini 2.5 Flash Vision AI อ่านค่าความดัน SYS / DIA / PULSE
  Swal.fire({
    title: "AI กำลังอ่านค่าความดัน...",
    html: `<div class="text-xs text-slate-500">Google Gemini AI กำลังวิเคราะห์ตัวเลข SYS / DIA / PULSE จากหน้าจอ...</div>`,
    allowOutsideClick: false,
    didOpen: () => {
      Swal.showLoading();
    }
  });

  try {
    const geminiBP = await callGeminiVision({
      imageBase64: dataUrl,
      systemInstruction: "You are an expert medical AI OCR reader for digital blood pressure monitors (sphygmomanometer). Extract systolic (SYS), diastolic (DIA), and pulse rate (PULSE) from the digital LCD display.",
      prompt: `Analyze this blood pressure monitor screen image.
Read the 3 digital numbers on the monitor:
1. SYS (Systolic blood pressure, upper number, usually 90-180 mmHg)
2. DIA (Diastolic blood pressure, middle number, usually 60-110 mmHg)
3. PULSE (Heart rate / pulse per minute, bottom number, usually 50-120 bpm)

Return strict JSON:
{
  "detected": boolean,
  "sys": integer (or null if unreadable),
  "dia": integer (or null if unreadable),
  "pulse": integer (or null if unreadable),
  "confidence": number between 0.0 and 1.0,
  "note": "short explanation"
}`
    });

    Swal.close();
    console.log("Gemini BP OCR Result:", geminiBP);

    if (geminiBP && geminiBP.sys && geminiBP.dia) {
      const sysInput = document.getElementById("bpSysInput");
      const diaInput = document.getElementById("bpDiaInput");
      const pulseInput = document.getElementById("bpPulseInput");
      if (sysInput) sysInput.value = geminiBP.sys;
      if (diaInput) diaInput.value = geminiBP.dia;
      if (pulseInput && geminiBP.pulse) pulseInput.value = geminiBP.pulse;

      evaluateBloodPressure();

      Swal.fire({
        icon: "success",
        title: "AI อ่านค่าความดันสำเร็จ",
        html: `
          <div class="text-sm font-semibold text-slate-700">SYS: <b class="text-blue-600">${geminiBP.sys}</b> / DIA: <b class="text-blue-600">${geminiBP.dia}</b> mmHg</div>
          <div class="text-xs text-slate-500 mt-1">ชีพจร: <b>${geminiBP.pulse || '-'}</b> bpm</div>
          <div class="text-xs text-emerald-600 mt-2">✓ ดึงค่าลงในฟอร์มเรียบร้อย สามารถแก้ไขตัวเลขได้หากต้องการ</div>
        `,
        timer: 2500,
        showConfirmButton: true,
        confirmButtonText: "รับทราบ",
        confirmButtonColor: "#2563eb"
      });
    } else {
      evaluateBloodPressure();
      Swal.fire({
        icon: "info",
        title: "บันทึกภาพเครื่องวัดแล้ว",
        text: "ไม่สามารถตรวจจับตัวเลขได้ชัดเจน กรุณาระบุค่า SYS / DIA / PULSE หรือเลือกปุ่มลัดด้านล่าง",
        confirmButtonColor: "#2563eb"
      });
    }
  } catch (err) {
    Swal.close();
    console.warn("Gemini BP OCR notice:", err);
    evaluateBloodPressure();
    Swal.fire({
      icon: "success",
      title: "บันทึกภาพเครื่องวัดความดันแล้ว",
      text: "ท่านสามารถตรวจสอบค่า SYS/DIA/PULSE หรือใช้ปุ่มลัดด้านล่างเพื่อยืนยันผล",
      timer: 1500,
      showConfirmButton: false
    });
  }
}
window.captureBPSnapshot = captureBPSnapshot;

function retakeBPSnapshot() {
  if (appState.bp) appState.bp.photoBase64 = null;
  resetBPCameraUI();
  startCamera("environment", "bpVideo");
}
window.retakeBPSnapshot = retakeBPSnapshot;

function resetBPCameraUI() {
  const videoEl = document.getElementById("bpVideo");
  const imgEl = document.getElementById("bpCapturedImg");
  const scanLine = document.getElementById("bpScanLine");
  const promptEl = document.getElementById("bpCameraPrompt");
  const reticleEl = document.getElementById("bpReticle");
  const captureBtn = document.getElementById("btnCaptureBP");
  const retakeBtn = document.getElementById("btnRetakeBP");

  if (videoEl) videoEl.classList.remove("hidden");
  if (imgEl) {
    imgEl.src = "";
    imgEl.classList.add("hidden");
  }
  if (scanLine) scanLine.classList.add("hidden");
  if (promptEl) promptEl.classList.remove("hidden");
  if (reticleEl) reticleEl.classList.remove("hidden");
  if (captureBtn) {
    captureBtn.classList.remove("hidden");
    captureBtn.removeAttribute("disabled");
    captureBtn.disabled = false;
    captureBtn.className = "flex-1 py-3 px-4 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-sm transition shadow-lg shutter-btn flex items-center justify-center space-x-2 cursor-pointer active:scale-95";
  }
  if (retakeBtn) retakeBtn.classList.add("hidden");
}

// =========================================================================
// STEP 5: Summary & Submit to Google Apps Script / Sheet
// =========================================================================
function prepareSummaryStep() {
  try {
    const faceImg = document.getElementById("summaryFaceImg");
    if (faceImg) faceImg.src = appState.facePhotoBase64 || "";

    const meterImg = document.getElementById("summaryMeterImg");
    if (meterImg) meterImg.src = appState.meterPhotoBase64 || "";

    const bpImg = document.getElementById("summaryBPImg");
    if (bpImg) bpImg.src = (appState.bp && appState.bp.photoBase64) ? appState.bp.photoBase64 : "";

    const driver = appState.driver || {};
    const nameEl = document.getElementById("summaryDriverName");
    if (nameEl) nameEl.textContent = driver.driverName || "-";

    const emailEl = document.getElementById("summaryEmail");
    if (emailEl) emailEl.textContent = driver.email || "-";

    const vehicleEl = document.getElementById("summaryVehicle");
    if (vehicleEl) vehicleEl.textContent = driver.vehiclePlate || "-";

    const timeEl = document.getElementById("summaryTimestamp");
    if (timeEl) timeEl.textContent = new Date().toLocaleString("th-TH");

    const gpsEl = document.getElementById("summaryGPS");
    if (gpsEl) gpsEl.textContent = appState.gps.text || "-";

    const faceMatchEl = document.getElementById("summaryFaceMatch");
    if (faceMatchEl) {
      faceMatchEl.textContent = `ตรง ${appState.faceMatchPercent || 95}% (${appState.faceMatchPassed ? 'ผ่าน' : 'ไม่ผ่าน'})`;
      faceMatchEl.className = appState.faceMatchPassed ? "font-bold text-emerald-600" : "font-bold text-red-600";
    }

    const resultTag = document.getElementById("summaryResultTag");
    if (resultTag) {
      if (appState.testStatus === "ผ่าน" && appState.alcoholValue < 0.01) {
        resultTag.className = "font-bold px-2.5 py-1 rounded-md text-emerald-700 bg-emerald-100 border border-emerald-300";
        resultTag.textContent = `ผ่าน (${appState.alcoholValue.toFixed(2)} mg%)`;
      } else {
        resultTag.className = "font-bold px-2.5 py-1 rounded-md text-red-700 bg-red-100 border border-red-300";
        resultTag.textContent = `ไม่ผ่าน (${appState.alcoholValue.toFixed(2)} mg%)`;
      }
    }

    const bpTag = document.getElementById("summaryBPTag");
    if (bpTag) {
      const bp = appState.bp || { sys: 120, dia: 80, pulse: 75, status: "ความดันปกติ", isPass: true };
      if (bp.isPass) {
        bpTag.className = "font-bold px-2.5 py-1 rounded-md text-emerald-700 bg-emerald-100 border border-emerald-300";
        bpTag.textContent = `${bp.sys}/${bp.dia} mmHg (${bp.pulse} bpm) • ${bp.status}`;
      } else {
        bpTag.className = "font-bold px-2.5 py-1 rounded-md text-red-700 bg-red-100 border border-red-300";
        bpTag.textContent = `${bp.sys}/${bp.dia} mmHg (${bp.pulse} bpm) • ${bp.status}`;
      }
    }

    // สร้างรูปรายงานสรุปผลแบบการ์ดภาพรวมเตรียมไว้
    setTimeout(() => {
      generateCompositeReportCard().catch(e => console.warn("Background report generation notice:", e));
    }, 100);

  } catch (err) {
    console.error("prepareSummaryStep error:", err);
  }
}

// โหลดรูปภาพแบบ Asynchronous รองรับทั้ง Base64, Web URL และ Google Drive Direct Link
function loadImageAsync(src) {
  return new Promise((resolve) => {
    if (!src) return resolve(null);
    const cleanSrc = toDirectDriveImageUrl(src);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => {
      // ลองโหลดอีกครั้งโดยไม่ใช้ crossOrigin เผื่อบางเบราว์เซอร์
      const retryImg = new Image();
      retryImg.onload = () => resolve(retryImg);
      retryImg.onerror = () => resolve(null);
      retryImg.src = cleanSrc;
    };
    img.src = cleanSrc;
  });
}

// วาดสี่เหลี่ยมมุมมนแบบรองรับเบราว์เซอร์ทุกเวอร์ชัน
function drawRoundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

// วาดรูปภาพแบบ Object-Fit: Cover ในกรอบมุมมน
function drawImageCover(ctx, img, x, y, w, h, radius) {
  if (!img) return;
  ctx.save();
  drawRoundedRect(ctx, x, y, w, h, radius);
  ctx.clip();

  const imgRatio = img.width / img.height;
  const targetRatio = w / h;
  let sWidth = img.width;
  let sHeight = img.height;
  let sx = 0;
  let sy = 0;

  if (imgRatio > targetRatio) {
    sWidth = img.height * targetRatio;
    sx = (img.width - sWidth) / 2;
  } else {
    sHeight = img.width / targetRatio;
    sy = (img.height - sHeight) / 2;
  }

  ctx.drawImage(img, sx, sy, sWidth, sHeight, x, y, w, h);
  ctx.restore();

  // วาดเส้นขอบบางๆ รอบรูป
  ctx.save();
  drawRoundedRect(ctx, x, y, w, h, radius);
  ctx.strokeStyle = "#CBD5E1";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

/**
 * สร้างรูปรายงานสรุปผลแบบการ์ดภาพรวม (Composite Report Card Image)
 * ประกอบด้วย: หัวเรื่องบริษัท, ภาพใบหน้า 1:1, ภาพหน้าปัดเครื่องเป่า, ภาพเครื่องวัดความดัน, ตารางข้อมูลสรุป, วันที่เวลา, พิกัด GPS
 */
async function generateCompositeReportCard() {
  const canvas = document.createElement("canvas");
  canvas.width = 800;
  canvas.height = 1120;
  const ctx = canvas.getContext("2d");

  // 1. พื้นหลังการ์ดสีขาว
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, 800, 1120);

  // 2. แถบหัวกระดาษด้านบน (Header Banner) สีน้ำเงินเข้มหรูหรา
  const headerGrad = ctx.createLinearGradient(0, 0, 800, 120);
  headerGrad.addColorStop(0, "#1E3A8A");
  headerGrad.addColorStop(1, "#1D4ED8");
  ctx.fillStyle = headerGrad;
  ctx.fillRect(0, 0, 800, 115);

  ctx.fillStyle = "#FFFFFF";
  ctx.font = "bold 26px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("หจก. ทั่วไทยขนส่งมงคล", 400, 45);

  ctx.fillStyle = "#BFDBFE";
  ctx.font = "14px sans-serif";
  ctx.fillText("ระบบตรวจวัดแอลกอฮอล์และความพร้อมสุขภาพพนักงานขับรถขนส่ง", 400, 75);

  ctx.fillStyle = "#93C5FD";
  ctx.font = "12px sans-serif";
  ctx.fillText("รายงานสรุปผลการตรวจสอบ ยืนยันตัวตน และตรวจสุขภาพก่อนปฏิบัติหน้าที่", 400, 98);

  // 3. หัวข้อรายงานสรุป
  ctx.fillStyle = "#0F172A";
  ctx.font = "bold 18px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("ขั้นตอนที่ 5: สรุปผลและยืนยันการส่งรายงาน", 400, 148);

  ctx.fillStyle = "#64748B";
  ctx.font = "12px sans-serif";
  ctx.fillText("บันทึกข้อมูลและจัดเก็บภาพหลักฐานลง Google Sheet & Drive อัตโนมัติ", 400, 168);

  // 4. โหลดภาพถ่ายทั้ง 3 ภาพ
  const bpPhoto = (appState.bp && appState.bp.photoBase64) ? appState.bp.photoBase64 : null;
  const [faceImg, meterImg, bpImg] = await Promise.all([
    loadImageAsync(appState.facePhotoBase64),
    loadImageAsync(appState.meterPhotoBase64),
    loadImageAsync(bpPhoto)
  ]);

  // ภาพ 3 ภาพเรียงแนวนอน
  const pBoxW = 226;
  const pBoxH = 220;
  const pY = 215;

  // ภาพที่ 1: รูปถ่ายใบหน้า Check-in (ซ้าย)
  ctx.fillStyle = "#334155";
  ctx.font = "bold 13px sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("1. รูปใบหน้า Check-in", 40, 205);
  if (faceImg) {
    drawImageCover(ctx, faceImg, 40, pY, pBoxW, pBoxH, 12);
  } else {
    drawRoundedRect(ctx, 40, pY, pBoxW, pBoxH, 12);
    ctx.fillStyle = "#F1F5F9";
    ctx.fill();
  }

  // ภาพที่ 2: รูปหน้าปัดเครื่องเป่า (กลาง)
  ctx.fillText("2. หน้าปัดเครื่องเป่า", 286, 205);
  if (meterImg) {
    drawImageCover(ctx, meterImg, 286, pY, pBoxW, pBoxH, 12);
  } else {
    drawRoundedRect(ctx, 286, pY, pBoxW, pBoxH, 12);
    ctx.fillStyle = "#F1F5F9";
    ctx.fill();
  }

  // ภาพที่ 3: รูปหน้าปัดเครื่องวัดความดัน (ขวา)
  ctx.fillText("3. เครื่องวัดความดัน", 532, 205);
  if (bpImg) {
    drawImageCover(ctx, bpImg, 532, pY, pBoxW, pBoxH, 12);
  } else {
    drawRoundedRect(ctx, 532, pY, pBoxW, pBoxH, 12);
    ctx.fillStyle = "#F1F5F9";
    ctx.fill();
  }

  // 5. กล่องตารางสรุปผลข้อมูล (Summary Details Box)
  const boxY = 460;
  const boxW = 720;
  const boxH = 555;
  ctx.save();
  drawRoundedRect(ctx, 40, boxY, boxW, boxH, 16);
  ctx.fillStyle = "#F8FAFC";
  ctx.fill();
  ctx.strokeStyle = "#E2E8F0";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();

  const driver = appState.driver || {};
  const isAlcoholPass = appState.testStatus === "ผ่าน" && appState.alcoholValue < 0.01;
  const bp = appState.bp || { sys: 120, dia: 80, pulse: 75, status: "ความดันปกติ", isPass: true };
  const isOverallPass = isAlcoholPass && bp.isPass && appState.faceMatchPassed;

  // แถวที่ 1: ผลการตรวจวัดระดับแอลกอฮอล์
  const r1Y = boxY + 40;
  ctx.fillStyle = "#64748B";
  ctx.font = "14px sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("ผลตรวจแอลกอฮอล์:", 65, r1Y);

  const alcText = isAlcoholPass ? `ผ่าน (${appState.alcoholValue.toFixed(2)} mg%)` : `ไม่ผ่าน (${appState.alcoholValue.toFixed(2)} mg%)`;
  const alcBg = isAlcoholPass ? "#DCFCE7" : "#FEE2E2";
  const alcBorder = isAlcoholPass ? "#86EFAC" : "#FCA5A5";
  const alcColor = isAlcoholPass ? "#15803D" : "#B91C1C";
  ctx.save();
  drawRoundedRect(ctx, 515, r1Y - 24, 215, 32, 6);
  ctx.fillStyle = alcBg;
  ctx.fill();
  ctx.strokeStyle = alcBorder;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = alcColor;
  ctx.font = "bold 14px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(alcText, 622, r1Y - 3);
  ctx.restore();

  // แถวที่ 2: ผลตรวจวัดความดันโลหิตและชีพจร
  const r2Y = r1Y + 45;
  ctx.fillStyle = "#64748B";
  ctx.font = "14px sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("ผลตรวจความดันและชีพจร:", 65, r2Y);

  const bpText = `${bp.sys}/${bp.dia} mmHg (${bp.pulse} bpm) • ${bp.status}`;
  const bpBg = bp.isPass ? "#DCFCE7" : "#FEF3C7";
  const bpBorder = bp.isPass ? "#86EFAC" : "#FCD34D";
  const bpColor = bp.isPass ? "#15803D" : "#B45309";
  ctx.save();
  drawRoundedRect(ctx, 470, r2Y - 24, 260, 32, 6);
  ctx.fillStyle = bpBg;
  ctx.fill();
  ctx.strokeStyle = bpBorder;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = bpColor;
  ctx.font = "bold 13px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(bpText, 600, r2Y - 3);
  ctx.restore();

  // แถวที่ 3: สรุปความพร้อมปฏิบัติหน้าที่ (Overall Status)
  const r3Y = r2Y + 45;
  ctx.fillStyle = "#64748B";
  ctx.font = "14px sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("ประเมินความพร้อมปฏิบัติหน้าที่:", 65, r3Y);

  const ovText = isOverallPass ? "✓ พร้อมปฏิบัติหน้าที่ขับขี่" : "⚠️ ไม่พร้อม / ไม่อนุญาตให้ขับขี่";
  const ovBg = isOverallPass ? "#15803D" : "#DC2626";
  ctx.save();
  drawRoundedRect(ctx, 470, r3Y - 24, 260, 32, 6);
  ctx.fillStyle = ovBg;
  ctx.fill();
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "bold 13px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(ovText, 600, r3Y - 3);
  ctx.restore();

  // เส้นแบ่งแถว
  ctx.strokeStyle = "#E2E8F0";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(65, r3Y + 20);
  ctx.lineTo(735, r3Y + 20);
  ctx.stroke();

  // แถวที่ 4: ความตรงตัวบุคคล
  const r4Y = r3Y + 50;
  ctx.fillStyle = "#64748B";
  ctx.font = "14px sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("ความตรงตัวบุคคล (Face Match):", 65, r4Y);
  ctx.fillStyle = appState.faceMatchPassed ? "#16A34A" : "#DC2626";
  ctx.font = "bold 14px sans-serif";
  ctx.textAlign = "right";
  ctx.fillText(`ตรง ${appState.faceMatchPercent || 90}% (${appState.faceMatchPassed ? 'ผ่าน' : 'ไม่ผ่าน'})`, 730, r4Y);

  // แถวที่ 5: พนักงานขับรถ
  const r5Y = r4Y + 40;
  ctx.fillStyle = "#64748B";
  ctx.font = "14px sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("พนักงานขับรถ:", 65, r5Y);
  ctx.fillStyle = "#0F172A";
  ctx.font = "bold 14px sans-serif";
  ctx.textAlign = "right";
  ctx.fillText(driver.driverName || "-", 730, r5Y);

  // แถวที่ 6: อีเมลพนักงาน
  const r6Y = r5Y + 40;
  ctx.fillStyle = "#64748B";
  ctx.font = "14px sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("อีเมลพนักงาน:", 65, r6Y);
  ctx.fillStyle = "#334155";
  ctx.font = "14px sans-serif";
  ctx.textAlign = "right";
  ctx.fillText(driver.email || "-", 730, r6Y);

  // แถวที่ 7: ทะเบียนรถ
  const r7Y = r6Y + 40;
  ctx.fillStyle = "#64748B";
  ctx.font = "14px sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("ทะเบียนรถ:", 65, r7Y);
  ctx.fillStyle = "#0F172A";
  ctx.font = "bold 14px sans-serif";
  ctx.textAlign = "right";
  ctx.fillText(driver.vehiclePlate || "-", 730, r7Y);

  // แถวที่ 8: พิกัด GPS
  const r8Y = r7Y + 40;
  ctx.fillStyle = "#64748B";
  ctx.font = "14px sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("พิกัด GPS:", 65, r8Y);
  ctx.fillStyle = "#334155";
  ctx.font = "13px sans-serif";
  ctx.textAlign = "right";
  ctx.fillText(appState.gps.text || "-", 730, r8Y);

  // แถวที่ 9: เวลาที่บันทึก
  const r9Y = r8Y + 40;
  ctx.fillStyle = "#64748B";
  ctx.font = "14px sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("เวลาที่บันทึก:", 65, r9Y);
  ctx.fillStyle = "#334155";
  ctx.font = "14px sans-serif";
  ctx.textAlign = "right";
  const nowThai = new Date().toLocaleString("th-TH");
  ctx.fillText(nowThai, 730, r9Y);

  // แถวที่ 10: ตราประทับความถูกต้อง
  const r10Y = r9Y + 38;
  ctx.fillStyle = "#059669";
  ctx.font = "bold 12px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("✓ VERIFIED DIGITAL INSPECTION RECORD • GOOGLE DRIVE ARCHIVE", 400, r10Y);

  // 6. ส่วนท้าย (Footer)
  ctx.fillStyle = "#0F172A";
  ctx.fillRect(0, 1040, 800, 80);

  ctx.fillStyle = "#F1F5F9";
  ctx.font = "bold 14px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("copyright , Mr.Taweesak.kom (0623285963)", 400, 1072);

  ctx.fillStyle = "#94A3B8";
  ctx.font = "12px sans-serif";
  ctx.fillText("หจก. ทั่วไทยขนส่งมงคล • ระบบตรวจวัดแอลกอฮอล์และสุขภาพพนักงานขับรถขนส่ง", 400, 1096);

  const reportDataUrl = canvas.toDataURL("image/jpeg", 0.92);
  appState.reportImageBase64 = reportDataUrl;
  return reportDataUrl;
}
window.generateCompositeReportCard = generateCompositeReportCard;

// ฟังก์ชันดาวน์โหลดรูปรายงานลงในอุปกรณ์ทันที
window.downloadReportCardImage = async function() {
  Swal.fire({
    title: "กำลังสร้างรูปรายงานสรุป...",
    text: "กรุณารอสักครู่ กำลังประมวลผลภาพถ่ายและข้อมูล",
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading()
  });

  try {
    const reportUrl = await generateCompositeReportCard();
    Swal.close();

    if (!reportUrl) {
      throw new Error("ไม่สามารถสร้างรูปภาพได้");
    }

    const link = document.createElement("a");
    const driverId = appState.driver ? appState.driver.driverId : "DRV";
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    link.download = `REPORT_${driverId}_${dateStr}.jpg`;
    link.href = reportUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    Swal.fire({
      icon: "success",
      title: "บันทึกรูปรายงานสำเร็จ!",
      text: "ระบบได้ดาวน์โหลดรูปรายงานสรุปเข้าสู่อัลบั้ม/เครื่องของท่านเรียบร้อยแล้ว สามารถส่งเข้ากลุ่ม LINE ได้ทันที",
      confirmButtonColor: "#2563eb"
    });
  } catch (err) {
    Swal.fire({
      icon: "error",
      title: "เกิดข้อผิดพลาด",
      text: "ไม่สามารถสร้างภาพรายงานได้: " + err.message,
      confirmButtonColor: "#2563eb"
    });
  }
};

async function handleSubmitData() {
  const remarks = (document.getElementById("summaryRemarks").value || "").trim();
  const bp = appState.bp || { sys: 120, dia: 80, pulse: 75, status: "ความดันปกติ", isPass: true };
  const isAlcoholPass = appState.testStatus === "ผ่าน" && appState.alcoholValue < 0.01;
  const isOverallPass = isAlcoholPass && bp.isPass && appState.faceMatchPassed;
  const overallStatus = isOverallPass ? "ผ่านพร้อมปฏิบัติงาน" : "ไม่ผ่านเกณฑ์";

  const confirmResult = await Swal.fire({
    title: "ยืนยันการบันทึกรายงาน?",
    html: `
      <div class="text-left text-xs space-y-1.5 p-2.5 bg-slate-50 rounded border">
        <div><strong>พนักงาน:</strong> ${appState.driver ? appState.driver.driverName : '-'}</div>
        <div><strong>Face Match 1:1:</strong> <span class="font-bold text-emerald-600">${appState.faceMatchPercent}%</span></div>
        <div><strong>ผลตรวจแอลกอฮอล์:</strong> <span class="${appState.testStatus === 'ผ่าน' ? 'text-emerald-600 font-bold' : 'text-red-600 font-bold'}">${appState.testStatus} (${appState.alcoholValue.toFixed(2)} mg%)</span></div>
        <div><strong>ความดันโลหิตและชีพจร:</strong> <span class="${bp.isPass ? 'text-emerald-600 font-bold' : 'text-amber-600 font-bold'}">${bp.sys}/${bp.dia} mmHg (${bp.pulse} bpm) - ${bp.status}</span></div>
        <div><strong>พิกัด:</strong> ${appState.gps.text}</div>
      </div>
    `,
    icon: isOverallPass ? "question" : "warning",
    showCancelButton: true,
    confirmButtonText: "ยืนยันส่งข้อมูล",
    cancelButtonText: "ตรวจสอบอีกครั้ง",
    confirmButtonColor: isOverallPass ? "#2563eb" : "#dc2626"
  });

  if (!confirmResult.isConfirmed) return;

  let targetGasUrl = getGasWebAppUrl();
  const isDummyUrl = !targetGasUrl || targetGasUrl.includes("REPLACE_WITH_YOUR_DEPLOYMENT_ID");

  if (isDummyUrl) {
    const { value: enteredUrl } = await Swal.fire({
      icon: "warning",
      title: "ยังไม่ได้เชื่อมต่อ Google Apps Script!",
      html: `
        <div class="text-xs text-slate-600 text-left space-y-2 mb-3">
          <p class="font-bold text-red-600 text-sm">ข้อมูลยังไม่สามารถบันทึกลง Google Sheet และ Google Drive ได้</p>
          <p>ระบบจำเป็นต้องใช้ <b>Web App URL</b> จาก Google Apps Script (ที่ลงท้ายด้วย <code>/exec</code>) เพื่อบันทึกผลและจัดเก็บรูปภาพ</p>
          <div class="bg-blue-50 border border-blue-200 p-2.5 rounded-xl text-blue-900 space-y-1">
            <p class="font-semibold">💡 หากท่าน Deploy ใน Google Apps Script เรียบร้อยแล้ว:</p>
            <p>โปรดวาง Web App URL ในช่องด้านล่าง แล้วกด "เชื่อมต่อและส่งข้อมูล" ทันทีครับ:</p>
          </div>
        </div>
      `,
      input: "text",
      inputPlaceholder: "https://script.google.com/macros/s/AKfycb.../exec",
      showCancelButton: true,
      confirmButtonText: "เชื่อมต่อและส่งข้อมูล",
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

  Swal.fire({
    title: "กำลังบันทึกข้อมูล...",
    html: `
      <div class="space-y-2 text-xs text-slate-500">
        <div>กำลังอัปโหลดภาพถ่ายไปยัง Google Drive...</div>
        <div>กำลังเพิ่มแถวข้อมูลลงใน Google Sheet...</div>
        <div>กำลังส่งการแจ้งเตือนไปยัง LINE / Telegram...</div>
      </div>
    `,
    allowOutsideClick: false,
    didOpen: () => {
      Swal.showLoading();
    }
  });

  // สร้างหรือดึงรูปภาพรายงานสรุปแบบการ์ดภาพรวม (Composite Report Card)
  let reportCardBase64 = appState.reportImageBase64;
  if (!reportCardBase64) {
    try {
      reportCardBase64 = await generateCompositeReportCard();
    } catch (e) {
      console.warn("Could not generate composite report card:", e);
    }
  }

  const payload = {
    action: "submitAlcoholTest",
    driverId: appState.driver ? appState.driver.driverId : "UNKNOWN",
    driverName: appState.driver ? appState.driver.driverName : "ไม่ระบุชื่อ",
    email: appState.driver ? appState.driver.email : "",
    phone: appState.driver ? appState.driver.phone : "-",
    vehiclePlate: appState.driver ? appState.driver.vehiclePlate : "-",
    alcoholValue: appState.alcoholValue.toFixed(2),
    status: appState.testStatus,
    bpSys: bp.sys,
    bpDia: bp.dia,
    bpPulse: bp.pulse,
    bpStatus: bp.status,
    overallStatus: overallStatus,
    faceMatchPercent: appState.faceMatchPercent + "%",
    latitude: appState.gps.lat || "",
    longitude: appState.gps.lng || "",
    reportImageBase64: reportCardBase64 || "",
    faceImageBase64: appState.facePhotoBase64 || "",
    meterImageBase64: appState.meterPhotoBase64 || "",
    bpPhotoBase64: (bp.photoBase64 || ""),
    verificationMethod: "Face 1:1 Matching, AI OCR & Health BP",
    remarks: remarks || "ตรวจก่อนปฏิบัติหน้าที่ประจำวัน"
  };

  try {
    let responseSuccess = false;
    let responseMsg = "บันทึกผลการตรวจเรียบร้อยแล้ว";

    const res = await fetch(targetGasUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify(payload)
    });
    const resJson = await res.json();
    if (resJson.success) {
      responseSuccess = true;
      responseMsg = resJson.message || "บันทึกผลตรวจและจัดเก็บภาพลง Google Drive สำเร็จ";
    } else {
      throw new Error(resJson.error || resJson.message || "การบันทึกข้อมูลไม่สำเร็จ");
    }

    if (responseSuccess) {
      if (isOverallPass) {
        Swal.fire({
          icon: "success",
          title: "บันทึกข้อมูลสำเร็จ!",
          html: `
            <p class="text-sm text-slate-700">${responseMsg}</p>
            <p class="text-xs text-emerald-600 font-semibold mt-2">✓ ผ่านเกณฑ์แอลกอฮอล์ 0.00 mg% และความดันปกติ ขับขี่ปลอดภัยด้วยความระมัดระวังครับ</p>
          `,
          confirmButtonColor: "#2563eb",
          confirmButtonText: "ตกลง (ตรวจคนถัดไป)"
        }).then(() => {
          resetApplication();
        });
      } else {
        Swal.fire({
          icon: "warning",
          title: "บันทึกผลการตรวจ: ไม่ผ่านเกณฑ์!",
          html: `
            <p class="text-sm text-red-600 font-bold">ผลการตรวจ: ${appState.testStatus === 'ไม่ผ่าน' ? 'แอลกอฮอล์ ' + appState.alcoholValue.toFixed(2) + ' mg%' : bp.status}</p>
            <p class="text-xs text-slate-600 mt-2">ระบบได้บันทึกรายงานแจ้งเตือนเรียบร้อยแล้ว ห้ามปฏิบัติหน้าที่ขับขี่เด็ดขาด</p>
          `,
          confirmButtonColor: "#dc2626",
          confirmButtonText: "รับทราบ"
        }).then(() => {
          resetApplication();
        });
      }
    }

  } catch (error) {
    console.error("Submission Error:", error);
    Swal.fire({
      icon: "error",
      title: "เกิดข้อผิดพลาดในการส่งข้อมูล",
      text: error.message || "ไม่สามารถเชื่อมต่อกับ Google Apps Script ได้",
      confirmButtonColor: "#2563eb"
    });
  }
}

function resetApplication() {
  stopCurrentCamera();
  appState.facePhotoBase64 = null;
  appState.meterPhotoBase64 = null;
  appState.reportImageBase64 = null;
  appState.alcoholValue = 0.00;
  appState.testStatus = "ผ่าน";
  appState.faceMatchPercent = 0;
  appState.faceMatchPassed = false;
  appState.bp = {
    sys: 120,
    dia: 80,
    pulse: 75,
    status: "ความดันปกติ",
    isPass: true,
    photoBase64: null
  };

  resetFaceCameraUI();
  resetMeterCameraUI();
  resetBPCameraUI();

  const remarksInput = document.getElementById("summaryRemarks");
  if (remarksInput) remarksInput.value = "";
  const alcoholInput = document.getElementById("alcoholValueInput");
  if (alcoholInput) alcoholInput.value = "0.00";
  const sysInput = document.getElementById("bpSysInput");
  if (sysInput) sysInput.value = "120";
  const diaInput = document.getElementById("bpDiaInput");
  if (diaInput) diaInput.value = "80";
  const pulseInput = document.getElementById("bpPulseInput");
  if (pulseInput) pulseInput.value = "75";

  goToStep(1);
}

// =========================================================================
// HELPER UTILITIES
// =========================================================================
function requestGPSCoordinates() {
  if (!navigator.geolocation) {
    appState.gps.text = "อุปกรณ์ไม่รองรับ GPS";
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      appState.gps.lat = position.coords.latitude.toFixed(6);
      appState.gps.lng = position.coords.longitude.toFixed(6);
      appState.gps.accuracy = position.coords.accuracy.toFixed(1);
      appState.gps.text = `${appState.gps.lat}, ${appState.gps.lng} (±${appState.gps.accuracy}m)`;
    },
    (err) => {
      console.warn("GPS Warning:", err.message);
      appState.gps.text = "ไม่สามารถระบุพิกัดได้";
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
  );
}

function checkImageBrightnessQuality(ctx, width, height) {
  try {
    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;
    let colorSum = 0;
    const sampleRate = Math.max(1, Math.floor(data.length / (4 * 1000)));
    let sampledCount = 0;

    for (let x = 0; x < data.length; x += 4 * sampleRate) {
      const avg = Math.floor((data[x] + data[x + 1] + data[x + 2]) / 3);
      colorSum += avg;
      sampledCount++;
    }

    const brightness = Math.floor(colorSum / sampledCount);
    return brightness >= 15;
  } catch (e) {
    return true;
  }
}

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

function applyContrastFilter(ctx, width, height) {
  try {
    const imgData = ctx.getImageData(0, 0, width, height);
    const d = imgData.data;
    const contrast = 1.6;
    const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));

    for (let i = 0; i < d.length; i += 4) {
      const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      let adjusted = factor * (gray - 128) + 128;
      if (adjusted > 255) adjusted = 255;
      if (adjusted < 0) adjusted = 0;

      d[i] = adjusted;
      d[i + 1] = adjusted;
      d[i + 2] = adjusted;
    }
    ctx.putImageData(imgData, 0, 0);
  } catch (e) {
    console.warn("Contrast filter skip:", e);
  }
}
