/**
 * app.js
 * Main Controller for Video to Motion Photo & Live Photo Converter
 * 100% Client-Side Universal Converter
 */

import { translations } from './i18n.js';
import { funFactsData } from './funfacts.js';
import { 
  createGoogleMotionPhoto, 
  createAppleLivePhoto, 
  extractCoverFrame, 
  trimVideoClip 
} from './motionEngine.js';

// Global State
let currentLang = localStorage.getItem('motion_lang') || 'id';
let currentVideoFile = null;
let currentVideoUrl = null;
let currentRotation = 0; // 0, 90, 180, 270 degrees
let isConverting = false;
let currentFactIndex = 0;
let factInterval = null;

// Converted Artifacts Cache
let generatedResult = {
  mode: 'android',
  blob: null,
  filename: '',
  stillSize: 0,
  videoSize: 0,
  totalSize: 0,
  coverDataUrl: '',
  clipVideoUrl: ''
};

// DOM Elements
const doc = document;
const videoFileInput = doc.getElementById('video-file-input');
const dropzone = doc.getElementById('dropzone');
const trimmerPanel = doc.getElementById('trimmer-panel');
const sourceVideo = doc.getElementById('source-video');
const videoTransformWrapper = doc.getElementById('video-transform-wrapper');
const rotateVideoBtn = doc.getElementById('rotate-video-btn');
const rotateBtnText = doc.getElementById('rotate-btn-text');
const rotationStatusBadge = doc.getElementById('rotation-status-badge');

const playPauseBtn = doc.getElementById('play-pause-btn');
const playIcon = doc.getElementById('play-icon');
const currentTimecode = doc.getElementById('current-timecode');
const totalTimecode = doc.getElementById('total-timecode');
const fileNameBadge = doc.getElementById('file-name-badge');
const changeVideoBtn = doc.getElementById('change-video-btn');

// Sliders & Controls
const sliderStart = doc.getElementById('slider-start');
const sliderEnd = doc.getElementById('slider-end');
const valStartTime = doc.getElementById('val-start-time');
const valEndTime = doc.getElementById('val-end-time');
const clipDurationBadge = doc.getElementById('clip-duration-badge');

const sliderKeyframe = doc.getElementById('slider-keyframe');
const keyframePosVal = doc.getElementById('keyframe-pos-val');
const keyframeCanvas = doc.getElementById('keyframe-canvas');
const keyframeTimeDisplay = doc.getElementById('keyframe-time-display');
const btnKfStart = doc.getElementById('btn-kf-start');
const btnKfMid = doc.getElementById('btn-kf-mid');
const btnKfEnd = doc.getElementById('btn-kf-end');

const selectQuality = doc.getElementById('select-quality');
const selectResolution = doc.getElementById('select-resolution');
const convertBtn = doc.getElementById('convert-btn');
const convertBtnText = doc.getElementById('convert-btn-text');

// Progress & Result
const progressContainer = doc.getElementById('progress-container');
const progressStatusText = doc.getElementById('progress-status-text');
const progressPercent = doc.getElementById('progress-percent');
const progressBarFill = doc.getElementById('progress-bar-fill');

const resultCard = doc.getElementById('result-card');
const simulatorBox = doc.getElementById('simulator-box');
const simStillImg = doc.getElementById('sim-still-img');
const simMotionVideo = doc.getElementById('sim-motion-video');
const resStillSize = doc.getElementById('res-still-size');
const resVideoSize = doc.getElementById('res-video-size');
const resTotalSize = doc.getElementById('res-total-size');
const downloadResultBtn = doc.getElementById('download-result-btn');
const downloadBtnLabel = doc.getElementById('download-btn-label');
const resetToolBtn = doc.getElementById('reset-tool-btn');

// Mode Selection
const modeCards = {
  android: doc.getElementById('card-mode-android'),
  tiktok: doc.getElementById('card-mode-tiktok'),
  apple: doc.getElementById('card-mode-apple'),
  dual: doc.getElementById('card-mode-dual')
};

