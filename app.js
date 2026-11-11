/**
 * app.js — v4.7 Controller
 * Mobile-first Android Material 3 interface
 * Multi-language (8 languages) & Resolution Config (720p/1080p) & Video Cropper & Privacy
 */

import { translations, languageList } from './i18n.js?v=4.7';
import { 
  createGoogleMotionPhoto, 
  extractCoverFrame, 
  processCustomCoverImage,
  trimVideoClip,
  computeOutputSize,
  drawRotated
} from './motionEngine.js?v=4.7';

const FPS = 30;
const FRAME_STEP = 1 / FPS; // ~0.0333s

// Global State
let currentLang = localStorage.getItem('motion_lang') || (navigator.language.startsWith('id') ? 'id' : 'en');
if (!translations[currentLang]) currentLang = 'en';

let currentVideoFile = null;
let currentVideoUrl = null;
let currentRotation = 0; // 0, 90, 180, 270
let currentAspectRatio = 'original'; // 'original' | '9:16' | '1:1' | '4:5' | '16:9' | 'W:H'
let currentResolution = 720; // 720 or 1080
function getMaxDimension() {
  return currentResolution === 1080 ? 1920 : 1280;
}

let isConverting = false;
let snackbarTimeout = null;

// Video Framing State (Zoom, Pan X, Pan Y)
let videoFraming = {
  zoom: 1.0,
  panX: 0,
  panY: 0
};
let tempVideoFraming = {
  zoom: 1.0,
  panX: 0,
  panY: 0
};

// Custom Cover State
let customCoverState = null; // { blob, uint8Array, width, height, dataUrl, rawFile, active: true }
let currentCoverDataUrl = '';

// Cover Photo Editor Internal State
let editorSourceImage = null; // Image element loaded for editor
let editorState = {
  zoom: 1.0,
  panX: 0,
  panY: 0,
  brightness: 100,
  contrast: 100,
  saturation: 100
};

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
const quickCropVideoBtn = doc.getElementById('quick-crop-video-btn');

const playPauseBtn = doc.getElementById('play-pause-btn');
const playIcon = doc.getElementById('play-icon');
const currentTimecode = doc.getElementById('current-timecode');
const totalTimecode = doc.getElementById('total-timecode');
const fileNameBadge = doc.getElementById('file-name-badge');
const changeVideoBtn = doc.getElementById('change-video-btn');

// Aspect Ratio Elements
const currentRatioBadge = doc.getElementById('current-ratio-badge');
const ratioHint = doc.getElementById('ratio-hint');
const customRatioBox = doc.getElementById('custom-ratio-box');
const customRatioW = doc.getElementById('custom-ratio-w');
const customRatioH = doc.getElementById('custom-ratio-h');
const btnApplyCustomRatio = doc.getElementById('btn-apply-custom-ratio');
const editVideoBtn = doc.getElementById('edit-video-btn');

// Resolution Elements (720p / 1080p)
const currentResBadge = doc.getElementById('current-res-badge');
const cardRes720 = doc.getElementById('card-res-720');
const cardRes1080 = doc.getElementById('card-res-1080');
const resHint = doc.getElementById('res-hint');
const heroResFeature = doc.getElementById('hero-res-feature');
const feat1 = doc.getElementById('feat-1');

// Privacy Modal Elements
const privacyFeatureBtn = doc.getElementById('privacy-feature-btn');
const privacyScrim = doc.getElementById('privacy-scrim');
const privacySheet = doc.getElementById('privacy-sheet');
const privacyCloseBtn = doc.getElementById('privacy-close-btn');
const btnPrivacyGotit = doc.getElementById('btn-privacy-gotit');

// Video Editor Modal Elements
const videoEditorScrim = doc.getElementById('video-editor-scrim');
const videoEditorSheet = doc.getElementById('video-editor-sheet');
const videoEditorCloseBtn = doc.getElementById('video-editor-close-btn');
const videoEditorCanvasContainer = doc.getElementById('video-editor-canvas-container');
const interactiveVideoCanvas = doc.getElementById('interactive-video-canvas');
const videoEditorZoom = doc.getElementById('video-editor-zoom');
const valVideoZoom = doc.getElementById('val-video-zoom');
const videoEditorPanX = doc.getElementById('video-editor-panx');
const valVideoPanX = doc.getElementById('val-video-panx');
const videoEditorPanY = doc.getElementById('video-editor-pany');
const valVideoPanY = doc.getElementById('val-video-pany');
const videoEditorResetBtn = doc.getElementById('video-editor-reset-btn');
const videoEditorApplyBtn = doc.getElementById('video-editor-apply-btn');

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

