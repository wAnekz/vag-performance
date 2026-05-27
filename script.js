document.addEventListener('DOMContentLoaded', () => {

  // ==========================================
  // 1. ЛОАДЕР
  // ==========================================
  const loader = document.getElementById('loader');
  setTimeout(() => {
    if (loader) {
      loader.classList.add('hidden');
      document.body.style.overflow = '';
    }
  }, 1000);


  // ==========================================
  // 2. FIREBASE
  // ==========================================
  const firebaseConfig = {
    apiKey: "AIzaSyBajSsmkcdJ1tnwcFXNBDIACgEV0nTKhkI",
    authDomain: "vag-performance-e0e08.firebaseapp.com",
    projectId: "vag-performance-e0e08",
    storageBucket: "vag-performance-e0e08.firebasestorage.app",
    messagingSenderId: "649385240367",
    appId: "1:649385240367:web:08a23f711393360f01e3da",
    measurementId: "G-8PQT9RLEFH"
  };

  firebase.initializeApp(firebaseConfig);
// ==========================================
// МАСКА ТЕЛЕФОНА
// ==========================================
const phoneInput = document.getElementById('bf-phone');
if (phoneInput) {
  phoneInput.addEventListener('keydown', function (e) {
    if (e.key === 'Backspace') {
      e.preventDefault();
      const pos = this.selectionStart;
      const val = this.value;

      // Если есть выделение — удаляем его
      if (this.selectionStart !== this.selectionEnd) {
        const digits = (val.slice(0, this.selectionStart) + val.slice(this.selectionEnd)).replace(/\D/g, '');
        this.value = formatPhone(digits);
        const newPos = formatPhone(val.slice(0, this.selectionStart).replace(/\D/g, '')).length;
        this.setSelectionRange(newPos, newPos);
        return;
      }

      if (pos === 0) return;

      // Ищем предыдущую цифру (пропускаем форматирование)
      let i = pos - 1;
      while (i >= 0 && !/\d/.test(val[i])) i--;
      if (i < 0) { this.value = ''; return; }

      const newVal = val.slice(0, i) + val.slice(i + 1);
      const digits = newVal.replace(/\D/g, '');
      const formatted = formatPhone(digits);
      this.value = formatted;

      // Курсор ставим на то же место минус удалённый символ
      const newPos = Math.min(i, formatted.length);
      this.setSelectionRange(newPos, newPos);
      return;
    }

    const allowed = ['Delete','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Tab','Home','End'];
    if (allowed.includes(e.key)) return;
    if (e.ctrlKey || e.metaKey) return;
    if (!/^\d$/.test(e.key)) e.preventDefault();
  });

  phoneInput.addEventListener('input', function () {
    const cursor = this.selectionStart;
    const prev   = this.value;
    const digits = prev.replace(/\D/g, '').slice(0, 11);
    const formatted = formatPhone(digits);
    this.value = formatted;
    const diff = formatted.length - prev.length;
    this.setSelectionRange(cursor + diff, cursor + diff);
  });
}

function formatPhone(raw) {
  let digits = raw.replace(/\D/g, '');
  if (digits.startsWith('8')) digits = '7' + digits.slice(1);
  if (digits.startsWith('7')) digits = digits.slice(1);
  digits = digits.slice(0, 10);

  if (digits.length === 0) return '';
  let out = '+7';
  if (digits.length > 0) out += ' (' + digits.slice(0, 3);
  if (digits.length >= 3) out += ') ' + digits.slice(3, 6);
  if (digits.length >= 6) out += ' '  + digits.slice(6, 8);
  if (digits.length >= 8) out += ' '  + digits.slice(8, 10);
  return out;
}
  const db = firebase.firestore();

  // Офлайн-кеш включаем ДО первых запросов.
  // После resolve/reject persistence (в любом случае) запускаем загрузку данных —
  // это гарантирует корректную работу с первого визита в любом браузере.
  db.enablePersistence({ synchronizeTabs: true })
    .catch(function(){}) // FAILED_PRECONDITION (несколько вкладок) или инкогнито — ок
    .finally(loadAllFirebaseData);

  // Обертка с таймаутом + 1 повтор: если Firebase завис за 10 сек - пробуем снова
  function fetchWithRetry(fn, retries, ms) {
    retries = retries === undefined ? 1 : retries;
    ms = ms === undefined ? 12000 : ms;
    return new Promise(function(resolve, reject) {
      var done = false;
      var timer = setTimeout(function() {
        if (done) return; done = true;
        if (retries > 0) { fetchWithRetry(fn, retries-1, ms).then(resolve).catch(reject); }
        else { reject(new Error('Firestore timeout')); }
      }, ms);
      fn().then(function(r){ if(done) return; done=true; clearTimeout(timer); resolve(r); })
         .catch(function(e){ if(done) return; done=true; clearTimeout(timer); reject(e); });
    });
  }

  // ==========================================
  // 3. ЗАГРУЗКА КОНТЕНТА ИЗ FIRESTORE
  // ==========================================
  function loadAllFirebaseData() {
  fetchWithRetry(function(){ return db.doc('stats/main').get(); }).then(doc => {
    if (!doc.exists) return;
    const d = doc.data();

    const map = { years: 'years', clients: 'clients', works: 'works', warranty: 'warranty' };
    Object.entries(map).forEach(([key, field]) => {
      const el = document.querySelector(`[data-stat="${key}"]`);
      if (el && d[field] !== undefined) {
        el.setAttribute('data-count', d[field]);
        el.textContent = '0';
      }
    });

    const badgeYears = document.getElementById('cms-badge-years');
    if (badgeYears && d.years !== undefined) badgeYears.textContent = d.years + '+';

  }).catch(err => console.warn('stats/main:', err));


  // --- Контент (content/main): телефон, адрес, часы, тексты, изображение, соцсети, рейтинг ---
  fetchWithRetry(function(){ return db.doc('content/main').get(); }).then(doc => {
    if (!doc.exists) return;
    const d = doc.data();

    if (d.phone) {
      const phoneLink   = document.getElementById('cms-phone-link');
      const phoneText   = document.getElementById('cms-phone-text');
      const footerPhone = document.getElementById('cms-footer-phone');
      if (phoneLink) phoneLink.href = 'tel:' + d.phone.replace(/\s/g, '');
      if (phoneText) phoneText.textContent = d.phone;
      if (footerPhone) { footerPhone.href = 'tel:' + d.phone.replace(/\s/g, ''); footerPhone.textContent = d.phone; }

      // WhatsApp кнопки — подставляем номер
      const waHero = document.getElementById('cms-cta-whatsapp-hero');
      const waCta  = document.getElementById('cms-cta-whatsapp');
      const digits = d.phone.replace(/\D/g, '');
      if (waHero) waHero.href = 'https://wa.me/' + digits;
      if (waCta)  waCta.href  = 'https://wa.me/' + digits;
    }

    if (d.address) {
      const addr       = document.getElementById('cms-address');
      const footerAddr = document.getElementById('cms-footer-address');
      if (addr)       addr.textContent       = d.address;
      if (footerAddr) footerAddr.textContent  = d.address;
    }

    if (d.hours) {
      const hours       = document.getElementById('cms-hours');
      const footerHours = document.getElementById('cms-footer-hours');
      if (hours)       hours.textContent = d.hours;
      if (footerHours) footerHours.innerHTML = d.hours.replace(/\n/g, '<br>');
    }

    if (d.about_text_1) {
      const el = document.getElementById('cms-about-text-1');
      if (el) el.textContent = d.about_text_1;
    }

    if (d.about_text_2) {
      const el = document.getElementById('cms-about-text-2');
      if (el) el.textContent = d.about_text_2;
    }

    if (d.about_image) {
      const el = document.getElementById('cms-about-image');
      if (el) el.src = d.about_image;
    }

    // --- Соцсети ---
    if (d.instagram) {
      const igBtn = document.getElementById('cms-social-instagram');
      if (igBtn) igBtn.href = d.instagram;
    }

    if (d.whatsapp) {
      const waBtn   = document.getElementById('cms-social-whatsapp');
      const waHero  = document.getElementById('cms-cta-whatsapp-hero');
      const waCta   = document.getElementById('cms-cta-whatsapp');
      const waUrl   = 'https://wa.me/' + d.whatsapp.replace(/\D/g, '');
      if (waBtn)  waBtn.href  = waUrl;
      if (waHero) waHero.href = waUrl;
      if (waCta)  waCta.href  = waUrl;
    }

    // --- Рейтинг ---
    if (d.rating_score) {
      const scoreEl = document.getElementById('cms-rating-score');
      if (scoreEl) scoreEl.textContent = d.rating_score;
    }

    if (d.rating_label) {
      const textEl = document.getElementById('cms-rating-text');
      if (textEl) textEl.textContent = d.rating_label;
    }

  }).catch(err => console.warn('content/main:', err));



  // --- Преимущества (whyus) ---
  fetchWithRetry(function(){ return db.collection('whyus').orderBy('order', 'asc').get(); }).then(snap => {
    if (snap.empty) return; // Если в базе пусто, оставляем статичные карточки из HTML

    const grid = document.getElementById('whyus-grid');
    if (!grid) return;

    grid.innerHTML = ''; // Очищаем статику

    // Конвертируем в массив чтобы получить нормальный индекс (Firestore forEach не даёт idx)
    const whyDocs = [];
    snap.forEach(doc => whyDocs.push(doc));

    whyDocs.forEach((doc, idx) => {
      const d = doc.data();

      // Форматируем номер для дизайна (01, 02, 03...) независимо от поля order в БД
      const orderNum = (idx + 1).toString().padStart(2, '0');

      const card = document.createElement('div');
      card.className = 'why-card';
      // Добавляем атрибут для корректной работы IntersectionObserver (анимация при скролле)
      card.setAttribute('data-scroll', ''); 

      // Немного корректируем стили why-icon, чтобы эмодзи из админки смотрелись так же органично, как SVG
      card.innerHTML = `
        <div class="why-num">${orderNum}</div>
        <div class="why-icon" style="font-size: 2.4rem; line-height: 1; display: flex; align-items: center; justify-content: flex-start;">
          ${d.icon || '🏆'}
        </div>
        <h3>${d.title}</h3>
        <p>${d.desc || ''}</p>
      `;
      grid.appendChild(card);
    });

    // Перезапускаем наблюдатель за скроллом, чтобы новые карточки плавно появлялись
    if (typeof refreshScrollObserver === 'function') {
      refreshScrollObserver();
    }

  }).catch(err => console.warn('whyus:', err));


  // --- Слайдер (content/slider) ---
  // Загружаем URL фото слайдера из Firestore; если не заданы — остаётся дефолтный src из HTML
  fetchWithRetry(function(){ return db.doc('content/slider').get(); }).then(doc => {
    if (!doc.exists) return;
    const d = doc.data();

    const slides = [
      document.getElementById('heroImg0'),
      document.getElementById('heroImg1'),
      document.getElementById('heroImg2'),
    ];

    ['slide1', 'slide2', 'slide3'].forEach((key, idx) => {
      if (d[key] && slides[idx]) {
        slides[idx].src = d[key];
      }
    });

  }).catch(err => console.warn('content/slider:', err));


  // --- Отзывы (reviews) ---
  fetchWithRetry(function(){ return db.collection('reviews').orderBy('createdAt', 'desc').get(); }).then(snap => {
    if (snap.empty) return;

    const grid = document.getElementById('reviews-grid');
    if (!grid) return;

    grid.innerHTML = '';

    snap.forEach(doc => {
      const d = doc.data();
      const stars = '★'.repeat(d.rating || 5);
      const avatarColors = [
        'linear-gradient(135deg,#c0392b,#922b21)',
        'linear-gradient(135deg,#2c3e50,#3498db)',
        'linear-gradient(135deg,#c0392b,#8e44ad)',
        'linear-gradient(135deg,#1a6b3c,#27ae60)',
        'linear-gradient(135deg,#d35400,#e67e22)',
      ];
      const colorIdx = (d.name || '').charCodeAt(0) % avatarColors.length;
      const initial  = d.initial || (d.name ? d.name[0].toUpperCase() : '?');

      const card = document.createElement('div');
      card.className = 'review-card';
      card.innerHTML = `
        <div class="rc-stars">${stars}</div>
        <p class="rc-text">"${d.text}"</p>
        <div class="rc-author">
          <div class="rc-avatar" style="background:${avatarColors[colorIdx]}">${initial}</div>
          <div class="rc-info">
            <div class="rc-name">${d.name}</div>
            <div class="rc-date">${d.date || ''}</div>
          </div>
        </div>`;
      grid.appendChild(card);
    });

  }).catch(err => console.warn('reviews:', err));


  // --- Галерея (gallery) ---
  fetchWithRetry(function(){ return db.collection('gallery').orderBy('createdAt', 'desc').get(); }).then(snap => {
    if (snap.empty) return;

    const grid = document.getElementById('gallery-grid');
    if (!grid) return;

    grid.innerHTML = '';

    // Конвертируем в массив для корректного индекса
    const galleryDocs = [];
    snap.forEach(doc => galleryDocs.push(doc));

    galleryDocs.forEach((doc) => {
      const d = doc.data();

      const item = document.createElement('div');
      item.className = 'g-item';
      item.setAttribute('data-scroll', '');
      item.innerHTML = `
        <img src="${d.url}" alt="${d.title}" loading="lazy"/>
        <div class="g-overlay"><span>${d.title}</span></div>`;

      grid.appendChild(item);
    });

    refreshScrollObserver();

  }).catch(err => console.warn('gallery:', err));


  // --- Услуги (services) — если есть данные в Firestore, заменяем статические карточки ---
  fetchWithRetry(function(){ return db.collection('services').orderBy('createdAt', 'asc').get(); }).then(snap => {
    if (snap.empty) return;

    const grid = document.getElementById('services-grid');
    if (!grid) return;

    grid.innerHTML = '';

    const emojiToSvg = {
      '⚡': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>`,
      '🔧': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></svg>`,
      '🔍': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>`,
      '💻': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>`,
      '🚗': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M5 17H3a2 2 0 01-2-2V9a2 2 0 012-2h1.3L6 3h12l1.7 4H21a2 2 0 012 2v6a2 2 0 01-2 2h-2m-7 0H7"/><circle cx="7.5" cy="17.5" r="2.5"/><circle cx="16.5" cy="17.5" r="2.5"/></svg>`,
      '🛞': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>`,
    };

    // Универсальная функция иконки:
    // - если это SVG-строка из админки → рендерим как есть
    // - если эмодзи из map → подставляем SVG
    // - иначе → показываем как текст (эмодзи, буква и т.д.)
    function resolveIcon(raw) {
      if (!raw) return emojiToSvg['🔧'];
      const trimmed = raw.trim();
      if (trimmed.startsWith('<svg') || trimmed.startsWith('<SVG')) return trimmed;
      if (emojiToSvg[trimmed]) return emojiToSvg[trimmed];
      return `<span style="font-size:2rem;line-height:1">${trimmed}</span>`;
    }

    // Конвертируем в массив для нормального индекса
    const serviceDocs = [];
    snap.forEach(doc => serviceDocs.push(doc));

    serviceDocs.forEach((doc) => {
      const d        = doc.data();
      const svgIcon  = resolveIcon(d.icon);
      const card     = document.createElement('div');
      card.className = 'service-card' + (d.hot ? ' featured' : '');
      card.setAttribute('data-scroll', '');
      card.innerHTML = `
        ${d.hot ? '<span class="sc-badge">ХИТ</span>' : ''}
        <div class="sc-glow"></div>
        <div class="sc-icon">${svgIcon}</div>
        <div class="sc-title">${d.title}</div>
        <p class="sc-desc">${d.desc}</p>
        <span class="sc-arrow">→</span>`;
      grid.appendChild(card);
    });

    refreshScrollObserver();

    // Подставляем услуги в селект формы записи
    const serviceSelect = document.getElementById('bf-service');
    if (serviceSelect) {
      serviceSelect.innerHTML = '<option value="" disabled selected>Выберите услугу</option>';
      snap.forEach(doc => {
        const d = doc.data();
        const opt = document.createElement('option');
        opt.value = d.title;
        opt.textContent = d.title;
        serviceSelect.appendChild(opt);
      });
      const other = document.createElement('option');
      other.value = 'Другое';
      other.textContent = 'Другое';
      serviceSelect.appendChild(other);
    }

    // Заполняем список услуг в футере
    const footerList = document.getElementById('footer-services-list');
    if (footerList) {
      footerList.innerHTML = '';
      snap.forEach(doc => {
        const d = doc.data();
        const li = document.createElement('li');
        li.innerHTML = `<a href="#services">${d.title}</a>`;
        footerList.appendChild(li);
      });
    }

  }).catch(err => console.warn('services:', err));

// ==========================================
  // --- Статьи / Блог (blog) с исправленной загрузкой ---
  // ==========================================
  
  // Создаем переменные прямо тут, чтобы Firebase их точно видел
  window.currentSlide = 0;
  window.totalArticles = 0;

  fetchWithRetry(function(){ return db.collection('blog').orderBy('createdAt', 'desc').get(); }).then(snap => {
    const grid = document.getElementById('blog-grid');
    const prevBtn = document.getElementById('blog-prev-btn');
    const nextBtn = document.getElementById('blog-next-btn');
    const emptyEl = document.getElementById('blog-empty');

    if (!grid) return;

    // ГАРАНТИРОВАННО ОЧИЩАЕМ СКЕЛЕТОНЫ СРАЗУ
    grid.innerHTML = '';

    // Если в базе вообще нет статей
    if (snap.empty) {
      if (emptyEl) emptyEl.style.display = 'block';
      if (prevBtn) prevBtn.style.display = 'none';
      if (nextBtn) nextBtn.style.display = 'none';
      return;
    }

    // Если статьи есть — скрываем надпись "пусто"
    if (emptyEl) emptyEl.style.display = 'none';

    snap.forEach(doc => {
      const d = doc.data();

      // Собираем данные статьи для передачи в модал
      const articleData = {
        title:    d.title   || 'Без названия',
        date:     d.date    || '',
        image:    d.image   || '',
        category: d.category || d.cat || '',
        content:  d.content || d.text || d.desc || '',
      };

      const card = document.createElement('div');
      card.className = 'blog-card';
      card.setAttribute('data-scroll', '');
      card.style.cursor = 'pointer';
      card.innerHTML = `
        <div class="blog-img-wrapper" style="overflow:hidden; aspect-ratio:16/9; background:#111; flex-shrink:0;">
          <img src="${d.image}" alt="${d.title}" loading="lazy" style="width:100%; height:100%; object-fit:cover; transition:transform 0.7s ease;" onerror="this.style.opacity='0.2'"/>
        </div>
        <div class="blog-card-body" style="padding: 28px; display:flex; flex-direction:column; flex:1;">
          <div class="blog-meta" style="font-family:var(--font-mono); font-size:0.75rem; color:var(--muted); margin-bottom:8px;">${d.date || ''}</div>
          <div class="blog-title" style="font-family:var(--font-display); font-size:1.3rem; font-weight:600; margin-bottom:12px; color:var(--white);">${d.title}</div>
          <p class="blog-desc" style="font-size:0.88rem; color:#aaa; line-height:1.5; margin-bottom:20px; flex:1;">${d.desc || ''}</p>
          <div class="blog-read-more">
            <span class="brm-text">Читать дальше</span>
            <svg class="brm-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
          </div>
        </div>`;

      // Клик по всей карточке открывает статью
      card.addEventListener('click', () => openArticle(articleData));

      // Эффект зума на картинку при ховере
      const img = card.querySelector('img');
      card.addEventListener('mouseenter', () => { if (img) img.style.transform = 'scale(1.06)'; });
      card.addEventListener('mouseleave', () => { if (img) img.style.transform = 'scale(1)'; });

      grid.appendChild(card);
    });

    // Показываем стрелки управления слайдером
    if (prevBtn) prevBtn.style.display = 'flex';
    if (nextBtn) nextBtn.style.display = 'flex';

    // Запускаем инициализацию слайдера
    window.totalArticles = grid.children.length;
    window.currentSlide = 0;
    
    // Проверяем существование функции слайдера перед вызовом
    if (typeof updateSlider === 'function') {
      initSliderArrows(); 
      setTimeout(updateSlider, 200);
    }

    // Перезапускаем анимацию появления при скролле для новых блоков
    if (typeof refreshScrollObserver === 'function') {
      refreshScrollObserver();
    }

  }).catch(err => {
    console.warn('blog:', err);
    // На случай ошибки тоже убираем бесконечный лоадер
    const grid = document.getElementById('blog-grid');
    if (grid) grid.innerHTML = '<p style="color:red; padding:20px;">Ошибка загрузки новостей</p>';
  });

  } // конец loadAllFirebaseData()

  // ==========================================
  // 4. ФОРМА ЗАЯВКИ → FIRESTORE
  // ==========================================
window.submitBooking = async function() {
  const name    = document.getElementById('bf-name')?.value.trim();
  const phone   = document.getElementById('bf-phone')?.value.trim();
  const car     = document.getElementById('bf-car')?.value.trim();
  const service = document.getElementById('bf-service')?.value;
  const message = document.getElementById('bf-message')?.value.trim();
  const status  = document.getElementById('form-status');
  const btn     = document.getElementById('bf-btn');

  if (!status || !btn) return;

  // Валидация имени
  if (!name || name.length < 2) {
    showError(status, 'Пожалуйста, введите ваше имя (минимум 2 символа).');
    document.getElementById('bf-name').focus();
    return;
  }

  // Валидация телефона — минимум 11 цифр
  const digits = phone.replace(/\D/g, '');
  if (!phone || digits.length < 11) {
    showError(status, 'Введите корректный номер телефона (+7 XXX XXX XX XX).');
    document.getElementById('bf-phone').focus();
    return;
  }

  // Проверяем, что значение не пустое, не undefined и не равно дефолтной заглушке
  if (!service || service === '' || service === 'placeholder') { 
    showError(status, 'Пожалуйста, выберите интересующую услугу из списка.');
    document.getElementById('bf-service').focus();
    return;
  }

  // Антиспам: 2 минуты между заявками
  const COOLDOWN_MS = 120 * 1000;
  const lastSent = Number(localStorage.getItem('bf_last_sent') || 0);
  const elapsed  = Date.now() - lastSent;
  if (elapsed < COOLDOWN_MS) {
    const secsLeft = Math.ceil((COOLDOWN_MS - elapsed) / 1000);
    showError(status, `Подождите ${secsLeft} сек. перед повторной отправкой.`);
    return;
  }

  btn.disabled    = true;
  btn.textContent = 'Отправляем…';
  status.style.display = 'none';

  try {
    // 1. Сохранение данных в базу Firebase
    await db.collection('requests').add({
      name, phone, car: car || '', service: service || '',
      message: message || '', status: 'new',
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    localStorage.setItem('bf_last_sent', Date.now());

    // --- ИНТЕГРАЦИЯ WHATSAPP (ВАРИАНТ 1) ---
    const myWhatsAppNumber = "77079330105"; // Ваш номер в международном формате без +
    const waText = `Здравствуйте! Хочу записаться.
       Имя: ${name}
       Автомобиль: ${car || 'Не указан'}
       Интересующая услуга: ${service || 'Не указана'}${
        message.trim()
          ? `
       Комментарий: ${message}`
          : ''
      }`;

    // Формируем безопасную ссылку и открываем чат в новой вкладке
    const whatsappUrl = `https://wa.me/${myWhatsAppNumber}?text=${encodeURIComponent(waText)}`;

    window.location.href = whatsappUrl;
    // ----------------------------------------

    // 2. Визуальное уведомление об успехе на самом сайте
    status.className    = 'success';
    status.textContent  = '✓ Заявка отправлена! Мы свяжемся с вами в течение 30 минут.';
    status.style.display = 'block';

    // 3. Очистка полей формы
    ['bf-name', 'bf-phone', 'bf-car', 'bf-message'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    const svcSel = document.getElementById('bf-service');
    if (svcSel) svcSel.selectedIndex = 0;

  } catch(e) {
    showError(status, 'Ошибка отправки. Позвоните нам или напишите в WhatsApp.');
  } finally {
    btn.disabled    = false;
    btn.textContent = 'Отправить заявку';
  }
};

function showError(el, msg) {
  el.className     = 'error';
  el.textContent   = msg;
  el.style.display = 'block';
}


  // ==========================================
  // 5. МОБИЛЬНОЕ МЕНЮ (БУРГЕР)
  // ==========================================
  const burger     = document.getElementById('burger');
  const mobileMenu = document.getElementById('mobileMenu');
  const navLinks   = document.querySelectorAll('.mobile-menu a');

  if (burger && mobileMenu) {
    burger.addEventListener('click', () => {
      burger.classList.toggle('active');
      mobileMenu.classList.toggle('open');
      document.body.style.overflow = mobileMenu.classList.contains('open') ? 'hidden' : '';
    });

    navLinks.forEach(link => {
      link.addEventListener('click', () => {
        burger.classList.remove('active');
        mobileMenu.classList.remove('open');
        document.body.style.overflow = '';
      });
    });
  }

  // ==========================================
  // ГАЛЕРЕЯ — ЗАКРЫТИЕ МОДАЛА
  // ==========================================
  const galleryModal      = document.getElementById('galleryModal');
  const galleryModalClose = document.getElementById('galleryModalClose');

  function closeGalleryModal() {
    if (galleryModal) galleryModal.style.display = 'none';
    document.body.style.overflow = '';
  }

  if (galleryModalClose) {
    galleryModalClose.addEventListener('click', closeGalleryModal);
  }
  // Закрытие кликом на фон
  if (galleryModal) {
    galleryModal.addEventListener('click', (e) => {
      if (e.target === galleryModal) closeGalleryModal();
    });
  }
  // Закрытие клавишей Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && galleryModal && galleryModal.style.display === 'flex') {
      closeGalleryModal();
    }
  });


  // ==========================================
  // 6. АНИМАЦИЯ ЦИФР И СКРОЛЛ-REVEAL
  // ==========================================
  const animateCounter = (el) => {
    const target = +el.getAttribute('data-count');
    const count  = +el.innerText;
    const speed  = target / 100;

    if (count < target) {
      el.innerText = Math.ceil(count + speed);
      setTimeout(() => animateCounter(el), 20);
    } else {
      el.innerText = target;
    }
  };

  const observerOptions = { threshold: 0.2 };
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in-view');
        entry.target.querySelectorAll('.stat-num').forEach(num => animateCounter(num));
        observer.unobserve(entry.target);
      }
    });
  }, observerOptions);

  function refreshScrollObserver() {
    document.querySelectorAll('[data-scroll], .service-card').forEach(block => {
      observer.observe(block);
    });
  }

  refreshScrollObserver();


  // ==========================================
  // 7. NAVBAR ПРИ СКРОЛЛЕ
  // ==========================================
  const navbar = document.getElementById('navbar');
  if (navbar) {
    window.addEventListener('scroll', () => {
      navbar.classList.toggle('scrolled', window.scrollY > 50);
    });
  }


  // ==========================================
  // 8. СЛАЙДЕР HERO
  // ==========================================
  const dots   = document.querySelectorAll('.hdot');
  const images = document.querySelectorAll('.hero-img');
  let currentSlide = 0;
  let slideInterval;

  function changeSlide(index) {
    if (!images.length || !dots.length) return;
    images.forEach(img => img.classList.remove('active'));
    dots.forEach(dot => dot.classList.remove('active'));
    images[index].classList.add('active');
    dots[index].classList.add('active');
    currentSlide = index;
  }

  dots.forEach(dot => {
    dot.addEventListener('click', () => {
      changeSlide(parseInt(dot.getAttribute('data-i')));
      restartAutoplay();
    });
  });

  function startAutoplay() {
    slideInterval = setInterval(() => {
      changeSlide((currentSlide + 1) % images.length);
    }, 5000);
  }

  function restartAutoplay() {
    clearInterval(slideInterval);
    startAutoplay();
  }

  if (images.length > 0) startAutoplay();

});

