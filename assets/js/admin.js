
let questions    = [];
let editingId    = null;
let currentFilter = '';   // '' = tất cả, else = tên danh mục

// Load existing questions.json on startup
async function loadExisting() {
  try {
    const res = await fetch('data/questions.json');
    if (res.ok) {
      questions = await res.json();
      rebuildFilterChips();
      renderList();
      showToast('Đã load ' + questions.length + ' câu hỏi từ questions.json');
    }
  } catch (e) { /* start fresh */ }
}

function generateId() {
  const nums = questions.map(q => { const m = q.id?.match(/\d+/); return m ? parseInt(m[0]) : 0; });
  return 'q' + (Math.max(0, ...nums) + 1).toString().padStart(3, '0');
}

function saveQuestion() {
  const id          = document.getElementById('f-id').value.trim() || generateId();
  const category    = document.getElementById('f-category').value.trim();
  const question    = document.getElementById('f-question').value.trim();
  const answer      = document.getElementById('f-answer').value.trim();
  const hint        = document.getElementById('f-hint').value.trim();
  const image       = document.getElementById('f-image').value.trim();
  const explanation = document.getElementById('f-explanation').value.trim();

  if (!answer) { alert('Vui lòng nhập đáp án!'); return; }
  if (!image)  { alert('Vui lòng nhập đường dẫn hình ảnh!'); return; }

  const q = { id, category, image, question: question || 'Đây là ký sinh trùng nào?', answer, hint, explanation };

  if (editingId) {
    const idx = questions.findIndex(x => x.id === editingId);
    if (idx >= 0) questions[idx] = q;
    editingId = null;
  } else {
    if (questions.find(x => x.id === id)) q.id = generateId();
    questions.push(q);
  }

  rebuildFilterChips();
  renderList();
  clearForm();
  showToast('Đã lưu: ' + answer);
}

function editQuestion(id) {
  const q = questions.find(x => x.id === id);
  if (!q) return;
  editingId = id;
  document.getElementById('f-id').value          = q.id || '';
  document.getElementById('f-category').value    = q.category || '';
  document.getElementById('f-question').value    = q.question || '';
  document.getElementById('f-answer').value      = q.answer || '';
  document.getElementById('f-hint').value        = q.hint || '';
  document.getElementById('f-image').value       = q.image || '';
  document.getElementById('f-explanation').value = q.explanation || '';
  previewImage(q.image);
  document.getElementById('form-title').textContent = 'Đang sửa: ' + q.answer;
  document.getElementById('clear-btn').style.display = 'inline-block';
  document.getElementById('f-category').focus();
  window.scrollTo(0, 0);
  document.querySelectorAll('.q-item').forEach(el => el.classList.remove('active'));
  document.querySelector(`[data-id="${id}"]`)?.classList.add('active');
}

function deleteQuestion(id, e) {
  e.stopPropagation();
  const q = questions.find(x => x.id === id);
  if (!confirm(`Xóa "${q?.answer}"?`)) return;
  questions = questions.filter(x => x.id !== id);
  if (editingId === id) clearForm();
  rebuildFilterChips();
  renderList();
  showToast('Đã xóa câu hỏi');
}

function clearForm() {
  editingId = null;
  ['f-id','f-category','f-question','f-answer','f-hint','f-image','f-explanation']
    .forEach(id => { document.getElementById(id).value = ''; });
  document.getElementById('image-preview').innerHTML = '<div class="placeholder-text">Nhập đường dẫn ảnh để xem trước</div>';
  document.getElementById('form-title').textContent = 'Thêm câu hỏi mới';
  document.getElementById('clear-btn').style.display = 'none';
  document.querySelectorAll('.q-item').forEach(el => el.classList.remove('active'));
  document.getElementById('f-id').value = generateId();
}

