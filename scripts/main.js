// IMediaC Kids - basic auth & points system using localStorage
// Keys
const LS_USERS = 'IMK_USERS';
const LS_SESSION = 'IMK_SESSION';
const LS_POINTS_LOG = 'IMK_POINTS_LOG';

function _read(key, fallback) {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch { return fallback; }
}
function _write(key, value) { localStorage.setItem(key, JSON.stringify(value)); }

function getUsers() { return _read(LS_USERS, []); }
function saveUsers(users) { _write(LS_USERS, users); }

function getSession() { return _read(LS_SESSION, null); }
function setSession(session) { _write(LS_SESSION, session); }

function addPoints(userId, points, reason = 'activity') {
  const users = getUsers();
  const user = users.find(u => u.id === userId);
  if (!user) return;
  user.points = (user.points || 0) + points;
  saveUsers(users);
  const log = _read(LS_POINTS_LOG, []);
  log.push({ userId, points, reason, at: new Date().toISOString() });
  _write(LS_POINTS_LOG, log);
}

function monthlyTotals(monthKey) {
  // monthKey like '2025-11'
  const log = _read(LS_POINTS_LOG, []);
  const totals = {};
  for (const item of log) {
    const mk = item.at.slice(0,7);
    if (mk !== monthKey) continue;
    totals[item.userId] = (totals[item.userId] || 0) + item.points;
  }
  return totals;
}

function getLeaderboard(limit = 20) {
  const users = getUsers();
  return [...users].sort((a,b) => (b.points||0) - (a.points||0)).slice(0, limit);
}

function signup({ username, email, password, madrasah, age }) {
  const users = getUsers();
  if (users.some(u => u.username.toLowerCase() === username.toLowerCase())) {
    throw new Error('Username already exists');
  }
  const id = crypto.randomUUID();
  const ageNum = age ? parseInt(age, 10) : undefined;
  const user = { id, username, email, password, points: 0, createdAt: new Date().toISOString() };
  if (madrasah) user.madrasah = madrasah;
  if (ageNum !== undefined && !Number.isNaN(ageNum)) user.age = ageNum;
  users.push(user); saveUsers(users); setSession({ userId: id });
  return user;
}

function login({ username, password }) {
  const users = getUsers();
  const user = users.find(u => u.username.toLowerCase() === username.toLowerCase() && u.password === password);
  if (!user) throw new Error('Invalid username or password');
  setSession({ userId: user.id });
  return user;
}

function currentUser() {
  const session = getSession();
  if (!session) return null;
  const users = getUsers();
  return users.find(u => u.id === session.userId) || null;
}

function logout() { localStorage.removeItem(LS_SESSION); }

// Daily content helpers
const AYAT = [
  { ar: 'فَاذْكُرُونِي أَذْكُرْكُمْ', en: 'So remember Me; I will remember you.', ref: 'Quran 2:152' },
  { ar: 'إِنَّ اللّهَ مَعَ الصَّابِرِينَ', en: 'Indeed, Allah is with the patient.', ref: 'Quran 2:153' },
  { ar: 'وَرَبُّكَ الْغَفُورُ ذُو الرَّحْمَةِ', en: 'Your Lord is the Forgiving, full of mercy.', ref: 'Quran 18:58' },
  { ar: 'إِنَّ مَعَ الْعُسْرِ يُسْرًا', en: 'Indeed, with hardship comes ease.', ref: 'Quran 94:6' },
  { ar: 'اللّهُ نُورُ السَّمَاوَاتِ وَالْأَرْضِ', en: 'Allah is the Light of the heavens and the earth.', ref: 'Quran 24:35' },
];

const HADITH = [
  { text: 'The strong believer is better and more beloved to Allah than the weak believer.', ref: 'Muslim' },
  { text: 'The best among you are those who learn the Quran and teach it.', ref: 'Bukhari' },
  { text: 'He is not a believer whose stomach is filled while the neighbor to his side goes hungry.', ref: 'Bukhari' },
  { text: 'Smiling in the face of your brother is charity.', ref: 'Tirmidhi' },
  { text: 'Allah is gentle and loves gentleness in all matters.', ref: 'Bukhari' },
];

