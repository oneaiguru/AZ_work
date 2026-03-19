import {
  DEFAULT_TASKS,
  PRIORITIES,
  STATUSES,
  advanceTask,
  computeStats,
  createTask,
  cyclePriority,
  getRecentActivity,
  deleteTask,
  filterTasks,
  groupTasks,
  loadTasks,
  saveTasks,
  updateTask,
} from './state.js';

const state = {
  tasks: loadTasks(window.localStorage),
  filters: {
    query: '',
    status: 'all',
    priority: 'all',
  },
  editingTaskId: '',
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
  formTitle: document.querySelector('[data-form-title]'),
  formSubtitle: document.querySelector('[data-form-subtitle]'),
  submitButton: document.querySelector('[data-submit-label]'),
  cancelButton: document.querySelector('[data-cancel-edit]'),
  taskIdInput: document.querySelector('#taskId'),
  statusTabs: document.querySelector('[data-status-tabs]'),
  activityFeed: document.querySelector('[data-activity-feed]'),
};

function formatDate(value) {
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function describeEvent(event) {
  if (event.type === 'created') {
    return 'Задача создана';
  }

  if (event.type === 'status_changed') {
    const from = STATUSES.find((status) => status.id === event.payload.from)?.label ?? event.payload.from;
    const to = STATUSES.find((status) => status.id === event.payload.to)?.label ?? event.payload.to;
    return `Статус: ${from} → ${to}`;
  }

  if (event.type === 'priority_changed') {
    return `Приоритет: ${event.payload.from} → ${event.payload.to}`;
  }

  if (event.type === 'updated') {
    const changed = Object.entries(event.payload)
      .filter(([, isChanged]) => Boolean(isChanged))
      .map(([field]) => field);

    return changed.length
      ? `Обновлены поля: ${changed.join(', ')}`
      : 'Карточка пересохранена без видимых изменений';
  }

  return 'Зафиксировано изменение';
}

function syncFormMode() {
  const isEditing = Boolean(state.editingTaskId);
  elements.formTitle.textContent = isEditing ? 'Редактирование AI-задачи' : 'Новая AI-задача';
  elements.formSubtitle.textContent = isEditing
    ? 'Обновите поля и сохраните изменения.'
    : 'Добавьте инициативу, владельца и модель.';
  elements.submitButton.textContent = isEditing ? 'Сохранить изменения' : 'Добавить задачу';
  elements.cancelButton.hidden = !isEditing;
  elements.taskIdInput.value = state.editingTaskId;
}

function resetForm() {
  state.editingTaskId = '';
  elements.form.reset();
  syncFormMode();
}

function fillForm(task) {
  state.editingTaskId = task.id;
  elements.taskIdInput.value = task.id;
  elements.form.elements.title.value = task.title;
  elements.form.elements.owner.value = task.owner;
  elements.form.elements.model.value = task.model;
  elements.form.elements.priority.value = task.priority;
  elements.form.elements.status.value = task.status;
  elements.form.elements.description.value = task.description;
  syncFormMode();
  elements.form.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
      <div class="task-card__timestamps">
        <span>Создано: ${formatDate(task.createdAt)}</span>
        <span>Обновлено: ${formatDate(task.updatedAt)}</span>
      </div>
      <div class="task-card__footer">
        <div class="task-card__actions">
          <button type="button" data-action="edit" data-task-id="${task.id}">Редактировать</button>
          <button type="button" data-action="priority" data-task-id="${task.id}">Приоритет +</button>
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

function renderActivityFeed() {
  const activity = getRecentActivity(state.tasks);

  elements.activityFeed.innerHTML = activity.length ? activity.map((event) => `
    <article class="activity-item">
      <div class="activity-item__head">
        <strong>${event.taskTitle}</strong>
        <span>${formatDate(event.createdAt)}</span>
      </div>
      <p>${describeEvent(event)}</p>
    </article>
  `).join('') : '<p class="empty-state">История появится после изменений в задачах.</p>';
}

function renderStatusTabs() {
  const counts = groupTasks(filterTasks(state.tasks, { ...state.filters, status: 'all' }));
  const options = [
    { id: 'all', label: 'Все', count: Object.values(counts).reduce((sum, items) => sum + items.length, 0) },
    ...STATUSES.map((status) => ({
      id: status.id,
      label: status.label,
      count: counts[status.id]?.length ?? 0,
    })),
  ];

  elements.statusTabs.innerHTML = options.map((option) => `
    <button
      type="button"
      class="status-tab ${state.filters.status === option.id ? 'status-tab--active' : ''}"
      data-status-tab="${option.id}"
      aria-pressed="${state.filters.status === option.id}"
    >
      <span>${option.label}</span>
      <strong>${option.count}</strong>
    </button>
  `).join('');
}

function render() {
  renderStats();
  renderBoard();
  renderStatusTabs();
  renderActivityFeed();
  syncFormMode();
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
  const taskId = taskInput.taskId;

  if (taskId) {
    updateAndRender(updateTask(state.tasks, taskId, taskInput));
    resetForm();
    return;
  }

  updateAndRender(createTask(state.tasks, taskInput));
  resetForm();
}

function handleFilters() {
  state.filters.query = elements.search.value;
  state.filters.status = elements.status.value;
  state.filters.priority = elements.priority.value;
  renderBoard();
  renderStatusTabs();
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

  if (action === 'priority') {
    updateAndRender(cyclePriority(state.tasks, taskId));
    return;
  }

  if (action === 'edit') {
    const task = state.tasks.find((item) => item.id === taskId);
    if (task) {
      fillForm(task);
    }
    return;
  }

  if (action === 'delete') {
    updateAndRender(deleteTask(state.tasks, taskId));
    if (state.editingTaskId === taskId) {
      resetForm();
    }
  }
}

function handleStatusTabsClick(event) {
  const button = event.target.closest('button[data-status-tab]');
  if (!button) {
    return;
  }

  state.filters.status = button.dataset.statusTab;
  elements.status.value = state.filters.status;
  renderBoard();
  renderStatusTabs();
}

function resetSeed() {
  state.editingTaskId = '';
  updateAndRender(DEFAULT_TASKS);
  resetForm();
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
  elements.cancelButton.addEventListener('click', resetForm);
  elements.statusTabs.addEventListener('click', handleStatusTabsClick);
}

hydrateSelects();
resetForm();
bindEvents();
render();
