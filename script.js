// Shared app state
const currency = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });
const categoryColors = ['#1FB67A', '#F25C5C', '#5686E8', '#F2A65A', '#8B79C8', '#E3768C', '#45B6C5', '#827A73'];
const state = {
  categories: [],
  expenses: [],
  stats: null,
  month: getToday().slice(0, 7),
  selectedColor: categoryColors[0],
  editingExpense: null,
  editingCategory: null,
  confirmAction: null,
  dailySpendAmountEdited: false,
  categoryChart: null,
  trendChart: null,
  toastTimer: null
};

// Shared helpers

// Find a page element by its id.
function byId(id) {
  return document.getElementById(id);
}

// Return today's date in the database's YYYY-MM-DD format.
function getToday() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

// Escape text before placing it in an HTML template.
function escapeHtml(value) {
  const element = document.createElement('span');
  element.textContent = String(value ?? '');
  return element.innerHTML;
}

// Use only valid hex colors from the category API.
function safeColor(value) {
  return /^#[0-9a-f]{6}$/i.test(value || '') ? value : categoryColors[0];
}

// Send a JSON request to one of the existing API routes.
async function api(url, method = 'GET', body) {
  const response = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
  return data;
}

// Convert a YYYY-MM month key into a friendly label.
function formatMonth(month) {
  const [year, monthNumber] = month.split('-').map(Number);
  return new Intl.DateTimeFormat('en-PH', { month: 'long', year: 'numeric' }).format(new Date(year, monthNumber - 1, 1));
}

// Format an ISO date for a transaction row.
function formatDate(dateKey, options = { month: 'short', day: 'numeric' }) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Intl.DateTimeFormat('en-PH', options).format(new Date(year, month - 1, day));
}

// Show Today and Yesterday labels where they make sense.
function formatGroupDate(dateKey) {
  const today = getToday();
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterday = `${yesterdayDate.getFullYear()}-${String(yesterdayDate.getMonth() + 1).padStart(2, '0')}-${String(yesterdayDate.getDate()).padStart(2, '0')}`;
  if (dateKey === today) return 'Today';
  if (dateKey === yesterday) return 'Yesterday';
  return formatDate(dateKey, { month: 'short', day: 'numeric', year: 'numeric' });
}

// Load categories, expenses, and monthly summary data from the server.
async function loadData() {
  try {
    const [categories, expenses, stats] = await Promise.all([
      api('/api/categories'),
      api('/api/expenses'),
      api(`/api/stats?month=${encodeURIComponent(state.month)}`)
    ]);
    state.categories = categories;
    state.expenses = expenses;
    state.stats = stats;
    byId('appError').hidden = true;
    renderApp();
  } catch (error) {
    byId('appError').textContent = error.message;
    byId('appError').hidden = false;
  }
}

// Dashboard data and rendering

// Refresh every visible part of the app from the latest data.
function renderApp() {
  byId('monthLabel').textContent = formatMonth(state.month);
  byId('transactionMonthDescription').textContent = `Showing expenses for ${formatMonth(state.month)}`;
  renderCategorySelects();
  renderOverview();
  renderSavings();
  renderTransactions();
  renderCategories();
}

// Fill the expense and filter dropdowns with current categories.
function renderCategorySelects() {
  const expenseSelect = byId('expenseCategory');
  const filterSelect = byId('categoryFilter');
  const previousCategory = expenseSelect.value;
  const previousFilter = filterSelect.value;
  expenseSelect.innerHTML = state.categories.length
    ? state.categories.map(category => `<option value="${category.id}">${escapeHtml(category.name)}</option>`).join('')
    : '<option value="">Add a category first</option>';
  filterSelect.innerHTML = '<option value="">All categories</option>' + state.categories
    .map(category => `<option value="${category.id}">${escapeHtml(category.name)}</option>`).join('');
  if (state.categories.some(category => String(category.id) === previousCategory)) expenseSelect.value = previousCategory;
  if (state.categories.some(category => String(category.id) === previousFilter)) filterSelect.value = previousFilter;
}

// Draw the summary cards, category donut, monthly bars, and recent list.
function renderOverview() {
  const stats = state.stats;
  const monthExpenses = state.expenses.filter(expense => expense.date.startsWith(state.month));
  const total = Number(stats.monthTotal || 0);
  const biggest = [...(stats.byCategory || [])].sort((first, second) => Number(second.total) - Number(first.total))[0];
  byId('monthTotal').textContent = currency.format(total);
  byId('donutTotal').textContent = currency.format(total);
  byId('transactionCount').textContent = String(monthExpenses.length);
  byId('transactionFootnote').textContent = 'Recorded this month';
  byId('biggestCategory').textContent = biggest ? biggest.category : 'No activity';
  byId('biggestCategoryFootnote').textContent = biggest ? currency.format(Number(biggest.total)) + ' this month' : 'Your top spend this month';
  renderMonthlyBudget(monthExpenses);
  renderCategoryChart(stats.byCategory || [], total);
  renderTrendChart(stats.monthlyTotals || []);
  renderRecent(stats.recent || []);
}

