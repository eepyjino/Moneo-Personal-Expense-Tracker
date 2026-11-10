const express = require('express');
const db = require('./db');
const router = express.Router();

// Return the goal and daily savings totals for the contribution graph.
router.get('/', (req, res) => {
  const goal = db.prepare('SELECT amount, period FROM savings_goal WHERE id = 1').get();
  const entries = db.prepare('SELECT date, amount FROM savings ORDER BY date').all();
  res.json({ goal, entries });
});

// Save the total amount saved on a date, replacing any previous total for that day.
router.post('/', (req, res) => {
  const amount = Number(req.body.amount);
  const date = typeof req.body.date === 'string' ? req.body.date : '';
  if (!Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({ error: 'Savings amount must be greater than zero' });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'Choose a valid savings date' });
  }
  db.prepare(`
    INSERT INTO savings (date, amount) VALUES (?, ?)
    ON CONFLICT(date) DO UPDATE SET amount = excluded.amount
  `).run(date, amount);
  res.json({ success: true });
});

// Update the daily or weekly target.
router.put('/goal', (req, res) => {
  const amount = Number(req.body.amount);
  const period = req.body.period;
  if (!Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({ error: 'Savings target must be greater than zero' });
  }
  if (!['daily', 'weekly'].includes(period)) {
    return res.status(400).json({ error: 'Choose a daily or weekly target' });
  }
  db.prepare(`
    UPDATE savings_goal SET amount = ?, period = ? WHERE id = 1
  `).run(amount, period);
  res.json({ success: true });
});

module.exports = router;