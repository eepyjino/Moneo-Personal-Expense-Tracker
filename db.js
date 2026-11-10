const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'expenses.db'));
db.pragma('foreign_keys = ON');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    color TEXT NOT NULL DEFAULT '#1FB67A',
    is_builtin INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    description TEXT NOT NULL,
    amount REAL NOT NULL,
    date TEXT NOT NULL,
    category_id INTEGER NOT NULL REFERENCES categories(id)
  );
  CREATE TABLE IF NOT EXISTS savings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL UNIQUE,
    amount REAL NOT NULL CHECK (amount > 0)
  );
  CREATE TABLE IF NOT EXISTS savings_goal (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    amount REAL NOT NULL CHECK (amount > 0),
    period TEXT NOT NULL CHECK (period IN ('daily', 'weekly'))
  );
  CREATE TABLE IF NOT EXISTS monthly_budgets (
    month TEXT PRIMARY KEY,
    amount REAL NOT NULL CHECK (amount > 0),
    savings_target REAL NOT NULL DEFAULT 0 CHECK (savings_target >= 0)
  );
  CREATE TABLE IF NOT EXISTS daily_spend_checkins (
    date TEXT PRIMARY KEY,
    amount REAL NOT NULL CHECK (amount >= 0)
  );
`);

const monthlyBudgetColumns = db.prepare('PRAGMA table_info(monthly_budgets)').all();
if (!monthlyBudgetColumns.some(column => column.name === 'savings_target')) {
  db.exec('ALTER TABLE monthly_budgets ADD COLUMN savings_target REAL NOT NULL DEFAULT 0 CHECK (savings_target >= 0)');
}

db.prepare(`
  INSERT OR IGNORE INTO savings_goal (id, amount, period) VALUES (1, 100, 'daily')
`).run();

// Add colors to databases created before the category color feature.
const categoryColumns = db.prepare('PRAGMA table_info(categories)').all();
if (!categoryColumns.some(column => column.name === 'color')) {
  db.exec("ALTER TABLE categories ADD COLUMN color TEXT NOT NULL DEFAULT '#1FB67A'");
  const migrationColors = ['#1FB67A', '#5686E8', '#F2A65A', '#8B79C8', '#E3768C', '#45B6C5', '#F25C5C', '#827A73'];
  const existingCategories = db.prepare('SELECT id FROM categories ORDER BY id').all();
  const setColor = db.prepare('UPDATE categories SET color = ? WHERE id = ?');
  db.transaction(() => existingCategories.forEach((category, index) => {
    setColor.run(migrationColors[index % migrationColors.length], category.id);
  }))();
}

// Mark existing presets and add the flag to databases created before it existed.
const columnsAfterColorMigration = db.prepare('PRAGMA table_info(categories)').all();
if (!columnsAfterColorMigration.some(column => column.name === 'is_builtin')) {
  db.exec('ALTER TABLE categories ADD COLUMN is_builtin INTEGER NOT NULL DEFAULT 0');
}

// Keep common categories available while preserving custom categories and colors.
const builtInCategories = [
  ['Food', '#F2A65A'],
  ['Transport', '#5686E8'],
  ['Bills', '#8B79C8'],
  ['Shopping', '#E3768C'],
  ['Other', '#1FB67A']
];
const ensureBuiltIn = db.prepare(`
  INSERT INTO categories (name, color, is_builtin) VALUES (?, ?, 1)
  ON CONFLICT(name) DO UPDATE SET is_builtin = 1
`);
db.transaction(() => builtInCategories.forEach(category => {
  ensureBuiltIn.run(category[0], category[1]);
}))();

module.exports = db;
