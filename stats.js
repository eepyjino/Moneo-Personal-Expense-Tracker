const express = require('express');
const db = require('./db');
const router = express.Router();

// GET /api/stats?month=YYYY-MM
router.get('/', (req, res) => {
  const month = req.query.month;

  // Total spent in the chosen month
  const monthTotal = db.prepare(
    'SELECT COALESCE(SUM(amount), 0) AS total FROM expenses WHERE substr(date, 1, 7) = ?'
  ).get(month).total;

  // Spending by category in the chosen month (for the pie chart)
  const byCategory = db.prepare(`
    SELECT categories.id AS category_id, categories.name AS category, categories.color,
      SUM(expenses.amount) AS total
    FROM expenses
    JOIN categories ON categories.id = expenses.category_id
    WHERE substr(expenses.date, 1, 7) = ?
    GROUP BY categories.id
  `).all(month);

  // Total for every month
  const monthlyTotals = db.prepare(`
    SELECT substr(date, 1, 7) AS month, SUM(amount) AS total
    FROM expenses
    GROUP BY month
    ORDER BY month DESC
  `).all();

  // 5 most recent transactions
  const recent = db.prepare(`
    SELECT expenses.*, categories.name AS category, categories.color AS category_color
    FROM expenses
    JOIN categories ON categories.id = expenses.category_id
    WHERE substr(expenses.date, 1, 7) = ?
    ORDER BY date DESC, expenses.id DESC
    LIMIT 5
  `).all(month);

  res.json({ monthTotal, byCategory, monthlyTotals, recent });
});

module.exports = router;
