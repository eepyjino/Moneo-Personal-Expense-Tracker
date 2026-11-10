const express = require('express');
const db = require('./db');
const router = express.Router();

// Save the spending budget for one calendar month.
router.put('/budget', (req, res) => {
  const month = typeof req.body.month === 'string' ? req.body.month : '';
  const amount = Number(req.body.amount);
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    return res.status(400).json({ error: 'Choose a valid budget month' });
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({ error: 'Monthly budget must be greater than zero' });
  }
  const existingBudget = db.prepare('SELECT savings_target FROM monthly_budgets WHERE month = ?').get(month);
  const savingsTarget = req.body.savingsTarget === undefined
    ? Number(existingBudget?.savings_target || 0)
    : Number(req.body.savingsTarget);
  if (!Number.isFinite(savingsTarget) || savingsTarget < 0 || savingsTarget > amount) {
    return res.status(400).json({ error: 'Savings target must be between zero and the monthly budget' });
  }
  db.prepare(`
    INSERT INTO monthly_budgets (month, amount, savings_target) VALUES (?, ?, ?)
    ON CONFLICT(month) DO UPDATE SET amount = excluded.amount, savings_target = excluded.savings_target
  `).run(month, amount, savingsTarget);
  res.json({ success: true });
});

// Save or update a confirmed daily spending total for the savings streak.
router.put('/daily-spend', (req, res) => {
  const date = typeof req.body.date === 'string' ? req.body.date : '';
  const amount = Number(req.body.amount);
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > today) {
    return res.status(400).json({ error: 'Choose a valid date no later than today' });
  }
  if (!Number.isFinite(amount) || amount < 0) {
    return res.status(400).json({ error: 'Daily spending cannot be negative' });
  }
  db.prepare(`
    INSERT INTO daily_spend_checkins (date, amount) VALUES (?, ?)
    ON CONFLICT(date) DO UPDATE SET amount = excluded.amount
  `).run(date, amount);
  res.json({ success: true });
});

// GET /api/stats?month=YYYY-MM
router.get('/', (req, res) => {
  const month = req.query.month;

  // Total spent in the chosen month
  const monthTotal = db.prepare(
    'SELECT COALESCE(SUM(amount), 0) AS total FROM expenses WHERE substr(date, 1, 7) = ?'
  ).get(month).total;
  const monthlyBudget = db.prepare('SELECT amount, savings_target FROM monthly_budgets WHERE month = ?').get(month);
  const monthlyBudgets = db.prepare('SELECT month, amount, savings_target FROM monthly_budgets ORDER BY month').all()
    .map(budget => ({ month: budget.month, amount: Number(budget.amount), savingsTarget: Number(budget.savings_target) }));
  const dailySpending = db.prepare('SELECT date, amount FROM daily_spend_checkins ORDER BY date')
    .all()
    .map(entry => ({ date: entry.date, amount: Number(entry.amount) }));

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

  res.json({
    monthTotal,
    monthlyBudget: monthlyBudget ? Number(monthlyBudget.amount) : null,
    monthlySavingsTarget: monthlyBudget ? Number(monthlyBudget.savings_target) : null,
    monthlyBudgets,
    dailySpending,
    byCategory,
    monthlyTotals,
    recent
  });
});

module.exports = router;
