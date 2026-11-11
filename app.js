/**
 * app.js — v4.0 Controller
 * Mobile-first Android Material 3 interface
 * 100% Client-side Motion Photo / Live Photo engine
 */

import { 
  createGoogleMotionPhoto, 
  extractCoverFrame, 
  trimVideoClip 
} from './motionEngine.js?v=4.0';

// Global State
let currentVideoFile = null;
let currentVideoUrl = null;
let currentRotation = 0; // 0, 90, 180, 270
let isConverting = false;
let snackbarTimeout = null;

// Converted Result State
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
const pickBtn = doc.getElementById('pick-btn');
const dropzone = doc.getElementById('dropzone');
const trimmerPanel = doc.getElementById('trimmer-panel');
const actionBar = doc.getElementById('action-bar');
const previewBox = doc.getElementById('preview-box');
const sourceVideo = doc.getElementById('source-video');
const rotateVideoBtn = doc.getElementById('rotate-video-btn');
const rotateBtnText = doc.getElementById('rotate-btn-text');

const playPauseBtn = doc.getElementById('play-pause-btn');
const playIcon = doc.getElementById('play-icon');
const currentTimecode = doc.getElementById('current-timecode');
const totalTimecode = doc.getElementById('total-timecode');
const fileNameBadge = doc.getElementById('file-name-badge');
const changeVideoBtn = doc.getElementById('change-video-btn');

// Mode Selection
const cardModeAndroid = doc.getElementById('card-mode-android');
const cardModeTiktok = doc.getElementById('card-mode-tiktok');
const modeHint = doc.getElementById('mode-hint');

// Sliders & Values
const sliderStart = doc.getElementById('slider-start');
const sliderEnd = doc.getElementById('slider-end');
const valStartTime = doc.getElementById('val-start-time');
const valEndTime = doc.getElementById('val-end-time');
const clipDurationBadge = doc.getElementById('clip-duration-badge');

const sliderKeyframe = doc.getElementById('slider-keyframe');
const keyframePosVal = doc.getElementById('keyframe-pos-val');
const keyframeCanvas = doc.getElementById('keyframe-canvas');
const btnKfStart = doc.getElementById('btn-kf-start');
const btnKfMid = doc.getElementById('btn-kf-mid');
const btnKfEnd = doc.getElementById('btn-kf-end');

const convertBtn = doc.getElementById('convert-btn');
const convertBtnText = doc.getElementById('convert-btn-text');
const progressContainer = doc.getElementById('progress-container');
const progressStatusText = doc.getElementById('progress-status-text');
const progressPercent = doc.getElementById('progress-percent');
const progressBarFill = doc.getElementById('progress-bar-fill');

// Result Sheet
const sheetScrim = doc.getElementById('sheet-scrim');
const resultCard = doc.getElementById('result-card');
const sheetCloseBtn = doc.getElementById('sheet-close-btn');
const simulatorBox = doc.getElementById('simulator-box');
const simStillImg = doc.getElementById('sim-still-img');
const simMotionVideo = doc.getElementById('sim-motion-video');
const resultTitle = doc.getElementById('result-title');
const resTotalSize = doc.getElementById('res-total-size');
const downloadResultBtn = doc.getElementById('download-result-btn');
const downloadBtnLabel = doc.getElementById('download-btn-label');
const shareResultBtn = doc.getElementById('share-result-btn');
const resetToolBtn = doc.getElementById('reset-tool-btn');
const sheetNote = doc.getElementById('sheet-note');
const snackbar = doc.getElementById('snackbar');

// Theme Elements
const themeToggle = doc.getElementById('theme-toggle');
const themeIcon = doc.getElementById('theme-icon');

// -------------------------------------------------------------
// Helpers
// -------------------------------------------------------------
function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatSeconds(secs) {
  return (parseFloat(secs) || 0).toFixed(1) + 's';
}

function showSnackbar(msg, dur = 3200) {
  if (!snackbar) return;
  snackbar.textContent = msg;
  snackbar.classList.add('show');
  clearTimeout(snackbarTimeout);
  snackbarTimeout = setTimeout(() => {
    snackbar.classList.remove('show');
  }, dur);
}

function updateSliderProgress(slider) {
  if (!slider) return;
  const min = parseFloat(slider.min || '0');
  const max = parseFloat(slider.max || '100');
  const val = parseFloat(slider.value || '0');
  const pct = max > min ? Math.max(0, Math.min(100, ((val - min) / (max - min)) * 100)) : 0;
  slider.style.setProperty('--p', pct.toFixed(1) + '%');
}