const DUA = [
  { ar: 'رَبِّ زِدْنِي عِلْمًا', en: 'My Lord, increase me in knowledge.', ref: 'Quran 20:114' },
  { ar: 'رَبَّنَا آتِنَا فِي الدُّنْيَا حَسَنَةً', en: 'Our Lord, give us in this world good...', ref: 'Quran 2:201' },
  { ar: 'اللهم اغفر لي', en: 'O Allah, forgive me.', ref: 'General' },
  { ar: 'اللهم اشفِ مرضانا', en: 'O Allah, heal our sick.', ref: 'General' },
  { ar: 'اللهم ارزقنا الجنة', en: 'O Allah, grant us Paradise.', ref: 'General' },
];

function pickOfDay(arr) {
  const d = new Date();
  const index = (d.getFullYear()*10000 + (d.getMonth()+1)*100 + d.getDate()) % arr.length;
  return arr[index];
}

function renderDailyContent() {
  const ayah = pickOfDay(AYAT);
  const hadith = pickOfDay(HADITH);
  const dua = pickOfDay(DUA);
  const ayEl = document.getElementById('ayah');
  const hdEl = document.getElementById('hadith');
  const duEl = document.getElementById('dua');
  if (ayEl) ayEl.innerHTML = `<strong>${ayah.ar}</strong><br/><em>${ayah.en}</em> — ${ayah.ref}`;
  if (hdEl) hdEl.innerHTML = `${hadith.text} — ${hadith.ref}`;
  if (duEl) duEl.innerHTML = `<strong>${dua.ar}</strong><br/><em>${dua.en}</em> — ${dua.ref}`;
}

