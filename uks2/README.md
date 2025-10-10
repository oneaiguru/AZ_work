# УКС Иркутск — Next.js + Directus + Nginx

Альтернативный стек для сайта Управления капитального строительства г. Иркутска. Вариант `uks2/` использует фронтенд на Next.js 14, Headless CMS Directus 11 и Nginx в роли реверс-прокси. Инфраструктура разворачивается через Docker Compose вместе с PostgreSQL, Redis и MinIO.

## Структура проекта

```
uks2/
├── frontend/        # Next.js 14 приложение (App Router, TypeScript)
├── directus/        # Конфигурация Directus (snapshot, расширения, Dockerfile)
├── ops/nginx/       # Конфигурация reverse-proxy Nginx
├── scripts/         # Вспомогательные утилиты
├── docker-compose.yml
├── .env.example
└── README.md
```

## Предварительные требования

- Node.js 22+ и npm 10+ (для локальной разработки CLI Directus; фронтенд можно запускать на Node 20, но Directus 11 требует Node 22)
- Docker Engine 24+ и Docker Compose Plugin 2.24+
- Возможность при необходимости добавить запись в `/etc/hosts` (например, `127.0.0.1 uks2.localhost`), чтобы проксировать домен через локальный Nginx.

## Настройка окружения

1. Сгенерируйте файл окружения со случайными секретами:
   ```bash
   node scripts/generate-env.js
   ```
   Скрипт создаст `uks2/.env` на основе `.env.example`. При повторном запуске добавьте `--force`, чтобы перезаписать значения, —
   при этом текущий `DATABASE_PASSWORD` будет сохранён, чтобы не потерять доступ к существующей базе. Если нужно сгенерировать
   новый пароль, добавьте `--rotate-db-password`: скрипт попытается выполнить `ALTER USER` внутри контейнера PostgreSQL через
   `docker compose exec`. Если Docker недоступен или контейнер не запущен, выполните команду вручную:
   ```bash
   docker compose exec postgres psql -U "$DATABASE_USERNAME" -d "$DATABASE_NAME" -c "ALTER USER \"$DATABASE_USERNAME\" WITH PASSWORD '$DATABASE_PASSWORD';"
   ```
   > ⚠️ Если команда выполняется через `sudo` и вы видите `Error: ENOENT: no such file or directory, uv_cwd`, значит root-пользователь не может обратиться к текущему каталогу. Запустите генератор от обычного пользователя (без `sudo`) либо выполните `sudo bash -c 'cd /opt/AZ_work/uks2 && node scripts/generate-env.js --force'`, подставив фактический путь до каталога `uks2`.
2. Если хотите открывать стек по читаемому домену (например, `uks2.localhost`), добавьте строку `127.0.0.1 uks2.localhost` в `/etc/hosts`. Так Nginx будет проксировать все запросы на `http://uks2.localhost`, `http://uks2.localhost/cms` и `http://uks2.localhost/db`.
3. Обновите URL и cookie-параметры в `.env`: `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_CMS_URL`, `NEXT_PUBLIC_ASSETS_URL`, `DIRECTUS_PUBLIC_URL`, `DIRECTUS_COOKIE_DOMAIN`, `DIRECTUS_REFRESH_COOKIE_PATH` и `PGADMIN_BASE_PATH`. В продакшн-конфигурации используется `https://uks.delightsoft.ru`, поэтому значения уже включают подкаталоги `/cms` и `/db`. Для локального запуска замените их, например, на `http://uks2.localhost`, `http://uks2.localhost/cms`, `http://uks2.localhost/cms/assets`, `DIRECTUS_COOKIE_DOMAIN=` (пустая строка) и `PGADMIN_BASE_PATH=/db`. Если вы работаете по HTTP, дополнительно установите `DIRECTUS_REFRESH_COOKIE_SECURE=false`, чтобы Directus выдавал cookie без флага `Secure`.

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
После запуска админка будет доступна на <http://localhost:8055/admin>. Создайте пользователя с учётными данными из `.env` (`DIRECTUS_ADMIN_EMAIL`, `DIRECTUS_ADMIN_PASSWORD`). Чтобы работать через Nginx по пути `/cms`, обновите `DIRECTUS_PUBLIC_URL` (например, `http://uks2.localhost/cms`) и при необходимости `DIRECTUS_COOKIE_DOMAIN` — значения должны совпадать с адресом, который вы используете в браузере.

## Запуск через Docker Compose

```bash
cd uks2
docker compose up --build
```

> ℹ️ **Windows**: Убедитесь, что Docker Desktop запущен и доступен через named pipe `//./pipe/dockerDesktopLinuxEngine`. Если команда завершается ошибкой `unable to get image 'nginx:1.27-alpine'`, значит Docker Engine не запущен или потеряно подключение к Docker Hub. Перезапустите Docker Desktop и повторите `docker compose up --build`. При желании можно заранее выполнить `docker pull nginx:1.27-alpine`.

