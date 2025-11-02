const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs').promises;

const DB_PATH = process.env.DB_PATH || './data/imediackids.db';

async function initDatabase() {
  try {
    // Ensure data directory exists
    const dataDir = path.dirname(DB_PATH);
    await fs.mkdir(dataDir, { recursive: true });

    return new Promise((resolve, reject) => {
      const db = new sqlite3.Database(DB_PATH, (err) => {
        if (err) {
          console.error('Error opening database:', err);
          reject(err);
          return;
        }
        console.log('Connected to SQLite database');
      });

      // Create tables
      db.serialize(() => {
        // Users table (for kids)
        db.run(`
          CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            email TEXT NOT NULL,
            password TEXT NOT NULL,
            madrasah TEXT,
            age INTEGER,
            points INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);

        // Points log table
        db.run(`
          CREATE TABLE IF NOT EXISTS points_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            points INTEGER NOT NULL,
            reason TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id)
          )
        `);

        // Content table (for dynamic content management)
        db.run(`
          CREATE TABLE IF NOT EXISTS content (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            type TEXT NOT NULL, -- 'ayah', 'hadith', 'dua', 'story', 'quiz'
            title TEXT,
            content_ar TEXT,
            content_en TEXT,
            reference TEXT,
            category TEXT,
            image_url TEXT,
            is_active BOOLEAN DEFAULT 1,
            sort_order INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);

        // Attempt to add new columns for existing databases (ignore error if exists)
        db.run(`ALTER TABLE content ADD COLUMN image_url TEXT`, (err) => {
          // Ignore duplicate column errors; this ensures backward compatibility
        });

        // Games table (for game configuration)
        db.run(`
          CREATE TABLE IF NOT EXISTS games (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            title TEXT NOT NULL,
            description TEXT,
            file_path TEXT NOT NULL,
            points_reward INTEGER DEFAULT 10,
            is_active BOOLEAN DEFAULT 1,
            category TEXT,
            difficulty TEXT,
            sort_order INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);

        // Quiz questions table
        db.run(`
          CREATE TABLE IF NOT EXISTS quiz_questions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            question TEXT NOT NULL,
            option_a TEXT NOT NULL,
            option_b TEXT NOT NULL,
            option_c TEXT NOT NULL,
            option_d TEXT,
            correct_answer TEXT NOT NULL,
            category TEXT,
            difficulty TEXT DEFAULT 'medium',
            points INTEGER DEFAULT 10,
            is_active BOOLEAN DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);

        // Settings table (for site configuration)
        db.run(`
          CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            description TEXT,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);

        // Insert default content
        insertDefaultContent(db);
      });

      db.close((err) => {
        if (err) {
          console.error('Error closing database:', err);
          reject(err);
        } else {
          console.log('Database initialization completed');
          resolve();
        }
      });
    });
  } catch (error) {
    console.error('Database initialization failed:', error);
    throw error;
  }
}

function insertDefaultContent(db) {
  // Insert default Ayat
  const ayat = [
    { ar: 'فَاذْكُرُونِي أَذْكُرْكُمْ', en: 'So remember Me; I will remember you.', ref: 'Quran 2:152' },
    { ar: 'إِنَّ اللّهَ مَعَ الصَّابِرِينَ', en: 'Indeed, Allah is with the patient.', ref: 'Quran 2:153' },
    { ar: 'وَرَبُّكَ الْغَفُورُ ذُو الرَّحْمَةِ', en: 'Your Lord is the Forgiving, full of mercy.', ref: 'Quran 18:58' },
    { ar: 'إِنَّ مَعَ الْعُسْرِ يُسْرًا', en: 'Indeed, with hardship comes ease.', ref: 'Quran 94:6' },
    { ar: 'اللّهُ نُورُ السَّمَاوَاتِ وَالْأَرْضِ', en: 'Allah is the Light of the heavens and the earth.', ref: 'Quran 24:35' }
  ];

  ayat.forEach((ayah, index) => {
    db.run(`
      INSERT OR IGNORE INTO content (type, content_ar, content_en, reference, sort_order)
      VALUES ('ayah', ?, ?, ?, ?)
    `, [ayah.ar, ayah.en, ayah.ref, index]);
  });

  // Insert default Hadith
  const hadith = [
    { text: 'The strong believer is better and more beloved to Allah than the weak believer.', ref: 'Muslim' },
    { text: 'The best among you are those who learn the Quran and teach it.', ref: 'Bukhari' },
    { text: 'He is not a believer whose stomach is filled while the neighbor to his side goes hungry.', ref: 'Bukhari' },
    { text: 'Smiling in the face of your brother is charity.', ref: 'Tirmidhi' },
    { text: 'Allah is gentle and loves gentleness in all matters.', ref: 'Bukhari' }
  ];

  hadith.forEach((h, index) => {
    db.run(`
      INSERT OR IGNORE INTO content (type, content_en, reference, sort_order)
      VALUES ('hadith', ?, ?, ?)
    `, [h.text, h.ref, index]);
  });

  // Insert default Duas
  const duas = [
    { ar: 'رَبِّ زِدْنِي عِلْمًا', en: 'My Lord, increase me in knowledge.', ref: 'Quran 20:114' },
    { ar: 'رَبَّنَا آتِنَا فِي الدُّنْيَا حَسَنَةً', en: 'Our Lord, give us in this world good...', ref: 'Quran 2:201' },
    { ar: 'اللهم اغفر لي', en: 'O Allah, forgive me.', ref: 'General' },
    { ar: 'اللهم اشفِ مرضانا', en: 'O Allah, heal our sick.', ref: 'General' },
    { ar: 'اللهم ارزقنا الجنة', en: 'O Allah, grant us Paradise.', ref: 'General' }
  ];

  duas.forEach((dua, index) => {
    db.run(`
      INSERT OR IGNORE INTO content (type, content_ar, content_en, reference, sort_order)
      VALUES ('dua', ?, ?, ?, ?)
    `, [dua.ar, dua.en, dua.ref, index]);
  });

  // Insert default settings
  const settings = [
    { key: 'site_title', value: 'IMediaC Kids', description: 'Website title' },
    { key: 'site_description', value: 'Islamic values, Quran, hadith, duas, stories, games and quizzes for children.', description: 'Website description' },
    { key: 'points_per_quiz', value: '10', description: 'Points awarded per correct quiz answer' },
    { key: 'signup_bonus', value: '20', description: 'Bonus points for new signups' },
    { key: 'story_read_points', value: '5', description: 'Points for reading a story' }
  ];

  settings.forEach(setting => {
    db.run(`
      INSERT OR IGNORE INTO settings (key, value, description)
      VALUES (?, ?, ?)
    `, [setting.key, setting.value, setting.description]);
  });
}

module.exports = { initDatabase };
