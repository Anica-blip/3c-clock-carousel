/* ═══════════════════════════════════════════════
   3C Clock Carousel — mixer.js
   Video + Audio Merger · ffmpeg.wasm
   3C Thread To Success™ Cooking Lab
═══════════════════════════════════════════════ */

import { FFmpeg }              from 'https://unpkg.com/@ffmpeg/ffmpeg@0.12.10/dist/esm/index.js';
import { fetchFile, toBlobURL } from 'https://unpkg.com/@ffmpeg/util@0.12.1/dist/esm/index.js';

// ── State ─────────────────────────────────────────
let ffmpeg       = null;
let ffmpegLoaded = false;
let isExporting  = false;
let videoFile    = null;
let audioFile    = null;
let videoBlobURL = null;
let audioBlobURL = null;
let previewAudio = null;   // HTMLAudioElement for preview sync
let volume       = 1.0;
let audioOffset  = 0;
let loopAudio    = false;

// ── DOM ───────────────────────────────────────────
const videoDropZone    = document.getElementById('videoDropZone');
const videoFileInput   = document.getElementById('videoFileInput');
const videoLoadedInfo  = document.getElementById('videoLoadedInfo');
const videoFileName    = document.getElementById('videoFileName');
const videoClearBtn    = document.getElementById('videoClearBtn');

const audioDropZone    = document.getElementById('audioDropZone');
const audioFileInput   = document.getElementById('audioFileInput');
const audioLoadedInfo  = document.getElementById('audioLoadedInfo');
const audioFileName    = document.getElementById('audioFileName');
const audioClearBtn    = document.getElementById('audioClearBtn');

const previewVideo        = document.getElementById('mixerPreviewVideo');
const videoPlaceholder    = document.getElementById('mixerVideoPlaceholder');
const volumeSlider        = document.getElementById('mixerVolume');
const volumeVal           = document.getElementById('mixerVolumeVal');
const offsetSlider        = document.getElementById('mixerOffset');
const offsetVal           = document.getElementById('mixerOffsetVal');
const loopAudioToggle     = document.getElementById('mixerLoopAudio');
const previewBtn          = document.getElementById('mixerPreviewBtn');
const exportMp4Btn        = document.getElementById('exportMp4Btn');
const mixerStatusEl       = document.getElementById('mixerStatus');
const ffmpegLoadBtn       = document.getElementById('ffmpegLoadBtn');
const ffmpegLoadStatusEl  = document.getElementById('ffmpegLoadStatus');

// ── Load FFmpeg Engine ────────────────────────────
async function loadFFmpeg() {
  if (ffmpegLoaded) return;

  setLoadStatus('⏳ Downloading engine… (~30MB, cached after first use)');
  if (ffmpegLoadBtn) ffmpegLoadBtn.disabled = true;

  try {
    ffmpeg = new FFmpeg();

    // Log ffmpeg output to console (useful for debugging)
    ffmpeg.on('log', ({ message }) => console.log('[ffmpeg]', message));

    // Progress during export
    ffmpeg.on('progress', ({ progress }) => {
      if (!isNaN(progress) && progress < 1) {
        setStatus('\u23fa Processing\u2026 ' + Math.round(progress * 100) + '%');
      }
    });

    const base = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
    await ffmpeg.load({
      coreURL: await toBlobURL(base + '/ffmpeg-core.js',   'text/javascript'),
      wasmURL: await toBlobURL(base + '/ffmpeg-core.wasm', 'application/wasm'),
    });

    ffmpegLoaded = true;
    setLoadStatus('\u2705 Engine ready — load a video and audio to begin');
    if (ffmpegLoadBtn) ffmpegLoadBtn.hidden = true;
    updateExportBtn();

  } catch (err) {
    setLoadStatus('\u274c Failed to load engine: ' + err.message);
    if (ffmpegLoadBtn) { ffmpegLoadBtn.disabled = false; ffmpegLoadBtn.textContent = '\u21ba Retry Load'; }
    console.error('[mixer] ffmpeg load error:', err);
  }
}