// Radio player controls
function bindRadioPlayer() {
  const audio = document.getElementById('radioPlayer');
  const toggleBtn = document.getElementById('radioToggleBtn');
  const stopBtn = document.getElementById('radioStopBtn');
  const muteBtn = document.getElementById('radioMuteBtn');
  const volumeInput = document.getElementById('radioVolume');
  const statusEl = document.getElementById('radioStatus');
  const visualizer = document.querySelector('#radio .rp-visualizer');
  if (!audio || !toggleBtn || !stopBtn || !muteBtn || !volumeInput || !statusEl) return;

  const updateUi = (overrideStatus) => {
    const isPlaying = !audio.paused && !audio.ended && audio.readyState >= 2;
    toggleBtn.textContent = isPlaying ? '⏸ Pause' : '▶ Play';
    toggleBtn.setAttribute('aria-label', isPlaying ? 'Pause' : 'Play');
    toggleBtn.classList.toggle('btn-outline', isPlaying);
    toggleBtn.classList.toggle('btn-primary', !isPlaying);
    muteBtn.textContent = audio.muted ? '🔊 Unmute' : '🔇 Mute';
    muteBtn.setAttribute('aria-label', audio.muted ? 'Unmute' : 'Mute');
    if (overrideStatus) {
      statusEl.textContent = overrideStatus;
    } else {
      statusEl.textContent = isPlaying ? 'Playing' : (audio.paused ? 'Paused' : 'Stopped');
    }
    if (visualizer) visualizer.classList.toggle('active', isPlaying);
  };

  toggleBtn.addEventListener('click', async () => {
    try {
      if (audio.paused) {
        updateUi('Buffering…');
        await audio.play();
      } else {
        audio.pause();
      }
    } catch (err) {
      console.error('Radio play error:', err);
      statusEl.textContent = 'Playback failed';
      alert('Playback failed. Your browser may require interaction or the stream may be unavailable.');
    } finally {
      updateUi();
    }
  });

  stopBtn.addEventListener('click', () => {
    try {
      audio.pause();
      audio.currentTime = 0;
      updateUi('Stopped');
    } finally {
      updateUi();
    }
  });

  muteBtn.addEventListener('click', () => {
    audio.muted = !audio.muted;
    updateUi();
  });

  volumeInput.addEventListener('input', () => {
    const v = parseFloat(volumeInput.value);
    audio.volume = isNaN(v) ? 1 : v;
    if (audio.volume === 0 && !audio.muted) audio.muted = true;
    if (audio.volume > 0 && audio.muted) audio.muted = false;
    updateUi();
  });

  audio.addEventListener('waiting', () => updateUi('Buffering…'));
  audio.addEventListener('canplay', () => updateUi());
  audio.addEventListener('canplaythrough', () => updateUi());
  audio.addEventListener('play', () => updateUi());
  audio.addEventListener('pause', () => updateUi());
  audio.addEventListener('ended', () => updateUi('Stopped'));
  audio.addEventListener('stalled', () => updateUi('Connection stalled'));
  audio.addEventListener('error', (e) => {
    console.error('Radio error:', audio.error || e);
    updateUi('Error loading stream');
  });
  updateUi('Stopped');
}
// Auth UI helpers (used on auth.html)
function bindAuthForm() {
  const signupForm = document.getElementById('signupForm');
  const loginForm = document.getElementById('loginForm');
  const status = document.getElementById('authStatus');
  const you = currentUser();
  if (you && status) {
    const mad = you.madrasah ? ` • Madrasah: ${you.madrasah}` : '';
    const age = typeof you.age === 'number' ? ` • Age: ${you.age}` : '';
    status.innerHTML = `Logged in as <strong>${you.username}</strong> • Points: ${you.points || 0}${mad}${age}`;
  }
  if (signupForm) {
    signupForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(signupForm);
      try {
        const user = signup({ username: fd.get('username'), email: fd.get('email'), password: fd.get('password'), madrasah: fd.get('madrasah'), age: fd.get('age') });
        // Notify admin by email of new signup via formsubmit.co
        try {
          const form = document.createElement('form');
          form.action = 'https://formsubmit.co/imediac786@gmail.com';
          form.method = 'POST';
          form.target = '_blank';
          const add = (name, value) => { const inp = document.createElement('input'); inp.type = 'hidden'; inp.name = name; inp.value = value || ''; form.appendChild(inp); };
          add('_subject', 'New IMediaC Kids signup');
          add('_captcha', 'false');
          add('_template', 'table');
          add('username', user.username);
          add('parentEmail', user.email);
          add('madrasah', user.madrasah || '');
          add('age', typeof user.age === 'number' ? String(user.age) : '');
          add('signedUpAt', new Date().toLocaleString());
          add('points', String(user.points || 0));
          document.body.appendChild(form);
          form.submit();
          setTimeout(() => form.remove(), 3000);
        } catch (mailErr) {
          console.warn('Signup email notification failed:', mailErr);
        }
        addPoints(user.id, 20, 'signup-bonus');
        alert('Welcome! 20 bonus points added.');
        window.location.href = 'games.html';
      } catch (err) { alert(err.message || String(err)); }
    });
  }
  if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(loginForm);
      try {
        const user = login({ username: fd.get('username'), password: fd.get('password') });
        // Optionally update profile info provided during login
        const madrasah = (fd.get('madrasah') || '').trim();
        const ageRaw = (fd.get('age') || '').trim();
        const age = ageRaw ? parseInt(ageRaw, 10) : undefined;
        if (madrasah || (age !== undefined && !Number.isNaN(age))) {
          const users = getUsers();
          const idx = users.findIndex(u => u.id === user.id);
          if (idx !== -1) {
            if (madrasah) users[idx].madrasah = madrasah;
            if (age !== undefined && !Number.isNaN(age)) users[idx].age = age;
            saveUsers(users);
          }
        }
        alert(`Welcome back, ${user.username}!`);
        window.location.href = 'games.html';
      } catch (err) { alert(err.message || String(err)); }
    });
  }
}

// Games & Quiz helpers
const DAILY_QUIZ_KEY = 'IMK_DAILY_QUIZ_DATE';
function canPlayDailyQuiz() {
  const you = currentUser(); if (!you) return false;
  const k = `${DAILY_QUIZ_KEY}_${you.id}`;
  const last = localStorage.getItem(k);
  const today = new Date().toISOString().slice(0,10);
  return last !== today;
}
function markPlayedDailyQuiz() {
  const you = currentUser(); if (!you) return;
  const k = `${DAILY_QUIZ_KEY}_${you.id}`;
  localStorage.setItem(k, new Date().toISOString().slice(0,10));
}

