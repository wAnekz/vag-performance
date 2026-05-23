/* =============================================
   VAG PERFORMANCE — IMAGE UPLOAD MODULE
   image-upload.js  v1.0

   Replaces plain URL <input type="url"> with
   a full drag-and-drop upload block backed by
   Firebase Storage.

   Usage:
     const uploader = createImageUploader({
       containerId: 'my-zone',   // where to render
       fieldId:     'g-url',     // hidden <input> to keep in sync
       label:       'Фото работы',
       compact:     false,       // smaller layout for slider rows
       folder:      'gallery',   // Storage folder
     });

   After mount, `document.getElementById('g-url').value`
   always contains the current download URL — works
   transparently with all existing save handlers.
============================================= */
/* ============================================================
   IMAGE UPLOADER (ImgBB Integration)
   Этот файл полностью заменяет Firebase Storage на API ImgBB.
============================================================ */

const IMGBB_API_KEY = "73e5c798c187024068b6c7a1aa20b83d"; 

/* ============================================
   0. COMPRESSION UTILITY
   Resizes image client-side before upload.
   Max 1920px wide, JPEG quality 0.82.
   Saves bandwidth and Storage quota.
============================================= */
async function compressImage(file, maxWidth = 1920, quality = 0.82) {
  return new Promise((resolve) => {
    // Non-image files pass through untouched
    if (!file.type.startsWith('image/')) { resolve(file); return; }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        // Skip tiny images — no gain
        if (img.width <= maxWidth) { resolve(file); return; }

        const ratio  = maxWidth / img.width;
        const canvas = document.createElement('canvas');
        canvas.width  = maxWidth;
        canvas.height = Math.round(img.height * ratio);

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        canvas.toBlob(
          (blob) => resolve(new File([blob], file.name, { type: 'image/jpeg' })),
          'image/jpeg',
          quality
        );
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}


/* ============================================
   1. TEMPLATE BUILDER
============================================= */
function buildUploadHTML(cfg) {
  const compact = cfg.compact ? 'compact' : '';
  return `
<div class="img-upload-zone ${compact}" id="${cfg.containerId}-zone">

  <!-- Hidden file picker -->
  <input type="file" accept="image/*" id="${cfg.containerId}-file" />

  <!-- Empty placeholder -->
  <div class="img-upload-placeholder">
    <svg class="img-upload-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <rect x="3" y="3" width="18" height="18" rx="2"/>
      <circle cx="8.5" cy="8.5" r="1.5"/>
      <polyline points="21 15 16 10 5 21"/>
      <path d="M12 7v6M9 10l3-3 3 3"/>
    </svg>
    <div class="img-upload-primary">${cfg.label || 'Выберите фото'}</div>
    <div class="img-upload-secondary">
      Перетащите файл сюда или нажмите для выбора
      <div class="img-upload-formats">
        <span class="img-upload-fmt-tag">JPG</span>
        <span class="img-upload-fmt-tag">PNG</span>
        <span class="img-upload-fmt-tag">WEBP</span>
        <span class="img-upload-fmt-tag">до 10 МБ</span>
      </div>
    </div>
  </div>

  <!-- Preview (shown after upload) -->
  <div class="img-upload-preview-wrap">
    <img class="img-upload-preview" id="${cfg.containerId}-preview" src="" alt="preview" />
    <div class="img-upload-overlay">
      <button type="button" class="img-overlay-btn img-overlay-btn-replace" id="${cfg.containerId}-replace">
        ↺ Заменить
      </button>
      <button type="button" class="img-overlay-btn img-overlay-btn-remove" id="${cfg.containerId}-remove">
        ✕ Удалить
      </button>
    </div>
  </div>

  <!-- Upload progress overlay -->
  <div class="img-upload-progress" id="${cfg.containerId}-progress">
    <div class="upload-spinner" id="${cfg.containerId}-spinner"></div>
    <div class="upload-progress-label" id="${cfg.containerId}-prog-label">Сжатие…</div>
    <div class="upload-progress-bar-track">
      <div class="upload-progress-bar-fill" id="${cfg.containerId}-bar"></div>
    </div>
    <div class="upload-progress-pct" id="${cfg.containerId}-pct">0%</div>
  </div>

</div>

<!-- Error message (outside zone so it's always visible) -->
<div class="img-upload-error" id="${cfg.containerId}-err"></div>

<!-- URL fallback -->
<div class="img-upload-url-toggle">
  <button type="button" class="img-url-toggle-btn" id="${cfg.containerId}-url-toggle">
    или вставить ссылку вручную
  </button>
</div>
<div class="img-upload-url-row" id="${cfg.containerId}-url-row">
  <input type="url" id="${cfg.containerId}-url-input" placeholder="https://…" />
  <button type="button" class="img-url-apply-btn" id="${cfg.containerId}-url-apply">
    Применить
  </button>
</div>
`;
}


/* ============================================
   2. MAIN FACTORY FUNCTION
============================================= */
/**
 * createImageUploader(cfg)
 *
 * cfg = {
 *   containerId : string  — id of <div> to inject HTML into
 *   fieldId     : string  — id of <input type="hidden"> (or existing url input)
 *                           whose value stays in sync with the download URL
 *   label       : string  — upload zone title
 *   compact     : bool    — smaller layout (for slider rows)
 *   folder      : string  — Storage folder name  (default: 'uploads')
 *   onUpload    : fn(url) — optional callback after successful upload
 *   onRemove    : fn()    — optional callback after image removed
 * }
 *
 * Returns { getURL, setURL, destroy }
 */
function createImageUploader(cfg) {
  // ── resolve container ──────────────────────────────────────
  const container = document.getElementById(cfg.containerId);
  if (!container) {
    console.warn(`[ImageUploader] Container #${cfg.containerId} not found`);
    return null;
  }

  // ── inject HTML ────────────────────────────────────────────
  container.innerHTML = buildUploadHTML(cfg);

  // ── shortcut DOM refs ──────────────────────────────────────
  const zone      = document.getElementById(`${cfg.containerId}-zone`);
  const fileInput = document.getElementById(`${cfg.containerId}-file`);
  const preview   = document.getElementById(`${cfg.containerId}-preview`);
  const replaceBtn= document.getElementById(`${cfg.containerId}-replace`);
  const removeBtn = document.getElementById(`${cfg.containerId}-remove`);
  const errEl     = document.getElementById(`${cfg.containerId}-err`);
  const spinner   = document.getElementById(`${cfg.containerId}-spinner`);
  const barEl     = document.getElementById(`${cfg.containerId}-bar`);
  const pctEl     = document.getElementById(`${cfg.containerId}-pct`);
  const labelEl   = document.getElementById(`${cfg.containerId}-prog-label`);
  const toggleBtn = document.getElementById(`${cfg.containerId}-url-toggle`);
  const urlRow    = document.getElementById(`${cfg.containerId}-url-row`);
  const urlInput  = document.getElementById(`${cfg.containerId}-url-input`);
  const urlApply  = document.getElementById(`${cfg.containerId}-url-apply`);

  // The hidden field that integrates with existing save handlers
  const field = document.getElementById(cfg.fieldId);

  // ── helpers ────────────────────────────────────────────────
  function showError(msg) {
    errEl.textContent = msg;
    errEl.classList.add('visible');
    setTimeout(() => errEl.classList.remove('visible'), 5000);
  }

  function clearError() {
    errEl.classList.remove('visible');
  }

  function setPreview(url) {
    preview.src = url;
    zone.classList.add('has-image');
    zone.classList.remove('upload-success');
    if (field) field.value = url;
    clearError();
  }

  function clearPreview() {
    preview.src = '';
    zone.classList.remove('has-image', 'upload-success');
    if (field) field.value = '';
    if (cfg.onRemove) cfg.onRemove();
  }

  function setProgress(pct, labelText) {
    barEl.style.width = pct + '%';
    pctEl.textContent = pct + '%';
    if (labelText) labelEl.textContent = labelText;
    // show/hide spinner vs bar
    if (pct === 0) {
      spinner.style.display = 'block';
      barEl.parentElement.style.opacity = '0';
      pctEl.style.opacity = '0';
    } else {
      spinner.style.display = 'none';
      barEl.parentElement.style.opacity = '1';
      pctEl.style.opacity = '1';
    }
  }

  function startUploadState() {
    zone.classList.add('uploading');
    setProgress(0, 'Сжатие…');
    clearError();
    fileInput.disabled = true;
  }

  function endUploadState(success) {
    zone.classList.remove('uploading');
    fileInput.disabled = false;
    if (success) {
      zone.classList.add('upload-success');
      setTimeout(() => zone.classList.remove('upload-success'), 1800);
    }
  }

  // ── core upload function ───────────────────────────────────
  async function uploadFile(file) {
    // Validate type
    if (!file.type.startsWith('image/')) {
      showError('Выберите файл изображения (JPG, PNG, WEBP, GIF).');
      return;
    }
    // Validate size (10 MB)
    if (file.size > 10 * 1024 * 1024) {
      showError('Файл слишком большой. Максимальный размер — 10 МБ.');
      return;
    }

    startUploadState();

    try {
      // Step 1 — compress
      labelEl.textContent = 'Сжатие…';
      const compressed = await compressImage(file);

      // Step 2 — build storage ref
      const storage  = firebase.storage();
      const folder   = cfg.folder || 'uploads';
      const ts       = Date.now();
      const ext      = compressed.name.split('.').pop().toLowerCase() || 'jpg';
      const filename = `${folder}/${ts}_${Math.random().toString(36).slice(2)}.${ext}`;
      const storageRef = storage.ref(filename);

      // Step 3 — upload with progress
      labelEl.textContent = 'Загрузка…';
      const uploadTask = storageRef.put(compressed);

      await new Promise((resolve, reject) => {
        uploadTask.on(
          firebase.storage.TaskEvent.STATE_CHANGED,
          (snapshot) => {
            const pct = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 95);
            setProgress(pct, 'Загрузка…');
          },
          (err) => reject(err),
          () => resolve()
        );
      });

      // Step 4 — get URL
      setProgress(98, 'Получение ссылки…');
      const url = await storageRef.getDownloadURL();
      setProgress(100, 'Готово');

      // Step 5 — apply
      setPreview(url);
      endUploadState(true);

      if (cfg.onUpload) cfg.onUpload(url);

    } catch (err) {
      endUploadState(false);
      console.error('[ImageUploader] upload failed:', err);

      if (err.code === 'storage/unauthorized') {
        showError('Нет прав для загрузки. Проверьте правила Firebase Storage.');
      } else if (err.code === 'storage/canceled') {
        showError('Загрузка отменена.');
      } else {
        showError('Ошибка загрузки: ' + (err.message || err.code || 'неизвестная ошибка'));
      }
    }
  }

  // ── event handlers ─────────────────────────────────────────

  // Click on zone (empty state) → trigger file picker
  zone.addEventListener('click', (e) => {
    // Don't re-trigger if clicking overlay buttons
    if (e.target.closest('.img-upload-overlay')) return;
    if (zone.classList.contains('uploading')) return;
    fileInput.click();
  });

  // File selected via picker
  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (file) uploadFile(file);
    // Reset so same file can be re-selected
    fileInput.value = '';
  });

  // Drag & drop
  zone.addEventListener('dragenter', (e) => { e.preventDefault(); zone.classList.add('drag-over'); });
  zone.addEventListener('dragover',  (e) => { e.preventDefault(); zone.classList.add('drag-over'); });
  zone.addEventListener('dragleave', (e) => {
    if (!zone.contains(e.relatedTarget)) zone.classList.remove('drag-over');
  });
  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    const file = e.dataTransfer?.files[0];
    if (file) uploadFile(file);
  });

  // Replace button
  replaceBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    fileInput.click();
  });

  // Remove button
  removeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    clearPreview();
  });

  // URL toggle
  toggleBtn.addEventListener('click', () => {
    urlRow.classList.toggle('visible');
    if (urlRow.classList.contains('visible')) {
      urlInput.focus();
      toggleBtn.textContent = 'скрыть поле ссылки';
    } else {
      toggleBtn.textContent = 'или вставить ссылку вручную';
    }
  });

  // Apply URL manually
  function applyManualURL() {
    const url = urlInput.value.trim();
    if (!url) { showError('Введите ссылку на изображение.'); return; }
    if (!url.startsWith('http')) { showError('Ссылка должна начинаться с http/https.'); return; }
    setPreview(url);
    urlRow.classList.remove('visible');
    toggleBtn.textContent = 'или вставить ссылку вручную';
    urlInput.value = '';
  }

  urlApply.addEventListener('click', applyManualURL);
  urlInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); applyManualURL(); } });

  // ── Paste image from clipboard ─────────────────────────────
  zone.addEventListener('paste', (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) { uploadFile(file); break; }
      }
    }
  });

  // ── Public API ─────────────────────────────────────────────
  return {
    /** Get current download URL */
    getURL() { return field ? field.value : preview.src; },

    /** Programmatically set URL (e.g. when loading from Firestore) */
    setURL(url) {
      if (!url) { clearPreview(); return; }
      setPreview(url);
    },

    /** Clean up (remove event listeners not needed in this project) */
    destroy() { container.innerHTML = ''; },
  };
}


