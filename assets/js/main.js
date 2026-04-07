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
let retryMode    = false;  // true = đang ở chế độ điền lại ghi nhớ
let answered     = false;  // guard tránh double-trigger checkAnswer
let examTimer    = null;   // setInterval ID
let examSeconds  = 0;      // số giây còn lại

const EXAM_COUNT        = 20;
const EXAM_DURATION_SEC = 20 * 60;  // 20 phút
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
  stopExamTimer();
  ['quiz-screen', 'done-screen', 'browse-screen', 'flash-screen', 'gallery-screen'].forEach(hide);
  el('done-screen').classList.remove('visible');
  el('mode-pill').style.display      = 'none';
  el('progress-wrap').style.display  = 'none';
  el('back-btn').classList.remove('visible');
  show('home-screen');
}

function showHeader(modeKey, showProgress) {
  const labels = { study: 'Ôn tập', exam: 'Thi thử', flash: 'Flash card', browse: 'Xem danh sách', gallery: 'Thư viện ảnh' };
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

  if (mode === 'flash')   { startFlash();   return; }
  if (mode === 'browse')  { startBrowse();  return; }
  if (mode === 'gallery') { startGallery(); return; }

  queue    = mode === 'study' ? [...allQuestions] : shuffle(allQuestions).slice(0, EXAM_COUNT);
  current  = 0;
  score    = 0;
  attempts = 0;

  hide('home-screen');
  el('done-screen').classList.remove('visible');
  el('done-screen').style.display = 'none';
  show('quiz-screen');
  showHeader(mode, true);

  // Khởi động timer nếu thi thử
  stopExamTimer();
  if (mode === 'exam') startExamTimer();

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
  // Exam chỉ 1 lần → ẩn chấm thứ 2
  el('dot-2').style.display = currentMode === 'exam' ? 'none' : '';

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
  retryMode = false;
  answered  = false;
  el('next-btn').classList.remove('visible');
  // Reset input label & submit button về trạng thái gốc
  el('input-label').textContent     = 'Đáp án của bạn';
  el('input-label').style.color     = '';
  el('submit-btn').textContent      = 'Kiểm tra';
  el('submit-btn').style.background = '';

  var qs = el('quiz-screen');
  qs.classList.remove('fade-up');
  void qs.offsetWidth;
  qs.classList.add('fade-up');
}

function maxWrong() {
  return currentMode === 'exam' ? EXAM_MAX_WRONG : STUDY_MAX_WRONG;
}

function checkAnswer() {
  if (retryMode) { checkRetype(); return; }
  if (answered)  return;  // chặn double-trigger

  const q   = queue[current];
  const inp = el('answer-input');
  if (!inp.value.trim()) { inp.focus(); return; }

  answered = true;  // lock ngay lập tức

  if (norm(inp.value) === norm(q.answer)) {
    handleCorrect(q);
  } else {
    answered = false;  // sai thì mở lại để thử tiếp
    attempts++;
    handleWrong(q);
  }
}

/* ═══════════════════════════════════
   SOUND
═══════════════════════════════════ */
var audioCtx = null;

function getAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

function playCorrectSound() {
  try {
    var ctx = getAudioCtx();
    // Azota-style: 2 nốt cao nhanh E6 → G6, attack cực ngắn, decay mượt
    var notes = [
      { freq: 1318.5, t: 0.00 },   // E6
      { freq: 1567.0, t: 0.11 },   // G6
    ];
    notes.forEach(function(n) {
      var osc  = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.type = 'sine';
      osc.frequency.setValueAtTime(n.freq, ctx.currentTime + n.t);

      gain.gain.setValueAtTime(0.0,  ctx.currentTime + n.t);
      gain.gain.linearRampToValueAtTime(0.35, ctx.currentTime + n.t + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + n.t + 0.18);

      osc.start(ctx.currentTime + n.t);
      osc.stop(ctx.currentTime  + n.t + 0.20);
    });
  } catch (e) {}
}

function handleCorrect(q) {
  const inp = el('answer-input');
  inp.classList.add('st-correct');
  inp.disabled = true;
  el('submit-btn').disabled = true;

  if (currentMode === 'exam') score++;

  playCorrectSound();

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
    // Exam: chỉ "Câu tiếp theo" luôn
    el('next-btn').classList.add('visible');
  } else {
    // Study: mở lại ô input để điền lại ghi nhớ
    retryMode = true;
    var inp = el('answer-input');
    inp.value     = '';
    inp.className = 'answer-input';
    inp.disabled  = false;

    // Đổi label thành gợi ý tím
    el('input-label').textContent  = '✏ Điền lại đáp án để ghi nhớ (hoặc nhấn →)';
    el('input-label').style.color  = 'var(--purple)';

    // Đổi nút submit thành "Ghi nhớ"
    el('submit-btn').textContent      = 'Ghi nhớ ✓';
    el('submit-btn').style.background = 'var(--purple)';
    el('submit-btn').disabled         = false;

    // Hiện nút bỏ qua (next-btn dùng làm skip)
    el('next-btn').classList.add('visible');
    el('next-btn').textContent = 'Bỏ qua →';

    setTimeout(function() { inp.focus(); }, 80);
  }
}