// Fun Facts Elements
const funfactText = doc.getElementById('funfact-text');
const funfactCounter = doc.getElementById('funfact-counter');
const factPrevBtn = doc.getElementById('fact-prev-btn');
const factNextBtn = doc.getElementById('fact-next-btn');

// Format Helper
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatSeconds(secs) {
  return parseFloat(secs).toFixed(2) + 's';
}

function getSelectedMode() {
  const checked = doc.querySelector('input[name="targetMode"]:checked');
  return checked ? checked.value : 'android';
}

// Update Mode Card Highlighting
function updateModeCardStyles() {
  const currentMode = getSelectedMode();
  Object.keys(modeCards).forEach(modeKey => {
    const card = modeCards[modeKey];
    if (!card) return;
    const statusIcon = card.querySelector('.material-symbols-outlined');

    if (modeKey === currentMode) {
      card.className = "cursor-pointer relative flex flex-col p-3 rounded-xl border border-sky-500 bg-sky-500/[0.08] dark:bg-sky-500/[0.12] transition-all";
      if (statusIcon) statusIcon.textContent = "check_circle";
    } else {
      card.className = "cursor-pointer relative flex flex-col p-3 rounded-xl border border-black/[0.08] dark:border-white/[0.08] hover:border-slate-400 dark:hover:border-slate-500 transition-all bg-black/[0.02] dark:bg-white/[0.02]";
      if (statusIcon) statusIcon.textContent = "radio_button_unchecked";
    }
  });

  const isId = currentLang === 'id';
  if (currentMode === 'android') {
    convertBtnText.textContent = isId ? "Buat Android Motion Photo (.jpg)" : "Create Android Motion Photo (.jpg)";
  } else if (currentMode === 'tiktok') {
    convertBtnText.textContent = isId ? "Buat Klip TikTok & WA Ready (.mp4)" : "Create TikTok & WA Ready Clip (.mp4)";
  } else if (currentMode === 'apple') {
    convertBtnText.textContent = isId ? "Buat iPhone Live Photo (.zip)" : "Create iPhone Live Photo (.zip)";
  } else {
    convertBtnText.textContent = isId ? "Buat Paket Lengkap (All-in-One)" : "Create All-in-One Bundle";
  }
}

// -------------------------------------------------------------
// Video Loading & Setup
// -------------------------------------------------------------
function loadVideo(file) {
  if (!file) return;

  currentVideoFile = file;
  if (currentVideoUrl) URL.revokeObjectURL(currentVideoUrl);
  currentVideoUrl = URL.createObjectURL(file);
  currentRotation = 0;
  updateRotationDisplay();

  fileNameBadge.textContent = file.name;
  sourceVideo.src = currentVideoUrl;
  sourceVideo.load();

  sourceVideo.onloadedmetadata = () => {
    const dur = sourceVideo.duration || 3.0;

    // Reset range sliders
    sliderStart.min = "0";
    sliderStart.max = dur.toString();
    sliderStart.value = "0";

    const defaultEnd = Math.min(3.0, dur);
    sliderEnd.min = "0";
    sliderEnd.max = dur.toString();
    sliderEnd.value = defaultEnd.toString();

    sliderKeyframe.min = "0";
    sliderKeyframe.max = dur.toString();
    sliderKeyframe.value = (defaultEnd / 2).toString();

    updateSliderUI();
    renderKeyframePreview(parseFloat(sliderKeyframe.value));

    // Show trimmer, hide dropzone
    dropzone.classList.add('hidden');
    trimmerPanel.classList.remove('hidden');
    resultCard.classList.add('hidden');

    sourceVideo.currentTime = 0;
  };

  sourceVideo.onerror = () => {
    alert(translations[currentLang].errorInvalidVideo);
  };
}