function previewImage(src) {
  const wrap = document.getElementById('image-preview');
  if (!src.trim()) { wrap.innerHTML = '<div class="placeholder-text">Nhập đường dẫn ảnh để xem trước</div>'; return; }
  wrap.innerHTML = `<img src="${src}" onerror="this.parentElement.innerHTML='<div class=placeholder-text>Không tìm thấy ảnh</div>'" alt="preview">`;
}

/* ── Search & filter ── */
function setFilter(btn) {
  currentFilter = btn.dataset.cat;
  document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
  btn.classList.add('active');
  renderList();
}

function rebuildFilterChips() {
  // Collect unique categories
  const cats = [...new Set(questions.map(q => q.category).filter(Boolean))].sort();
  const row = document.getElementById('filter-row');
  // Keep "Tất cả" chip, replace the rest
  row.innerHTML = `<button class="filter-chip${currentFilter === '' ? ' active' : ''}" data-cat="" onclick="setFilter(this)">Tất cả</button>`;
  cats.forEach(cat => {
    const btn = document.createElement('button');
    btn.className = 'filter-chip' + (currentFilter === cat ? ' active' : '');
    btn.dataset.cat = cat;
    btn.textContent = cat;
    btn.onclick = () => setFilter(btn);
    row.appendChild(btn);
  });
}

function highlight(text, term) {
  if (!term) return escHtml(text);
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return escHtml(text).replace(new RegExp(`(${escaped})`, 'gi'), '<mark>$1</mark>');
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function renderList() {
  const list       = document.getElementById('q-list');
  const searchTerm = (document.getElementById('search-input')?.value || '').trim().toLowerCase();

  // Filter by category then search term
  let filtered = questions.filter(q => {
    if (currentFilter && q.category !== currentFilter) return false;
    if (!searchTerm) return true;
    return (q.answer  || '').toLowerCase().includes(searchTerm)
        || (q.category|| '').toLowerCase().includes(searchTerm)
        || (q.question|| '').toLowerCase().includes(searchTerm);
  });

  const total = questions.length;
  const shown = filtered.length;
  document.getElementById('count-badge').textContent =
    searchTerm || currentFilter ? `${shown} / ${total}` : `${total} câu`;
  document.getElementById('export-count').textContent = total;

  if (filtered.length === 0) {
    list.innerHTML = searchTerm
      ? `<li class="no-results">Không tìm thấy "<strong style="color:var(--amber)">${escHtml(searchTerm)}</strong>"</li>`
      : `<li class="no-results">Chưa có câu hỏi nào</li>`;
    return;
  }

  list.innerHTML = filtered.map((q, i) => {
    const globalIdx = questions.indexOf(q) + 1;
    const answerHtml = highlight(q.answer, searchTerm);
    const catHtml    = highlight(q.category || '—', searchTerm);
    return `
    <li class="q-item${editingId === q.id ? ' active' : ''}" data-id="${escHtml(q.id)}" onclick="editQuestion('${escHtml(q.id)}')">
      <span class="q-num">${String(globalIdx).padStart(2,'0')}</span>
      <div class="q-info">
        <div class="q-answer">${answerHtml}</div>
        <div class="q-cat">${catHtml}</div>
      </div>
      <button class="q-del" onclick="deleteQuestion('${escHtml(q.id)}', event)" title="Xóa">✕</button>
    </li>`;
  }).join('');
}

function exportJSON() {
  const json = JSON.stringify(questions, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'questions.json'; a.click();
  URL.revokeObjectURL(url);
  showToast('Đã tải questions.json — copy vào thư mục data/');
}

function toggleJsonPreview() {
  const box = document.getElementById('json-preview');
  if (box.style.display === 'none' || !box.style.display) {
    box.textContent = JSON.stringify(questions, null, 2);
    box.style.display = 'block';
  } else {
    box.style.display = 'none';
  }
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = '✓ ' + msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}

document.addEventListener('DOMContentLoaded', () => {
  loadExisting();
  document.getElementById('f-id').value = generateId();
});