/* Kiểm tra đáp án điền lại (dùng lại ô input gốc) */
function checkRetype() {
  var q   = queue[current];
  var inp = el('answer-input');
  if (!inp.value.trim()) { inp.focus(); return; }

  if (norm(inp.value) === norm(q.answer)) {
    // Đúng → xanh + khoá + đổi next-btn
    inp.className = 'answer-input st-correct';
    inp.disabled  = true;
    el('submit-btn').disabled    = true;
    el('next-btn').textContent   = 'Câu tiếp theo →';
    el('next-btn').classList.add('visible');
    retryMode = false;
  } else {
    // Sai → shake, xoá, thử lại
    inp.classList.add('st-wrong', 'shake');
    setTimeout(function() {
      inp.classList.remove('shake', 'st-wrong');
      inp.value = '';
      inp.focus();
    }, 420);
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
  stopExamTimer();
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
    el('done-eyebrow').textContent = examSeconds <= 0 ? 'Hết giờ — Kết quả thi thử' : 'Kết quả thi thử';
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
   EXAM TIMER
═══════════════════════════════════ */
function startExamTimer() {
  examSeconds = EXAM_DURATION_SEC;
  updateTimerDisplay();
  el('exam-timer').style.display = 'flex';
  el('exam-timer').className = 'exam-timer';

  examTimer = setInterval(function() {
    examSeconds--;
    updateTimerDisplay();

    // Cảnh báo vàng khi còn 5 phút
    if (examSeconds === 5 * 60) {
      el('exam-timer').className = 'exam-timer warning';
    }
    // Cảnh báo đỏ khi còn 1 phút
    if (examSeconds === 60) {
      el('exam-timer').className = 'exam-timer danger';
    }
    // Hết giờ → tính điểm luôn
    if (examSeconds <= 0) {
      stopExamTimer();
      showDone();
    }
  }, 1000);
}

function stopExamTimer() {
  if (examTimer) {
    clearInterval(examTimer);
    examTimer = null;
  }
  el('exam-timer').style.display = 'none';
  el('exam-timer').className = 'exam-timer';
}

function updateTimerDisplay() {
  var m = Math.floor(examSeconds / 60);
  var s = examSeconds % 60;
  el('timer-text').textContent = pad2(m) + ':' + pad2(s);
}

function pad2(n) {
  return n < 10 ? '0' + n : String(n);
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
   GALLERY MODE
═══════════════════════════════════ */
var galleryFilter  = '';
var gmCurrentQ     = null;   // question đang xem trong modal
var gmCurrentIdx   = 0;      // index ảnh đang xem

function startGallery() {
  galleryFilter = '';
  hide('home-screen');
  show('gallery-screen');
  showHeader('gallery', false);
  el('gallery-search').value = '';
  buildGalleryCats();
  renderGallery();
}

function buildGalleryCats() {
  var cats = Array.from(new Set(allQuestions.map(function(q) {
    return q.category;
  }).filter(Boolean))).sort();

  var row = el('gallery-cats');
  row.innerHTML = '<button class="bcat-chip active" data-cat="">Tất cả</button>';
  cats.forEach(function(cat) {
    var btn = document.createElement('button');
    btn.className   = 'bcat-chip';
    btn.dataset.cat = cat;
    btn.textContent = cat;
    row.appendChild(btn);
  });
  row.querySelectorAll('.bcat-chip').forEach(function(btn) {
    btn.addEventListener('click', function() { setGalleryFilter(btn.dataset.cat); });
  });
}

function setGalleryFilter(cat) {
  galleryFilter = cat;
  el('gallery-cats').querySelectorAll('.bcat-chip').forEach(function(b) {
    b.classList.toggle('active', b.dataset.cat === cat);
  });
  renderGallery();
}

function renderGallery() {
  var term = (el('gallery-search').value || '').trim().toLowerCase();

  var filtered = allQuestions.filter(function(q) {
    if (galleryFilter && q.category !== galleryFilter) return false;
    if (!term) return true;
    return (q.answer   || '').toLowerCase().includes(term)
        || (q.category || '').toLowerCase().includes(term);
  });

  el('gallery-count').textContent = (term || galleryFilter)
    ? filtered.length + ' / ' + allQuestions.length + ' loài'
    : allQuestions.length + ' loài';

  if (!filtered.length) {
    el('gallery-grid').innerHTML = '<div style="grid-column:1/-1;padding:40px;text-align:center;font-family:var(--mono);font-size:12px;color:var(--muted)">Không tìm thấy kết quả</div>';
    return;
  }

    // Dùng createElement để tránh vấn đề escape quote trong HTML string
  var grid = el('gallery-grid');
  grid.innerHTML = '';
  filtered.forEach(function(q) {
    var images = getImages(q);
    var thumb  = images.length > 0 ? images[0].src : (q.image || '');
    var count  = images.length;

    var item = document.createElement('div');
    item.className = 'gallery-item';
    item.dataset.qid = q.id;

    var img = document.createElement('img');
    img.src     = thumb;
    img.alt     = '';
    img.loading = 'lazy';
    img.onerror = function() { this.style.display = 'none'; };
    item.appendChild(img);

    if (count > 1) {
      var badge = document.createElement('div');
      badge.className   = 'gallery-item-badge';
      badge.textContent = '🖼 ' + count;
      item.appendChild(badge);
    }

    var overlay = document.createElement('div');
    overlay.className = 'gallery-item-overlay';
    var nameEl = document.createElement('div');
    nameEl.className   = 'gallery-item-name';
    nameEl.textContent = q.answer || '';
    var catEl = document.createElement('div');
    catEl.className   = 'gallery-item-cat';
    catEl.textContent = q.category || '';
    overlay.appendChild(nameEl);
    overlay.appendChild(catEl);
    item.appendChild(overlay);

    item.addEventListener('click', function() { openGalleryModal(q.id); });
    grid.appendChild(item);
  });
}

/* Lấy danh sách ảnh của 1 question — hỗ trợ cả field images[] lẫn field image */
function getImages(q) {
  if (q.images && q.images.length > 0) return q.images;
  if (q.image) return [{ src: q.image, caption: '' }];
  return [];
}

/* Mở modal slideshow */
function openGalleryModal(id) {
  var q = allQuestions.find(function(x) { return x.id === id; });
  if (!q) return;
  gmCurrentQ   = q;
  gmCurrentIdx = 0;

  // Thông tin
  el('gm-cat').textContent  = q.category || '';
  el('gm-name').textContent = q.answer   || '';

  // Hint + giải thích
  el('gm-hint').textContent = q.hint ? '💡 ' + q.hint : '';
  var exp = el('gm-explain');
  if (q.explanation) {
    exp.textContent = q.explanation;
    exp.classList.remove('empty');
  } else {
    exp.textContent = 'Chưa có mô tả.';
    exp.classList.add('empty');
  }

  // Thumbnails
  renderGmThumbs(q);

  // Ảnh đầu tiên
  renderGmSlide(0);

  el('gallery-modal').classList.add('open');
}

function renderGmThumbs(q) {
  var images = getImages(q);
  if (images.length <= 1) {
    el('gm-thumbs').innerHTML = '';
    el('gm-thumbs').style.display = 'none';
    return;
  }
  el('gm-thumbs').style.display = 'flex';
  var thumbsWrap = el('gm-thumbs');
  thumbsWrap.innerHTML = '';
  images.forEach(function(img, i) {
    var thumb = document.createElement('div');
    thumb.className    = 'gm-thumb' + (i === 0 ? ' active' : '');
    thumb.dataset.idx  = i;
    var tImg = document.createElement('img');
    tImg.src     = img.src || '';
    tImg.alt     = '';
    tImg.loading = 'lazy';
    tImg.onerror = function() { this.style.display = 'none'; };
    thumb.appendChild(tImg);
    thumb.addEventListener('click', function() { renderGmSlide(i); });
    thumbsWrap.appendChild(thumb);
  });
}

function renderGmSlide(idx) {
  var images = getImages(gmCurrentQ);
  if (!images.length) return;

  // Clamp
  idx = Math.max(0, Math.min(idx, images.length - 1));
  gmCurrentIdx = idx;

  var img = images[idx];
  el('gm-img').src = img.src || '';
  el('gm-caption').textContent = img.caption || '';
  el('gm-counter').textContent = (idx + 1) + ' / ' + images.length;

  // Ẩn/hiện mũi tên
  el('gm-prev').classList.toggle('hidden', idx === 0);
  el('gm-next').classList.toggle('hidden', idx === images.length - 1);

  // Active thumbnail
  var thumbs = el('gm-thumbs').querySelectorAll('.gm-thumb');
  thumbs.forEach(function(t, i) { t.classList.toggle('active', i === idx); });

  // Scroll thumbnail vào view
  if (thumbs[idx]) {
    thumbs[idx].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }
}

function slideGallery(dir) {
  renderGmSlide(gmCurrentIdx + dir);
}

function closeGalleryModal() {
  el('gallery-modal').classList.remove('open');
  gmCurrentQ   = null;
  gmCurrentIdx = 0;
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
      closeGalleryModal();
      return;
    }

    // Gallery modal keyboard: ← → để chuyển ảnh
    if (el('gallery-modal').classList.contains('open')) {
      if (e.key === 'ArrowRight') { slideGallery(1);  return; }
      if (e.key === 'ArrowLeft')  { slideGallery(-1); return; }
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
    e.preventDefault(); // ngăn browser tự click button, tránh double-trigger

    var nb = el('next-btn');
    if (retryMode) { checkAnswer(); return; }
    if (nb && nb.classList.contains('visible')) nextQuestion();
    else checkAnswer();
  });

  init();
});