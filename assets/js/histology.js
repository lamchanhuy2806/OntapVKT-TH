let activeFilter = 'all';

async function loadData() {
  const res = await fetch('./assets/data/histology.json');
  const data = await res.json();
  return data;
}

function buildFilters(data) {
  const cats = [...new Set(data.map(d => d.category))];
  const bar = document.getElementById('filter-bar');

  bar.querySelector('[data-filter="all"]').addEventListener('click', function () {
    setFilter('all', this);
  });

  cats.forEach(cat => {
    const btn = document.createElement('button');
    btn.className = 'filter-btn';
    btn.dataset.filter = cat;
    btn.textContent = cat;
    btn.addEventListener('click', function () {
      setFilter(cat, this);
    });
    bar.appendChild(btn);
  });
}

function setFilter(val, btn) {
  activeFilter = val;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  applyFilter();
}

function applyFilter() {
  let visible = 0;
  document.querySelectorAll('.slide-card').forEach(card => {
    const show = activeFilter === 'all' || card.dataset.category === activeFilter;
    card.classList.toggle('hidden', !show);
    if (show) visible++;
  });
  const suffix = activeFilter !== 'all' ? ' · ' + activeFilter : '';
  document.getElementById('count-line').textContent = visible + ' tiêu bản' + suffix;
  document.getElementById('empty-state').classList.toggle('show', visible === 0);
}

function renderAll(data) {
  const wrap = document.getElementById('slides-wrap');

  data.forEach(d => {
    const card = document.createElement('div');
    card.className = 'slide-card';
    card.dataset.category = d.category;

    const imgContent = d.image
      ? `<img src="${d.image}" alt="${d.structure}" />`
      : `<div class="img-placeholder">
           <span class="microscope">🔬</span>
           <p>Chưa có ảnh tiêu bản</p>
         </div>`;

    const magBadge = d.magnification
      ? `<span class="mag-badge">Vật kính ${d.magnification}</span>`
      : '';

    const rows = d.annotations.map(a => `
      <div class="annot-row">
        <div class="annot-num">${a.number}</div>
        <div class="annot-label">${a.label}</div>
      </div>
    `).join('');

    card.innerHTML = `
      <div class="slide-tags">
        <span class="tag tag-cat">${d.category}</span>
        <span class="tag tag-organ">Cơ quan: ${d.organ}</span>
        <span class="tag tag-struct">Cấu trúc: ${d.structure}</span>
      </div>
      <div class="image-area">
        ${imgContent}
        ${magBadge}
      </div>
      <div class="annot-section">
        <div class="annot-title">Chú thích</div>
        <div class="annot-list">${rows}</div>
      </div>
      <div class="explanation">
        <p>${d.explanation}</p>
      </div>
    `;

    wrap.appendChild(card);
  });
}

async function init() {
  const data = await loadData();
  buildFilters(data);
  renderAll(data);
  applyFilter();
}

init();
