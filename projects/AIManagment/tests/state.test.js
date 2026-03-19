import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_TASKS,
  advanceTask,
  computeStats,
  createTask,
  filterTasks,
  normalizeTask,
} from '../app/state.js';

test('normalizeTask fills defaults for missing values', () => {
  const task = normalizeTask({ title: '  ', owner: '', model: '', description: '' });

  assert.equal(task.title, 'Новая AI-задача');
  assert.equal(task.owner, 'Не назначен');
  assert.equal(task.model, 'Не указана');
  assert.equal(task.description, 'Описание не указано');
  assert.equal(task.status, 'backlog');
  assert.equal(task.priority, 'medium');
});

test('createTask prepends a new task to the list', () => {
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

test('advanceTask moves a card to the next workflow status', () => {
  const tasks = advanceTask(DEFAULT_TASKS, 'task-001');
  const movedTask = tasks.find((task) => task.id === 'task-001');

  assert.equal(movedTask.status, 'review');
});
