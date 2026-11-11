/**
 * app.js — v4.3 Controller
 * Mobile-first Android Material 3 interface
 * Multi-language (8 languages) & Cover Studio & Aspect Ratio / Cropping
 */

import { translations, languageList } from './i18n.js?v=4.3';
import { 
  createGoogleMotionPhoto, 
  extractCoverFrame, 
  processCustomCoverImage,
  trimVideoClip 
} from './motionEngine.js?v=4.3';

const FPS = 30;
const FRAME_STEP = 1 / FPS; // ~0.0333s

// Global State
let currentLang = localStorage.getItem('motion_lang') || (navigator.language.startsWith('id') ? 'id' : 'en');
if (!translations[currentLang]) currentLang = 'en';

let currentVideoFile = null;
let currentVideoUrl = null;
let currentRotation = 0; // 0, 90, 180, 270
let currentAspectRatio = 'original'; // 'original' | '9:16' | '1:1' | '4:5' | '16:9'
let isConverting = false;
let snackbarTimeout = null;

// Custom Cover State
let customCoverState = null; // { blob, uint8Array, width, height, dataUrl, rawFile, active: true }
let currentCoverDataUrl = '';

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
const previewViewport = doc.getElementById('preview-viewport');
const sourceVideo = doc.getElementById('source-video');
const rotateVideoBtn = doc.getElementById('rotate-video-btn');
const rotateBtnText = doc.getElementById('rotate-btn-text');

const playPauseBtn = doc.getElementById('play-pause-btn');
const playIcon = doc.getElementById('play-icon');
const currentTimecode = doc.getElementById('current-timecode');
const totalTimecode = doc.getElementById('total-timecode');
const fileNameBadge = doc.getElementById('file-name-badge');
const changeVideoBtn = doc.getElementById('change-video-btn');

// Aspect Ratio Elements
const currentRatioBadge = doc.getElementById('current-ratio-badge');
const ratioHint = doc.getElementById('ratio-hint');

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

// Cover Studio Elements
const sliderKeyframe = doc.getElementById('slider-keyframe');
const keyframePosVal = doc.getElementById('keyframe-pos-val');
const keyframeCanvas = doc.getElementById('keyframe-canvas');
const coverStageBtn = doc.getElementById('cover-stage-btn');
const coverSourceBadge = doc.getElementById('cover-source-badge');
const labelCoverSource = doc.getElementById('label-cover-source');
const btnStepPrev5 = doc.getElementById('btn-step-prev-5');
const btnStepPrev1 = doc.getElementById('btn-step-prev-1');
const btnStepNext1 = doc.getElementById('btn-step-next-1');
const btnStepNext5 = doc.getElementById('btn-step-next-5');
const btnKfStart = doc.getElementById('btn-kf-start');
const btnKfMid = doc.getElementById('btn-kf-mid');
const btnKfEnd = doc.getElementById('btn-kf-end');

const uploadCustomCoverBtn = doc.getElementById('upload-custom-cover-btn');
const customCoverInput = doc.getElementById('custom-cover-input');
const resetCustomCoverBtn = doc.getElementById('reset-custom-cover-btn');

// Zoom Dialog
const zoomDialog = doc.getElementById('zoom-dialog');
const zoomImg = doc.getElementById('zoom-img');
const zoomCloseBtn = doc.getElementById('zoom-close-btn');

// Conversion & Result Elements
const convertBtn = doc.getElementById('convert-btn');
const convertBtnText = doc.getElementById('convert-btn-text');
const progressContainer = doc.getElementById('progress-container');
const progressStatusText = doc.getElementById('progress-status-text');
const progressPercent = doc.getElementById('progress-percent');
const progressBarFill = doc.getElementById('progress-bar-fill');

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

// Language Elements
const langToggleBtn = doc.getElementById('lang-toggle-btn');
const langMenu = doc.getElementById('lang-menu');
const currentLangCode = doc.getElementById('current-lang-code');

