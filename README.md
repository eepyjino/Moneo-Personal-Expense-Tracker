# Moneo Expense Tracker

A personal expense tracker built with Express, SQLite, plain HTML/CSS, and vanilla JavaScript. It uses Chart.js from a CDN for the dashboard charts and formats amounts in Philippine pesos.

## Features
- Monthly overview with spending totals, transaction count, biggest category, a spending donut chart, and a six-month comparison
- Transactions grouped by date, with description search and category filtering
- Add, edit, and delete expenses using forms and confirmation dialogs
- Create, edit, and delete categories with preset colors
- Responsive navigation and layouts for desktop and phones



## How It Works
1. The browser loads `index.html`, `style.css`, and `script.js` from the Express server.
2. `script.js` uses `fetch` to call the API and redraws the page when data changes.
3. The route files read and update SQLite through the shared connection in `db.js`.
4. The database stores expenses and categories locally in `expenses.db`.

## API Routes
| Method | Route | Purpose |
| --- | --- | --- |
| `GET`, `POST` | `/api/expenses` | List expenses or add one. |
| `PUT`, `DELETE` | `/api/expenses/:id` | Edit or remove an expense. |
| `GET`, `POST` | `/api/categories` | List categories or add one. |
| `PUT`, `DELETE` | `/api/categories/:id` | Edit or remove a category. |
| `GET` | `/api/stats?month=YYYY-MM` | Load dashboard totals for a month. |

Amounts are formatted in one place in `script.js`, using the `PHP` currency setting.
