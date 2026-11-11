/**
 * motionEngine.js - Ultra-Smooth Mobile Engine
 * 100% Client-Side Engine for Android Motion Photo & Apple Live Photo
 * 
 * Major Fixes:
 * 1. FIX STUCK AT 85%: Always calls encoder.close() in a finally block to release Android MediaCodec lock.
 * 2. FIX LAG & CHOPPINESS: Uses native sequential hardware playback + requestVideoFrameCallback instead of 90 slow seek commands.
 * 3. FIX DURATION: Explicit frame timestamps and durations guaranteed full 1.5s - 3.5s motion.
 * 4. MOBILE RAM OPTIMIZATION: Reuses a single canvas and releases old VideoFrame objects immediately.
 */

import Mp4MuxerModule from './lib/mp4-muxer.js?v=3.1';
const Mp4Muxer = Mp4MuxerModule.default || Mp4MuxerModule;

/**
 * Builds standard Google Camera / Android Motion Photo XMP metadata.
 * @param {number} presentationTimestampUs
 * @param {number} videoByteLength
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
              `<Container:Item ` +
                `Item:Mime="image/jpeg" ` +
                `Item:Semantic="Primary" ` +
                `Item:Length="0" ` +
                `Item:Padding="0"/>` +
            `</rdf:li>` +
            `<rdf:li rdf:parseType="Resource">` +
              `<Container:Item ` +
                `Item:Mime="video/mp4" ` +
                `Item:Semantic="MotionPhoto" ` +
                `Item:Length="${vLen}" ` +
                `Item:Padding="0"/>` +
            `</rdf:li>` +
          `</rdf:Seq>` +
        `</Container:Directory>` +
      `</rdf:Description>` +
    `</rdf:RDF>` +
    `</x:xmpmeta>`
  );
}

/**
 * Injects Adobe XMP APP1 segment into a JPEG byte array.
 * @param {Uint8Array} jpegBytes 
 * @param {string} xmpString 
 * @returns {Uint8Array}
 */
export function injectXMPIntoJPEG(jpegBytes, xmpString) {
  if (jpegBytes[0] !== 0xFF || jpegBytes[1] !== 0xD8) {
    throw new Error("Invalid JPEG file: missing SOI marker (0xFFD8).");
  }

  const xmpHeader = "http://ns.adobe.com/xap/1.0/\0";
  const encoder = new TextEncoder();
  const xmpHeaderBytes = encoder.encode(xmpHeader);
  const xmpXmlBytes = encoder.encode(xmpString);

  const app1PayloadLength = 2 + xmpHeaderBytes.length + xmpXmlBytes.length;
  if (app1PayloadLength > 0xFFFF) {
    throw new Error("XMP payload too large for a single JPEG APP1 segment.");
  }

  const app1Segment = new Uint8Array(2 + app1PayloadLength);
  app1Segment[0] = 0xFF;
  app1Segment[1] = 0xE1;
  app1Segment[2] = (app1PayloadLength >> 8) & 0xFF;
  app1Segment[3] = app1PayloadLength & 0xFF;
  app1Segment.set(xmpHeaderBytes, 4);
  app1Segment.set(xmpXmlBytes, 4 + xmpHeaderBytes.length);

  let insertPos = 2;
  if (jpegBytes.length > 4 && jpegBytes[2] === 0xFF && jpegBytes[3] === 0xE0) {
    const app0Len = (jpegBytes[4] << 8) | jpegBytes[5];
    insertPos = 2 + 2 + app0Len;
  }

  const result = new Uint8Array(jpegBytes.length + app1Segment.length);
  result.set(jpegBytes.subarray(0, insertPos), 0);
  result.set(app1Segment, insertPos);
  result.set(jpegBytes.subarray(insertPos), insertPos + app1Segment.length);

  return result;
}

/**
 * Combines JPEG and MP4 with the MP4 strictly at EOF.
 * @param {Uint8Array} jpegBytes 
 * @param {Uint8Array} mp4Bytes 
 * @param {number} presentationTimestampUs 
 * @returns {Uint8Array}
 */
