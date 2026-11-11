/**
 * motionEngine.js — v4.0
 * 100% client-side engine for Android Motion Photo (Google Camera spec).
 *
 * Key points:
 * - Output MP4 is always a real FastStart H.264 MP4 (never WebM). If it can't be made, we throw
 *   instead of silently producing a file that won't be recognised as a Live Photo.
 * - Frames are captured with sequential playback (requestVideoFrameCallback) and timestamped
 *   with the real media time, so duration and speed always match the selected range.
 * - The hardware encoder is always closed in `finally`, so generating repeatedly never hangs.
 */

import Mp4MuxerModule from './lib/mp4-muxer.js?v=4.0';
const Mp4Muxer = Mp4MuxerModule.default || Mp4MuxerModule;

const FPS = 30;
const FRAME_US = Math.round(1_000_000 / FPS);
const MAX_DIM = 1280; // 720p class — smooth on every Android device

/* ------------------------------------------------------------------ */
/* Metadata                                                            */
/* ------------------------------------------------------------------ */

/**
 * Builds standard Google Camera / Android Motion Photo XMP metadata.
 * @param {number} presentationTimestampUs Timestamp of the still photo inside the video (µs)
 * @param {number} videoByteLength Exact byte size of the appended MP4
 * @returns {string}
 */
export function buildGoogleMotionPhotoXMP(presentationTimestampUs, videoByteLength) {
  const ts = Math.round(presentationTimestampUs);
  const vLen = Math.round(videoByteLength);

  return (
    `<x:xmpmeta xmlns:x="adobe:ns:meta/" x:xmptk="Adobe XMP Core 5.1.0-jc003">` +
    `<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">` +
      `<rdf:Description rdf:about="" ` +
        `xmlns:GCamera="http://ns.google.com/photos/1.0/camera/" ` +
        `xmlns:Container="http://ns.google.com/photos/1.0/container/" ` +
        `xmlns:Item="http://ns.google.com/photos/1.0/container/item/" ` +
        `GCamera:MotionPhoto="1" ` +
        `GCamera:MotionPhotoVersion="1" ` +
        `GCamera:MotionPhotoPresentationTimestampUs="${ts}" ` +
        `GCamera:MicroVideo="1" ` +
        `GCamera:MicroVideoVersion="1" ` +
        `GCamera:MicroVideoOffset="${vLen}" ` +
        `GCamera:MicroVideoPresentationTimestampUs="${ts}">` +
        `<Container:Directory>` +
          `<rdf:Seq>` +
            `<rdf:li rdf:parseType="Resource">` +
              `<Container:Item Item:Mime="image/jpeg" Item:Semantic="Primary" Item:Length="0" Item:Padding="0"/>` +
            `</rdf:li>` +
            `<rdf:li rdf:parseType="Resource">` +
              `<Container:Item Item:Mime="video/mp4" Item:Semantic="MotionPhoto" Item:Length="${vLen}" Item:Padding="0"/>` +
            `</rdf:li>` +
          `</rdf:Seq>` +
        `</Container:Directory>` +
      `</rdf:Description>` +
    `</rdf:RDF>` +
    `</x:xmpmeta>`
  );
}

/**
 * Injects an Adobe XMP APP1 segment into a JPEG byte array.
 * @param {Uint8Array} jpegBytes
 * @param {string} xmpString
 * @returns {Uint8Array}
 */
export function injectXMPIntoJPEG(jpegBytes, xmpString) {
  if (jpegBytes[0] !== 0xFF || jpegBytes[1] !== 0xD8) {
    throw new Error("File JPEG tidak valid (SOI marker hilang).");
  }

  const encoder = new TextEncoder();
  const xmpHeaderBytes = encoder.encode("http://ns.adobe.com/xap/1.0/\0");
  const xmpXmlBytes = encoder.encode(xmpString);

  const app1PayloadLength = 2 + xmpHeaderBytes.length + xmpXmlBytes.length;
  if (app1PayloadLength > 0xFFFF) {
    throw new Error("XMP terlalu besar untuk satu segmen APP1.");
  }

  const app1Segment = new Uint8Array(2 + app1PayloadLength);
  app1Segment[0] = 0xFF;
  app1Segment[1] = 0xE1;
  app1Segment[2] = (app1PayloadLength >> 8) & 0xFF;
  app1Segment[3] = app1PayloadLength & 0xFF;
  app1Segment.set(xmpHeaderBytes, 4);
  app1Segment.set(xmpXmlBytes, 4 + xmpHeaderBytes.length);

  // Insert after SOI, or after APP0 (JFIF) if present
  let insertPos = 2;
  if (jpegBytes.length > 4 && jpegBytes[2] === 0xFF && jpegBytes[3] === 0xE0) {
    const app0Len = (jpegBytes[4] << 8) | jpegBytes[5];
    insertPos = 4 + app0Len;
  }

  const result = new Uint8Array(jpegBytes.length + app1Segment.length);
  result.set(jpegBytes.subarray(0, insertPos), 0);
  result.set(app1Segment, insertPos);
  result.set(jpegBytes.subarray(insertPos), insertPos + app1Segment.length);
  return result;
}