function bindQuiz() {
  const quizForm = document.getElementById('quizForm');
  const quizNotice = document.getElementById('quizNotice');
  const you = currentUser();
  if (quizNotice) {
    if (!you) quizNotice.textContent = 'Please log in or sign up to play and earn points.';
    else if (!canPlayDailyQuiz()) quizNotice.textContent = 'You already played today. Come back tomorrow!';
    else quizNotice.textContent = 'Earn points with today\'s quiz!';
  }
  if (quizForm) {
    quizForm.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!you) { alert('Log in to earn points.'); return; }
      if (!canPlayDailyQuiz()) { alert('Daily limit reached.'); return; }
      const fd = new FormData(quizForm);
      const answers = ['b','a','c','b','a'];
      let score = 0;
      answers.forEach((ans, i) => { if ((fd.get(`q${i+1}`) || '') === ans) score++; });
      const pts = score * 10 + (score === answers.length ? 10 : 0); // 10 pts per correct, +10 perfect
      addPoints(you.id, pts, 'daily-quiz');
      markPlayedDailyQuiz();
      alert(`You scored ${score}/${answers.length}. Points earned: ${pts}`);
      window.location.href = 'leaderboard.html';
    });
  }
}

// Stories helpers
function bindStoryReadButtons() {
  document.querySelectorAll('[data-award-story]').forEach(btn => {
    btn.addEventListener('click', () => {
      const you = currentUser();
      if (!you) { alert('Log in to track points.'); return; }
      addPoints(you.id, 5, 'story-read');
      alert('Great job! +5 points awarded for reading.');
    });
  });
}

// Leaderboard render
function renderLeaderboard() {
  const tbody = document.getElementById('leaderboardBody');
  const info = document.getElementById('leaderboardInfo');
  if (!tbody) return;
  const list = getLeaderboard(50);
  tbody.innerHTML = '';
  list.forEach((u, idx) => {
    const tr = document.createElement('tr');
    const badge = idx===0?'🥇':idx===1?'🥈':idx===2?'🥉':'';
    tr.innerHTML = `<td class="col-rank" data-label="Rank">${idx+1}</td><td class="col-name" data-label="Player"><span class="lb-badge">${badge}</span>${u.username}</td><td class="col-madrasah" data-label="Madrasah">${u.madrasah || '-'}</td><td class="col-age" data-label="Age">${typeof u.age==='number'?u.age:'-'}</td><td class="col-points" data-label="Points">${u.points||0}</td>`;
    tbody.appendChild(tr);
  });
  if (info) {
    const mk = new Date().toISOString().slice(0,7);
    const totals = monthlyTotals(mk);
    const entries = Object.entries(totals).sort((a,b) => b[1]-a[1]).slice(0,3);
    info.textContent = entries.length ? `This month\'s current top: ${entries.map(([uid,pts]) => {
      const u = getUsers().find(x=>x.id===uid); return u ? `${u.username} (${pts})` : `User (${pts})`;
    }).join(', ')}` : 'Play and learn to appear on this month\'s leaderboard!';
  }
}

// Contact form
function bindContactForm() {
  const form = document.getElementById('contactForm');
  if (!form) return;
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    alert('Thanks! Your message has been received. We\'ll reply to parents via email.');
    form.reset();
  });
}

// Home profile box
function renderProfileBox() {
  const box = document.getElementById('profileBox');
  if (!box) return;
  const u = currentUser();
  if (u) {
    const mad = u.madrasah || '-';
    const age = typeof u.age === 'number' ? u.age : '-';
    const pts = u.points || 0;
    box.innerHTML = `
      <h2>Your Profile</h2>
      <p><strong>${u.username}</strong></p>
      <p>Madrasah: ${mad}</p>
      <p>Age: ${age}</p>
      <p>Points: ${pts}</p>
      <div class="grid" style="grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));">
        <a class="btn btn-secondary" href="leaderboard.html">View Leaderboard</a>
        <button id="logoutBtn" class="btn btn-outline">Log Out</button>
      </div>
    `;
    const logoutBtn = box.querySelector('#logoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        logout();
        alert('Logged out');
        window.location.href = 'auth.html';
      });
    }
  } else {
    box.innerHTML = `
      <h2>Your Profile</h2>
      <p>Not logged in. <a href="auth.html" class="btn btn-primary">Login/Signup</a></p>
    `;
  }
}

