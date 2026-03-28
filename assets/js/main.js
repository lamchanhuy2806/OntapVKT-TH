
/* ══════ STATE ══════ */
let allQuestions = [];
let queue        = [];
let current      = 0;
let attempts     = 0;
let score        = 0;
let currentMode  = null;
let flashIdx     = 0;
let flashFlipped = false;
let browseFilter = '';

const EXAM_COUNT = 20;
const MAX_WRONG  = 2;

/* ══════ INIT ══════ */
async function init() {
  try {
    const res = await fetch('./assets/data/questions.json');
    if (!res.ok) throw new Error('Không tìm thấy data/questions.json');
    allQuestions = await res.json();
    show('home-screen'); hide('loading-msg');
  } catch (e) {
    el('loading-msg').textContent = '⚠ ' + e.message;
  }
}

/* ══════ NAVIGATION ══════ */
function backToMenu() {
  ['quiz-screen','done-screen','browse-screen','flash-screen'].forEach(hide);
  el('done-screen').classList.remove('visible');
  el('mode-pill').style.display  = 'none';
  el('progress-wrap').style.display = 'none';
  el('back-btn').classList.remove('visible');
  show('home-screen');
}

function showHeader(modeKey, showProgress) {
  const pill = el('mode-pill');
  const labels = { study:'Ôn tập', exam:'Thi thử', flash:'Flash card', browse:'Xem danh sách' };
  pill.textContent = labels[modeKey] || '';
  pill.className   = 'mode-pill ' + modeKey;
  pill.style.display = 'inline-block';
  el('progress-wrap').style.display = showProgress ? 'flex' : 'none';
  el('back-btn').classList.add('visible');
}

/* ══════ QUIZ MODE ══════ */
function startMode(mode) {
  currentMode = mode;

  if (mode === 'flash') { startFlash(); return; }

  queue    = mode === 'study' ? [...allQuestions] : shuffle(allQuestions).slice(0, EXAM_COUNT);
  current  = 0; score = 0; attempts = 0;

  hide('home-screen');
  el('done-screen').classList.remove('visible');
  el('done-screen').style.display = 'none';
  show('quiz-screen');
  showHeader(mode, true);
  showQuestion();
}

function showQuestion() {
  const q = queue[current], total = queue.length;
  attempts = 0;
  el('progress-text').textContent = `${current+1} / ${total}`;
  el('progress-bar').style.width  = `${(current/total)*100}%`;
  el('category-badge').textContent = q.category || 'Câu hỏi';
  el('question-text').textContent  = q.question  || 'Đây là ký sinh trùng nào?';
  el('question-image').src         = q.image     || '';
  el('dot-1').className = el('dot-2').className = 'dot';
  const hint = el('hint-text'); hint.textContent = ''; hint.classList.remove('visible');
  const inp  = el('answer-input'); inp.value = ''; inp.className = 'answer-input'; inp.disabled = false;
  setTimeout(() => inp.focus(), 80);
  el('submit-btn').disabled = false;
  el('feedback-panel').className = 'feedback-panel';
  el('correct-answer-line').style.display = el('explanation-text').style.display = 'none';
  el('next-btn').classList.remove('visible');
  const qs = el('quiz-screen'); qs.classList.remove('fade-up'); void qs.offsetWidth; qs.classList.add('fade-up');
}

function checkAnswer() {
  const q = queue[current], inp = el('answer-input');
  if (!inp.value.trim()) { inp.focus(); return; }
  norm(inp.value) === norm(q.answer) ? handleCorrect(q) : (attempts++, handleWrong(q));
}

function handleCorrect(q) {
  const inp = el('answer-input'); inp.classList.add('st-correct'); inp.disabled = true;
  el('submit-btn').disabled = true;
  if (currentMode === 'exam') score++;
  el(`dot-${Math.min(attempts+1,2)}`).className = 'dot correct';
  el('feedback-panel').className = 'feedback-panel fp-correct visible';
  el('feedback-icon').textContent  = '✓';
  el('feedback-label').textContent = 'Chính xác!';
  el('correct-answer-line').style.display = el('explanation-text').style.display = 'none';
  setTimeout(() => el('next-btn').classList.add('visible'), 350);
}

