# Промпт для генерации системы УКС2

## Как использовать
Скопируйте текст из блока ниже в выбранную модель ИИ (например, GPT-4.1, Claude 3.5 или Gemini 1.5) и запросите пошаговую генерацию проекта. Промпт описывает целевую архитектуру, дизайн и структуру данных для альтернативного сайта Управления капитального строительства Иркутска.

```text
Ты — ведущий разработчик и арт-директор. Нужно спроектировать и реализовать веб-систему "УКС Иркутск 2".

1. Архитектура и стек
   - Фронтенд: Next.js 14 (App Router), TypeScript, React Server Components, ESLint + Prettier. Настрой Vercel analytics выключенно, i18n не требуется.
   - CMS: Directus 11 как headless бэкенд, PostgreSQL 15 как основная база, Redis для кеша, MinIO как S3-хранилище, pgAdmin 4 как UI для БД.
   - Обвязка: Docker Compose, Traefik 3.1 обратный прокси c HTTPS (HTTP→HTTPS редирект, dashboard на 8080), автоматический выпуск сертификатов Let's Encrypt.
   - Сервисы должны подниматься одной командой `docker compose up --build`.

2. Доменные имена и Traefik
   - Используй домены: `uks.delightsoft.ru` (публичный сайт), `cms.uks.delightsoft.ru` (Directus), `db.uks.delightsoft.ru` (pgAdmin); для локалки предусмотрены `*.uks2.localhost`.
   - Настрой entrypoints `web: :80` и `websecure: :443`, docker provider с `exposedByDefault=false`, резолвер `le` для ACME (HTTP-01 по умолчанию, возможность переключить на TLS-ALPN-01 и DNS-01 через переменные окружения).
   - Traefik должен публиковать dashboard (8080) и хранить сертификаты в `acme.json` с правами 600. Учти стартовый скрипт, создающий файл и прокладывающий challenge.

3. Docker Compose
   - Оформи сервисы: `frontend`, `directus`, `postgres`, `redis`, `minio`, `pgadmin`, `traefik`. Пропиши перезапуск `unless-stopped`.
   - Включи готовые healthchecks для Postgres и MinIO, зависимости (`depends_on`) и именованные volumes (`postgres_data`, `directus_uploads`, `minio_data`, `traefik_letsencrypt`).
   - Для `frontend` и `directus` подключи Traefik через лейблы, опиши окружение через `.env` (см. пункт 5).

4. UI/UX дизайн сайта
   - Главная страница — много секций: герой с CTA, блок "О компании", флагманский проект с таймлайном, карточки проектов, таблица документов, карточки закупок, блок новостей, контакты, липкое меню.
   - Цветовая палитра и токены: `--color-primary: #0f4c81`, `--color-accent: #1c8cd6`, поверхности #ffffff/#f1f5f9, тени `0 20px 45px rgba(16,43,63,0.12)` и `0 24px 60px rgba(16,43,63,0.18)`, радиусы 24/16/8px.
   - Макс-ширина контента 1440px, горизонтальные отступы `clamp(1.25rem, 3vw, 4.5rem)`, секции с вертикальными отступами 5rem (мобайл: 3.5rem). Сетка `grid-template-columns: repeat(auto-fit, minmax(240px,1fr))` для карточек.
   - Стиль кнопок: pills с box-shadow, плавные hover (translateY -2px). Герой — градиент `linear-gradient(135deg, rgba(15,76,129,0.92), rgba(28,140,214,0.85))`, стеклянные карточки статистики, badge uppercase с letter-spacing 0.12em.
   - Хедер: sticky, стеклообразный фон, desktop навигация при ширине ≥1024px, мобильное меню с кнопкой (bordered pill). Футер — тёмный (`--color-primary-dark`), колонковая сетка auto-fit.
   - Придерживайся современного муниципального тона: минимализм, большие заголовки (clamp до 3.75rem), фирменный шрифт Inter, адаптивные гриды.

5. Настройка окружения
   - `.env` должен содержать: домены Traefik, почту для ACME, креды Directus (ADMIN_EMAIL/PASSWORD, COOKIE_DOMAIN, PUBLIC_URL, REFRESH_COOKIE_SECURE), параметры PostgreSQL (DATABASE_HOST/NAME/USER/PASSWORD), переменные Redis, MinIO (ROOT_USER/PASSWORD, BUCKET_PUBLIC/PRIVATE), pgAdmin (`PGADMIN_DEFAULT_EMAIL/PASSWORD`).
   - Пропиши генератор `.env` на Node.js (`scripts/generate-env.js`) с режимами `--force` и `--rotate-db-password`, который сохраняет существующий пароль БД и при необходимости выполняет `ALTER USER` через `docker compose exec postgres`.

6. Структура данных Directus (snapshot)
   - `homepage` (singleton): hero_title, hero_subtitle, hero_primary_label/_href, hero_secondary_label/_href, hero_stats (JSON массив объектов `{ value, label }`), about_intro, about_values (JSON), flagship_title, flagship_description, flagship_highlights (JSON список).
   - `projects`: id, title, slug (уникальный), category, year, description, sort.
   - `procurements`: id, title, slug (уникальный), status, shortDescription, procurementType, startDate, endDate, sort.
   - `documents`: id, title, category, url (до 512 символов), documentDate, sort.
   - `news_articles`: id, title, excerpt, published_at, sort.
   - `contacts` (singleton): address, phone, email, schedule, lat, lng.
   - Обеспечь REST и GraphQL эндпоинты, роли редакторов, storage adapters для MinIO, webhooks/flows по необходимости.

7. Фронтенд функциональность
   - Реализуй страницы: главная, проекты (список + детали по `slug`), закупки (список + детали), документы (таблица с фильтром), новости (листинг), контакты, страницы политики/условий.
   - Создай `@/lib/api.ts` с клиентами Directus REST + кеширование через Next.js (revalidate 5-10 минут), graceful fallback при 503.
   - Импортируй стили `globals.css`, организуй компоненты: `Hero`, `SectionHeading`, `Card`, `Timeline`, `Header`, `Footer`, `MobileMenu` с соответствующими классами.
   - Добавь метатеги для SEO, OpenGraph, schema.org (Organization, NewsArticle), favicon из `directus/extensions/app/public/favicon.svg`.

8. Документация
   - Обнови `README.md` с инструкциями по запуску, хостам, значениям `.env`, ролям пользователей и ссылками на гайды: деплой на Unix, устранение ошибок HTTPS, управление контентом.
   - Опиши в `docs/unix-docker-deployment.md` шаги: подготовка сервера, настройка DNS, запуск Docker, обновление сертификатов, резервное копирование.
   - Добавь troubleshooting для Traefik, Directus и MinIO (например, автопочинка `.usage.json` и `.bloomcycle.bin`).

Выход: структурированное техническое задание + пошаговая инструкция (архитектура, конфигурации, схемы БД, примеры кода и дизайна) и рекомендации по поддержке.
```