// Compare transaction spending with this month's target and project its final total.
function renderMonthlyBudget(monthExpenses) {
  const today = getToday();
  const currentMonth = today.slice(0, 7);
  const [year, monthNumber] = state.month.split('-').map(Number);
  const daysInMonth = new Date(year, monthNumber, 0).getDate();
  const isFutureMonth = state.month > currentMonth;
  const elapsedDays = isFutureMonth ? 0 : state.month === currentMonth ? Number(today.slice(8, 10)) : daysInMonth;
  const transactionsToDate = monthExpenses.filter(expense => expense.date <= today);
  const spent = transactionsToDate.reduce((total, expense) => total + Number(expense.amount), 0);
  const projection = elapsedDays ? spent / elapsedDays * daysInMonth : 0;
  const budget = state.stats.monthlyBudget == null ? null : Number(state.stats.monthlyBudget);
  const savingsTarget = Number(state.stats.monthlySavingsTarget || 0);
  const dailySpendTarget = budget == null ? null : Math.max(0, budget - savingsTarget) / daysInMonth;

  byId('budgetMonthLabel').textContent = `Set a spending budget and savings goal for ${formatMonth(state.month)}.`;
  byId('monthlyBudgetAmount').value = budget == null ? '' : String(budget);
  byId('monthlySavingsTarget').value = budget == null ? '' : String(savingsTarget);
  byId('budgetSpent').textContent = currency.format(spent);
  byId('budgetTransactionCount').textContent = `${transactionsToDate.length} ${transactionsToDate.length === 1 ? 'transaction' : 'transactions'}`;
  byId('budgetProjection').textContent = currency.format(projection);
  byId('budgetPaceLabel').textContent = isFutureMonth ? 'This month has not started yet' : state.month === currentMonth ? 'Based on current spending pace' : 'Final total for this month';
  byId('budgetTargetDisplay').textContent = budget == null ? 'Not set' : currency.format(budget);
  byId('budgetTargetHint').textContent = budget == null ? 'Set a target for this month' : `For ${formatMonth(state.month)}`;
  byId('budgetSavingsTargetDisplay').textContent = savingsTarget > 0 ? currency.format(savingsTarget) : 'Not set';
  byId('dailySpendTargetDisplay').textContent = dailySpendTarget == null ? 'Not set' : currency.format(dailySpendTarget);
  byId('dailySpendTargetHint').textContent = dailySpendTarget == null
    ? 'Set a monthly budget first'
    : `${currency.format(dailySpendTarget)} maximum per day to meet your savings goal`;

  const percent = budget ? spent / budget * 100 : 0;
  const cappedPercent = Math.min(100, Math.round(percent));
  const progressBar = byId('budgetProgressBar');
  progressBar.setAttribute('aria-valuenow', String(cappedPercent));
  progressBar.classList.toggle('is-over-budget', Boolean(budget && spent > budget));
  byId('budgetProgressFill').style.width = `${cappedPercent}%`;
  byId('budgetSpentPercent').textContent = budget ? `${Math.round(percent)}% used` : '';

  let comparison = 'Set a monthly budget to calculate your daily spending target.';
  const estimatedSavings = budget == null ? 0 : Math.max(0, budget - projection);
  if (budget != null && isFutureMonth) comparison = 'Your monthly plan is ready for this month.';
  else if (budget != null && projection > budget) comparison = `At this pace, expenses may exceed your budget by ${currency.format(projection - budget)}.`;
  else if (budget != null && savingsTarget <= 0) comparison = 'Add a monthly savings goal to see whether your spending pace will meet it.';
  else if (budget != null && estimatedSavings < savingsTarget) comparison = `At this pace, estimated savings of ${currency.format(estimatedSavings)} may fall short by ${currency.format(savingsTarget - estimatedSavings)}.`;
  else if (budget != null && estimatedSavings > savingsTarget) comparison = `At this pace, estimated savings may exceed your goal by ${currency.format(estimatedSavings - savingsTarget)}.`;
  else if (budget != null) comparison = 'Your current spending pace is right on your savings goal.';
  byId('budgetComparison').textContent = comparison;
}