// Rotation Toggle Handling
function updateRotationDisplay() {
  rotateBtnText.textContent = `Putar: ${currentRotation}°`;
  if (videoTransformWrapper) {
    videoTransformWrapper.style.transform = `rotate(${currentRotation}deg)`;
  }
  if (rotationStatusBadge) {
    if (currentRotation !== 0) {
      rotationStatusBadge.classList.remove('hidden');
      rotationStatusBadge.textContent = `Rotasi ${currentRotation}° Aktif`;
    } else {
      rotationStatusBadge.classList.add('hidden');
    }
  }
  renderKeyframePreview(parseFloat(sliderKeyframe.value));
}

rotateVideoBtn.addEventListener('click', () => {
  currentRotation = (currentRotation + 90) % 360;
  updateRotationDisplay();
});

function updateSliderUI() {
  const start = parseFloat(sliderStart.value);
  let end = parseFloat(sliderEnd.value);

  if (end <= start + 0.4) {
    end = Math.min(parseFloat(sliderEnd.max), start + 0.5);
    sliderEnd.value = end.toString();
  }

  valStartTime.textContent = formatSeconds(start);
  valEndTime.textContent = formatSeconds(end);

  const duration = end - start;
  clipDurationBadge.textContent = `${translations[currentLang].videoDurationLabel} ${formatSeconds(duration)}`;

  if (duration >= 1.5 && duration <= 3.5) {
    clipDurationBadge.className = "font-mono text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold border border-emerald-500/20";
  } else {
    clipDurationBadge.className = "font-mono text-[11px] px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400 font-semibold border border-sky-500/20";
  }

  let kf = parseFloat(sliderKeyframe.value);
  if (kf < start) sliderKeyframe.value = start.toString();
  if (kf > end) sliderKeyframe.value = end.toString();
  keyframePosVal.textContent = formatSeconds(sliderKeyframe.value);
}

// Render Still Frame to Canvas with Rotation
function renderKeyframePreview(timeSec) {
  extractCoverFrame(sourceVideo, timeSec, 0.8, 320, currentRotation)
    .then(({ dataUrl, width, height }) => {
      keyframeCanvas.width = width;
      keyframeCanvas.height = height;
      const ctx = keyframeCanvas.getContext('2d');
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, width, height);
      };
      img.src = dataUrl;
      keyframeTimeDisplay.textContent = formatSeconds(timeSec);
    })
    .catch(console.error);
}

// -------------------------------------------------------------
// Playback Synchronization
// -------------------------------------------------------------
playPauseBtn.addEventListener('click', () => {
  if (sourceVideo.paused) {
    const start = parseFloat(sliderStart.value);
    if (sourceVideo.currentTime < start || sourceVideo.currentTime >= parseFloat(sliderEnd.value)) {
      sourceVideo.currentTime = start;
    }
    sourceVideo.play();
    playIcon.textContent = 'pause';
  } else {
    sourceVideo.pause();
    playIcon.textContent = 'play_arrow';
  }
});

sourceVideo.addEventListener('timeupdate', () => {
  const cur = sourceVideo.currentTime;
  currentTimecode.textContent = formatSeconds(cur);
  totalTimecode.textContent = formatSeconds(sourceVideo.duration || 0);

  const end = parseFloat(sliderEnd.value);
  if (cur >= end) {
    sourceVideo.currentTime = parseFloat(sliderStart.value);
  }
});

sourceVideo.addEventListener('ended', () => {
  playIcon.textContent = 'play_arrow';
});

// Slider Events
sliderStart.addEventListener('input', () => {
  updateSliderUI();
  sourceVideo.currentTime = parseFloat(sliderStart.value);
});

sliderEnd.addEventListener('input', () => {
  updateSliderUI();
  sourceVideo.currentTime = parseFloat(sliderEnd.value);
});

sliderKeyframe.addEventListener('input', () => {
  const time = parseFloat(sliderKeyframe.value);
  keyframePosVal.textContent = formatSeconds(time);
  renderKeyframePreview(time);
});

