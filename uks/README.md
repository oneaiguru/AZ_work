# УКС Иркутск — Next.js + Strapi

Полноценный стек для сайта Управления капитального строительства г. Иркутска. Репозиторий включает фронтенд на Next.js 14 и CMS на Strapi 5, упакованные в Docker Compose вместе с PostgreSQL, Redis, MinIO и Nginx.

## Структура проекта

```
uks/
├── frontend/        # Next.js 14 приложение (App Router, TypeScript)
├── cms/             # Strapi 5 (TypeScript) с моделями контента
├── ops/nginx/       # Конфигурация реверс-прокси
├── docker-compose.yml
├── .env.example
└── README.md
```

## Предварительные требования

- Node.js 20+ и npm 10+ (для локальной разработки без контейнеров)
- Docker Engine 24+ и Docker Compose Plugin 2.24+
- Утилита `mkcert` (по желанию) для локального TLS

## Настройка окружения

1. Сгенерируйте файл окружения со случайными секретами:
   ```bash
   node scripts/generate-env.js
   ```
   Повторный запуск с флагом `--force` перезаписывает существующий `.env`.
2. При необходимости скорректируйте доменное имя `NGINX_HOST`, публичные URL и сетевые порты.

## Локальная разработка без Docker

### Frontend
```bash
cd uks/frontend
npm install
npm run dev
```
Приложение будет доступно по адресу <http://localhost:3000>. Для интеграции со Strapi установите `NEXT_PUBLIC_CMS_URL` в `.env.local`.

### Strapi CMS
```bash
cd uks/cms
npm install
npm run develop
```
Админка откроется на <http://localhost:1337/admin>. При первом запуске создайте аккаунт администратора. Контентные модели создаются автоматически из файлов в `src/api`.

## Запуск через Docker Compose

```bash
cd uks
docker compose up --build
```

Сервисы:
- Next.js фронтенд — <http://localhost:3000>
- Strapi API/Admin — <http://localhost:1337>
- Nginx-шлюз (единая точка входа) — <http://localhost:8080>
- MinIO — <http://localhost:9001> (логин и пароль в `.env`)

### Инициализация S3 бакетов

После первого запуска выполните:
```bash
docker compose exec minio mc alias set local http://localhost:9000 $MINIO_ACCESS_KEY $MINIO_SECRET_KEY
docker compose exec minio mc mb -p local/$MINIO_BUCKET_PUBLIC
docker compose exec minio mc mb -p local/$MINIO_BUCKET_PRIVATE
```

## Контентные модели Strapi

- **Pages** — страницы с произвольными блоками (JSON)
- **Projects** — реализованные и текущие проекты (slug, год, категория, галерея)
- **News** — новости и анонсы (rich text + обложка)
- **Documents** — регламенты и публичные файлы (файл, категория, дата)
- **Procurements** — закупки и коммерческие предложения (статус, тип, даты, теги, ссылки ЕИС)

При старте приложения автоматически создаются роли:
- `editor` — модерирует и публикует контент
- `manager_procurement` — управляет закупками и документами
- `viewer` — доступ только на чтение

## Тестирование и качество

### Frontend
- `npm run lint` — ESLint (Next.js конфигурация)
- `npm run test` — зарезервировано для unit-тестов (можно подключить Vitest/Jest)

### CMS
- `npm run lint` — линтер Strapi
- `npm run test` — запускает Strapi тесты (потребуется настройка Jest)

### Проверки безопасности и соответствия ТЗ
- Файлы проходят проверку ClamAV (добавить в pipeline с помощью `clamdscan`)
- Валидируйте URL ЕИС с помощью `curl --head` или `fetch` в Strapi lifecycle hooks
- Тестируйте формы на XSS/SQLi и корректность ролей (`users-permissions`)

## Сценарии деплоя

1. Выполните `docker compose build` в CI, сохраните артефакты образов.
2. Примените миграции Strapi (`npm run build && npm run start` при старте контейнера выполнят их автоматически).
3. Настройте резервное копирование:
   - PostgreSQL — `pg_dump` по cron.
   - MinIO — `mc mirror` в объектное хранилище/архив.
4. Подключите HTTPS через reverse-proxy (например, Traefik или Nginx с certbot).

## Дополнительно

- Для интеграции с Яндекс.Картами замените параметр `um=constructor:example` на актуальный из конструктора карт.
- Подписка на новости может быть реализована через webhook Strapi и интеграцию с Mailchimp/Telegram Bot API.
- Мониторинг — подключите Grafana + Prometheus либо отправку логов в централизованное хранилище (ELK/EFK).
