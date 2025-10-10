# Развёртывание UKS2 на Unix-сервере с Docker и Nginx

Этот гайд описывает установку альтернативного стека `uks2/` (Next.js + Directus + Nginx) на Linux-сервере и привязку публичного домена. По умолчанию Nginx публикует HTTP на 80‑м порту, а HTTPS настраивается вручную — вы можете использовать Certbot, внешний балансировщик или существующие сертификаты и смонтировать их в контейнер.

## 1. Требования к серверу

- 64‑битная ОС (Ubuntu 22.04+, Debian 12+, Rocky Linux 9 или аналогичная).
- Права sudo и доступ по SSH.
- Открытый порт 80 из внешней сети. Порт 443 понадобится, если Nginx будет обслуживать HTTPS напрямую.
- Установленные Docker Engine 24+ и Docker Compose Plugin 2.24+.
- Домены, которые ведут на сервер (в бою используется `uks.delightsoft.ru`).
- (Опционально) Готовые сертификаты или возможность запустить Certbot/lego для выпуска Let’s Encrypt.

### 1.1 Установка Docker и Compose (Ubuntu/Debian)
```bash
sudo apt update
sudo apt install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/$(. /etc/os-release && echo "$ID")/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/$(. /etc/os-release && echo "$ID") \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker "$USER"
newgrp docker
```

Проверьте работу Docker:
```bash
docker version
docker compose version
```

## 2. Клонирование репозитория
```bash
cd /opt
sudo git clone https://example.com/your/remote.git AZ_work
sudo chown -R $USER:$USER AZ_work
cd AZ_work/uks2
```

> Замените URL на фактический адрес вашего репозитория.

## 3. Подготовка переменных окружения

1. Скопируйте пример окружения либо воспользуйтесь генератором секретов:
   ```bash
   node scripts/generate-env.js --force
   ```
   Если Node.js не установлен, запустите генератор через контейнер:
   ```bash
   docker run --rm -v "$(pwd)":/app -w /app node:22 node scripts/generate-env.js --force
   ```
   Скрипт создаст `uks2/.env` с уникальными ключами для Directus, PostgreSQL и MinIO. Существующий `DATABASE_PASSWORD`
   сохраняется, поэтому перегенерация `.env` не ломает доступ к базе. Чтобы сменить пароль и применить его к живой БД,
   добавьте флаг `--rotate-db-password` — генератор попробует выполнить `ALTER USER` внутри работающего контейнера PostgreSQL.
   Если Docker недоступен или база не запущена, выполните команду вручную:
   ```bash
   docker compose exec postgres psql -U "$DATABASE_USERNAME" -d "$DATABASE_NAME" -c "ALTER USER \"$DATABASE_USERNAME\" WITH PASSWORD '$DATABASE_PASSWORD';"
   ```
   Если вы запускаете генератор через `sudo` и получаете ответ `Error: ENOENT: no such file or directory, uv_cwd`, выполните команду от своего пользователя (без `sudo`). Либо запустите `sudo bash -c 'cd /opt/AZ_work/uks2 && node scripts/generate-env.js --force'`, заменив путь на фактическое расположение каталога `uks2` — так root сначала перейдёт в нужную директорию и ошибка пропадёт.

2. Откройте `.env` и настройте основные URL и базовые пути:
   - `NEXT_PUBLIC_SITE_URL=https://uks.delightsoft.ru`
   - `NEXT_PUBLIC_CMS_URL=https://uks.delightsoft.ru/admin`
   - `NEXT_PUBLIC_ASSETS_URL=https://uks.delightsoft.ru/admin/assets`
   - `DIRECTUS_PUBLIC_URL=https://uks.delightsoft.ru/admin`
   - `DIRECTUS_COOKIE_DOMAIN=.uks.delightsoft.ru`
   - `DIRECTUS_REFRESH_COOKIE_PATH=/admin`
   - `PGADMIN_BASE_PATH=/db`
   - `CMS_INTERNAL_URL=http://directus:8055`

   Для локальной среды можно использовать `http://uks2.localhost`, `http://uks2.localhost/admin`, `DIRECTUS_COOKIE_DOMAIN=` (пустое значение) и `PGADMIN_BASE_PATH=/db`. Если вы обслуживаете сайт по HTTP, установите `DIRECTUS_REFRESH_COOKIE_SECURE=false`, чтобы Directus устанавливал cookie без флага Secure.

3. При необходимости скорректируйте SMTP, MinIO, Redis и учётные данные админов (`DIRECTUS_ADMIN_EMAIL`, `PGADMIN_DEFAULT_EMAIL` и т. д.).

## 4. Настройка Nginx и HTTPS

Файл `ops/nginx/default.conf` уже содержит правила для проксирования:
- `/` → Next.js (`frontend:3000`)
- `/admin/` → Directus (`directus:8055`)
- `/db/` → pgAdmin (`pgadmin:80`)

По умолчанию контейнер слушает только HTTP (порт 80). Чтобы включить HTTPS:

1. Выпустите сертификат любым удобным способом (например, `certbot certonly --standalone -d uks.delightsoft.ru`).
2. Скопируйте `fullchain.pem` и `privkey.pem` в каталог `ops/nginx/certs/` и выставьте права `600`.
3. Добавьте в `docker-compose.yml` монтирование каталога с сертификатами:
   ```yaml
   nginx:
     volumes:
       - ./ops/nginx/default.conf:/etc/nginx/conf.d/default.conf:ro
       - ./ops/nginx/certs:/etc/nginx/certs:ro
   ```