// Save the spending target for the selected calendar month.
async function saveMonthlyBudget(event) {
  event.preventDefault();
  byId('monthlyBudgetError').textContent = '';
  const amount = Number(byId('monthlyBudgetAmount').value);
  const savingsTarget = Number(byId('monthlySavingsTarget').value);
  if (!Number.isFinite(amount) || amount <= 0) {
    byId('monthlyBudgetError').textContent = 'Enter a monthly target greater than zero.';
    return;
  }
  if (!Number.isFinite(savingsTarget) || savingsTarget < 0 || savingsTarget > amount) {
    byId('monthlyBudgetError').textContent = 'Savings goal must be between zero and the monthly budget.';
    return;
  }
  try {
    await api('/api/stats/budget', 'PUT', { month: state.month, amount, savingsTarget });
    showToast(`Budget saved for ${formatMonth(state.month)}`);
    await loadData();
  } catch (error) {
    byId('monthlyBudgetError').textContent = error.message;
  }
}

// Draw the category chart and its readable text legend.
function renderCategoryChart(items, total) {
  if (state.categoryChart) state.categoryChart.destroy();
  const hasData = items.length > 0 && total > 0;
  byId('categoryChartWrap').hidden = !hasData;
  byId('categoryLegend').hidden = !hasData;
  byId('categoryEmpty').hidden = hasData;
  if (!hasData) return;

  state.categoryChart = new Chart(byId('categoryChart'), {
    type: 'doughnut',
    data: {
      labels: items.map(item => item.category),
      datasets: [{
        data: items.map(item => Number(item.total)),
        backgroundColor: items.map(item => safeColor(item.color)),
        borderColor: '#FFFFFF',
        borderWidth: 3,
        hoverOffset: 5
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '74%',
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: context => ` ${currency.format(Number(context.raw))}` } }
      }
    }
  });

  byId('categoryLegend').innerHTML = items.map(item => {
    const amount = Number(item.total);
    const percent = total ? Math.round(amount / total * 100) : 0;
    return `<div class="legend-item" style="--category-color:${safeColor(item.color)}">
      <span class="legend-dot" aria-hidden="true"></span>
      <span class="legend-copy"><span class="legend-name">${escapeHtml(item.category)}</span><span class="legend-share">${percent}% of spending</span></span>
      <span class="legend-amount">${currency.format(amount)}</span>
    </div>`;
  }).join('');
}

// Draw a six-month spending comparison centered on the selected month.
function renderTrendChart(monthlyTotals) {
  if (state.trendChart) state.trendChart.destroy();
  const totalsByMonth = new Map(monthlyTotals.map(item => [item.month, Number(item.total)]));
  const [year, monthNumber] = state.month.split('-').map(Number);
  const labels = [];
  const values = [];
  for (let offset = 5; offset >= 0; offset -= 1) {
    const date = new Date(year, monthNumber - 1 - offset, 1);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    labels.push(new Intl.DateTimeFormat('en-PH', { month: 'short' }).format(date));
    values.push(totalsByMonth.get(monthKey) || 0);
  }
  state.trendChart = new Chart(byId('trendChart'), {
    type: 'bar',
    data: { labels, datasets: [{ data: values, backgroundColor: '#1FB67A', hoverBackgroundColor: '#16895B', borderRadius: 6, maxBarThickness: 30 }] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: context => ` ${currency.format(Number(context.raw))}` } } },
      scales: {
        x: { grid: { display: false }, border: { display: false }, ticks: { color: '#89949A', font: { size: 10 } } },
        y: { beginAtZero: true, border: { display: false }, grid: { color: '#EEF1F2' }, ticks: { color: '#89949A', maxTicksLimit: 5, callback: value => currency.format(Number(value)) } }
      }
    }
  });
}

// Show the five newest expenses for the selected month.
function renderRecent(items) {
  const list = byId('recentTransactions');
  if (!items.length) {
    list.innerHTML = '<div class="empty-state"><span class="empty-mark">+</span><strong>No expenses this month yet</strong><span>Your latest activity will show up here.</span></div>';
    return;
  }
  list.innerHTML = items.map(expense => transactionRow(expense, false)).join('');
}

