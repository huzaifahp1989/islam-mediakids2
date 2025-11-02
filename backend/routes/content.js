const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const router = express.Router();

const DB_PATH = process.env.DB_PATH || './data/imediackids.db';

// Get all content by type (public endpoint)
router.get('/:type', (req, res) => {
  const { type } = req.params;
  const validTypes = ['ayah', 'hadith', 'dua', 'story', 'quiz'];
  
  if (!validTypes.includes(type)) {
    return res.status(400).json({ error: 'Invalid content type' });
  }

  const db = new sqlite3.Database(DB_PATH);
  
  db.all(
    'SELECT * FROM content WHERE type = ? AND is_active = 1 ORDER BY sort_order ASC, created_at DESC',
    [type],
    (err, rows) => {
      if (err) {
        console.error('Database error:', err);
        res.status(500).json({ error: 'Failed to fetch content' });
      } else {
        res.json(rows);
      }
      db.close();
    }
  );
});

// Get single content item (public endpoint)
router.get('/:type/:id', (req, res) => {
  const { type, id } = req.params;
  
  const db = new sqlite3.Database(DB_PATH);
  
  db.get(
    'SELECT * FROM content WHERE type = ? AND id = ? AND is_active = 1',
    [type, id],
    (err, row) => {
      if (err) {
        console.error('Database error:', err);
        res.status(500).json({ error: 'Failed to fetch content' });
      } else if (!row) {
        res.status(404).json({ error: 'Content not found' });
      } else {
        res.json(row);
      }
      db.close();
    }
  );
});

// Admin endpoints (require authentication)

// Get all content for admin (including inactive)
router.get('/admin/all', authenticateToken, requireAdmin, (req, res) => {
  const { type } = req.query;
  
  const db = new sqlite3.Database(DB_PATH);
  
  let query = 'SELECT * FROM content';
  let params = [];
  
  if (type) {
    query += ' WHERE type = ?';
    params.push(type);
  }
  
  query += ' ORDER BY type, sort_order ASC, created_at DESC';
  
  db.all(query, params, (err, rows) => {
    if (err) {
      console.error('Database error:', err);
      res.status(500).json({ error: 'Failed to fetch content' });
    } else {
      res.json(rows);
    }
    db.close();
  });
});

// Create new content
router.post('/admin/create', authenticateToken, requireAdmin, (req, res) => {
  const { type, title, content_ar, content_en, reference, category, sort_order, image_url } = req.body;
  
  if (!type || (!content_ar && !content_en)) {
    return res.status(400).json({ error: 'Type and content are required' });
  }
  
  const db = new sqlite3.Database(DB_PATH);
  
  db.run(
    `INSERT INTO content (type, title, content_ar, content_en, reference, category, image_url, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [type, title || null, content_ar || null, content_en || null, reference || null, category || null, image_url || null, sort_order || 0],
    function(err) {
      if (err) {
        console.error('Database error:', err);
        res.status(500).json({ error: 'Failed to create content' });
      } else {
        res.json({ 
          success: true, 
          id: this.lastID,
          message: 'Content created successfully' 
        });
      }
      db.close();
    }
  );
});

// Update content
router.put('/admin/:id', authenticateToken, requireAdmin, (req, res) => {
  const { id } = req.params;
  const { type, title, content_ar, content_en, reference, category, image_url, is_active, sort_order } = req.body;
  
  const db = new sqlite3.Database(DB_PATH);
  
  db.run(
    `UPDATE content 
     SET type = ?, title = ?, content_ar = ?, content_en = ?, reference = ?, 
         category = ?, image_url = ?, is_active = ?, sort_order = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [type, title, content_ar, content_en, reference, category, image_url, is_active, sort_order, id],
    function(err) {
      if (err) {
        console.error('Database error:', err);
        res.status(500).json({ error: 'Failed to update content' });
      } else if (this.changes === 0) {
        res.status(404).json({ error: 'Content not found' });
      } else {
        res.json({ 
          success: true, 
          message: 'Content updated successfully' 
        });
      }
      db.close();
    }
  );
});

// Delete content
router.delete('/admin/:id', authenticateToken, requireAdmin, (req, res) => {
  const { id } = req.params;
  
  const db = new sqlite3.Database(DB_PATH);
  
  db.run(
    'DELETE FROM content WHERE id = ?',
    [id],
    function(err) {
      if (err) {
        console.error('Database error:', err);
        res.status(500).json({ error: 'Failed to delete content' });
      } else if (this.changes === 0) {
        res.status(404).json({ error: 'Content not found' });
      } else {
        res.json({ 
          success: true, 
          message: 'Content deleted successfully' 
        });
      }
      db.close();
    }
  );
});

// Toggle content active status
router.patch('/admin/:id/toggle', authenticateToken, requireAdmin, (req, res) => {
  const { id } = req.params;
  
  const db = new sqlite3.Database(DB_PATH);
  
  db.run(
    'UPDATE content SET is_active = NOT is_active, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [id],
    function(err) {
      if (err) {
        console.error('Database error:', err);
        res.status(500).json({ error: 'Failed to toggle content status' });
      } else if (this.changes === 0) {
        res.status(404).json({ error: 'Content not found' });
      } else {
        res.json({ 
          success: true, 
          message: 'Content status toggled successfully' 
        });
      }
      db.close();
    }
  );
});

module.exports = router;
