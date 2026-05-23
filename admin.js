let adminUploaders = {};

document.addEventListener('DOMContentLoaded', () => {
  // Инициализируем зоны загрузки картинок
  if (typeof initAllUploaders === 'function') {
    adminUploaders = initAllUploaders();
    console.log('Зоны загрузки успешно созданы!', adminUploaders);
  } else {
    console.error('Критическая ошибка: функция initAllUploaders не найдена!');
  }
});



/* ==============================
   FIREBASE INIT
============================== */
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
const auth = firebase.auth();
const db   = firebase.firestore();

let currentUserEmail = '';


/* ==============================
   TOAST
============================== */
let toastTimer;
function showToast(msg, type = 'success') {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.className = type;
  el.style.display = 'block';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.style.display = 'none'; }, 3200);
}


/* ==============================
   CHANGELOG HELPER
============================== */
async function logAction(action, details = '') {
  try {
    await db.collection('changelog').add({
      action,
      details,
      user: currentUserEmail,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  } catch(e) { /* silent */ }
}


/* ==============================
   AUTH STATE
============================== */
const loginScreen = document.getElementById('login-screen');
const appEl       = document.getElementById('app');
const splash      = document.getElementById('splash');

function hideSplash() {
  if (splash) {
    splash.classList.add('hide');
    setTimeout(() => { splash.style.display = 'none'; }, 380);
  }
}

auth.onAuthStateChanged(user => {
  if (user) {
    currentUserEmail = user.email;
    if (loginScreen) loginScreen.style.display = 'none';
    if (appEl) appEl.style.display = 'flex';
    const emailDisplay = document.getElementById('user-email-display');
    if (emailDisplay) emailDisplay.textContent = user.email;
    initDashboard();
    hideSplash();
  } else {
    if (loginScreen) loginScreen.style.display = 'flex';
    if (appEl) appEl.style.display = 'none';
    hideSplash();
  }
});


/* ==============================
   LOGIN
============================== */
document.getElementById('btn-login')?.addEventListener('click', async () => {
  const email  = document.getElementById('auth-email').value.trim();
  const pass   = document.getElementById('auth-pass').value;
  const errEl  = document.getElementById('login-error');
  const btnTxt = document.getElementById('login-btn-text');

  if (errEl) errEl.style.display = 'none';
  if (!email || !pass) {
    if (errEl) {
      errEl.textContent = 'Заполните email и пароль.';
      errEl.style.display = 'block';
    }
    return;
  }
  if (btnTxt) btnTxt.textContent = 'Выполняется вход…';
  try {
    await auth.signInWithEmailAndPassword(email, pass);
  } catch (e) {
    if (errEl) {
      errEl.textContent = getAuthError(e.code);
      errEl.style.display = 'block';
    }
  } finally {
    if (btnTxt) btnTxt.textContent = 'Войти в панель';
  }
});

document.getElementById('auth-pass')?.addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('btn-login').click();
});

document.getElementById('btn-logout')?.addEventListener('click', () => auth.signOut());

function getAuthError(code) {
  const map = {
    'auth/user-not-found':    'Пользователь не найден.',
    'auth/wrong-password':    'Неверный пароль.',
    'auth/invalid-email':     'Некорректный email.',
    'auth/too-many-requests': 'Слишком много попыток. Попробуйте позже.',
    'auth/invalid-credential':'Неверный email или пароль.',
  };
  return map[code] || `Ошибка: ${code}`;
}


/* ==============================
   TABS
============================== */
const navItems  = document.querySelectorAll('.nav-item');
const tabPanels = document.querySelectorAll('.tab-panel');

navItems.forEach(item => {
  item.addEventListener('click', () => {
    const target = item.dataset.tab;
    navItems.forEach(n => n.classList.remove('active'));
    tabPanels.forEach(p => p.classList.remove('active'));
    item.classList.add('active');
    document.getElementById(`tab-${target}`).classList.add('active');
    if (target === 'whyus') loadWhyUs();
  });
});


/* ==============================
   DASHBOARD INIT
============================== */
function initDashboard() {
  loadRequests();
  loadReviews();
  loadGallery();
  loadServices();
  loadBlog(); 
  loadStats();
  loadContent();
  loadSlider();
  loadWhyUs();
  loadHistory();
}


/* ==========================================
   1. ЗАЯВКИ (REQUESTS)
========================================== */
let requestsFilter = 'all';
let allRequests = [];