// Create one reusable transaction row.
function transactionRow(expense, withActions) {
  const color = safeColor(expense.category_color || categoryColor(expense.category_id));
  const actions = withActions ? `<div class="transaction-actions">
    <button class="action-button" type="button" data-expense-action="edit" data-id="${expense.id}" aria-label="Edit ${escapeHtml(expense.description)}" title="Edit">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 5 5 5M4 20l4.5-1 10.2-10.2a2.1 2.1 0 0 0-3-3L5.5 16z"/></svg>
    </button>
    <button class="action-button is-danger" type="button" data-expense-action="delete" data-id="${expense.id}" aria-label="Delete ${escapeHtml(expense.description)}" title="Delete">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m3 0-.8 13H6.8L6 7m4 4v5m4-5v5"/></svg>
    </button>
  </div>` : '';
  return `<article class="transaction-row" style="--category-color:${color}">
    <span class="category-avatar" aria-hidden="true">${escapeHtml((expense.category || '?').slice(0, 1).toUpperCase())}</span>
    <div class="transaction-copy"><div class="transaction-title">${escapeHtml(expense.description)}</div>
      <div class="transaction-meta"><span>${escapeHtml(expense.category || 'Uncategorized')}</span><span>${formatDate(expense.date)}</span></div>
    </div>
    <strong class="transaction-amount">-${currency.format(Number(expense.amount))}</strong>
    ${actions}
  </article>`;
}

// Find a category color for an expense when the response has no color field.
function categoryColor(categoryId) {
  const category = state.categories.find(item => Number(item.id) === Number(categoryId));
  return category ? category.color : categoryColors[0];
}

// Transaction list

// Filter and group expenses by date for the selected month.
function renderTransactions() {
  const search = byId('transactionSearch').value.trim().toLowerCase();
  const categoryId = byId('categoryFilter').value;
  const matchingExpenses = state.expenses.filter(expense => {
    const matchesMonth = expense.date.startsWith(state.month);
    const matchesSearch = expense.description.toLowerCase().includes(search);
    const matchesCategory = !categoryId || String(expense.category_id) === categoryId;
    return matchesMonth && matchesSearch && matchesCategory;
  });
  const groups = new Map();
  matchingExpenses.forEach(expense => {
    if (!groups.has(expense.date)) groups.set(expense.date, []);
    groups.get(expense.date).push(expense);
  });
  const container = byId('transactionGroups');
  if (!groups.size) {
    const hasFilters = search || categoryId;
    container.innerHTML = `<div class="empty-state"><span class="empty-mark">${hasFilters ? '–' : '+'}</span><strong>${hasFilters ? 'No matching transactions' : 'No expenses this month yet'}</strong><span>${hasFilters ? 'Try another search or category.' : 'Add your first expense to get started.'}</span></div>`;
    return;
  }
  container.innerHTML = [...groups.entries()].map(([date, expenses]) => `
    <section class="date-group" aria-label="${escapeHtml(formatGroupDate(date))}">
      <h3 class="date-group-title">${escapeHtml(formatGroupDate(date))}</h3>
      <div class="transaction-list">${expenses.map(expense => transactionRow(expense, true)).join('')}</div>
    </section>`).join('');
}

// Category list

// Show category cards with their color and management actions.
function renderCategories() {
  const grid = byId('categoryCards');
  if (!state.categories.length) {
    grid.innerHTML = '<div class="empty-state category-empty"><span class="empty-mark">+</span><strong>No categories yet</strong><span>Add a category to organize your expenses.</span></div>';
    return;
  }
  grid.innerHTML = state.categories.map(category => {
    const count = state.expenses.filter(expense => Number(expense.category_id) === Number(category.id)).length;
    const actions = category.is_builtin ? '<span class="category-fixed-badge">Preset</span>' : `
      <div class="category-card-actions">
        <button class="action-button" type="button" data-category-action="edit" data-id="${category.id}" aria-label="Edit ${escapeHtml(category.name)}" title="Edit">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 5 5 5M4 20l4.5-1 10.2-10.2a2.1 2.1 0 0 0-3-3L5.5 16z"/></svg>
        </button>
        <button class="action-button is-danger" type="button" data-category-action="delete" data-id="${category.id}" aria-label="Delete ${escapeHtml(category.name)}" title="Delete">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m3 0-.8 13H6.8L6 7m4 4v5m4-5v5"/></svg>
        </button>
      </div>`;
    return `<article class="category-card" style="--category-color:${safeColor(category.color)}">
      <div class="category-card-main"><span class="category-avatar" aria-hidden="true">${escapeHtml(category.name.slice(0, 1).toUpperCase())}</span>
        <div class="transaction-copy"><div class="category-card-name">${escapeHtml(category.name)}</div><div class="category-card-count">${count} ${count === 1 ? 'expense' : 'expenses'}</div></div>
      </div>
      ${actions}
    </article>`;
  }).join('');
}

// Automatic savings streak

