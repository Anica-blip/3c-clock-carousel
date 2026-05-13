/* ═══════════════════════════════════════════════
   3C Clock Carousel — app.js
   Vanilla JS · Canvas API · MediaRecorder API
   3C Thread To Success™ Cooking Lab
═══════════════════════════════════════════════ */

'use strict';

// ── Canvas ──────────────────────────────────────
const canvas = document.getElementById('previewCanvas');
const ctx    = canvas.getContext('2d');
const CW     = canvas.width;   // 540
const CH     = canvas.height;  // 960

// ── Carousel Layout Constants ────────────────────
// Three cards visible: top (prev), center (current), bottom (next)
const PREV_Y   = 130;
const CENTER_Y = 490;
const NEXT_Y   = 850;

const PREV_SCALE   = 0.48;
const CENTER_SCALE = 0.78;
const NEXT_SCALE   = 0.48;
const PREV_ALPHA   = 0.52;
const NEXT_ALPHA   = 0.52;
const CENTER_GLOW  = 26;

// Card max dimensions (at scale 1.0)
const CARD_MAX_W = 420;
const CARD_MAX_H = 680;
const ACTIVE_X   = CW / 2;

// ── Animation State Machine ───────────────────────
// CAROUSEL → POP_IN → FULLSCREEN → POP_OUT → SHIFT → CAROUSEL
const S = {
  CAROUSEL  : 'carousel',    // brief pause showing 3 cards
  POP_IN    : 'pop_in',      // center card zooms to fullscreen
  FULLSCREEN: 'fullscreen',  // card held at fullscreen
  POP_OUT   : 'pop_out',     // card returns to deck
  SHIFT     : 'shift',       // deck scrolls up, next card rises to center
};

const CAROUSEL_HOLD  = 220;  // ms — brief pause before pop
const POP_DURATION   = 360;  // ms — zoom in / zoom out

// ── State ────────────────────────────────────────
let state      = S.CAROUSEL;
let stateStart = null;
let currentIdx = 0;
let isPlaying  = false;
let isRecording = false;
let rafId      = null;

// ── Settings ─────────────────────────────────────
let displayDuration    = 1200;
let transitionDuration = 460;
let exportLoops        = 2;
let bgColor            = '#1a1a2e';
let transparentBg      = false;

// ── MediaRecorder ─────────────────────────────────
let mediaRecorder    = null;
let recordedChunks   = [];
let progressInterval = null;

// ── Cards ─────────────────────────────────────────
const cards = [];   // { img, url, name }

// ── DOM ───────────────────────────────────────────
const dropZone          = document.getElementById('dropZone');
const fileInput         = document.getElementById('fileInput');
const cardListEl        = document.getElementById('cardList');
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

// ── Index Helpers ─────────────────────────────────
function getPrevIdx() { return (currentIdx - 1 + cards.length) % cards.length; }
function getNextIdx() { return (currentIdx + 1) % cards.length; }
function getNextNextIdx() { return (currentIdx + 2) % cards.length; }

// ── Easing ────────────────────────────────────────
function easeOutBack(t) {
  const c1 = 1.4, c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}
function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

// ── Card Dimensions ───────────────────────────────
function getCardDim(img, scale, maxW, maxH) {
  const mW = (maxW !== undefined ? maxW : CARD_MAX_W) * scale;
  const mH = (maxH !== undefined ? maxH : CARD_MAX_H) * scale;
  const nw = img.naturalWidth  || 1;
  const nh = img.naturalHeight || 1;
  const ar = nw / nh;
  let w, h;
  if (ar > mW / mH) { w = mW; h = w / ar; }
  else              { h = mH; w = h * ar; }
  return { w, h };
}