btnKfStart.addEventListener('click', () => {
  sliderKeyframe.value = sliderStart.value;
  sliderKeyframe.dispatchEvent(new Event('input'));
});

btnKfMid.addEventListener('click', () => {
  const mid = (parseFloat(sliderStart.value) + parseFloat(sliderEnd.value)) / 2;
  sliderKeyframe.value = mid.toFixed(2);
  sliderKeyframe.dispatchEvent(new Event('input'));
});

btnKfEnd.addEventListener('click', () => {
  sliderKeyframe.value = sliderEnd.value;
  sliderKeyframe.dispatchEvent(new Event('input'));
});

// Mode Card Radios & Click Listeners
doc.querySelectorAll('input[name="targetMode"]').forEach(radio => {
  radio.addEventListener('change', updateModeCardStyles);
});

Object.keys(modeCards).forEach(modeKey => {
  const card = modeCards[modeKey];
  if (!card) return;
  card.addEventListener('click', () => {
    const radio = card.querySelector('input[type="radio"]');
    if (radio && !radio.checked) {
      radio.checked = true;
      updateModeCardStyles();
    }
  });
});

// -------------------------------------------------------------
// Drag & Drop / File Input / Paste Listeners
// -------------------------------------------------------------
dropzone.addEventListener('click', (e) => {
  videoFileInput.click();
});

videoFileInput.addEventListener('change', (e) => {
  if (e.target.files && e.target.files[0]) {
    loadVideo(e.target.files[0]);
    videoFileInput.value = '';
  }
});

dropzone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropzone.classList.add('drag-active');
});

dropzone.addEventListener('dragleave', () => {
  dropzone.classList.remove('drag-active');
});

dropzone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropzone.classList.remove('drag-active');
  if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
    const file = e.dataTransfer.files[0];
    if (file.type.startsWith('video/') || file.name.match(/\.(mp4|mov|webm|m4v|mkv)$/i)) {
      loadVideo(file);
    } else {
      alert(translations[currentLang].errorInvalidVideo);
    }
  }
});

// Paste Clipboard
window.addEventListener('paste', (e) => {
  if (e.clipboardData && e.clipboardData.files.length > 0) {
    const file = e.clipboardData.files[0];
    if (file.type.startsWith('video/')) {
      loadVideo(file);
    }
  }
});

changeVideoBtn.addEventListener('click', () => {
  sourceVideo.pause();
  sourceVideo.src = '';
  trimmerPanel.classList.add('hidden');
  resultCard.classList.add('hidden');
  dropzone.classList.remove('hidden');
  videoFileInput.value = '';
});

resetToolBtn.addEventListener('click', () => {
  resultCard.classList.add('hidden');
  trimmerPanel.classList.remove('hidden');
});

