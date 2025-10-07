# УКС Иркутск — Next.js + Directus + Traefik

Альтернативный стек для сайта Управления капитального строительства г. Иркутска. Вариант `uks2/` использует фронтенд на Next.js 14, Headless CMS Directus 11 и Traefik в роли реверс-прокси. Инфраструктура разворачивается через Docker Compose вместе с PostgreSQL, Redis и MinIO.

## Структура проекта

```
uks2/
├── frontend/        # Next.js 14 приложение (App Router, TypeScript)
├── directus/        # Конфигурация Directus (snapshot, расширения, Dockerfile)
├── ops/traefik/     # Настройки Traefik и файлы ACME
├── scripts/         # Вспомогательные утилиты
├── docker-compose.yml
├── .env.example
└── README.md
```

## Предварительные требования

- Node.js 22+ и npm 10+ (для локальной разработки CLI Directus; фронтенд можно запускать на Node 20, но Directus 11 требует Node 22)
- Docker Engine 24+ и Docker Compose Plugin 2.24+
- Возможность редактировать `/etc/hosts` (для привязки локальных доменов Traefik)

## Настройка окружения

1. Сгенерируйте файл окружения со случайными секретами:
   ```bash
   node scripts/generate-env.js
   ```
   Скрипт создаст `uks2/.env` на основе `.env.example`. При наличии файла используйте флаг `--force`, чтобы перезаписать значения.
2. Добавьте в `/etc/hosts` записи для Traefik (пример):
   ```
   127.0.0.1 uks2.localhost cms.uks2.localhost
   ```
3. При необходимости скорректируйте значения `TRAEFIK_DOMAIN`, `NEXT_PUBLIC_CMS_URL` и `NEXT_PUBLIC_SITE_URL` под собственный домен/порты. При работе через Traefik обязательно укажите тот же домен в `DIRECTUS_PUBLIC_URL` — иначе браузер не сохранит cookie сеанса и вход в Directus завершится ошибкой 400 на `/auth/login`.

## Локальная разработка без Docker

### Frontend
```bash
cd uks2/frontend
npm install
npm run dev
```
Приложение будет доступно по адресу <http://localhost:3000>. Для интеграции с Directus пропишите `NEXT_PUBLIC_CMS_URL` и `CMS_INTERNAL_URL` в `frontend/.env.local`.

### Directus
Directus запускается проще всего через Docker, однако для разработки можно использовать CLI (требуется Node.js 22+):
```bash
cd uks2/directus
npm install
npx directus bootstrap
npx directus start
```
Файл `directus/snapshot.yaml` содержит схему коллекций (проекты, закупки, документы и т. д.). Применить её можно командой:
```bash
npx directus schema apply snapshot.yaml
```
После запуска админка будет доступна на <http://localhost:8055/admin>. Создайте пользователя с учётными данными из `.env` (`DIRECTUS_ADMIN_EMAIL`, `DIRECTUS_ADMIN_PASSWORD`). Если вы предпочитаете открывать панель по Traefik-домену (`https://cms.uks2.localhost`), обновите `DIRECTUS_PUBLIC_URL` и при необходимости `DIRECTUS_COOKIE_DOMAIN` — значения должны совпадать с хостом, который вы используете в браузере.

## Запуск через Docker Compose

```bash
cd uks2
docker compose up --build
```

> ℹ️ **Windows**: Убедитесь, что Docker Desktop запущен и доступен через named pipe `//./pipe/dockerDesktopLinuxEngine`. Если команда завершается ошибкой `unable to get image 'traefik:v3.1'`, значит Docker Engine не запущен. Перезапустите Docker Desktop и повторите `docker compose up --build`. При желании можно заранее выполнить `docker pull traefik:v3.1`.

Сервисы и точки входа:
- `https://uks2.localhost` — Next.js фронтенд через Traefik
- `https://cms.uks2.localhost` — Directus (REST, GraphQL, админка)
- `http://localhost:8055` — прямой доступ к Directus (в обход Traefik)
- `http://localhost:9001` — MinIO console (логин/пароль из `.env`)
- `redis://localhost:6379` — Redis для кеша Directus

> ⚠️ Для HTTPS Traefik генерирует сертификаты через Let’s Encrypt. В локальной среде можно отключить `websecure` роутер или использовать self-signed сертификаты.

### Для чего нужен Redis

Redis выступает высокоскоростным хранилищем для Directus. Он используется для:
- кеширования ответов GraphQL/REST,
- хранения rate-limit и счётчиков,
- потенциального расширения очередями (flows, webhooks).

Без него Directus будет работать, но производительность и устойчивость к нагрузкам ниже.

### Базовый favicon для Directus

В директории `directus/extensions/app/public/` лежит векторный favicon в формате SVG. Переменная окружения `DIRECTUS_APP_ICON` указывает Directus использовать его вместо стандартного `favicon.ico`, благодаря чему админка не делает запросы к отсутствующему бинарному файлу.

### Cookie Directus и ошибки 400

Directus хранит refresh-токен в HTTP-only cookie. Если домен в cookie не совпадает с доменом в адресной строке, запрос `/auth/refresh` или `/auth/login` вернёт 400. Используйте `DIRECTUS_COOKIE_DOMAIN` (пустая строка = автоматический выбор текущего домена), а также `DIRECTUS_REFRESH_COOKIE_SECURE` и `DIRECTUS_REFRESH_COOKIE_SAME_SITE`, чтобы подстроить поведение под локальные и боевые домены.

### Подготовка бакетов MinIO

После первого запуска создайте бакеты для публичных и приватных файлов:
```bash
docker compose exec minio mc alias set local http://minio:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD"
docker compose exec minio mc mb -p local/$MINIO_BUCKET_PUBLIC
docker compose exec minio mc mb -p local/$MINIO_BUCKET_PRIVATE
```
Затем включите S3-хранилище в Directus (`Settings → Storage`) и укажите MinIO как источник.

## Работа с Directus

- Snapshot схемы (`directus/snapshot.yaml`) описывает коллекции: `homepage`, `projects`, `procurements`, `documents`, `news_articles`, `contacts`, `about_values` и связи между ними.
- Пример запросов к API см. в `frontend/src/lib/api.ts`. Компоненты используют REST (`/items/...`) с расширениями полей и фильтрами.

## Проверка и тестирование

- Frontend: `npm run lint` (в `uks2/frontend`).
- Схема Directus: `npx directus schema validate snapshot.yaml`.
- Docker Compose: `docker compose config` для проверки синтаксиса.

## Траектория деплоя

1. Подготовить `.env` с боевыми доменами, S3 и SMTP.
2. Запустить `docker compose up -d` на сервере с открытыми портами 80/443.
3. Настроить DNS на домен (`uks2.example.com`, `cms.uks2.example.com`).
4. Создать администратора Directus и заполнить контент через админку.
5. Запустить интеграционные тесты (линтер, e2e) и включить мониторинг Traefik/Directus.

## Полезные команды

```bash
# Перезапуск одного сервиса
docker compose restart frontend

# Просмотр логов Traefik
docker compose logs -f traefik

# Обновление snapshot после изменений в Directus
npx directus schema snapshot snapshot.yaml --yes
```