// ── File Handlers ─────────────────────────────────
function handleVideoFile(file) {
  if (!file || !file.type.startsWith('video/')) {
    setStatus('\u274c Please upload a video file (.webm or .mp4)');
    return;
  }
  if (videoBlobURL) URL.revokeObjectURL(videoBlobURL);
  videoFile    = file;
  videoBlobURL = URL.createObjectURL(file);
  previewVideo.src = videoBlobURL;
  if (videoFileName) videoFileName.textContent = file.name;
  if (videoDropZone)   videoDropZone.hidden   = true;
  if (videoLoadedInfo) videoLoadedInfo.hidden = false;
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
  if (audioFileName) audioFileName.textContent = file.name;
  if (audioDropZone)   audioDropZone.hidden   = true;
  if (audioLoadedInfo) audioLoadedInfo.hidden = false;
  updateExportBtn(); updatePreviewBtn();
}

function clearVideo() {
  if (videoBlobURL) URL.revokeObjectURL(videoBlobURL);
  videoFile = videoBlobURL = null;
  if (previewVideo) previewVideo.src = '';
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

// ── Preview ───────────────────────────────────────
function previewMix() {
  if (!videoFile || !audioFile) return;

  // Stop any existing preview audio
  if (previewAudio) { previewAudio.pause(); previewAudio = null; }

  // Create audio element for sync playback
  previewAudio         = new Audio(audioBlobURL);
  previewAudio.volume  = volume;
  previewAudio.loop    = loopAudio;

  // Reset video to start
  previewVideo.currentTime = 0;

  previewVideo.play()
    .then(() => {
      // Delay audio start if offset > 0
      if (audioOffset > 0) {
        setTimeout(() => {
          if (previewAudio) { previewAudio.currentTime = 0; previewAudio.play().catch(() => {}); }
        }, audioOffset * 1000);
      } else {
        previewAudio.currentTime = 0;
        previewAudio.play().catch(() => {});
      }
    })
    .catch(() => setStatus('\u274c Preview failed — click Preview again to retry'));

  // Sync pause/resume
  previewVideo.onpause = () => { if (previewAudio) previewAudio.pause(); };
  previewVideo.onplay  = () => { if (previewAudio) previewAudio.play().catch(() => {}); };
  previewVideo.onended = () => { if (previewAudio) previewAudio.pause(); };
  previewVideo.onseeked = () => {
    if (previewAudio && !previewVideo.paused) previewAudio.play().catch(() => {});
  };

  setStatus('\u25b6 Previewing — use the video player controls to pause or seek');
}

// ── Export ────────────────────────────────────────
async function exportMp4() {
  if (!videoFile || !audioFile || !ffmpegLoaded || isExporting) return;

  // Stop any preview
  if (previewAudio) { previewAudio.pause(); previewAudio = null; }

  isExporting = true;
  if (exportMp4Btn) exportMp4Btn.disabled = true;
  if (previewBtn)   previewBtn.disabled   = true;

  const videoExt = (videoFile.name.split('.').pop() || 'webm').toLowerCase();
  const audioExt = (audioFile.name.split('.').pop() || 'mp3').toLowerCase();
  const vName    = 'input.' + videoExt;
  const aName    = 'input.' + audioExt;

  try {
    setStatus('\u23fa Loading video\u2026');
    await ffmpeg.writeFile(vName, await fetchFile(videoFile));

    setStatus('\u23fa Loading audio\u2026');
    await ffmpeg.writeFile(aName, await fetchFile(audioFile));

    setStatus('\u23fa Merging\u2026 0%');

    // ── Build ffmpeg command ───────────────────────
    // Strategy: H.264 video + AAC audio → universally compatible MP4
    const args = ['-i', vName];

    // Audio input — with optional loop and start offset
    if (loopAudio)       args.push('-stream_loop', '-1');
    if (audioOffset > 0) args.push('-itsoffset', String(audioOffset));
    args.push('-i', aName);

    // Video: re-encode to H.264 for Canva / universal compatibility
    args.push('-c:v', 'libx264', '-preset', 'fast', '-crf', '23');

    // Audio: AAC
    args.push('-c:a', 'aac', '-b:a', '192k');

    // Volume adjustment
    if (volume !== 1.0) args.push('-af', 'volume=' + volume.toFixed(2));

    // Stop when video ends
    args.push('-shortest', 'output.mp4');

    await ffmpeg.exec(args);

    setStatus('\u23fa Packaging\u2026');
    const data = await ffmpeg.readFile('output.mp4');
    const blob = new Blob([data.buffer], { type: 'video/mp4' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = '3c-carousel-mix.mp4';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);

    // Clean up ffmpeg virtual FS
    try { await ffmpeg.deleteFile(vName); } catch (_) {}
    try { await ffmpeg.deleteFile(aName); } catch (_) {}
    try { await ffmpeg.deleteFile('output.mp4'); } catch (_) {}

    setStatus('\u2705 Export complete \u2014 3c-carousel-mix.mp4 downloaded');

  } catch (err) {
    setStatus('\u274c Export failed: ' + err.message);
    console.error('[mixer] export error:', err);
  } finally {
    isExporting = false;
    updateExportBtn();
    if (previewBtn) previewBtn.disabled = !(videoFile && audioFile);
  }
}

// ── UI Helpers ────────────────────────────────────
function updateExportBtn() {
  if (exportMp4Btn) exportMp4Btn.disabled = !(videoFile && audioFile && ffmpegLoaded && !isExporting);
}
function updatePreviewBtn() {
  if (previewBtn) previewBtn.disabled = !(videoFile && audioFile);
}
function setStatus(msg)     { if (mixerStatusEl)      mixerStatusEl.textContent      = msg; }
function setLoadStatus(msg) { if (ffmpegLoadStatusEl) ffmpegLoadStatusEl.textContent = msg; }

// ── Event Listeners ───────────────────────────────

// Video drop zone
if (videoDropZone) {
  videoDropZone.addEventListener('click',     () => videoFileInput && videoFileInput.click());
  videoDropZone.addEventListener('dragover',  e  => { e.preventDefault(); videoDropZone.classList.add('drag-over'); });
  videoDropZone.addEventListener('dragleave', () => videoDropZone.classList.remove('drag-over'));
  videoDropZone.addEventListener('drop', e => {
    e.preventDefault(); videoDropZone.classList.remove('drag-over');
    if (e.dataTransfer.files[0]) handleVideoFile(e.dataTransfer.files[0]);
  });
}
if (videoFileInput) videoFileInput.addEventListener('change', () => { if (videoFileInput.files[0]) handleVideoFile(videoFileInput.files[0]); videoFileInput.value = ''; });
if (videoClearBtn)  videoClearBtn.addEventListener('click', clearVideo);

// Audio drop zone
if (audioDropZone) {
  audioDropZone.addEventListener('click',     () => audioFileInput && audioFileInput.click());
  audioDropZone.addEventListener('dragover',  e  => { e.preventDefault(); audioDropZone.classList.add('drag-over'); });
  audioDropZone.addEventListener('dragleave', () => audioDropZone.classList.remove('drag-over'));
  audioDropZone.addEventListener('drop', e => {
    e.preventDefault(); audioDropZone.classList.remove('drag-over');
    if (e.dataTransfer.files[0]) handleAudioFile(e.dataTransfer.files[0]);
  });
}
if (audioFileInput) audioFileInput.addEventListener('change', () => { if (audioFileInput.files[0]) handleAudioFile(audioFileInput.files[0]); audioFileInput.value = ''; });
if (audioClearBtn)  audioClearBtn.addEventListener('click', clearAudio);

// Controls
if (volumeSlider) volumeSlider.addEventListener('input', function () {
  volume = parseFloat(this.value);
  if (volumeVal) volumeVal.textContent = Math.round(volume * 100) + '%';
  if (previewAudio) previewAudio.volume = Math.min(1, volume); // clamp for HTML audio el
});
if (offsetSlider) offsetSlider.addEventListener('input', function () {
  audioOffset = parseFloat(this.value);
  if (offsetVal) offsetVal.textContent = audioOffset.toFixed(1) + 's';
});
if (loopAudioToggle) loopAudioToggle.addEventListener('change', function () {
  loopAudio = this.checked;
  if (previewAudio) previewAudio.loop = loopAudio;
});

// Buttons
if (previewBtn)    previewBtn.addEventListener('click', previewMix);
if (exportMp4Btn)  exportMp4Btn.addEventListener('click', exportMp4);
if (ffmpegLoadBtn) ffmpegLoadBtn.addEventListener('click', loadFFmpeg);

// Auto-load when tab is opened
document.addEventListener('mixerTabOpened', () => {
  if (!ffmpegLoaded) loadFFmpeg();
});
