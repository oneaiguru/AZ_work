import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_TASKS,
  advanceTask,
  computeStats,
  createTask,
  cyclePriority,
  filterTasks,
  getRecentActivity,
  normalizeTask,
  updateTask,
} from '../app/state.js';

test('normalizeTask fills defaults for missing values', () => {
  const task = normalizeTask({ title: '  ', owner: '', model: '', description: '' });

  assert.equal(task.title, 'Новая AI-задача');
  assert.equal(task.owner, 'Не назначен');
  assert.equal(task.model, 'Не указана');
  assert.equal(task.description, 'Описание не указано');
  assert.equal(task.status, 'backlog');
  assert.equal(task.priority, 'medium');
  assert.equal(task.updatedAt, task.createdAt);
  assert.equal(task.events.length, 1);
  assert.equal(task.events[0].type, 'created');
});

test('createTask prepends a new task to the list and seeds history', () => {
  const tasks = createTask(DEFAULT_TASKS, {
    title: 'Запустить AI triage',
    owner: 'Ira',
    model: 'GPT-4o',
    priority: 'high',
    status: 'backlog',
    description: 'Новый сценарий для приоритизации тикетов.',
  });

  assert.equal(tasks.length, DEFAULT_TASKS.length + 1);
  assert.equal(tasks[0].title, 'Запустить AI triage');
  assert.equal(tasks[0].events[0].type, 'created');
});

test('updateTask preserves identifiers, timestamps and adds update event', () => {
  const tasks = updateTask(DEFAULT_TASKS, 'task-001', {
    title: 'Обновлённая задача',
    owner: 'Ira',
    model: 'GPT-4o',
    priority: 'critical',
    status: 'review',
    description: 'Новое описание',
  });

  const updated = tasks.find((task) => task.id === 'task-001');
  assert.equal(updated.id, 'task-001');
  assert.equal(updated.createdAt, '2026-03-19T08:00:00.000Z');
  assert.equal(updated.title, 'Обновлённая задача');
  assert.equal(updated.priority, 'critical');
  assert.equal(updated.status, 'review');
  assert.equal(updated.events[0].type, 'updated');
  assert.equal(updated.events[0].payload.title, true);
  assert.notEqual(updated.updatedAt, updated.createdAt);
});

test('filterTasks applies status, priority and query filters together', () => {
  const tasks = filterTasks(DEFAULT_TASKS, {
    status: 'review',
    priority: 'critical',
    query: 'классификацию',
  });

  assert.equal(tasks.length, 1);
  assert.equal(tasks[0].id, 'task-002');
});

test('computeStats returns aggregated dashboard values', () => {
  const stats = computeStats([
    ...DEFAULT_TASKS,
    {
      id: 'task-004',
      title: 'Финальный отчёт',
      owner: 'Nina',
      model: 'GPT-4.1',
      priority: 'low',
      status: 'done',
      description: 'Готово',
      createdAt: '2026-03-19T10:00:00.000Z',
    },
  ]);

  assert.deepEqual(stats, {
    total: 4,
    completed: 1,
    inFlight: 2,
    critical: 1,
    topModel: 'GPT-4.1',
  });
});

test('advanceTask moves a card to the next workflow status and logs event', () => {
  const tasks = advanceTask(DEFAULT_TASKS, 'task-001');
  const movedTask = tasks.find((task) => task.id === 'task-001');

  assert.equal(movedTask.status, 'review');
  assert.equal(movedTask.events[0].type, 'status_changed');
  assert.deepEqual(movedTask.events[0].payload, {
    from: 'in_progress',
    to: 'review',
  });
});

test('cyclePriority moves a card to the next priority level and logs event', () => {
  const tasks = cyclePriority(DEFAULT_TASKS, 'task-003');
  const movedTask = tasks.find((task) => task.id === 'task-003');

  assert.equal(movedTask.priority, 'high');
  assert.equal(movedTask.events[0].type, 'priority_changed');
  assert.deepEqual(movedTask.events[0].payload, {
    from: 'medium',
    to: 'high',
  });
});

test('getRecentActivity returns newest events across tasks', () => {
  const tasks = [
    normalizeTask({
      id: 'task-a',
      title: 'Task A',
      createdAt: '2026-03-19T08:00:00.000Z',
      updatedAt: '2026-03-19T08:00:00.000Z',
      events: [
        { type: 'created', createdAt: '2026-03-19T08:00:00.000Z' },
      ],
    }),
    normalizeTask({
      id: 'task-b',
      title: 'Task B',
      createdAt: '2026-03-19T09:00:00.000Z',
      updatedAt: '2026-03-19T09:00:00.000Z',
      events: [
        { type: 'created', createdAt: '2026-03-19T09:00:00.000Z' },
      ],
    }),
  ];

  const activity = getRecentActivity(tasks, 1);

  assert.equal(activity.length, 1);
  assert.equal(activity[0].taskId, 'task-b');
  assert.equal(activity[0].taskTitle, 'Task B');
});
