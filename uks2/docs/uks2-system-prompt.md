# Промпт для генерации системы УКС2

## Как использовать
Скопируйте текст из блока ниже в выбранную модель ИИ (например, GPT-4.1, Claude 3.5 или Gemini 1.5) и запросите пошаговую генерацию проекта. Промпт описывает целевую архитектуру, дизайн и структуру данных для альтернативного сайта Управления капитального строительства Иркутска.

```text
Ты — ведущий разработчик и арт-директор. Нужно спроектировать и реализовать веб-систему "УКС Иркутск 2".

1. Архитектура и стек
   - Фронтенд: Next.js 14 (App Router), TypeScript, React Server Components, ESLint + Prettier. Настрой Vercel analytics выключенно, i18n не требуется.
   - CMS: Directus 11 как headless бэкенд, PostgreSQL 15 как основная база, Redis для кеша, MinIO как S3-хранилище, pgAdmin 4 как UI для БД.
   - Обвязка: Docker Compose, Nginx reverse proxy с маршрутизацией по путям (`/`, `/admin/`, `/db/`) и ручной поддержкой TLS (сертификаты монтируются в контейнер или выдаются внешним балансировщиком).
   - Сервисы должны подниматься одной командой `docker compose up --build`.

2. Доменные имена и Nginx
   - Основной домен: `uks.delightsoft.ru`. CMS должна открываться по `https://uks.delightsoft.ru/admin`, а pgAdmin — по `https://uks.delightsoft.ru/db`. Для локальной разработки можно использовать `uks2.localhost`.
   - Настрой Nginx на проксирование: `/` → фронтенд (Next.js), `/admin/` → Directus, `/db/` → pgAdmin. Добавь редирект с `/admin` на `/admin/` и `/db` на `/db/`.
   - Предусмотри подключение TLS: отдельный серверный блок `listen 443 ssl http2`, чтение `fullchain.pem` / `privkey.pem` из каталога `ops/nginx/certs`, а также редирект с HTTP на HTTPS.

3. Docker Compose
   - Оформи сервисы: `frontend`, `directus`, `postgres`, `redis`, `minio`, `pgadmin`, `nginx`. Пропиши перезапуск `unless-stopped`.
   - Включи готовые healthchecks для Postgres и MinIO, зависимости (`depends_on`) и именованные volumes (`postgres_data`, `directus_uploads`, `minio_data`).
   - Настрой Nginx так, чтобы он зависел от фронтенда, Directus и pgAdmin, и монтируй `ops/nginx/default.conf` плюс каталог с сертификатами.

4. UI/UX дизайн сайта
   - Главная страница — много секций: герой с CTA, блок "О компании", флагманский проект с таймлайном, карточки проектов, таблица документов, карточки закупок, блок новостей, контакты, липкое меню.
   - Цветовая палитра и токены: `--color-primary: #0f4c81`, `--color-accent: #1c8cd6`, поверхности #ffffff/#f1f5f9, тени `0 20px 45px rgba(16,43,63,0.12)` и `0 24px 60px rgba(16,43,63,0.18)`, радиусы 24/16/8px.
   - Макс-ширина контента 1440px, горизонтальные отступы `clamp(1.25rem, 3vw, 4.5rem)`, секции с вертикальными отступами 5rem (мобайл: 3.5rem). Сетка `grid-template-columns: repeat(auto-fit, minmax(240px,1fr))` для карточек.
   - Стиль кнопок: pills с box-shadow, плавные hover (translateY -2px). Герой — градиент `linear-gradient(135deg, rgba(15,76,129,0.92), rgba(28,140,214,0.85))`, стеклянные карточки статистики, badge uppercase с letter-spacing 0.12em.
   - Хедер: sticky, стеклообразный фон, desktop навигация при ширине ≥1024px, мобильное меню с кнопкой (bordered pill). Футер — тёмный (`--color-primary-dark`), колонковая сетка auto-fit.
   - Придерживайся современного муниципального тона: минимализм, большие заголовки (clamp до 3.75rem), фирменный шрифт Inter, адаптивные гриды.

5. Настройка окружения
   - `.env` должен содержать: публичные URL (`NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_CMS_URL`, `NEXT_PUBLIC_ASSETS_URL`), значения для Directus (ADMIN_EMAIL/PASSWORD, PUBLIC_URL, COOKIE_DOMAIN, REFRESH_COOKIE_SECURE, REFRESH_COOKIE_PATH), параметры PostgreSQL (DATABASE_HOST/NAME/USER/PASSWORD), переменные Redis, MinIO (ROOT_USER/PASSWORD, BUCKET_PUBLIC/PRIVATE) и pgAdmin (`PGADMIN_DEFAULT_EMAIL/PASSWORD`, `PGADMIN_BASE_PATH`, `PGADMIN_ENABLE_TLS`, `PGADMIN_SSL_DOMAIN`, `PGADMIN_SSL_DAYS`).
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
   - Опиши в `docs/unix-docker-deployment.md` шаги: подготовка сервера, настройка DNS, запуск Docker, подключение сертификатов к Nginx, резервное копирование.
   - Добавь troubleshooting для Nginx/HTTPS, Directus и MinIO (например, автопочинка `.usage.json` и `.bloomcycle.bin`).

Выход: структурированное техническое задание + пошаговая инструкция (архитектура, конфигурации, схемы БД, примеры кода и дизайна) и рекомендации по поддержке.
```
