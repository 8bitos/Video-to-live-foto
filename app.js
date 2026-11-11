/**
 * app.js - Mobile-Optimized Controller for Android & TikTok
 * 100% Client-Side Universal Converter
 */

import { translations } from './i18n.js?v=3.2';
import { 
  createGoogleMotionPhoto, 
  createAppleLivePhoto, 
  extractCoverFrame, 
  trimVideoClip 
} from './motionEngine.js?v=3.2';

// Global State
let currentLang = 'id';
let currentVideoFile = null;
let currentVideoUrl = null;
let currentRotation = 0; // 0, 90, 180, 270
let isConverting = false;

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
const resTotalSize = doc.getElementById('res-total-size');
const downloadResultBtn = doc.getElementById('download-result-btn');
const downloadBtnLabel = doc.getElementById('download-btn-label');
const resetToolBtn = doc.getElementById('reset-tool-btn');

// Mode Selection Cards
const modeCards = {
  android: doc.getElementById('card-mode-android'),
  tiktok: doc.getElementById('card-mode-tiktok')
};

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

// Mode Selection Highlighting
function updateModeCardStyles() {
  const currentMode = getSelectedMode();
  Object.keys(modeCards).forEach(modeKey => {
    const card = modeCards[modeKey];
    if (!card) return;

    if (modeKey === currentMode) {
      card.className = "cursor-pointer flex items-center gap-2 p-2.5 rounded-xl border-2 border-sky-500 bg-sky-500/10 dark:bg-sky-500/20 transition-all";
    } else {
      card.className = "cursor-pointer flex items-center gap-2 p-2.5 rounded-xl border border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02] transition-all";
    }
  });

  if (currentMode === 'android') {
    convertBtnText.textContent = "Buat Android Motion Photo (.jpg)";
  } else {
    convertBtnText.textContent = "Buat TikTok Loop Video (.mp4)";
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
  sourceVideo.muted = true;
  sourceVideo.playsInline = true;
  sourceVideo.load();

  sourceVideo.onloadedmetadata = () => {
    const dur = sourceVideo.duration || 3.0;

    sliderStart.min = "0";
    sliderStart.max = dur.toString();
    sliderStart.value = "0";

    const defaultEnd = Math.min(2.5, dur);
    sliderEnd.min = "0";
    sliderEnd.max = dur.toString();
    sliderEnd.value = defaultEnd.toString();

    sliderKeyframe.min = "0";
    sliderKeyframe.max = dur.toString();
    sliderKeyframe.value = "0";

    updateSliderUI();
    renderKeyframePreview(0);

    dropzone.classList.add('hidden');
    trimmerPanel.classList.remove('hidden');
    resultCard.classList.add('hidden');

    sourceVideo.currentTime = 0;
  };

  sourceVideo.onerror = () => {
    alert("Format video tidak dapat diputar di browser ini. Coba gunakan video MP4.");
  };
}

// Quick Rotation Button (0°, 90°, 180°, 270°)
function updateRotationDisplay() {
  rotateBtnText.textContent = `Putar: ${currentRotation}°`;
  if (videoTransformWrapper) {
    videoTransformWrapper.style.transform = `rotate(${currentRotation}deg)`;
  }
  renderKeyframePreview(parseFloat(sliderKeyframe.value));
}

rotateVideoBtn.addEventListener('click', () => {
  currentRotation = (currentRotation + 90) % 360;
  updateRotationDisplay();
});

// Duration Presets (1.5s, 2.0s, 2.5s, 3.0s)
doc.querySelectorAll('.dur-preset-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const dur = parseFloat(btn.getAttribute('data-dur'));
    const start = parseFloat(sliderStart.value);
    const maxDur = parseFloat(sliderEnd.max);
    
    let newEnd = start + dur;
    if (newEnd > maxDur) {
      newEnd = maxDur;
    }
    sliderEnd.value = newEnd.toFixed(2);
    updateSliderUI();

    doc.querySelectorAll('.dur-preset-btn').forEach(b => {
      b.className = "dur-preset-btn py-1.5 rounded-lg text-xs font-bold border border-black/10 dark:border-white/10 text-slate-700 dark:text-slate-300";
    });
    btn.className = "dur-preset-btn py-1.5 rounded-lg text-xs font-bold border-2 border-sky-500 bg-sky-500/10 text-sky-600 dark:text-sky-400";
  });
});

function updateSliderUI() {
  const start = parseFloat(sliderStart.value);
  let end = parseFloat(sliderEnd.value);

  if (end <= start + 0.5) {
    end = Math.min(parseFloat(sliderEnd.max), start + 0.8);
    sliderEnd.value = end.toString();
  }

  valStartTime.textContent = formatSeconds(start);
  valEndTime.textContent = formatSeconds(end);

  const duration = end - start;
  clipDurationBadge.textContent = `Durasi: ${formatSeconds(duration)}`;

  let kf = parseFloat(sliderKeyframe.value);
  if (kf < start) sliderKeyframe.value = start.toString();
  if (kf > end) sliderKeyframe.value = end.toString();
  keyframePosVal.textContent = formatSeconds(sliderKeyframe.value);
}

