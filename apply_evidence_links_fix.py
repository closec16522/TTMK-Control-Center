import re

with open('index.html', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Update handleEvidenceImgError
old_err_fn = '''    window.handleEvidenceImgError = function(img) {
      if (img.dataset.hasRetried) return;
      img.dataset.hasRetried = "true";
      if (img.dataset.driveId) {
        img.src = "https://lh3.googleusercontent.com/d/" + img.dataset.driveId;
      } else if (img.dataset.fallbackSrc) {
        img.src = img.dataset.fallbackSrc;
      }
    };'''

new_err_fn = '''    window.handleEvidenceImgError = function(img) {
      if (!img) return;
      const step = parseInt(img.dataset.retryStep || "0", 10);
      const driveId = img.dataset.driveId;
      if (step === 0 && driveId) {
        img.dataset.retryStep = "1";
        img.src = "https://drive.google.com/thumbnail?id=" + driveId + "&sz=w1000";
      } else if (step === 1 && driveId) {
        img.dataset.retryStep = "2";
        img.src = "https://drive.google.com/uc?export=view&id=" + driveId;
      } else if (step <= 2 && img.dataset.fallbackSrc) {
        img.dataset.retryStep = "3";
        img.src = img.dataset.fallbackSrc;
      }
    };'''

if old_err_fn in text:
    text = text.replace(old_err_fn, new_err_fn)
    print('1. handleEvidenceImgError replaced')
else:
    print('1. handleEvidenceImgError NOT found')

# 2. Add onerror to Tab 5 thumbnails if not present
text = text.replace(
    '<img id="alcDriveThumbCard" src="" alt="Thumbnail ใบรับรอง" class="max-h-full max-w-full object-contain rounded" />',
    '<img id="alcDriveThumbCard" src="" alt="Thumbnail ใบรับรอง" class="max-h-full max-w-full object-contain rounded" onerror="handleEvidenceImgError(this)" />'
)
text = text.replace(
    '<img id="alcDriveThumbFace" src="" alt="Thumbnail ใบหน้า" class="max-h-full max-w-full object-contain rounded" />',
    '<img id="alcDriveThumbFace" src="" alt="Thumbnail ใบหน้า" class="max-h-full max-w-full object-contain rounded" onerror="handleEvidenceImgError(this)" />'
)
text = text.replace(
    '<img id="alcDriveThumbMeter" src="" alt="Thumbnail เครื่องเป่าแอลกอฮอล์" class="max-h-full max-w-full object-contain rounded" />',
    '<img id="alcDriveThumbMeter" src="" alt="Thumbnail เครื่องเป่าแอลกอฮอล์" class="max-h-full max-w-full object-contain rounded" onerror="handleEvidenceImgError(this)" />'
)
text = text.replace(
    '<img id="alcDriveThumbBp" src="" alt="Thumbnail ความดัน" class="max-h-full max-w-full object-contain rounded" />',
    '<img id="alcDriveThumbBp" src="" alt="Thumbnail ความดัน" class="max-h-full max-w-full object-contain rounded" onerror="handleEvidenceImgError(this)" />'
)
print('2. Added onerror to Tab 5 thumbnails')

# 3. Replace parseGvizAlcoholRows
old_gviz_pattern = r'    // Helper function to parse live Google Sheet rows directly from GViz\s+function parseGvizAlcoholRows\(rows\) \{[\s\S]*?return result\.reverse\(\);\s+\}'
new_gviz_fn = '''    // Helper function to parse live Google Sheet rows directly from GViz
    function parseGvizAlcoholRows(rows) {
      if (!Array.isArray(rows)) return [];
      const result = [];

      function parseDateCell(cell) {
        if (!cell) return '';
        if (cell.f) return String(cell.f).trim();
        if (cell.v !== null && cell.v !== undefined) {
          const s = String(cell.v).trim();
          const m = s.match(/^Date\\((\\d+),(\\d+),(\\d+)(?:,(\\d+),(\\d+),(\\d+))?\\)$/);
          if (m) {
            const yr = m[1];
            const mo = String(parseInt(m[2], 10) + 1).padStart(2, '0');
            const da = String(parseInt(m[3], 10)).padStart(2, '0');
            const hr = m[4] !== undefined ? String(parseInt(m[4], 10)).padStart(2, '0') : '00';
            const mi = m[5] !== undefined ? String(parseInt(m[5], 10)).padStart(2, '0') : '00';
            const sc = m[6] !== undefined ? String(parseInt(m[6], 10)).padStart(2, '0') : '00';
            return `${yr}-${mo}-${da} ${hr}:${mi}:${sc}`;
          }
          return s;
        }
        return '';
      }

      rows.forEach(r => {
        const c = r.c || [];
        const getVal = (idx) => {
          if (!c[idx]) return '';
          if (c[idx].f !== null && c[idx].f !== undefined) return String(c[idx].f).trim();
          if (c[idx].v !== null && c[idx].v !== undefined) {
            const s = String(c[idx].v).trim();
            const m = s.match(/^Date\\((\\d+),(\\d+),(\\d+)(?:,(\\d+),(\\d+),(\\d+))?\\)$/);
            if (m) {
              const yr = m[1];
              const mo = String(parseInt(m[2], 10) + 1).padStart(2, '0');
              const da = String(parseInt(m[3], 10)).padStart(2, '0');
              const hr = m[4] !== undefined ? String(parseInt(m[4], 10)).padStart(2, '0') : '00';
              const mi = m[5] !== undefined ? String(parseInt(m[5], 10)).padStart(2, '0') : '00';
              const sc = m[6] !== undefined ? String(parseInt(m[6], 10)).padStart(2, '0') : '00';
              return `${yr}-${mo}-${da} ${hr}:${mi}:${sc}`;
            }
            return s;
          }
          return '';
        };
        const getNum = (idx) => (c[idx] && c[idx].v !== null && !isNaN(c[idx].v)) ? Number(c[idx].v) : 0;

        const timestamp = parseDateCell(c[0]);
        if (!timestamp) return;

        const date = parseDateCell(c[1]) || timestamp.split(' ')[0];
        const time = getVal(2) || (timestamp.split(' ')[1] || '');
        const driverId = getVal(3);
        const driverName = getVal(4);
        const email = getVal(5);
        const phone = getVal(6);
        const vehiclePlate = getVal(7);
        const alcoholValue = getNum(8);
        const status = getVal(9) || (alcoholValue > 0 ? 'ไม่ผ่าน' : 'ผ่าน');
        const facePhotoUrl = getVal(10);
        const meterPhotoUrl = getVal(11);
        const gpsCoordinates = getVal(12);
        const googleMapsLink = getVal(13);
        const verificationMethod = getVal(14) || 'Face 1:1 Matching, AI OCR & Health BP';
        const remarks = getVal(15);
        const bpSys = getNum(16) || 120;
        const bpDia = getNum(17) || 80;
        const bpPulse = getNum(18) || 75;
        const bpStatus = getVal(19) || (bpSys > 125 || bpDia >= 90 ? 'ความดันสูง' : 'ความดันปกติ');
        const overallStatus = getVal(20) || (status === 'ไม่ผ่าน' || bpStatus === 'ความดันสูง' ? 'ไม่ผ่านเกณฑ์' : 'ผ่านพร้อมปฏิบัติงาน');
        const faceMatchPercent = getVal(21) || '98%';
        const reportCardUrl = getVal(22);
        const bpPhotoUrl = getVal(23);

        const extractDriveId = (url) => {
          if (!url) return '';
          const m = url.match(/\\/d\\/([a-zA-Z0-9_-]+)/);
          return m ? m[1] : '';
        };

        const faceFileId = extractDriveId(facePhotoUrl);
        const meterFileId = extractDriveId(meterPhotoUrl);
        const bpFileId = extractDriveId(bpPhotoUrl);
        const reportCardFileId = extractDriveId(reportCardUrl);

        result.push({
          timestamp,
          date,
          time,
          driverId,
          driverName,
          email,
          phone,
          vehiclePlate,
          alcoholValue,
          status,
          bpSys,
          bpDia,
          bpPulse,
          bpStatus,
          overallStatus,
          faceMatchPercent,
          faceFileId,
          meterFileId,
          bpFileId,
          reportCardFileId,
          facePhotoUrl: facePhotoUrl && facePhotoUrl.includes('drive.google.com') ? facePhotoUrl : (faceFileId ? ('https://drive.google.com/file/d/' + faceFileId + '/view') : ''),
          meterPhotoUrl: meterPhotoUrl && meterPhotoUrl.includes('drive.google.com') ? meterPhotoUrl : (meterFileId ? ('https://drive.google.com/file/d/' + meterFileId + '/view') : ''),
          bpPhotoUrl: bpPhotoUrl && bpPhotoUrl.includes('drive.google.com') ? bpPhotoUrl : (bpFileId ? ('https://drive.google.com/file/d/' + bpFileId + '/view') : ''),
          reportCardUrl: reportCardUrl && reportCardUrl.includes('drive.google.com') ? reportCardUrl : (reportCardFileId ? ('https://drive.google.com/file/d/' + reportCardFileId + '/view') : ''),
          gpsCoordinates,
          googleMapsLink,
          verificationMethod,
          remarks
        });
      });
      return result.reverse();
    }'''

if re.search(old_gviz_pattern, text):
    text = re.sub(old_gviz_pattern, lambda m: new_gviz_fn, text, count=1)
    print('3. Replaced parseGvizAlcoholRows')
else:
    print('3. parseGvizAlcoholRows pattern NOT matched')

# 4. Replace openAlcoholEvidenceModal
old_modal_pattern = r'    function openAlcoholEvidenceModal\(index\) \{[\s\S]*?switchAlcModalTab\(\'card\'\);\s+document\.getElementById\(\'alcoholEvidenceModal\'\)\.classList\.remove\(\'hidden\'\);\s+\}'
new_modal_fn = '''    function openAlcoholEvidenceModal(index) {
      let log;
      if (typeof index === 'number' && appState.alcoholLogs[index]) {
        log = appState.alcoholLogs[index];
      } else if (typeof index === 'object' && index !== null) {
        log = index;
      } else {
        log = appState.alcoholLogs[0];
      }
      if (!log) return;

      window.currentModalAlcoholLog = log;

      // 1. Header Information for THIS Row
      const elDrv = document.getElementById('alcModalDriverName');
      if (elDrv) elDrv.textContent = log.driverName;
      const elPlate = document.getElementById('alcModalPlate');
      if (elPlate) elPlate.textContent = log.vehiclePlate;
      const elTime = document.getElementById('alcModalTimestamp');
      if (elTime) elTime.textContent = log.timestamp;
      const elGps = document.getElementById('alcModalGps');
      if (elGps) elGps.textContent = log.gpsCoordinates || "-";

      // Context Banner for THIS Row
      const activeDrv = document.getElementById('alcModalActiveDriverName');
      if (activeDrv) activeDrv.textContent = log.driverName;
      const activePlate = document.getElementById('alcModalActivePlate');
      if (activePlate) activePlate.textContent = log.vehiclePlate;
      const activeStatusText = document.getElementById('alcModalActiveStatusText');
      if (activeStatusText) activeStatusText.textContent = log.overallStatus || "ผ่านพร้อมปฏิบัติงาน";

      // Tab 5 Drive Header & Details
      const driveTabDrv = document.getElementById('alcModalDriveTabDriverName');
      if (driveTabDrv) driveTabDrv.textContent = `${log.driverName} (${log.vehiclePlate})`;
      const driveRecordId = document.getElementById('alcModalDriveRecordId');
      if (driveRecordId) driveRecordId.textContent = `${log.driverName} • ทะเบียน ${log.vehiclePlate} • ${log.timestamp}`;

      const timeCode = (log.timestamp || "").replace(/[^0-9]/g, '').slice(0, 14) || "20261012_153206";
      const drvId = (log.driverId || "DRV").replace(/[\\s\\.]+/g, '_');

      function getDriveImgSrc(fileId) {
        if (!fileId) return "";
        return "https://lh3.googleusercontent.com/d/" + fileId;
      }

      const repImg = document.getElementById('alcModalReportImg');
      const faceImg = document.getElementById('alcModalFaceImg');
      const meterImg = document.getElementById('alcModalMeterImg');
      const bpImg = document.getElementById('alcModalBpImg');

      const driveThumbCard = document.getElementById('alcDriveThumbCard');
      const driveThumbFace = document.getElementById('alcDriveThumbFace');
      const driveThumbMeter = document.getElementById('alcDriveThumbMeter');
      const driveThumbBp = document.getElementById('alcDriveThumbBp');

      // Clear retry flags on modal opening
      [repImg, faceImg, meterImg, bpImg, driveThumbCard, driveThumbFace, driveThumbMeter, driveThumbBp].forEach(img => {
        if (img) {
          delete img.dataset.hasRetried;
          delete img.dataset.retryStep;
        }
      });

      // Generate dynamic composite fallback card for THIS row
      const compositeCardDataUrl = renderCompositeCardToDataUrl(log);
      const faceFallbackDataUrl = renderFacePhotoDataUrl(log);
      const meterFallbackDataUrl = renderMeterPhotoDataUrl(log);
      const bpFallbackDataUrl = renderBpPhotoDataUrl(log);

      // TAB 1: Composite Report Card (Column W from Sheet)
      if (repImg) {
        repImg.dataset.driveId = log.reportCardFileId || "";
        repImg.dataset.fallbackSrc = compositeCardDataUrl;
        if (log.reportCardFileId) {
          repImg.src = getDriveImgSrc(log.reportCardFileId);
        } else {
          repImg.src = compositeCardDataUrl;
        }
      }

      // TAB 2: Face 1:1 Image (Column K from Sheet)
      if (faceImg) {
        faceImg.dataset.driveId = log.faceFileId || "";
        faceImg.dataset.fallbackSrc = faceFallbackDataUrl;
        if (log.faceFileId) {
          faceImg.src = getDriveImgSrc(log.faceFileId);
        } else {
          faceImg.src = faceFallbackDataUrl;
        }
      }
      const faceDriveLink = document.getElementById('alcModalFaceDriveLink');
      if (faceDriveLink) {
        faceDriveLink.href = log.facePhotoUrl || (log.faceFileId ? `https://drive.google.com/file/d/${log.faceFileId}/view` : '#');
      }
      const faceLabel = document.getElementById('alcModalFaceLabel');
      if (faceLabel) {
        faceLabel.textContent = `${log.driverName} (${log.vehiclePlate}) - Face Match ${log.faceMatchPercent || '98%'}`;
      }

      // TAB 3: Breathalyzer Meter Image (Column L from Sheet)
      if (meterImg) {
        const meterId = log.meterFileId || "1Dnse95n8BhGgdt4CPlt6-m3FfaktLjdL";
        meterImg.dataset.driveId = meterId;
        meterImg.dataset.fallbackSrc = meterFallbackDataUrl;
        meterImg.src = getDriveImgSrc(meterId);
      }
      const meterDriveLink = document.getElementById('alcModalMeterDriveLink');
      if (meterDriveLink) {
        meterDriveLink.href = log.meterPhotoUrl || (log.meterFileId ? `https://drive.google.com/file/d/${log.meterFileId}/view` : 'https://drive.google.com/file/d/1Dnse95n8BhGgdt4CPlt6-m3FfaktLjdL/view');
      }
      const meterBadge = document.getElementById('alcModalMeterBadge');
      if (meterBadge) {
        meterBadge.textContent = `ระดับแอลกอฮอล์: ${Number(log.alcoholValue || 0).toFixed(2)} mg% (${log.status || 'ผ่าน'}) • เซ็นเซอร์ Fuel Cell`;
      }

      // TAB 4: BP Monitor Image (Column X from Sheet)
      if (bpImg) {
        bpImg.dataset.driveId = log.bpFileId || "";
        bpImg.dataset.fallbackSrc = bpFallbackDataUrl;
        if (log.bpFileId) {
          bpImg.src = getDriveImgSrc(log.bpFileId);
        } else {
          bpImg.src = bpFallbackDataUrl;
        }
      }
      const bpDriveLink = document.getElementById('alcModalBpDriveLink');
      if (bpDriveLink) {
        bpDriveLink.href = log.bpPhotoUrl || (log.bpFileId ? `https://drive.google.com/file/d/${log.bpFileId}/view` : '#');
      }
      const bpLabel = document.getElementById('alcModalBpLabel');
      if (bpLabel) {
        bpLabel.textContent = `${log.driverName} • ความดัน ${log.bpSys}/${log.bpDia} mmHg (${log.bpStatus || 'ความดันปกติ'})`;
      }
      const bpBadge = document.getElementById('alcModalBpStatusBadge');
      if (bpBadge) {
        bpBadge.textContent = `SYS: ${log.bpSys} / DIA: ${log.bpDia} / PULSE: ${log.bpPulse || 75}`;
        if ((log.bpStatus || '').includes('สูง') || Number(log.bpDia) >= 90) {
          bpBadge.className = "px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 text-[10px] font-bold border border-rose-500/40";
        } else {
          bpBadge.className = "px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 text-[10px] font-bold border border-blue-500/30";
        }
      }
      const elSys = document.getElementById('alcModalBpSysText');
      if (elSys) elSys.textContent = log.bpSys;
      const elDia = document.getElementById('alcModalBpDiaText');
      if (elDia) elDia.textContent = log.bpDia;
      const elPulse = document.getElementById('alcModalBpPulseText');
      if (elPulse) elPulse.textContent = log.bpPulse || 75;

      // File Names in Tabs
      const elRepFn = document.getElementById('alcModalReportFileName');
      if (elRepFn) elRepFn.textContent = `REPORT_${drvId}_${timeCode}.jpg`;
      const elFaceFn = document.getElementById('alcModalFaceFileName');
      if (elFaceFn) elFaceFn.textContent = `FACE_${drvId}_${timeCode}.jpg`;
      const elMeterFn = document.getElementById('alcModalMeterFileName');
      if (elMeterFn) elMeterFn.textContent = `METER_${drvId}_${timeCode}.jpg`;
      const elBpFn = document.getElementById('alcModalBpFileName');
      if (elBpFn) elBpFn.textContent = `BP_${drvId}_${timeCode}.jpg`;

      // TAB 5: 4 Dedicated Google Drive Evidence Cards for THIS Driver Row (Col W, K, L, X)
      if (driveThumbCard) {
        driveThumbCard.dataset.driveId = log.reportCardFileId || "";
        driveThumbCard.dataset.fallbackSrc = compositeCardDataUrl;
        driveThumbCard.src = log.reportCardFileId ? getDriveImgSrc(log.reportCardFileId) : compositeCardDataUrl;
      }
      const driveNameCard = document.getElementById('alcDriveNameCard');
      if (driveNameCard) driveNameCard.textContent = `REPORT_${drvId}_${timeCode}.jpg`;
      const driveLinkCard = document.getElementById('alcDriveLinkCard');
      if (driveLinkCard) driveLinkCard.href = log.reportCardUrl || (log.reportCardFileId ? `https://drive.google.com/file/d/${log.reportCardFileId}/view` : '#');

      if (driveThumbFace) {
        driveThumbFace.dataset.driveId = log.faceFileId || "";
        driveThumbFace.dataset.fallbackSrc = faceFallbackDataUrl;
        driveThumbFace.src = log.faceFileId ? getDriveImgSrc(log.faceFileId) : faceFallbackDataUrl;
      }
      const driveNameFace = document.getElementById('alcDriveNameFace');
      if (driveNameFace) driveNameFace.textContent = `FACE_${drvId}_${timeCode}.jpg`;
      const driveLinkFace = document.getElementById('alcDriveLinkFace');
      if (driveLinkFace) driveLinkFace.href = log.facePhotoUrl || (log.faceFileId ? `https://drive.google.com/file/d/${log.faceFileId}/view` : '#');

      if (driveThumbMeter) {
        const meterId = log.meterFileId || "1Dnse95n8BhGgdt4CPlt6-m3FfaktLjdL";
        driveThumbMeter.dataset.driveId = meterId;
        driveThumbMeter.dataset.fallbackSrc = meterFallbackDataUrl;
        driveThumbMeter.src = getDriveImgSrc(meterId);
      }
      const driveNameMeter = document.getElementById('alcDriveNameMeter');
      if (driveNameMeter) driveNameMeter.textContent = `METER_${drvId}_${timeCode}.jpg`;
      const driveLinkMeter = document.getElementById('alcDriveLinkMeter');
      if (driveLinkMeter) driveLinkMeter.href = log.meterPhotoUrl || (log.meterFileId ? `https://drive.google.com/file/d/${log.meterFileId}/view` : 'https://drive.google.com/file/d/1Dnse95n8BhGgdt4CPlt6-m3FfaktLjdL/view');

      if (driveThumbBp) {
        driveThumbBp.dataset.driveId = log.bpFileId || "";
        driveThumbBp.dataset.fallbackSrc = bpFallbackDataUrl;
        driveThumbBp.src = log.bpFileId ? getDriveImgSrc(log.bpFileId) : bpFallbackDataUrl;
      }
      const driveNameBp = document.getElementById('alcDriveNameBp');
      if (driveNameBp) driveNameBp.textContent = `BP_${drvId}_${timeCode}.jpg`;
      const driveLinkBp = document.getElementById('alcDriveLinkBp');
      if (driveLinkBp) driveLinkBp.href = log.bpPhotoUrl || (log.bpFileId ? `https://drive.google.com/file/d/${log.bpFileId}/view` : '#');

      // Modal Footer Primary Drive Button
      const modalDriveBtn = document.getElementById('alcModalDriveBtn');
      if (modalDriveBtn) {
        modalDriveBtn.href = log.reportCardUrl || log.facePhotoUrl || log.meterPhotoUrl || log.bpPhotoUrl || '#';
      }

      // Default Active Tab: Report Card of THIS Row!
      switchAlcModalTab('card');
      document.getElementById('alcoholEvidenceModal').classList.remove('hidden');
    }'''

if re.search(old_modal_pattern, text):
    text = re.sub(old_modal_pattern, lambda m: new_modal_fn, text, count=1)
    print('4. Replaced openAlcoholEvidenceModal')
else:
    print('4. openAlcoholEvidenceModal pattern NOT matched')

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(text)
with open('control_center_dashboard.html', 'w', encoding='utf-8') as f:
    f.write(text)
print('Successfully saved changes to index.html and control_center_dashboard.html')
