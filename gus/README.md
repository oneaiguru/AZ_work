# The Last of Guss

"The Last of Guss" — браузерная аркада, где выжившие кликают по мутировавшему гусю, чтобы набрать больше очков за ограниченное время раунда. Проект включает полноценный backend на Fastify + TypeORM и SPA на React + Vite. В репозитории находятся все файлы, необходимые для развёртывания и CI/CD.

## Возможности

- **Авторизация с автосозданием аккаунта**: логин по имени и паролю, роли назначаются автоматически (`admin`, `player`, `nikita`).
- **Управление раундами**: админ создаёт новые забеги с configurable `COOLDOWN_DURATION` и `ROUND_DURATION`.
- **Соревновательный геймплей**: счёт ведётся только в активных раундах, каждый 11-й тап приносит 10 очков.
- **Особый режим для Никиты**: пользователь `Никита` или `nikita` может нажимать на гуся, но всегда остаётся с нулём очков.
- **Яркий молодёжный UI**: неоновые градиенты, крупная типографика и акцентные кнопки.
- **Консистентность данных**: все операции по тапу выполняются в транзакции PostgreSQL, используются блокировки строк.
- **Docker-compose** для быстрого запуска всего стека (PostgreSQL + backend + frontend).

## Архитектура

```
└─ gus
   ├─ backend        # Fastify + TypeORM + JWT + PostgreSQL
   │  ├─ src/config  # env и datasource
   │  ├─ src/entities
   │  ├─ src/routes  # auth + rounds endpoints
   │  ├─ src/services
   │  └─ ...
   ├─ frontend       # React + Vite + React Query
   │  ├─ src/pages   # Login, Rounds list, Round detail
   │  ├─ src/components
   │  └─ src/styles
   ├─ docker-compose.yml
   ├─ .github/workflows
   └─ README.md (вы тут)
```

### Backend

- **Стек:** Fastify 4, TypeORM 0.3, PostgreSQL 15, JWT, bcrypt.
- **Основные сущности:** `User`, `Round`, `RoundScore`.
- **Роли:** `admin`, `player`, `nikita`.
- **Контроль конкуренции:** маршруты /rounds/:id/tap используют `QueryRunner` и `pessimistic_write` блокировки.
- **Переменные окружения:** см. [`backend/.env.example`](backend/.env.example).

### Frontend

- **Стек:** React 18, React Router 6, React Query 5, Axios, Vite.
- **Аутентификация:** хранение JWT в `localStorage`, отправка в заголовке Authorization и дублирование в httpOnly cookie.
- **UI:** чистый CSS с яркими градиентами и адаптивной сеткой.
- **Запросы:** React Query с авто-рефрешем списков и оптимистичным обновлением счёта после тапа.

## Быстрый старт

### Предварительные требования

- Node.js 20+
- npm 9+
- PostgreSQL 15 (для локального запуска без Docker)

### Локальный запуск без Docker

1. Создайте файл `backend/.env` на основе [.env.example](backend/.env.example) и пропишите `DATABASE_URL`.
2. Установите зависимости и стартуйте backend:
   ```bash
   cd backend
   npm install
   npm run dev
   ```
3. В новом терминале установите зависимости фронтенда и запустите Vite:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
4. Откройте `http://localhost:5173`.

### Запуск через Docker Compose

```bash
cd gus
docker compose up --build
```

- Перед запуском убедитесь, что Docker Engine (Docker Desktop или демон Docker) запущен, иначе команды `docker compose` завершатся с ошибкой подключения.

- `http://localhost:5173` — SPA.
- `http://localhost:3000` — Fastify API.
- База данных доступна по `localhost:5432` (логин/пароль postgres/postgres).

### Тестовые аккаунты

| Имя пользователя | Пароль      | Роль    | Особенности                              |
| ---------------- | ----------- | ------- | ---------------------------------------- |
| admin            | anything    | admin   | может создавать раунды                   |
| Никита / nikita  | anything    | nikita  | тапает без очков                         |
| любое другое     | anything    | player  | обычный игрок                            |

## Сценарий использования

1. Зайдите как `admin`, нажмите «Запустить новый» на странице раундов — появится раунд с статусом «Сбор отряда».
2. Откройте ссылку раунда и дождитесь старта таймера.
3. Когда статус поменяется на «Финальный отсчет», нажимайте на кнопку «Кликнуть гуся».
4. Каждые 11 нажатий дают +10 очков. В статистике видно количество тапов и очков.
5. После окончания появится блок «Итоги раунда» с победителем и общим счетом.

## Структура API

| Метод | URL                  | Описание                             | Требуется роль |
| ----- | -------------------- | ------------------------------------ | -------------- |
| POST  | `/login`             | Логин/регистрация                    | -              |
| GET   | `/me`                | Проверка токена                      | Любая          |
| GET   | `/rounds`            | Список раундов                       | Авторизован    |
| POST  | `/rounds`            | Создать раунд                        | admin          |
| GET   | `/rounds/:id`        | Детали раунда + мои очки             | Авторизован    |
| POST  | `/rounds/:id/tap`    | Зарегистрировать тап                 | Авторизован    |

## Консистентность и масштабирование

- **Статeless-серверы**: JWT позволяет держать несколько экземпляров бэкенда за балансировщиком.
- **Транзакции**: для подсчёта очков используется `QueryRunner` с `pessimistic_write` блокировкой строк `rounds` и `round_scores`.
- **Атомарность бонусов**: подсчёт очков и обновление `totalScore` происходят в одной транзакции — бонусный 11-й тап не теряется.
- **Поддержка Nikita**: роль `nikita` обновляет счётчики тапов, но не увеличивает `score` и `totalScore`.

## CI/CD

В каталоге `.github/workflows` находится GitHub Actions workflow, который собирает фронтенд и бэкенд, а также прогоняет линтеры. Настройте секреты репозитория при необходимости (по умолчанию pipeline использует `npm ci` и `npm run build`).

## Полезные команды

### Backend

```bash
npm run dev      # старт с hot-reload
npm run build    # компиляция TypeScript → dist
npm run lint     # eslint
```

### Frontend

```bash
npm run dev      # Vite dev server
npm run build    # production сборка
npm run preview  # предпросмотр собранной версии
npm run lint     # eslint
```

## Лицензия

MIT. Feel free to модифицировать и выпускать собственных мутировавших гусей.