function loadRequests() {
  const list  = document.getElementById('requests-list');
  const badge = document.getElementById('badge-requests');

  if (!list) return;

  db.collection('requests').orderBy('createdAt', 'desc').onSnapshot(snap => {
    allRequests = [];
    snap.forEach(doc => allRequests.push({ id: doc.id, ...doc.data() }));

    if (badge) {
      const newCount = allRequests.filter(r => r.status === 'new' || !r.status).length;
      badge.textContent = newCount > 0 ? newCount : '';
      badge.classList.toggle('visible', newCount > 0);
    }

    renderRequests(list);
  }, err => showToast('Ошибка загрузки заявок: ' + err.message, 'error'));
}

function renderRequests(list) {
  const filtered = requestsFilter === 'all'
    ? allRequests
    : allRequests.filter(r => {
        const s = r.status || 'new';
        return s === requestsFilter;
      });

  if (filtered.length === 0) {
    list.innerHTML = '<div class="empty-state"><div class="empty-icon">📋</div><div>Заявок нет</div></div>';
    return;
  }
  list.innerHTML = '';
  filtered.forEach(r => list.appendChild(createRequestRow(r.id, r)));
}

function createRequestRow(id, d) {
  const status = d.status || 'new';
  const statusLabels = { new: 'Новая', inwork: 'В работе', closed: 'Закрыта' };
  const dateStr = d.createdAt ? new Date(d.createdAt.seconds * 1000).toLocaleString('ru-RU', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' }) : '';

  const waText = encodeURIComponent(
    `Здравствуйте, ${d.name}! Это VAG Performance, вы оставили заявку на ${d.service || 'сервис'}. Готовы вас записать, удобно сейчас говорить?`
  );
  const waPhone = d.phone ? d.phone.replace(/\D/g, '') : ''; 
  const waLink  = `https://wa.me/${waPhone}?text=${waText}`;

  const el = document.createElement('div');
  el.className = `request-row status-${status}`;
  el.innerHTML = `
    <div class="req-body">
      <div class="req-name">${esc(d.name)}</div>
      <div class="req-phone">${esc(d.phone)}</div>
      <div class="req-message">${esc(d.message || '—')}</div>
      <div class="req-date">${dateStr}</div>
      <span class="status-badge ${status}">${statusLabels[status] || status}</span>
    </div>
    <div class="req-actions">
      <a href="${waLink}" target="_blank" class="btn-wa">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
        Написать
      </a>
      <select class="req-status-select" data-id="${id}">
        <option value="new"    ${status==='new'    ? 'selected':''}>🔴 Новая</option>
        <option value="inwork" ${status==='inwork' ? 'selected':''}>🟡 В работе</option>
        <option value="closed" ${status==='closed' ? 'selected':''}>🟢 Закрыта</option>
      </select>
      <button class="btn btn-danger" data-id="${id}" style="font-size:0.72rem; padding:4px 10px;">✕</button>
    </div>`;

  el.querySelector('.req-status-select').addEventListener('change', async function() {
    try {
      await db.collection('requests').doc(id).update({ status: this.value });
      await logAction('Статус заявки изменён', `${d.name} → ${this.value}`);
      showToast('Статус обновлён ✓');
    } catch(e) { showToast('Ошибка: ' + e.message, 'error'); }
  });

  el.querySelector('.btn-danger').addEventListener('click', () => deleteDoc('requests', id, 'Заявка удалена', d.name));
  return el;
}

document.querySelectorAll('.filter-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    requestsFilter = tab.dataset.filter;
    renderRequests(document.getElementById('requests-list'));
  });
});


/* ==============================
   2. ЗВЁЗДЫ (общий компонент)
============================== */
let selectedRating = 5;

document.querySelectorAll('.star-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    selectedRating = parseInt(btn.dataset.v);
    updateStars();
  });
  btn.addEventListener('mouseover', () => {
    const hv = parseInt(btn.dataset.v);
    document.querySelectorAll('.star-btn').forEach(b => b.classList.toggle('active', parseInt(b.dataset.v) <= hv));
  });
});
document.getElementById('star-row')?.addEventListener('mouseleave', updateStars);

function updateStars() {
  document.querySelectorAll('.star-btn').forEach(b => b.classList.toggle('active', parseInt(b.dataset.v) <= selectedRating));
}
updateStars();


/* ==============================
   3. ОТЗЫВЫ (REVIEWS)
============================== */
function loadReviews() {
  const list = document.getElementById('reviews-list');
  if (!list) return;
  db.collection('reviews').orderBy('createdAt', 'desc').onSnapshot(snap => {
    if (snap.empty) { list.innerHTML = '<div class="empty-state"><div class="empty-icon">💬</div><div>Отзывов пока нет</div></div>'; return; }
    list.innerHTML = '';
    snap.forEach(doc => list.appendChild(createReviewRow(doc.id, doc.data())));
  }, err => showToast('Ошибка загрузки отзывов: ' + err.message, 'error'));
}