function getSelectedMode() {
  const checked = doc.querySelector('input[name="targetMode"]:checked');
  return checked ? checked.value : 'android';
}

function updateModeUI() {
  const mode = getSelectedMode();
  if (cardModeAndroid) cardModeAndroid.classList.toggle('active', mode === 'android');
  if (cardModeTiktok) cardModeTiktok.classList.toggle('active', mode === 'tiktok');

  if (mode === 'android') {
    if (modeHint) modeHint.textContent = '1 file .jpg yang bergerak di Galeri Samsung, Google Photos & TikTok (Mode Foto → LIVE).';
    if (convertBtnText) convertBtnText.textContent = 'Buat Live Photo (.jpg)';
  } else {
    if (modeHint) modeHint.textContent = 'Klip video looping (.mp4) mulus untuk TikTok & status WhatsApp.';
    if (convertBtnText) convertBtnText.textContent = 'Buat Video MP4 (.mp4)';
  }
}

// -------------------------------------------------------------
// Video Loading
// -------------------------------------------------------------
function loadVideo(file) {
  if (!file) return;

  currentVideoFile = file;
  if (currentVideoUrl) URL.revokeObjectURL(currentVideoUrl);
  currentVideoUrl = URL.createObjectURL(file);
  currentRotation = 0;
  updateRotation();

  if (fileNameBadge) fileNameBadge.textContent = file.name;
  sourceVideo.src = currentVideoUrl;
  sourceVideo.muted = true;
  sourceVideo.playsInline = true;
  sourceVideo.load();

  sourceVideo.onloadedmetadata = () => {
    const dur = Math.max(0.5, sourceVideo.duration || 3.0);

    sliderStart.min = "0";
    sliderStart.max = dur.toFixed(2);
    sliderStart.value = "0";

    const defaultEnd = Math.min(2.5, dur);
    sliderEnd.min = "0";
    sliderEnd.max = dur.toFixed(2);
    sliderEnd.value = defaultEnd.toFixed(2);

    sliderKeyframe.min = "0";
    sliderKeyframe.max = dur.toFixed(2);
    sliderKeyframe.value = "0";

    updateSliderUI();
    renderKeyframePreview(0);

    dropzone?.classList.add('hidden');
    trimmerPanel?.classList.remove('hidden');
    actionBar?.classList.remove('hidden');
    closeSheet();

    sourceVideo.currentTime = 0;
  };

  sourceVideo.onerror = () => {
    showSnackbar("Video tidak dapat diputar. Coba pilih file MP4 standar.");
  };
}

// -------------------------------------------------------------
// Rotation & Timeline
// -------------------------------------------------------------
function updateRotation() {
  if (rotateBtnText) rotateBtnText.textContent = `${currentRotation}°`;
  if (sourceVideo) {
    sourceVideo.style.transform = `rotate(${currentRotation}deg)`;
  }
  const kf = sliderKeyframe ? parseFloat(sliderKeyframe.value) : 0;
  renderKeyframePreview(kf);
}

rotateVideoBtn?.addEventListener('click', (e) => {
  e.stopPropagation();
  currentRotation = (currentRotation + 90) % 360;
  updateRotation();
});

function updateSliderUI() {
  const start = parseFloat(sliderStart.value || '0');
  let end = parseFloat(sliderEnd.value || '2.5');

  // Enforce minimal 0.5s duration
  if (end < start + 0.5) {
    end = Math.min(parseFloat(sliderEnd.max), start + 0.5);
    sliderEnd.value = end.toFixed(2);
  }

  if (valStartTime) valStartTime.textContent = formatSeconds(start);
  if (valEndTime) valEndTime.textContent = formatSeconds(end);

  const duration = Math.max(0.5, end - start);
  if (clipDurationBadge) clipDurationBadge.textContent = formatSeconds(duration);

  let kf = parseFloat(sliderKeyframe.value || '0');
  if (kf < start) {
    sliderKeyframe.value = start.toFixed(2);
    kf = start;
  }
  if (kf > end) {
    sliderKeyframe.value = end.toFixed(2);
    kf = end;
  }
  if (keyframePosVal) keyframePosVal.textContent = formatSeconds(kf);

  updateSliderProgress(sliderStart);
  updateSliderProgress(sliderEnd);
  updateSliderProgress(sliderKeyframe);

  // Update preset chip highlights
  doc.querySelectorAll('.dur-preset-btn').forEach(btn => {
    const d = parseFloat(btn.getAttribute('data-dur'));
    btn.classList.toggle('active', Math.abs(duration - d) < 0.15);
  });
}