/* ============================================
   3. CONVENIENCE: init ALL uploaders at once
   Call this after DOM is ready.
============================================= */
function initAllUploaders() {
  const configs = [
    {
      containerId: 'upload-about',
      fieldId:     'c-about-image',
      label:       'Фото блока О нас',
      onUpload(url) { if (typeof updateAboutPreview === 'function') updateAboutPreview(url); }
    },
    {
      containerId: 'upload-slide-1',
      fieldId:     'slide-url-1',
      label:       'Слайд 1',
      compact:     true,
      onUpload(url) { if (typeof updateSlideThumb === 'function') updateSlideThumb(1, url); }
    },
    {
      containerId: 'upload-slide-2',
      fieldId:     'slide-url-2',
      label:       'Слайд 2',
      compact:     true,
      onUpload(url) { if (typeof updateSlideThumb === 'function') updateSlideThumb(2, url); }
    },
    {
      containerId: 'upload-slide-3',
      fieldId:     'slide-url-3',
      label:       'Слайд 3',
      compact:     true,
      onUpload(url) { if (typeof updateSlideThumb === 'function') updateSlideThumb(3, url); }
    },
    {
      containerId: 'upload-gallery',
      fieldId:     'g-url',
      label:       'Фото работы'
    },
    {
      containerId: 'upload-blog',
      fieldId:     'b-image',
      label:       'Обложка статьи'
    }
  ];

  const uploaders = {};
  configs.forEach(cfg => {
    uploaders[cfg.containerId] = createImageUploader(cfg);
  });
  return uploaders;
}

