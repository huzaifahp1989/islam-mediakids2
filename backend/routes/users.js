const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { authenticateToken, requireAdmin, generateToken } = require('../middleware/auth');
const router = express.Router();

const DB_PATH = process.env.DB_PATH || './data/imediackids.db';

// User registration (public endpoint)
router.post('/register', async (req, res) => {
  try {
    const { username, email, password, madrasah, age } = req.body;
    
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, and password are required' });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = uuidv4();
    const signupBonus = parseInt(process.env.SIGNUP_BONUS) || 20;
    
    const db = new sqlite3.Database(DB_PATH);
    
    db.run(
      `INSERT INTO users (id, username, email, password, madrasah, age, points)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userId, username, email, hashedPassword, madrasah || null, age || null, signupBonus],
      function(err) {
        if (err) {
          if (err.message.includes('UNIQUE constraint failed')) {
            res.status(400).json({ error: 'Username already exists' });
          } else {
            console.error('Registration error:', err);
            res.status(500).json({ error: 'Registration failed' });
          }
        } else {
          // Log signup bonus points
          db.run(
            `INSERT INTO points_log (user_id, points, reason)
             VALUES (?, ?, ?)`,
            [userId, signupBonus, 'Signup bonus'],
            (logErr) => {
              if (logErr) console.error('Points log error:', logErr);
            }
          );
          
          res.json({
            success: true,
            message: 'Registration successful',
            user: {
              id: userId,
              username,
              email,
              points: signupBonus
            }
          });
        }
        db.close();
      }
    );
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// User login (public endpoint)
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }
  
  const db = new sqlite3.Database(DB_PATH);
  
  db.get(
    'SELECT * FROM users WHERE username = ?',
    [username],
    async (err, user) => {
      if (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Login failed' });
      } else if (!user) {
        res.status(401).json({ error: 'Invalid credentials' });
      } else {
        try {
          const validPassword = await bcrypt.compare(password, user.password);
          if (validPassword) {
            const token = generateToken({
              id: user.id,
              username: user.username,
              role: 'user'
            });
            
            res.json({
              success: true,
              token,
              user: {
                id: user.id,
                username: user.username,
                email: user.email,
                points: user.points,
                madrasah: user.madrasah,
                age: user.age
              }
            });
          } else {
            res.status(401).json({ error: 'Invalid credentials' });
          }
        } catch (bcryptError) {
          console.error('Password comparison error:', bcryptError);
          res.status(500).json({ error: 'Login failed' });
        }
      }
      db.close();
    }
  );
});

// Get user profile (authenticated)
router.get('/profile', authenticateToken, (req, res) => {
  const db = new sqlite3.Database(DB_PATH);
  
  db.get(
    'SELECT id, username, email, madrasah, age, points, created_at FROM users WHERE id = ?',
    [req.user.id],
    (err, user) => {
      if (err) {
        console.error('Profile fetch error:', err);
        res.status(500).json({ error: 'Failed to fetch profile' });
      } else if (!user) {
        res.status(404).json({ error: 'User not found' });
      } else {
        res.json(user);
      }
      db.close();
    }
  );
});

// Update user points (authenticated)
router.post('/points', authenticateToken, (req, res) => {
  const { points, reason } = req.body;
  
  if (!points || !reason) {
    return res.status(400).json({ error: 'Points and reason are required' });
  }
  
  const db = new sqlite3.Database(DB_PATH);
  
  db.serialize(() => {
    // Update user points
    db.run(
      'UPDATE users SET points = points + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [points, req.user.id],
      function(err) {
        if (err) {
          console.error('Points update error:', err);
          res.status(500).json({ error: 'Failed to update points' });
          db.close();
          return;
        }
      }
    );
    
    // Log points transaction
    db.run(
      'INSERT INTO points_log (user_id, points, reason) VALUES (?, ?, ?)',
      [req.user.id, points, reason],
      function(err) {
        if (err) {
          console.error('Points log error:', err);
        }
      }
    );
    
    // Get updated user points
    db.get(
      'SELECT points FROM users WHERE id = ?',
      [req.user.id],
      (err, user) => {
        if (err) {
          console.error('Points fetch error:', err);
          res.status(500).json({ error: 'Failed to fetch updated points' });
        } else {
          res.json({
            success: true,
            points: user.points,
            message: `${points} points added for ${reason}`
          });
        }
        db.close();
      }
    );
  });
});

// Admin endpoints

// Get all users (admin only)
router.get('/admin/all', authenticateToken, requireAdmin, (req, res) => {
  const db = new sqlite3.Database(DB_PATH);
  
  db.all(
    'SELECT id, username, email, madrasah, age, points, created_at FROM users ORDER BY created_at DESC',
    (err, users) => {
      if (err) {
        console.error('Users fetch error:', err);
        res.status(500).json({ error: 'Failed to fetch users' });
      } else {
        res.json(users);
      }
      db.close();
    }
  );
});

// Get user points history (admin only)
router.get('/admin/:userId/points', authenticateToken, requireAdmin, (req, res) => {
  const { userId } = req.params;
  
  const db = new sqlite3.Database(DB_PATH);
  
  db.all(
    'SELECT * FROM points_log WHERE user_id = ? ORDER BY created_at DESC',
    [userId],
    (err, logs) => {
      if (err) {
        console.error('Points log fetch error:', err);
        res.status(500).json({ error: 'Failed to fetch points history' });
      } else {
        res.json(logs);
      }
      db.close();
    }
  );
});

module.exports = router;