// Theme Elements
const themeToggle = doc.getElementById('theme-toggle');
const themeIcon = doc.getElementById('theme-icon');

// -------------------------------------------------------------
// Helpers
// -------------------------------------------------------------
function t(key) {
  const dict = translations[currentLang] || translations.en;
  return dict[key] || translations.en[key] || key;
}

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
    if (modeHint) modeHint.textContent = t('modeHintAndroid');
    if (convertBtnText) convertBtnText.textContent = t('convertBtnAndroid');
  } else {
    if (modeHint) modeHint.textContent = t('modeHintTiktok');
    if (convertBtnText) convertBtnText.textContent = t('convertBtnTiktok');
  }
}

// -------------------------------------------------------------
// Aspect Ratio & Cropping Management
// -------------------------------------------------------------
function updateRatioUI() {
  doc.querySelectorAll('.ratio-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-ratio') === currentAspectRatio);
  });

  if (currentRatioBadge) {
    const badgeKey = currentAspectRatio === 'original' ? 'ratioOriginal'
      : currentAspectRatio === '9:16' ? 'ratioTikTok'
      : currentAspectRatio === '1:1' ? 'ratioSquare'
      : currentAspectRatio === '4:5' ? 'ratioPortrait' : 'ratioLandscape';
    currentRatioBadge.textContent = t(badgeKey);
  }
  if (ratioHint) ratioHint.textContent = t('ratioHint');

  if (previewViewport && previewBox) {
    if (currentAspectRatio === 'original') {
      previewViewport.style.aspectRatio = '';
      previewViewport.style.width = '100%';
      previewViewport.style.height = '100%';
      previewBox.classList.remove('cropped-mode');
    } else {
      previewBox.classList.add('cropped-mode');
      if (currentAspectRatio === '9:16') {
        previewViewport.style.aspectRatio = '9 / 16';
        previewViewport.style.width = 'auto';
        previewViewport.style.height = '100%';
      } else if (currentAspectRatio === '1:1') {
        previewViewport.style.aspectRatio = '1 / 1';
        previewViewport.style.width = 'auto';
        previewViewport.style.height = 'min(100%, 360px)';
      } else if (currentAspectRatio === '4:5') {
        previewViewport.style.aspectRatio = '4 / 5';
        previewViewport.style.width = 'auto';
        previewViewport.style.height = '100%';
      } else if (currentAspectRatio === '16:9') {
        previewViewport.style.aspectRatio = '16 / 9';
        previewViewport.style.width = '100%';
        previewViewport.style.height = 'auto';
      }
    }
  }

  // If custom cover is active, re-crop it to the new aspect ratio
  if (customCoverState && customCoverState.rawFile) {
    processCustomCoverImage(customCoverState.rawFile, 0.92, 1280, currentAspectRatio)
      .then((processed) => {
        customCoverState = { ...processed, active: true };
        drawCustomCoverToCanvas(processed.dataUrl);
      })
      .catch(console.error);
  } else {
    const kf = sliderKeyframe ? parseFloat(sliderKeyframe.value) : 0;
    renderKeyframePreview(kf);
  }
}

doc.querySelectorAll('.ratio-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    currentAspectRatio = btn.getAttribute('data-ratio');
    updateRatioUI();
  });
});

// -------------------------------------------------------------
// Internationalization (i18n) Setup
// -------------------------------------------------------------
function initLanguageMenu() {
  if (!langMenu) return;
  langMenu.innerHTML = '';
  languageList.forEach((lang) => {
    const item = doc.createElement('button');
    item.type = 'button';
    item.className = `lang-item ${lang.code === currentLang ? 'active' : ''}`;
    item.innerHTML = `
      <div class="left">
        <span class="flag">${lang.flag}</span>
        <span>${lang.name}</span>
      </div>
      ${lang.code === currentLang ? '<span class="icon check">check</span>' : ''}
    `;
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      setLanguage(lang.code);
      langMenu.classList.add('hidden');
    });
    langMenu.appendChild(item);
  });
}