// Convert a YYYY-MM-DD string into a local date.
function parseDate(dateKey) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day);
}

// Convert a local date into the YYYY-MM-DD format used by the API.
function toDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

// Return the Sunday that starts the date's week.
function weekStart(date) {
  const start = new Date(date);
  start.setDate(start.getDate() - start.getDay());
  return start;
}

// Estimate savings for one date using that month's budget and actual expenses.
function estimateSavings(dateKey, expensesByDate, manualSpendingByDate, budgetsByMonth) {
  const budget = budgetsByMonth.get(dateKey.slice(0, 7));
  const [year, month] = dateKey.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const monthlyBudget = budget ? budget.amount : 0;
  const monthlySavingsTarget = budget ? budget.savingsTarget : 0;
  const dailyAllowance = monthlyBudget / daysInMonth;
  const dailySavingsTarget = monthlySavingsTarget / daysInMonth;
  const spendingTarget = Math.max(0, dailyAllowance - dailySavingsTarget);
  const isManualTotal = manualSpendingByDate.has(dateKey);
  const hasRecord = isManualTotal || expensesByDate.has(dateKey);
  const spent = isManualTotal ? manualSpendingByDate.get(dateKey) : expensesByDate.get(dateKey) || 0;
  return {
    allowance: dailyAllowance,
    dailySavingsTarget,
    spendingTarget,
    spent,
    hasRecord,
    isManualTotal,
    amount: Math.max(0, dailyAllowance - spent),
    qualifies: monthlyBudget > 0 && hasRecord && spent <= spendingTarget
  };
}

