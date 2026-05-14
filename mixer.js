/* ═══════════════════════════════════════════════
   3C Clock Carousel — mixer.js
   Video + Audio Merger
   Canvas + Web Audio API + MediaRecorder
   No WASM · No SharedArrayBuffer · No SIMD
   Works in Firefox, Chrome, Edge
   3C Thread To Success™ Cooking Lab
═══════════════════════════════════════════════ */

(function () {
  'use strict';

  // ── State ───────────────────────────────────────
  let isExporting  = false;
  let videoFile    = null;
  let audioFile    = null;
  let videoBlobURL = null;
  let audioBlobURL = null;
  let previewAudio = null;
  let volume       = 1.0;
  let audioOffset  = 0;
  let loopAudio    = false;

  // ── DOM ─────────────────────────────────────────
  const videoDropZone   = document.getElementById('videoDropZone');
  const videoFileInput  = document.getElementById('videoFileInput');
  const videoLoadedInfo = document.getElementById('videoLoadedInfo');
  const videoFileName   = document.getElementById('videoFileName');
  const videoClearBtn   = document.getElementById('videoClearBtn');

  const audioDropZone   = document.getElementById('audioDropZone');
  const audioFileInput  = document.getElementById('audioFileInput');
  const audioLoadedInfo = document.getElementById('audioLoadedInfo');
  const audioFileName   = document.getElementById('audioFileName');
  const audioClearBtn   = document.getElementById('audioClearBtn');

  const previewVideo     = document.getElementById('mixerPreviewVideo');
  const videoPlaceholder = document.getElementById('mixerVideoPlaceholder');
  const volumeSlider     = document.getElementById('mixerVolume');
  const volumeVal        = document.getElementById('mixerVolumeVal');
  const offsetSlider     = document.getElementById('mixerOffset');
  const offsetVal        = document.getElementById('mixerOffsetVal');
  const loopAudioToggle  = document.getElementById('mixerLoopAudio');
  const previewBtn       = document.getElementById('mixerPreviewBtn');
  const exportBtn        = document.getElementById('exportMp4Btn');
  const mixerStatusEl    = document.getElementById('mixerStatus');

  // ── File Handlers ──────────────────────────────
  function handleVideoFile(file) {
    if (!file || !file.type.startsWith('video/')) {
      setStatus('\u274c Please upload a video file (.webm or .mp4)');
      return;
    }
    if (videoBlobURL) URL.revokeObjectURL(videoBlobURL);
    videoFile    = file;
    videoBlobURL = URL.createObjectURL(file);
    if (previewVideo)     previewVideo.src = videoBlobURL;
    if (videoFileName)    videoFileName.textContent = file.name;
    if (videoDropZone)    videoDropZone.hidden   = true;
    if (videoLoadedInfo)  videoLoadedInfo.hidden = false;
    if (videoPlaceholder) videoPlaceholder.classList.add('hidden');
    updateExportBtn(); updatePreviewBtn();
  }

  function handleAudioFile(file) {
    if (!file || !file.type.startsWith('audio/')) {
      setStatus('\u274c Please upload an audio file (.mp3, .wav, or .m4a)');
      return;
    }
    if (audioBlobURL) URL.revokeObjectURL(audioBlobURL);
    audioFile    = file;
    audioBlobURL = URL.createObjectURL(file);
    if (audioFileName)   audioFileName.textContent = file.name;
    if (audioDropZone)   audioDropZone.hidden   = true;
    if (audioLoadedInfo) audioLoadedInfo.hidden = false;
    updateExportBtn(); updatePreviewBtn();
  }

  function clearVideo() {
    if (videoBlobURL) URL.revokeObjectURL(videoBlobURL);
    videoFile = videoBlobURL = null;
    if (previewVideo)     previewVideo.src = '';
    if (videoDropZone)    videoDropZone.hidden   = false;
    if (videoLoadedInfo)  videoLoadedInfo.hidden = true;
    if (videoPlaceholder) videoPlaceholder.classList.remove('hidden');
    updateExportBtn(); updatePreviewBtn();
  }

  function clearAudio() {
    if (audioBlobURL) URL.revokeObjectURL(audioBlobURL);
    audioFile = audioBlobURL = null;
    if (audioDropZone)   audioDropZone.hidden   = false;
    if (audioLoadedInfo) audioLoadedInfo.hidden = true;
    updateExportBtn(); updatePreviewBtn();
  }

  // ── Preview ────────────────────────────────────
  function previewMix() {
    if (!videoFile || !audioFile) return;
    if (previewAudio) { previewAudio.pause(); previewAudio = null; }

    previewAudio        = new Audio(audioBlobURL);
    previewAudio.volume = Math.min(1, volume);
    previewAudio.loop   = loopAudio;
    previewVideo.currentTime = 0;

    previewVideo.play().then(() => {
      if (audioOffset > 0) {
        setTimeout(() => {
          if (previewAudio) { previewAudio.currentTime = 0; previewAudio.play().catch(() => {}); }
        }, audioOffset * 1000);
      } else {
        previewAudio.currentTime = 0;
        previewAudio.play().catch(() => {});
      }
    }).catch(() => setStatus('\u274c Preview failed \u2014 click Preview again to retry'));

    previewVideo.onpause = () => { if (previewAudio) previewAudio.pause(); };
    previewVideo.onplay  = () => { if (previewAudio) previewAudio.play().catch(() => {}); };
    previewVideo.onended = () => { if (previewAudio) previewAudio.pause(); };

    setStatus('\u25b6 Previewing \u2014 use the video player controls to pause or seek');
  }

  // ── Export ─────────────────────────────────────
  async function exportVideo() {
    if (!videoFile || !audioFile || isExporting) return;
    if (previewAudio) { previewAudio.pause(); previewAudio = null; }

    isExporting = true;
    if (exportBtn)  exportBtn.disabled  = true;
    if (previewBtn) previewBtn.disabled = true;

    setStatus('\u23fa Setting up export\u2026');

    let audioCtx      = null;
    let animFrame     = null;
    let progressTimer = null;

    try {
      // 1. Load video
      const vid = document.createElement('video');
      vid.src   = videoBlobURL;
      vid.muted = true;
      await new Promise((res, rej) => {
        vid.onloadedmetadata = res;
        vid.onerror = () => rej(new Error('Video failed to load'));
      });

      const W = vid.videoWidth  || 540;
      const H = vid.videoHeight || 960;

      // 2. Export canvas
      const canvas = document.createElement('canvas');
      canvas.width  = W;
      canvas.height = H;
      const ctx2d   = canvas.getContext('2d');

      // 3. Web Audio
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const audioData   = await fetch(audioBlobURL).then(r => r.arrayBuffer());
      const audioBuffer = await audioCtx.decodeAudioData(audioData);

      const gainNode  = audioCtx.createGain();
      gainNode.gain.value = Math.min(2, volume);
      const audioDest = audioCtx.createMediaStreamDestination();
      gainNode.connect(audioDest);

      // 4. Combined stream
      const videoStream    = canvas.captureStream(30);
      const combinedStream = new MediaStream([
        ...videoStream.getVideoTracks(),
        ...audioDest.stream.getAudioTracks(),
      ]);

      // 5. MediaRecorder
      const mimeType = getSupportedMime();
      const recorder = new MediaRecorder(
        combinedStream,
        mimeType ? { mimeType, videoBitsPerSecond: 5000000 } : {}
      );
      const chunks = [];
      recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };

      // 6. Draw loop
      const drawFrame = () => {
        if (vid.paused || vid.ended) return;
        ctx2d.drawImage(vid, 0, 0, W, H);
        animFrame = requestAnimationFrame(drawFrame);
      };

      // 7. Start
      recorder.start(100);
      vid.currentTime = 0;
      await vid.play();
      drawFrame();

      // 8. Audio
      const startAudio = () => {
        const src  = audioCtx.createBufferSource();
        src.buffer = audioBuffer;
        src.loop   = loopAudio;
        src.connect(gainNode);
        src.start(audioCtx.currentTime);
      };
      audioOffset > 0 ? setTimeout(startAudio, audioOffset * 1000) : startAudio();

      // 9. Progress
      const duration = vid.duration || 1;
      progressTimer = setInterval(() => {
        const pct = Math.round((vid.currentTime / duration) * 100);
        setStatus('\u23fa Exporting\u2026 ' + pct + '%');
      }, 250);

      // 10. Wait for end
      await new Promise(res => { vid.onended = res; });

      clearInterval(progressTimer); progressTimer = null;
      cancelAnimationFrame(animFrame); animFrame = null;
      ctx2d.drawImage(vid, 0, 0, W, H);
      await new Promise(res => setTimeout(res, 300));

      recorder.stop();
      await new Promise(res => { recorder.onstop = res; });
      await audioCtx.close(); audioCtx = null;

      // 11. Download
      setStatus('\u23fa Packaging\u2026');
      const ext  = mimeType.includes('mp4') ? 'mp4' : 'webm';
      const blob = new Blob(chunks, { type: mimeType || 'video/webm' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = '3c-carousel-mix.' + ext;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);

      setStatus('\u2705 Export complete \u2014 3c-carousel-mix.' + ext + ' downloaded!');

    } catch (err) {
      setStatus('\u274c Export failed: ' + err.message);
      console.error('[mixer] export error:', err);
    } finally {
      if (progressTimer) clearInterval(progressTimer);
      if (animFrame)     cancelAnimationFrame(animFrame);
      if (audioCtx)      audioCtx.close().catch(() => {});
      isExporting = false;
      updateExportBtn();
      if (previewBtn) previewBtn.disabled = !(videoFile && audioFile);
    }
  }

  // ── Helpers ────────────────────────────────────
  function getSupportedMime() {
    const types = [
      'video/mp4;codecs=avc1',
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm',
    ];
    for (const t of types)
      if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t)) return t;
    return 'video/webm';
  }

  function updateExportBtn() {
    if (exportBtn) exportBtn.disabled = !(videoFile && audioFile && !isExporting);
  }
  function updatePreviewBtn() {
    if (previewBtn) previewBtn.disabled = !(videoFile && audioFile);
  }
  function setStatus(msg) { if (mixerStatusEl) mixerStatusEl.textContent = msg; }

  // ── Drop Zones ──────────────────────────────────
  function setupDropZone(zone, onFile) {
    if (!zone) return;
    zone.addEventListener('dragover',  e => { e.preventDefault(); zone.classList.add('drag-over'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
    zone.addEventListener('drop', e => {
      e.preventDefault(); zone.classList.remove('drag-over');
      if (e.dataTransfer.files[0]) onFile(e.dataTransfer.files[0]);
    });
  }

  // ── Events ──────────────────────────────────────
  setupDropZone(videoDropZone, handleVideoFile);
  setupDropZone(audioDropZone, handleAudioFile);

  if (videoDropZone) videoDropZone.addEventListener('click', () => videoFileInput && videoFileInput.click());
  if (audioDropZone) audioDropZone.addEventListener('click', () => audioFileInput && audioFileInput.click());

  if (videoFileInput) videoFileInput.addEventListener('change', () => {
    if (videoFileInput.files[0]) handleVideoFile(videoFileInput.files[0]);
    videoFileInput.value = '';
  });
  if (audioFileInput) audioFileInput.addEventListener('change', () => {
    if (audioFileInput.files[0]) handleAudioFile(audioFileInput.files[0]);
    audioFileInput.value = '';
  });

  if (videoClearBtn) videoClearBtn.addEventListener('click', clearVideo);
  if (audioClearBtn) audioClearBtn.addEventListener('click', clearAudio);

  if (volumeSlider) volumeSlider.addEventListener('input', function () {
    volume = parseFloat(this.value);
    if (volumeVal) volumeVal.textContent = Math.round(volume * 100) + '%';
    if (previewAudio) previewAudio.volume = Math.min(1, volume);
  });
  if (offsetSlider) offsetSlider.addEventListener('input', function () {
    audioOffset = parseFloat(this.value);
    if (offsetVal) offsetVal.textContent = audioOffset.toFixed(1) + 's';
  });
  if (loopAudioToggle) loopAudioToggle.addEventListener('change', function () {
    loopAudio = this.checked;
    if (previewAudio) previewAudio.loop = loopAudio;
  });

  if (previewBtn) previewBtn.addEventListener('click', previewMix);
  if (exportBtn)  exportBtn.addEventListener('click', exportVideo);

}());