// Full-screen dimensions — fit to 96% of canvas
function getFullDim(img) {
  const nw = img.naturalWidth  || 1;
  const nh = img.naturalHeight || 1;
  const ar = nw / nh;
  const maxW = CW * 0.97;
  const maxH = CH * 0.97;
  let w, h;
  if (ar > maxW / maxH) { w = maxW; h = w / ar; }
  else                  { h = maxH; w = h * ar; }
  return { w, h };
}

// ── Core Draw Call ────────────────────────────────
function drawCardSize(img, cx, cy, w, h, alpha, shadowBlur) {
  if (!img || !img.complete || w <= 0 || h <= 0) return;
  shadowBlur = shadowBlur || 0;
  const x = cx - w / 2;
  const y = cy - h / 2;
  const r = Math.max(6, (w / CARD_MAX_W) * 14);

  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, alpha));

  if (shadowBlur > 0) {
    ctx.shadowColor   = 'rgba(80, 10, 200, 0.6)';
    ctx.shadowBlur    = shadowBlur;
    ctx.shadowOffsetY = 5;
    ctx.fillStyle     = 'rgba(0,0,0,0.6)';
    roundRectPath(x, y, w, h, r);
    ctx.fill();
    ctx.shadowBlur    = 0;
    ctx.shadowOffsetY = 0;
  }

  roundRectPath(x, y, w, h, r);
  ctx.clip();
  ctx.drawImage(img, x, y, w, h);
  ctx.restore();
}

function drawCard(img, cx, cy, scale, alpha, shadowBlur) {
  const d = getCardDim(img, scale);
  drawCardSize(img, cx, cy, d.w, d.h, alpha, shadowBlur || 0);
}

// ── Rounded Rect Path ─────────────────────────────
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
  ctx.fillText('3C Thread To Success\u2122', CW / 2, CH - 30);
  ctx.font        = '400 13px "Segoe UI", system-ui, sans-serif';
  ctx.fillText('Cooking Lab', CW / 2, CH - 12);
  ctx.restore();
}

// ── Draw Empty State ──────────────────────────────
function drawEmpty() {
  drawBackground();
  ctx.save();
  ctx.globalAlpha = 0.15;
  ctx.fillStyle   = '#ffffff';
  ctx.textAlign   = 'center';
  ctx.font        = '22px "Segoe UI", system-ui, sans-serif';
  ctx.fillText('3C Clock Carousel', CW / 2, CH / 2);
  ctx.restore();
  drawWatermark();
}

// ── Carousel View (3 cards stacked) ──────────────
function drawCarouselView() {
  drawCard(cards[getPrevIdx()].img, ACTIVE_X, PREV_Y,   PREV_SCALE,   PREV_ALPHA);
  drawCard(cards[getNextIdx()].img, ACTIVE_X, NEXT_Y,   NEXT_SCALE,   NEXT_ALPHA);
  drawCard(cards[currentIdx].img,   ACTIVE_X, CENTER_Y, CENTER_SCALE, 1.0, CENTER_GLOW);
}

