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
  if (ayEl) {
    ayEl.innerHTML = `<strong>${ayah.ar}</strong><br/><em>${ayah.en}</em>`;
    const refEl = document.getElementById('ayahRef');
    if (refEl) refEl.textContent = ayah.ref || '';
  }
  if (hdEl) {
    hdEl.innerHTML = `${hadith.text}`;
    const refEl = document.getElementById('hadithRef');
    if (refEl) refEl.textContent = hadith.ref || '';
  }
  if (duEl) duEl.innerHTML = `<strong>${dua.ar}</strong><br/><em>${dua.en}</em> — ${dua.ref}`;
  bindDailyActions({ ayah, hadith });
}

function parseQuranRef(ref) {
  const m = /Quran\s+(\d+)\s*:\s*(\d+)/i.exec(ref || '');
  if (!m) return null;
  return { surah: parseInt(m[1], 10), ayah: parseInt(m[2], 10) };
}

async function fetchAyahAudioUrl(ref) {
  const parsed = parseQuranRef(ref);
  if (!parsed) return null;
  const url = `https://api.alquran.cloud/v1/ayah/${parsed.surah}:${parsed.ayah}/ar.alafasy`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    if (data && data.data && data.data.audio) return data.data.audio;
    return null;
  } catch (e) {
    console.warn('Ayah audio fetch failed', e);
    return null;
  }
}

function bindDailyActions({ ayah, hadith }) {
  const playBtn = document.getElementById('playAyahBtn');
  const copyAyahBtn = document.getElementById('copyAyahBtn');
  const shareAyahBtn = document.getElementById('shareAyahBtn');
  const copyHadithBtn = document.getElementById('copyHadithBtn');
  const shareHadithBtn = document.getElementById('shareHadithBtn');
  const ayAudio = document.getElementById('ayahAudio');
  if (playBtn && ayAudio) {
    playBtn.onclick = async () => {
      playBtn.disabled = true; playBtn.textContent = 'Loading…';
      const src = await fetchAyahAudioUrl(ayah.ref);
      if (src) {
        ayAudio.src = src;
        try { await ayAudio.play(); playBtn.textContent = '⏸ Pause'; } catch {}
        ayAudio.onplay = () => { playBtn.textContent = '⏸ Pause'; playBtn.disabled = false; };
        ayAudio.onpause = () => { playBtn.textContent = '▶ Play Audio'; playBtn.disabled = false; };
      } else {
        playBtn.textContent = '▶ Play Audio'; playBtn.disabled = false;
        alert('Audio not available for this ayah right now.');
      }
    };
  }
  if (copyAyahBtn) {
    copyAyahBtn.onclick = async () => {
      const text = `${ayah.ar}\n${ayah.en} — ${ayah.ref}`;
      try { await navigator.clipboard.writeText(text); alert('Ayah copied'); } catch { alert('Copy failed'); }
    };
  }
  if (shareAyahBtn) {
    shareAyahBtn.onclick = async () => {
      const text = `${ayah.ar}\n${ayah.en}`;
      const title = `Ayah of the Day (${ayah.ref})`;
      if (navigator.share) {
        try { await navigator.share({ title, text }); } catch {}
      } else {
        try { await navigator.clipboard.writeText(`${title}\n${text}`); alert('Shared text copied'); } catch { alert('Share not supported'); }
      }
    };
  }
  if (copyHadithBtn) {
    copyHadithBtn.onclick = async () => {
      const text = `${hadith.text} — ${hadith.ref}`;
      try { await navigator.clipboard.writeText(text); alert('Hadith copied'); } catch { alert('Copy failed'); }
    };
  }
  if (shareHadithBtn) {
    shareHadithBtn.onclick = async () => {
      const title = `Hadith of the Day (${hadith.ref})`;
      if (navigator.share) {
        try { await navigator.share({ title, text: hadith.text }); } catch {}
      } else {
        try { await navigator.clipboard.writeText(`${title}\n${hadith.text}`); alert('Shared text copied'); } catch { alert('Share not supported'); }
      }
    };
  }
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

  const ensureSrc = () => {
    if (!audio.src) {
      const src = audio.getAttribute('data-src') || (audio.dataset ? audio.dataset.src : '') || '';
      if (src) { audio.src = src; audio.load(); }
    }
  };

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
    // Guard against play() being aborted by a quick pause() or source change
    let playPromise;
    try {
      toggleBtn.disabled = true;
      if (audio.paused) {
        ensureSrc();
        updateUi('Buffering…');
        playPromise = audio.play();
        try { await playPromise; } catch (err) {
          if (err && err.name === 'AbortError') {
            console.debug('Radio play aborted (pause or source change).');
            updateUi('Paused');
          } else if (err && (err.name === 'NotAllowedError' || err.name === 'SecurityError')) {
            console.warn('Playback requires user interaction or is blocked:', err);
            statusEl.textContent = 'Playback requires interaction';
          } else {
            console.error('Radio play error:', err);
            statusEl.textContent = 'Playback failed';
          }
        }
      } else {
        audio.pause();
      }
    } catch (err) {
      // AbortError is expected when play() is interrupted by pause() — don't treat as a fatal error
      if (err && err.name === 'AbortError') {
        console.debug('Radio play aborted (pause or source change).');
        // Keep UI consistent
        updateUi('Paused');
      } else if (err && (err.name === 'NotAllowedError' || err.name === 'SecurityError')) {
        // Autoplay restrictions or security policies
        console.warn('Playback requires user interaction or is blocked:', err);
        statusEl.textContent = 'Playback requires interaction';
      } else {
        console.error('Radio play error:', err);
        statusEl.textContent = 'Playback failed';
      }
    } finally {
      toggleBtn.disabled = false;
      // Only update if no pending play promise or after it settles
      updateUi();
    }
  });

  stopBtn.addEventListener('click', () => {
    try {
      audio.pause();
      audio.currentTime = 0;
      // Clear the src to gracefully abort any ongoing network request
      try { audio.src = ''; audio.load(); } catch {}
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
    if (audio.error) {
      console.error('Radio error:', audio.error);
      updateUi('Error loading stream');
    } else {
      // In many browsers, aborting a network request (e.g., pausing quickly after play)
      // can surface as a generic error without a MediaError. Treat this as a benign abort.
      console.debug('Radio request aborted or stopped:', e);
      updateUi('Paused');
    }
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
          // Admin notification
          add('_subject', 'New IMediaC Kids signup');
          add('_captcha', 'false');
          add('_template', 'table');
          add('username', user.username);
          add('parentEmail', user.email);
          add('madrasah', user.madrasah || '');
          add('age', typeof user.age === 'number' ? String(user.age) : '');
          add('signedUpAt', new Date().toLocaleString());
          add('points', String(user.points || 0));
          // Sender confirmation (FormSubmit auto-response requires an "email" field)
          add('email', user.email);
          add('_autoresponse', 'Thank you for signing up to IMediaC Kids! Your child has been registered successfully. If you did not expect this message, please contact support at imediackids.com/contact.');
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
    else quizNotice.textContent = 'Earn 1 point with today\'s quiz!';
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
      const pts = 1;
      addPoints(you.id, pts, 'daily-quiz');
      markPlayedDailyQuiz();
      alert(`You scored ${score}/${answers.length}. Points earned: ${pts}`);
      window.location.href = 'leaderboard.html';
    });
  }
}

