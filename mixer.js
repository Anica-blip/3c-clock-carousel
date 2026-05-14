/* ═══════════════════════════════════════════════
   3C Clock Carousel — mixer.js
   Video + Audio Merger · ffmpeg.wasm v0.11
   No Web Worker · GitHub Pages compatible
   3C Thread To Success™ Cooking Lab
═══════════════════════════════════════════════ */

// ffmpeg.wasm v0.11 is loaded via <script> tag in index.html
// It exposes a global FFmpeg object: { createFFmpeg, fetchFile }

(function () {
  'use strict';

  // ── State ───────────────────────────────────────
  let ffmpeg       = null;
  let ffmpegLoaded = false;
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
  const exportMp4Btn     = document.getElementById('exportMp4Btn');
  const mixerStatusEl    = document.getElementById('mixerStatus');
  const ffmpegLoadBtn    = document.getElementById('ffmpegLoadBtn');
  const ffmpegLoadStatus = document.getElementById('ffmpegLoadStatus');

  // ── Load FFmpeg v0.11 ────────────────────────────
  async function loadFFmpeg() {
    if (ffmpegLoaded) return;
    if (typeof FFmpeg === 'undefined' || !FFmpeg.createFFmpeg) {
      setLoadStatus('\u274c FFmpeg script not loaded yet — please refresh the page.');
      return;
    }

    setLoadStatus('\u23f3 Downloading engine\u2026 (~25MB, cached after first use)');
    if (ffmpegLoadBtn) ffmpegLoadBtn.disabled = true;

    try {
      const { createFFmpeg } = FFmpeg;

      ffmpeg = createFFmpeg({
        log: false,
        corePath: 'https://unpkg.com/@ffmpeg/core@0.11.0/dist/ffmpeg-core.js',
        progress: ({ ratio }) => {
          if (ratio > 0 && ratio < 1) {
            setStatus('\u23fa Processing\u2026 ' + Math.round(ratio * 100) + '%');
          }
        },
      });

      await ffmpeg.load();

      ffmpegLoaded = true;
      setLoadStatus('\u2705 Engine ready \u2014 load a video and audio to begin');
      if (ffmpegLoadBtn) ffmpegLoadBtn.hidden = true;
      updateExportBtn();

    } catch (err) {
      setLoadStatus('\u274c Failed to load engine: ' + err.message);
      if (ffmpegLoadBtn) {
        ffmpegLoadBtn.disabled   = false;
        ffmpegLoadBtn.textContent = '\u21ba Retry Load';
      }
      console.error('[mixer] ffmpeg load error:', err);
    }
  }

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
  async function exportMp4() {
    if (!videoFile || !audioFile || !ffmpegLoaded || isExporting) return;
    if (previewAudio) { previewAudio.pause(); previewAudio = null; }

    isExporting = true;
    if (exportMp4Btn) exportMp4Btn.disabled = true;
    if (previewBtn)   previewBtn.disabled   = true;

    const { fetchFile } = FFmpeg;
    const videoExt = (videoFile.name.split('.').pop() || 'webm').toLowerCase();
    const audioExt = (audioFile.name.split('.').pop() || 'mp3').toLowerCase();
    const vName    = 'input.' + videoExt;
    const aName    = 'input.' + audioExt;

    try {
      setStatus('\u23fa Loading video\u2026');
      ffmpeg.FS('writeFile', vName, await fetchFile(videoFile));

      setStatus('\u23fa Loading audio\u2026');
      ffmpeg.FS('writeFile', aName, await fetchFile(audioFile));

      setStatus('\u23fa Merging\u2026');

      // Build ffmpeg command
      const args = ['-i', vName];
      if (audioOffset > 0) args.push('-itsoffset', String(audioOffset));
      if (loopAudio)       args.push('-stream_loop', '-1');
      args.push('-i', aName);
      args.push('-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '23');
      args.push('-c:a', 'aac', '-b:a', '192k');
      if (volume !== 1.0)  args.push('-af', 'volume=' + volume.toFixed(2));
      args.push('-shortest', '-y', 'output.mp4');

      await ffmpeg.run(...args);

      setStatus('\u23fa Packaging\u2026');
      const data = ffmpeg.FS('readFile', 'output.mp4');
      const blob = new Blob([data.buffer], { type: 'video/mp4' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = '3c-carousel-mix.mp4';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);

      // Clean up virtual FS
      try { ffmpeg.FS('unlink', vName);       } catch (_) {}
      try { ffmpeg.FS('unlink', aName);       } catch (_) {}
      try { ffmpeg.FS('unlink', 'output.mp4'); } catch (_) {}

      setStatus('\u2705 Export complete \u2014 3c-carousel-mix.mp4 downloaded!');

    } catch (err) {
      setStatus('\u274c Export failed: ' + err.message);
      console.error('[mixer] export error:', err);
    } finally {
      isExporting = false;
      updateExportBtn();
      if (previewBtn) previewBtn.disabled = !(videoFile && audioFile);
    }
  }

  // ── UI Helpers ─────────────────────────────────
  function updateExportBtn() {
    if (exportMp4Btn) exportMp4Btn.disabled = !(videoFile && audioFile && ffmpegLoaded && !isExporting);
  }
  function updatePreviewBtn() {
    if (previewBtn) previewBtn.disabled = !(videoFile && audioFile);
  }
  function setStatus(msg)     { if (mixerStatusEl)    mixerStatusEl.textContent    = msg; }
  function setLoadStatus(msg) { if (ffmpegLoadStatus) ffmpegLoadStatus.textContent = msg; }

  // ── Drop Zone Helpers ───────────────────────────
  function setupDropZone(zone, onFile) {
    if (!zone) return;
    zone.addEventListener('dragover',  e => { e.preventDefault(); zone.classList.add('drag-over'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
    zone.addEventListener('drop', e => {
      e.preventDefault(); zone.classList.remove('drag-over');
      if (e.dataTransfer.files[0]) onFile(e.dataTransfer.files[0]);
    });
  }

  // ── Event Listeners ─────────────────────────────
  setupDropZone(videoDropZone, handleVideoFile);
  setupDropZone(audioDropZone, handleAudioFile);

  if (videoDropZone)   videoDropZone.addEventListener('click', () => videoFileInput && videoFileInput.click());
  if (audioDropZone)   audioDropZone.addEventListener('click', () => audioFileInput && audioFileInput.click());

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

  if (previewBtn)   previewBtn.addEventListener('click', previewMix);
  if (exportMp4Btn) exportMp4Btn.addEventListener('click', exportMp4);
  if (ffmpegLoadBtn) ffmpegLoadBtn.addEventListener('click', loadFFmpeg);

  // Auto-load when mixer tab is opened
  document.addEventListener('mixerTabOpened', () => {
    if (!ffmpegLoaded) loadFFmpeg();
  });

}());