// Home slider — Islamic quotes with only Islamic images
function renderHomeSlider() {
  const slidesEl = document.getElementById('sliderSlides');
  const dotsEl = document.getElementById('sliderDots');
  const prevBtn = document.getElementById('sliderPrev');
  const nextBtn = document.getElementById('sliderNext');
  if (!slidesEl || !dotsEl) return;

  // Use local SVG assets (CORS-safe and fast)
  const SLIDES = [
    { quote: 'My Lord, increase me in knowledge.', ref: 'Quran 20:114', img: 'assets/slider/mosque-1.svg' },
    { quote: 'Indeed, with hardship comes ease.', ref: 'Quran 94:6', img: 'assets/slider/pattern-star.svg' },
    { quote: 'The best among you are those who learn the Quran and teach it.', ref: 'Bukhari', img: 'assets/slider/quran.svg' },
    { quote: 'Allah is gentle and loves gentleness in all matters.', ref: 'Bukhari', img: 'assets/slider/mosque-2.svg' },
    { quote: 'So remember Me; I will remember you.', ref: 'Quran 2:152', img: 'assets/slider/pattern-grid.svg' },
  ];

  slidesEl.innerHTML = '';
  dotsEl.innerHTML = '';
  SLIDES.forEach((s, i) => {
    const slide = document.createElement('div');
    slide.className = 'slide';
    slide.style.backgroundImage = `url(${s.img})`;
    slide.innerHTML = `<div class="slide-content"><h3>“${s.quote}”</h3><p>— ${s.ref}</p></div>`;
    slidesEl.appendChild(slide);
    const dot = document.createElement('button');
    dot.className = 'slider-dot';
    dot.setAttribute('aria-label', `Go to slide ${i+1}`);
    dotsEl.appendChild(dot);
  });

  const allSlides = Array.from(slidesEl.children);
  const allDots = Array.from(dotsEl.children);
  let idx = 0;
  let timer = null;
  function show(i) {
    idx = (i + allSlides.length) % allSlides.length;
    allSlides.forEach((el, k) => el.classList.toggle('active', k === idx));
    allDots.forEach((el, k) => el.classList.toggle('active', k === idx));
  }
  function start() { stop(); timer = setInterval(() => show(idx + 1), 5000); }
  function stop() { if (timer) { clearInterval(timer); timer = null; } }
  allDots.forEach((d, k) => d.addEventListener('click', () => { show(k); start(); }));
  if (prevBtn) prevBtn.addEventListener('click', () => { show(idx - 1); start(); });
  if (nextBtn) nextBtn.addEventListener('click', () => { show(idx + 1); start(); });
  slidesEl.addEventListener('mouseenter', stop);
  slidesEl.addEventListener('mouseleave', start);
  show(0); start();
}

// Bootstrapping per page
document.addEventListener('DOMContentLoaded', () => {
  // Enable basic hooks depending on page elements present
  bindAuthForm();
  bindQuiz();
  bindStoryReadButtons();
  renderLeaderboard();
  bindContactForm();
  renderDailyContent();
  renderProfileBox();
  renderHomeSlider();
  bindRadioPlayer();
  bindQuranPage();
});