// Duration Preset Chips (1.5s, 2s, 2.5s, 3s)
doc.querySelectorAll('.dur-preset-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const dur = parseFloat(btn.getAttribute('data-dur'));
    const start = parseFloat(sliderStart.value || '0');
    const maxDur = parseFloat(sliderEnd.max || '10');

    let newEnd = start + dur;
    if (newEnd > maxDur) {
      newEnd = maxDur;
    }
    sliderEnd.value = newEnd.toFixed(2);
    updateSliderUI();
    sourceVideo.currentTime = start;
  });
});

// Render Still Frame to Canvas
function renderKeyframePreview(timeSec) {
  if (!sourceVideo || !keyframeCanvas) return;
  extractCoverFrame(sourceVideo, timeSec, 0.85, 200, currentRotation)
    .then(({ dataUrl, width, height }) => {
      keyframeCanvas.width = width;
      keyframeCanvas.height = height;
      const ctx = keyframeCanvas.getContext('2d');
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
      };
      img.src = dataUrl;
    })
    .catch((err) => {
      console.warn("Cover preview error:", err);
    });
}

// Keyframe quick buttons
btnKfStart?.addEventListener('click', () => {
  sliderKeyframe.value = sliderStart.value;
  sliderKeyframe.dispatchEvent(new Event('input'));
});

btnKfMid?.addEventListener('click', () => {
  const mid = (parseFloat(sliderStart.value) + parseFloat(sliderEnd.value)) / 2;
  sliderKeyframe.value = mid.toFixed(2);
  sliderKeyframe.dispatchEvent(new Event('input'));
});

btnKfEnd?.addEventListener('click', () => {
  sliderKeyframe.value = sliderEnd.value;
  sliderKeyframe.dispatchEvent(new Event('input'));
});

// Slider Input Handlers
sliderStart?.addEventListener('input', () => {
  updateSliderUI();
  sourceVideo.currentTime = parseFloat(sliderStart.value);
});

sliderEnd?.addEventListener('input', () => {
  updateSliderUI();
  sourceVideo.currentTime = parseFloat(sliderEnd.value);
});

sliderKeyframe?.addEventListener('input', () => {
  const time = parseFloat(sliderKeyframe.value);
  if (keyframePosVal) keyframePosVal.textContent = formatSeconds(time);
  updateSliderProgress(sliderKeyframe);
  renderKeyframePreview(time);
});

// Play / Pause Video Controller
function togglePlayPause() {
  if (!sourceVideo) return;
  if (sourceVideo.paused) {
    const start = parseFloat(sliderStart.value || '0');
    const end = parseFloat(sliderEnd.value || '2.5');
    if (sourceVideo.currentTime < start || sourceVideo.currentTime >= end) {
      sourceVideo.currentTime = start;
    }
    sourceVideo.play().then(() => {
      previewBox?.classList.add('playing');
      if (playIcon) playIcon.textContent = 'pause';
    }).catch(() => {});
  } else {
    sourceVideo.pause();
    previewBox?.classList.remove('playing');
    if (playIcon) playIcon.textContent = 'play_arrow';
  }
}

playPauseBtn?.addEventListener('click', (e) => {
  e.stopPropagation();
  togglePlayPause();
});

previewBox?.addEventListener('click', (e) => {
  if (e.target.closest('button')) return;
  togglePlayPause();
});

sourceVideo?.addEventListener('timeupdate', () => {
  const cur = sourceVideo.currentTime;
  if (currentTimecode) currentTimecode.textContent = formatSeconds(cur);
  if (totalTimecode) totalTimecode.textContent = formatSeconds(sourceVideo.duration || 0);

  const start = parseFloat(sliderStart.value || '0');
  const end = parseFloat(sliderEnd.value || '2.5');
  if (cur >= end) {
    sourceVideo.currentTime = start;
  }
});

sourceVideo?.addEventListener('ended', () => {
  previewBox?.classList.remove('playing');
  if (playIcon) playIcon.textContent = 'play_arrow';
});

// Mode Radios
doc.querySelectorAll('input[name="targetMode"]').forEach(radio => {
  radio.addEventListener('change', updateModeUI);
});