function createReviewRow(id, d) {
  const stars = '★'.repeat(d.rating || 5) + '☆'.repeat(5 - (d.rating || 5));
  const el = document.createElement('div');
  el.className = 'item-row';
  el.innerHTML = `
    <div class="item-avatar">${d.initial || (d.name ? d.name[0] : '?')}</div>
    <div class="item-body">
      <div class="item-name">${esc(d.name)}</div>
      <div class="item-stars">${stars}</div>
      <div class="item-meta">${esc(d.date || '')}</div>
      <div class="item-text">${esc(d.text)}</div>
    </div>
    <div class="item-actions">
      <button class="btn btn-outline edit-btn">✏️</button>
      <button class="btn btn-danger del-btn">✕</button>
    </div>`;
  el.querySelector('.edit-btn').addEventListener('click', () => editReview(id, d));
  el.querySelector('.del-btn').addEventListener('click', () => deleteDoc('reviews', id, 'Отзыв удалён', d.name));
  return el;
}

function editReview(id, d) {
  document.getElementById('r-edit-id').value  = id;
  document.getElementById('r-name').value     = d.name    || '';
  document.getElementById('r-initial').value  = d.initial || '';
  document.getElementById('r-date').value     = d.date    || '';
  document.getElementById('r-text').value     = d.text    || '';
  selectedRating = d.rating || 5;
  updateStars();
  document.getElementById('review-form-title').textContent = 'Редактировать отзыв';
  document.getElementById('btn-cancel-review').style.display = 'inline-flex';
  document.getElementById('btn-add-review').textContent = '💾 Сохранить изменения';
  document.querySelector('#tab-reviews .card').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function resetReviewForm() {
  document.getElementById('r-edit-id').value = '';
  ['r-name','r-initial','r-date','r-text'].forEach(clearField);
  selectedRating = 5; updateStars();
  document.getElementById('review-form-title').textContent = 'Добавить отзыв';
  document.getElementById('btn-cancel-review').style.display = 'none';
  document.getElementById('btn-add-review').textContent = '＋ Добавить отзыв';
}

document.getElementById('btn-cancel-review')?.addEventListener('click', resetReviewForm);

document.getElementById('btn-add-review')?.addEventListener('click', async () => {
  const name    = v('r-name');
  const initial = v('r-initial') || (name[0] || '?');
  const date    = v('r-date');
  const text    = v('r-text');
  const editId  = document.getElementById('r-edit-id').value;
  if (!name || !text) { showToast('Заполните имя и текст отзыва', 'error'); return; }
  const data = { name, initial, date, text, rating: selectedRating, updatedAt: firebase.firestore.FieldValue.serverTimestamp() };
  try {
    if (editId) {
      await db.collection('reviews').doc(editId).update(data);
      await logAction('Отзыв обновлён', name);
      showToast('Отзыв обновлён ✓');
    } else {
      data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      await db.collection('reviews').add(data);
      await logAction('Отзыв добавлен', name);
      showToast('Отзыв добавлен ✓');
    }
    resetReviewForm();
  } catch(e) { showToast('Ошибка: ' + e.message, 'error'); }
});


/* ==========================================
   4. ГАЛЕРЕЯ (GALLERY)
========================================== */
function loadGallery() {
  const list = document.getElementById('gallery-list');
  if (!list) return;
  db.collection('gallery').orderBy('createdAt', 'desc').onSnapshot(snap => {
    if (snap.empty) { list.innerHTML = '<div class="empty-state"><div class="empty-icon">🔧</div><div>Галерея пуста</div></div>'; return; }
    list.innerHTML = '';
    snap.forEach(doc => list.appendChild(createGalleryRow(doc.id, doc.data())));
  }, err => showToast('Ошибка загрузки галереи: ' + err.message, 'error'));
}

function createGalleryRow(id, d) {
  const el = document.createElement('div');
  el.className = 'item-row';
  el.innerHTML = `
    <img class="item-thumb" src="${esc(d.url)}" alt="" loading="lazy" onerror="this.style.background='#2a2a2e';this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 1 1%22/>'"/>
    <div class="item-body">
      <div class="item-name">${esc(d.title)}</div>
      <div class="item-text">${esc(d.desc || '')}</div>
    </div>
    <div class="item-actions">
      <button class="btn btn-outline edit-btn">✏️</button>
      <button class="btn btn-danger del-btn">✕</button>
    </div>`;
  el.querySelector('.edit-btn').addEventListener('click', () => editGallery(id, d));
  el.querySelector('.del-btn').addEventListener('click', () => deleteDoc('gallery', id, 'Работа удалена из галереи', d.title));
  return el;
}

function editGallery(id, d) {
  document.getElementById('g-edit-id').value = id;
  document.getElementById('g-title').value   = d.title || '';
  document.getElementById('g-url').value     = d.url   || '';
  document.getElementById('g-desc').value    = d.desc  || '';
  document.getElementById('gallery-form-title').textContent = 'Редактировать работу';
  document.getElementById('btn-cancel-gallery').style.display = 'inline-flex';
  document.getElementById('btn-add-gallery').textContent = '💾 Сохранить изменения';
  document.querySelector('#tab-gallery .card').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function resetGalleryForm() {
  document.getElementById('g-edit-id').value = '';
  ['g-title','g-url','g-desc'].forEach(clearField);
  document.getElementById('gallery-form-title').textContent = 'Добавить работу';
  document.getElementById('btn-cancel-gallery').style.display = 'none';
  document.getElementById('btn-add-gallery').textContent = '＋ Добавить в галерею';
}

document.getElementById('btn-cancel-gallery')?.addEventListener('click', resetGalleryForm);

document.getElementById('btn-add-gallery')?.addEventListener('click', async () => {
  const title  = v('g-title');
  const url    = v('g-url');
  const desc   = v('g-desc');
  const editId = document.getElementById('g-edit-id').value;
  if (!title || !url) { showToast('Заполните заголовок и URL', 'error'); return; }
  const data = { title, url, desc, updatedAt: firebase.firestore.FieldValue.serverTimestamp() };
  try {
    if (editId) {
      await db.collection('gallery').doc(editId).update(data);
      await logAction('Работа в галерее обновлена', title);
      showToast('Работа обновлена ✓');
    } else {
      data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      await db.collection('gallery').add(data);
      await logAction('Работа добавлена в галерею', title);
      showToast('Работа добавлена в галерею ✓');
    }
    resetGalleryForm();
  } catch(e) { showToast('Ошибка: ' + e.message, 'error'); }
});


/* ==========================================
   SERVICES EMOJI PICKER
========================================== */
document.querySelectorAll('#sv-emoji-picker .emoji-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.getElementById('sv-icon').value = btn.dataset.svc;
    document.querySelectorAll('#sv-emoji-picker .emoji-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
  });
});

