# Развёртывание УКС Иркутск 2 на Unix-сервере

Пошаговое руководство по подготовке окружения, запуску Docker Compose и сопровождению проекта.

## 1. Подготовка сервера

1. Обновите систему и установите зависимые пакеты:
   ```bash
   sudo apt update && sudo apt upgrade -y
   sudo apt install -y curl ca-certificates gnupg git
   ```
2. Установите Docker Engine и Docker Compose (plugin):
   ```bash
   curl -fsSL https://get.docker.com | sh
   sudo usermod -aG docker $USER
   newgrp docker
   ```
3. Проверьте версии:
   ```bash
   docker --version
   docker compose version
   ```

## 2. Настройка DNS и доменов

- Создайте A/AAAA записи для `uks.delightsoft.ru`, `cms.uks.delightsoft.ru`, `db.uks.delightsoft.ru`, указывающие на IP сервера.
- Для локальной отладки используйте домены `uks3.uks2.localhost`, `cms.uks2.localhost`, `db.uks2.localhost`.
- Для DNS-01 challenge Traefik установите переменные `TRAEFIK_ACME_CHALLENGE=dns01` и `TRAEFIK_DNS_PROVIDER` (поддерживаются провайдеры Traefik).

## 3. Получение кода и генерация `.env`

```bash
git clone <repo-url>
cd uks3
./scripts/generate-env.js          # создаст .env
```

> При необходимости перезаписать `.env` — используйте `--force`. Для ротации пароля БД без пересоздания файла — `--rotate-db-password`.

Отредактируйте `.env` и укажите:

- `TRAEFIK_EMAIL` — почта для Let's Encrypt.
- `TRAEFIK_ACME_CHALLENGE` — метод (http01/tlsalpn01/dns01).
- `MINIO_BUCKET_PUBLIC` и `MINIO_BUCKET_PRIVATE` — названия бакетов (создаются позже).
- `NEXT_PUBLIC_SITE_URL` и `NEXT_PUBLIC_DIRECTUS_URL` — публичные URL.

## 4. Запуск Docker Compose

```bash
docker compose up --build -d
```

Проверьте статусы:

```bash
docker compose ps
docker compose logs traefik -f
```

Traefik автоматически создаст файл `traefik_letsencrypt/acme.json` с правами 600.

## 5. Пост-инициализация

1. Примените snapshot схемы Directus:
   ```bash
   docker compose exec directus npx directus schema apply --yes /directus/snapshot.yaml
   ```
2. Создайте бакеты в MinIO (требует mc внутри контейнера):
   ```bash
   docker compose exec minio /bin/sh -c "mc alias set local http://localhost:9000 $MINIO_ROOT_USER $MINIO_ROOT_PASSWORD && mc mb local/$MINIO_BUCKET_PUBLIC && mc mb local/$MINIO_BUCKET_PRIVATE"
   ```
3. Настройте pgAdmin: добавьте новое соединение с host `postgres`, порт 5432, пользователь `${POSTGRES_USER}`.

## 6. Обновление и резервное копирование

- **Обновление контейнеров**:
  ```bash
  docker compose pull
  docker compose up -d --build
  ```
- **Бэкап PostgreSQL**:
  ```bash
  docker compose exec postgres pg_dump -U $POSTGRES_USER $POSTGRES_DB > backups/$(date +%F)_uks3.sql
  ```
- **Бэкап MinIO** — используйте `mc mirror` на внешний storage.
- **Снимок Directus** — `docker compose exec directus npx directus schema snapshot /directus/snapshot.yaml`.

## 7. Troubleshooting

| Компонент | Симптом | Решение |
| --------- | ------- | ------- |
| Traefik | Сертификаты не выдаются | Проверьте порты 80/443, домены, `TRAEFIK_EMAIL`. Для dns01 убедитесь в переменной `TRAEFIK_DNS_PROVIDER`. |
| Traefik | Ошибка прав `acme.json` | Удалите том `traefik_letsencrypt` и перезапустите — entrypoint выставит права 600. |
| Directus | 503 / нет соединения с БД | Убедитесь, что `postgres` в статусе healthy, обновите `.env`, перезапустите `directus`. |
| Directus | Кэш не чистится | Выполните `docker compose exec directus npx directus cache:clear`. |
| Directus | Ошибка snapshot | Проверьте YAML на валидность, повторите `schema apply`. |
| MinIO | Недоступен UI на 9001 | Откройте порт через Traefik или временно пробросьте `- 9001:9001` для отладки. |
| MinIO | Не создаются бакеты | Убедитесь, что команда `mc` выполнена внутри контейнера с корректными кредами. |
| MinIO | Ошибка `.usage.json` / `.bloomcycle.bin` | Удалите поврежденные файлы в каталоге бакета (`rm /data/<bucket>/.usage.json`) и перезапустите контейнер — MinIO пересоздаст служебные индексы. |

## 8. Обновление сертификатов вручную

Traefik автоматически продлевает сертификаты. Для принудительного обновления удалите запись в `acme.json` и перезапустите контейнер (не рекомендуется без необходимости).

## 9. Мониторинг и логирование

- Traefik Dashboard: `https://<сервер>:8080` (только локально или за VPN).
- Логи: `docker compose logs -f <service>`.
- Настройте внешние алерты (Prometheus/Alertmanager) при необходимости.