// File Chooser Triggers
pickBtn?.addEventListener('click', () => videoFileInput?.click());
dropzone?.addEventListener('click', (e) => {
  if (e.target !== pickBtn) videoFileInput?.click();
});

videoFileInput?.addEventListener('change', (e) => {
  if (e.target.files && e.target.files[0]) {
    loadVideo(e.target.files[0]);
    videoFileInput.value = '';
  }
});

changeVideoBtn?.addEventListener('click', (e) => {
  e.stopPropagation();
  if (sourceVideo) {
    sourceVideo.pause();
    sourceVideo.src = '';
  }
  trimmerPanel?.classList.add('hidden');
  actionBar?.classList.add('hidden');
  closeSheet();
  dropzone?.classList.remove('hidden');
  videoFileInput.value = '';
});

// -------------------------------------------------------------
// Bottom Sheet Management
// -------------------------------------------------------------
function openSheet() {
  sheetScrim?.classList.add('open');
  resultCard?.classList.add('open');
  resultCard?.setAttribute('aria-hidden', 'false');
}

function closeSheet() {
  sheetScrim?.classList.remove('open');
  resultCard?.classList.remove('open');
  resultCard?.setAttribute('aria-hidden', 'true');
  stopMotionPlayback();
}

sheetScrim?.addEventListener('click', closeSheet);
sheetCloseBtn?.addEventListener('click', closeSheet);
resetToolBtn?.addEventListener('click', closeSheet);

// -------------------------------------------------------------
// Conversion Execution
// -------------------------------------------------------------
convertBtn?.addEventListener('click', async () => {
  if (isConverting || !currentVideoFile) return;

  const startTime = sliderStart ? parseFloat(sliderStart.value || '0') : 0;
  const endTime = sliderEnd ? parseFloat(sliderEnd.value || '2.5') : 2.5;
  const keyframeTime = sliderKeyframe ? parseFloat(sliderKeyframe.value || '0') : 0;
  const duration = Math.max(0.5, endTime - startTime);

  isConverting = true;
  convertBtn.disabled = true;
  progressContainer?.classList.remove('hidden');
  closeSheet();
  sourceVideo.pause();
  previewBox?.classList.remove('playing');
  if (playIcon) playIcon.textContent = 'play_arrow';

  // Free previous conversion memory
  if (generatedResult.clipVideoUrl) {
    try { URL.revokeObjectURL(generatedResult.clipVideoUrl); } catch (_) {}
    generatedResult.clipVideoUrl = '';
  }

  const updateProgress = (pct, text) => {
    if (progressPercent) progressPercent.textContent = `${pct}%`;
    if (progressBarFill) progressBarFill.style.width = `${pct}%`;
    if (progressStatusText && text) progressStatusText.textContent = text;
  };

  try {
    const targetMode = getSelectedMode();

    // 1. Extract Cover Photo Frame (720p / 1280 max for mobile balance)
    updateProgress(15, "1/3. Mengekstrak frame foto utama...");
    const coverResult = await extractCoverFrame(sourceVideo, keyframeTime, 0.90, 1280, currentRotation);

    // 2. Prepare & Trim Video Segment (Smooth 30fps FastStart H.264)
    updateProgress(35, `2/3. Memproses klip video (${duration.toFixed(1)}s)...`);
    const videoClipBytes = await trimVideoClip(
      sourceVideo,
      startTime,
      endTime,
      currentVideoFile,
      currentRotation,
      (p) => {
        const mapped = 35 + Math.round(p * 0.50);
        updateProgress(mapped, `2/3. Mengode frame video (${Math.round(p)}%)...`);
      }
    );

    // 3. Inject Metadata
    updateProgress(88, "3/3. Menggabungkan file & metadata...");
    const timestampUs = Math.round((keyframeTime - startTime) * 1_000_000);
    const baseName = currentVideoFile.name.replace(/\.[^/.]+$/, "");
    const dateStamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");

    let finalBlob = null;
    let finalFilename = '';
    const clipVideoBlob = new Blob([videoClipBytes], { type: 'video/mp4' });

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

      if (resultTitle) resultTitle.textContent = "Live Photo Siap!";
      if (downloadBtnLabel) downloadBtnLabel.textContent = `Simpan Live Photo (.jpg)`;
      if (sheetNote) sheetNote.textContent = 'Simpan file ke galeri. Buka di Galeri Android / Google Photos untuk melihat gerakan, atau unggah ke TikTok (Mode Foto) dan aktifkan ikon LIVE.';

    } else {
      // Looping MP4 Video
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

      if (resultTitle) resultTitle.textContent = "Video TikTok Siap!";
      if (downloadBtnLabel) downloadBtnLabel.textContent = `Simpan Video (.mp4)`;
      if (sheetNote) sheetNote.textContent = 'Klip video MP4 looping siap diunggah langsung ke TikTok atau status WhatsApp.';
    }

    updateProgress(100, "Selesai!");

    // Display Result Bottom Sheet
    setTimeout(() => {
      progressContainer?.classList.add('hidden');

      if (resTotalSize) {
        resTotalSize.textContent = `${formatBytes(generatedResult.totalSize)} • ${duration.toFixed(1)}s • 30fps`;
      }

      if (simStillImg) simStillImg.src = generatedResult.coverDataUrl;
      if (simMotionVideo) {
        simMotionVideo.src = generatedResult.clipVideoUrl;
        simMotionVideo.load();
      }

      simStillImg?.classList.remove('hidden');
      simMotionVideo?.classList.add('hidden');

      openSheet();
    }, 250);

  } catch (err) {
    console.error("Conversion error:", err);
    showSnackbar("Gagal memproses video: " + (err.message || err));
    progressContainer?.classList.add('hidden');
  } finally {
    isConverting = false;
    convertBtn.disabled = false;
  }
});