document.getElementById('sv-icon')?.addEventListener('input', function() {
  const val = this.value.trim();
  document.querySelectorAll('#sv-emoji-picker .emoji-btn').forEach(b => {
    b.classList.toggle('selected', b.dataset.svc === val);
  });
});


/* ==========================================
   5. УСЛУГИ (SERVICES)
========================================== */
let servicesEditMode = false;

function loadServices() {
  const list = document.getElementById('services-list');
  if (!list) return;
  db.collection('services').orderBy('createdAt', 'asc').onSnapshot(snap => {
    if (snap.empty) { list.innerHTML = '<div class="empty-state"><div class="empty-icon">⚙️</div><div>Услуги не добавлены</div></div>'; return; }
    list.innerHTML = '';
    snap.forEach(doc => list.appendChild(createServiceRow(doc.id, doc.data())));
  }, err => showToast('Ошибка загрузки услуг: ' + err.message, 'error'));
}

function createServiceRow(id, d) {
  const el = document.createElement('div');
  el.className = 'service-row';
  el.innerHTML = `
    <div class="svc-icon-preview">${d.icon || '⚙️'}</div>
    <div class="svc-body">
      <div class="svc-name">${esc(d.title)}</div>
      <div class="svc-desc">${esc(d.desc || '')}</div>
      ${d.hot ? '<div class="svc-hot">ХИТ</div>' : ''}
    </div>
    <div class="item-actions">
      <button class="btn btn-outline" data-id="${id}">✏️</button>
      <button class="btn btn-danger" data-id="${id}">✕</button>
    </div>`;
  el.querySelector('.btn-outline').addEventListener('click', () => editService(id, d));
  el.querySelector('.btn-danger').addEventListener('click', () => deleteDoc('services', id, 'Услуга удалена', d.title));
  return el;
}