// ── Main Animation Frame ──────────────────────────
function drawFrame(ts) {
  rafId = requestAnimationFrame(drawFrame);

  if (cards.length < 2) { drawEmpty(); return; }

  drawBackground();

  if (!isPlaying) {
    drawCarouselView();
    drawWatermark();
    return;
  }

  if (stateStart === null) stateStart = ts;
  const elapsed = ts - stateStart;

  // CAROUSEL — brief 3-card view before pop
  if (state === S.CAROUSEL) {
    drawCarouselView();
    if (elapsed >= CAROUSEL_HOLD) { state = S.POP_IN; stateStart = ts; }
  }

  // POP IN — center card zooms forward to fill screen
  else if (state === S.POP_IN) {
    const p  = Math.min(elapsed / POP_DURATION, 1);
    const ep = easeOutBack(p);
    const fo = easeOutCubic(p);

    const cur = cards[currentIdx].img;
    const d1  = getCardDim(cur, CENTER_SCALE);
    const d2  = getFullDim(cur);
    const w   = d1.w + (d2.w - d1.w) * ep;
    const h   = d1.h + (d2.h - d1.h) * ep;

    drawCard(cards[getPrevIdx()].img, ACTIVE_X, PREV_Y, PREV_SCALE * (1 - fo * 0.35), PREV_ALPHA * (1 - fo));
    drawCard(cards[getNextIdx()].img, ACTIVE_X, NEXT_Y, NEXT_SCALE * (1 - fo * 0.35), NEXT_ALPHA * (1 - fo));
    drawCardSize(cur, ACTIVE_X, CENTER_Y, w, h, 1.0, CENTER_GLOW * p);

    if (p >= 1) { state = S.FULLSCREEN; stateStart = ts; }
  }

  // FULLSCREEN — card fills screen for displayDuration
  else if (state === S.FULLSCREEN) {
    const cur    = cards[currentIdx].img;
    const d      = getFullDim(cur);
    drawCardSize(cur, ACTIVE_X, CENTER_Y, d.w, d.h, 1.0, CENTER_GLOW);

    if (elapsed >= displayDuration) { state = S.POP_OUT; stateStart = ts; }
  }

  // POP OUT — card shrinks back to carousel position
  else if (state === S.POP_OUT) {
    const p  = Math.min(elapsed / POP_DURATION, 1);
    const ep = easeInOutCubic(p);
    const fi = easeOutCubic(p);

    const cur = cards[currentIdx].img;
    const d2  = getFullDim(cur);
    const d1  = getCardDim(cur, CENTER_SCALE);
    const w   = d2.w + (d1.w - d2.w) * ep;
    const h   = d2.h + (d1.h - d2.h) * ep;

    drawCard(cards[getPrevIdx()].img, ACTIVE_X, PREV_Y, PREV_SCALE * (0.65 + 0.35 * fi), PREV_ALPHA * fi);
    drawCard(cards[getNextIdx()].img, ACTIVE_X, NEXT_Y, NEXT_SCALE * (0.65 + 0.35 * fi), NEXT_ALPHA * fi);
    drawCardSize(cur, ACTIVE_X, CENTER_Y, w, h, 1.0, CENTER_GLOW * (1 - ep));

    if (p >= 1) { state = S.SHIFT; stateStart = ts; }
  }

  // SHIFT — deck scrolls up, next card rises to center
  else if (state === S.SHIFT) {
    const p  = Math.min(elapsed / transitionDuration, 1);
    const ep = easeInOutCubic(p);

    const prevCard    = cards[getPrevIdx()].img;
    const curCard     = cards[currentIdx].img;
    const nxtCard     = cards[getNextIdx()].img;
    const newNextCard = cards[getNextNextIdx()].img;

    // Old prev exits off the top
    drawCard(prevCard, ACTIVE_X,
      PREV_Y - 200 * ep,
      PREV_SCALE * (1 - ep * 0.5),
      PREV_ALPHA * (1 - ep));

    // Current → slides up to prev slot
    drawCard(curCard, ACTIVE_X,
      CENTER_Y + (PREV_Y - CENTER_Y) * ep,
      CENTER_SCALE + (PREV_SCALE - CENTER_SCALE) * ep,
      1.0 - (1.0 - PREV_ALPHA) * ep);

    // Next → rises up to center (the clock motion)
    drawCard(nxtCard, ACTIVE_X,
      NEXT_Y + (CENTER_Y - NEXT_Y) * ep,
      NEXT_SCALE + (CENTER_SCALE - NEXT_SCALE) * ep,
      NEXT_ALPHA + (1.0 - NEXT_ALPHA) * ep,
      CENTER_GLOW * ep);

    // New next → enters from below into the next slot
    drawCard(newNextCard, ACTIVE_X,
      NEXT_Y + 220 * (1 - ep),
      NEXT_SCALE * ep,
      NEXT_ALPHA * ep);

    if (p >= 1) {
      currentIdx = getNextIdx();
      state      = S.CAROUSEL;
      stateStart = ts;
    }
  }

  drawWatermark();
}