// -------------------------------------------------------------
// Conversion Execution
// -------------------------------------------------------------
convertBtn.addEventListener('click', async () => {
  if (isConverting || !currentVideoFile) return;

  const t = translations[currentLang];
  const startTime = parseFloat(sliderStart.value);
  const endTime = parseFloat(sliderEnd.value);
  const keyframeTime = parseFloat(sliderKeyframe.value);

  if (endTime <= startTime + 0.3) {
    alert(t.errorTrimRange);
    return;
  }

  isConverting = true;
  convertBtn.disabled = true;
  progressContainer.classList.remove('hidden');
  resultCard.classList.add('hidden');

  const updateProgress = (pct, text) => {
    progressPercent.textContent = `${pct}%`;
    progressBarFill.style.width = `${pct}%`;
    if (text) progressStatusText.innerHTML = `<span class="material-symbols-outlined text-[16px] animate-spin text-sky-500">progress_activity</span> ${text}`;
  };

  try {
    const quality = parseFloat(selectQuality.value) || 0.95;
    const resVal = selectResolution.value;
    const maxDim = resVal === 'original' ? null : parseInt(resVal, 10);
    const targetMode = getSelectedMode();

    // 1. Extract Cover Photo Frame with chosen rotation
    updateProgress(15, t.stepExtractCover);
    const coverResult = await extractCoverFrame(sourceVideo, keyframeTime, quality, maxDim, currentRotation);
    updateProgress(35, t.stepClipVideo);

    // 2. Prepare & Trim Video Segment with chosen rotation & audio sync
    const videoClipBytes = await trimVideoClip(sourceVideo, startTime, endTime, currentVideoFile, currentRotation, (p) => {
      updateProgress(35 + Math.round(p * 0.35), t.stepClipVideo);
    });

    // 3. Inject Metadata
    updateProgress(80, t.stepInjectMetadata);
    const timestampUs = Math.round((keyframeTime - startTime) * 1_000_000);
    const baseName = currentVideoFile.name.replace(/\.[^/.]+$/, "");
    const dateStamp = new Date().toISOString().slice(0,10).replace(/-/g, "");

    let finalBlob = null;
    let finalFilename = '';
    let clipVideoBlob = new Blob([videoClipBytes], { type: 'video/mp4' });

    if (targetMode === 'android') {
      // Android Single-file JPEG with Dual Google XMP + Samsung SEF
      const motionBytes = createGoogleMotionPhoto(coverResult.uint8Array, videoClipBytes, timestampUs);
      finalBlob = new Blob([motionBytes], { type: 'image/jpeg' });
      finalFilename = `MOTION_${dateStamp}_${baseName}.jpg`;

      generatedResult = {
        mode: 'android',
        blob: finalBlob,
        filename: finalFilename,
        stillSize: coverResult.uint8Array.byteLength,
        videoSize: videoClipBytes.byteLength,
        totalSize: finalBlob.size,
        coverDataUrl: coverResult.dataUrl,
        clipVideoUrl: URL.createObjectURL(clipVideoBlob)
      };

    } else if (targetMode === 'tiktok') {
      // TikTok & WA Ready Standalone Looping MP4
      finalBlob = clipVideoBlob;
      finalFilename = `TIKTOK_LIVE_${dateStamp}_${baseName}.mp4`;

      generatedResult = {
        mode: 'tiktok',
        blob: finalBlob,
        filename: finalFilename,
        stillSize: coverResult.uint8Array.byteLength,
        videoSize: videoClipBytes.byteLength,
        totalSize: finalBlob.size,
        coverDataUrl: coverResult.dataUrl,
        clipVideoUrl: URL.createObjectURL(clipVideoBlob)
      };

    } else if (targetMode === 'apple') {
      // iPhone Live Photo Twin Assets in ZIP
      updateProgress(90, t.stepPackaging);
      const appleResult = createAppleLivePhoto(coverResult.uint8Array, videoClipBytes);
      
      const zip = new window.JSZip();
      zip.file(`IMG_${dateStamp}.JPG`, appleResult.photoBytes);
      zip.file(`IMG_${dateStamp}.MOV`, appleResult.videoBytes);

      const readmeText = 
        `Apple Live Photo Twin Assets\n` +
        `UUID: ${appleResult.uuid}\n\n` +
        `Cara mengimpor ke iPhone:\n` +
        `1. AirDrop: Kirim kedua file (.JPG dan .MOV) bersamaan ke iPhone.\n` +
        `2. iCloud: Buka icloud.com/photos di PC, unggah kedua file bersamaan.`;
      zip.file('README_CARA_PAKAI.txt', readmeText);

      finalBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
      finalFilename = `LIVE_PHOTO_${dateStamp}_${baseName}.zip`;

      generatedResult = {
        mode: 'apple',
        blob: finalBlob,
        filename: finalFilename,
        stillSize: coverResult.uint8Array.byteLength,
        videoSize: videoClipBytes.byteLength,
        totalSize: finalBlob.size,
        coverDataUrl: coverResult.dataUrl,
        clipVideoUrl: URL.createObjectURL(clipVideoBlob)
      };

    } else {
      // Dual Bundle
      updateProgress(90, t.stepPackaging);
      const motionBytes = createGoogleMotionPhoto(coverResult.uint8Array, videoClipBytes, timestampUs);
      const appleResult = createAppleLivePhoto(coverResult.uint8Array, videoClipBytes);

      const zip = new window.JSZip();
      // Android File
      zip.file(`MOTION_${dateStamp}_${baseName}.jpg`, motionBytes);
      // TikTok Video
      zip.file(`TIKTOK_READY_${dateStamp}_${baseName}.mp4`, videoClipBytes);
      // Apple Files
      const appleFolder = zip.folder("Apple_iOS_LivePhoto");
      appleFolder.file(`IMG_${dateStamp}.JPG`, appleResult.photoBytes);
      appleFolder.file(`IMG_${dateStamp}.MOV`, appleResult.videoBytes);

      finalBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
      finalFilename = `ALL_IN_ONE_${dateStamp}_${baseName}.zip`;

      generatedResult = {
        mode: 'dual',
        blob: finalBlob,
        filename: finalFilename,
        stillSize: coverResult.uint8Array.byteLength,
        videoSize: videoClipBytes.byteLength,
        totalSize: finalBlob.size,
        coverDataUrl: coverResult.dataUrl,
        clipVideoUrl: URL.createObjectURL(clipVideoBlob)
      };
    }

    updateProgress(100, t.resultTitle);

    // Setup Result Card
    setTimeout(() => {
      progressContainer.classList.add('hidden');
      resultCard.classList.remove('hidden');

      resStillSize.textContent = formatBytes(generatedResult.stillSize);
      resVideoSize.textContent = formatBytes(generatedResult.videoSize);
      resTotalSize.textContent = formatBytes(generatedResult.totalSize);

      downloadBtnLabel.textContent = `${t.downloadBtn} (${finalFilename})`;

      // Setup Simulator
      simStillImg.src = generatedResult.coverDataUrl;
      simMotionVideo.src = generatedResult.clipVideoUrl;
      simStillImg.classList.remove('hidden');
      simMotionVideo.classList.add('hidden');

      resultCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 400);

  } catch (err) {
    console.error(err);
    alert("Error during conversion: " + err.message);
    progressContainer.classList.add('hidden');
  } finally {
    isConverting = false;
    convertBtn.disabled = false;
  }
});

// -------------------------------------------------------------
// Interactive Motion Photo Simulator (Press & Hold / Hover)
// -------------------------------------------------------------
function startMotionPlayback() {
  if (!simMotionVideo.src) return;
  simStillImg.classList.add('hidden');
  simMotionVideo.classList.remove('hidden');
  simMotionVideo.currentTime = 0;
  simMotionVideo.play().catch(() => {});
}

function stopMotionPlayback() {
  if (!simMotionVideo.src) return;
  simMotionVideo.pause();
  simMotionVideo.classList.add('hidden');
  simStillImg.classList.remove('hidden');
}

// Mouse events
simulatorBox.addEventListener('mouseenter', startMotionPlayback);
simulatorBox.addEventListener('mouseleave', stopMotionPlayback);

// Touch events for mobile
simulatorBox.addEventListener('touchstart', (e) => {
  e.preventDefault();
  startMotionPlayback();
});
simulatorBox.addEventListener('touchend', stopMotionPlayback);

// -------------------------------------------------------------
// Download Trigger
// -------------------------------------------------------------
downloadResultBtn.addEventListener('click', () => {
  if (!generatedResult.blob) return;

  const a = document.createElement('a');
  const url = URL.createObjectURL(generatedResult.blob);
  a.href = url;
  a.download = generatedResult.filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 4000);
});