function editService(id, d) {
  document.getElementById('sv-edit-id').value  = id;
  document.getElementById('sv-title').value    = d.title || '';
  document.getElementById('sv-desc').value     = d.desc  || '';
  document.getElementById('sv-icon').value     = d.icon  || '';
  document.getElementById('sv-hot').value      = d.hot ? '1' : '0';
  document.querySelectorAll('#sv-emoji-picker .emoji-btn').forEach(b => {
    b.classList.toggle('selected', b.dataset.svc === d.icon);
  });
  document.getElementById('service-form-title').textContent = 'Редактировать услугу';
  document.getElementById('btn-cancel-service').style.display = 'inline-flex';
  document.getElementById('btn-add-service').textContent = '💾 Сохранить изменения';
  servicesEditMode = true;
  document.querySelector('#tab-services .card').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function resetServiceForm() {
  document.getElementById('sv-edit-id').value = '';
  ['sv-title', 'sv-desc', 'sv-icon'].forEach(clearField);
  document.getElementById('sv-hot').value = '0';
  document.querySelectorAll('#sv-emoji-picker .emoji-btn').forEach(b => b.classList.remove('selected'));
  document.getElementById('service-form-title').textContent = 'Добавить услугу';
  document.getElementById('btn-cancel-service').style.display = 'none';
  document.getElementById('btn-add-service').textContent = '＋ Добавить услугу';
  servicesEditMode = false;
}

document.getElementById('btn-cancel-service')?.addEventListener('click', resetServiceForm);

document.getElementById('btn-add-service')?.addEventListener('click', async () => {
  const title  = v('sv-title');
  const desc   = v('sv-desc');
  const icon   = v('sv-icon') || '⚙️';
  const hot    = document.getElementById('sv-hot').value === '1';
  const editId = document.getElementById('sv-edit-id').value;

  if (!title) { showToast('Введите название услуги', 'error'); return; }

  const data = { title, desc, icon, hot, updatedAt: firebase.firestore.FieldValue.serverTimestamp() };

  try {
    if (editId) {
      await db.collection('services').doc(editId).update(data);
      await logAction('Услуга обновлена', title);
      showToast('Услуга обновлена ✓');
    } else {
      data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      await db.collection('services').add(data);
      await logAction('Услуга добавлена', title);
      showToast('Услуга добавлена ✓');
    }
    resetServiceForm();
  } catch(e) { showToast('Ошибка: ' + e.message, 'error'); }
});


/* ==========================================
   5.5. СТАТЬИ / БЛОГ (BLOG)
========================================== */
function loadBlog() {
  const list = document.getElementById('blog-list');
  if (!list) return;
  db.collection('blog').orderBy('createdAt', 'desc').onSnapshot(snap => {
    if (snap.empty) {
      list.innerHTML = '<div class="empty-state"><div class="empty-icon">📰</div><div>Список статей пуст</div></div>';
      return;
    }
    list.innerHTML = '';
    snap.forEach(doc => list.appendChild(createBlogRow(doc.id, doc.data())));
  }, err => showToast('Ошибка загрузки блога: ' + err.message, 'error'));
}

function createBlogRow(id, d) {
  const el = document.createElement('div');
  el.className = 'item-row';
  el.innerHTML = `
    <img class="item-thumb" src="${esc(d.image)}" alt="" loading="lazy" onerror="this.style.background='#2a2a2e';this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 1 1%22/>'"/>
    <div class="item-body">
      <div class="item-name">${esc(d.title)}</div>
      <div class="item-meta">${esc(d.date || '')}</div>
      <div class="item-text">${esc(d.desc || '')}</div>
    </div>
    <div class="item-actions">
      <button class="btn btn-outline edit-btn">✏️</button>
      <button class="btn btn-danger del-btn">✕</button>
    </div>`;
  el.querySelector('.edit-btn').addEventListener('click', () => editBlog(id, d));
  el.querySelector('.del-btn').addEventListener('click', () => deleteDoc('blog', id, 'Статья удалена', d.title));
  return el;
}

function editBlog(id, d) {
  document.getElementById('b-edit-id').value = id;
  document.getElementById('b-title').value   = d.title || '';
  document.getElementById('b-desc').value    = d.desc  || '';
  document.getElementById('b-image').value   = d.image || '';
  document.getElementById('b-date').value    = d.date  || '';
  document.getElementById('blog-form-title').textContent = 'Редактировать статью';
  document.getElementById('btn-cancel-article').style.display = 'inline-flex';
  document.getElementById('btn-add-article').textContent = '💾 Сохранить изменения';
  document.querySelector('#tab-blog .card').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function resetBlogForm() {
  document.getElementById('b-edit-id').value = '';
  ['b-title','b-desc','b-image','b-date'].forEach(clearField);
  document.getElementById('blog-form-title').textContent = 'Добавить новую статью';
  document.getElementById('btn-cancel-article').style.display = 'none';
  document.getElementById('btn-add-article').textContent = '💾 Опубликовать статью';
}

document.getElementById('btn-cancel-article')?.addEventListener('click', resetBlogForm);

document.getElementById('btn-add-article')?.addEventListener('click', async () => {
  const title  = v('b-title');
  const desc   = v('b-desc');
  const image  = v('b-image');
  const date   = v('b-date') || new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
  const editId = document.getElementById('b-edit-id').value;
  if (!title || !desc) { showToast('Заполните заголовок и описание статьи', 'error'); return; }
  const data = { title, desc, image, date, updatedAt: firebase.firestore.FieldValue.serverTimestamp() };
  try {
    if (editId) {
      await db.collection('blog').doc(editId).update(data);
      await logAction('Статья обновлена', title);
      showToast('Статья обновлена ✓');
    } else {
      data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      await db.collection('blog').add(data);
      await logAction('Статья добавлена', title);
      showToast('Статья успешно опубликована ✓');
    }
    resetBlogForm();
  } catch(e) { showToast('Ошибка добавления: ' + e.message, 'error'); }
});


/* ==========================================
   6. СТАТИСТИКА (STATS)
========================================== */
async function loadStats() {
  try {
    const doc = await db.doc('stats/main').get();
    if (doc.exists) {
      const d = doc.data();
      setValue('s-years', d.years); setValue('s-clients', d.clients);
      setValue('s-works', d.works); setValue('s-warranty', d.warranty);
      const note = document.getElementById('stats-note');
      if (note) note.style.display = 'block';
    }
  } catch(e) { showToast('Не удалось загрузить статистику', 'error'); }
}

document.getElementById('btn-save-stats')?.addEventListener('click', async () => {
  const data = {
    years:    parseInt(v('s-years'))    || 0,
    clients:  parseInt(v('s-clients'))  || 0,
    works:    parseInt(v('s-works'))    || 0,
    warranty: parseInt(v('s-warranty')) || 0,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };
  try {
    await db.doc('stats/main').set(data, { merge: true });
    await logAction('Статистика обновлена', `${data.years} лет / ${data.clients} клиентов / ${data.works} работ`);
    showToast('Статистика сохранена ✓');
    const note = document.getElementById('stats-note');
    if (note) note.style.display = 'block';
  } catch(e) { showToast('Ошибка сохранения: ' + e.message, 'error'); }
});


/* ==========================================
   7. КОНТЕНТ (CONTENT/MAIN)
========================================== */
async function loadContent() {
  try {
    const doc = await db.doc('content/main').get();
    if (doc.exists) {
      const d = doc.data();
      setValue('c-phone',        d.phone);
      setValue('c-address',      d.address);
      setValue('c-hours',        d.hours);
      setValue('c-hours-footer', d.hours_footer);
      setValue('c-about-image',  d.about_image);
      setValue('c-about-text-1', d.about_text_1);
      setValue('c-about-text-2', d.about_text_2);
      setValue('c-instagram',    d.instagram);
      setValue('c-whatsapp',     d.whatsapp);
      setValue('c-rating-score', d.rating_score);
      setValue('c-rating-label', d.rating_label);
      updateAboutPreview(d.about_image);
      const note = document.getElementById('content-note');
      if (note) note.style.display = 'block';
    }
  } catch(e) { showToast('Не удалось загрузить контент: ' + e.message, 'error'); }
}

function updateAboutPreview(url) {
  const preview = document.getElementById('c-about-preview');
  if (!preview) return;
  if (url) { preview.src = url; preview.style.display = 'block'; }
  else { preview.style.display = 'none'; }
}

document.getElementById('c-about-image')?.addEventListener('input', function() {
  updateAboutPreview(this.value.trim());
});

document.getElementById('btn-save-contacts')?.addEventListener('click', async () => {
  const data = {
    phone:        v('c-phone'),
    address:      v('c-address'),
    hours:        v('c-hours'),
    hours_footer: document.getElementById('c-hours-footer')?.value.trim() || '',
    instagram:    v('c-instagram'),
    whatsapp:     v('c-whatsapp'),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };
  if (!data.phone && !data.address) { showToast('Заполните хотя бы одно поле', 'error'); return; }
  try {
    await db.doc('content/main').set(data, { merge: true });
    await logAction('Контакты обновлены', `Телефон: ${data.phone}`);
    showToast('Контакты сохранены ✓');
  } catch(e) { showToast('Ошибка: ' + e.message, 'error'); }
});

document.getElementById('btn-save-about')?.addEventListener('click', async () => {
  const data = {
    about_image:  v('c-about-image'),
    about_text_1: document.getElementById('c-about-text-1')?.value.trim() || '',
    about_text_2: document.getElementById('c-about-text-2')?.value.trim() || '',
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };
  try {
    await db.doc('content/main').set(data, { merge: true });
    await logAction('Блок «О нас» обновлён');
    showToast('Блок «О нас» сохранён ✓');
  } catch(e) { showToast('Ошибка: ' + e.message, 'error'); }
});

document.getElementById('btn-save-rating')?.addEventListener('click', async () => {
  const data = {
    rating_score: v('c-rating-score'),
    rating_label: v('c-rating-label'),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };
  try {
    await db.doc('content/main').set(data, { merge: true });
    await logAction('Рейтинг обновлён', `${data.rating_score} — ${data.rating_label}`);
    showToast('Рейтинг сохранён ✓');
  } catch(e) { showToast('Ошибка: ' + e.message, 'error'); }
});


/* ==========================================
   8. СЛАЙДЕР (SLIDER)
========================================== */
async function loadSlider() {
  try {
    const doc = await db.doc('content/slider').get();
    if (doc.exists) {
      const d = doc.data();
      for (let i = 1; i <= 3; i++) {
        const url = d[`slide${i}`] || '';
        setValue(`slide-url-${i}`, url);
        updateSlideThumb(i, url);
      }
      const note = document.getElementById('slider-note');
      if (note) note.style.display = 'block';
    }
  } catch(e) { showToast('Не удалось загрузить слайдер', 'error'); }
}

function updateSlideThumb(n, url) {
  const thumb = document.getElementById(`slide-thumb-${n}`);
  if (!thumb) return;
  if (url) { thumb.src = url; thumb.style.opacity = '1'; }
  else { thumb.src = ''; thumb.style.opacity = '0.2'; }
}

for (let i = 1; i <= 3; i++) {
  document.getElementById(`slide-url-${i}`)?.addEventListener('input', function() {
    updateSlideThumb(i, this.value.trim());
  });
}

document.getElementById('btn-save-slider')?.addEventListener('click', async () => {
  const data = {
    slide1: v('slide-url-1'),
    slide2: v('slide-url-2'),
    slide3: v('slide-url-3'),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };
  try {
    await db.doc('content/slider').set(data);
    await logAction('Слайдер обновлён', `${[data.slide1, data.slide2, data.slide3].filter(Boolean).length} фото`);
    showToast('Слайдер сохранён ✓');
    const note = document.getElementById('slider-note');
    if (note) note.style.display = 'block';
  } catch(e) { showToast('Ошибка: ' + e.message, 'error'); }
});


/* ==========================================
   9. ИСТОРИЯ (HISTORY / CHANGELOG)
========================================== */
function loadHistory() {
  const list = document.getElementById('history-list');
  if (!list) return;

  db.collection('changelog').orderBy('createdAt', 'desc').limit(50).onSnapshot(snap => {
    if (snap.empty) {
      list.innerHTML = '<div class="empty-state"><div class="empty-icon">📜</div><div>История пуста</div></div>';
      return;
    }
    list.innerHTML = '';
    snap.forEach(doc => {
      const d = doc.data();
      const dateStr = d.createdAt
        ? new Date(d.createdAt.seconds * 1000).toLocaleString('ru-RU', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })
        : 'только что';

      const row = document.createElement('div');
      row.className = 'log-row';
      row.style.marginBottom = '8px';
      row.innerHTML = `
        <div class="log-dot"></div>
        <div class="log-body">
          <div class="log-action">${esc(d.action)}${d.details ? ' — <span style="color:var(--muted)">' + esc(d.details) + '</span>' : ''}</div>
          <div class="log-meta">${esc(d.user || 'система')} · ${dateStr}</div>
        </div>`;
      list.appendChild(row);
    });
  }, err => showToast('Ошибка загрузки истории: ' + err.message, 'error'));
}


/* ==========================================
   WHYUS — НАШИ ПРЕИМУЩЕСТВА
========================================== */
let whyusEditMode = false;

document.querySelectorAll('.emoji-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const valInput = document.getElementById('wu-icon');
    if (valInput) valInput.value = btn.dataset.emoji || '';
    document.querySelectorAll('.emoji-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
  });
});