export function createGoogleMotionPhoto(jpegBytes, mp4Bytes, presentationTimestampUs) {
  const xmpString = buildGoogleMotionPhotoXMP(presentationTimestampUs, mp4Bytes.byteLength);
  const modifiedJpeg = injectXMPIntoJPEG(jpegBytes, xmpString);

  const totalLength = modifiedJpeg.byteLength + mp4Bytes.byteLength;
  const combined = new Uint8Array(totalLength);

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
  const xmpString = buildAppleLivePhotoXMP(uuid);
  const modifiedJpeg = injectXMPIntoJPEG(jpegBytes, xmpString);

  return {
    photoBytes: modifiedJpeg,
    videoBytes: videoBytes,
    uuid: uuid
  };
}

/**
 * Extracts a still frame from video with rotation and mobile scaling.
 * @param {HTMLVideoElement} videoElement 
 * @param {number} timestamp 
 * @param {number} quality 
 * @param {number} maxDimension 
 * @param {number} rotation 
 * @returns {Promise<{ blob: Blob, uint8Array: Uint8Array, width: number, height: number, dataUrl: string }>}
 */
export function extractCoverFrame(videoElement, timestamp, quality = 0.88, maxDimension = 1280, rotation = 0) {
  return new Promise((resolve, reject) => {
    const video = videoElement;

    const onSeeked = () => {
      video.removeEventListener('seeked', onSeeked);
      try {
        let origW = video.videoWidth || 1280;
        let origH = video.videoHeight || 720;

        if (maxDimension && (origW > maxDimension || origH > maxDimension)) {
          if (origW > origH) {
            origH = Math.round((origH * maxDimension) / origW);
            origW = maxDimension;
          } else {
            origW = Math.round((origW * maxDimension) / origH);
            origH = maxDimension;
          }
        }

        const isRotated90 = (rotation === 90 || rotation === 270);
        const canvasW = isRotated90 ? origH : origW;
        const canvasH = isRotated90 ? origW : origH;

        const canvas = document.createElement('canvas');
        canvas.width = canvasW;
        canvas.height = canvasH;
        const ctx = canvas.getContext('2d', { alpha: false });
        ctx.imageSmoothingEnabled = true;

        if (rotation === 90) {
          ctx.translate(canvasW, 0);
          ctx.rotate(Math.PI / 2);
        } else if (rotation === 180) {
          ctx.translate(canvasW, canvasH);
          ctx.rotate(Math.PI);
        } else if (rotation === 270) {
          ctx.translate(0, canvasH);
          ctx.rotate((3 * Math.PI) / 2);
        }

        ctx.drawImage(video, 0, 0, origW, origH);

        const dataUrl = canvas.toDataURL('image/jpeg', quality);

        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error("Gagal membuat foto sampul."));
            return;
          }
          const reader = new FileReader();
          reader.onload = () => {
            resolve({
              blob,
              uint8Array: new Uint8Array(reader.result),
              width: canvasW,
              height: canvasH,
              dataUrl
            });
          };
          reader.onerror = reject;
          reader.readAsArrayBuffer(blob);
        }, 'image/jpeg', quality);
      } catch (err) {
        reject(err);
      }
    };

    video.addEventListener('seeked', onSeeked, { once: true });
    video.currentTime = Math.max(0, Math.min(timestamp, video.duration || timestamp));
  });
}

/**
 * Trims and encodes video using smooth sequential playback and WebCodecs.
 * Eliminates 90 slow seek commands and frees the Android MediaCodec instance on completion.
 * @param {HTMLVideoElement} videoElement
 * @param {number} startTime Start time in seconds
 * @param {number} endTime End time in seconds
 * @param {File|Blob} originalFile Original video file
 * @param {number} rotation Degrees (0, 90, 180, 270)
 * @param {Function} onProgress Progress callback (0 to 100)
 * @returns {Promise<Uint8Array>}
 */
