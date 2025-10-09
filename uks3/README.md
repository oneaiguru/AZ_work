# УКС Иркутск 2 — системный проект UKS3

Альтернативная цифровая платформа Управления капитального строительства Иркутска. Репозиторий содержит
фронтенд на Next.js 14 (App Router), headless CMS Directus 11, обвязку Docker Compose с Traefik 3.1 и
инфраструктурные инструкции.

## Архитектура решения

| Сервис        | Технологии и роль                                                                                |
| ------------- | ------------------------------------------------------------------------------------------------ |
| `frontend`    | Next.js 14 (React Server Components, TypeScript, Tailwind токены) — публичный сайт `uks.delightsoft.ru` |
| `directus`    | Directus 11 + PostgreSQL, Redis и MinIO — headless CMS и API                                       |
| `postgres`    | PostgreSQL 15 — основная база данных                                                              |
| `redis`       | Redis 7 — кеш, очереди и rate limiting Directus                                                   |
| `minio`       | MinIO S3 — файловое хранилище публичных и приватных загрузок                                      |
| `pgadmin`     | pgAdmin 4 — UI для работы с БД                                                                     |
| `traefik`     | Traefik 3.1 — обратный прокси, HTTPS, автоматический выпуск сертификатов Let's Encrypt            |

Композиция сервисов поднимается одной командой:

```bash
cd uks3
./scripts/generate-env.js             # создаст .env
docker compose up --build
```

> Traefik слушает домены `uks.delightsoft.ru`, `cms.uks.delightsoft.ru`, `db.uks.delightsoft.ru` и локальные `*.uks2.localhost`.
> Dashboard Traefik доступен на 8080, сертификаты хранятся в `traefik_letsencrypt/acme.json` (права 600 создаются стартовым
> скриптом `ops/traefik/entrypoint.sh`).

## Файловая структура

```
uks3/
├── docker-compose.yml        # сервисы и сети
├── frontend/                 # Next.js приложение (App Router, дизайн-токены)
├── directus/                 # snapshot схемы и кастомные расширения (favicon)
├── scripts/generate-env.js   # генератор .env и ротация пароля БД
├── docs/                     # эксплуатационная документация
└── ops/traefik/              # конфигурация и entrypoint прокси
```

### Фронтенд

- Страницы: главная, проекты (листинг + slug), закупки (листинг + slug), документы (таблица с фильтром), новости (листинг + id),
  контакты, политика, условия.
- Компоненты: `Hero`, `SectionHeading`, `Card`, `Timeline`, `Header`, `Footer`, `MobileMenu`.
- API-слой: `lib/api.ts` с REST-клиентом Directus + graceful fallback, revalidate 5 минут.
- Стили: `globals.css` с токенами `--color-primary` и др., стеклянные карточки, липкий хедер.
- SEO: метатеги в `app/layout.tsx`, Open Graph, favicon `directus/extensions/app/public/favicon.svg`.

### Directus

- Snapshot `directus/snapshot.yaml` описывает коллекции:
  - `homepage` (singleton) — контент главной страницы.
  - `projects`, `procurements`, `documents`, `news_articles` — реестры с сортировкой.
  - `contacts` (singleton) — блок контактов и координаты.
- MinIO подключается через storage adapter S3, Redis включает кеш.
- Рекомендации по миграции: `npx directus schema apply --yes ./directus/snapshot.yaml` после старта контейнера.

## Настройка окружения `.env`

Скрипт `scripts/generate-env.js` создаёт `.env` (или обновляет с `--force`) и поддерживает ротацию пароля БД (`--rotate-db-password`):

```bash
cd uks3
./scripts/generate-env.js             # создаст .env c рандомными секретами
./scripts/generate-env.js --force     # перезапишет файл
./scripts/generate-env.js --rotate-db-password
```

Содержимое `.env` включает:

- Traefik: `TRAEFIK_PUBLIC_DOMAIN`, `TRAEFIK_CMS_DOMAIN`, `TRAEFIK_DB_DOMAIN`, `TRAEFIK_EMAIL`, `TRAEFIK_ACME_CHALLENGE`.
- Directus: `DIRECTUS_ADMIN_EMAIL`, `DIRECTUS_ADMIN_PASSWORD`, `DIRECTUS_COOKIE_DOMAIN`, `DIRECTUS_PUBLIC_URL`,
  `DIRECTUS_REFRESH_COOKIE_SECURE`, `DIRECTUS_STATIC_TOKEN`.
- База: `POSTGRES_HOST`, `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`.
- Кеш: `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`.
- Хранилище: `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD`, `MINIO_BUCKET_PUBLIC`, `MINIO_BUCKET_PRIVATE`.
- pgAdmin: `PGADMIN_DEFAULT_EMAIL`, `PGADMIN_DEFAULT_PASSWORD`.
- Фронтенд: `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_DIRECTUS_URL`.

## Рабочие домены и маршрутизация

| Домен                    | Сервис    | Путь                         |
| ------------------------ | --------- | ---------------------------- |
| `https://uks.delightsoft.ru` | frontend  | публичный сайт               |
| `https://cms.uks.delightsoft.ru` | directus | панель управления контентом |
| `https://db.uks.delightsoft.ru`  | pgadmin  | UI для базы данных          |

Для локальной разработки Traefik принимает `uks3.uks2.localhost`, `cms.uks2.localhost`, `db.uks2.localhost`.

## Роли пользователей Directus

- **Администратор** — создаётся по переменным `DIRECTUS_ADMIN_EMAIL/PASSWORD`.
- **Редактор** — рекомендуется создать роль с доступом к коллекциям `projects`, `procurements`, `documents`, `news_articles`.
- **Читатель API** — read-only доступ для публичных запросов, ограничить приватные поля.

## Операции и сопровождение

- Сборка и запуск: `docker compose up --build`.
- Применение snapshot: `docker compose exec directus npx directus schema apply --yes /directus/snapshot.yaml`.
- Создание бакетов MinIO: `docker compose exec minio mc alias set local http://localhost:9000 $MINIO_ROOT_USER $MINIO_ROOT_PASSWORD` + `mc mb local/public`.
- Очистка кеша: `docker compose exec directus npx directus cache:clear`.
- Резервное копирование: см. `docs/unix-docker-deployment.md`.

## Дальнейшее развитие

- Подключение flows Directus для автоматизации публикаций и webhooks в систему уведомлений.
- Настройка GraphQL API (включить `GRAPHQL_ENABLED=true`).
- Интеграция с муниципальными сервисами (ЕИС, ГИС ЖКХ) через cron-задачи.
- Поддержка мультиязычности в будущем через Directus locales и Next.js i18n.

Дополнительные материалы см. в `docs/`.
