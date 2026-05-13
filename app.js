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

// ── Card Max Dimensions ───────────────────────────
const CARD_MAX_W = 420;
const CARD_MAX_H = 680;

// ═══════════════════════════════════════════════
// MOON ARC LAYOUT
// ═══════════════════════════════════════════════
const CENTER_X = CW / 2;
const OUTER_X  = CW / 2 - 62;

const PREV_Y   = 65;
const CENTER_Y = 480;
const NEXT_Y   = 920;

const PREV_SCALE   = 0.46;
const CENTER_SCALE = 0.62;
const NEXT_SCALE   = 0.46;
const PREV_ALPHA   = 0.55;
const NEXT_ALPHA   = 0.55;
const CENTER_GLOW  = 28;

const PREV_PERSP   = 0.28;
const NEXT_PERSP   = 0.28;
const CENTER_PERSP = 0.97;
const FULL_PERSP   = 1.00;

const PREV_ROT   = -0.26;
const NEXT_ROT   =  0.26;
const CENTER_ROT =  0.00;
const FULL_ROT   =  0.00;

// ── Animation States ──────────────────────────────
const S = {
  CAROUSEL  : 'carousel',
  POP_IN    : 'pop_in',
  FULLSCREEN: 'fullscreen',
  POP_OUT   : 'pop_out',
  SHIFT     : 'shift',
};

const CAROUSEL_HOLD = 260;
const POP_DURATION  = 380;

// ── Runtime State ─────────────────────────────────
let state       = S.CAROUSEL;
let stateStart  = null;
let currentIdx  = 0;
let isPlaying   = false;
let isRecording = false;
let rafId       = null;

// ── Selected Card (for per-card duration editing) ─
let selectedCardIdx = null;

// ── Global Settings ───────────────────────────────
let globalDuration     = 1200;   // default for new cards
let transitionDuration = 460;
let exportLoops        = 2;
let bgColor            = '#1a1a2e';
let transparentBg      = false;

// ── MediaRecorder ─────────────────────────────────
let mediaRecorder    = null;
let recordedChunks   = [];
let progressInterval = null;

// ── Cards ─────────────────────────────────────────
// Each card: { img, url, name, duration }
const cards = [];

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
const durationContextEl = document.getElementById('durationContext');
const contextLabelEl    = document.getElementById('durationContextLabel');
const deselectCardBtn   = document.getElementById('deselectCardBtn');

// ── Index Helpers ─────────────────────────────────
function getPrevIdx()     { return (currentIdx - 1 + cards.length) % cards.length; }
function getNextIdx()     { return (currentIdx + 1) % cards.length; }
function getNextNextIdx() { return (currentIdx + 2) % cards.length; }

// ── Easing ────────────────────────────────────────
function easeOutBack(t) {
  const c1 = 1.4, c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}
function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
function lerp(a, b, t)   { return a + (b - a) * t; }

// ── Card Dimensions ───────────────────────────────
function getCardDim(img, scale) {
  const ar = (img.naturalWidth || 1) / (img.naturalHeight || 1);
  const mW = CARD_MAX_W * scale;
  const mH = CARD_MAX_H * scale;
  let w, h;
  if (ar > mW / mH) { w = mW; h = w / ar; }
  else              { h = mH; w = h * ar; }
  return { w, h };
}

function getFullDim(img) {
  const ar   = (img.naturalWidth || 1) / (img.naturalHeight || 1);
  const maxW = CW * 0.97;
  const maxH = CH * 0.97;
  let w, h;
  if (ar > maxW / maxH) { w = maxW; h = w / ar; }
  else                  { h = maxH; w = h * ar; }
  return { w, h };
}