Сервисы и точки входа (по умолчанию, см. `.env`):
- `https://uks.delightsoft.ru` — публичный фронтенд.
- `https://uks.delightsoft.ru/cms` — Directus (REST, GraphQL, админка доступна по `/cms/admin`).
- `https://uks.delightsoft.ru/db` — pgAdmin (PostgreSQL UI, логин/пароль из `PGADMIN_DEFAULT_EMAIL` / `PGADMIN_DEFAULT_PASSWORD`).
- `http://uks2.localhost`, `http://uks2.localhost/cms` и `http://uks2.localhost/db` — пример локальной среды через `/etc/hosts`.
- `http://localhost:8055` — прямой доступ к Directus без Nginx-прокси.
- `http://localhost:9001` — MinIO console (логин/пароль из `.env`).
- `redis://localhost:6379` — Redis для кеша Directus.

### Продакшн на Unix-сервере

Для пошаговой установки на Linux-сервере с публичным доменом и подключением сертификатов см. документ [docs/unix-docker-deployment.md](docs/unix-docker-deployment.md). В нём описаны требования, настройка DNS, генерация `.env`, подготовка Nginx и регулярное обслуживание контейнеров. Если браузер сообщает о недоверенном сертификате (`ERR_CERT_AUTHORITY_INVALID`), следуйте инструкции [docs/https-troubleshooting.md](docs/https-troubleshooting.md). Для разбора типовых ошибок Directus (например, `password authentication failed for user "uks2"`) загляните в [docs/directus-troubleshooting.md](docs/directus-troubleshooting.md). Для генерации системы с нуля на основе ИИ можно воспользоваться готовым [промптом](docs/uks2-system-prompt.md), который описывает целевую архитектуру, дизайн и структуру данных.

### Для чего нужен Redis

Redis выступает высокоскоростным хранилищем для Directus. Он используется для:
- кеширования ответов GraphQL/REST,
- хранения rate-limit и счётчиков,
- потенциального расширения очередями (flows, webhooks).

Без него Directus будет работать, но производительность и устойчивость к нагрузкам ниже.

### Базовый favicon для Directus

В директории `directus/extensions/app/public/` лежит векторный favicon в формате SVG. Переменная окружения `DIRECTUS_APP_ICON` указывает Directus использовать его вместо стандартного `favicon.ico`, благодаря чему админка не делает запросы к отсутствующему бинарному файлу.

### Cookie Directus и ошибки 400

Directus хранит refresh-токен в HTTP-only cookie. Если домен в cookie не совпадает с доменом в адресной строке, запрос `/auth/refresh` или `/auth/login` вернёт 400. Используйте `DIRECTUS_COOKIE_DOMAIN` (пустая строка = автоматический выбор текущего домена), а также `DIRECTUS_REFRESH_COOKIE_SECURE` и `DIRECTUS_REFRESH_COOKIE_SAME_SITE`, чтобы подстроить поведение под локальные и боевые домены. В `.env.example` по умолчанию установлено значение `.uks.delightsoft.ru`, чтобы cookie были доступны как для `cms.uks.delightsoft.ru`, так и для API-запросов фронтенда.

### Подготовка бакетов MinIO

После первого запуска создайте бакеты для публичных и приватных файлов:
```bash
docker compose exec minio mc alias set local http://minio:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD"
docker compose exec minio mc mb -p local/$MINIO_BUCKET_PUBLIC
docker compose exec minio mc mb -p local/$MINIO_BUCKET_PRIVATE
```
Затем включите S3-хранилище в Directus (`Settings → Storage`) и укажите MinIO как источник.

#### Устранение ошибок сканера MinIO

При некорректном завершении работы локального хранилища MinIO может появляться сообщение `has incomplete body` о повреждённых
файлах `.usage.json` или `.bloomcycle.bin` внутри каталога `.minio.sys/buckets`. Контейнер `minio` запускается через скрипт
`ops/minio/start-minio.sh`, который автоматически удаляет эти временные файлы перед стартом сервера, чтобы сканер MinIO
пересоздал их заново. Если ошибка повторяется, остановите стек и вручную очистите каталог `minio_data` или выполните
`docker volume rm uks2_minio_data` перед повторным запуском.

## Работа с Directus

- Snapshot схемы (`directus/snapshot.yaml`) описывает коллекции: `homepage`, `projects`, `procurements`, `documents`, `news_articles`, `contacts`, `about_values` и связи между ними.
- Пример запросов к API см. в `frontend/src/lib/api.ts`. Компоненты используют REST (`/items/...`) с расширениями полей и фильтрами.

## Инструкция по управлению контентом (Directus)

Полная пошаговая инструкция вынесена в отдельный документ — [docs/directus-content-management.md](docs/directus-content-management.md). Ниже приведено краткое резюме для быстрого старта.

Инструкция предназначена для редакторов и контент-менеджеров, которые обновляют разделы сайта: новости, проекты, закупки и документы.

### 1. Вход в админку

1. Откройте <http://uks2.localhost/cms/admin> (либо домен, указанный в `DIRECTUS_PUBLIC_URL`).
2. Авторизуйтесь под пользователем, созданным при bootstrap (`DIRECTUS_ADMIN_EMAIL` / `DIRECTUS_ADMIN_PASSWORD`).
3. При необходимости создайте отдельных редакторов в разделе **Настройки → Пользователи** и назначьте им роль `editor`.