document.getElementById('wu-icon')?.addEventListener('input', function() {
  const val = this.value.trim();
  document.querySelectorAll('.emoji-btn').forEach(b => {
    b.classList.toggle('selected', b.dataset.emoji === val);
  });
});

async function loadWhyUs() {
  const list = document.getElementById('whyus-list');
  if (!list) return;
  try {
    const snap = await db.collection('whyus').orderBy('order', 'asc').get();
    const countEl = document.getElementById('whyus-count');
    if (snap.empty) {
      list.innerHTML = '<div class="empty-state"><div class="empty-icon">🏆</div><div>Карточек пока нет</div></div>';
      if (countEl) countEl.textContent = '';
      return;
    }
    if (countEl) countEl.textContent = `(${snap.size})`;
    list.innerHTML = '';
    snap.forEach(doc => {
      const d = doc.data();
      const row = document.createElement('div');
      row.className = 'whyus-row';
      row.innerHTML = `
        <div class="whyus-emoji">${esc(d.icon || '🏆')}</div>
        <div class="whyus-body">
          <div class="whyus-title">${esc(d.title)}</div>
          <div class="whyus-desc">${esc(d.desc || '')}</div>
        </div>
        <div class="item-actions">
          <button class="btn btn-outline" onclick="editWhyUs('${doc.id}','${esc(d.icon||'')}','${esc(d.title||'')}','${esc(d.desc||'')}',${d.order||Date.now()})">✏️</button>
          <button class="btn btn-danger" onclick="deleteDoc('whyus','${doc.id}','Преимущество удалено','${esc(d.title)}'); setTimeout(loadWhyUs,400);">✕</button>
        </div>`;
      list.appendChild(row);
    });
  } catch(e) { showToast('Ошибка загрузки преимуществ: ' + e.message, 'error'); }
}