function setLanguage(langCode) {
  if (!translations[langCode]) return;
  currentLang = langCode;
  localStorage.setItem('motion_lang', langCode);

  const langInfo = languageList.find(l => l.code === langCode);
  if (currentLangCode) currentLangCode.textContent = langCode.toUpperCase();
  doc.documentElement.lang = langCode;
  doc.documentElement.dir = (langInfo && langInfo.dir === 'rtl') ? 'rtl' : 'ltr';

  applyTranslations();
  initLanguageMenu();
}

function applyTranslations() {
  const setTxt = (id, key) => {
    const el = doc.getElementById(id);
    if (el) el.textContent = t(key);
  };
  const setHtml = (id, key) => {
    const el = doc.getElementById(id);
    if (el) el.innerHTML = t(key);
  };

  setTxt('app-title', 'appTitle');
  setTxt('app-subtitle', 'appSubtitle');
  setTxt('hero-title', 'heroTitle');
  setHtml('hero-desc', 'heroDesc');
  setTxt('pick-btn-text', 'pickVideoBtn');
  setTxt('feat-1', 'feat1');
  setTxt('feat-2', 'feat2');
  setTxt('feat-3', 'feat3');

  setTxt('label-format-title', 'formatSectionTitle');
  setTxt('label-mode-android', 'modeLivePhoto');
  setTxt('label-mode-tiktok', 'modeVideo');

  setTxt('label-ratio-title', 'ratioSectionTitle');
  setTxt('label-ratio-orig', 'ratioOriginal');
  setTxt('label-ratio-916', 'ratioTikTok');
  setTxt('label-ratio-11', 'ratioSquare');
  setTxt('label-ratio-45', 'ratioPortrait');
  setTxt('label-ratio-169', 'ratioLandscape');

  setTxt('label-duration-title', 'clipDurationTitle');
  setTxt('label-slider-start', 'sliderStartLabel');
  setTxt('label-slider-end', 'sliderEndLabel');

  setTxt('label-cover-title', 'coverPhotoTitle');
  setTxt('label-zoom-hint', 'zoomHint');
  setTxt('label-step-p5', 'stepPrev5');
  setTxt('label-step-p1', 'stepPrev1');
  setTxt('label-step-n1', 'stepNext1');
  setTxt('label-step-n5', 'stepNext5');
  setTxt('btn-kf-start', 'btnKfStart');
  setTxt('btn-kf-mid', 'btnKfMid');
  setTxt('btn-kf-end', 'btnKfEnd');

  setTxt('label-upload-cover', 'btnUploadCustomCover');
  setTxt('label-reset-cover', 'btnResetVideoCover');

  if (customCoverState && customCoverState.active) {
    setTxt('label-cover-source', 'customCoverActive');
  } else {
    setTxt('label-cover-source', 'fromVideoFrame');
  }

  setTxt('guide-summary', 'guideSummary');
  setHtml('guide-step-1', 'guideStep1');
  setHtml('guide-step-2', 'guideStep2');
  setHtml('guide-step-3', 'guideStep3');
  setHtml('guide-step-4', 'guideStep4');

  setTxt('sim-hint-text', 'simHint');
  setTxt('download-btn-label', 'saveToPhone');
  setTxt('share-btn-text', 'shareBtn');
  setTxt('reset-btn-text', 'editAgain');

  updateModeUI();
  updateRatioUI();
  updateRotation();
}

langToggleBtn?.addEventListener('click', (e) => {
  e.stopPropagation();
  langMenu?.classList.toggle('hidden');
});

doc.addEventListener('click', (e) => {
  if (langMenu && !langMenu.contains(e.target) && e.target !== langToggleBtn) {
    langMenu.classList.add('hidden');
  }
});