function handleWrong(q) {
  const inp = el('answer-input');
  const dotEl = el(`dot-${Math.min(attempts,2)}`); if (dotEl) dotEl.className = 'dot wrong';
  inp.classList.add('st-wrong','shake');
  setTimeout(() => inp.classList.remove('shake','st-wrong'), 420);
  if (attempts === 1 && q.hint) { const h = el('hint-text'); h.textContent = '💡 ' + q.hint; h.classList.add('visible'); }
  if (attempts >= MAX_WRONG) {
    inp.disabled = true; el('submit-btn').disabled = true;
    el('feedback-panel').className = 'feedback-panel fp-wrong visible';
    el('feedback-icon').textContent  = '✗';
    el('feedback-label').textContent = 'Đáp án đúng là:';
    const al = el('correct-answer-line'); al.innerHTML = `<strong>${q.answer}</strong>`; al.style.display = 'block';
    if (q.explanation) { const ex = el('explanation-text'); ex.textContent = q.explanation; ex.style.display = 'block'; }
    setTimeout(() => el('next-btn').classList.add('visible'), 350);
  } else { inp.value = ''; inp.focus(); }
}

function nextQuestion() {
  current++;
  current >= queue.length ? showDone() : showQuestion();
}

function showDone() {
  hide('quiz-screen');
  el('progress-bar').style.width  = '100%';
  el('progress-text').textContent = `${queue.length} / ${queue.length}`;
  const done = el('done-screen'); done.style.display = ''; done.classList.add('visible');
  if (currentMode === 'study') {
    el('done-eyebrow').textContent = 'Ôn tập hoàn thành';
    show('done-study'); hide('done-exam');
  } else {
    el('done-eyebrow').textContent = 'Kết quả thi thử';
    hide('done-study'); show('done-exam');
    const pct = Math.round((score/queue.length)*100);
    el('exam-pct').textContent      = pct + '%';
    el('exam-fraction').textContent = `${score} / ${queue.length} câu đúng`;
    const bar = el('exam-bar');
    bar.className = 'exam-bar ' + (pct>=80?'good':pct>=50?'ok':'bad');
    el('exam-pct').style.color = pct>=80?'var(--green)':pct>=50?'var(--amber)':'var(--red)';
    setTimeout(() => bar.style.width = pct+'%', 80);
    let msg = pct===100 ? 'Hoàn hảo! Bạn đúng tất cả.' :
              pct>=80   ? `Rất tốt! Còn <strong>${queue.length-score}</strong> câu cần xem lại.` :
              pct>=50   ? `Đạt yêu cầu. Nên ôn lại <strong>${queue.length-score}</strong> câu sai.` :
                          `Cần cố gắng thêm. Vào <em>Ôn tập</em> để xem lại nhé.`;
    el('exam-summary').innerHTML = msg;
  }
}

/* ══════ BROWSE MODE ══════ */
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
  const cats = ['', ...new Set(allQuestions.map(q => q.category).filter(Boolean))].sort((a,b) => a ? a.localeCompare(b) : -1);
  el('browse-cats').innerHTML = cats.map(c =>
    `<button class="bcat-chip${c===browseFilter?' active':''}" onclick="setBrowseFilter('${c}')">${c||'Tất cả'}</button>`
  ).join('');
}