4. Расширьте `ops/nginx/default.conf`, добавив серверный блок `listen 443 ssl http2;` с путями к сертификатам и редиректом с HTTP на HTTPS.
5. Перезапустите стек: `docker compose up -d nginx`.

Альтернатива — оставить контейнер на 80‑м порту, а TLS терминировать на внешнем балансировщике/ingress.

## 5. Развёртывание контейнеров

```bash
cd /opt/AZ_work/uks2
docker compose pull
NODE_ENV=production docker compose up -d --build
```

Команда соберёт образ фронтенда, скачает Directus, PostgreSQL, Redis, MinIO, pgAdmin и Nginx, затем запустит их в фоне. Все сервисы настроены с политикой `restart: unless-stopped`, поэтому после перезагрузки Docker Engine или самого сервера они автоматически поднимутся. Проверить статус можно так:
```bash
docker compose ps
docker compose logs -f nginx
docker compose logs -f directus
```

После запуска сервисы будут доступны по адресам из `.env`, например:
- `https://uks.delightsoft.ru` — публичный сайт (Next.js)
- `https://uks.delightsoft.ru/admin` — панель Directus
- `https://uks.delightsoft.ru/admin/items/...` — REST API Directus
- `https://uks.delightsoft.ru/admin/graphql` — GraphQL API
- `https://uks.delightsoft.ru/db` — pgAdmin (PostgreSQL UI)

Если TLS настроен внешним балансировщиком, замените `https://` на актуальную схему.

## 6. Первичная настройка Directus

1. Зайдите в админку `https://uks.delightsoft.ru/admin` и войдите с данными из `.env`.
2. Проверьте раздел **Settings → Storage** и привяжите бакеты MinIO (публичный и приватный).
3. Включите запланированные задачи (flows) или интеграции, если они нужны.
4. Создайте пользователей-редакторов и назначьте им готовые роли из снапшота.
5. Примените схему из снапшота при необходимости:
   ```bash
   docker compose exec directus npx directus schema apply /directus/snapshot.yaml
   ```

## 7. Обновление и перезапуск

- Для обновления фронтенда выполните `git pull`, пересоберите образ и перезапустите контейнеры:
  ```bash
  git pull
  docker compose build frontend
  docker compose up -d frontend
  ```
- Для обновления Directus смените тег образа в `docker-compose.yml`, выполните `docker compose pull directus` и перезапустите сервис.

## 8. Резервное копирование

Постоянные данные хранятся в docker volumes:
- `postgres_data` — база Directus
- `minio_data` — файлы и медиа
- `pgadmin_data` — пользовательские настройки pgAdmin (подключения, избранные запросы)

Примеры бэкапа:
```bash
# PostgreSQL dump
docker compose exec postgres pg_dump -U "$DATABASE_USERNAME" "$DATABASE_NAME" > backup-$(date +%F).sql

# Архивация MinIO
sudo tar czf minio-data-$(date +%F).tar.gz -C /var/lib/docker/volumes/ $(docker volume ls -q | grep minio_data)
```

Настройте регулярное копирование файлов `backup-*.sql` и архивов на внешнее хранилище.

## 9. Устранение неполадок

- **HTTP 400 при логине в Directus** — проверьте `DIRECTUS_PUBLIC_URL`, `DIRECTUS_COOKIE_DOMAIN` и `DIRECTUS_REFRESH_COOKIE_PATH`, они должны соответствовать фактическому адресу.
- **Nginx отдаёт 502/504** — убедитесь, что контейнеры `frontend`, `directus` и `pgadmin` запущены (`docker compose ps`). Проверьте их логи.
- **pgAdmin открывается без стилей или ломается авторизация** — значение `PGADMIN_BASE_PATH` должно совпадать с префиксом в конфигурации Nginx (`/db`). После изменения обновите `.env`, перезапустите `pgadmin` и `nginx`.
- **Directus перезапускается с ошибкой `password authentication failed for user "uks2"`** — пароль в `.env` не совпадает с тем, что хранится в PostgreSQL. Алгоритм восстановления:
  1. Убедитесь, что контейнер PostgreSQL запущен: `docker compose up -d postgres`.
  2. Найдите в текущем `.env` значения `DATABASE_USERNAME`, `DATABASE_NAME`, `DATABASE_PASSWORD`.
  3. Экранируйте новый пароль и выполните `ALTER USER`, чтобы установить значение из `.env`:
     ```bash
     SQL_PASSWORD=$(printf "%s" "$DATABASE_PASSWORD" | sed "s/'/''/g")
     PGPASSWORD='<старый_пароль>' docker compose exec -T postgres \
       psql -U "$DATABASE_USERNAME" -d "$DATABASE_NAME" \
       -c "ALTER USER \"$DATABASE_USERNAME\" WITH PASSWORD '$SQL_PASSWORD'"
     ```
  4. Перезапустите Directus: `docker compose restart directus` и проверьте логи `docker compose logs -f directus`.
  5. Подробная инструкция с дополнительными сценариями приведена в [docs/directus-troubleshooting.md](directus-troubleshooting.md).
- **Нет доступа к MinIO** — проверьте, что бакеты созданы и креденшелы из `.env` совпадают.
- **MinIO пишет `has incomplete body` по файлам `.usage.json` / `.bloomcycle.bin`** — после некорректной остановки могут повредиться временные метаданные. При следующем запуске контейнер выполнит `ops/minio/start-minio.sh` и удалит эти файлы, чтобы MinIO пересоздал их. Если сообщение остаётся, остановите стек и удалите локальный том `docker volume rm uks2_minio_data`.

После выполнения шагов сайт будет обслуживаться Nginx, а CMS и pgAdmin будут доступны по вложенным путям `/admin` и `/db`.