### 2. Работа с медиатекой

1. Перейдите в раздел **Файлы**.
2. Нажмите **Загрузить** и добавьте изображения (WebP/JPEG/PNG). Directus сохранит их в бакете MinIO, указанном в настройках.
3. Заполните поля **Название**, **Описание**, **Alt-текст** — эти данные выводятся на сайте и помогают SEO.
4. При необходимости создайте папки (`Добавить → Папка`) для группировки изображений (например, `news`, `projects`).

### 3. Публикация новости с иллюстрацией

1. Откройте коллекцию **news_articles** → **Создать элемент**.
2. Заполните поля:
   - **title** — заголовок статьи.
   - **slug** — URL (латиницей, без пробелов).
   - **published_at** — дата публикации.
   - **excerpt** — краткое описание для карточки.
   - **content** — основной текст (Markdown/WYSIWYG).
   - **cover** — выберите изображение из медиатеки (кнопка **Выбрать файл**).
3. Прикрепите связанные проекты или теги, если это требуется.
4. Установите статус **Опубликовано** и сохраните элемент. Статья появится в разделе `/zakupki` и на главной странице в блоке новостей (в соответствии с настройками фронтенда).

### 4. Добавление галереи к проекту

1. Перейдите в коллекцию **projects** и откройте существующий проект либо создайте новый.
2. В блоке **gallery** добавьте один или несколько элементов типа `project_gallery_item`.
3. Для каждого элемента выберите изображение (поле **image**) и заполните подпись (поле **caption**).
4. Укажите ключевые поля проекта: год, тип, статус, описание, координаты и связанные документы.
5. Сохраните изменения. Галерея автоматически обновится на фронтенде (`/projects` и `/projects/[slug]`).

### 5. Управление закупками и коммерческими помещениями

1. В коллекции **procurements** создайте запись или откройте существующую.
2. Заполните название, тип, статус, даты приёма заявок, контакты менеджера.
3. В поле **documents** прикрепите файлы (PDF/DOC). Directus проверит размер и MIME-типы согласно настройкам.
4. Для ссылок на ЕИС используйте многострочное поле **eis_links** — каждую ссылку вводите с новой строки.
5. Используйте статусы `draft`, `review`, `published`, `archived` для управления видимостью на сайте. Менеджеры закупок могут сохранять черновики, редактор утверждает публикацию.

### 6. Документы и реквизиты

1. Коллекция **documents** хранит публичные файлы. Укажите название, тип, дату публикации и сам файл.
2. Поле **is_visible** определяет отображение на странице `/documents`.
3. Для реквизитов организации используйте таблицу **contacts** и блоки `about_values` (они выводятся в разделах «О компании» и «Контакты»).

### 7. Проверка публикации

1. Откройте сайт (`https://uks2.localhost` или указанный домен) и убедитесь, что изменения появились.
2. В случае работы через предварительный просмотр используйте встроенную кнопку **Просмотр** в Directus (находится в карточке записи, если включены flow/operations).
3. Если контент не отображается, проверьте статус записи и кеш. При необходимости очистите кеш через **Настройки → Система → Очистить кеш**.

### 8. Советы по управлению версиями

- Directus хранит историю изменений (таблица `directus_revisions`). Используйте кнопку **История** на карточке записи, чтобы откатить правки.
- Настройте уведомления (flows, webhooks) для контроля публикаций закупок или новостей.
- Регулярно делайте snapshot схемы: `npx directus schema snapshot snapshot.yaml --yes`, чтобы синхронизировать структуру между средами.

### 9. Резервное копирование

- База данных: `pg_dump` по расписанию.
- Файлы: `mc mirror` для MinIO или другой S3-совместимый бэкап.
- Snapshot Directus: `directus schema snapshot`, а также экспорт ролей и пользователей при необходимости.

## Проверка и тестирование

- Frontend: `npm run lint` (в `uks2/frontend`).
- Схема Directus: `npx directus schema validate snapshot.yaml`.
- Docker Compose: `docker compose config` для проверки синтаксиса.

## Траектория деплоя

1. Подготовить `.env` с боевыми доменами, S3 и SMTP.
2. Запустить `docker compose up -d` на сервере с открытыми портами 80/443.
   Все сервисы в `docker-compose.yml` настроены с политикой `restart: unless-stopped`, поэтому после перезагрузки Docker Engine
   или самого сервера контейнеры автоматически восстановятся.
3. Настроить DNS на домен (`uks.delightsoft.ru` или локальный аналог `uks2.example.com`).
4. Создать администратора Directus и заполнить контент через админку.
5. Запустить интеграционные тесты (линтер, e2e) и включить мониторинг Nginx/Directus.

## Полезные команды

```bash
# Перезапуск одного сервиса
docker compose restart frontend

# Просмотр логов Nginx
docker compose logs -f nginx

# Обновление snapshot после изменений в Directus
npx directus schema snapshot snapshot.yaml --yes
```