function bindIslamicQuiz() {
  const app = document.getElementById('quizApp');
  if (!app) return; // only on islamic-quiz.html
  const you = currentUser();
  const setupMsg = document.getElementById('quizSetupMsg');
  if (setupMsg) {
    setupMsg.textContent = you ? 'Ready to earn points!' : 'Please log in or sign up to earn points.';
  }

  const QUIZ_BANK = {
    seerah: {
      easy: [
        { q: 'What is the name of the final Prophet?', a:'Prophet Muhammad (ﷺ)', b:'Prophet Musa (AS)', c:'Prophet Isa (AS)', correct:'a' },
        { q: 'Where was the Prophet (ﷺ) born?', a:'Makkah', b:'Madinah', c:'Taif', correct:'a' },
        { q: 'What is the Hijrah?', a:'Journey to Madinah', b:'Battle of Badr', c:'Farewell Sermon', correct:'a' },
        { q: 'Which tribe did the Prophet (ﷺ) belong to?', a:'Quraysh', b:'Aws', c:'Khazraj', correct:'a' },
        { q: 'The first revelation came in which month?', a:'Ramadan', b:'Muharram', c:'Dhul-Hijjah', correct:'a' }
      ],
      medium: [
        { q: 'Who raised the Prophet (ﷺ) after his mother passed away?', a:'Abu Talib', b:'Abdul Muttalib', c:'Abu Bakr', correct:'b' },
        { q: 'What is the first revelation chapter?', a:'Al-Fatiha', b:'Al-Alaq', c:'Al-Ikhlas', correct:'b' },
        { q: 'Which cave received the first revelation?', a:'Cave Hira', b:'Cave Thawr', c:'Cave Ashaab', correct:'a' },
        { q: 'The Hijrah occurred in which year?', a:'622 CE', b:'610 CE', c:'632 CE', correct:'a' },
        { q: 'Who was the first wife of the Prophet (ﷺ)?', a:'Khadijah (RA)', b:'Aisha (RA)', c:'Hafsa (RA)', correct:'a' }
      ],
      hard: [
        { q: 'Who was the wet nurse of the Prophet (ﷺ)?', a:'Halima Saadia', b:'Khadijah', c:'Amina', correct:'a' },
        { q: 'Year of the Elephant is approximately?', a:'570 CE', b:'610 CE', c:'632 CE', correct:'a' },
        { q: 'Which treaty occurred in 6 AH?', a:'Hudaybiyyah', b:'Taif', c:'Uhud', correct:'a' },
        { q: 'Who accompanied the Prophet (ﷺ) in the Hijrah?', a:'Abu Bakr (RA)', b:'Umar (RA)', c:'Ali (RA)', correct:'a' },
        { q: 'Which battle was in 2 AH?', a:'Badr', b:'Uhud', c:'Khandaq', correct:'a' }
      ]
    },
    hadith: {
      easy: [
        { q: 'Hadith are the sayings of?', a:'Prophet Muhammad (ﷺ)', b:'Sahabah', c:'Scholars', correct:'a' },
        { q: 'Which collection is famous?', a:'Bukhari', b:'Sunan Abu Dawud', c:'Tafsir ibn Kathir', correct:'a' },
        { q: 'Smiling is considered?', a:'Charity', b:'Sunnah prayer', c:'Fard', correct:'a' },
        { q: 'Greeting with Salam is:', a:'Sunnah', b:'Makruh', c:'Haram', correct:'a' },
        { q: 'Truthfulness is:', a:'Praised', b:'Disliked', c:'Neutral', correct:'a' }
      ],
      medium: [
        { q: 'The best among you are those who learn and teach?', a:'Hadith', b:'Quran', c:'Fiqh', correct:'b' },
        { q: 'Gentleness is loved by?', a:'Allah', b:'People', c:'Leaders', correct:'a' },
        { q: 'Strong believer is better than?', a:'Weak believer', b:'Non-believer', c:'Hypocrite', correct:'a' },
        { q: 'Backbiting is:', a:'Haram', b:'Mustahab', c:'Mubah', correct:'a' },
        { q: 'Keeping promises is:', a:'Part of good character', b:'Makruh', c:'Mubah', correct:'a' }
      ],
      hard: [
        { q: 'Which scholar authored Sahih Muslim?', a:'Imam Muslim', b:'Imam Nawawi', c:'Imam Malik', correct:'a' },
        { q: 'Hadith grading includes:', a:'Sahih/Daif', b:'Haq/Van', c:'Halal/Haram', correct:'a' },
        { q: 'Narrations are transmitted via:', a:'Isnad', b:'Ijazah', c:'Madhhab', correct:'a' },
        { q: 'Sahih Bukhari compiler:', a:'Imam al-Bukhari', b:'Imam Ahmad', c:'Imam Abu Hanifa', correct:'a' },
        { q: 'Number of Hadith in Arbaeen Nawawi:', a:'40', b:'50', c:'30', correct:'a' }
      ]
    },
    fiqh: {
      easy: [
        { q: 'How many daily prayers?', a:'5', b:'3', c:'7', correct:'a' },
        { q: 'Zakat is:', a:'Charity', b:'Tax', c:'Loan', correct:'a' },
        { q: 'Wudu is:', a:'Ablution', b:'Fasting', c:'Pilgrimage', correct:'a' },
        { q: 'Qiblah is towards:', a:'Kaaba', b:'Jerusalem', c:'Madinah', correct:'a' },
        { q: 'Tayammum uses:', a:'Clean earth', b:'Perfume', c:'Oil', correct:'a' }
      ],
      medium: [
        { q: 'Sawm refers to:', a:'Fasting', b:'Prayer', c:'Charity', correct:'a' },
        { q: 'Shortening prayer when travelling is:', a:'Permissible', b:'Forbidden', c:'Mandatory', correct:'a' },
        { q: 'Major ablution is called:', a:'Ghusl', b:'Wudu', c:'Tawaf', correct:'a' },
        { q: 'Witr prayer is offered:', a:'Odd units', b:'Even units', c:'Long units', correct:'a' },
        { q: 'Conditions of Salah include:', a:'Purity', b:'Noise', c:'Speed', correct:'a' }
      ],
      hard: [
        { q: 'Rukn of Salah includes:', a:'Sujood', b:'Taslim', c:'Dua', correct:'a' },
        { q: 'Madhahib include:', a:'Hanafi', b:'Ashari', c:'Mu’tazili', correct:'a' },
        { q: 'Zakat due is typically:', a:'2.5% of eligible wealth', b:'10%', c:'1%', correct:'a' },
        { q: 'Minimum nisab relates to:', a:'Threshold for Zakat', b:'Prayer time', c:'Fasting length', correct:'a' },
        { q: 'Sujood ash-shukr is:', a:'Prostration of gratitude', b:'Friday prostration', c:'Funeral prostration', correct:'a' }
      ]
    },
    akhlaq: {
      easy: [
        { q: 'Truthfulness is a:', a:'Good character', b:'Fiqh rule', c:'Story', correct:'a' },
        { q: 'Helping others is:', a:'Rewarded', b:'Forbidden', c:'Makruh', correct:'a' },
        { q: 'Respecting parents is:', a:'Obligatory', b:'Optional', c:'Disliked', correct:'a' },
        { q: 'Generosity is:', a:'Praised', b:'Neutral', c:'Blameworthy', correct:'a' },
        { q: 'Arrogance is:', a:'Blameworthy', b:'Praised', c:'Neutral', correct:'a' }
      ],
      medium: [
        { q: 'Backbiting is:', a:'Haram', b:'Mustahab', c:'Mubah', correct:'a' },
        { q: 'Keeping promises is:', a:'Sunnah of good character', b:'Makruh', c:'Mubah', correct:'a' },
        { q: 'Patience is:', a:'Beloved to Allah', b:'Disliked', c:'Forbidden', correct:'a' },
        { q: 'Humility is:', a:'Praised', b:'Blameworthy', c:'Neutral', correct:'a' },
        { q: 'Kind speech is:', a:'Rewarded', b:'Forbidden', c:'Makruh', correct:'a' }
      ],
      hard: [
        { q: 'Ihsan means:', a:'Excellence', b:'Charity', c:'Prayer', correct:'a' },
        { q: 'Forgiving others is:', a:'Rewarded', b:'Punished', c:'Neutral', correct:'a' },
        { q: 'Good neighborliness is:', a:'Praised', b:'Forbidden', c:'Neutral', correct:'a' },
        { q: 'Gratitude is expressed by:', a:'Alhamdulillah', b:'SubhanAllah', c:'Allahu Akbar', correct:'a' },
        { q: 'Trustworthiness is:', a:'Praised', b:'Disliked', c:'Neutral', correct:'a' }
      ]
    },
    adaab: {
      easy: [
        { q: 'Saying Bismillah before eating is:', a:'Sunnah', b:'Fard', c:'Makruh', correct:'a' },
        { q: 'Sneezing response:', a:'Yarhamuk Allah', b:'Jazak Allah', c:'Subhan Allah', correct:'a' },
        { q: 'Enter with left or right foot?', a:'Right foot for mosque', b:'Left foot for mosque', c:'Any', correct:'a' },
        { q: 'Eat with:', a:'Right hand', b:'Left hand', c:'Either', correct:'a' },
        { q: 'Knock before entering:', a:'Yes', b:'No', c:'Only at night', correct:'a' }
      ],
      medium: [
        { q: 'Etiquettes of speech include:', a:'Truthfulness', b:'Loudness', c:'Interrupting', correct:'a' },
        { q: 'Visiting the sick is:', a:'Recommended', b:'Forbidden', c:'Neutral', correct:'a' },
        { q: 'Respect for elders is:', a:'Islamic etiquette', b:'Optional', c:'Disliked', correct:'a' },
        { q: 'Covering mouth when yawning is:', a:'Recommended', b:'Forbidden', c:'Mandatory', correct:'a' },
        { q: 'Saying Salam first is:', a:'Sunnah', b:'Makruh', c:'Haram', correct:'a' }
      ],
      hard: [
        { q: 'Etiquettes of gatherings include:', a:'Not interrupting', b:'Speaking loudly', c:'Mocking others', correct:'a' },
        { q: 'Lowering the gaze is:', a:'Recommended and rewarding', b:'Forbidden', c:'Mandatory every second', correct:'a' },
        { q: 'Visiting relatives is:', a:'Recommended', b:'Disliked', c:'Neutral', correct:'a' },
        { q: 'Giving salam to children is:', a:'Sunnah', b:'Makruh', c:'Haram', correct:'a' },
        { q: 'Bismillah before tasks is:', a:'Recommended', b:'Forbidden', c:'Mandatory', correct:'a' }
      ]
    },
    duas: {
      easy: [
        { q: 'Before starting a task say:', a:'Bismillah', b:'Alhamdulillah', c:'Allahu Akbar', correct:'a' },
        { q: 'After eating say:', a:'Alhamdulillah', b:'SubhanAllah', c:'Astaghfirullah', correct:'a' },
        { q: 'When seeking forgiveness:', a:'Astaghfirullah', b:'Bismillah', c:'Ameen', correct:'a' },
        { q: 'Dua for knowledge:', a:'Rabbi zidni ilma', b:'Rabbana atina', c:'Rabbi hab li', correct:'a' },
        { q: 'Dua for guidance:', a:'Ihdinas siratal mustaqeem', b:'La ilaha illallah', c:'Allahu Akbar', correct:'a' }
      ],
      medium: [
        { q: 'Dua before sleep includes:', a:'Bismika Allahumma amutu wa ahya', b:'Allahu Akbar', c:'La hawla', correct:'a' },
        { q: 'Dua of Yunus (AS):', a:'La ilaha illa anta subhanaka inni kuntu minaz zalimeen', b:'Rabbana zalamna', c:'Rabbighfir li', correct:'a' },
        { q: 'Dua of Musa (AS):', a:'Rabbishrah li sadri', b:'Rabbi zidni ilma', c:'Rabbana atina', correct:'a' },
        { q: 'Dua for parents:', a:'Rabbir hamhuma kama rabbayani saghira', b:'Rabbana atina', c:'Rabbi hab li', correct:'a' },
        { q: 'Dua when entering home:', a:'Bismillah and Salam', b:'SubhanAllah', c:'Takbeer', correct:'a' }
      ],
      hard: [
        { q: 'Dua in sujood often includes:', a:'Subhana Rabbiyal A’la', b:'Subhana Rabbiyal Azeem', c:'Alhamdulillah', correct:'a' },
        { q: 'Dua for steadfastness:', a:'Thabbit qulubana', b:'Rabbi zidni', c:'Allahu Akbar', correct:'a' },
        { q: 'Dua for entering mosque:', a:'Allahumma iftah li abwaba rahmatik', b:'Allahumma barik lana', c:'Allahumma aghnina', correct:'a' },
        { q: 'Dua when distressed:', a:'La hawla wa la quwwata illa billah', b:'Bismillah', c:'SubhanAllah', correct:'a' },
        { q: 'Dua after Adhan includes:', a:'Allahumma Rabba hadhihid-da’watit-taammah...', b:'Rabbana atina', c:'Rabbi zidni', correct:'a' }
      ]
    }
  };

  const topicEl = document.getElementById('quizTopic');
  const diffEl = document.getElementById('quizDifficulty');
  const startBtn = document.getElementById('quizStartBtn');
  const setup = document.getElementById('quizSetup');
  const play = document.getElementById('quizPlay');
  const result = document.getElementById('quizResult');
  const qTitle = document.getElementById('quizTitle');
  const qLevel = document.getElementById('quizLevel');
  const qIndex = document.getElementById('quizIndex');
  const qTotal = document.getElementById('quizTotal');
  const qContainer = document.getElementById('quizQuestion');
  const submitBtn = document.getElementById('quizSubmitBtn');
  const nextBtn = document.getElementById('quizNextBtn');
  const feedback = document.getElementById('quizFeedback');
  const scoreEl = document.getElementById('quizScore');
  const outOfEl = document.getElementById('quizOutOf');
  const pointsEl = document.getElementById('quizPoints');
  const restartBtn = document.getElementById('quizRestartBtn');

  let questions = [];
  let idx = 0;
  let score = 0;

  function renderQuestion() {
    const q = questions[idx];
    qIndex.textContent = String(idx + 1);
    qTotal.textContent = String(questions.length);
    feedback.textContent = '';
    nextBtn.classList.add('hidden');
    submitBtn.disabled = false;
    const opts = [ ['a', q.a], ['b', q.b], ['c', q.c] ];
    if (q.d) opts.push(['d', q.d]);
    qContainer.innerHTML = `
      <div>
        <label><strong>${q.q}</strong></label>
        <div>
          ${opts.map(([key, val]) => `
            <label style="display:block;margin:6px 0;">
              <input type="radio" name="quizAnswer" value="${key}"> ${val}
            </label>
          `).join('')}
        </div>
      </div>
    `;
  }

  startBtn.addEventListener('click', () => {
    const topic = topicEl.value;
    const diff = diffEl.value;
    const youNow = currentUser();
    if (!youNow) {
      alert('Please log in to earn points.');
      return;
    }
    const bank = QUIZ_BANK[topic]?.[diff] || [];
    questions = bank.slice(0, 5);
    if (questions.length === 0) { alert('No questions available for this selection yet.'); return; }
    idx = 0; score = 0;
    qTitle.textContent = topic.charAt(0).toUpperCase() + topic.slice(1);
    qLevel.textContent = diff.charAt(0).toUpperCase() + diff.slice(1);
    setup.classList.add('hidden');
    result.classList.add('hidden');
    play.classList.remove('hidden');
    renderQuestion();
  });

  submitBtn.addEventListener('click', () => {
    const sel = document.querySelector('input[name="quizAnswer"]:checked');
    if (!sel) { alert('Please choose an answer.'); return; }
    const chosen = sel.value;
    const correct = questions[idx].correct;
    const ok = chosen === correct;
    score += ok ? 1 : 0;
    feedback.textContent = ok ? '✅ Correct!' : '❌ Not quite, keep going!';
    submitBtn.disabled = true;
    nextBtn.classList.remove('hidden');
  });

  nextBtn.addEventListener('click', () => {
    idx++;
    if (idx >= questions.length) {
      const youNow = currentUser();
      const pts = 1;
      if (youNow) addPoints(youNow.id, pts, 'islamic-quiz');
      scoreEl.textContent = String(score);
      outOfEl.textContent = String(questions.length);
      pointsEl.textContent = String(pts);
      play.classList.add('hidden');
      result.classList.remove('hidden');
    } else {
      renderQuestion();
    }
  });

  restartBtn.addEventListener('click', () => {
    result.classList.add('hidden');
    setup.classList.remove('hidden');
  });
}