function setBrowseFilter(cat) {
  browseFilter = cat;
  document.querySelectorAll('.bcat-chip').forEach(b => b.classList.toggle('active', b.textContent === (cat||'Tất cả')));
  renderBrowse();
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function hlText(s, term) {
  const safe = escHtml(s);
  if (!term) return safe;
  const re = new RegExp('(' + term.replace(/[.*+?^${}()|[\]\\]/g,'\\$&') + ')', 'gi');
  return safe.replace(re, '<mark>$1</mark>');
}

function renderBrowse() {
  const term = (el('browse-search').value || '').trim().toLowerCase();
  const filtered = allQuestions.filter(function(q) {
    if (browseFilter && q.category !== browseFilter) return false;
    if (!term) return true;
    return (q.answer||'').toLowerCase().includes(term)
        || (q.category||'').toLowerCase().includes(term);
  });

  el('browse-count').textContent = (term || browseFilter)
    ? filtered.length + ' / ' + allQuestions.length + ' loài'
    : allQuestions.length + ' loài';

  if (!filtered.length) {
    el('browse-grid').innerHTML = '<div style="grid-column:1/-1;padding:40px;text-align:center;font-family:var(--mono);font-size:12px;color:var(--muted)">Không tìm thấy kết quả</div>';
    return;
  }

  el('browse-grid').innerHTML = filtered.map(function(q) {
    const idx = allQuestions.indexOf(q) + 1;
    return '<div class="browse-item" data-qid="' + escHtml(q.id) + '">'
         + '<span class="bi-num">' + String(idx).padStart(2,'0') + '</span>'
         + '<div class="bi-thumb"><img src="' + escHtml(q.image||'') + '" alt="" onerror="this.style.display=\'none\'"></div>'
         + '<div class="bi-info">'
         + '<div class="bi-name">' + hlText(q.answer||'', term) + '</div>'
         + '<div class="bi-cat">'  + hlText(q.category||'—', term) + '</div>'
         + '</div></div>';
  }).join('');

  // Gắn click listener sau khi render — tránh lỗi inline onclick với ký tự đặc biệt
  el('browse-grid').querySelectorAll('.browse-item').forEach(function(item) {
    item.addEventListener('click', function() { openDetail(item.dataset.qid); });
  });
}

function openDetail(id) {
  const q = allQuestions.find(x => x.id === id); if (!q) return;
  el('detail-img').src         = q.image || '';
  el('detail-cat').textContent  = q.category || '';
  el('detail-name').textContent = q.answer || '';
  el('detail-hint').textContent = q.hint ? '💡 ' + q.hint : '';
  const exp = el('detail-explain');
  if (q.explanation) { exp.textContent = q.explanation; exp.classList.remove('empty'); }
  else               { exp.textContent = 'Chưa có mô tả.'; exp.classList.add('empty'); }
  el('detail-modal').classList.add('open');
}

function closeDetail(e) {
  if (e.target === el('detail-modal')) el('detail-modal').classList.remove('open');
}

/* ══════ FLASH CARD MODE ══════ */
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
  const q = queue[flashIdx];

  // Reset về mặt trước (không animate khi đổi thẻ)
  flashFlipped = false;
  const inner = el('flash-card-inner');
  inner.style.transition = 'none';
  inner.classList.remove('flipped');
  // Force reflow rồi bật lại transition
  void inner.offsetWidth;
  inner.style.transition = '';

  // Cập nhật nội dung
  el('flash-badge').textContent    = q.category || 'Flash card';
  el('flash-progress').textContent = (flashIdx + 1) + ' / ' + queue.length;
  el('flash-image').src            = q.image || '';

  // Điền sẵn mặt sau (ẩn sau lưng)
  el('flash-back-cat').textContent  = q.category || '';
  el('flash-back-name').textContent = q.answer   || '';
  el('flash-back-hint').textContent = q.hint     || '';
  el('flash-back-divider').style.display = q.explanation ? '' : 'none';
  const exp = el('flash-back-exp');
  if (q.explanation) { exp.textContent = q.explanation; exp.style.display = ''; }
  else { exp.textContent = ''; exp.style.display = 'none'; }
}

function flipFlash() {
  flashFlipped = !flashFlipped;
  el('flash-card-inner').classList.toggle('flipped', flashFlipped);
}

function nextFlash() {
  flashIdx = (flashIdx + 1) % queue.length;
  renderFlash();
}
function prevFlash() { flashIdx = (flashIdx - 1 + queue.length) % queue.length; renderFlash(); }

/* ══════ LIGHTBOX ══════ */
function openLightbox(src) {
  el('lightbox-img').src = src;
  el('lightbox').classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeLightbox() {
  el('lightbox').classList.remove('open');
  document.body.style.overflow = '';
}

/* ══════ HELPERS ══════ */
const el   = id => document.getElementById(id);
const show = id => { el(id).style.display = ''; };
const hide = id => { el(id).style.display = 'none'; };
function shuffle(arr) { return [...arr].sort(() => Math.random() - 0.5); }
function norm(s) { return s.trim().replace(/\s+/g,' '); }

/* ══════ KEYBOARD ══════ */
document.addEventListener('DOMContentLoaded', () => {
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closeLightbox();
      el('detail-modal').classList.remove('open');
      return;
    }
    if (e.key === 'ArrowRight' && el('flash-screen').style.display !== 'none') { nextFlash(); return; }
    if (e.key === 'ArrowLeft'  && el('flash-screen').style.display !== 'none') { prevFlash(); return; }
    if (e.key === ' '          && el('flash-screen').style.display !== 'none') { e.preventDefault(); flipFlash(); return; }
    if (e.key !== 'Enter') return;
    const nb = el('next-btn');
    if (nb && nb.classList.contains('visible')) nextQuestion();
    else checkAnswer();
  });
  init();
});
