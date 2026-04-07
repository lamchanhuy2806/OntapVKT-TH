/* ═══════════════════════════════════════
   STATE
═══════════════════════════════════════ */
let DATA = [];
let state = {
  screen: 'home',
  categoryIndex: null,
  organIndex: null,
  slideIndex: 0,
};

/* ═══════════════════════════════════════
   INIT
═══════════════════════════════════════ */
async function init() {
  const res = await fetch('./assets/data/histology.json');
  DATA = await res.json();

  document.getElementById('btn-home').addEventListener('click', goHome);
  document.getElementById('btn-back').addEventListener('click', goBack);

  // Support Android/browser hardware back button
  window.addEventListener('popstate', () => goBack());

  renderHome();
  updateTopbar();
}

/* ═══════════════════════════════════════
   BACK LOGIC
═══════════════════════════════════════ */
function goBack() {
  if (state.screen === 'viewer') {
    goOrgans(state.categoryIndex);
  } else if (state.screen === 'organs') {
    goHome();
  }
}

/* ═══════════════════════════════════════
   TOPBAR: back button + breadcrumb
═══════════════════════════════════════ */
function updateTopbar() {
  const backBtn = document.getElementById('btn-back');
  const breadcrumb = document.getElementById('breadcrumb');

  // Back button: hidden on home, visible on inner screens
  backBtn.style.display = state.screen === 'home' ? 'none' : 'flex';

  // Breadcrumb
  if (state.screen === 'home') {
    breadcrumb.innerHTML = '';
    return;
  }

  const cat = DATA[state.categoryIndex];
  let html = `<span class="sep">›</span>`;

  if (state.screen === 'organs') {
    html += `<span class="crumb active">${cat.category}</span>`;
  } else {
    const org = cat.organs[state.organIndex];
    html += `<span class="crumb" onclick="goOrgans(${state.categoryIndex})">${cat.category}</span>`;
    html += `<span class="sep">›</span>`;
    html += `<span class="crumb active">${org.organ}</span>`;
  }

  breadcrumb.innerHTML = html;
}

/* ═══════════════════════════════════════
   NAVIGATION
═══════════════════════════════════════ */
function goHome() {
  state = { screen: 'home', categoryIndex: null, organIndex: null, slideIndex: 0 };
  updateTopbar();
  renderHome();
}

function goOrgans(catIdx) {
  state = { screen: 'organs', categoryIndex: catIdx, organIndex: null, slideIndex: 0 };
  updateTopbar();
  renderOrgans();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function goViewer(catIdx, orgIdx, slideIdx = 0) {
  state = { screen: 'viewer', categoryIndex: catIdx, organIndex: orgIdx, slideIndex: slideIdx };
  updateTopbar();
  renderViewer();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ═══════════════════════════════════════
   SCREEN: HOME
═══════════════════════════════════════ */
function renderHome() {
  const app = document.getElementById('app');

  const cards = DATA.map((cat, i) => {
    const totalSlides = cat.organs.reduce((s, o) => s + o.slides.length, 0);
    return `
      <div class="category-card" onclick="goOrgans(${i})">
        <div class="cat-name">${cat.category}</div>
        <div class="cat-meta">${cat.organs.length} cơ quan</div>
        <span class="cat-count">${totalSlides} tiêu bản</span>
      </div>
    `;
  }).join('');

  app.innerHTML = `
    <p class="screen-title">Mô học thực hành</p>
    <p class="screen-subtitle">Chọn nhóm mô để bắt đầu</p>
    <div class="category-grid">${cards}</div>
  `;
}

/* ═══════════════════════════════════════
   SCREEN: ORGANS
═══════════════════════════════════════ */
function renderOrgans() {
  const app = document.getElementById('app');
  const cat = DATA[state.categoryIndex];

  const cards = cat.organs.map((org, i) => `
    <div class="organ-card" onclick="goViewer(${state.categoryIndex}, ${i}, 0)">
      <div class="organ-name">${org.organ}</div>
      <div class="organ-slides-count">${org.slides.length} tiêu bản</div>
    </div>
  `).join('');

  app.innerHTML = `
    <p class="screen-title">${cat.category}</p>
    <p class="screen-subtitle">Chọn cơ quan để xem tiêu bản</p>
    <div class="organ-grid">${cards}</div>
  `;
}

/* ═══════════════════════════════════════
   SCREEN: VIEWER
═══════════════════════════════════════ */
function renderViewer() {
  const app = document.getElementById('app');
  const cat = DATA[state.categoryIndex];
  const org = cat.organs[state.organIndex];
  const slides = org.slides;
  const slide = slides[state.slideIndex];
  const total = slides.length;
  const idx = state.slideIndex;

  const imgContent = slide.image
    ? `<img src="${slide.image}" alt="${slide.structure}" />`
    : `<div class="img-placeholder">
         <span class="icon">🔬</span>
         <p>Chưa có ảnh tiêu bản<br><small>Thêm đường dẫn vào trường "image"</small></p>
       </div>`;

  const magBadge = slide.magnification
    ? `<span class="mag-badge">Vật kính ${slide.magnification}</span>` : '';

  const dots = slides.map((_, i) => `
    <button class="nav-dot ${i === idx ? 'active' : ''}" onclick="jumpSlide(${i})" title="Tiêu bản ${i + 1}"></button>
  `).join('');

  const rows = slide.annotations.map(a => `
    <div class="annot-row">
      <div class="annot-num">${a.number}</div>
      <div class="annot-label">${a.label}</div>
    </div>
  `).join('');

  app.innerHTML = `
    <div class="viewer-layout">

      <div class="viewer-image-panel">
        <div class="viewer-image-wrap">
          ${imgContent}
          ${magBadge}
        </div>
        <div class="viewer-nav">
          <button class="nav-btn" onclick="prevSlide()" ${idx === 0 ? 'disabled' : ''}>← Trước</button>
          <span class="nav-counter">${idx + 1} / ${total}</span>
          <button class="nav-btn" onclick="nextSlide()" ${idx === total - 1 ? 'disabled' : ''}>Tiếp →</button>
        </div>
        ${total > 1 ? `<div class="nav-dots">${dots}</div>` : ''}
      </div>

      <div class="viewer-info-panel">
        <div class="info-card">
          <div class="info-header">
            <div class="info-structure">${slide.structure}</div>
            <div class="info-tags">
              <span class="tag tag-cat">${cat.category}</span>
              <span class="tag tag-organ">${org.organ}</span>
            </div>
          </div>
          <div class="annot-section">
            <div class="annot-title">Chú thích</div>
            <div class="annot-list">${rows}</div>
          </div>
          <div class="explanation">
            <p>${slide.explanation}</p>
          </div>
        </div>
      </div>

    </div>
  `;
}

function prevSlide() {
  if (state.slideIndex > 0) {
    state.slideIndex--;
    renderViewer();
    updateTopbar();
  }
}

function nextSlide() {
  const org = DATA[state.categoryIndex].organs[state.organIndex];
  if (state.slideIndex < org.slides.length - 1) {
    state.slideIndex++;
    renderViewer();
    updateTopbar();
  }
}

function jumpSlide(i) {
  state.slideIndex = i;
  renderViewer();
}

/* ═══════════════════════════════════════
   START
═══════════════════════════════════════ */
init();