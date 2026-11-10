const express = require('express');
const db = require('./db');
const router = express.Router();
const DEFAULT_COLOR = '#1FB67A';

// Keep category colors in the supported hex format.
function categoryColor(value) {
  return /^#[0-9a-f]{6}$/i.test(value || '') ? value : DEFAULT_COLOR;
}

// Read all
router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM categories ORDER BY name').all();
  res.json(rows);
});

// Create
router.post('/', (req, res) => {
  try {
    const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
    if (!name) return res.status(400).json({ error: 'Category name is required' });
    db.prepare('INSERT INTO categories (name, color) VALUES (?, ?)')
      .run(name, categoryColor(req.body.color));
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: 'Category name is empty or already exists' });
  }
});

// Update
router.put('/:id', (req, res) => {
  try {
    const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
    if (!name) return res.status(400).json({ error: 'Category name is required' });
    db.prepare('UPDATE categories SET name = ?, color = ? WHERE id = ?')
      .run(name, categoryColor(req.body.color), req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: 'Category name is empty or already exists' });
  }
});

// Delete
router.delete('/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM categories WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: 'Cannot delete a category that has expenses' });
  }
});

module.exports = router;