// -------------------------------------------------------------
// Video Loading & Preview Management
// -------------------------------------------------------------
function loadVideo(file) {
  if (!file) return;

  currentVideoFile = file;
  if (currentVideoUrl) URL.revokeObjectURL(currentVideoUrl);
  currentVideoUrl = URL.createObjectURL(file);
  currentRotation = 0;
  currentAspectRatio = 'original';
  customCoverState = null;
  resetCustomCoverUI();

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
    updateRatioUI();
    updateRotation();

    // Fix blank video screen on mobile: seek slightly above 0 to render initial frame
    try {
      sourceVideo.currentTime = 0.001;
    } catch (_) {}

    dropzone?.classList.add('hidden');
    trimmerPanel?.classList.remove('hidden');
    actionBar?.classList.remove('hidden');
    closeSheet();
  };

  sourceVideo.addEventListener('loadeddata', () => {
    renderKeyframePreview(0);
  }, { once: true });

  sourceVideo.onerror = () => {
    showSnackbar(t('errFormat'));
  };
}

// -------------------------------------------------------------
// Rotation & Timeline
// -------------------------------------------------------------
function updateRotation() {
  if (rotateBtnText) rotateBtnText.textContent = `${currentRotation}°`;

  if (sourceVideo && previewBox) {
    if (currentRotation === 90 || currentRotation === 270) {
      const pw = previewBox.clientWidth || 360;
      const ph = previewBox.clientHeight || 280;
      const scale = Math.min(pw / ph, ph / pw, 1);
      sourceVideo.style.transform = `rotate(${currentRotation}deg) scale(${scale.toFixed(3)})`;
    } else {
      sourceVideo.style.transform = `rotate(${currentRotation}deg) scale(1)`;
    }
  }

  if (!customCoverState || !customCoverState.active) {
    const kf = sliderKeyframe ? parseFloat(sliderKeyframe.value) : 0;
    renderKeyframePreview(kf);
  }
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

  updateKeyframeBadge(kf);

  updateSliderProgress(sliderStart);
  updateSliderProgress(sliderEnd);
  updateSliderProgress(sliderKeyframe);

  // Update preset chip highlights
  doc.querySelectorAll('.dur-preset-btn').forEach(btn => {
    const d = parseFloat(btn.getAttribute('data-dur'));
    btn.classList.toggle('active', Math.abs(duration - d) < 0.15);
  });
}

