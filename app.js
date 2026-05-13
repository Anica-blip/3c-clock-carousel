/* ═══════════════════════════════════════════════
   3C Clock Carousel — app.js
   Vanilla JS · Canvas API · MediaRecorder API
   3C Thread To Success™ Cooking Lab
═══════════════════════════════════════════════ */

'use strict';

// ── Canvas ──────────────────────────────────────
const canvas  = document.getElementById('previewCanvas');
const ctx     = canvas.getContext('2d');
const CW      = canvas.width;   // 540
const CH      = canvas.height;  // 960

// ── Card Layout Constants ────────────────────────
const CARD_MAX_W    = 420;   // max card width at scale 1.0
const CARD_MAX_H    = 680;   // max card height at scale 1.0
const ACTIVE_X      = CW / 2;
const ACTIVE_Y      = Math.round(CH * 0.42);   // 403 — front card center
const PREVIEW_Y     = Math.round(CH * 0.86);   // 826 — peek card center
const EXIT_Y        = Math.round(CH * 0.05);   // 48  — outgoing card destination
const PREVIEW_SCALE = 0.78;
const PREVIEW_ALPHA = 0.72;

// ── State ────────────────────────────────────────
const cards = [];      // { img: HTMLImageElement, url: string, name: string }
let currentIdx  = 0;
let nextIdx     = 1;
let state       = 'idle';     // 'idle' | 'transition'
let idleStart   = null;       // rAF timestamp when idle began
let transStart  = null;       // rAF timestamp when transition began
let isPlaying   = false;
let isRecording = false;
let rafId       = null;

// ── Settings ─────────────────────────────────────
let displayDuration   = 2000;    // ms card stays on screen
let transitionDuration = 600;    // ms for transition animation
let exportLoops       = 2;       // times to loop all cards during export
let bgColor           = '#1a1a2e';
let transparentBg     = false;

// ── MediaRecorder ─────────────────────────────────
let mediaRecorder    = null;
let recordedChunks   = [];
let progressInterval = null;

// ── DOM Refs ─────────────────────────────────────
const dropZone          = document.getElementById('dropZone');
const fileInput         = document.getElementById('fileInput');
const cardList          = document.getElementById('cardList');
const cardCountEl       = document.getElementById('cardCount');
const clearAllBtn       = document.getElementById('clearAllBtn');
const playPauseBtn      = document.getElementById('playPauseBtn');
const exportBtn         = document.getElementById('exportBtn');
const exportStatusEl    = document.getElementById('exportStatus');
const canvasOverlay     = document.getElementById('canvasOverlay');
const displayDurationEl = document.getElementById('displayDuration');
const displayDurationV  = document.getElementById('displayDurationVal');
const transitionSpeedEl = document.getElementById('transitionSpeed');
const transitionSpeedV  = document.getElementById('transitionSpeedVal');
const exportLoopsEl     = document.getElementById('exportLoops');
const exportLoopsV      = document.getElementById('exportLoopsVal');
const bgColorPicker     = document.getElementById('bgColorPicker');
const transparentBgEl   = document.getElementById('transparentBg');

// ── Easing Functions ─────────────────────────────
function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// Slight overshoot on entry — the "pop" effect
function easeOutBack(t) {
  const c1 = 1.5;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

// ── Card Dimension Helper ────────────────────────
// Fits image into CARD_MAX_W × CARD_MAX_H box, preserving aspect ratio
function getCardDim(img, scale) {
  const nw = img.naturalWidth  || 1;
  const nh = img.naturalHeight || 1;
  const ar = nw / nh;
  const maxW = CARD_MAX_W * scale;
  const maxH = CARD_MAX_H * scale;

  let w, h;
  if (ar > maxW / maxH) {
    w = maxW;
    h = w / ar;
  } else {
    h = maxH;
    w = h * ar;
  }
  return { w, h };
}

// ── Draw Rounded Rect Path ───────────────────────
function roundRectPath(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y,     x + w, y + r,     r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x,     y + h, x,     y + h - r, r);
  ctx.lineTo(x,     y + r);
  ctx.arcTo(x,     y,     x + r, y,         r);
  ctx.closePath();
}

// ── Draw a Single Card ───────────────────────────
function drawCard(img, cx, cy, scale, alpha, glowAmt = 0) {
  if (!img || !img.complete) return;

  const { w, h } = getCardDim(img, scale);
  const x = cx - w / 2;
  const y = cy - h / 2;
  const r = Math.max(6, 14 * scale);

  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, alpha));

  // Glow / shadow pass (drawn before clip so it bleeds outward)
  if (glowAmt > 0) {
    ctx.shadowColor  = 'rgba(100, 20, 220, 0.65)';
    ctx.shadowBlur   = glowAmt;
    ctx.shadowOffsetY = 5 * scale;
    ctx.fillStyle    = 'rgba(0,0,0,0.7)';
    roundRectPath(x, y, w, h, r);
    ctx.fill();
    ctx.shadowBlur    = 0;
    ctx.shadowOffsetY = 0;
  }

  // Clip and draw image
  roundRectPath(x, y, w, h, r);
  ctx.clip();
  ctx.drawImage(img, x, y, w, h);

  ctx.restore();
}

