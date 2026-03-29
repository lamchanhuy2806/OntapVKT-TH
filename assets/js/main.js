/* ═══════════════════════════════════
   STATE
═══════════════════════════════════ */
let allQuestions = [];
let queue        = [];
let current      = 0;
let attempts     = 0;
let score        = 0;
let currentMode  = null;   // 'study' | 'exam' | 'flash' | 'browse'
let flashIdx     = 0;
let flashFlipped = false;
let browseFilter = '';

const EXAM_COUNT        = 20;
const STUDY_MAX_WRONG   = 2;   // Ôn tập: sai 2 lần thì hiện đáp án
const EXAM_MAX_WRONG    = 1;   // Thi thử: sai 1 lần là qua luôn

/* ═══════════════════════════════════
   HELPERS
═══════════════════════════════════ */
const el   = id => document.getElementById(id);
const show = id => { el(id).style.display = ''; };
const hide = id => { el(id).style.display = 'none'; };

function shuffle(arr) {
  return [...arr].sort(() => Math.random() - 0.5);
}

// Case-sensitive, giữ nguyên dấu câu — chỉ chuẩn hoá khoảng trắng thừa
function norm(s) {
  return s.trim().replace(/\s+/g, ' ');
}

function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function hlText(s, term) {
  const safe = escHtml(s);
  if (!term) return safe;
  const re = new RegExp('(' + term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
  return safe.replace(re, '<mark>$1</mark>');
}

/* ═══════════════════════════════════
   INIT — load JSON
═══════════════════════════════════ */
async function init() {
  try {
    const res = await fetch('./assets/data/questions.json');
    if (!res.ok) throw new Error('Không tìm thấy ./assets/data/questions.json');
    allQuestions = await res.json();
    show('home-screen');
    hide('loading-msg');
  } catch (e) {
    el('loading-msg').textContent = '⚠ ' + e.message;
  }
}

/* ═══════════════════════════════════
   NAVIGATION
═══════════════════════════════════ */
function backToMenu() {
  ['quiz-screen', 'done-screen', 'browse-screen', 'flash-screen'].forEach(hide);
  el('done-screen').classList.remove('visible');
  el('mode-pill').style.display      = 'none';
  el('progress-wrap').style.display  = 'none';
  el('back-btn').classList.remove('visible');
  show('home-screen');
}

function showHeader(modeKey, showProgress) {
  const labels = { study: 'Ôn tập', exam: 'Thi thử', flash: 'Flash card', browse: 'Xem danh sách' };
  const pill = el('mode-pill');
  pill.textContent    = labels[modeKey] || '';
  pill.className      = 'mode-pill ' + modeKey;
  pill.style.display  = 'inline-block';
  el('progress-wrap').style.display = showProgress ? 'flex' : 'none';
  el('back-btn').classList.add('visible');
}

/* ═══════════════════════════════════
   QUIZ MODE (ôn tập + thi thử)
═══════════════════════════════════ */
function startMode(mode) {
  currentMode = mode;

  if (mode === 'flash')  { startFlash();  return; }
  if (mode === 'browse') { startBrowse(); return; }

  queue    = mode === 'study' ? [...allQuestions] : shuffle(allQuestions).slice(0, EXAM_COUNT);
  current  = 0;
  score    = 0;
  attempts = 0;

  hide('home-screen');
  el('done-screen').classList.remove('visible');
  el('done-screen').style.display = 'none';
  show('quiz-screen');
  showHeader(mode, true);
  showQuestion();
}

function showQuestion() {
  const q     = queue[current];
  const total = queue.length;
  attempts    = 0;

  el('progress-text').textContent = (current + 1) + ' / ' + total;
  el('progress-bar').style.width  = ((current / total) * 100) + '%';

  el('category-badge').textContent = q.category || 'Câu hỏi';
  el('question-text').textContent  = q.question  || 'Đây là ký sinh trùng nào?';
  el('question-image').src         = q.image     || '';

  el('dot-1').className = 'dot';
  el('dot-2').className = 'dot';

  const hint = el('hint-text');
  hint.textContent = '';
  hint.classList.remove('visible');

  const inp = el('answer-input');
  inp.value     = '';
  inp.className = 'answer-input';
  inp.disabled  = false;
  setTimeout(function() { inp.focus(); }, 80);

  el('submit-btn').disabled = false;
  el('feedback-panel').className = 'feedback-panel';
  el('correct-answer-line').style.display = 'none';
  el('explanation-text').style.display    = 'none';

  // Reset action buttons
  el('next-btn').classList.remove('visible');
  el('retry-actions').style.display  = 'none';
  el('retype-area').style.display    = 'none';
  el('retype-input').value           = '';
  el('retype-input').className       = 'retype-input';
  el('retype-feedback').textContent  = '';
  el('retype-next-btn').style.display = 'none';

  var qs = el('quiz-screen');
  qs.classList.remove('fade-up');
  void qs.offsetWidth;
  qs.classList.add('fade-up');
}

function maxWrong() {
  return currentMode === 'exam' ? EXAM_MAX_WRONG : STUDY_MAX_WRONG;
}

function checkAnswer() {
  const q   = queue[current];
  const inp = el('answer-input');
  if (!inp.value.trim()) { inp.focus(); return; }

  if (norm(inp.value) === norm(q.answer)) {
    handleCorrect(q);
  } else {
    attempts++;
    handleWrong(q);
  }
}

function handleCorrect(q) {
  const inp = el('answer-input');
  inp.classList.add('st-correct');
  inp.disabled = true;
  el('submit-btn').disabled = true;

  if (currentMode === 'exam') score++;

  var dotIdx = Math.min(attempts + 1, 2);
  el('dot-' + dotIdx).className = 'dot correct';

  el('feedback-panel').className = 'feedback-panel fp-correct visible';
  el('feedback-icon').textContent  = '✓';
  el('feedback-label').textContent = 'Chính xác!';
  el('correct-answer-line').style.display = 'none';
  el('explanation-text').style.display    = 'none';

  setTimeout(function() { el('next-btn').classList.add('visible'); }, 350);
}

function handleWrong(q) {
  const inp = el('answer-input');

  // Chấm đỏ
  var dotEl = el('dot-' + Math.min(attempts, 2));
  if (dotEl) dotEl.className = 'dot wrong';

  // Shake
  inp.classList.add('st-wrong', 'shake');
  setTimeout(function() { inp.classList.remove('shake', 'st-wrong'); }, 420);

  // Gợi ý sau lần sai 1 (study)
  if (attempts === 1 && q.hint && currentMode === 'study') {
    var h = el('hint-text');
    h.textContent = '💡 ' + q.hint;
    h.classList.add('visible');
  }

  if (attempts >= maxWrong()) {
    // Khoá ô nhập
    inp.disabled = true;
    el('submit-btn').disabled = true;

    // Hiện feedback đỏ + đáp án đúng
    el('feedback-panel').className = 'feedback-panel fp-wrong visible';
    el('feedback-icon').textContent  = '✗';

    if (currentMode === 'exam') {
      // EXAM: thông báo gọn, chỉ cho qua
      el('feedback-label').textContent = 'Sai! Đáp án đúng là:';
    } else {
      // STUDY: cho xem giải thích + chọn điền lại
      el('feedback-label').textContent = 'Đáp án đúng là:';
    }

    var al = el('correct-answer-line');
    al.innerHTML = '<strong>' + escHtml(q.answer) + '</strong>';
    al.style.display = 'block';

    if (q.explanation) {
      var ex = el('explanation-text');
      ex.textContent   = q.explanation;
      ex.style.display = 'block';
    }

    setTimeout(function() { showPostWrongActions(q); }, 350);
  } else {
    // Chưa hết lượt — cho thử lại
    inp.value = '';
    inp.focus();
  }
}

/* Hiện nút hành động sau khi sai hết lượt */
function showPostWrongActions(q) {
  if (currentMode === 'exam') {
    // Exam: chỉ nút "Câu tiếp theo"
    el('next-btn').classList.add('visible');
    el('retry-actions').style.display = 'none';
    el('retype-area').style.display   = 'none';
  } else {
    // Study: 2 lựa chọn — điền lại hoặc bỏ qua
    el('next-btn').classList.remove('visible');
    el('retype-area').style.display   = 'none';
    el('retry-actions').style.display = 'flex';
  }
}

/* Người dùng chọn "Điền lại để ghi nhớ" */
function retypeAnswer() {
  el('retry-actions').style.display = 'none';
  var area = el('retype-area');
  area.style.display = 'flex';
  var inp = el('retype-input');
  inp.value     = '';
  inp.className = 'retype-input';
  el('retype-feedback').textContent = '';
  el('retype-feedback').className   = 'retype-feedback';
  el('retype-next-btn').style.display = 'none';
  setTimeout(function() { inp.focus(); }, 60);
}

/* Kiểm tra đáp án điền lại */
function checkRetype() {
  var q   = queue[current];
  var inp = el('retype-input');
  var fb  = el('retype-feedback');

  if (!inp.value.trim()) { inp.focus(); return; }

  if (norm(inp.value) === norm(q.answer)) {
    inp.className = 'retype-input ok';
    fb.textContent = '✓ Chính xác! Bạn đã nhớ rồi.';
    fb.className   = 'retype-feedback ok';
    inp.disabled   = true;
    el('retype-next-btn').style.display = 'block';
  } else {
    inp.classList.add('fail', 'shake');
    setTimeout(function() { inp.classList.remove('shake'); }, 420);
    fb.textContent = '✗ Chưa đúng — thử lại nhé.';
    fb.className   = 'retype-feedback fail';
    inp.value = '';
    setTimeout(function() { inp.focus(); }, 60);
  }
}

function nextQuestion() {
  current++;
  if (current >= queue.length) showDone();
  else showQuestion();
}

/* ═══════════════════════════════════
   DONE SCREEN
═══════════════════════════════════ */
function showDone() {
  hide('quiz-screen');
  el('progress-bar').style.width  = '100%';
  el('progress-text').textContent = queue.length + ' / ' + queue.length;

  var done = el('done-screen');
  done.style.display = '';
  done.classList.add('visible');

  if (currentMode === 'study') {
    el('done-eyebrow').textContent = 'Ôn tập hoàn thành';
    show('done-study');
    hide('done-exam');
  } else {
    el('done-eyebrow').textContent = 'Kết quả thi thử';
    hide('done-study');
    show('done-exam');

    var pct = Math.round((score / queue.length) * 100);
    el('exam-pct').textContent      = pct + '%';
    el('exam-fraction').textContent = score + ' / ' + queue.length + ' câu đúng';

    var bar = el('exam-bar');
    bar.className = 'exam-bar ' + (pct >= 80 ? 'good' : pct >= 50 ? 'ok' : 'bad');
    el('exam-pct').style.color = pct >= 80 ? 'var(--green)' : pct >= 50 ? 'var(--amber)' : 'var(--red)';
    setTimeout(function() { bar.style.width = pct + '%'; }, 80);

    var msg = '';
    if      (pct === 100) msg = 'Hoàn hảo! Bạn đúng tất cả.';
    else if (pct >= 80)   msg = 'Rất tốt! Còn <strong>' + (queue.length - score) + '</strong> câu cần xem lại.';
    else if (pct >= 50)   msg = 'Đạt yêu cầu. Nên ôn lại <strong>' + (queue.length - score) + '</strong> câu sai.';
    else                  msg = 'Cần cố gắng thêm. Vào <em>Ôn tập</em> để xem lại nhé.';
    el('exam-summary').innerHTML = msg;
  }
}

/* ═══════════════════════════════════
   BROWSE MODE
═══════════════════════════════════ */
function startBrowse() {
  browseFilter = '';
  hide('home-screen');
  show('browse-screen');
  showHeader('browse', false);
  el('browse-search').value = '';
  buildBrowseCats();
  renderBrowse();
}

function buildBrowseCats() {
  var cats = Array.from(new Set(allQuestions.map(function(q) { return q.category; }).filter(Boolean))).sort();
  var row = el('browse-cats');
  row.innerHTML = '<button class="bcat-chip active" data-cat="">Tất cả</button>';
  cats.forEach(function(cat) {
    var btn = document.createElement('button');
    btn.className    = 'bcat-chip';
    btn.dataset.cat  = cat;
    btn.textContent  = cat;
    row.appendChild(btn);
  });
  row.querySelectorAll('.bcat-chip').forEach(function(btn) {
    btn.addEventListener('click', function() { setBrowseFilter(btn.dataset.cat); });
  });
}

function setBrowseFilter(cat) {
  browseFilter = cat;
  el('browse-cats').querySelectorAll('.bcat-chip').forEach(function(b) {
    b.classList.toggle('active', b.dataset.cat === cat);
  });
  renderBrowse();
}

function renderBrowse() {
  var term = (el('browse-search').value || '').trim().toLowerCase();

  var filtered = allQuestions.filter(function(q) {
    if (browseFilter && q.category !== browseFilter) return false;
    if (!term) return true;
    return (q.answer   || '').toLowerCase().includes(term)
        || (q.category || '').toLowerCase().includes(term);
  });

  el('browse-count').textContent = (term || browseFilter)
    ? filtered.length + ' / ' + allQuestions.length + ' loài'
    : allQuestions.length + ' loài';

  if (!filtered.length) {
    el('browse-grid').innerHTML = '<div style="grid-column:1/-1;padding:40px;text-align:center;font-family:var(--mono);font-size:12px;color:var(--muted)">Không tìm thấy kết quả</div>';
    return;
  }

  el('browse-grid').innerHTML = filtered.map(function(q) {
    var idx = allQuestions.indexOf(q) + 1;
    return '<div class="browse-item" data-qid="' + escHtml(q.id) + '">'
         + '<span class="bi-num">' + String(idx).padStart(2, '0') + '</span>'
         + '<div class="bi-thumb"><img src="' + escHtml(q.image || '') + '" alt="" onerror="this.style.display=\'none\'"></div>'
         + '<div class="bi-info">'
         + '<div class="bi-name">' + hlText(q.answer || '', term) + '</div>'
         + '<div class="bi-cat">'  + hlText(q.category || '—', term) + '</div>'
         + '</div></div>';
  }).join('');

  el('browse-grid').querySelectorAll('.browse-item').forEach(function(item) {
    item.addEventListener('click', function() { openDetail(item.dataset.qid); });
  });
}

function openDetail(id) {
  var q = allQuestions.find(function(x) { return x.id === id; });
  if (!q) return;
  el('detail-img').src          = q.image    || '';
  el('detail-cat').textContent  = q.category || '';
  el('detail-name').textContent = q.answer   || '';
  el('detail-hint').textContent = q.hint ? '💡 ' + q.hint : '';
  var exp = el('detail-explain');
  if (q.explanation) {
    exp.textContent = q.explanation;
    exp.classList.remove('empty');
  } else {
    exp.textContent = 'Chưa có mô tả.';
    exp.classList.add('empty');
  }
  el('detail-modal').classList.add('open');
}

function closeDetailModal() {
  el('detail-modal').classList.remove('open');
}

/* ═══════════════════════════════════
   FLASH CARD MODE
═══════════════════════════════════ */
function startFlash() {
  queue        = shuffle([...allQuestions]);
  flashIdx     = 0;
  flashFlipped = false;
  hide('home-screen');
  show('flash-screen');
  showHeader('flash', false);
  renderFlash();
}

function renderFlash() {
  var q = queue[flashIdx];

  // Reset về mặt trước (tắt transition để không animate khi đổi thẻ)
  flashFlipped = false;
  var inner = el('flash-card-inner');
  inner.style.transition = 'none';
  inner.classList.remove('flipped');
  void inner.offsetWidth; // force reflow
  inner.style.transition = '';

  // Cập nhật nội dung
  el('flash-badge').textContent    = q.category || 'Flash card';
  el('flash-counter').textContent  = (flashIdx + 1) + ' / ' + queue.length;
  el('flash-image').src            = q.image || '';

  // Điền sẵn mặt sau
  el('flash-back-cat').textContent  = q.category || '';
  el('flash-back-name').textContent = q.answer   || '';
  el('flash-back-hint').textContent = q.hint     || '';

  var divider = el('flash-back-divider');
  var exp     = el('flash-back-exp');
  if (q.explanation) {
    exp.textContent    = q.explanation;
    exp.style.display  = '';
    divider.style.display = '';
  } else {
    exp.textContent    = '';
    exp.style.display  = 'none';
    divider.style.display = 'none';
  }
}

function flipFlash() {
  flashFlipped = !flashFlipped;
  el('flash-card-inner').classList.toggle('flipped', flashFlipped);
}

function nextFlash() {
  flashIdx = (flashIdx + 1) % queue.length;
  renderFlash();
}

function prevFlash() {
  flashIdx = (flashIdx - 1 + queue.length) % queue.length;
  renderFlash();
}

/* ═══════════════════════════════════
   LIGHTBOX
═══════════════════════════════════ */
function openLightbox(src) {
  el('lightbox-img').src = src;
  el('lightbox').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeLightbox() {
  el('lightbox').classList.remove('open');
  document.body.style.overflow = '';
}

/* ═══════════════════════════════════
   KEYBOARD SHORTCUTS
═══════════════════════════════════ */
document.addEventListener('DOMContentLoaded', function() {
  document.addEventListener('keydown', function(e) {

    // Escape — đóng lightbox / modal
    if (e.key === 'Escape') {
      closeLightbox();
      closeDetailModal();
      return;
    }

    // Flash card shortcuts
    if (el('flash-screen').style.display !== 'none') {
      if (e.key === 'ArrowRight') { nextFlash(); return; }
      if (e.key === 'ArrowLeft')  { prevFlash(); return; }
      if (e.key === ' ')          { e.preventDefault(); flipFlash(); return; }
      return;
    }

    // Quiz shortcuts
    if (e.key !== 'Enter') return;

    // Nếu đang ở ô retype
    if (el('retype-area') && el('retype-area').style.display !== 'none') {
      var rn = el('retype-next-btn');
      if (rn && rn.style.display !== 'none') nextQuestion();
      else checkRetype();
      return;
    }

    var nb = el('next-btn');
    if (nb && nb.classList.contains('visible')) nextQuestion();
    else checkAnswer();
  });

  init();
});