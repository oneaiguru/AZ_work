export const STORAGE_KEY = 'aimanagment-board';

export const STATUSES = [
  { id: 'backlog', label: 'Backlog' },
  { id: 'in_progress', label: 'In Progress' },
  { id: 'review', label: 'Review' },
  { id: 'done', label: 'Done' },
];

export const PRIORITIES = ['low', 'medium', 'high', 'critical'];

const DEFAULT_DESCRIPTION = 'Описание не указано';

export const DEFAULT_TASKS = [
  {
    id: 'task-001',
    title: 'Подготовить AI FAQ для поддержки',
    owner: 'Olga',
    model: 'GPT-4.1',
    priority: 'high',
    status: 'in_progress',
    description: 'Собрать вопросы клиентов и подготовить черновик базы ответов.',
    createdAt: '2026-03-19T08:00:00.000Z',
  },
  {
    id: 'task-002',
    title: 'Проверить классификацию входящих лидов',
    owner: 'Max',
    model: 'Claude 3.7',
    priority: 'critical',
    status: 'review',
    description: 'Сравнить качество разметки на 50 тестовых обращениях.',
    createdAt: '2026-03-18T15:30:00.000Z',
  },
  {
    id: 'task-003',
    title: 'Сделать summary встреч для product-команды',
    owner: 'Nina',
    model: 'Gemini 2.0',
    priority: 'medium',
    status: 'backlog',
    description: 'Подготовить процесс генерации кратких итогов из заметок митингов.',
    createdAt: '2026-03-17T11:45:00.000Z',
  },
];

export function createId() {
  return `task-${Math.random().toString(36).slice(2, 10)}`;
}

export function sanitizeText(value, fallback = '') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

export function normalizeTask(input) {
  return {
    id: input.id ?? createId(),
    title: sanitizeText(input.title, 'Новая AI-задача'),
    owner: sanitizeText(input.owner, 'Не назначен'),
    model: sanitizeText(input.model, 'Не указана'),
    priority: PRIORITIES.includes(input.priority) ? input.priority : 'medium',
    status: STATUSES.some((item) => item.id === input.status) ? input.status : 'backlog',
    description: sanitizeText(input.description, DEFAULT_DESCRIPTION),
    createdAt: input.createdAt ?? new Date().toISOString(),
  };
}

export function createTask(tasks, input) {
  return [normalizeTask(input), ...tasks];
}

export function updateTask(tasks, taskId, updates) {
  return tasks.map((task) => {
    if (task.id !== taskId) {
      return task;
    }

    return normalizeTask({
      ...task,
      ...updates,
      id: task.id,
      createdAt: task.createdAt,
    });
  });
}

export function filterTasks(tasks, filters = {}) {
  const query = sanitizeText(filters.query).toLowerCase();
  return tasks.filter((task) => {
    const byStatus = !filters.status || filters.status === 'all' || task.status === filters.status;
    const byPriority = !filters.priority || filters.priority === 'all' || task.priority === filters.priority;
    const haystack = `${task.title} ${task.owner} ${task.model} ${task.description}`.toLowerCase();
    const byQuery = !query || haystack.includes(query);
    return byStatus && byPriority && byQuery;
  });
}

export function groupTasks(tasks) {
  return STATUSES.reduce((acc, status) => {
    acc[status.id] = tasks.filter((task) => task.status === status.id);
    return acc;
  }, {});
}

export function computeStats(tasks) {
  const completed = tasks.filter((task) => task.status === 'done').length;
  const inFlight = tasks.filter((task) => ['in_progress', 'review'].includes(task.status)).length;
  const critical = tasks.filter((task) => task.priority === 'critical').length;

  const modelUsage = tasks.reduce((acc, task) => {
    acc[task.model] = (acc[task.model] ?? 0) + 1;
    return acc;
  }, {});

  const topModel = Object.entries(modelUsage)
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))[0]?.[0] ?? '—';

  return {
    total: tasks.length,
    completed,
    inFlight,
    critical,
    topModel,
  };
}

export function advanceTask(tasks, taskId) {
  return tasks.map((task) => {
    if (task.id !== taskId) {
      return task;
    }

    const currentIndex = STATUSES.findIndex((status) => status.id === task.status);
    const nextIndex = Math.min(currentIndex + 1, STATUSES.length - 1);
    return { ...task, status: STATUSES[nextIndex].id };
  });
}

export function cyclePriority(tasks, taskId) {
  return tasks.map((task) => {
    if (task.id !== taskId) {
      return task;
    }

    const currentIndex = PRIORITIES.indexOf(task.priority);
    const nextIndex = (currentIndex + 1) % PRIORITIES.length;
    return { ...task, priority: PRIORITIES[nextIndex] };
  });
}

export function deleteTask(tasks, taskId) {
  return tasks.filter((task) => task.id !== taskId);
}

export function loadTasks(storage) {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) {
      return DEFAULT_TASKS;
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return DEFAULT_TASKS;
    }

    return parsed.map(normalizeTask);
  } catch {
    return DEFAULT_TASKS;
  }
}

export function saveTasks(storage, tasks) {
  storage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}