// ── Draw Background ──────────────────────────────
function drawBackground() {
  if (transparentBg) {
    ctx.clearRect(0, 0, CW, CH);
  } else {
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, CW, CH);
  }
}

// ── Draw Watermark ───────────────────────────────
function drawWatermark() {
  ctx.save();
  ctx.globalAlpha = 0.28;
  ctx.fillStyle   = '#ffffff';
  ctx.textAlign   = 'center';
  ctx.font        = '500 17px "Segoe UI", system-ui, sans-serif';
  ctx.fillText('3C Thread To Success™', CW / 2, CH - 30);
  ctx.font        = '400 13px "Segoe UI", system-ui, sans-serif';
  ctx.fillText('Cooking Lab 🧪', CW / 2, CH - 12);
  ctx.restore();
}

// ── Draw Empty Canvas ────────────────────────────
function drawEmpty() {
  drawBackground();
  ctx.save();
  ctx.globalAlpha = 0.15;
  ctx.fillStyle   = '#ffffff';
  ctx.textAlign   = 'center';
  ctx.font        = '500 22px "Segoe UI", system-ui, sans-serif';
  ctx.fillText('🎠', CW / 2, CH / 2 - 14);
  ctx.font        = '400 16px "Segoe UI", system-ui, sans-serif';
  ctx.fillText('3C Clock Carousel', CW / 2, CH / 2 + 14);
  ctx.restore();
  drawWatermark();
}

// ── Main Animation Frame ─────────────────────────
function drawFrame(ts) {
  rafId = requestAnimationFrame(drawFrame);

  if (cards.length < 2) {
    drawEmpty();
    return;
  }

  drawBackground();

  if (!isPlaying) {
    // Static preview — show current and next
    drawCard(cards[nextIdx].img,    ACTIVE_X, PREVIEW_Y, PREVIEW_SCALE, PREVIEW_ALPHA);
    drawCard(cards[currentIdx].img, ACTIVE_X, ACTIVE_Y,  1.0,           1.0, 22);
    drawWatermark();
    return;
  }

  // ── IDLE STATE ────────────────────────────────
  if (state === 'idle') {
    if (idleStart === null) idleStart = ts;

    drawCard(cards[nextIdx].img,    ACTIVE_X, PREVIEW_Y, PREVIEW_SCALE, PREVIEW_ALPHA);
    drawCard(cards[currentIdx].img, ACTIVE_X, ACTIVE_Y,  1.0,           1.0, 22);

    if (ts - idleStart >= displayDuration) {
      state     = 'transition';
      transStart = ts;
      idleStart  = null;
    }
  }

  // ── TRANSITION STATE ──────────────────────────
  else if (state === 'transition') {
    const elapsed = ts - transStart;
    const p       = Math.min(elapsed / transitionDuration, 1);
    const epOut   = easeInOutCubic(p);   // smooth for outgoing
    const epIn    = easeOutBack(p);      // pop for incoming

    // Outgoing (current active → exits top)
    const outY     = ACTIVE_Y  + (EXIT_Y    - ACTIVE_Y)  * epOut;
    const outScale = 1.0       - (1.0 - 0.7)             * epOut;
    const outAlpha = 1.0       - epOut;

    // Incoming (old preview → active front)
    const inY      = PREVIEW_Y + (ACTIVE_Y  - PREVIEW_Y) * epIn;
    const inScale  = PREVIEW_SCALE + (1.0 - PREVIEW_SCALE) * Math.min(p * 1.1, 1);
    const inAlpha  = PREVIEW_ALPHA + (1.0 - PREVIEW_ALPHA) * p;
    const inGlow   = 22 * p;

    // New next card fades into preview slot
    const newNextIdx  = (nextIdx + 1) % cards.length;
    const newNextAlpha = PREVIEW_ALPHA * Math.min(p * 1.5, 1);

    // Draw order: furthest back → front
    drawCard(cards[newNextIdx].img,  ACTIVE_X, PREVIEW_Y, PREVIEW_SCALE, newNextAlpha);
    drawCard(cards[nextIdx].img,     ACTIVE_X, inY,       inScale,       inAlpha, inGlow);
    drawCard(cards[currentIdx].img,  ACTIVE_X, outY,      outScale,      outAlpha);

    // Transition complete
    if (p >= 1) {
      currentIdx = nextIdx;
      nextIdx    = (nextIdx + 1) % cards.length;
      state      = 'idle';
      idleStart  = ts;
    }
  }

  drawWatermark();
}