// Quran page: load surahs, render ayahs, and play verse-by-verse audio
function bindQuranPage() {
  const page = document.getElementById('quranPage');
  if (!page) return; // only run on quran.html
  // Small helper: fetch JSON with timeout and friendly error mapping
  async function fetchJsonWithTimeout(url, { timeoutMs = 10000 } = {}) {
    const ctrl = new AbortController();
    const id = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { signal: ctrl.signal });
      if (!res.ok) {
        const err = new Error(`HTTP ${res.status}`);
        err.status = res.status;
        throw err;
      }
      return await res.json();
    } finally {
      clearTimeout(id);
    }
  }
  const surahSelect = document.getElementById('surahSelect');
  const ayahList = document.getElementById('ayahList');
  const statusEl = document.getElementById('qStatus');
  const playAllBtn = document.getElementById('playAllBtn');
  const stopAllBtn = document.getElementById('stopAllBtn');
  const audio = document.getElementById('ayahAudio');
  const translationSelect = document.getElementById('translationSelect');
  const toggleTranslation = document.getElementById('toggleTranslation');
  const reciterSelect = document.getElementById('reciterSelect');
  if (!surahSelect || !ayahList || !statusEl || !playAllBtn || !audio) return;

  let currentSurah = null;
  let currentIndex = 0;
  let ayahs = [];
  let translationCode = (translationSelect && translationSelect.value) || 'en.sahih';
  const RECITERS = {
    'abdul-basit-192': { label: 'Abdul Basit (Murattal)', edition: 'ar.abdulbasitmurattal' },
    'alafasy-128': { label: 'Mishary Alafasy', edition: 'ar.alafasy' },
    'husary-64': { label: 'Husary', edition: 'ar.husary' },
    'shaikh-ash-shatree-64': { label: 'Abu Bakr Ash-Shaatree', edition: 'ar.shaatree' },
    'minshawi-64': { label: 'Minshawi', edition: 'ar.minshawi' }
  };
  let reciterKey = (reciterSelect && reciterSelect.value) || 'alafasy-128';
  // Track user stop requests to cancel pending/sequential playback
  let stopRequested = false;

  const audioCache = new Map();
  async function resolveAudioUrl(surahNo, ayahNo, overrideEdition) {
    const rec = RECITERS[reciterKey] || RECITERS['alafasy-128'];
    const edition = overrideEdition || rec.edition || 'ar.alafasy';
    const key = `${surahNo}:${ayahNo}:${edition}`;
    if (audioCache.has(key)) return audioCache.get(key);
    try {
      const res = await fetch(`https://api.alquran.cloud/v1/ayah/${surahNo}:${ayahNo}/${edition}`);
      const j = await res.json();
      const url = j?.data?.audio;
      if (url) { audioCache.set(key, url); return url; }
      throw new Error('No audio');
    } catch (e) {
      // Internal fallback only if no explicit override provided
      if (!overrideEdition && edition !== 'ar.alafasy') {
        const fbKey = `${surahNo}:${ayahNo}:ar.alafasy`;
        if (audioCache.has(fbKey)) return audioCache.get(fbKey);
        const r2 = await fetch(`https://api.alquran.cloud/v1/ayah/${surahNo}:${ayahNo}/ar.alafasy`);
        const j2 = await r2.json();
        const url2 = j2?.data?.audio;
        if (url2) { audioCache.set(fbKey, url2); return url2; }
      }
      throw e;
    }
  }

  async function loadSurahs() {
    try {
      statusEl.textContent = 'Loading surahs…';
      const data = await fetchJsonWithTimeout('https://api.alquran.cloud/v1/surah', { timeoutMs: 12000 });
      const list = data?.data || [];
      surahSelect.innerHTML = '';
      list.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.number;
        opt.textContent = `${s.number}. ${s.englishName} (${s.englishNameTranslation})`;
        opt.dataset.ayahCount = s.numberOfAyahs;
        surahSelect.appendChild(opt);
      });
      statusEl.textContent = 'Select a Surah to load.';
      surahSelect.disabled = false;
    } catch (err) {
      console.error('Surah load error', err);
      const msg = (err && err.status === 503)
        ? 'Quran service is temporarily unavailable (503). Please try again in a moment.'
        : 'Failed to load surahs. Check your internet connection or try again later.';
      statusEl.textContent = msg;
    }
  }

  async function loadAyahs(surahNo) {
    try {
      statusEl.textContent = `Loading Surah ${surahNo}…`;
      ayahList.innerHTML = '';
      playAllBtn.disabled = true;
      const json = await fetchJsonWithTimeout(`https://api.alquran.cloud/v1/surah/${surahNo}/quran-uthmani`, { timeoutMs: 15000 });
      const surah = json?.data;
      const verses = Array.isArray(surah?.ayahs) ? surah.ayahs : [];
      // Load English translation for the same Surah
      let tVerses = [];
      try {
        const tJson = await fetchJsonWithTimeout(`https://api.alquran.cloud/v1/surah/${surahNo}/${translationCode}`, { timeoutMs: 12000 });
        const tSurah = tJson?.data;
        tVerses = Array.isArray(tSurah?.ayahs) ? tSurah.ayahs : [];
      } catch (tErr) {
        console.warn('Translation load error', tErr);
      }
      currentSurah = surahNo;
      ayahs = verses.map((v, i) => ({ numberInSurah: v.numberInSurah, text: v.text, en: tVerses[i]?.text || '' }));
      renderAyahList();
      statusEl.textContent = `Loaded Surah ${surahNo}.`;
      playAllBtn.disabled = ayahs.length === 0;
      if (stopAllBtn) stopAllBtn.disabled = ayahs.length === 0;
      applyTranslationVisibility();
    } catch (err) {
      console.error('Ayah load error', err);
      const msg = (err && err.status === 503)
        ? 'Quran service is temporarily unavailable (503). Please try again in a moment.'
        : 'Failed to load ayahs. Please retry.';
      statusEl.textContent = msg;
    }
  }

  function renderAyahList() {
    ayahList.innerHTML = '';
    ayahs.forEach((a, idx) => {
      const li = document.createElement('li');
      li.className = 'ayah-item';
      li.innerHTML = `
        <div class=\"ayah-row\">
          <span class=\"ayah-no\">${idx+1}</span>
          <span class=\"ayah-text\">${a.text}</span>
          <button class=\"btn btn-outline ayah-play\" data-idx=\"${idx}\">▶ Play</button>
        </div>
        ${a.en ? `<div class=\"ayah-translation\">${a.en}</div>` : ''}
      `;
      ayahList.appendChild(li);
    });
    ayahList.querySelectorAll('.ayah-play').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const i = parseInt(e.currentTarget.getAttribute('data-idx'), 10);
        playAyah(i);
      });
    });
  }

  async function playAyah(idx) {
    if (!Number.isInteger(idx) || idx < 0 || idx >= ayahs.length) return;
    stopRequested = false; // reset stop when explicitly starting playback
    currentIndex = idx;
    const sNo = currentSurah;
    const aNo = ayahs[idx].numberInSurah;
    try {
      const url = await resolveAudioUrl(sNo, aNo);
      audio.preload = 'auto';
      const srcEl = document.getElementById('ayahSource');
      // Safer play: wait for canplaythrough before invoking play
      await (async function safePlay(u) {
        return new Promise((resolve, reject) => {
          let settled = false;
          const onReady = async () => {
            if (settled) return; settled = true;
            cleanup();
            if (stopRequested) { // user pressed Stop during buffering
              statusEl.textContent = 'Stopped.';
              highlightPlaying(-1);
              return resolve();
            }
            try { await audio.play(); resolve(); }
            catch (e) { reject(e); }
          };
          const onErr = (e) => { if (settled) return; settled = true; cleanup(); reject(audio.error || e); };
          const cleanup = () => {
            audio.removeEventListener('canplaythrough', onReady);
            audio.removeEventListener('canplay', onReady);
            audio.removeEventListener('error', onErr);
          };
          if (srcEl) { srcEl.src = u; }
          else { audio.src = u; }
          audio.load();
          audio.addEventListener('canplaythrough', onReady);
          audio.addEventListener('canplay', onReady);
          audio.addEventListener('error', onErr);
          setTimeout(() => { if (!settled) { settled = true; cleanup(); reject(new Error('Timeout loading audio')); } }, 12000);
        });
      })(url);
      statusEl.textContent = `Playing ${sNo}:${aNo}…`;
      highlightPlaying(idx);
    } catch (err) {
      console.error('Audio play error', err);
      // Multi-reciter fallback chain
      const editionsPriority = ['ar.alafasy', 'ar.husary', 'ar.shaatree', 'ar.minshawi'];
      const selectedEdition = (RECITERS[reciterKey] && RECITERS[reciterKey].edition) || 'ar.alafasy';
      const attempts = [selectedEdition, ...editionsPriority].filter((e, i, arr) => arr.indexOf(e) === i);
      let lastUrl = '';
      for (let j = 0; j < attempts.length; j++) {
        const ed = attempts[j];
        if (j === 0) continue; // we already tried selectedEdition
        try {
          statusEl.textContent = `Trying fallback reciter… (${ed})`;
          const fbUrl = await resolveAudioUrl(sNo, aNo, ed);
          lastUrl = fbUrl || '';
          await (async function safePlay(u) {
            return new Promise((resolve, reject) => {
              let settled = false;
              const onReady = async () => {
                if (settled) return; settled = true;
                cleanup();
                if (stopRequested) {
                  statusEl.textContent = 'Stopped.';
                  highlightPlaying(-1);
                  return resolve();
                }
                try { await audio.play(); resolve(); }
                catch (e) { reject(e); }
              };
              const onErr = (e) => { if (settled) return; settled = true; cleanup(); reject(audio.error || e); };
              const cleanup = () => {
                audio.removeEventListener('canplaythrough', onReady);
                audio.removeEventListener('canplay', onReady);
                audio.removeEventListener('error', onErr);
              };
              if (srcEl) { srcEl.src = u; } else { audio.src = u; }
              audio.load();
              audio.addEventListener('canplaythrough', onReady);
              audio.addEventListener('canplay', onReady);
              audio.addEventListener('error', onErr);
              setTimeout(() => { if (!settled) { settled = true; cleanup(); reject(new Error('Timeout loading audio')); } }, 12000);
            });
          })(fbUrl);
          statusEl.textContent = `Playing ${sNo}:${aNo} (fallback ${ed})…`;
          highlightPlaying(idx);
          return;
        } catch (fallbackErr) {
          console.warn('Fallback attempt failed for', ed, fallbackErr);
        }
      }
      statusEl.innerHTML = 'Audio failed to play. Try another reciter or Surah.' + (lastUrl ? ` <a href="${lastUrl}" target="_blank" rel="noopener">Open audio</a>` : '');
    }
  }

  function highlightPlaying(idx) {
    ayahList.querySelectorAll('.ayah-item').forEach((el, i) => {
      el.classList.toggle('playing', i === idx);
    });
  }

  function playSequential() {
    if (!ayahs.length) return;
    stopRequested = false;
    playAyah(0);
  }

  audio.addEventListener('ended', () => {
    if (stopRequested) {
      statusEl.textContent = 'Stopped.';
      highlightPlaying(-1);
      return;
    }
    const next = currentIndex + 1;
    if (next < ayahs.length) {
      playAyah(next);
    } else {
      statusEl.textContent = 'Finished Surah.';
      highlightPlaying(-1);
    }
  });

  surahSelect.addEventListener('change', () => {
    const sNo = parseInt(surahSelect.value, 10);
    // Stop any ongoing playback when changing Surah
    try { stopRequested = true; audio.pause(); audio.currentTime = 0; highlightPlaying(-1); } catch {}
    if (!Number.isNaN(sNo)) loadAyahs(sNo);
  });
  playAllBtn.addEventListener('click', playSequential);

  if (stopAllBtn) {
    stopAllBtn.addEventListener('click', () => {
      try {
        stopRequested = true;
        audio.pause();
        audio.currentTime = 0;
        // Clear source and reload to cancel pending buffering
        audio.removeAttribute('src');
        audio.load();
        statusEl.textContent = 'Stopped.';
        highlightPlaying(-1);
      } catch (e) {
        console.warn('Stop failed', e);
      }
    });
  }

  if (reciterSelect) {
    reciterSelect.addEventListener('change', () => {
      reciterKey = reciterSelect.value || 'alafasy-128';
      // If something is playing, restart current verse with new reciter
      if (!stopRequested && typeof currentIndex === 'number' && ayahs.length) {
        playAyah(currentIndex);
      }
    });
  }

  function applyTranslationVisibility() {
    const show = toggleTranslation ? toggleTranslation.checked : true;
    ayahList.classList.toggle('hide-translation', !show);
  }
  if (toggleTranslation) {
    toggleTranslation.addEventListener('change', applyTranslationVisibility);
  }
  if (translationSelect) {
    translationSelect.addEventListener('change', () => {
      translationCode = translationSelect.value || 'en.sahih';
      if (currentSurah) loadAyahs(currentSurah);
    });
  }

  // Initialize
  surahSelect.disabled = true;
  if (stopAllBtn) stopAllBtn.disabled = true;
  loadSurahs();
}