// ==========================================
// ПОЛНОЭКРАННОЕ ОТКРЫТИЕ СТАТЕЙ БЛОГА
// ==========================================
const blogModal = document.getElementById('blog-modal');
const closeModalBtn = document.getElementById('blog-modal-close');

// Функция открытия статьи (вызывайте её при клике на карточку блога)
window.openArticle = function(articleData) {
  if (!blogModal) return;

  // Заполняем данными из вашей базы данных / массива
  document.getElementById('bm-title').textContent = articleData.title || 'Без названия';
  document.getElementById('bm-date').textContent  = articleData.date || 'Дата не указана';
  
  const imgEl = document.getElementById('bm-img');
  if (imgEl && articleData.image) {
    imgEl.src = articleData.image;
    imgEl.alt = articleData.title || '';
    imgEl.style.display = 'block';
  } else if (imgEl) {
    imgEl.style.display = 'none';
  }

  // Заливаем текст (поддерживает HTML разметку, если статьи с тегами)
  // Переносы строк оборачиваем в параграфы для красивой типографики
  let content = articleData.content || articleData.text || '';
  if (content && !content.includes('<p>') && !content.includes('<br')) {
    content = content
      .split(/\n{2,}/)
      .map(p => p.trim())
      .filter(Boolean)
      .map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`)
      .join('');
  }
  document.getElementById('bm-text').innerHTML = content;

  // Сбрасываем скролл модалки в самый верх перед открытием
  blogModal.scrollTop = 0;

  // Активируем полноэкранный режим
  blogModal.classList.add('active');
  
  // Блокируем скролл основного сайта на фоне
  document.body.style.overflow = 'hidden';
};

// Функция закрытия статьи
function closeArticle() {
  if (!blogModal) return;
  blogModal.classList.remove('active');
  
  // Возвращаем скролл сайту
  document.body.style.overflow = '';
}

// Навешиваем событие закрытия на кнопку
if (closeModalBtn) {
  closeModalBtn.addEventListener('click', closeArticle);
}

// "Фишка от себя": закрытие по кнопке Esc на клавиатуре
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && blogModal && blogModal.classList.contains('active')) {
    closeArticle();
  }
});


// ==========================================
// ЛОГИКА СЛАЙДЕРА (КОНЕЦ ФАЙЛА)
// ==========================================
window.currentSlide = 0;
window.totalArticles = 0;

function updateSlider() {
  const grid = document.getElementById('blog-grid');
  const prevBtn = document.getElementById('blog-prev-btn');
  const nextBtn = document.getElementById('blog-next-btn');
  if (!grid || grid.children.length === 0) return;
  
  // 1 на мобилках, 3 на десктопе
  const slidesToShow = window.innerWidth <= 992 ? 1 : 3;
  const maxSlide = Math.max(0, window.totalArticles - slidesToShow);
  
  if (window.currentSlide > maxSlide) window.currentSlide = maxSlide;
  if (window.currentSlide < 0) window.currentSlide = 0;

  const firstCard = grid.children[0];
  if (!firstCard) return;
  
  // Считаем ширину карточки и gap
  const cardWidth = firstCard.getBoundingClientRect().width;
  const gap = 20; 
  
  // Двигаем
  const moveX = window.currentSlide * (cardWidth + gap);
  grid.style.transform = `translateX(-${moveX}px)`;

  // Кнопки блокируются/активируются
  if (prevBtn) prevBtn.disabled = window.currentSlide === 0;
  if (nextBtn) nextBtn.disabled = window.currentSlide >= maxSlide;
}

// Прямое назначение кликов без лишних оберток
function initSliderArrows() {
  const prevBtn = document.getElementById('blog-prev-btn');
  const nextBtn = document.getElementById('blog-next-btn');

  if (prevBtn && !prevBtn.dataset.bound) {
    prevBtn.addEventListener('click', () => { window.currentSlide--; updateSlider(); });
    prevBtn.dataset.bound = "true"; // защита от дублирования кликов
  }
  if (nextBtn && !nextBtn.dataset.bound) {
    nextBtn.addEventListener('click', () => { window.currentSlide++; updateSlider(); });
    nextBtn.dataset.bound = "true";
  }
}

// Следим за экраном
window.addEventListener('resize', updateSlider);

// ==========================================
// ПОДДЕРЖКА СВАЙПОВ НА МОБИЛКАХ
// ==========================================
const track = document.querySelector('.blog-slider-track');

if (track) {
  let touchStartX = 0;
  let touchEndX = 0;

  // Фиксируем, где палец коснулся экрана
  track.addEventListener('touchstart', (e) => {
    touchStartX = e.changedTouches[0].screenX;
  }, { passive: true });

  // Фиксируем, где палец оторвался от экрана
  track.addEventListener('touchend', (e) => {
    touchEndX = e.changedTouches[0].screenX;
    handleSwipe();
  }, { passive: true });

  // Логика определения свайпа
  function handleSwipe() {
    const swipeThreshold = 50; // Минимальная дистанция для свайпа в пикселях
    
    // Свайп влево (листаем вперед)
    if (touchStartX - touchEndX > swipeThreshold) {
      window.currentSlide++;
      updateSlider();
    }
    
    // Свайп вправо (листаем назад)
    if (touchEndX - touchStartX > swipeThreshold) {
      window.currentSlide--;
      updateSlider();
    }
  }
}