// ── Start / Stop Animation ────────────────────────
function startRaf() {
  if (!rafId) rafId = requestAnimationFrame(drawFrame);
}

function resetAnimation() {
  currentIdx = 0;
  nextIdx    = cards.length > 1 ? 1 : 0;
  state      = 'idle';
  idleStart  = null;
  transStart = null;
}

// ── Upload Handling ───────────────────────────────
function handleFiles(files) {
  const images = Array.from(files).filter(f => f.type.startsWith('image/'));
  if (images.length === 0) return;

  let loaded = 0;
  images.forEach(file => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      cards.push({ img, url, name: file.name });
      loaded++;
      if (loaded === images.length) {
        resetAnimation();
        renderCardList();
        updateUIState();
        startRaf();
      }
    };
    img.onerror = () => {
      loaded++;
      URL.revokeObjectURL(url);
      if (loaded === images.length) {
        renderCardList();
        updateUIState();
      }
    };
    img.src = url;
  });
}

function removeCard(idx) {
  URL.revokeObjectURL(cards[idx].url);
  cards.splice(idx, 1);
  resetAnimation();
  renderCardList();
  updateUIState();
}

function clearAll() {
  cards.forEach(c => URL.revokeObjectURL(c.url));
  cards.length = 0;
  isPlaying    = false;
  resetAnimation();
  renderCardList();
  updateUIState();
  updateExportStatus('');
}

// ── Drag Reorder State ────────────────────────────
let dragSrcIdx = null;

function renderCardList() {
  cardList.innerHTML = '';
  cardCountEl.textContent = `${cards.length} card${cards.length !== 1 ? 's' : ''}`;
  clearAllBtn.hidden = cards.length === 0;

  if (cards.length === 0) {
    cardList.innerHTML = '<p class="card-list-empty">No cards yet — upload 2 or more to begin</p>';
    return;
  }

  cards.forEach((card, i) => {
    const div = document.createElement('div');
    div.className    = 'card-thumb';
    div.draggable    = true;
    div.dataset.index = i;

    const img = document.createElement('img');
    img.src = card.url;
    img.alt = `Card ${i + 1}`;

    const badge = document.createElement('span');
    badge.className   = 'card-index';
    badge.textContent = i + 1;

    const removeBtn = document.createElement('button');
    removeBtn.className = 'card-remove';
    removeBtn.title     = 'Remove';
    removeBtn.innerHTML = '×';
    removeBtn.addEventListener('click', e => {
      e.stopPropagation();
      removeCard(i);
    });

    div.appendChild(img);
    div.appendChild(badge);
    div.appendChild(removeBtn);

    // Drag events
    div.addEventListener('dragstart', onDragStart);
    div.addEventListener('dragover',  onDragOver);
    div.addEventListener('dragleave', onDragLeave);
    div.addEventListener('drop',      onDrop);
    div.addEventListener('dragend',   onDragEnd);

    cardList.appendChild(div);
  });
}

function onDragStart(e) {
  dragSrcIdx = parseInt(e.currentTarget.dataset.index);
  e.currentTarget.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
}

function onDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  e.currentTarget.classList.add('drag-target');
}

function onDragLeave(e) {
  e.currentTarget.classList.remove('drag-target');
}

function onDrop(e) {
  e.preventDefault();
  const targetIdx = parseInt(e.currentTarget.dataset.index);
  e.currentTarget.classList.remove('drag-target');

  if (dragSrcIdx !== null && dragSrcIdx !== targetIdx) {
    const [moved] = cards.splice(dragSrcIdx, 1);
    cards.splice(targetIdx, 0, moved);
    resetAnimation();
    renderCardList();
    updateUIState();
  }
}

function onDragEnd(e) {
  e.currentTarget.classList.remove('dragging');
  document.querySelectorAll('.card-thumb').forEach(el => el.classList.remove('drag-target'));
  dragSrcIdx = null;
}

// ── UI State ──────────────────────────────────────
function updateUIState() {
  const ready = cards.length >= 2;
  playPauseBtn.disabled = !ready;
  exportBtn.disabled    = !ready || isRecording;
  canvasOverlay.classList.toggle('hidden', ready);

  if (!ready) {
    isPlaying = false;
    playPauseBtn.textContent = '▶ Play';
  }
}

function disableControls() {
  playPauseBtn.disabled = true;
  exportBtn.disabled    = true;
  clearAllBtn.disabled  = true;
  fileInput.disabled    = true;
}

function enableControls() {
  updateUIState();
  clearAllBtn.disabled = false;
  fileInput.disabled   = false;
}

function updateExportStatus(msg) {
  exportStatusEl.textContent = msg;
}