// -------------------------------------------------------------
// Fun Facts Rotator
// -------------------------------------------------------------
function displayFunFact(index) {
  const facts = funFactsData[currentLang] || funFactsData['id'];
  currentFactIndex = ((index % facts.length) + facts.length) % facts.length;

  funfactText.classList.add('slide-out');
  setTimeout(() => {
    funfactText.textContent = facts[currentFactIndex];
    funfactCounter.textContent = `${currentFactIndex + 1}/${facts.length}`;
    funfactText.classList.remove('slide-out');
    funfactText.classList.add('slide-in');
  }, 200);
}

function startFactRotation() {
  if (factInterval) clearInterval(factInterval);
  factInterval = setInterval(() => {
    displayFunFact(currentFactIndex + 1);
  }, 10000);
}

factPrevBtn.addEventListener('click', () => {
  displayFunFact(currentFactIndex - 1);
  startFactRotation();
});

factNextBtn.addEventListener('click', () => {
  displayFunFact(currentFactIndex + 1);
  startFactRotation();
});

// -------------------------------------------------------------
// Language & Theme Management
// -------------------------------------------------------------
const langToggleBtn = doc.getElementById('lang-toggle-btn');
const langMenu = doc.getElementById('lang-menu');
const currentFlag = doc.getElementById('current-flag');
const currentLangCode = doc.getElementById('current-lang-code');

langToggleBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  langMenu.classList.toggle('hidden');
});

doc.addEventListener('click', () => {
  langMenu.classList.add('hidden');
});

langMenu.querySelectorAll('button[data-lang]').forEach(btn => {
  btn.addEventListener('click', () => {
    const lang = btn.getAttribute('data-lang');
    switchLanguage(lang);
  });
});

function switchLanguage(lang) {
  currentLang = lang;
  localStorage.setItem('motion_lang', lang);

  currentFlag.textContent = lang === 'id' ? '🇮🇩' : '🇬🇧';
  currentLangCode.textContent = lang.toUpperCase();

  const t = translations[lang] || translations['id'];
  
  doc.getElementById('app-title').textContent = t.appTitle;
  doc.getElementById('target-mode-label').textContent = t.modeLabel;
  doc.getElementById('drop-text-title').textContent = t.dropTitle;
  doc.getElementById('drop-browse-btn').textContent = t.dropBrowse;
  doc.getElementById('drop-supported').textContent = t.dropSupported;
  doc.getElementById('drop-paste').innerHTML = `${t.dropPasteHint} (<kbd class="px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 text-[10px]">Ctrl + V</kbd>)`;
  
  doc.getElementById('trimmer-title').textContent = t.trimmerTitle;
  doc.getElementById('lbl-start-time').textContent = t.startTimeLabel;
  doc.getElementById('lbl-end-time').textContent = t.endTimeLabel;
  doc.getElementById('lbl-keyframe-title').textContent = t.keyframeSectionTitle;
  doc.getElementById('lbl-keyframe-hint').textContent = t.keyframeHint;
  btnKfStart.textContent = t.keyframeStartBtn;
  btnKfMid.textContent = t.keyframeMidBtn;
  btnKfEnd.textContent = t.keyframeEndBtn;

  doc.getElementById('lbl-quality').textContent = t.qualityLabel;
  doc.getElementById('lbl-resolution').textContent = t.resolutionLabel;

  doc.getElementById('result-card-title').textContent = t.resultTitle;
  doc.getElementById('guide-card-title').textContent = t.guideTitle;
  doc.getElementById('funfact-header').textContent = t.funFactTitle;

  updateModeCardStyles();
  displayFunFact(currentFactIndex);
}

// Dark/Light Mode Theme Toggle
const themeToggle = doc.getElementById('theme-toggle');
themeToggle.addEventListener('click', () => {
  const isDark = doc.documentElement.classList.toggle('dark');
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
});

// Initialize
updateModeCardStyles();
displayFunFact(0);
startFactRotation();