/**
 * Утилита умного сжатия тяжелых изображений на клиенте
 * Сохраняет оригинальные размеры, но вычищает лишний вес
 */
function compressBeforeUpload(file) {
  return new Promise((resolve) => {
    // Если это не картинка или файл меньше 1.5 МБ — не трогаем, качество важнее
    if (!file.type.startsWith('image/') || file.size < 1.5 * 1024 * 1024) {
      resolve(file);
      return;
    }

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        // Оставляем исходное разрешение картинки
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        // Конвертируем в JPEG с очень высоким качеством (92%), убирая лишние метаданные веса
        canvas.toBlob((blob) => {
          // Если сжатый файл вдруг стал весить больше оригинала (бывает с мелкими файлами), возвращаем оригинал
          if (!blob || blob.size > file.size) {
            resolve(file);
          } else {
            // Превращаем blob обратно в объект File
            const compressedFile = new File([blob], file.name, {
              type: 'image/jpeg',
              lastModified: Date.now()
            });
            resolve(compressedFile);
          }
        }, 'image/jpeg', 0.92); 
      };
    };
  });
}

/**
 * Создает интерфейс загрузчика с динамическим превью
 */
function createImageUploader(cfg) {
  const container = document.getElementById(cfg.containerId);
  if (!container) return null;

  container.innerHTML = `
    <div class="img-upload-zone" style="position: relative; overflow: hidden; min-height: ${cfg.compact ? '80px' : '140px'}; display: flex; align-items: center; justify-content: center;">
      <input type="file" accept="image/*" style="position: absolute; inset: 0; opacity: 0; cursor: pointer; z-index: 3;">
      
      <div class="img-preview-layer" style="position: absolute; inset: 0; display: none; z-index: 1;">
        <img src="" style="width: 100%; height: 100%; object-fit: cover;">
        <div class="img-preview-overlay" style="position: absolute; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; opacity: 0; transition: opacity 0.2s ease;">
          <span style="font-size: 0.8rem; color: #fff; background: var(--red, #c0392b); padding: 4px 10px; border-radius: 4px;">Заменить фото</span>
        </div>
        <button class="img-clear-btn" type="button" style="position: absolute; top: 8px; right: 8px; z-index: 5; background: rgba(20,20,22,0.8); border: 1px solid var(--border); color: #fff; width: 24px; height: 24px; border-radius: 4px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold; transition: all 0.15s;">✕</button>
      </div>

      <div class="img-upload-placeholder" style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 15px; text-align: center; z-index: 2; transition: opacity 0.2s;">
        <span class="upload-icon" style="font-size: 1.5rem; margin-bottom: 5px;">📁</span>
        <span class="upload-text" style="font-size: 0.8rem; color: #aaa;">${cfg.label || 'Выберите фото'}</span>
      </div>

      <div class="img-upload-progress" style="width: 0%; height: 3px; position: absolute; bottom: 0; left: 0; background: var(--red, #c0392b); transition: width 0.1s ease; z-index: 4;"></div>
    </div>
  `;

  const zone         = container.querySelector('.img-upload-zone');
  const fileInput    = container.querySelector('input[type="file"]');
  const textEl       = container.querySelector('.upload-text');
  const placeholder  = container.querySelector('.img-upload-placeholder');
  const progressEl   = container.querySelector('.img-upload-progress');
  const previewLayer = container.querySelector('.img-preview-layer');
  const previewImg   = previewLayer.querySelector('img');
  const overlay      = previewLayer.querySelector('.img-preview-overlay');
  const clearBtn     = previewLayer.querySelector('.img-clear-btn');
  const targetInput  = document.getElementById(cfg.fieldId);

  zone.addEventListener('mouseenter', () => { if(previewLayer.style.display === 'block') overlay.style.opacity = '1'; });
  zone.addEventListener('mouseleave', () => { overlay.style.opacity = '0'; });

  clearBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    uploaderInstance.clear();
  });

  clearBtn.addEventListener('mouseenter', () => { clearBtn.style.background = 'var(--red, #c0392b)'; clearBtn.style.borderColor = 'var(--red-hi)'; });
  clearBtn.addEventListener('mouseleave', () => { clearBtn.style.background = 'rgba(20,20,22,0.8)'; clearBtn.style.borderColor = 'var(--border)'; });

  fileInput.addEventListener('dragover', () => zone.classList.add('drag-over'));
  fileInput.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  fileInput.addEventListener('drop', () => zone.classList.remove('drag-over'));

  fileInput.addEventListener('change', async () => {
    if (fileInput.files && fileInput.files.length > 0) {
      textEl.textContent = 'Оптимизация...';
      // Запускаем асинхронную проверку и сжатие веса
      const optimizedFile = await compressBeforeUpload(fileInput.files[0]);
      uploadFileToImgBB(optimizedFile);
    }
  });

  function uploadFileToImgBB(file) {
    if (!IMGBB_API_KEY || IMGBB_API_KEY === "ВАШ_API_КЛЮЧ_ИЗ_IMGBB") {
      if (typeof showToast === 'function') showToast('Критическая ошибка: Не указан API-ключ ImgBB!', 'error');
      return;
    }

    const formData = new FormData();
    formData.append('image', file);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, true);

    xhr.upload.onprogress = function (e) {
      if (e.lengthComputable) {
        const percent = Math.round((e.loaded / e.total) * 100);
        progressEl.style.width = percent + '%';
        textEl.textContent = `Загрузка... ${percent}%`;
      }
    };

    xhr.onload = function () {
      if (xhr.status === 200) {
        try {
          const res = JSON.parse(xhr.responseText);
          if (res.success && res.data && res.data.url) {
            const uploadedUrl = res.data.url;

            if (targetInput) {
              targetInput.value = uploadedUrl;
              targetInput.dispatchEvent(new Event('input'));
            }

            renderPreview(uploadedUrl);

            zone.classList.add('upload-success');
            textEl.textContent = 'Успешно загружено!';
            progressEl.style.width = '100%';
            progressEl.style.background = 'var(--success, #27ae60)';

            if (typeof cfg.onUpload === 'function') cfg.onUpload(uploadedUrl);
            if (typeof showToast === 'function') showToast('Изображение сохранено ✓');
          } else {
            throw new Error('Ошибка API');
          }
        } catch (err) { resetState('Ошибка ответа'); }
      } else { resetState('Ошибка сервера'); }
    };

    xhr.onerror = function () { resetState('Ошибка сети'); };

    textEl.textContent = 'Отправка...';
    progressEl.style.width = '0%';
    progressEl.style.background = 'var(--red, #c0392b)';
    zone.classList.remove('upload-success');
    xhr.send(formData);
  }

  function renderPreview(url) {
    if (url) {
      previewImg.src = url;
      previewLayer.style.display = 'block';
      placeholder.style.opacity = '0';
    } else {
      clearPreview();
    }
  }

  function clearPreview() {
    previewImg.src = '';
    previewLayer.style.display = 'none';
    placeholder.style.opacity = '1';
    textEl.textContent = cfg.label || 'Выберите фото';
  }

  function resetState(msg) {
    textEl.textContent = msg;
    progressEl.style.width = '0%';
    zone.classList.remove('upload-success');
    if (typeof showToast === 'function') showToast(msg, 'error');
  }

  const uploaderInstance = {
    setURL(url) {
      if (targetInput) targetInput.value = url;
      if (url) {
        renderPreview(url);
        zone.classList.add('upload-success');
        progressEl.style.width = '100%';
        progressEl.style.background = 'var(--success, #27ae60)';
      } else {
        this.clear();
      }
    },
    clear() {
      if (targetInput) targetInput.value = '';
      if (targetInput) targetInput.dispatchEvent(new Event('input'));
      clearPreview();
      progressEl.style.width = '0%';
      zone.classList.remove('upload-success');
    }
  };

  return uploaderInstance;
}

function syncUploadersFromFirestore(uploaders, contentData, sliderData) {
  if (!uploaders) return;
  if (contentData && contentData.about_image && uploaders['upload-about']) {
    uploaders['upload-about'].setURL(contentData.about_image);
  }
  if (sliderData) {
    for (let i = 1; i <= 3; i++) {
      if (sliderData[`slide${i}`] && uploaders[`upload-slide-${i}`]) {
        uploaders[`upload-slide-${i}`].setURL(sliderData[`slide${i}`]);
      }
    }
  }
}