// ── Export (MediaRecorder) ────────────────────────
function getSupportedMimeType() {
  const candidates = [
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
  ];
  for (const type of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }
  return '';
}

function startExport() {
  if (cards.length < 2) return;

  // Check support
  if (typeof MediaRecorder === 'undefined') {
    updateExportStatus('❌ MediaRecorder not supported in this browser. Use Chrome, Edge, or Firefox.');
    return;
  }

  if (typeof canvas.captureStream === 'undefined') {
    updateExportStatus('❌ captureStream not supported. Safari is not supported for export. Use Chrome or Edge.');
    return;
  }

  const mimeType        = getSupportedMimeType();
  const loopDuration    = cards.length * (displayDuration + transitionDuration);
  const totalDuration   = loopDuration * exportLoops + 400; // small buffer at end

  // Reset to beginning
  resetAnimation();
  idleStart  = null;
  transStart = null;
  isPlaying  = true;
  isRecording = true;
  playPauseBtn.textContent = '⏸ Pause';

  disableControls();
  updateExportStatus(`⏺ Recording… ${(totalDuration / 1000).toFixed(1)}s`);

  const stream  = canvas.captureStream(30);
  const options = mimeType ? { mimeType, videoBitsPerSecond: 4_000_000 } : {};

  try {
    mediaRecorder = new MediaRecorder(stream, options);
  } catch (err) {
    updateExportStatus('❌ Could not start recorder: ' + err.message);
    isRecording = false;
    enableControls();
    return;
  }

  recordedChunks = [];

  mediaRecorder.ondataavailable = e => {
    if (e.data && e.data.size > 0) recordedChunks.push(e.data);
  };

  mediaRecorder.onstop = () => {
    clearInterval(progressInterval);
    isRecording = false;
    enableControls();

    const blob     = new Blob(recordedChunks, { type: mimeType || 'video/webm' });
    const url      = URL.createObjectURL(blob);
    const anchor   = document.createElement('a');
    anchor.href     = url;
    anchor.download = '3c-clock-carousel.webm';
    anchor.click();
    URL.revokeObjectURL(url);

    updateExportStatus('✅ Export complete! Tip: use HandBrake or FFmpeg to convert to MP4.');
  };

  mediaRecorder.start(100);   // collect data every 100ms

  // Progress counter
  const exportStartTime = performance.now();
  progressInterval = setInterval(() => {
    const elapsed   = performance.now() - exportStartTime;
    const remaining = Math.max(0, (totalDuration - elapsed) / 1000);
    if (remaining > 0) {
      updateExportStatus(`⏺ Recording… ${remaining.toFixed(1)}s remaining`);
    }
  }, 200);

  // Stop after full duration
  setTimeout(() => {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
    }
  }, totalDuration);
}

// ── Event Listeners ───────────────────────────────

// File input
fileInput.addEventListener('change', () => {
  handleFiles(fileInput.files);
  fileInput.value = '';  // reset so same files can be re-selected
});

// Drop zone
dropZone.addEventListener('click',     () => fileInput.click());
dropZone.addEventListener('dragover',  e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
dropZone.addEventListener('drop',      e => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  handleFiles(e.dataTransfer.files);
});

// Clear all
clearAllBtn.addEventListener('click', () => {
  if (confirm('Remove all cards?')) clearAll();
});

// Play / Pause
playPauseBtn.addEventListener('click', () => {
  if (isRecording) return;
  isPlaying = !isPlaying;
  playPauseBtn.textContent = isPlaying ? '⏸ Pause' : '▶ Play';
  if (isPlaying) {
    idleStart = null;  // reset idle timer on resume
  }
});

// Export
exportBtn.addEventListener('click', () => {
  if (!isRecording) startExport();
});

// Display duration slider
displayDurationEl.addEventListener('input', function () {
  displayDuration = parseInt(this.value);
  displayDurationV.textContent = (displayDuration / 1000).toFixed(1) + 's';
});

// Transition speed slider
transitionSpeedEl.addEventListener('input', function () {
  transitionDuration = parseInt(this.value);
  transitionSpeedV.textContent = (transitionDuration / 1000).toFixed(1) + 's';
});

// Export loops slider
exportLoopsEl.addEventListener('input', function () {
  exportLoops = parseInt(this.value);
  exportLoopsV.textContent = exportLoops + '×';
});

// Background colour
bgColorPicker.addEventListener('input', function () {
  bgColor = this.value;
});

// Transparent background toggle
transparentBgEl.addEventListener('change', function () {
  transparentBg = this.checked;
  // Disable colour picker if transparent
  bgColorPicker.disabled = transparentBg;
  bgColorPicker.style.opacity = transparentBg ? '0.35' : '1';
});

// ── Init ──────────────────────────────────────────
(function init() {
  updateUIState();
  startRaf();
  drawEmpty();
})();
