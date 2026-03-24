/* ─── State ─── */
let allQuestions = [];
let queue        = [];
let current      = 0;
let attempts     = 0;
let score        = 0;
let currentMode  = null;

const EXAM_COUNT = 20;
const MAX_WRONG  = 2;

/* ─── Init ─── */
async function init() {
  try {
    const res = await fetch('./assets/data/questions.json');
    if (!res.ok) throw new Error('Không tìm thấy data/questions.json');
    allQuestions = await res.json();
    show('mode-screen');
    hide('loading-msg');
  } catch (e) {
    document.getElementById('loading-msg').textContent = '⚠ ' + e.message;
  }
}

/* ─── Mode ─── */
function startMode(mode) {
  currentMode = mode;
  queue   = mode === 'study' ? [...allQuestions] : shuffle(allQuestions).slice(0, EXAM_COUNT);
  current = 0;
  score   = 0;
  attempts = 0;

  const pill = el('mode-pill');
  pill.textContent = mode === 'study' ? 'Ôn tập' : 'Thi thử';
  pill.className = 'mode-pill ' + mode;
  pill.style.display = 'inline-block';
  el('progress-wrap').style.display = 'flex';

  hide('mode-screen');
  el('done-screen').classList.remove('visible');
  el('done-screen').style.display = 'none';
  show('quiz-screen');
  showQuestion();
}

function backToMenu() {
  hide('quiz-screen');
  el('done-screen').classList.remove('visible');
  el('done-screen').style.display = 'none';
  el('mode-pill').style.display = 'none';
  el('progress-wrap').style.display = 'none';
  show('mode-screen');
}

/* ─── Quiz ─── */
function showQuestion() {
  const q     = queue[current];
  const total = queue.length;
  attempts    = 0;

  el('progress-text').textContent = `${current + 1} / ${total}`;
  el('progress-bar').style.width  = `${(current / total) * 100}%`;

  el('category-badge').textContent = q.category || 'Câu hỏi';
  el('question-text').textContent  = q.question  || 'Đây là ký sinh trùng nào?';
  el('question-image').src         = q.image     || 'images/placeholder.svg';

  el('dot-1').className = 'dot';
  el('dot-2').className = 'dot';

  const hint = el('hint-text');
  hint.textContent = '';
  hint.classList.remove('visible');

  const input = el('answer-input');
  input.value     = '';
  input.className = 'answer-input';
  input.disabled  = false;
  setTimeout(() => input.focus(), 80);

  el('submit-btn').disabled = false;

  const panel = el('feedback-panel');
  panel.className = 'feedback-panel';
  el('correct-answer-line').style.display = 'none';
  el('explanation-text').style.display    = 'none';

  el('next-btn').classList.remove('visible');

  const qs = el('quiz-screen');
  qs.classList.remove('fade-up');
  void qs.offsetWidth;
  qs.classList.add('fade-up');
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

  const dotIdx = Math.min(attempts + 1, 2);
  el(`dot-${dotIdx}`).className = 'dot correct';

  const panel = el('feedback-panel');
  panel.className = 'feedback-panel fp-correct visible';
  el('feedback-icon').textContent  = '✓';
  el('feedback-label').textContent = 'Chính xác!';
  el('correct-answer-line').style.display = 'none';
  el('explanation-text').style.display    = 'none';

  setTimeout(() => el('next-btn').classList.add('visible'), 350);
}

function handleWrong(q) {
  const inp = el('answer-input');

  const dotEl = el(`dot-${Math.min(attempts, 2)}`);
  if (dotEl) dotEl.className = 'dot wrong';

  inp.classList.add('st-wrong', 'shake');
  setTimeout(() => inp.classList.remove('shake', 'st-wrong'), 420);

  if (attempts === 1 && q.hint) {
    const h = el('hint-text');
    h.textContent = '💡 ' + q.hint;
    h.classList.add('visible');
  }

  if (attempts >= MAX_WRONG) {
    inp.disabled = true;
    el('submit-btn').disabled = true;

    const panel = el('feedback-panel');
    panel.className = 'feedback-panel fp-wrong visible';
    el('feedback-icon').textContent  = '✗';
    el('feedback-label').textContent = 'Đáp án đúng là:';

    const al = el('correct-answer-line');
    al.innerHTML = `<strong>${q.answer}</strong>`;
    al.style.display = 'block';

    if (q.explanation) {
      const ex = el('explanation-text');
      ex.textContent  = q.explanation;
      ex.style.display = 'block';
    }

    setTimeout(() => el('next-btn').classList.add('visible'), 350);
  } else {
    inp.value = '';
    inp.focus();
  }
}

function nextQuestion() {
  current++;
  if (current >= queue.length) showDone();
  else showQuestion();
}

/* ─── Done ─── */
function showDone() {
  hide('quiz-screen');
  el('progress-bar').style.width  = '100%';
  el('progress-text').textContent = `${queue.length} / ${queue.length}`;

  const done = el('done-screen');
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

    const pct = Math.round((score / queue.length) * 100);
    el('exam-pct').textContent      = pct + '%';
    el('exam-fraction').textContent = `${score} / ${queue.length} câu đúng`;

    const bar = el('exam-bar');
    bar.className = 'exam-bar ' + (pct >= 80 ? 'good' : pct >= 50 ? 'ok' : 'bad');
    el('exam-pct').style.color = pct >= 80 ? 'var(--green)' : pct >= 50 ? 'var(--amber)' : 'var(--red)';
    setTimeout(() => bar.style.width = pct + '%', 80);

    let msg = '';
    if      (pct === 100) msg = 'Hoàn hảo! Bạn đúng tất cả 20 câu.';
    else if (pct >= 80)   msg = `Rất tốt! Còn <strong>${queue.length - score}</strong> câu cần xem lại.`;
    else if (pct >= 50)   msg = `Đạt yêu cầu. Nên ôn lại <strong>${queue.length - score}</strong> câu sai nhé.`;
    else                  msg = `Cần cố gắng thêm. Vào <em>Ôn tập</em> để xem lại toàn bộ nhé.`;
    el('exam-summary').innerHTML = msg;
  }
}

/* ─── Helpers ─── */
const el   = id => document.getElementById(id);
const show = id => { el(id).style.display = ''; };
const hide = id => { el(id).style.display = 'none'; };

function shuffle(arr) { return [...arr].sort(() => Math.random() - 0.5); }

function norm(s) {
  return s.trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

/* ─── Keyboard ─── */
document.addEventListener('DOMContentLoaded', () => {
  document.addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    const nb = el('next-btn');
    if (nb && nb.classList.contains('visible')) nextQuestion();
    else checkAnswer();
  });
  init();
});