// Render Still Frame to Canvas with Rotation
function renderKeyframePreview(timeSec) {
  extractCoverFrame(sourceVideo, timeSec, 0.85, 240, currentRotation)
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
    sourceVideo.play().catch(() => {});
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
// Drag & Drop / File Input Listeners
// -------------------------------------------------------------
dropzone.addEventListener('click', () => {
  videoFileInput.click();
});

videoFileInput.addEventListener('change', (e) => {
  if (e.target.files && e.target.files[0]) {
    loadVideo(e.target.files[0]);
    videoFileInput.value = '';
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
convertBtn?.addEventListener('click', async () => {
  if (isConverting || !currentVideoFile) return;

  const startTime = sliderStart ? parseFloat(sliderStart.value || '0') : 0;
  const endTime = sliderEnd ? parseFloat(sliderEnd.value || '2.5') : 2.5;
  const keyframeTime = sliderKeyframe ? parseFloat(sliderKeyframe.value || '0') : 0;
  const duration = Math.max(0.6, endTime - startTime);

  if (duration < 0.6) {
    alert("Durasi klip minimal 0.8 detik.");
    return;
  }

  isConverting = true;
  convertBtn.disabled = true;
  progressContainer.classList.remove('hidden');
  resultCard.classList.add('hidden');
  sourceVideo.pause();

  // Free previous conversion memory
  if (generatedResult.clipVideoUrl) {
    try { URL.revokeObjectURL(generatedResult.clipVideoUrl); } catch (_) {}
    generatedResult.clipVideoUrl = '';
  }

  const updateProgress = (pct, text) => {
    progressPercent.textContent = `${pct}%`;
    progressBarFill.style.width = `${pct}%`;
    if (text) progressStatusText.innerHTML = `<span class="material-symbols-outlined text-[16px] animate-spin text-sky-500">progress_activity</span> ${text}`;
  };

  try {
    const targetMode = getSelectedMode();

    // 1. Extract Cover Photo Frame (720p / 1280 max for mobile performance)
    updateProgress(15, "1/3. Mengekstrak frame foto utama...");
    const coverResult = await extractCoverFrame(sourceVideo, keyframeTime, 0.90, 1280, currentRotation);
    
    // 2. Prepare & Trim Video Segment (Smooth 30fps H.264)
    updateProgress(35, `2/3. Memproses klip video (${duration.toFixed(1)}s)...`);
    const videoClipBytes = await trimVideoClip(sourceVideo, startTime, endTime, currentVideoFile, currentRotation, (p) => {
      updateProgress(35 + Math.round(p * 0.50), `2/3. Memproses frame (${Math.round(p)}%)...`);
    });

    // 3. Inject Metadata
    updateProgress(90, "3/3. Menggabungkan file & metadata...");
    const timestampUs = Math.round((keyframeTime - startTime) * 1_000_000);
    const baseName = currentVideoFile.name.replace(/\.[^/.]+$/, "");
    const dateStamp = new Date().toISOString().slice(0,10).replace(/-/g, "");

    let finalBlob = null;
    let finalFilename = '';
    let clipVideoBlob = new Blob([videoClipBytes], { type: 'video/mp4' });

    if (targetMode === 'android') {
      // Android Motion Photo (.jpg) with MP4 at exact physical EOF
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

    } else {
      // TikTok Ready Looping MP4 Video
      finalBlob = clipVideoBlob;
      finalFilename = `TIKTOK_${dateStamp}_${baseName}.mp4`;

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
    }

    updateProgress(100, "Selesai!");

    setTimeout(() => {
      progressContainer.classList.add('hidden');
      resultCard.classList.remove('hidden');

      resTotalSize.textContent = `${formatBytes(generatedResult.totalSize)} • ${duration.toFixed(1)} detik`;
      downloadBtnLabel.textContent = `Unduh (${finalFilename})`;

      simStillImg.src = generatedResult.coverDataUrl;
      simMotionVideo.src = generatedResult.clipVideoUrl;
      simStillImg.classList.remove('hidden');
      simMotionVideo.classList.add('hidden');

      resultCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 300);

  } catch (err) {
    console.error(err);
    alert("Gagal memproses video: " + err.message);
    progressContainer.classList.add('hidden');
  } finally {
    isConverting = false;
    convertBtn.disabled = false;
  }
});

// -------------------------------------------------------------
// Interactive Motion Photo Simulator (Touch & Hold for Mobile)
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

// Mouse & Touch events
simulatorBox.addEventListener('mouseenter', startMotionPlayback);
simulatorBox.addEventListener('mouseleave', stopMotionPlayback);
simulatorBox.addEventListener('touchstart', (e) => {
  e.preventDefault();
  startMotionPlayback();
}, { passive: false });
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

// Theme Toggle
const themeToggle = doc.getElementById('theme-toggle');
themeToggle.addEventListener('click', () => {
  const isDark = doc.documentElement.classList.toggle('dark');
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
});

// Init
updateModeCardStyles();