// ── Rounded Rect Path (centered at origin) ────────
function roundRectCentered(w, h, r) {
  const x = -w / 2, y = -h / 2;
  ctx.beginPath();
  ctx.moveTo(x + r, y);           ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y,   x + w, y + r,   r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

// ── Core Draw ─────────────────────────────────────
function drawCardTransformed(img, cx, cy, w, h, alpha, rot, perspY, glow) {
  if (!img || !img.complete || w <= 0 || h <= 0) return;
  const r = Math.max(6, (w / CARD_MAX_W) * 14);
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
  ctx.translate(cx, cy);
  ctx.rotate(rot || 0);
  ctx.scale(1, perspY || 1);
  if (glow) {
    ctx.shadowColor = 'rgba(70, 5, 190, 0.65)';
    ctx.shadowBlur  = glow;
    ctx.shadowOffsetY = 7;
    ctx.fillStyle   = 'rgba(0,0,0,0.55)';
    roundRectCentered(w, h, r);
    ctx.fill();
    ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
  }
  roundRectCentered(w, h, r);
  ctx.clip();
  ctx.drawImage(img, -w / 2, -h / 2, w, h);
  ctx.restore();
}

function drawCard(img, cx, cy, scale, alpha, rot, perspY, glow) {
  const d = getCardDim(img, scale);
  drawCardTransformed(img, cx, cy, d.w, d.h, alpha, rot || 0, perspY || 1, glow || 0);
}

// ── Background / Watermark ────────────────────────
function drawBackground() {
  if (transparentBg) { ctx.clearRect(0, 0, CW, CH); }
  else { ctx.fillStyle = bgColor; ctx.fillRect(0, 0, CW, CH); }
}

function drawWatermark() {
  ctx.save();
  ctx.globalAlpha = 0.26;
  ctx.fillStyle   = '#ffffff';
  ctx.textAlign   = 'center';
  ctx.font        = '500 16px "Segoe UI", system-ui, sans-serif';
  ctx.fillText('3C Thread To Success\u2122', CW / 2, CH - 28);
  ctx.font        = '400 12px "Segoe UI", system-ui, sans-serif';
  ctx.fillText('Cooking Lab', CW / 2, CH - 11);
  ctx.restore();
}

function drawEmpty() {
  drawBackground();
  ctx.save();
  ctx.globalAlpha = 0.14;
  ctx.fillStyle   = '#ffffff';
  ctx.textAlign   = 'center';
  ctx.font        = '20px "Segoe UI", system-ui, sans-serif';
  ctx.fillText('3C Clock Carousel', CW / 2, CH / 2);
  ctx.restore();
  drawWatermark();
}

// ── Carousel View ─────────────────────────────────
function drawCarouselView() {
  drawCard(cards[getPrevIdx()].img, OUTER_X,  PREV_Y,   PREV_SCALE,   PREV_ALPHA,   PREV_ROT,   PREV_PERSP,   0);
  drawCard(cards[getNextIdx()].img, OUTER_X,  NEXT_Y,   NEXT_SCALE,   NEXT_ALPHA,   NEXT_ROT,   NEXT_PERSP,   0);
  drawCard(cards[currentIdx].img,   CENTER_X, CENTER_Y, CENTER_SCALE, 1.0,          CENTER_ROT, CENTER_PERSP, CENTER_GLOW);
}

// ── Duration for current card ─────────────────────
function currentCardDuration() {
  return cards[currentIdx] ? cards[currentIdx].duration : globalDuration;
}

// ── Main Animation Frame ──────────────────────────
function drawFrame(ts) {
  rafId = requestAnimationFrame(drawFrame);
  if (cards.length < 2) { drawEmpty(); return; }
  drawBackground();
  if (!isPlaying) { drawCarouselView(); drawWatermark(); return; }
  if (stateStart === null) stateStart = ts;
  const elapsed = ts - stateStart;

  if (state === S.CAROUSEL) {
    drawCarouselView();
    if (elapsed >= CAROUSEL_HOLD) { state = S.POP_IN; stateStart = ts; }
  }

  else if (state === S.POP_IN) {
    const p = Math.min(elapsed / POP_DURATION, 1);
    const ep = easeOutBack(p), efo = easeOutCubic(p);
    const cur = cards[currentIdx].img;
    const d1 = getCardDim(cur, CENTER_SCALE), d2 = getFullDim(cur);
    const w = lerp(d1.w, d2.w, ep), h = lerp(d1.h, d2.h, ep);
    const sideA = lerp(PREV_ALPHA, 0, efo), sideSc = lerp(PREV_SCALE, PREV_SCALE * 0.6, efo);
    drawCard(cards[getPrevIdx()].img, OUTER_X, PREV_Y, sideSc, sideA, PREV_ROT, PREV_PERSP);
    drawCard(cards[getNextIdx()].img, OUTER_X, NEXT_Y, sideSc, sideA, NEXT_ROT, NEXT_PERSP);
    drawCardTransformed(cur, CENTER_X, CENTER_Y, w, h, 1.0,
      lerp(CENTER_ROT, FULL_ROT, efo),
      lerp(CENTER_PERSP, FULL_PERSP, efo),
      lerp(CENTER_GLOW, 0, efo));
    if (p >= 1) { state = S.FULLSCREEN; stateStart = ts; }
  }

  else if (state === S.FULLSCREEN) {
    const d = getFullDim(cards[currentIdx].img);
    drawCardTransformed(cards[currentIdx].img, CENTER_X, CENTER_Y, d.w, d.h, 1.0, FULL_ROT, FULL_PERSP, CENTER_GLOW * 0.5);
    if (elapsed >= currentCardDuration()) { state = S.POP_OUT; stateStart = ts; }
  }

  else if (state === S.POP_OUT) {
    const p = Math.min(elapsed / POP_DURATION, 1);
    const ep = easeInOutCubic(p), efi = easeOutCubic(p);
    const cur = cards[currentIdx].img;
    const d2 = getFullDim(cur), d1 = getCardDim(cur, CENTER_SCALE);
    const w = lerp(d2.w, d1.w, ep), h = lerp(d2.h, d1.h, ep);
    const sideA = lerp(0, PREV_ALPHA, efi), sideSc = lerp(PREV_SCALE * 0.6, PREV_SCALE, efi);
    drawCard(cards[getPrevIdx()].img, OUTER_X, PREV_Y, sideSc, sideA, PREV_ROT, PREV_PERSP);
    drawCard(cards[getNextIdx()].img, OUTER_X, NEXT_Y, sideSc, sideA, NEXT_ROT, NEXT_PERSP);
    drawCardTransformed(cur, CENTER_X, CENTER_Y, w, h, 1.0,
      lerp(FULL_ROT, CENTER_ROT, efi),
      lerp(FULL_PERSP, CENTER_PERSP, efi),
      lerp(0, CENTER_GLOW, efi));
    if (p >= 1) { state = S.SHIFT; stateStart = ts; }
  }

  else if (state === S.SHIFT) {
    const p = Math.min(elapsed / transitionDuration, 1);
    const ep = easeInOutCubic(p);
    const prevCard = cards[getPrevIdx()].img, curCard = cards[currentIdx].img;
    const nxtCard  = cards[getNextIdx()].img, newNextCard = cards[getNextNextIdx()].img;

    drawCard(prevCard, lerp(OUTER_X, OUTER_X - 20, ep), lerp(PREV_Y, PREV_Y - 200, ep),
      lerp(PREV_SCALE, PREV_SCALE * 0.3, ep), lerp(PREV_ALPHA, 0, ep),
      lerp(PREV_ROT, PREV_ROT - 0.12, ep), lerp(PREV_PERSP, 0.18, ep));

    drawCard(curCard, lerp(CENTER_X, OUTER_X, ep), lerp(CENTER_Y, PREV_Y, ep),
      lerp(CENTER_SCALE, PREV_SCALE, ep), lerp(1.0, PREV_ALPHA, ep),
      lerp(CENTER_ROT, PREV_ROT, ep), lerp(CENTER_PERSP, PREV_PERSP, ep));

    drawCard(nxtCard, lerp(OUTER_X, CENTER_X, ep), lerp(NEXT_Y, CENTER_Y, ep),
      lerp(NEXT_SCALE, CENTER_SCALE, ep), lerp(NEXT_ALPHA, 1.0, ep),
      lerp(NEXT_ROT, CENTER_ROT, ep), lerp(NEXT_PERSP, CENTER_PERSP, ep),
      lerp(0, CENTER_GLOW, ep));

    drawCard(newNextCard, OUTER_X, lerp(NEXT_Y + 230, NEXT_Y, ep),
      lerp(0, NEXT_SCALE, ep), lerp(0, NEXT_ALPHA, ep),
      NEXT_ROT, lerp(0.18, NEXT_PERSP, ep));

    if (p >= 1) { currentIdx = getNextIdx(); state = S.CAROUSEL; stateStart = ts; }
  }

  drawWatermark();
}

// ── rAF ──────────────────────────────────────────
function startRaf() {
  if (!rafId) { stateStart = null; rafId = requestAnimationFrame(drawFrame); }
}

function resetAnimation() {
  currentIdx = 0; state = S.CAROUSEL; stateStart = null;
}

// ── Per-card Duration Helpers ─────────────────────
// Total ms for one full card cycle (using that card's own duration)
function cardCycleMs(card) {
  return CAROUSEL_HOLD + POP_DURATION + card.duration + POP_DURATION + transitionDuration;
}

// Total export duration: sum of all cards × loops
function totalExportMs() {
  return cards.reduce((sum, c) => sum + cardCycleMs(c), 0) * exportLoops + 700;
}

// ── Update Duration Context Bar ───────────────────
function updateContextBar() {
  if (selectedCardIdx === null) {
    durationContextEl.className = 'duration-context global';
    contextLabelEl.textContent  = 'All Cards';
    deselectCardBtn.hidden      = true;
    displayDurationEl.value     = globalDuration;
    displayDurationV.textContent = (globalDuration / 1000).toFixed(1) + 's';
  } else {
    const dur = cards[selectedCardIdx].duration;
    durationContextEl.className = 'duration-context';
    contextLabelEl.textContent  = 'Card ' + (selectedCardIdx + 1) + ' \u00b7 ' + (dur / 1000).toFixed(1) + 's';
    deselectCardBtn.hidden      = false;
    displayDurationEl.value     = dur;
    displayDurationV.textContent = (dur / 1000).toFixed(1) + 's';
  }
}

// ── Select / Deselect Card ────────────────────────
function selectCard(idx) {
  // Clicking same card deselects
  if (selectedCardIdx === idx) {
    selectedCardIdx = null;
  } else {
    selectedCardIdx = idx;
  }
  renderCardList();
  updateContextBar();
}

function deselectCard() {
  selectedCardIdx = null;
  renderCardList();
  updateContextBar();
}

// ── Upload ────────────────────────────────────────
function handleFiles(files) {
  const images = Array.from(files).filter(f => f.type.startsWith('image/'));
  if (!images.length) return;
  let loaded = 0;
  images.forEach(file => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      cards.push({ img, url, name: file.name, duration: globalDuration });
      if (++loaded === images.length) {
        resetAnimation(); renderCardList(); updateUIState(); startRaf();
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
  if (selectedCardIdx === idx) selectedCardIdx = null;
  else if (selectedCardIdx > idx) selectedCardIdx--;
  resetAnimation(); renderCardList(); updateUIState(); updateContextBar();
}

function clearAll() {
  cards.forEach(c => URL.revokeObjectURL(c.url));
  cards.length = 0;
  selectedCardIdx = null;
  isPlaying = false;
  resetAnimation(); renderCardList(); updateUIState(); updateContextBar(); updateExportStatus('');
}

// ── Drag Reorder ──────────────────────────────────
let dragSrcIdx = null;

function renderCardList() {
  cardListEl.innerHTML = '';
  cardCountEl.textContent = cards.length + ' card' + (cards.length !== 1 ? 's' : '');
  clearAllBtn.hidden = cards.length === 0;

  if (!cards.length) {
    cardListEl.innerHTML = '<p class="card-list-empty">No cards yet \u2014 upload 2 or more to begin</p>';
    return;
  }

  cards.forEach((card, i) => {
    const div   = document.createElement('div');
    div.className     = 'card-thumb' + (i === selectedCardIdx ? ' selected' : '');
    div.draggable     = true;
    div.dataset.index = i;

    const img   = document.createElement('img');
    img.src     = card.url;
    img.alt     = 'Card ' + (i + 1);

    const badge = document.createElement('span');
    badge.className   = 'card-index';
    badge.textContent = i + 1;

    // Show duration badge if card has a custom duration different from global
    if (card.duration !== globalDuration) {
      const durBadge       = document.createElement('span');
      durBadge.className   = 'card-dur-badge';
      durBadge.textContent = (card.duration / 1000).toFixed(1) + 's';
      div.appendChild(durBadge);
    }

    const btn   = document.createElement('button');
    btn.className   = 'card-remove';
    btn.title       = 'Remove';
    btn.innerHTML   = '\xd7';
    btn.addEventListener('click', e => { e.stopPropagation(); removeCard(i); });

    div.appendChild(img);
    div.appendChild(badge);
    div.appendChild(btn);

    // Click to select for per-card timing
    div.addEventListener('click', () => selectCard(i));

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
function onDragOver(e)  { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; e.currentTarget.classList.add('drag-target'); }
function onDragLeave(e) { e.currentTarget.classList.remove('drag-target'); }
function onDrop(e) {
  e.preventDefault();
  const t = parseInt(e.currentTarget.dataset.index);
  e.currentTarget.classList.remove('drag-target');
  if (dragSrcIdx !== null && dragSrcIdx !== t) {
    const [m] = cards.splice(dragSrcIdx, 1);
    cards.splice(t, 0, m);
    if (selectedCardIdx === dragSrcIdx) selectedCardIdx = t;
    else if (selectedCardIdx === t) selectedCardIdx = dragSrcIdx;
    resetAnimation(); renderCardList(); updateUIState(); updateContextBar();
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
  if (!ready) { isPlaying = false; playPauseBtn.textContent = '\u25b6 Play'; }
}
function disableControls() {
  playPauseBtn.disabled = exportBtn.disabled = clearAllBtn.disabled = fileInput.disabled = true;
}
function enableControls()  { updateUIState(); clearAllBtn.disabled = fileInput.disabled = false; }
function updateExportStatus(msg) { exportStatusEl.textContent = msg; }

// ── Export ────────────────────────────────────────
function getSupportedMimeType() {
  for (const t of ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'])
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t)) return t;
  return '';
}

function startExport() {
  if (cards.length < 2) return;
  if (typeof MediaRecorder === 'undefined') {
    updateExportStatus('\u274c MediaRecorder not supported. Use Chrome, Edge, or Firefox.');
    return;
  }
  if (!canvas.captureStream) {
    updateExportStatus('\u274c captureStream not supported. Use Chrome or Edge.');
    return;
  }

  const mimeType = getSupportedMimeType();
  const totalMs  = totalExportMs();

  resetAnimation(); stateStart = null;
  isPlaying = true; isRecording = true;
  playPauseBtn.textContent = '\u23f8 Pause';
  disableControls();
  updateExportStatus('\u23fa Recording\u2026 ' + (totalMs / 1000).toFixed(1) + 's');

  const options = mimeType ? { mimeType, videoBitsPerSecond: 4000000 } : {};
  try { mediaRecorder = new MediaRecorder(canvas.captureStream(30), options); }
  catch (err) {
    updateExportStatus('\u274c ' + err.message);
    isRecording = false; enableControls(); return;
  }

  recordedChunks = [];
  mediaRecorder.ondataavailable = e => { if (e.data && e.data.size > 0) recordedChunks.push(e.data); };
  mediaRecorder.onstop = () => {
    clearInterval(progressInterval); isRecording = false; enableControls();
    const a = document.createElement('a');
    a.href     = URL.createObjectURL(new Blob(recordedChunks, { type: mimeType || 'video/webm' }));
    a.download = '3c-clock-carousel.webm';
    a.click();
    updateExportStatus('\u2705 Export complete! Use HandBrake or FFmpeg to convert to MP4.');
  };

  mediaRecorder.start(100);
  const t0 = performance.now();
  progressInterval = setInterval(() => {
    const r = Math.max(0, (totalMs - (performance.now() - t0)) / 1000);
    if (r > 0) updateExportStatus('\u23fa Recording\u2026 ' + r.toFixed(1) + 's remaining');
  }, 200);
  setTimeout(() => { if (mediaRecorder?.state !== 'inactive') mediaRecorder.stop(); }, totalMs);
}

// ── Event Listeners ───────────────────────────────
fileInput.addEventListener('change', () => { handleFiles(fileInput.files); fileInput.value = ''; });
dropZone.addEventListener('click',     () => fileInput.click());
dropZone.addEventListener('dragover',  e  => { e.preventDefault(); dropZone.classList.add('drag-over'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
dropZone.addEventListener('drop', e => {
  e.preventDefault(); dropZone.classList.remove('drag-over'); handleFiles(e.dataTransfer.files);
});
clearAllBtn.addEventListener('click', () => { if (confirm('Remove all cards?')) clearAll(); });

playPauseBtn.addEventListener('click', () => {
  if (isRecording) return;
  isPlaying = !isPlaying;
  playPauseBtn.textContent = isPlaying ? '\u23f8 Pause' : '\u25b6 Play';
  if (isPlaying) stateStart = null;
});

exportBtn.addEventListener('click', () => { if (!isRecording) startExport(); });

// Card Duration slider — global or per-card depending on selection
displayDurationEl.addEventListener('input', function () {
  const val = parseInt(this.value);
  displayDurationV.textContent = (val / 1000).toFixed(1) + 's';

  if (selectedCardIdx !== null) {
    // Per-card mode: update only the selected card
    cards[selectedCardIdx].duration = val;
    contextLabelEl.textContent = 'Card ' + (selectedCardIdx + 1) + ' \u00b7 ' + (val / 1000).toFixed(1) + 's';
    renderCardList();   // refresh badge
  } else {
    // Global mode: update all cards
    globalDuration = val;
    cards.forEach(c => { c.duration = val; });
    renderCardList();   // clear any badges
  }
});

transitionSpeedEl.addEventListener('input', function () {
  transitionDuration = parseInt(this.value);
  transitionSpeedV.textContent = (transitionDuration / 1000).toFixed(1) + 's';
});

exportLoopsEl.addEventListener('input', function () {
  exportLoops = parseInt(this.value);
  exportLoopsV.textContent = exportLoops + '\xd7';
});

bgColorPicker.addEventListener('input',    function () { bgColor = this.value; });
transparentBgEl.addEventListener('change', function () {
  transparentBg = this.checked;
  bgColorPicker.disabled      = transparentBg;
  bgColorPicker.style.opacity = transparentBg ? '0.35' : '1';
});

deselectCardBtn.addEventListener('click', deselectCard);

// ── Init ──────────────────────────────────────────
(function init() {
  displayDurationEl.value      = globalDuration;
  displayDurationV.textContent = (globalDuration / 1000).toFixed(1) + 's';
  updateUIState();
  updateContextBar();
  startRaf();
  drawEmpty();
}());