// ── Start rAF ────────────────────────────────────
function startRaf() {
  if (!rafId) {
    stateStart = null;
    rafId = requestAnimationFrame(drawFrame);
  }
}

// ── Reset Animation ───────────────────────────────
function resetAnimation() {
  currentIdx = 0;
  state      = S.CAROUSEL;
  stateStart = null;
}

// ── Per-card Duration (for export timing) ────────
function perCardMs() {
  return CAROUSEL_HOLD + POP_DURATION + displayDuration + POP_DURATION + transitionDuration;
}

// ── File Upload ───────────────────────────────────
function handleFiles(files) {
  const images = Array.from(files).filter(f => f.type.startsWith('image/'));
  if (images.length === 0) return;

  let loaded = 0;
  images.forEach(file => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      cards.push({ img, url, name: file.name });
      if (++loaded === images.length) {
        resetAnimation();
        renderCardList();
        updateUIState();
        startRaf();
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      if (++loaded === images.length) { renderCardList(); updateUIState(); }
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

// ── Drag Reorder ──────────────────────────────────
let dragSrcIdx = null;

function renderCardList() {
  cardListEl.innerHTML = '';
  cardCountEl.textContent = `${cards.length} card${cards.length !== 1 ? 's' : ''}`;
  clearAllBtn.hidden = cards.length === 0;

  if (cards.length === 0) {
    cardListEl.innerHTML = '<p class="card-list-empty">No cards yet — upload 2 or more to begin</p>';
    return;
  }

  cards.forEach((card, i) => {
    const div = document.createElement('div');
    div.className     = 'card-thumb';
    div.draggable     = true;
    div.dataset.index = i;

    const img         = document.createElement('img');
    img.src           = card.url;
    img.alt           = `Card ${i + 1}`;

    const badge       = document.createElement('span');
    badge.className   = 'card-index';
    badge.textContent = i + 1;

    const removeBtn     = document.createElement('button');
    removeBtn.className = 'card-remove';
    removeBtn.title     = 'Remove';
    removeBtn.innerHTML = '\xd7';
    removeBtn.addEventListener('click', e => { e.stopPropagation(); removeCard(i); });

    div.appendChild(img);
    div.appendChild(badge);
    div.appendChild(removeBtn);
    div.addEventListener('dragstart', onDragStart);
    div.addEventListener('dragover',  onDragOver);
    div.addEventListener('dragleave', onDragLeave);
    div.addEventListener('drop',      onDrop);
    div.addEventListener('dragend',   onDragEnd);
    cardListEl.appendChild(div);
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
function onDragLeave(e) { e.currentTarget.classList.remove('drag-target'); }
function onDrop(e) {
  e.preventDefault();
  const tIdx = parseInt(e.currentTarget.dataset.index);
  e.currentTarget.classList.remove('drag-target');
  if (dragSrcIdx !== null && dragSrcIdx !== tIdx) {
    const [m] = cards.splice(dragSrcIdx, 1);
    cards.splice(tIdx, 0, m);
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

// ── UI ────────────────────────────────────────────
function updateUIState() {
  const ready = cards.length >= 2;
  playPauseBtn.disabled = !ready;
  exportBtn.disabled    = !ready || isRecording;
  canvasOverlay.classList.toggle('hidden', ready);
  if (!ready) { isPlaying = false; playPauseBtn.textContent = '\u25b6 Play'; }
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

function updateExportStatus(msg) { exportStatusEl.textContent = msg; }

// ── Export ────────────────────────────────────────
function getSupportedMimeType() {
  const types = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
  for (const t of types) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t)) return t;
  }
  return '';
}

function startExport() {
  if (cards.length < 2) return;

  if (typeof MediaRecorder === 'undefined') {
    updateExportStatus('\u274c MediaRecorder not supported. Use Chrome, Edge, or Firefox.');
    return;
  }
  if (typeof canvas.captureStream === 'undefined') {
    updateExportStatus('\u274c captureStream not supported. Safari is not supported. Use Chrome or Edge.');
    return;
  }

  const mimeType      = getSupportedMimeType();
  const totalDuration = cards.length * perCardMs() * exportLoops + 600;

  resetAnimation();
  stateStart   = null;
  isPlaying    = true;
  isRecording  = true;
  playPauseBtn.textContent = '\u23f8 Pause';

  disableControls();
  updateExportStatus('\u23fa Recording\u2026 ' + (totalDuration / 1000).toFixed(1) + 's');

  const stream  = canvas.captureStream(30);
  const options = mimeType ? { mimeType, videoBitsPerSecond: 4000000 } : {};

  try {
    mediaRecorder = new MediaRecorder(stream, options);
  } catch (err) {
    updateExportStatus('\u274c Recorder error: ' + err.message);
    isRecording = false;
    enableControls();
    return;
  }

  recordedChunks = [];
  mediaRecorder.ondataavailable = e => { if (e.data && e.data.size > 0) recordedChunks.push(e.data); };
  mediaRecorder.onstop = () => {
    clearInterval(progressInterval);
    isRecording = false;
    enableControls();
    const blob   = new Blob(recordedChunks, { type: mimeType || 'video/webm' });
    const url    = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href     = url;
    anchor.download = '3c-clock-carousel.webm';
    anchor.click();
    URL.revokeObjectURL(url);
    updateExportStatus('\u2705 Export complete! Use HandBrake or FFmpeg to convert to MP4.');
  };

  mediaRecorder.start(100);

  const exportStart = performance.now();
  progressInterval = setInterval(() => {
    const rem = Math.max(0, (totalDuration - (performance.now() - exportStart)) / 1000);
    if (rem > 0) updateExportStatus('\u23fa Recording\u2026 ' + rem.toFixed(1) + 's remaining');
  }, 200);

  setTimeout(() => {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
  }, totalDuration);
}

// ── Event Listeners ───────────────────────────────
fileInput.addEventListener('change', () => { handleFiles(fileInput.files); fileInput.value = ''; });

dropZone.addEventListener('click',     () => fileInput.click());
dropZone.addEventListener('dragover',  e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
dropZone.addEventListener('drop', e => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  handleFiles(e.dataTransfer.files);
});

clearAllBtn.addEventListener('click', () => { if (confirm('Remove all cards?')) clearAll(); });

playPauseBtn.addEventListener('click', () => {
  if (isRecording) return;
  isPlaying = !isPlaying;
  playPauseBtn.textContent = isPlaying ? '\u23f8 Pause' : '\u25b6 Play';
  if (isPlaying) stateStart = null;
});

exportBtn.addEventListener('click', () => { if (!isRecording) startExport(); });

displayDurationEl.addEventListener('input', function () {
  displayDuration = parseInt(this.value);
  displayDurationV.textContent = (displayDuration / 1000).toFixed(1) + 's';
});

transitionSpeedEl.addEventListener('input', function () {
  transitionDuration = parseInt(this.value);
  transitionSpeedV.textContent = (transitionDuration / 1000).toFixed(1) + 's';
});

exportLoopsEl.addEventListener('input', function () {
  exportLoops = parseInt(this.value);
  exportLoopsV.textContent = exportLoops + '\xd7';
});

bgColorPicker.addEventListener('input', function () { bgColor = this.value; });

transparentBgEl.addEventListener('change', function () {
  transparentBg               = this.checked;
  bgColorPicker.disabled      = transparentBg;
  bgColorPicker.style.opacity = transparentBg ? '0.35' : '1';
});

// ── Init ──────────────────────────────────────────
(function init() {
  displayDurationEl.value      = 1200;
  displayDurationV.textContent = '1.2s';
  updateUIState();
  startRaf();
  drawEmpty();
}());
