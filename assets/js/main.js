
let questions = [];
let shuffled = [];
let current = 0;
let attempts = 0;
let score = 0;
const MAX_WRONG = 2;

async function loadQuestions() {
  try {
    const res = await fetch('./assets/data/questions.json');
    if (!res.ok) throw new Error('Không tìm thấy file questions.json');
    questions = await res.json();
    startQuiz();
  } catch (e) {
    document.getElementById('loading-msg').textContent = '⚠ ' + e.message;
  }
}

function shuffle(arr) {
  return [...arr].sort(() => Math.random() - 0.5);
}

function normalize(str) {
  return str.trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

function startQuiz() {
  shuffled = shuffle(questions);
  current = 0;
  score = 0;
  document.getElementById('loading-msg').style.display = 'none';
  document.getElementById('quiz-content').style.display = 'block';
  document.getElementById('done-screen').classList.remove('visible');
  showQuestion();
}

function showQuestion() {
  const q = shuffled[current];
  attempts = 0;

  // Update progress
  const total = shuffled.length;
  document.getElementById('progress-text').textContent = `${current + 1} / ${total}`;
  document.getElementById('progress-bar').style.width = `${((current) / total) * 100}%`;
  document.getElementById('score-badge').textContent = `${score} đúng`;

  // Populate
  document.getElementById('category-badge').textContent = q.category || 'Câu hỏi';
  document.getElementById('question-text').textContent = q.question || 'Đây là ký sinh trùng nào?';
  document.getElementById('question-image').src = q.image || 'images/placeholder.svg';
  document.getElementById('question-image').alt = q.answer;

  // Reset dots
  document.getElementById('dot-1').className = 'dot';
  document.getElementById('dot-2').className = 'dot';

  // Reset hint
  const hintEl = document.getElementById('hint-text');
  hintEl.textContent = '';
  hintEl.classList.remove('visible');

  // Reset input
  const input = document.getElementById('answer-input');
  input.value = '';
  input.className = 'answer-input';
  input.disabled = false;
  input.focus();

  // Reset feedback
  const panel = document.getElementById('feedback-panel');
  panel.className = 'feedback-panel';
  panel.classList.remove('visible');
  document.getElementById('correct-answer-line').style.display = 'none';
  document.getElementById('explanation-text').style.display = 'none';

  // Reset button
  document.getElementById('submit-btn').disabled = false;
  document.getElementById('next-btn').classList.remove('visible');

  // Animate in
  document.getElementById('quiz-content').classList.remove('slide-in');
  void document.getElementById('quiz-content').offsetWidth;
  document.getElementById('quiz-content').classList.add('slide-in');
}

function checkAnswer() {
  const q = shuffled[current];
  const input = document.getElementById('answer-input');
  const userAnswer = input.value;

  if (!userAnswer.trim()) {
    input.focus();
    return;
  }

  const isCorrect = normalize(userAnswer) === normalize(q.answer);

  if (isCorrect) {
    handleCorrect();
  } else {
    attempts++;
    handleWrong(q);
  }
}

function handleCorrect() {
  const input = document.getElementById('answer-input');
  input.classList.add('correct');
  input.disabled = true;
  document.getElementById('submit-btn').disabled = true;
  score++;

  const panel = document.getElementById('feedback-panel');
  panel.className = 'feedback-panel correct-panel';
  document.getElementById('feedback-icon').textContent = '✓';
  document.getElementById('feedback-title').textContent = 'Chính xác!';
  document.getElementById('correct-answer-line').style.display = 'none';
  document.getElementById('explanation-text').style.display = 'none';
  panel.classList.add('visible');

  updateDots(true);

  document.getElementById('score-badge').textContent = `${score} đúng`;

  setTimeout(() => {
    document.getElementById('next-btn').classList.add('visible');
  }, 400);
}

function handleWrong(q) {
  const input = document.getElementById('answer-input');
  input.classList.add('wrong');
  input.classList.add('shake');
  setTimeout(() => {
    input.classList.remove('shake', 'wrong');
  }, 400);

  updateDots(false);

  // Show hint after 1st wrong
  if (attempts === 1 && q.hint) {
    const hintEl = document.getElementById('hint-text');
    hintEl.textContent = '💡 Gợi ý: ' + q.hint;
    hintEl.classList.add('visible');
  }

  // Show answer + explanation after MAX_WRONG
  if (attempts >= MAX_WRONG) {
    input.disabled = true;
    document.getElementById('submit-btn').disabled = true;

    const panel = document.getElementById('feedback-panel');
    panel.className = 'feedback-panel wrong-panel';
    document.getElementById('feedback-icon').textContent = '✗';
    document.getElementById('feedback-title').textContent = `Đáp án đúng`;

    const answerLine = document.getElementById('correct-answer-line');
    answerLine.innerHTML = `→ <strong>${q.answer}</strong>`;
    answerLine.style.display = 'block';

    if (q.explanation) {
      const expEl = document.getElementById('explanation-text');
      expEl.textContent = q.explanation;
      expEl.style.display = 'block';
    }

    panel.classList.add('visible');

    setTimeout(() => {
      document.getElementById('next-btn').classList.add('visible');
    }, 400);
  } else {
    input.value = '';
    input.focus();
  }
}

function updateDots(correct) {
  const dotEl = document.getElementById(`dot-${attempts > 0 ? attempts : 1}`);
  if (dotEl) dotEl.className = 'dot ' + (correct ? 'correct' : 'wrong');
}

function nextQuestion() {
  current++;
  if (current >= shuffled.length) {
    showDone();
  } else {
    showQuestion();
  }
}

function showDone() {
  document.getElementById('quiz-content').style.display = 'none';
  const done = document.getElementById('done-screen');
  done.classList.add('visible');
  document.getElementById('done-score').textContent = `${score}/${shuffled.length}`;

  // Update progress to 100%
  document.getElementById('progress-bar').style.width = '100%';
  document.getElementById('progress-text').textContent = `${shuffled.length} / ${shuffled.length}`;
}

function restartQuiz() {
  document.getElementById('done-screen').classList.remove('visible');
  document.getElementById('quiz-content').style.display = 'block';
  startQuiz();
}

// Enter key submits
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('answer-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const nextBtn = document.getElementById('next-btn');
      if (nextBtn.classList.contains('visible')) {
        nextQuestion();
      } else {
        checkAnswer();
      }
    }
  });
  loadQuestions();
});