/**
 * Android Motion Photo: [JPEG + XMP] followed by the MP4, which must sit exactly at EOF.
 * @param {Uint8Array} jpegBytes
 * @param {Uint8Array} mp4Bytes
 * @param {number} presentationTimestampUs
 * @returns {Uint8Array}
 */
export function createGoogleMotionPhoto(jpegBytes, mp4Bytes, presentationTimestampUs) {
  const xmpString = buildGoogleMotionPhotoXMP(presentationTimestampUs, mp4Bytes.byteLength);
  const modifiedJpeg = injectXMPIntoJPEG(jpegBytes, xmpString);

  const combined = new Uint8Array(modifiedJpeg.byteLength + mp4Bytes.byteLength);
  combined.set(modifiedJpeg, 0);
  combined.set(mp4Bytes, modifiedJpeg.byteLength);
  return combined;
}

/**
 * Builds Apple Live Photo metadata XMP for JPEG.
 * @param {string} assetUUID
 * @returns {string}
 */
export function buildAppleLivePhotoXMP(assetUUID) {
  return (
    `<x:xmpmeta xmlns:x="adobe:ns:meta/" x:xmptk="Adobe XMP Core 5.1.0-jc003">` +
    `<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">` +
      `<rdf:Description rdf:about="" ` +
        `xmlns:ApplePhoto="http://ns.apple.com/livephoto/1.0/" ` +
        `ApplePhoto:ContentIdentifier="${assetUUID}">` +
      `</rdf:Description>` +
    `</rdf:RDF>` +
    `</x:xmpmeta>`
  );
}

/**
 * Creates Apple Live Photo paired assets (.jpg + .mov).
 * @param {Uint8Array} jpegBytes
 * @param {Uint8Array} videoBytes
 * @param {string} assetUUID
 * @returns {{ photoBytes: Uint8Array, videoBytes: Uint8Array, uuid: string }}
 */
export function createAppleLivePhoto(jpegBytes, videoBytes, assetUUID = null) {
  const uuid = assetUUID || (crypto.randomUUID ? crypto.randomUUID().toUpperCase() : 'A1B2C3D4-E5F6-7890-ABCD-EF1234567890');
  return {
    photoBytes: injectXMPIntoJPEG(jpegBytes, buildAppleLivePhotoXMP(uuid)),
    videoBytes,
    uuid
  };
}

/** True when the bytes start like an ISO-BMFF / MP4 file ("....ftyp"). */
export function isValidMp4(bytes) {
  return !!bytes && bytes.length > 12 &&
    String.fromCharCode(bytes[4], bytes[5], bytes[6], bytes[7]) === 'ftyp';
}

/* ------------------------------------------------------------------ */
/* Frame helpers                                                       */
/* ------------------------------------------------------------------ */

/**
 * Seeks a video and resolves when the frame is ready (with a timeout safety net).
 * @param {HTMLVideoElement} video
 * @param {number} time
 * @param {number} timeoutMs
 */
export function waitSeek(video, time, timeoutMs = 1500) {
  return new Promise((resolve) => {
    let done = false;
    let timer = null;
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      video.removeEventListener('seeked', finish);
      resolve();
    };
    timer = setTimeout(finish, timeoutMs);
    video.addEventListener('seeked', finish);

    const maxT = Number.isFinite(video.duration) ? Math.max(0, video.duration - 0.01) : time;
    const target = Math.max(0, Math.min(time, maxT));
    if (Math.abs(video.currentTime - target) < 0.005 && video.readyState >= 2) {
      finish();
      return;
    }
    video.currentTime = target;
  });
}

/**
 * Output size after rotation, capped to `maxDim` and rounded to even numbers (H.264).
 * @param {HTMLVideoElement} video
 * @param {number} rotation
 * @param {number} maxDim
 */
export function computeOutputSize(video, rotation, maxDim = MAX_DIM) {
  const srcW = video.videoWidth || 1280;
  const srcH = video.videoHeight || 720;
  const rot90 = rotation === 90 || rotation === 270;
  let w = rot90 ? srcH : srcW;
  let h = rot90 ? srcW : srcH;
  const scale = Math.min(1, maxDim / Math.max(w, h));
  w = Math.max(2, Math.round((w * scale) / 2) * 2);
  h = Math.max(2, Math.round((h * scale) / 2) * 2);
  return { w, h };
}

