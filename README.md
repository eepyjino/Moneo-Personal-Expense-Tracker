# Moneo

**FINAL PROJECT · Personal Expense Tracker**

## Submitted By

- Jino Barbadillo
- Leomar Billones
- Jyrold Peñaflor
- Ej Duran
- Karen DelaCruz
- Gecons Secong

<p align="center">
	<img src="images/avatar-pig.svg" alt="Moneo piggy-bank mascot" width="150">
</p>

> **Plan thoughtfully. Spend clearly. Save one day at a time.**

Moneo is a friendly personal finance companion for making everyday spending easier to understand. It brings expense tracking, monthly planning, and savings progress together in one responsive dashboard, with all amounts shown in Philippine pesos.

## What Moneo Does

- **See the full picture:** Review monthly spending, transaction count, top category, category breakdown, and a six-month spending chart.
- **Keep transactions organized:** Add, edit, search, filter, and delete expenses grouped by date.
- **Make categories your own:** Use built-in categories or add custom ones with preset colors.
- **Plan the month:** Set an expense budget and a savings goal. Moneo calculates a daily spending target as `(monthly budget - monthly savings goal) / days in the month`.
- **Build a savings streak:** Stay at or below the daily spending target. Use a daily check-in when spending was not itemized; days without a transaction or check-in remain unconfirmed.
- **Spot your rhythm:** The 53-week contribution grid colors recorded days that are near or meet the daily savings goal.
- **Look ahead:** Estimate month-end spending from the current daily pace. Completed months show actual totals; future months have no estimate until they begin.

A daily check-in overrides that date's transaction total for the streak only. Expense reports continue to use the individual transactions.

## Built With

- Node.js and Express
- SQLite with `better-sqlite3`
- HTML, CSS, and vanilla JavaScript
- Chart.js from a CDN

## Run Locally

Requirements: Node.js 22 or newer and an internet connection for Chart.js.

```powershell
npm install
npm start
```

Open http://localhost:3000. The local `expenses.db` database is created automatically and stores expenses, categories, monthly plans, and daily check-ins.

## Project Files

| File | Purpose |
| --- | --- |
| `server.js` | Starts Express and serves the frontend and API routes. |
| `index.html` | Defines the dashboard, forms, and dialogs. |
| `style.css` | Contains the theme, responsive layouts, and component styles. |
| `script.js` | Loads API data, renders the interface and charts, and handles user actions. |
| `images/avatar-pig.svg` | Moneo's piggy-bank logo and mascot. |
| `db.js` | Creates SQLite tables and safely updates the schema. |
| `expenses.js` | Expense API routes. |
| `categories.js` | Category API routes. |
| `stats.js` | Monthly statistics, budgets, and daily spending check-ins. |

## API Routes

| Method | Route | Purpose |
| --- | --- | --- |
| `GET`, `POST` | `/api/expenses` | List expenses or add one. |
| `PUT`, `DELETE` | `/api/expenses/:id` | Edit or remove an expense. |
| `GET`, `POST` | `/api/categories` | List categories or add one. |
| `PUT`, `DELETE` | `/api/categories/:id` | Edit or remove a category. |
| `GET` | `/api/stats?month=YYYY-MM` | Load dashboard data and budgets for a month. |
| `PUT` | `/api/stats/budget` | Save the monthly expense budget and savings goal. |
| `PUT` | `/api/stats/daily-spend` | Save or update a daily spending check-in. |