// -------------------------------------------------------------
// Interactive Motion Photo Simulator (Touch & Hold)
// -------------------------------------------------------------
function startMotionPlayback() {
  if (!simMotionVideo || !simMotionVideo.src) return;
  simulatorBox?.classList.add('playing');
  simStillImg?.classList.add('hidden');
  simMotionVideo.classList.remove('hidden');
  simMotionVideo.currentTime = 0;
  simMotionVideo.play().catch(() => {});
}

function stopMotionPlayback() {
  if (!simMotionVideo || !simMotionVideo.src) return;
  simulatorBox?.classList.remove('playing');
  simMotionVideo.pause();
  simMotionVideo.classList.add('hidden');
  simStillImg?.classList.remove('hidden');
}

simulatorBox?.addEventListener('mouseenter', startMotionPlayback);
simulatorBox?.addEventListener('mouseleave', stopMotionPlayback);
simulatorBox?.addEventListener('touchstart', (e) => {
  e.preventDefault();
  startMotionPlayback();
}, { passive: false });
simulatorBox?.addEventListener('touchend', stopMotionPlayback);
simulatorBox?.addEventListener('touchcancel', stopMotionPlayback);

// -------------------------------------------------------------
// Download & Share Actions
// -------------------------------------------------------------
function downloadFile() {
  if (!generatedResult.blob) return;

  const a = document.createElement('a');
  const url = URL.createObjectURL(generatedResult.blob);
  a.href = url;
  a.download = generatedResult.filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  showSnackbar(`Tersimpan: ${generatedResult.filename}`);
}

downloadResultBtn?.addEventListener('click', downloadFile);

shareResultBtn?.addEventListener('click', async () => {
  if (!generatedResult.blob) return;

  try {
    const file = new File([generatedResult.blob], generatedResult.filename, {
      type: generatedResult.blob.type,
      lastModified: Date.now()
    });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: generatedResult.filename,
        text: 'Live Photo dibuat dengan Motion Photo Converter'
      });
      return;
    }
  } catch (err) {
    if (err.name !== 'AbortError') {
      console.warn("Share failed, falling back to download:", err);
    } else {
      return;
    }
  }

  // Fallback to download if Web Share API is unavailable
  downloadFile();
});

// -------------------------------------------------------------
// Theme Management
// -------------------------------------------------------------
function updateThemeIcon() {
  const isDark = doc.documentElement.classList.contains('dark');
  if (themeIcon) {
    themeIcon.textContent = isDark ? 'light_mode' : 'dark_mode';
  }
}

themeToggle?.addEventListener('click', () => {
  const isDark = doc.documentElement.classList.toggle('dark');
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
  updateThemeIcon();
});

// Appbar scroll elevation
window.addEventListener('scroll', () => {
  const appbar = doc.getElementById('appbar');
  if (appbar) {
    appbar.classList.toggle('scrolled', window.scrollY > 8);
  }
}, { passive: true });

// Initialize UI
updateModeUI();
updateThemeIcon();