// Render the automatic under-budget streak and its 53-week contribution grid.
function renderSavings() {
  const budgetsByMonth = new Map((state.stats.monthlyBudgets || []).map(budget => [budget.month, {
    amount: Number(budget.amount),
    savingsTarget: Number(budget.savingsTarget || 0)
  }]));
  const expensesByDate = new Map();
  const manualSpendingByDate = new Map((state.stats.dailySpending || []).map(entry => [entry.date, Number(entry.amount)]));
  state.expenses.forEach(expense => {
    expensesByDate.set(expense.date, (expensesByDate.get(expense.date) || 0) + Number(expense.amount));
  });

  const todayKey = getToday();
  const todayEstimate = estimateSavings(todayKey, expensesByDate, manualSpendingByDate, budgetsByMonth);
  const progress = todayEstimate.spendingTarget
    ? Math.min(100, Math.round(todayEstimate.spent / todayEstimate.spendingTarget * 100))
    : 0;
  byId('goalProgressLabel').textContent = "Today's spending vs. target";
  byId('goalProgressText').textContent = todayEstimate.allowance
    ? todayEstimate.hasRecord
      ? `${currency.format(todayEstimate.spent)} of ${currency.format(todayEstimate.spendingTarget)} spent`
      : 'Check in to confirm today’s spending'
    : 'Set this month’s budget first';
  byId('goalProgressFill').style.width = `${progress}%`;
  byId('goalProgressBar').setAttribute('aria-valuenow', String(progress));
  byId('goalProgressBar').classList.toggle('is-over-budget', todayEstimate.spent > todayEstimate.spendingTarget);
  byId('dailySpendStatus').textContent = todayEstimate.isManualTotal
    ? 'Manual total used for today’s streak check'
    : todayEstimate.hasRecord ? 'Calculated from today’s transactions' : 'No spending recorded for today';

  const qualifies = dateKey => dateKey <= todayKey && estimateSavings(dateKey, expensesByDate, manualSpendingByDate, budgetsByMonth).qualifies;
  let cursor = parseDate(todayKey);
  if (!qualifies(todayKey)) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (streak < 3660 && qualifies(toDateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  byId('currentStreak').textContent = String(streak);
  byId('streakUnit').textContent = 'day streak';

  const gridStart = weekStart(parseDate(todayKey));
  gridStart.setDate(gridStart.getDate() - 52 * 7);
  const monthLabels = [];
  const seenMonths = new Set();
  const visibleDates = [];
  let underBudgetDays = 0;
  for (let index = 0; index < 53 * 7; index += 1) {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    const key = toDateKey(date);
    const estimate = estimateSavings(key, expensesByDate, manualSpendingByDate, budgetsByMonth);
    const goalProgress = estimate.dailySavingsTarget ? estimate.amount / estimate.dailySavingsTarget : 0;
    let level = 0;
    if (estimate.hasRecord && goalProgress >= 0.8) {
      level = goalProgress >= 1.25 ? 4 : goalProgress >= 1 ? 3 : goalProgress >= 0.9 ? 2 : 1;
    }
    const goalMet = key <= todayKey && estimate.qualifies;
    if (goalMet) underBudgetDays += 1;
    const detail = !estimate.allowance
      ? 'Set a monthly budget to estimate savings'
      : !estimate.hasRecord
        ? 'No spending recorded; check in to confirm this day'
        : `${currency.format(estimate.amount)} estimated saved; spent ${currency.format(estimate.spent)} of ${currency.format(estimate.spendingTarget)} daily target`;
    const label = `${formatDate(key, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}: ${detail}${goalMet ? ', under budget' : ''}`;
    visibleDates.push(`<span class="contribution-day level-${level}${goalMet ? ' goal-met' : ''}${key > todayKey ? ' is-future' : ''}" data-date="${key}" title="${escapeHtml(label)}" aria-hidden="true"></span>`);

    const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
    if (date.getDate() === 1 && !seenMonths.has(monthKey)) {
      seenMonths.add(monthKey);
      const monthName = new Intl.DateTimeFormat('en-PH', { month: 'short' }).format(date);
      monthLabels.push(`<span style="grid-column:${Math.floor(index / 7) + 1}">${monthName}</span>`);
    }
  }
  byId('contributionMonths').innerHTML = monthLabels.join('');
  byId('contributionGrid').innerHTML = visibleDates.join('');
  byId('contributionSummary').textContent = underBudgetDays
    ? `${underBudgetDays} under-budget ${underBudgetDays === 1 ? 'day' : 'days'} in the past year`
    : budgetsByMonth.size ? 'No under-budget days yet' : 'Set monthly budgets to estimate savings';
}

// Prefill a daily check-in from its saved total or transaction sum.
function setDailySpendAmountForDate() {
  if (state.dailySpendAmountEdited) return;
  const date = byId('dailySpendDate').value;
  const manualEntry = (state.stats.dailySpending || []).find(entry => entry.date === date);
  if (manualEntry) {
    byId('dailySpendAmount').value = String(manualEntry.amount);
    return;
  }
  const expenses = state.expenses.filter(expense => expense.date === date);
  const total = expenses.reduce((sum, expense) => sum + Number(expense.amount), 0);
  byId('dailySpendAmount').value = expenses.length ? String(total) : '';
}

// Open the daily spending check-in for today.
function openDailySpendModal() {
  byId('dailySpendForm').reset();
  state.dailySpendAmountEdited = false;
  byId('dailySpendDate').value = getToday();
  byId('dailySpendAmountError').textContent = '';
  setDailySpendAmountForDate();
  openModal('dailySpendModal', '#dailySpendAmount');
}

// Save a confirmed daily spend total for the savings streak.
async function saveDailySpend(event) {
  event.preventDefault();
  const amountText = byId('dailySpendAmount').value.trim();
  const amount = Number(amountText);
  const date = byId('dailySpendDate').value;
  byId('dailySpendAmountError').textContent = '';
  if (!amountText || !Number.isFinite(amount) || amount < 0) {
    byId('dailySpendAmountError').textContent = 'Enter zero or a positive amount.';
    return;
  }
  if (!date || date > getToday()) {
    byId('dailySpendAmountError').textContent = 'Choose a date no later than today.';
    return;
  }
  try {
    await api('/api/stats/daily-spend', 'PUT', { date, amount });
    closeModal('dailySpendModal');
    showToast('Daily spending saved');
    await loadData();
  } catch (error) {
    byId('dailySpendAmountError').textContent = error.message;
  }
}

// Navigation, dialogs, and forms

// Change tabs without reloading the page.
function setActiveTab(tabName) {
  document.querySelectorAll('[data-tab]').forEach(button => {
    const isActive = button.dataset.tab === tabName;
    button.classList.toggle('is-active', isActive);
    button.setAttribute('aria-selected', String(isActive));
  });
  document.querySelectorAll('[data-panel]').forEach(panel => {
    panel.hidden = panel.dataset.panel !== tabName;
  });
  if (tabName === 'transactions') byId('transactionSearch').focus({ preventScroll: true });
}

// Move the selected month backward or forward.
function changeMonth(offset) {
  const [year, month] = state.month.split('-').map(Number);
  const date = new Date(year, month - 1 + offset, 1);
  state.month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  loadData();
}

// Display a modal and focus its first interactive field.
function openModal(id, focusSelector) {
  const modal = byId(id);
  modal.hidden = false;
  modal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-open');
  const focusTarget = focusSelector ? modal.querySelector(focusSelector) : modal.querySelector('button, input, select');
  if (focusTarget) focusTarget.focus();
}

// Close a modal and restore the page scroll.
function closeModal(id) {
  byId(id).hidden = true;
  byId(id).setAttribute('aria-hidden', 'true');
  if ([...document.querySelectorAll('.modal-backdrop')].every(modal => modal.hidden)) {
    document.body.classList.remove('modal-open');
  }
}

// Close the visible modal after its cancel control or backdrop is clicked.
function handleModalDismiss(event) {
  const modal = event.target.closest('.modal-backdrop');
  if (event.target.matches('[data-close-modal]') || event.target === modal) {
    if (modal) closeModal(modal.id);
  }
}

// Clear the inline errors in the expense form.
function clearExpenseErrors() {
  ['amountError', 'descriptionError', 'categoryError'].forEach(id => { byId(id).textContent = ''; });
}

// Open a clean or prefilled expense form.
function openExpenseModal(expense = null) {
  byId('expenseForm').reset();
  clearExpenseErrors();
  state.editingExpense = expense ? expense.id : null;
  byId('expenseModalTitle').textContent = expense ? 'Edit expense' : 'Add expense';
  byId('saveExpenseButton').textContent = expense ? 'Save changes' : 'Save expense';
  byId('expenseDate').value = expense ? expense.date : getToday();
  if (expense) {
    byId('expenseAmount').value = expense.amount;
    byId('expenseDescription').value = expense.description;
    byId('expenseCategory').value = expense.category_id;
  }
  openModal('expenseModal', '#expenseAmount');
}

// Validate and save an expense through the existing API.
async function saveExpense(event) {
  event.preventDefault();
  clearExpenseErrors();
  const amount = Number(byId('expenseAmount').value);
  const description = byId('expenseDescription').value.trim();
  const categoryId = Number(byId('expenseCategory').value);
  let hasError = false;
  if (!Number.isFinite(amount) || amount <= 0) {
    byId('amountError').textContent = 'Enter an amount greater than zero.';
    hasError = true;
  }
  if (!description) {
    byId('descriptionError').textContent = 'Add a short description.';
    hasError = true;
  }
  if (!categoryId) {
    byId('categoryError').textContent = 'Add or choose a category first.';
    hasError = true;
  }
  if (hasError) return;

  const body = {
    amount,
    description,
    category_id: categoryId,
    date: byId('expenseDate').value
  };
  try {
    const isEditing = Boolean(state.editingExpense);
    const url = isEditing ? `/api/expenses/${state.editingExpense}` : '/api/expenses';
    await api(url, isEditing ? 'PUT' : 'POST', body);
    closeModal('expenseModal');
    showToast(isEditing ? 'Expense updated' : 'Expense added');
    await loadData();
  } catch (error) {
    byId('appError').textContent = error.message;
    byId('appError').hidden = false;
  }
}

// Display one of the supported category color choices.
function renderColorOptions() {
  byId('categoryColorOptions').innerHTML = categoryColors.map(color => `
    <button class="color-option ${color === state.selectedColor ? 'is-selected' : ''}" type="button" data-color="${color}" style="--swatch:${color}" aria-label="Choose ${color} color" aria-pressed="${color === state.selectedColor}"></button>`).join('');
}

// Open the add or edit category form.
function openCategoryModal(category = null) {
  byId('categoryForm').reset();
  byId('categoryNameError').textContent = '';
  state.editingCategory = category ? category.id : null;
  state.selectedColor = category ? safeColor(category.color) : categoryColors[0];
  byId('categoryModalTitle').textContent = category ? 'Edit category' : 'Add category';
  byId('saveCategoryButton').textContent = category ? 'Save changes' : 'Save category';
  if (category) byId('categoryName').value = category.name;
  renderColorOptions();
  openModal('categoryModal', '#categoryName');
}

// Validate and save a category through the existing API.
async function saveCategory(event) {
  event.preventDefault();
  const name = byId('categoryName').value.trim();
  if (!name) {
    byId('categoryNameError').textContent = 'Enter a category name.';
    return;
  }
  const isEditing = Boolean(state.editingCategory);
  const url = isEditing ? `/api/categories/${state.editingCategory}` : '/api/categories';
  try {
    await api(url, isEditing ? 'PUT' : 'POST', { name, color: state.selectedColor });
    closeModal('categoryModal');
    showToast(isEditing ? 'Category updated' : 'Category added');
    await loadData();
  } catch (error) {
    byId('categoryNameError').textContent = error.message;
  }
}

// Ask before deleting an expense or category.
function openConfirm(message, action = null, locked = false) {
  byId('confirmMessage').textContent = message;
  byId('confirmDeleteButton').hidden = locked;
  byId('confirmTitle').textContent = locked ? 'Category in use' : 'Are you sure?';
  state.confirmAction = action;
  openModal('confirmModal', '[data-close-modal]');
}

// Run the confirmed delete action and refresh the lists.
async function confirmDelete() {
  const action = state.confirmAction;
  state.confirmAction = null;
  closeModal('confirmModal');
  if (action) await action();
}

// Delete an expense after the user confirms.
function requestExpenseDelete(id) {
  openConfirm('Delete this expense?', async () => {
    try {
      await api(`/api/expenses/${id}`, 'DELETE');
      showToast('Expense deleted');
      await loadData();
    } catch (error) {
      showToast(error.message, true);
    }
  });
}

// Keep categories with existing expenses from being deleted.
function requestCategoryDelete(id) {
  const category = state.categories.find(item => Number(item.id) === Number(id));
  const hasExpenses = state.expenses.some(expense => Number(expense.category_id) === Number(id));
  if (hasExpenses) {
    openConfirm(`Move or delete the expenses in ${category.name} before removing this category.`, null, true);
    return;
  }
  openConfirm(`Delete the ${category.name} category?`, async () => {
    try {
      await api(`/api/categories/${id}`, 'DELETE');
      showToast('Category deleted');
      await loadData();
    } catch (error) {
      showToast(error.message, true);
    }
  });
}

// Show a short success or error message without interrupting the user.
function showToast(message, isError = false) {
  const toast = byId('toast');
  toast.textContent = message;
  toast.classList.toggle('is-error', isError);
  toast.classList.add('is-visible');
  window.clearTimeout(state.toastTimer);
  state.toastTimer = window.setTimeout(() => toast.classList.remove('is-visible'), 3200);
}

// Event wiring and startup

// Connect navigation, forms, filters, and modal controls.
function addEventListeners() {
  document.querySelectorAll('[data-tab]').forEach(button => {
    button.addEventListener('click', () => setActiveTab(button.dataset.tab));
  });
  document.querySelectorAll('[data-tab-link]').forEach(button => {
    button.addEventListener('click', () => setActiveTab(button.dataset.tabLink));
  });
  byId('previousMonth').addEventListener('click', () => changeMonth(-1));
  byId('nextMonth').addEventListener('click', () => changeMonth(1));
  byId('addExpenseButton').addEventListener('click', () => openExpenseModal());
  byId('addCategoryButton').addEventListener('click', () => openCategoryModal());
  byId('openDailySpendButton').addEventListener('click', openDailySpendModal);
  byId('expenseForm').addEventListener('submit', saveExpense);
  byId('categoryForm').addEventListener('submit', saveCategory);
  byId('monthlyBudgetForm').addEventListener('submit', saveMonthlyBudget);
  byId('dailySpendForm').addEventListener('submit', saveDailySpend);
  byId('dailySpendDate').addEventListener('change', setDailySpendAmountForDate);
  byId('dailySpendAmount').addEventListener('input', () => { state.dailySpendAmountEdited = true; });
  byId('transactionSearch').addEventListener('input', renderTransactions);
  byId('categoryFilter').addEventListener('change', renderTransactions);
  byId('confirmDeleteButton').addEventListener('click', confirmDelete);
  document.addEventListener('click', handleModalDismiss);
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      document.querySelectorAll('.modal-backdrop:not([hidden])').forEach(modal => closeModal(modal.id));
    }
  });
  byId('transactionGroups').addEventListener('click', event => {
    const button = event.target.closest('[data-expense-action]');
    if (!button) return;
    const expense = state.expenses.find(item => Number(item.id) === Number(button.dataset.id));
    if (button.dataset.expenseAction === 'edit' && expense) openExpenseModal(expense);
    if (button.dataset.expenseAction === 'delete') requestExpenseDelete(button.dataset.id);
  });
  byId('categoryCards').addEventListener('click', event => {
    const button = event.target.closest('[data-category-action]');
    if (!button) return;
    const category = state.categories.find(item => Number(item.id) === Number(button.dataset.id));
    if (button.dataset.categoryAction === 'edit' && category) openCategoryModal(category);
    if (button.dataset.categoryAction === 'delete') requestCategoryDelete(button.dataset.id);
  });
  byId('categoryColorOptions').addEventListener('click', event => {
    const button = event.target.closest('[data-color]');
    if (!button) return;
    state.selectedColor = button.dataset.color;
    renderColorOptions();
  });
}

// Start the app after the page and chart library are ready.
addEventListeners();
loadData();