// Stories helpers
function bindStoryReadButtons() {
  // Points removed for stories: this hook is now a no-op
  // If any legacy elements remain, show a friendly message without points.
  document.querySelectorAll('[data-award-story]').forEach(btn => {
    btn.addEventListener('click', () => {
      alert('Enjoy reading! Points are not awarded for stories.');
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

  // Use local SVG assets (CORS-safe and fast) — feature-focused slides
  const SLIDES = [
    // Makkah — Kaaba
    { title: 'Quran with Translation', desc: 'Read and listen verse-by-verse in multiple languages.', href: 'quran.html', cta: 'Explore Now', img: 'https://commons.wikimedia.org/wiki/Special:FilePath/Kaaba%204.JPG' },
    // Madinah — Green Dome
    { title: 'Complete Hadith Books', desc: 'Authentic collections with easy navigation.', href: 'learn.html', cta: 'Learn More', img: 'https://commons.wikimedia.org/wiki/Special:FilePath/The%20Green%20Dome,%20Masjid%20Nabawi,%20Madina.jpg' },
    // Nature — Sahara Desert dunes
    { title: 'Podcasts & Nasheeds', desc: 'Inspiring audio content for all ages.', href: 'stories.html', cta: 'Listen', img: 'https://commons.wikimedia.org/wiki/Special:FilePath/Algeria%20Sahara%20Desert%20Photo%20From%20Drone%205.jpg' },
    // Kids — keep nature theme with desert dunes (reused) or swap to local pattern as fallback
    { title: 'Kids Zone', desc: 'Games, quizzes, and learning challenges.', href: 'games.html', cta: 'Play Now', img: 'https://commons.wikimedia.org/wiki/Special:FilePath/Western%20Sahara%20desert%201.jpg' },
    // Blog — Makkah at night or keep pattern; using Kaaba category image as thematic
    { title: 'Islamic Blog & Articles', desc: 'Latest posts from IMediaC.com.', href: '#latestArticles', cta: 'Read More', img: 'https://commons.wikimedia.org/wiki/Special:FilePath/Mecca%202012.jpg' },
  ];

  slidesEl.innerHTML = '';
  dotsEl.innerHTML = '';
  SLIDES.forEach((s, i) => {
    const slide = document.createElement('div');
    slide.className = 'slide';
    slide.style.backgroundImage = `url(${s.img})`;
    slide.innerHTML = s.quote
      ? `<div class="slide-content"><h3>“${s.quote}”</h3><p>— ${s.ref}</p></div>`
      : `<div class="slide-content"><h3>${s.title}</h3><p>${s.desc}</p><a class="btn btn-secondary" href="${s.href}">${s.cta || 'Explore Now'}</a></div>`;
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
  enableMobileMenu();
  // Enable basic hooks depending on page elements present
  bindAuthForm();
  bindQuiz();
  bindIslamicQuiz();
  bindStoryReadButtons();
  renderLeaderboard();
  bindContactForm();
  renderDailyContent();
  renderProfileBox();
  renderHomeSlider();
  bindRadioPlayer();
  bindQuranPage();
  initPrayerTimes();
  bindMiniPlayer();
  // Initialize newsletter modal only if present
  if (document.getElementById('newsletterModal')) {
    initNewsletterModal();
  }
  initScrollTop();
});

// Mobile menu toggle
function enableMobileMenu() {
  const header = document.querySelector('.site-header .header-inner');
  const nav = header ? header.querySelector('.nav') : null;
  if (!header || !nav) return;
  if (header.querySelector('.menu-toggle')) return; // already added

  const btn = document.createElement('button');
  btn.className = 'menu-toggle';
  btn.setAttribute('aria-label', 'Toggle menu');
  btn.setAttribute('aria-expanded', 'false');
  btn.type = 'button';
  btn.innerHTML = '☰ Menu';
  header.insertBefore(btn, nav);

  btn.addEventListener('click', () => {
    const open = document.body.classList.toggle('menu-open');
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  });

  // Close menu on link click (mobile UX)
  nav.querySelectorAll('a.nav-link').forEach(a => {
    a.addEventListener('click', () => {
      if (document.body.classList.contains('menu-open')) {
        document.body.classList.remove('menu-open');
        btn.setAttribute('aria-expanded', 'false');
      }
    });
  });

  // Ensure menu closes when resizing to desktop
  window.addEventListener('resize', () => {
    if (window.innerWidth > 768 && document.body.classList.contains('menu-open')) {
      document.body.classList.remove('menu-open');
      btn.setAttribute('aria-expanded', 'false');
    }
  });
}

// Prayer times via Aladhan API
async function initPrayerTimes() {
  const grid = document.getElementById('prayerGrid');
  const status = document.getElementById('prayerStatus');
  const nextNameEl = document.getElementById('nextPrayerName');
  const nextCountdownEl = document.getElementById('nextPrayerCountdown');
  const monthlyLink = document.getElementById('prayerMonthlyLink');
  const refreshBtn = document.getElementById('prayerRefresh');
  const citySelect = document.getElementById('prayerCity');
  const methodSelect = document.getElementById('prayerMethod');
  const schoolSelect = document.getElementById('prayerSchool');
  if (!grid || !status) return;
  let timings = null;
  let tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const CITY_MAP = {
    London: { lat: 51.5074, lon: -0.1278 },
    Birmingham: { lat: 52.4862, lon: -1.8904 },
    Manchester: { lat: 53.4808, lon: -2.2426 },
    Leeds: { lat: 53.7997, lon: -1.5492 },
    Bradford: { lat: 53.7939, lon: -1.7521 },
    Glasgow: { lat: 55.8642, lon: -4.2518 },
    Luton: { lat: 51.8787, lon: -0.42 }
  };
  let selectedCity = localStorage.getItem('IMK_PRAYER_CITY') || 'London';
  let loc = CITY_MAP[selectedCity] || CITY_MAP['London'];
  let methodId = parseInt(localStorage.getItem('IMK_PRAYER_METHOD') || '3', 10); // default MWL
  let schoolId = parseInt(localStorage.getItem('IMK_PRAYER_SCHOOL') || '2', 10); // default Hanafi for UK
  const latAdj = 3; // AngleBased for high latitudes like UK
  if (citySelect) {
    // initialize select value
    citySelect.value = selectedCity in CITY_MAP ? selectedCity : 'London';
    citySelect.addEventListener('change', () => {
      selectedCity = citySelect.value;
      localStorage.setItem('IMK_PRAYER_CITY', selectedCity);
      loc = CITY_MAP[selectedCity] || CITY_MAP['London'];
      fetchTimings();
    });
  }
  if (methodSelect) {
    methodSelect.value = String(methodId);
    methodSelect.addEventListener('change', () => {
      methodId = parseInt(methodSelect.value, 10) || 3;
      localStorage.setItem('IMK_PRAYER_METHOD', String(methodId));
      fetchTimings();
    });
  }
  if (schoolSelect) {
    schoolSelect.value = String(schoolId);
    schoolSelect.addEventListener('change', () => {
      schoolId = parseInt(schoolSelect.value, 10) || 2;
      localStorage.setItem('IMK_PRAYER_SCHOOL', String(schoolId));
      fetchTimings();
    });
  }
  function renderTimings() {
    if (!timings) return;
    const names = ['Fajr','Dhuhr','Asr','Maghrib','Isha'];
    grid.innerHTML = names.map(n => {
      const t = timings[n];
      return `<div class="prayer-item"><div class="prayer-name">${n}</div><div class="prayer-time">${t}</div></div>`;
    }).join('');
    // Do not imply geolocation-based accuracy; we no longer request location permission
    status.textContent = `Prayer times for ${selectedCity} (${tz})`;
    if (monthlyLink) monthlyLink.href = `https://api.aladhan.com/v1/calendar?latitude=${loc.lat}&longitude=${loc.lon}&method=${methodId}&school=${schoolId}&latitudeAdjustmentMethod=${latAdj}`;
    updateNextCountdown();
  }
  function parseTimeToDate(t) {
    const [h,m] = String(t).split(':').map(x=>parseInt(x,10));
    const d = new Date(); d.setHours(h||0,m||0,0,0); return d;
  }
  function updateNextCountdown() {
    if (!timings || !nextNameEl || !nextCountdownEl) return;
    const now = new Date();
    const order = ['Fajr','Dhuhr','Asr','Maghrib','Isha'];
    let nextName = null; let nextTime = null;
    for (const n of order) {
      const tStr = timings[n]; const tDate = parseTimeToDate(tStr);
      if (tDate > now) { nextName = n; nextTime = tDate; break; }
    }
    if (!nextName) { nextName = 'Fajr'; const tDate = parseTimeToDate(timings['Fajr']); tDate.setDate(tDate.getDate()+1); nextTime = tDate; }
    nextNameEl.textContent = nextName;
    const diff = Math.max(0, nextTime - now);
    const hh = String(Math.floor(diff/3600000)).padStart(2,'0');
    const mm = String(Math.floor((diff%3600000)/60000)).padStart(2,'0');
    const ss = String(Math.floor((diff%60000)/1000)).padStart(2,'0');
    nextCountdownEl.textContent = `${hh}:${mm}:${ss}`;
  }
  let countdownTimer = null; function startCountdown(){ if (countdownTimer) clearInterval(countdownTimer); countdownTimer = setInterval(updateNextCountdown, 1000); }
  async function fetchTimings() {
    status.textContent = 'Fetching prayer times…';
    try {
      const url = `https://api.aladhan.com/v1/timings?latitude=${loc.lat}&longitude=${loc.lon}&method=${methodId}&school=${schoolId}&latitudeAdjustmentMethod=${latAdj}`;
      const res = await fetch(url, { mode: 'cors' });
      const data = await res.json();
      timings = data && data.data && data.data.timings ? data.data.timings : null;
      tz = (data && data.data && data.data.meta && data.data.meta.timezone) || tz;
      renderTimings(); startCountdown();
    } catch (e) {
      console.error('Prayer times error', e);
      // Fallback to city-based endpoint if lat/lon fetch fails
      try {
        status.textContent = 'Retrying…';
        const url2 = `https://api.aladhan.com/v1/timingsByCity?city=${encodeURIComponent(selectedCity)}&country=United%20Kingdom&method=${methodId}&school=${schoolId}&latitudeAdjustmentMethod=${latAdj}`;
        const res2 = await fetch(url2, { mode: 'cors' });
        const data2 = await res2.json();
        timings = data2 && data2.data && data2.data.timings ? data2.data.timings : null;
        tz = (data2 && data2.data && data2.data.meta && data2.data.meta.timezone) || tz;
        renderTimings(); startCountdown();
      } catch (e2) {
        console.error('Prayer times city fallback error', e2);
        status.textContent = 'Failed to load prayer times';
      }
    }
  }
  // Remove geolocation permission request; always use default location (London) unless overridden elsewhere
  function geolocate(){ fetchTimings(); }
  refreshBtn && refreshBtn.addEventListener('click', fetchTimings);
  geolocate();
}

// Floating mini player (reuses #radioPlayer)
function bindMiniPlayer(){
  const mini = document.getElementById('miniPlayer');
  const playBtn = document.getElementById('miniPlayBtn');
  const closeBtn = document.getElementById('miniCloseBtn');
  const audio = document.getElementById('radioPlayer');
  if (!mini || !playBtn || !closeBtn || !audio) return;
  mini.style.display = 'flex';
  function update(){ const playing = !audio.paused && !audio.ended; playBtn.textContent = playing ? '⏸' : '▶'; }
  playBtn.addEventListener('click', async ()=>{
    try {
      playBtn.disabled = true;
      if (audio.paused) {
        if (!audio.src) { const src = audio.getAttribute('data-src') || (audio.dataset ? audio.dataset.src : '') || ''; if (src) { audio.src = src; audio.load(); } }
        try { await audio.play(); } catch (err) {
          if (err && err.name === 'AbortError') {
            console.debug('Mini player play aborted');
          } else if (err && (err.name === 'NotAllowedError' || err.name === 'SecurityError')) {
            console.warn('Playback requires interaction or is blocked');
          } else {
            console.error('Mini player play error:', err);
          }
        }
      } else {
        audio.pause();
      }
    } finally {
      playBtn.disabled = false;
      update();
    }
  });
  closeBtn.addEventListener('click', ()=>{ mini.style.display='none'; });
  audio.addEventListener('play', update); audio.addEventListener('pause', update); audio.addEventListener('ended', update);
  update();
}

// Language/Theme toggles removed per request

// Newsletter modal
function initNewsletterModal(){
  const modal = document.getElementById('newsletterModal');
  const backdrop = document.getElementById('newsletterBackdrop');
  const closeBtn = document.getElementById('newsletterClose');
  const form = document.getElementById('newsletterForm');
  const email = document.getElementById('newsletterEmail');
  const msg = document.getElementById('newsletterMsg');
  if (!modal || !backdrop || !closeBtn || !form || !email) return;
  const SEEN_KEY = 'IMK_NEWSLETTER_SEEN';
  const seen = localStorage.getItem(SEEN_KEY);
  function open(){ modal.style.display='block'; modal.setAttribute('aria-hidden','false'); }
  function close(){ modal.style.display='none'; modal.setAttribute('aria-hidden','true'); }
  if (!seen) { setTimeout(open, 12000); }
  backdrop.addEventListener('click', close); closeBtn.addEventListener('click', close);
  form.addEventListener('submit', (e)=>{
    e.preventDefault(); const val = String(email.value||'').trim();
    const ok = /.+@.+\..+/.test(val);
    if (!ok) { msg.textContent = 'Please enter a valid email.'; return; }
    msg.textContent = 'Thank you! We will keep you updated.'; localStorage.setItem(SEEN_KEY,'1'); setTimeout(close, 1500);
  });
}

// Scroll-to-top button
function initScrollTop(){
  const btn = document.getElementById('scrollTopBtn'); if (!btn) return;
  window.addEventListener('scroll', ()=>{ const show = window.scrollY > 300; btn.classList.toggle('show', show); });
  btn.addEventListener('click', ()=>{ window.scrollTo({ top:0, behavior:'smooth' }); });
}

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