window.editWhyUs = function(id, icon, title, desc, order) {
  document.getElementById('wu-edit-id').value = id;
  document.getElementById('wu-icon').value    = icon;
  document.getElementById('wu-title').value   = title;
  document.getElementById('wu-desc').value    = desc;
  document.getElementById('wu-order').value   = order; 
  document.getElementById('whyus-form-title').textContent = 'Редактировать преимущество';
  document.getElementById('btn-cancel-whyus').style.display = 'inline-flex';
  document.querySelectorAll('.emoji-btn').forEach(b => b.classList.toggle('selected', b.dataset.emoji === icon));
  whyusEditMode = true;
  document.querySelector('#tab-whyus .card').scrollIntoView({ behavior: 'smooth', block: 'start' });
};

function resetWhyUsForm() {
  document.getElementById('wu-edit-id').value = '';
  document.getElementById('wu-icon').value    = '';
  document.getElementById('wu-title').value   = '';
  document.getElementById('wu-desc').value    = '';
  document.getElementById('wu-order').value   = '';
  document.getElementById('whyus-form-title').textContent = 'Добавить преимущество';
  document.getElementById('btn-cancel-whyus').style.display = 'none';
  document.querySelectorAll('.emoji-btn').forEach(b => b.classList.remove('selected'));
  whyusEditMode = false;
}