/**
 * Draws the current video frame into a w×h canvas context, rotated upright.
 * @param {CanvasRenderingContext2D} ctx
 * @param {HTMLVideoElement} video
 * @param {number} rotation
 * @param {number} w
 * @param {number} h
 */
export function drawRotated(ctx, video, rotation, w, h) {
  const rot90 = rotation === 90 || rotation === 270;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (rotation === 90) {
    ctx.translate(w, 0);
    ctx.rotate(Math.PI / 2);
  } else if (rotation === 180) {
    ctx.translate(w, h);
    ctx.rotate(Math.PI);
  } else if (rotation === 270) {
    ctx.translate(0, h);
    ctx.rotate(-Math.PI / 2);
  }
  ctx.drawImage(video, 0, 0, rot90 ? h : w, rot90 ? w : h);
  ctx.restore();
}

/**
 * Extracts an upright still JPEG from the video at `timestamp`.
 * @returns {Promise<{ blob: Blob, uint8Array: Uint8Array, width: number, height: number }>}
 */
export async function extractCoverFrame(video, timestamp, quality = 0.92, maxDimension = MAX_DIM, rotation = 0) {
  video.pause();
  await waitSeek(video, timestamp);

  const { w, h } = computeOutputSize(video, rotation, maxDimension);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { alpha: false });
  drawRotated(ctx, video, rotation, w, h);

  const dataUrl = canvas.toDataURL('image/jpeg', quality);
  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Gagal membuat foto sampul."))), 'image/jpeg', quality);
  });
  const uint8Array = new Uint8Array(await blob.arrayBuffer());
  canvas.width = canvas.height = 0; // release GPU memory
  return { blob, uint8Array, width: w, height: h, dataUrl };
}

/* ------------------------------------------------------------------ */
/* Video encoding                                                      */
/* ------------------------------------------------------------------ */

function withTimeout(promise, ms, message) {
  let timer;
  return Promise.race([
    promise.finally(() => clearTimeout(timer)),
    new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(message)), ms); })
  ]);
}

async function pickEncoderConfig(w, h) {
  // Baseline / Main / High at levels that comfortably fit 720p–1080p
  const codecs = ['avc1.42002a', 'avc1.420028', 'avc1.4d0028', 'avc1.640028', 'avc1.42001f'];
  for (const codec of codecs) {
    const config = { codec, width: w, height: h, bitrate: 5_000_000, framerate: FPS, avc: { format: 'avc' } };
    try {
      const support = await VideoEncoder.isConfigSupported(config);
      if (support && support.supported) return config;
    } catch (_) { /* try next */ }
  }
  return null;
}

async function encodeWithWebCodecs(video, startTime, endTime, rotation, w, h, config, onProgress) {
  const duration = endTime - startTime;
  let finalized = false;
  let encoderError = null;
  let stopped = false;
  let frames = 0;
  let lastTs = -Infinity;

  const muxer = new Mp4Muxer.Muxer({
    target: new Mp4Muxer.ArrayBufferTarget(),
    video: { codec: 'avc', width: w, height: h },
    fastStart: 'in-memory',
    firstTimestampBehavior: 'offset'
  });

  const encoder = new VideoEncoder({
    output: (chunk, meta) => { if (!finalized) muxer.addVideoChunk(chunk, meta); },
    error: (e) => { encoderError = e; }
  });

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { alpha: false });

  const encodeAt = (tUs) => {
    drawRotated(ctx, video, rotation, w, h);
    const frame = new VideoFrame(canvas, { timestamp: tUs, duration: FRAME_US });
    try {
      encoder.encode(frame, { keyFrame: frames % 15 === 0 });
    } finally {
      frame.close();
    }
    lastTs = tUs;
    frames++;
  };

  try {
    encoder.configure(config);

    await waitSeek(video, startTime);
    encodeAt(0); // guarantee the first frame
    video.playbackRate = 1;

    const hasRVFC = typeof video.requestVideoFrameCallback === 'function';
    const minGap = FRAME_US * 0.8;

    await new Promise((resolve) => {
      let useRaf = !hasRVFC;
      let lastCb = performance.now();
      let safety = null;
      let watchdog = null;

      const finish = () => {
        if (stopped) return;
        stopped = true;
        clearTimeout(safety);
        clearInterval(watchdog);
        video.removeEventListener('ended', finish);
        video.pause();
        resolve();
      };

      const schedule = () => {
        if (stopped) return;
        if (useRaf) requestAnimationFrame(() => onFrame(0, null, true));
        else video.requestVideoFrameCallback(onFrame);
      };

      function onFrame(_now, meta, fromRaf) {
        if (stopped) return;
        if (!fromRaf && useRaf) return; // stale rVFC chain after switching to rAF
        lastCb = performance.now();
        if (encoderError) { finish(); return; }

        const mediaTime = meta && typeof meta.mediaTime === 'number' ? meta.mediaTime : video.currentTime;
        if (mediaTime >= endTime - 0.001) { finish(); return; }

        const tUs = Math.round((mediaTime - startTime) * 1_000_000);
        if (tUs > 0 && tUs - lastTs >= minGap) {
          encodeAt(tUs);
          // Slow playback down if the hardware encoder falls behind — keeps every frame
          if (encoder.encodeQueueSize > 6 && video.playbackRate > 0.5) video.playbackRate = 0.5;
          else if (encoder.encodeQueueSize < 2 && video.playbackRate < 1) video.playbackRate = 1;
        }

        onProgress(Math.min(99, Math.max(0, Math.round(((mediaTime - startTime) / duration) * 100))));
        schedule();
      }

      // If rVFC stops firing (e.g. video scrolled off-screen), fall back to rAF polling
      watchdog = setInterval(() => {
        if (!stopped && !useRaf && performance.now() - lastCb > 500) {
          useRaf = true;
          schedule();
        }
      }, 250);

      safety = setTimeout(finish, (duration / 0.5) * 1000 + 6000);
      video.addEventListener('ended', finish);
      schedule();
      video.play().catch(() => finish());
    });

    if (encoderError) throw encoderError;
    if (frames < 5) throw new Error("Gagal menangkap frame video. Coba lagi.");

    await withTimeout(encoder.flush(), 20000, "Encoder terlalu lama merespons.");
    if (encoderError) throw encoderError;

    muxer.finalize();
    finalized = true;
    onProgress(100);
    return new Uint8Array(muxer.target.buffer);
  } finally {
    stopped = true;
    finalized = true;
    video.pause();
    video.playbackRate = 1;
    if (encoder.state !== 'closed') {
      try { encoder.close(); } catch (_) { /* ignore */ }
    }
    canvas.width = canvas.height = 0;
  }
}

