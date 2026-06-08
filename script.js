'use strict';

// ====== Хранилище (localStorage) ======

const STORAGE_KEY = 'expense_tracker_expenses';

/**
 * Загружает массив расходов из localStorage.
 * Если данных нет или JSON невалидный — возвращает пустой массив.
 */
function loadExpenses() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return [];
    const parsed = JSON.parse(raw);
    // Проверяем, что это массив
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch (e) {
    // Если в localStorage попал невалидный JSON — возвращаем пустой массив
    console.warn('Ошибка загрузки из localStorage:', e.message);
    return [];
  }
}

/**
 * Сохраняет массив расходов в localStorage.
 * Сериализуем через JSON.stringify, потому что localStorage
 * хранит только строки. Массив объектов нельзя сохранить напрямую.
 */
function saveExpenses(expenses) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(expenses));
}

// ====== Состояние приложения ======

let expenses = loadExpenses();

// ====== DOM-элементы ======

const form = document.getElementById('expenseForm');
const categorySelect = document.getElementById('category');
const amountInput = document.getElementById('amount');
const dateInput = document.getElementById('date');
const descriptionInput = document.getElementById('description');
const totalAmountEl = document.getElementById('totalAmount');
const expensesListEl = document.getElementById('expensesList');
const categoriesBreakdownEl = document.getElementById('categoriesBreakdown');
const emptyHint = document.getElementById('emptyHint');

// ====== Вспомогательные функции ======

/**
 * Форматирует число как тенге: 1 234.56 ₸
 */
function formatCurrency(amount) {
  return amount.toLocaleString('ru-KZ', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }) + ' ₸';
}

/**
 * Возвращает сегодняшнюю дату в формате YYYY-MM-DD.
 */
function getTodayString() {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Генерирует уникальный ID для новой траты.
 */
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ====== Подсчёты ======

/**
 * Считает общую сумму всех расходов.
 * Пересчитывается каждый раз заново из массива expenses,
 * а не хранится отдельно — чтобы не было рассинхронизации.
 */
function calcTotal() {
  return expenses.reduce((sum, e) => sum + Number(e.amount), 0);
}

/**
 * Считает сумму по каждой категории.
 * Тоже пересчитывается заново из массива expenses.
 */
function calcByCategory() {
  const map = {};
  for (const e of expenses) {
    if (!map[e.category]) {
      map[e.category] = 0;
    }
    map[e.category] += Number(e.amount);
  }
  return map;
}

// ====== Рендеринг ======

/**
 * Обновляет общую сумму на странице.
 */
function renderTotal() {
  totalAmountEl.textContent = formatCurrency(calcTotal());
}

/**
 * Обновляет разбивку по категориям.
 */
function renderCategories() {
  const byCategory = calcByCategory();
  const keys = Object.keys(byCategory);

  if (keys.length === 0) {
    categoriesBreakdownEl.innerHTML = '<p class="empty-hint">Пока нет расходов</p>';
    return;
  }

  categoriesBreakdownEl.innerHTML = keys
    .sort()
    .map(
      (cat) => `
        <div class="category-card">
          <div class="cat-name">${cat}</div>
          <div class="cat-amount">${formatCurrency(byCategory[cat])}</div>
        </div>
      `
    )
    .join('');
}

/**
 * Обновляет список всех трат.
 */
function renderExpenses() {
  if (expenses.length === 0) {
    expensesListEl.innerHTML = '<p class="empty-hint" id="emptyHint">Добавьте первую трату ✨</p>';
    return;
  }

  // Сортируем от новых к старым
  const sorted = [...expenses].sort((a, b) => new Date(b.date) - new Date(a.date));

  expensesListEl.innerHTML = sorted
    .map(
      (e) => `
        <div class="expense-item" data-id="${e.id}">
          <span class="expense-category">${getCategoryEmoji(e.category)}</span>
          <div class="expense-info">
            <span class="expense-description">${escapeHtml(e.description || e.category)}</span>
            <span class="expense-date">${formatDate(e.date)}</span>
          </div>
          <span class="expense-amount">${formatCurrency(e.amount)}</span>
          <button class="btn-delete" data-id="${e.id}" title="Удалить">✕</button>
        </div>
      `
    )
    .join('');

  // Навешиваем обработчики на кнопки удаления
  document.querySelectorAll('.btn-delete').forEach((btn) => {
    btn.addEventListener('click', (event) => {
      const id = event.currentTarget.dataset.id;
      deleteExpense(id);
    });
  });
}

/**
 * Главная функция рендеринга — обновляет всё сразу.
 */
function renderAll() {
  renderTotal();
  renderCategories();
  renderExpenses();
}

// ====== Вспомогательные функции для отображения ======

/**
 * Возвращает эмодзи для категории.
 */
function getCategoryEmoji(category) {
  const emojis = {
    'Еда': '🍔',
    'Транспорт': '🚗',
    'Развлечения': '🎮',
    'Подписки': '📺',
    'Здоровье': '💊',
    'Одежда': '👕',
    'Прочее': '📦',
  };
  return emojis[category] || '📌';
}

/**
 * Форматирует дату из YYYY-MM-DD в DD.MM.YYYY.
 */
function formatDate(dateStr) {
  const [y, m, d] = dateStr.split('-');
  return `${d}.${m}.${y}`;
}

/**
 * Экранирует HTML-спецсимволы для безопасной вставки.
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ====== Операции с данными ======

/**
 * Добавляет новую трату.
 */
function addExpense(category, amount, date, description) {
  const expense = {
    id: generateId(),
    category,
    amount: Number(amount),
    date,
    description: description.trim() || '',
    createdAt: new Date().toISOString(),
  };

  expenses.push(expense);
  saveExpenses(expenses);
  renderAll();

  // Для отладки: можно открыть DevTools → Application → Local Storage
  console.log('✅ Трата добавлена:', expense);
  console.log('📦 Данные в localStorage:', localStorage.getItem(STORAGE_KEY));
}

/**
 * Удаляет трату по ID.
 */
function deleteExpense(id) {
  const deleted = expenses.find((e) => e.id === id);
  expenses = expenses.filter((e) => e.id !== id);
  saveExpenses(expenses);
  renderAll();

  console.log('🗑️ Трата удалена:', deleted);
  console.log('📦 Данные в localStorage:', localStorage.getItem(STORAGE_KEY));
}

// ====== Обработчик формы ======

form.addEventListener('submit', (event) => {
  event.preventDefault();

  const category = categorySelect.value;
  const amount = amountInput.value;
  const date = dateInput.value;
  const description = descriptionInput.value;

  if (!category || !amount || !date) {
    alert('Пожалуйста, заполните все обязательные поля.');
    return;
  }

  if (Number(amount) <= 0) {
    alert('Сумма должна быть больше нуля.');
    return;
  }

  addExpense(category, amount, date, description);

  // Сброс формы
  form.reset();
  dateInput.value = getTodayString();
  categorySelect.focus();
});

// ====== Инициализация ======

// Устанавливаем сегодняшнюю дату по умолчанию
dateInput.value = getTodayString();

// Первый рендеринг
renderAll();

console.log('🚀 Трекер расходов запущен');
console.log('📊 Текущее количество трат:', expenses.length);