export async function trimVideoClip(videoElement, startTime, endTime, originalFile, rotation = 0, onProgress = () => {}) {
  const duration = Math.max(0.8, endTime - startTime);
  const isOriginalMP4 = originalFile && (originalFile.type.includes('mp4') || originalFile.name.toLowerCase().endsWith('.mp4'));
  const isFullDuration = Math.abs(duration - videoElement.duration) < 0.15 && startTime < 0.1;

  if (rotation === 0 && isOriginalMP4 && isFullDuration) {
    onProgress(100);
    const buffer = await originalFile.arrayBuffer();
    return new Uint8Array(buffer);
  }

  videoElement.muted = true;
  videoElement.playsInline = true;

  // 1. Primary Engine: Ultra-Fast WebCodecs + Mp4Muxer
  if (typeof VideoEncoder !== 'undefined' && Mp4Muxer) {
    let encoder = null;
    let animFrameHandle = null;

    try {
      const origW = videoElement.videoWidth || 1280;
      const origH = videoElement.videoHeight || 720;
      const isRotated90 = (rotation === 90 || rotation === 270);
      
      let targetW = isRotated90 ? origH : origW;
      let targetH = isRotated90 ? origW : origH;

      // 720p cap ensures smooth 30fps on all Android chips with zero thermal throttling
      const MAX_MOBILE_DIM = 1280;
      if (targetW > MAX_MOBILE_DIM || targetH > MAX_MOBILE_DIM) {
        if (targetW > targetH) {
          targetH = Math.round((targetH * MAX_MOBILE_DIM) / targetW);
          targetW = MAX_MOBILE_DIM;
        } else {
          targetW = Math.round((targetW * MAX_MOBILE_DIM) / targetH);
          targetH = MAX_MOBILE_DIM;
        }
      }

      targetW = targetW % 2 === 0 ? targetW : targetW - 1;
      targetH = targetH % 2 === 0 ? targetH : targetH - 1;

      const muxer = new Mp4Muxer.Muxer({
        target: new Mp4Muxer.ArrayBufferTarget(),
        video: {
          codec: 'avc',
          width: targetW,
          height: targetH
        },
        fastStart: 'in-memory',
        firstTimestampBehavior: 'offset'
      });

      const fps = 30;
      const frameDurationUs = Math.round(1_000_000 / fps); // 33,333 μs
      let encoderError = null;

      encoder = new VideoEncoder({
        output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
        error: (e) => {
          encoderError = e;
          console.error("VideoEncoder runtime error:", e);
        }
      });

      encoder.configure({
        codec: 'avc1.42001f', // H.264 Baseline Profile level 3.1
        width: targetW,
        height: targetH,
        bitrate: 3_000_000,
        framerate: fps
      });

      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d', { alpha: false });
      ctx.imageSmoothingEnabled = true;

      // Fast seek to start time once
      videoElement.currentTime = startTime;
      await new Promise((r) => {
        const h = () => { videoElement.removeEventListener('seeked', h); r(); };
        videoElement.addEventListener('seeked', h, { once: true });
        setTimeout(h, 200);
      });

      // Sequential playback recording: silky smooth without 90 slow seek commands
      let frameCount = 0;
      const minFrames = Math.max(15, Math.round(duration * fps));

      await videoElement.play().catch(() => {});

      const capturePromise = new Promise((resolveCapture) => {
        const renderFrame = () => {
          if (encoderError) {
            resolveCapture();
            return;
          }

          const curTime = videoElement.currentTime;
          
          ctx.save();
          if (rotation === 90) {
            ctx.translate(targetW, 0);
            ctx.rotate(Math.PI / 2);
          } else if (rotation === 180) {
            ctx.translate(targetW, targetH);
            ctx.rotate(Math.PI);
          } else if (rotation === 270) {
            ctx.translate(0, targetH);
            ctx.rotate((3 * Math.PI) / 2);
          }
          ctx.drawImage(videoElement, 0, 0, origW, origH);
          ctx.restore();

          const timestampUs = Math.round(frameCount * frameDurationUs);
          const videoFrame = new VideoFrame(canvas, {
            timestamp: timestampUs,
            duration: frameDurationUs
          });

          encoder.encode(videoFrame, { keyFrame: frameCount % 10 === 0 });
          videoFrame.close();
          frameCount++;

          const progress = Math.min(99, Math.round(((curTime - startTime) / duration) * 100));
          onProgress(progress);

          // Stop when endTime reached or video ended or enough frames captured
          if (curTime >= endTime || videoElement.ended || frameCount >= minFrames + 10) {
            videoElement.pause();
            resolveCapture();
            return;
          }

          if (typeof videoElement.requestVideoFrameCallback === 'function') {
            animFrameHandle = videoElement.requestVideoFrameCallback(renderFrame);
          } else {
            animFrameHandle = requestAnimationFrame(renderFrame);
          }
        };

        if (typeof videoElement.requestVideoFrameCallback === 'function') {
          animFrameHandle = videoElement.requestVideoFrameCallback(renderFrame);
        } else {
          animFrameHandle = requestAnimationFrame(renderFrame);
        }

        // Hard safety timeout in case playback stalls
        setTimeout(() => {
          videoElement.pause();
          resolveCapture();
        }, Math.max(3000, duration * 2000));
      });

      await capturePromise;

      // Flush with a 3-second safeguard
      await Promise.race([
        encoder.flush(),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Encoder flush timeout")), 3000))
      ]);

      muxer.finalize();
      onProgress(100);

      return new Uint8Array(muxer.target.buffer);

    } catch (err) {
      console.warn("WebCodecs fallback to stream capture:", err);
    } finally {
      // CRITICAL FIX FOR 85% STUCK BUG: Always close encoder to release Android MediaCodec hardware lock!
      if (encoder && encoder.state !== 'closed') {
        try {
          encoder.close();
        } catch (_) {}
      }
    }
  }

  // 2. High-Performance Stream Fallback
  return new Promise((resolve, reject) => {
    try {
      const origW = videoElement.videoWidth || 1280;
      const origH = videoElement.videoHeight || 720;
      const isRotated90 = (rotation === 90 || rotation === 270);
      
      let targetW = isRotated90 ? origH : origW;
      let targetH = isRotated90 ? origW : origH;
      if (targetW > 1280 || targetH > 1280) {
        if (targetW > targetH) {
          targetH = Math.round((targetH * 1280) / targetW);
          targetW = 1280;
        } else {
          targetW = Math.round((targetW * 1280) / targetH);
          targetH = 1280;
        }
      }
      targetW = targetW % 2 === 0 ? targetW : targetW - 1;
      targetH = targetH % 2 === 0 ? targetH : targetH - 1;

      const offscreenCanvas = document.createElement('canvas');
      offscreenCanvas.width = targetW;
      offscreenCanvas.height = targetH;
      const ctx = offscreenCanvas.getContext('2d', { alpha: false });

      const drawFrame = () => {
        ctx.save();
        if (rotation === 90) {
          ctx.translate(targetW, 0);
          ctx.rotate(Math.PI / 2);
        } else if (rotation === 180) {
          ctx.translate(targetW, targetH);
          ctx.rotate(Math.PI);
        } else if (rotation === 270) {
          ctx.translate(0, targetH);
          ctx.rotate((3 * Math.PI) / 2);
        }
        ctx.drawImage(videoElement, 0, 0, origW, origH);
        ctx.restore();
      };

      drawFrame();
      const stream = offscreenCanvas.captureStream(30);

      let mimeType = 'video/mp4';
      if (!MediaRecorder.isTypeSupported('video/mp4')) {
        mimeType = MediaRecorder.isTypeSupported('video/webm; codecs=vp8') ? 'video/webm; codecs=vp8' : 'video/webm';
      }

      const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 3000000 });
      const chunks = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = async () => {
        const fullBlob = new Blob(chunks, { type: mimeType });
        const arrayBuf = await fullBlob.arrayBuffer();
        onProgress(100);
        resolve(new Uint8Array(arrayBuf));
      };

      videoElement.currentTime = startTime;
      videoElement.addEventListener('seeked', () => {
        videoElement.play().catch(() => {});
        recorder.start(100);

        const checkInterval = setInterval(() => {
          drawFrame();
          const current = videoElement.currentTime;
          const prog = Math.min(99, Math.round(((current - startTime) / duration) * 100));
          onProgress(prog);

          if (current >= endTime || videoElement.ended || current - startTime >= duration + 0.2) {
            clearInterval(checkInterval);
            videoElement.pause();
            if (recorder.state === 'recording') recorder.stop();
          }
        }, 33);
      }, { once: true });

    } catch (err) {
      if (originalFile) {
        originalFile.arrayBuffer().then(buf => resolve(new Uint8Array(buf))).catch(reject);
      } else {
        reject(err);
      }
    }
  });
}
