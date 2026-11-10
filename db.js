const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'expenses.db'));
db.pragma('foreign_keys = ON');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    color TEXT NOT NULL DEFAULT '#1FB67A'
  );
  CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    description TEXT NOT NULL,
    amount REAL NOT NULL,
    date TEXT NOT NULL,
    category_id INTEGER NOT NULL REFERENCES categories(id)
  );
`);

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

// Add starter categories if there are none
const count = db.prepare('SELECT COUNT(*) AS n FROM categories').get().n;
if (count === 0) {
  const insert = db.prepare('INSERT INTO categories (name, color) VALUES (?, ?)');
  [
    ['Food', '#F2A65A'],
    ['Transport', '#5686E8'],
    ['Bills', '#8B79C8'],
    ['Shopping', '#E3768C'],
    ['Other', '#1FB67A']
  ].forEach(category => insert.run(category[0], category[1]));
}

module.exports = db;