document.getElementById('btn-cancel-whyus')?.addEventListener('click', resetWhyUsForm);

document.getElementById('btn-save-whyus')?.addEventListener('click', async () => {
  const icon  = v('wu-icon')  || '🏆';
  const title = v('wu-title');
  const desc  = document.getElementById('wu-desc')?.value.trim() || '';
  const editId = document.getElementById('wu-edit-id').value;

  if (!title) { showToast('Введите заголовок', 'error'); return; }

  const existingOrder = document.getElementById('wu-order').value;
  const order = editId && existingOrder ? parseInt(existingOrder) : Date.now();

  const data = { icon, title, desc, order, updatedAt: firebase.firestore.FieldValue.serverTimestamp() };

  try {
    if (editId) {
      await db.collection('whyus').doc(editId).update(data);
      await logAction('Преимущество обновлено', title);
      showToast('Преимущество обновлено ✓');
    } else {
      data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      await db.collection('whyus').add(data);
      await logAction('Преимущество добавлено', title);
      showToast('Преимущество добавлено ✓');
    }
    resetWhyUsForm();
    loadWhyUs();
  } catch(e) { showToast('Ошибка: ' + e.message, 'error'); }
});


/* ==========================================
   HELPERS
========================================== */
function v(id)             { return document.getElementById(id)?.value?.trim() || ''; }
function setValue(id, val) { const el = document.getElementById(id); if (el && val !== undefined) el.value = val; }
function clearField(id)    { const el = document.getElementById(id); if (el) el.value = ''; }
function esc(str)          { return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

async function deleteDoc(collection, id, logMsg = 'Документ удалён', logDetails = '') {
  if (!confirm('Удалить этот элемент?')) return;
  try {
    await db.collection(collection).doc(id).delete();
    await logAction(logMsg, logDetails);
    showToast('Удалено ✓');
  } catch(e) { showToast('Ошибка удаления: ' + e.message, 'error'); }
}