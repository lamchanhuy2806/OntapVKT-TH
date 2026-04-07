/* ══════════════════════════════════
   GALLERY MODE
   Yêu cầu: allQuestions, openLightbox, backToMenu, startMode
   đã được định nghĩa trong main.js
══════════════════════════════════ */

var galleryFilter = '';

/* ── Khởi động ── */
function startGallery() {
  galleryFilter = '';

  ['quiz-screen', 'done-screen', 'browse-screen', 'flash-screen'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  var doneEl = document.getElementById('done-screen');
  if (doneEl) doneEl.classList.remove('visible');
  document.getElementById('home-screen').style.display = 'none';

  var pill = document.getElementById('mode-pill');
  pill.textContent   = 'Kho ảnh';
  pill.className     = 'mode-pill gallery';
  pill.style.display = 'inline-block';

  document.getElementById('progress-wrap').style.display = 'none';
  document.getElementById('back-btn').classList.add('visible');

  document.getElementById('gallery-search').value = '';
  document.getElementById('gallery-screen').style.display = '';

  buildGalleryCats();
  renderGallery();
}

/* ── Filter chips ── */
function buildGalleryCats() {
  var data = (typeof allQuestions !== 'undefined') ? allQuestions : [];
  var cats = Array.from(new Set(data.map(function(q) {
    return q.category;
  }).filter(Boolean))).sort();

  var row = document.getElementById('gallery-cats');
  row.innerHTML = '<button class="bcat-chip active" data-cat="">Tất cả</button>';

  cats.forEach(function(cat) {
    var btn = document.createElement('button');
    btn.className   = 'bcat-chip';
    btn.dataset.cat = cat;
    btn.textContent = cat;
    row.appendChild(btn);
  });

  row.querySelectorAll('.bcat-chip').forEach(function(btn) {
    btn.addEventListener('click', function() {
      galleryFilter = btn.dataset.cat;
      row.querySelectorAll('.bcat-chip').forEach(function(b) {
        b.classList.toggle('active', b.dataset.cat === galleryFilter);
      });
      renderGallery();
    });
  });
}

/* ── Lấy danh sách ảnh của 1 câu hỏi ── */
function getGalleryImages(q) {
  if (q.images && q.images.length) return q.images;
  if (q.image) return [{ src: q.image, caption: '', tips: '' }];
  return [];
}

/* ── Render grid ── */
function renderGallery() {
  var term = (document.getElementById('gallery-search').value || '').trim().toLowerCase();
  var data = (typeof allQuestions !== 'undefined') ? allQuestions : [];

  var filtered = data.filter(function(q) {
    if (galleryFilter && q.category !== galleryFilter) return false;
    if (!term) return true;
    return (q.answer   || '').toLowerCase().includes(term)
        || (q.category || '').toLowerCase().includes(term);
  });

  document.getElementById('gallery-count').textContent = (term || galleryFilter)
    ? filtered.length + ' / ' + data.length + ' loài'
    : data.length + ' loài';

  var grid = document.getElementById('gallery-photo-grid');
  grid.innerHTML = '';

  if (!filtered.length) {
    grid.innerHTML = '<div style="grid-column:1/-1;padding:36px;text-align:center;font-family:var(--mono,monospace);font-size:12px;color:var(--muted,#64748b)">Không tìm thấy kết quả</div>';
    return;
  }

  filtered.forEach(function(q) {
    var images = getGalleryImages(q);

    images.forEach(function(imgData) {
      var item = document.createElement('div');
      item.className = 'gp-item';

      /* Ảnh */
      var img = document.createElement('img');
      img.src     = imgData.src || '';
      img.alt     = q.answer   || '';
      img.loading = 'lazy';
      img.onerror = function() { this.style.opacity = '0.15'; };
      item.appendChild(img);

      /* Chấm vàng nếu có tips */
      if (imgData.tips) {
        var dot = document.createElement('div');
        dot.className = 'gp-tips-dot';
        item.appendChild(dot);
      }

      /* Overlay tên + caption */
      var overlay = document.createElement('div');
      overlay.className = 'gp-overlay';

      var nameEl = document.createElement('div');
      nameEl.className   = 'gp-name';
      nameEl.textContent = q.answer || '';
      overlay.appendChild(nameEl);

      if (imgData.caption) {
        var capEl = document.createElement('div');
        capEl.className   = 'gp-caption';
        capEl.textContent = imgData.caption;
        overlay.appendChild(capEl);
      }

      item.appendChild(overlay);

      /* Click → lightbox + hiện tips */
      item.addEventListener('click', function() {
        openLightboxWithTips(imgData.src, imgData.tips || '');
      });

      grid.appendChild(item);
    });
  });
}

/* ── Mở lightbox kèm tips ── */
function openLightboxWithTips(src, tips) {
  document.getElementById('lightbox-img').src = src;

  var tipsEl = document.getElementById('lightbox-tips');
  if (tipsEl) {
    if (tips) {
      tipsEl.textContent = '💡 ' + tips;
      tipsEl.hidden = false;
    } else {
      tipsEl.hidden = true;
    }
  }

  document.getElementById('lightbox').classList.add('open');
  document.body.style.overflow = 'hidden';
}

/* ── Patch backToMenu: ẩn gallery-screen ── */
(function() {
  var orig = window.backToMenu;
  window.backToMenu = function() {
    var gs = document.getElementById('gallery-screen');
    if (gs) gs.style.display = 'none';
    if (orig) orig();
  };
})();

/* ── Patch startMode: bắt 'gallery' ── */
(function() {
  var orig = window.startMode;
  window.startMode = function(mode) {
    if (mode === 'gallery') {
      startGallery();
      return;
    }
    var gs = document.getElementById('gallery-screen');
    if (gs) gs.style.display = 'none';
    if (orig) orig(mode);
  };
})();