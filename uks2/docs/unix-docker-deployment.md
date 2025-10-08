# Развёртывание UKS2 на Unix-сервере с Docker и Traefik

Этот гайд описывает установку альтернативного стека `uks2/` (Next.js + Directus + Traefik) на Linux-сервере и привязку публичного доменного имени с автоматическим выпуском TLS-сертификата через Let's Encrypt.

## 1. Требования к серверу

- 64‑битная ОС (Ubuntu 22.04+, Debian 12+, Rocky Linux 9 или аналогичная).
- Права sudo и доступ по SSH.
- Открытые порты 80 и 443 из внешней сети (для HTTP-01 challenge и HTTPS).
- Установленные Docker Engine 24+ и Docker Compose Plugin 2.24+.
- Зарегистрированные домены, которые будут вести на фронтенд и CMS (для боевого окружения используются `uks.delightsoft.ru` и `cms.uks.delightsoft.ru`).
- Аккаунт на почте для уведомлений Let's Encrypt (адрес задаётся переменной `TRAEFIK_EMAIL`).

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
   Скрипт создаст `uks2/.env` с уникальными ключами для Directus, PostgreSQL и MinIO.

2. Откройте `.env` и настройте домены и URL:
   - `TRAEFIK_DOMAIN=uks.delightsoft.ru`
   - `NEXT_PUBLIC_SITE_URL=https://uks.delightsoft.ru`
   - `NEXT_PUBLIC_CMS_URL=https://cms.uks.delightsoft.ru`
   - `NEXT_PUBLIC_ASSETS_URL=https://cms.uks.delightsoft.ru/assets`
   - `DIRECTUS_PUBLIC_URL=https://cms.uks.delightsoft.ru`
   - `CMS_INTERNAL_URL=http://directus:8055`
   - `DIRECTUS_COOKIE_DOMAIN=cms.uks.delightsoft.ru`
   - `TRAEFIK_EMAIL=devops@example.ru` (рабочая почта для уведомлений Let’s Encrypt)

3. При необходимости смените `DIRECTUS_ADMIN_EMAIL` / `DIRECTUS_ADMIN_PASSWORD` и другие параметры (SMTP, MinIO бакеты, настройки кэша).

## 4. Настройка Traefik и HTTPS

1. Файл `ops/traefik/acme.json` хранит сертификаты. До первого запуска задайте права:
   ```bash
   chmod 600 ops/traefik/acme.json
   ```
2. Убедитесь, что DNS-записи доменов (`A`/`AAAA`) указывают на IP сервера. Для поддоменов CMS добавьте запись `cms.uks.delightsoft.ru` -> `X.X.X.X`.
3. Если сервер находится за файрволом, откройте порты 80 и 443:
   ```bash
   sudo ufw allow 80/tcp
   sudo ufw allow 443/tcp
   sudo ufw reload
   ```
4. Traefik автоматически выпустит сертификаты через HTTP-01 challenge при первом обращении к доменам. Следите за логами контейнера `traefik`.

## 5. Развёртывание контейнеров

```bash
cd /opt/AZ_work/uks2
docker compose pull
NODE_ENV=production docker compose up -d --build
```

Команда соберёт образ фронтенда, скачает Directus, Traefik, PostgreSQL, Redis и MinIO, затем запустит их в фоне. Проверить статус можно так:
```bash
docker compose ps
docker compose logs -f traefik
docker compose logs -f directus
```

После запуска сервисы будут доступны по HTTPS:
- `https://uks.delightsoft.ru` — публичный сайт (Next.js)
- `https://cms.uks.delightsoft.ru/admin` — панель Directus
- `https://cms.uks.delightsoft.ru/items/...` — REST API Directus
- `https://cms.uks.delightsoft.ru/graphql` — GraphQL API

> Первое обращение к доменам может занять 30–60 секунд, пока Traefik получает сертификат. До завершения процедуры браузер может показывать ошибку 404/502.

## 6. Первичная настройка Directus

1. Зайдите в админку `https://cms.uks.delightsoft.ru/admin` и войдите с данными из `.env`.
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

Примеры бэкапа:
```bash
# PostgreSQL dump
docker compose exec postgres pg_dump -U "$DATABASE_USERNAME" "$DATABASE_NAME" > backup-$(date +%F).sql

# Архивация MinIO
sudo tar czf minio-data-$(date +%F).tar.gz -C /var/lib/docker/volumes/ $(docker volume ls -q | grep minio_data)
```

Настройте регулярное копирование файлов `backup-*.sql` и архивов на внешнее хранилище.

## 9. Устранение неполадок

- **HTTP 400 при логине в Directus** — проверьте `DIRECTUS_PUBLIC_URL` и `DIRECTUS_COOKIE_DOMAIN`, они должны совпадать с фактическим доменом.
- **Traefik не получает сертификат** — убедитесь в доступности порта 80 снаружи и корректности DNS. В логах Traefik ищите сообщения ACME.
- **Directus не стартует из-за схемы** — примените снапшот вручную либо удалите проблемные коллекции через CLI.
- **Нет доступа к MinIO** — проверьте, что бакеты созданы и креденшелы из `.env` совпадают.

После выполнения шагов сайт будет обслуживаться по HTTPS с автоматическим продлением сертификатов и готовой CMS для управления контентом.