function updateKeyframeBadge(timeSec) {
  if (!keyframePosVal) return;
  if (customCoverState && customCoverState.active) {
    keyframePosVal.textContent = t('customCoverActive');
  } else {
    const frameNum = Math.round(timeSec * FPS);
    keyframePosVal.textContent = `${formatSeconds(timeSec)} · ${t('frameLabel')} #${frameNum}`;
  }
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

// -------------------------------------------------------------
// Cover Photo Studio (Enlarged + Frame Stepper + Custom Cover)
// -------------------------------------------------------------
function renderKeyframePreview(timeSec) {
  if (customCoverState && customCoverState.active) {
    drawCustomCoverToCanvas(customCoverState.dataUrl);
    return;
  }

  if (!sourceVideo || !keyframeCanvas || sourceVideo.readyState < 1) return;

  extractCoverFrame(sourceVideo, timeSec, 0.88, 720, currentRotation, currentAspectRatio)
    .then(({ dataUrl, width, height }) => {
      if (!dataUrl) return;
      currentCoverDataUrl = dataUrl;
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

function drawCustomCoverToCanvas(dataUrl) {
  if (!keyframeCanvas || !dataUrl) return;
  currentCoverDataUrl = dataUrl;
  const img = new Image();
  img.onload = () => {
    keyframeCanvas.width = img.width;
    keyframeCanvas.height = img.height;
    const ctx = keyframeCanvas.getContext('2d');
    ctx.clearRect(0, 0, img.width, img.height);
    ctx.drawImage(img, 0, 0);
  };
  img.src = dataUrl;
}

function resetCustomCoverUI() {
  customCoverState = null;
  coverSourceBadge?.classList.remove('custom');
  if (labelCoverSource) labelCoverSource.textContent = t('fromVideoFrame');
  resetCustomCoverBtn?.classList.add('hidden');
  const kf = sliderKeyframe ? parseFloat(sliderKeyframe.value) : 0;
  updateKeyframeBadge(kf);
  renderKeyframePreview(kf);
}

// Frame Stepper Navigation (-5, -1, +1, +5)
function stepKeyframe(deltaSeconds) {
  if (customCoverState && customCoverState.active) {
    resetCustomCoverUI();
  }

  const start = parseFloat(sliderStart.value || '0');
  const end = parseFloat(sliderEnd.value || '2.5');
  let cur = parseFloat(sliderKeyframe.value || '0');
  let next = cur + deltaSeconds;

  if (next < start) next = start;
  if (next > end) next = end;

  sliderKeyframe.value = next.toFixed(3);
  updateKeyframeBadge(next);
  updateSliderProgress(sliderKeyframe);
  sourceVideo.currentTime = next;
  renderKeyframePreview(next);
}

btnStepPrev5?.addEventListener('click', () => stepKeyframe(-5 * FRAME_STEP));
btnStepPrev1?.addEventListener('click', () => stepKeyframe(-1 * FRAME_STEP));
btnStepNext1?.addEventListener('click', () => stepKeyframe(1 * FRAME_STEP));
btnStepNext5?.addEventListener('click', () => stepKeyframe(5 * FRAME_STEP));

// Keyframe quick buttons
btnKfStart?.addEventListener('click', () => {
  if (customCoverState && customCoverState.active) resetCustomCoverUI();
  sliderKeyframe.value = sliderStart.value;
  sliderKeyframe.dispatchEvent(new Event('input'));
});

btnKfMid?.addEventListener('click', () => {
  if (customCoverState && customCoverState.active) resetCustomCoverUI();
  const mid = (parseFloat(sliderStart.value) + parseFloat(sliderEnd.value)) / 2;
  sliderKeyframe.value = mid.toFixed(3);
  sliderKeyframe.dispatchEvent(new Event('input'));
});

btnKfEnd?.addEventListener('click', () => {
  if (customCoverState && customCoverState.active) resetCustomCoverUI();
  sliderKeyframe.value = sliderEnd.value;
  sliderKeyframe.dispatchEvent(new Event('input'));
});

sliderKeyframe?.addEventListener('input', () => {
  if (customCoverState && customCoverState.active) {
    resetCustomCoverUI();
  }
  const time = parseFloat(sliderKeyframe.value);
  updateKeyframeBadge(time);
  updateSliderProgress(sliderKeyframe);
  renderKeyframePreview(time);
  sourceVideo.currentTime = time;
});

// Custom Cover Image Upload Handlers
uploadCustomCoverBtn?.addEventListener('click', () => {
  customCoverInput?.click();
});

customCoverInput?.addEventListener('change', async (e) => {
  if (e.target.files && e.target.files[0]) {
    try {
      const file = e.target.files[0];
      const processed = await processCustomCoverImage(file, 0.92, 1280, currentAspectRatio);
      customCoverState = {
        ...processed,
        active: true
      };

      coverSourceBadge?.classList.add('custom');
      if (labelCoverSource) labelCoverSource.textContent = t('customCoverActive');
      resetCustomCoverBtn?.classList.remove('hidden');

      drawCustomCoverToCanvas(processed.dataUrl);
      updateKeyframeBadge(parseFloat(sliderKeyframe.value));
      showSnackbar(t('customCoverSuccess'));
    } catch (err) {
      console.error(err);
      showSnackbar("Gagal memuat gambar: " + err.message);
    }
    customCoverInput.value = '';
  }
});

resetCustomCoverBtn?.addEventListener('click', () => {
  resetCustomCoverUI();
});

// Fullscreen Cover Zoom Dialog
coverStageBtn?.addEventListener('click', () => {
  if (!currentCoverDataUrl) return;
  zoomImg.src = currentCoverDataUrl;
  zoomDialog?.classList.add('open');
});

zoomCloseBtn?.addEventListener('click', (e) => {
  e.stopPropagation();
  zoomDialog?.classList.remove('open');
});

zoomDialog?.addEventListener('click', (e) => {
  if (e.target !== zoomImg) {
    zoomDialog?.classList.remove('open');
  }
});

// -------------------------------------------------------------
// Play / Pause Video Controller
// -------------------------------------------------------------
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

    // 1. Prepare Cover Photo (Custom uploaded image OR extracted video frame with aspect ratio crop)
    updateProgress(15, t('progressExtractCover'));
    let coverResult;
    if (customCoverState && customCoverState.active) {
      coverResult = customCoverState;
    } else {
      coverResult = await extractCoverFrame(sourceVideo, keyframeTime, 0.90, 1280, currentRotation, currentAspectRatio);
    }

    // 2. Prepare & Trim Video Segment (Smooth 30fps FastStart H.264 with identical crop)
    updateProgress(35, `${t('progressEncodeVideo')} (${duration.toFixed(1)}s)`);
    const videoClipBytes = await trimVideoClip(
      sourceVideo,
      startTime,
      endTime,
      currentVideoFile,
      currentRotation,
      (p) => {
        const mapped = 35 + Math.round(p * 0.50);
        updateProgress(mapped, `${t('progressEncodingFrames')} (${Math.round(p)}%)...`);
      },
      currentAspectRatio
    );

    // 3. Inject Metadata
    updateProgress(88, t('progressInjectMeta'));
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

      if (resultTitle) resultTitle.textContent = t('resultTitleAndroid');
      if (downloadBtnLabel) downloadBtnLabel.textContent = `${t('saveToPhone')} (.jpg)`;
      if (sheetNote) sheetNote.textContent = t('noteAndroid');

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

      if (resultTitle) resultTitle.textContent = t('resultTitleTiktok');
      if (downloadBtnLabel) downloadBtnLabel.textContent = `${t('saveToPhone')} (.mp4)`;
      if (sheetNote) sheetNote.textContent = t('noteTiktok');
    }

    updateProgress(100, t('progressDone'));

    // Display Result Bottom Sheet with validated non-blank previews
    setTimeout(() => {
      progressContainer?.classList.add('hidden');

      if (resTotalSize) {
        resTotalSize.textContent = `${formatBytes(generatedResult.totalSize)} • ${duration.toFixed(1)}s • 30fps`;
      }

      if (simStillImg) {
        simStillImg.src = generatedResult.coverDataUrl;
        simStillImg.classList.remove('hidden');
      }

      if (simMotionVideo) {
        simMotionVideo.src = generatedResult.clipVideoUrl;
        simMotionVideo.load();
        simMotionVideo.currentTime = 0;
        simMotionVideo.classList.add('hidden');
      }

      openSheet();
    }, 250);

  } catch (err) {
    console.error("Conversion error:", err);
    showSnackbar(t('errProcess') + (err.message || err));
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
  const p = simMotionVideo.play();
  if (p !== undefined) {
    p.catch(() => {});
  }
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
  showSnackbar(`${t('savedSnackbar')}${generatedResult.filename}`);
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
        text: t('shareText')
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
  showSnackbar(t('shareFallback'));
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

// Window resize updates video rotation scaling if needed
window.addEventListener('resize', () => {
  if (currentRotation === 90 || currentRotation === 270) {
    updateRotation();
  }
});

// Initialize i18n & Theme
setLanguage(currentLang);
updateThemeIcon();