const editCoverBtn = doc.getElementById('edit-cover-btn');
const uploadCustomCoverBtn = doc.getElementById('upload-custom-cover-btn');
const customCoverInput = doc.getElementById('custom-cover-input');
const resetCustomCoverBtn = doc.getElementById('reset-custom-cover-btn');

// Cover Photo Editor Modal Elements
const editorScrim = doc.getElementById('editor-scrim');
const coverEditorSheet = doc.getElementById('cover-editor-sheet');
const editorCloseBtn = doc.getElementById('editor-close-btn');
const editorCanvasContainer = doc.getElementById('editor-canvas-container');
const interactiveEditorCanvas = doc.getElementById('interactive-editor-canvas');
const editorZoom = doc.getElementById('editor-zoom');
const valEditorZoom = doc.getElementById('val-editor-zoom');
const editorPanX = doc.getElementById('editor-pan-x');
const valEditorPanX = doc.getElementById('val-editor-panx');
const editorPanY = doc.getElementById('editor-pan-y');
const valEditorPanY = doc.getElementById('val-editor-pany');
const editorBright = doc.getElementById('editor-bright');
const valEditorBright = doc.getElementById('val-editor-bright');
const editorContrast = doc.getElementById('editor-contrast');
const valEditorContrast = doc.getElementById('val-editor-contrast');
const editorSat = doc.getElementById('editor-sat');
const valEditorSat = doc.getElementById('val-editor-sat');
const editorResetBtn = doc.getElementById('editor-reset-btn');
const editorApplyBtn = doc.getElementById('editor-apply-btn');

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
// Resolution & Privacy Management
// -------------------------------------------------------------
function updateResolutionUI() {
  if (cardRes720) cardRes720.classList.toggle('active', currentResolution === 720);
  if (cardRes1080) cardRes1080.classList.toggle('active', currentResolution === 1080);
  if (currentResBadge) {
    currentResBadge.textContent = currentResolution === 1080 ? t('res1080') : t('res720');
  }
  if (feat1) {
    feat1.textContent = `${currentResolution}p · 30fps`;
  }
  if (resHint) {
    resHint.textContent = t('resHint');
  }
}

function openPrivacySheet() {
  privacyScrim?.classList.add('open');
  privacySheet?.classList.add('open');
  privacySheet?.setAttribute('aria-hidden', 'false');
}

function closePrivacySheet() {
  privacyScrim?.classList.remove('open');
  privacySheet?.classList.remove('open');
  privacySheet?.setAttribute('aria-hidden', 'true');
}

// -------------------------------------------------------------
// Aspect Ratio & Cropping Management
// -------------------------------------------------------------
function updateRatioUI() {
  const isCustomRatio = currentAspectRatio.includes(':') && 
    !['9:16', '1:1', '4:5', '16:9'].includes(currentAspectRatio);

  doc.querySelectorAll('.ratio-btn').forEach(btn => {
    const r = btn.getAttribute('data-ratio');
    if (r === 'custom') {
      btn.classList.toggle('active', isCustomRatio);
    } else {
      btn.classList.toggle('active', r === currentAspectRatio);
    }
  });

  if (customRatioBox) {
    customRatioBox.classList.toggle('hidden', !isCustomRatio);
  }

  if (currentRatioBadge) {
    if (isCustomRatio) {
      currentRatioBadge.textContent = `${t('ratioCustom')} (${currentAspectRatio})`;
    } else {
      const badgeKey = currentAspectRatio === 'original' ? 'ratioOriginal'
        : currentAspectRatio === '9:16' ? 'ratioTikTok'
        : currentAspectRatio === '1:1' ? 'ratioSquare'
        : currentAspectRatio === '4:5' ? 'ratioPortrait' : 'ratioLandscape';
      currentRatioBadge.textContent = t(badgeKey);
    }
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
      let targetRatioValue = '9 / 16';
      if (currentAspectRatio === '9:16') targetRatioValue = '9 / 16';
      else if (currentAspectRatio === '1:1') targetRatioValue = '1 / 1';
      else if (currentAspectRatio === '4:5') targetRatioValue = '4 / 5';
      else if (currentAspectRatio === '16:9') targetRatioValue = '16 / 9';
      else if (currentAspectRatio.includes(':')) {
        const [w, h] = currentAspectRatio.split(':').map(Number);
        if (w > 0 && h > 0) targetRatioValue = `${w} / ${h}`;
      }

      previewViewport.style.aspectRatio = targetRatioValue;
      const [rw, rh] = targetRatioValue.split('/').map(Number);
      if (rw <= rh) {
        previewViewport.style.width = 'auto';
        previewViewport.style.height = '100%';
      } else {
        previewViewport.style.width = '100%';
        previewViewport.style.height = 'auto';
      }
    }
  }

  // If custom cover is active, re-crop it to the new aspect ratio
  if (customCoverState && customCoverState.rawFile) {
    processCustomCoverImage(customCoverState.rawFile, 0.92, getMaxDimension(), currentAspectRatio)
      .then((processed) => {
        customCoverState = { ...processed, active: true };
        drawCustomCoverToCanvas(processed.dataUrl);
      })
      .catch(console.error);
  } else {
    const kf = sliderKeyframe ? parseFloat(sliderKeyframe.value || '0') : 0;
    renderKeyframePreview(kf);
  }
}