async function recordWithMediaRecorder(video, startTime, endTime, rotation, w, h, onProgress) {
  const types = ['video/mp4;codecs=avc1.42E01E', 'video/mp4;codecs=avc1', 'video/mp4'];
  const mimeType = typeof MediaRecorder !== 'undefined'
    ? types.find((t) => MediaRecorder.isTypeSupported(t))
    : null;
  if (!mimeType) {
    throw new Error("Browser ini belum mendukung pembuatan MP4. Gunakan Google Chrome versi terbaru.");
  }

  const duration = endTime - startTime;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { alpha: false });

  await waitSeek(video, startTime);
  drawRotated(ctx, video, rotation, w, h);

  const stream = canvas.captureStream(FPS);
  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 5_000_000 });
  const chunks = [];
  recorder.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
  const stoppedPromise = new Promise((resolve) => { recorder.onstop = resolve; });
  recorder.start();

  await new Promise((resolve) => {
    let done = false;
    let safety = null;
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(safety);
      video.pause();
      resolve();
    };
    const tick = () => {
      if (done) return;
      drawRotated(ctx, video, rotation, w, h);
      const t = video.currentTime;
      onProgress(Math.min(99, Math.max(0, Math.round(((t - startTime) / duration) * 100))));
      if (t >= endTime || video.ended) { finish(); return; }
      requestAnimationFrame(tick);
    };
    safety = setTimeout(finish, duration * 1000 + 5000);
    video.play().then(() => requestAnimationFrame(tick)).catch(finish);
  });

  recorder.stop();
  await stoppedPromise;
  stream.getTracks().forEach((t) => t.stop());
  canvas.width = canvas.height = 0;

  const blob = new Blob(chunks, { type: 'video/mp4' });
  onProgress(100);
  return new Uint8Array(await blob.arrayBuffer());
}

/**
 * Cuts [startTime, endTime] from the video into an upright, 30fps, ≤720p H.264 MP4.
 * @param {HTMLVideoElement} video
 * @param {number} startTime
 * @param {number} endTime
 * @param {File|Blob} _originalFile (unused, kept for API compatibility)
 * @param {number} rotation
 * @param {(p:number)=>void} onProgress
 * @returns {Promise<Uint8Array>}
 */
export async function trimVideoClip(video, startTime, endTime, _originalFile, rotation = 0, onProgress = () => {}) {
  video.pause();
  video.muted = true;
  video.playsInline = true;

  const { w, h } = computeOutputSize(video, rotation);

  if (typeof VideoEncoder !== 'undefined' && typeof VideoFrame !== 'undefined' && Mp4Muxer) {
    const config = await pickEncoderConfig(w, h);
    if (config) {
      try {
        return await encodeWithWebCodecs(video, startTime, endTime, rotation, w, h, config, onProgress);
      } catch (err) {
        console.warn("WebCodecs gagal, mencoba MediaRecorder:", err);
      }
    }
  }

  return recordWithMediaRecorder(video, startTime, endTime, rotation, w, h, onProgress);
}
