const express = require('express');
const db = require('./db');
const router = express.Router();

// Read all
router.get('/', (req, res) => {
  const rows = db.prepare(`
    SELECT expenses.*, categories.name AS category, categories.color AS category_color
    FROM expenses
    JOIN categories ON categories.id = expenses.category_id
    ORDER BY date DESC, expenses.id DESC
  `).all();
  res.json(rows);
});

// Create
router.post('/', (req, res) => {
  const { description, amount, date, category_id } = req.body;
  db.prepare('INSERT INTO expenses (description, amount, date, category_id) VALUES (?, ?, ?, ?)')
    .run(description, amount, date, category_id);
  res.json({ success: true });
});

// Update
router.put('/:id', (req, res) => {
  const { description, amount, date, category_id } = req.body;
  db.prepare('UPDATE expenses SET description = ?, amount = ?, date = ?, category_id = ? WHERE id = ?')
    .run(description, amount, date, category_id, req.params.id);
  res.json({ success: true });
});

// Delete
router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM expenses WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