doc.querySelectorAll('.ratio-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const r = btn.getAttribute('data-ratio');
    if (r === 'custom') {
      const w = parseInt((customRatioW && customRatioW.value) || '3', 10);
      const h = parseInt((customRatioH && customRatioH.value) || '4', 10);
      currentAspectRatio = `${w}:${h}`;
      if (customRatioBox) customRatioBox.classList.remove('hidden');
    } else {
      currentAspectRatio = r;
      if (customRatioBox) customRatioBox.classList.add('hidden');
    }
    updateRatioUI();
  });
});

btnApplyCustomRatio?.addEventListener('click', () => {
  const w = Math.max(1, parseInt((customRatioW && customRatioW.value) || '3', 10));
  const h = Math.max(1, parseInt((customRatioH && customRatioH.value) || '4', 10));
  currentAspectRatio = `${w}:${h}`;
  updateRatioUI();
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
  setTxt('label-ratio-custom', 'ratioCustom');
  setTxt('label-apply-custom-ratio', 'applyBtn');
  setTxt('label-edit-video', 'editVideoBtn');
  setTxt('label-quick-crop', 'editVideoBtn');

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

  setTxt('label-edit-cover', 'editCoverBtn');
  setTxt('label-upload-cover', 'btnUploadCustomCover');
  setTxt('label-reset-cover', 'btnResetVideoCover');

  // Video Editor Modal Labels
  setTxt('label-video-editor-title', 'videoEditorModalTitle');
  setTxt('label-video-editor-hint', 'videoDragHint');
  setTxt('label-video-zoom', 'zoomLabel');
  setTxt('label-video-panx', 'panXLabel');
  setTxt('label-video-pany', 'panYLabel');
  setTxt('label-video-editor-reset', 'resetBtn');
  setTxt('label-video-editor-apply', 'applyBtn');

  // Cover Editor Modal Labels
  setTxt('label-editor-title', 'editCoverModalTitle');
  setTxt('label-editor-hint', 'dragHint');
  setTxt('label-edit-zoom', 'zoomLabel');
  setTxt('label-edit-panx', 'panXLabel');
  setTxt('label-edit-pany', 'panYLabel');
  setTxt('label-edit-bright', 'brightnessLabel');
  setTxt('label-edit-contrast', 'contrastLabel');
  setTxt('label-edit-sat', 'saturationLabel');
  setTxt('label-editor-reset', 'resetBtn');
  setTxt('label-editor-apply', 'applyBtn');

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

  // Resolution & Privacy Labels
  setTxt('label-res-title', 'resolutionSectionTitle');
  setTxt('label-res-720', 'res720');
  setTxt('label-res-1080', 'res1080');
  setTxt('label-privacy-title', 'privacyTitle');
  setTxt('label-privacy-desc', 'privacyDesc');
  setTxt('label-privacy-gotit', 'gotItBtn');

  updateModeUI();
  updateResolutionUI();
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
  videoFraming = { zoom: 1.0, panX: 0, panY: 0 };
  tempVideoFraming = { zoom: 1.0, panX: 0, panY: 0 };
  customCoverState = null;
  resetCustomCoverUI();

  if (fileNameBadge) fileNameBadge.textContent = file.name;
  sourceVideo.src = currentVideoUrl;
  sourceVideo.muted = true;
  sourceVideo.playsInline = true;
  sourceVideo.load();

  sourceVideo.onloadedmetadata = () => {
    const dur = Math.max(0.5, sourceVideo.duration || 3.0);

    if (sliderStart) {
      sliderStart.min = "0";
      sliderStart.max = dur.toFixed(2);
      sliderStart.value = "0";
    }

    const defaultEnd = Math.min(2.5, dur);
    if (sliderEnd) {
      sliderEnd.min = "0";
      sliderEnd.max = dur.toFixed(2);
      sliderEnd.value = defaultEnd.toFixed(2);
    }

    if (sliderKeyframe) {
      sliderKeyframe.min = "0";
      sliderKeyframe.max = dur.toFixed(2);
      sliderKeyframe.value = "0";
    }

    updateSliderUI();
    updateRatioUI();
    updateResolutionUI();
    updateRotation();

    // Fix blank video screen on mobile: seek slightly above 0 to render initial frame
    try {
      sourceVideo.currentTime = 0.001;
    } catch (_) {}

    dropzone?.classList.add('hidden');
    trimmerPanel?.classList.remove('hidden');
    actionBar?.classList.remove('hidden');
    closeSheet();
    closeEditorSheet();
    closeVideoEditorSheet();
    closePrivacySheet();
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
    let baseScale = 1;
    if (currentRotation === 90 || currentRotation === 270) {
      const pw = previewBox.clientWidth || 360;
      const ph = previewBox.clientHeight || 280;
      baseScale = Math.min(pw / ph, ph / pw, 1);
    }
    const z = (videoFraming && videoFraming.zoom) || 1.0;
    const px = (videoFraming && videoFraming.panX) || 0;
    const py = (videoFraming && videoFraming.panY) || 0;

    sourceVideo.style.transform = `rotate(${currentRotation}deg) scale(${(baseScale * z).toFixed(3)})`;
    sourceVideo.style.objectPosition = `${50 + (px / 2)}% ${50 + (py / 2)}%`;
  }

  if (!customCoverState || !customCoverState.active) {
    const kf = sliderKeyframe ? parseFloat(sliderKeyframe.value || '0') : 0;
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

  extractCoverFrame(sourceVideo, timeSec, 0.88, 720, currentRotation, currentAspectRatio, videoFraming)
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
  if (sliderKeyframe && sliderStart) {
    sliderKeyframe.value = sliderStart.value;
    sliderKeyframe.dispatchEvent(new Event('input'));
  }
});

btnKfMid?.addEventListener('click', () => {
  if (customCoverState && customCoverState.active) resetCustomCoverUI();
  if (sliderKeyframe && sliderStart && sliderEnd) {
    const mid = (parseFloat(sliderStart.value || '0') + parseFloat(sliderEnd.value || '2.5')) / 2;
    sliderKeyframe.value = mid.toFixed(3);
    sliderKeyframe.dispatchEvent(new Event('input'));
  }
});

btnKfEnd?.addEventListener('click', () => {
  if (customCoverState && customCoverState.active) resetCustomCoverUI();
  if (sliderKeyframe && sliderEnd) {
    sliderKeyframe.value = sliderEnd.value;
    sliderKeyframe.dispatchEvent(new Event('input'));
  }
});

sliderKeyframe?.addEventListener('input', () => {
  if (customCoverState && customCoverState.active) {
    resetCustomCoverUI();
  }
  const time = parseFloat((sliderKeyframe && sliderKeyframe.value) || '0');
  updateKeyframeBadge(time);
  updateSliderProgress(sliderKeyframe);
  renderKeyframePreview(time);
  if (sourceVideo) sourceVideo.currentTime = time;
});

// Custom Cover Image Upload Handlers
uploadCustomCoverBtn?.addEventListener('click', () => {
  customCoverInput?.click();
});

customCoverInput?.addEventListener('change', async (e) => {
  if (e.target.files && e.target.files[0]) {
    try {
      const file = e.target.files[0];
      const processed = await processCustomCoverImage(file, 0.92, getMaxDimension(), currentAspectRatio);
      customCoverState = {
        ...processed,
        active: true
      };

      coverSourceBadge?.classList.add('custom');
      if (labelCoverSource) labelCoverSource.textContent = t('customCoverActive');
      resetCustomCoverBtn?.classList.remove('hidden');

      drawCustomCoverToCanvas(processed.dataUrl);
      const kf = sliderKeyframe ? parseFloat(sliderKeyframe.value || '0') : 0;
      updateKeyframeBadge(kf);
      showSnackbar(t('customCoverSuccess'));
    } catch (err) {
      console.error(err);
      showSnackbar("Gagal memuat gambar: " + err.message);
    }
    if (customCoverInput) customCoverInput.value = '';
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
// Cover Photo Editor & Crop Modal
// -------------------------------------------------------------
function openEditorSheet() {
  if (!sourceVideo && !customCoverState) return;

  editorState = {
    zoom: 1.0,
    panX: 0,
    panY: 0,
    brightness: 100,
    contrast: 100,
    saturation: 100
  };
  syncEditorControlSliders();

  const img = new Image();
  img.onload = () => {
    editorSourceImage = img;
    renderEditorCanvas();
    editorScrim?.classList.add('open');
    coverEditorSheet?.classList.add('open');
    coverEditorSheet?.setAttribute('aria-hidden', 'false');
  };

  // If there's an active custom cover, load its image, else extract current frame
  if (customCoverState && customCoverState.dataUrl) {
    img.src = customCoverState.dataUrl;
  } else if (currentCoverDataUrl) {
    img.src = currentCoverDataUrl;
  } else {
    const kf = sliderKeyframe ? parseFloat(sliderKeyframe.value || '0') : 0;
    extractCoverFrame(sourceVideo, kf, 0.92, getMaxDimension(), currentRotation, currentAspectRatio, videoFraming)
      .then(res => { img.src = res.dataUrl; })
      .catch(console.error);
  }
}

function closeEditorSheet() {
  editorScrim?.classList.remove('open');
  coverEditorSheet?.classList.remove('open');
  coverEditorSheet?.setAttribute('aria-hidden', 'true');
}

function syncEditorControlSliders() {
  if (editorZoom) { editorZoom.value = editorState.zoom; valEditorZoom.textContent = `${editorState.zoom.toFixed(1)}x`; }
  if (editorPanX) { editorPanX.value = editorState.panX; valEditorPanX.textContent = `${editorState.panX}%`; }
  if (editorPanY) { editorPanY.value = editorState.panY; valEditorPanY.textContent = `${editorState.panY}%`; }
  if (editorBright) { editorBright.value = editorState.brightness; valEditorBright.textContent = `${editorState.brightness}%`; }
  if (editorContrast) { editorContrast.value = editorState.contrast; valEditorContrast.textContent = `${editorState.contrast}%`; }
  if (editorSat) { editorSat.value = editorState.saturation; valEditorSat.textContent = `${editorState.saturation}%`; }

  updateSliderProgress(editorZoom);
  updateSliderProgress(editorPanX);
  updateSliderProgress(editorPanY);
  updateSliderProgress(editorBright);
  updateSliderProgress(editorContrast);
  updateSliderProgress(editorSat);
}

function renderEditorCanvas() {
  if (!editorSourceImage || !interactiveEditorCanvas) return;

  const w = 600;
  const h = 600;
  interactiveEditorCanvas.width = w;
  interactiveEditorCanvas.height = h;
  const ctx = interactiveEditorCanvas.getContext('2d');

  ctx.clearRect(0, 0, w, h);
  ctx.save();

  // Apply visual adjustments
  ctx.filter = `brightness(${editorState.brightness}%) contrast(${editorState.contrast}%) saturate(${editorState.saturation}%)`;

  const imgW = editorSourceImage.naturalWidth || editorSourceImage.width;
  const imgH = editorSourceImage.naturalHeight || editorSourceImage.height;

  // Scale to fit canvas with zoom
  const baseScale = Math.min(w / imgW, h / imgH);
  const totalScale = baseScale * editorState.zoom;
  const drawW = imgW * totalScale;
  const drawH = imgH * totalScale;

  // Pan offsets in pixels
  const offsetX = (w - drawW) / 2 + (editorState.panX / 100) * (w / 2);
  const offsetY = (h - drawH) / 2 + (editorState.panY / 100) * (h / 2);

  ctx.drawImage(editorSourceImage, offsetX, offsetY, drawW, drawH);
  ctx.restore();
}

// Editor Sliders Event Listeners
editorZoom?.addEventListener('input', () => {
  if (!editorZoom) return;
  editorState.zoom = parseFloat(editorZoom.value || '1');
  if (valEditorZoom) valEditorZoom.textContent = `${editorState.zoom.toFixed(2)}x`;
  updateSliderProgress(editorZoom);
  renderEditorCanvas();
});

editorPanX?.addEventListener('input', () => {
  if (!editorPanX) return;
  editorState.panX = parseInt(editorPanX.value || '0', 10);
  if (valEditorPanX) valEditorPanX.textContent = `${editorState.panX}%`;
  updateSliderProgress(editorPanX);
  renderEditorCanvas();
});

editorPanY?.addEventListener('input', () => {
  if (!editorPanY) return;
  editorState.panY = parseInt(editorPanY.value || '0', 10);
  if (valEditorPanY) valEditorPanY.textContent = `${editorState.panY}%`;
  updateSliderProgress(editorPanY);
  renderEditorCanvas();
});

editorBright?.addEventListener('input', () => {
  if (!editorBright) return;
  editorState.brightness = parseInt(editorBright.value || '100', 10);
  if (valEditorBright) valEditorBright.textContent = `${editorState.brightness}%`;
  updateSliderProgress(editorBright);
  renderEditorCanvas();
});

editorContrast?.addEventListener('input', () => {
  if (!editorContrast) return;
  editorState.contrast = parseInt(editorContrast.value || '100', 10);
  if (valEditorContrast) valEditorContrast.textContent = `${editorState.contrast}%`;
  updateSliderProgress(editorContrast);
  renderEditorCanvas();
});

editorSat?.addEventListener('input', () => {
  if (!editorSat) return;
  editorState.saturation = parseInt(editorSat.value || '100', 10);
  if (valEditorSat) valEditorSat.textContent = `${editorState.saturation}%`;
  updateSliderProgress(editorSat);
  renderEditorCanvas();
});

// Touch & Drag on Interactive Editor Canvas
let isDraggingEditor = false;
let startDragX = 0;
let startDragY = 0;
let initialPanX = 0;
let initialPanY = 0;

editorCanvasContainer?.addEventListener('pointerdown', (e) => {
  isDraggingEditor = true;
  startDragX = e.clientX;
  startDragY = e.clientY;
  initialPanX = editorState.panX;
  initialPanY = editorState.panY;
  editorCanvasContainer.setPointerCapture(e.pointerId);
});

editorCanvasContainer?.addEventListener('pointermove', (e) => {
  if (!isDraggingEditor) return;
  const dx = e.clientX - startDragX;
  const dy = e.clientY - startDragY;
  const containerW = editorCanvasContainer.clientWidth || 300;
  const containerH = editorCanvasContainer.clientHeight || 250;

  let newPanX = initialPanX + (dx / containerW) * 100;
  let newPanY = initialPanY + (dy / containerH) * 100;

  editorState.panX = Math.max(-100, Math.min(100, Math.round(newPanX)));
  editorState.panY = Math.max(-100, Math.min(100, Math.round(newPanY)));

  if (editorPanX) editorPanX.value = editorState.panX;
  if (valEditorPanX) valEditorPanX.textContent = `${editorState.panX}%`;
  if (editorPanY) editorPanY.value = editorState.panY;
  if (valEditorPanY) valEditorPanY.textContent = `${editorState.panY}%`;

  updateSliderProgress(editorPanX);
  updateSliderProgress(editorPanY);
  renderEditorCanvas();
});

editorCanvasContainer?.addEventListener('pointerup', (e) => {
  isDraggingEditor = false;
  try { editorCanvasContainer.releasePointerCapture(e.pointerId); } catch (_) {}
});

editorResetBtn?.addEventListener('click', () => {
  editorState = {
    zoom: 1.0,
    panX: 0,
    panY: 0,
    brightness: 100,
    contrast: 100,
    saturation: 100
  };
  syncEditorControlSliders();
  renderEditorCanvas();
});

editorApplyBtn?.addEventListener('click', async () => {
  if (!interactiveEditorCanvas) return;

  const dataUrl = interactiveEditorCanvas.toDataURL('image/jpeg', 0.94);
  const blob = await new Promise(resolve => interactiveEditorCanvas.toBlob(resolve, 'image/jpeg', 0.94));
  const uint8Array = new Uint8Array(await blob.arrayBuffer());

  customCoverState = {
    blob,
    uint8Array,
    width: interactiveEditorCanvas.width,
    height: interactiveEditorCanvas.height,
    dataUrl,
    active: true
  };

  coverSourceBadge?.classList.add('custom');
  if (labelCoverSource) labelCoverSource.textContent = t('customCoverActive');
  resetCustomCoverBtn?.classList.remove('hidden');

  drawCustomCoverToCanvas(dataUrl);
  const kfVal = sliderKeyframe ? parseFloat(sliderKeyframe.value || '0') : 0;
  updateKeyframeBadge(kfVal);
  closeEditorSheet();
  showSnackbar(t('coverAppliedSnackbar'));
});

editCoverBtn?.addEventListener('click', openEditorSheet);
editorCloseBtn?.addEventListener('click', closeEditorSheet);
editorScrim?.addEventListener('click', closeEditorSheet);

// -------------------------------------------------------------
// Video Framing Editor & Crop (Zoom, Pan X, Pan Y)
// -------------------------------------------------------------
function openVideoEditorSheet() {
  if (!sourceVideo || !currentVideoFile) return;

  tempVideoFraming = { ...videoFraming };
  syncVideoEditorSliders();

  videoEditorScrim?.classList.add('open');
  videoEditorSheet?.classList.add('open');
  videoEditorSheet?.setAttribute('aria-hidden', 'false');

  renderVideoEditorCanvas();
}

function closeVideoEditorSheet() {
  videoEditorScrim?.classList.remove('open');
  videoEditorSheet?.classList.remove('open');
  videoEditorSheet?.setAttribute('aria-hidden', 'true');
}

function syncVideoEditorSliders() {
  if (videoEditorZoom) {
    videoEditorZoom.value = tempVideoFraming.zoom;
    if (valVideoZoom) valVideoZoom.textContent = `${tempVideoFraming.zoom.toFixed(1)}x`;
  }
  if (videoEditorPanX) {
    videoEditorPanX.value = tempVideoFraming.panX;
    if (valVideoPanX) valVideoPanX.textContent = `${tempVideoFraming.panX}%`;
  }
  if (videoEditorPanY) {
    videoEditorPanY.value = tempVideoFraming.panY;
    if (valVideoPanY) valVideoPanY.textContent = `${tempVideoFraming.panY}%`;
  }

  updateSliderProgress(videoEditorZoom);
  updateSliderProgress(videoEditorPanX);
  updateSliderProgress(videoEditorPanY);
}

function renderVideoEditorCanvas() {
  if (!sourceVideo || !interactiveVideoCanvas || sourceVideo.readyState < 1) return;

  const cropInfo = computeOutputSize(sourceVideo, currentRotation, currentAspectRatio, 600, tempVideoFraming);
  const { w, h } = cropInfo;

  interactiveVideoCanvas.width = w;
  interactiveVideoCanvas.height = h;

  const ctx = interactiveVideoCanvas.getContext('2d', { alpha: false });
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, w, h);
  drawRotated(ctx, sourceVideo, currentRotation, w, h, cropInfo);
}

// Touch & Drag on Interactive Video Canvas
let isDraggingVideo = false;
let startVideoDragX = 0;
let startVideoDragY = 0;
let initialVideoPanX = 0;
let initialVideoPanY = 0;

videoEditorCanvasContainer?.addEventListener('pointerdown', (e) => {
  isDraggingVideo = true;
  startVideoDragX = e.clientX;
  startVideoDragY = e.clientY;
  initialVideoPanX = tempVideoFraming.panX;
  initialVideoPanY = tempVideoFraming.panY;
  try { videoEditorCanvasContainer.setPointerCapture(e.pointerId); } catch (_) {}
});

videoEditorCanvasContainer?.addEventListener('pointermove', (e) => {
  if (!isDraggingVideo) return;
  const dx = e.clientX - startVideoDragX;
  const dy = e.clientY - startVideoDragY;
  const containerW = videoEditorCanvasContainer.clientWidth || 300;
  const containerH = videoEditorCanvasContainer.clientHeight || 250;

  let newPanX = initialVideoPanX + (dx / containerW) * 100;
  let newPanY = initialVideoPanY + (dy / containerH) * 100;

  tempVideoFraming.panX = Math.max(-100, Math.min(100, Math.round(newPanX)));
  tempVideoFraming.panY = Math.max(-100, Math.min(100, Math.round(newPanY)));

  if (videoEditorPanX) videoEditorPanX.value = tempVideoFraming.panX;
  if (valVideoPanX) valVideoPanX.textContent = `${tempVideoFraming.panX}%`;
  if (videoEditorPanY) videoEditorPanY.value = tempVideoFraming.panY;
  if (valVideoPanY) valVideoPanY.textContent = `${tempVideoFraming.panY}%`;

  updateSliderProgress(videoEditorPanX);
  updateSliderProgress(videoEditorPanY);
  renderVideoEditorCanvas();
});

videoEditorCanvasContainer?.addEventListener('pointerup', (e) => {
  isDraggingVideo = false;
  try { videoEditorCanvasContainer.releasePointerCapture(e.pointerId); } catch (_) {}
});

videoEditorZoom?.addEventListener('input', () => {
  if (!videoEditorZoom) return;
  tempVideoFraming.zoom = parseFloat(videoEditorZoom.value || '1');
  if (valVideoZoom) valVideoZoom.textContent = `${tempVideoFraming.zoom.toFixed(2)}x`;
  updateSliderProgress(videoEditorZoom);
  renderVideoEditorCanvas();
});

videoEditorPanX?.addEventListener('input', () => {
  if (!videoEditorPanX) return;
  tempVideoFraming.panX = parseInt(videoEditorPanX.value || '0', 10);
  if (valVideoPanX) valVideoPanX.textContent = `${tempVideoFraming.panX}%`;
  updateSliderProgress(videoEditorPanX);
  renderVideoEditorCanvas();
});

videoEditorPanY?.addEventListener('input', () => {
  if (!videoEditorPanY) return;
  tempVideoFraming.panY = parseInt(videoEditorPanY.value || '0', 10);
  if (valVideoPanY) valVideoPanY.textContent = `${tempVideoFraming.panY}%`;
  updateSliderProgress(videoEditorPanY);
  renderVideoEditorCanvas();
});

videoEditorResetBtn?.addEventListener('click', () => {
  tempVideoFraming = { zoom: 1.0, panX: 0, panY: 0 };
  syncVideoEditorSliders();
  renderVideoEditorCanvas();
});

videoEditorApplyBtn?.addEventListener('click', () => {
  videoFraming = { ...tempVideoFraming };
  updateRotation();
  closeVideoEditorSheet();
  showSnackbar(t('videoFramingApplied'));
});

quickCropVideoBtn?.addEventListener('click', openVideoEditorSheet);
videoEditorCloseBtn?.addEventListener('click', closeVideoEditorSheet);
videoEditorScrim?.addEventListener('click', closeVideoEditorSheet);

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

// Resolution Radios & Hero Feature Trigger
doc.querySelectorAll('input[name="targetResolution"]').forEach(radio => {
  radio.addEventListener('change', () => {
    currentResolution = parseInt(radio.value, 10) || 720;
    updateResolutionUI();
    showSnackbar(currentResolution === 1080 ? "Resolusi disetel ke 1080p FHD" : "Resolusi disetel ke 720p HD");
  });
});

heroResFeature?.addEventListener('click', () => {
  currentResolution = currentResolution === 720 ? 1080 : 720;
  const r720 = doc.querySelector('input[name="targetResolution"][value="720"]');
  const r1080 = doc.querySelector('input[name="targetResolution"][value="1080"]');
  if (currentResolution === 720 && r720) r720.checked = true;
  if (currentResolution === 1080 && r1080) r1080.checked = true;
  updateResolutionUI();
  showSnackbar(currentResolution === 1080 ? "Resolusi disetel ke 1080p FHD" : "Resolusi disetel ke 720p HD");
});

// Privacy Modal Triggers
privacyFeatureBtn?.addEventListener('click', openPrivacySheet);
privacyCloseBtn?.addEventListener('click', closePrivacySheet);
privacyScrim?.addEventListener('click', closePrivacySheet);
btnPrivacyGotit?.addEventListener('click', closePrivacySheet);

// File Chooser Triggers
pickBtn?.addEventListener('click', () => videoFileInput?.click());
dropzone?.addEventListener('click', (e) => {
  if (e.target !== pickBtn) videoFileInput?.click();
});

videoFileInput?.addEventListener('change', (e) => {
  if (e.target.files && e.target.files[0]) {
    loadVideo(e.target.files[0]);
    if (videoFileInput) videoFileInput.value = '';
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
  closeEditorSheet();
  closeVideoEditorSheet();
  videoFraming = { zoom: 1.0, panX: 0, panY: 0 };
  tempVideoFraming = { zoom: 1.0, panX: 0, panY: 0 };
  dropzone?.classList.remove('hidden');
  if (videoFileInput) videoFileInput.value = '';
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
  closeEditorSheet();
  closeVideoEditorSheet();
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

    // 1. Prepare Cover Photo (Custom/Edited image OR extracted video frame with aspect ratio crop & video framing)
    updateProgress(15, t('progressExtractCover'));
    let coverResult;
    if (customCoverState && customCoverState.active) {
      coverResult = customCoverState;
    } else {
      coverResult = await extractCoverFrame(sourceVideo, keyframeTime, 0.90, getMaxDimension(), currentRotation, currentAspectRatio, videoFraming);
    }

    // 2. Prepare & Trim Video Segment (Smooth 30fps FastStart H.264 with identical crop & framing)
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
      currentAspectRatio,
      videoFraming,
      getMaxDimension()
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
        resTotalSize.textContent = `${formatBytes(generatedResult.totalSize)} • ${duration.toFixed(1)}s • ${currentResolution}p @ 30fps`;
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
