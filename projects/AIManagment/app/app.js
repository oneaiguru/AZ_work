import {
  DEFAULT_TASKS,
  PRIORITIES,
  STATUSES,
  advanceTask,
  computeStats,
  createTask,
  deleteTask,
  filterTasks,
  groupTasks,
  loadTasks,
  saveTasks,
} from './state.js';

const state = {
  tasks: loadTasks(window.localStorage),
  filters: {
    query: '',
    status: 'all',
    priority: 'all',
  },
};

const elements = {
  total: document.querySelector('[data-stat="total"]'),
  inFlight: document.querySelector('[data-stat="inFlight"]'),
  completed: document.querySelector('[data-stat="completed"]'),
  critical: document.querySelector('[data-stat="critical"]'),
  topModel: document.querySelector('[data-stat="topModel"]'),
  board: document.querySelector('[data-board]'),
  search: document.querySelector('#search'),
  status: document.querySelector('#statusFilter'),
  priority: document.querySelector('#priorityFilter'),
  form: document.querySelector('#taskForm'),
  seedButton: document.querySelector('[data-reset-seed]'),
  totalFiltered: document.querySelector('[data-total-filtered]'),
};

function formatDate(value) {
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function renderStats() {
  const stats = computeStats(state.tasks);
  elements.total.textContent = stats.total;
  elements.inFlight.textContent = stats.inFlight;
  elements.completed.textContent = stats.completed;
  elements.critical.textContent = stats.critical;
  elements.topModel.textContent = stats.topModel;
}

function taskCard(task) {
  return `
    <article class="task-card priority-${task.priority}">
      <div class="task-card__head">
        <div>
          <h3>${task.title}</h3>
          <p class="task-card__meta">${task.owner} · ${task.model}</p>
        </div>
        <span class="badge badge-${task.priority}">${task.priority}</span>
      </div>
      <p class="task-card__description">${task.description}</p>
      <div class="task-card__footer">
        <span>Создано: ${formatDate(task.createdAt)}</span>
        <div class="task-card__actions">
          <button type="button" data-action="advance" data-task-id="${task.id}">Следующий статус</button>
          <button type="button" data-action="delete" data-task-id="${task.id}" class="ghost-danger">Удалить</button>
        </div>
      </div>
    </article>
  `;
}

function renderBoard() {
  const filteredTasks = filterTasks(state.tasks, state.filters);
  const grouped = groupTasks(filteredTasks);

  elements.totalFiltered.textContent = filteredTasks.length;
  elements.board.innerHTML = STATUSES.map((status) => {
    const tasks = grouped[status.id] ?? [];
    return `
      <section class="board-column">
        <header class="board-column__header">
          <h2>${status.label}</h2>
          <span>${tasks.length}</span>
        </header>
        <div class="board-column__body">
          ${tasks.length ? tasks.map(taskCard).join('') : '<p class="empty-state">Пока задач нет.</p>'}
        </div>
      </section>
    `;
  }).join('');
}

function render() {
  renderStats();
  renderBoard();
}

function updateAndRender(tasks) {
  state.tasks = tasks;
  saveTasks(window.localStorage, state.tasks);
  render();
}

function handleSubmit(event) {
  event.preventDefault();
  const formData = new FormData(elements.form);
  const taskInput = Object.fromEntries(formData.entries());
  updateAndRender(createTask(state.tasks, taskInput));
  elements.form.reset();
}

function handleFilters() {
  state.filters.query = elements.search.value;
  state.filters.status = elements.status.value;
  state.filters.priority = elements.priority.value;
  renderBoard();
}

function handleBoardClick(event) {
  const button = event.target.closest('button[data-action]');
  if (!button) {
    return;
  }

  const { action, taskId } = button.dataset;
  if (action === 'advance') {
    updateAndRender(advanceTask(state.tasks, taskId));
    return;
  }

  if (action === 'delete') {
    updateAndRender(deleteTask(state.tasks, taskId));
  }
}

function resetSeed() {
  updateAndRender(DEFAULT_TASKS);
}

function hydrateSelects() {
  elements.status.innerHTML = ['<option value="all">Все статусы</option>', ...STATUSES.map((status) => `<option value="${status.id}">${status.label}</option>`)].join('');
  elements.priority.innerHTML = ['<option value="all">Все приоритеты</option>', ...PRIORITIES.map((priority) => `<option value="${priority}">${priority}</option>`)].join('');
}

function bindEvents() {
  elements.form.addEventListener('submit', handleSubmit);
  elements.search.addEventListener('input', handleFilters);
  elements.status.addEventListener('change', handleFilters);
  elements.priority.addEventListener('change', handleFilters);
  elements.board.addEventListener('click', handleBoardClick);
  elements.seedButton.addEventListener('click', resetSeed);
}

hydrateSelects();
bindEvents();
render();
