# Устранение проблем с HTTPS в Nginx

Если браузер показывает `ERR_CERT_AUTHORITY_INVALID`, `NET::ERR_CERT_DATE_INVALID` или соединение завершается с 502/526, значит Nginx обслуживает HTTP без корректного TLS или получает ошибку от бэкенда. Ниже приведён чек-лист, который поможет вернуть рабочее HTTPS-соединение.

## 1. Проверить логи Nginx

```bash
docker compose logs -f nginx
```

Обратите внимание на сообщения:
- `failed (2: No such file or directory) while opening certificate file` — в конфигурации указан неверный путь к `fullchain.pem` или `privkey.pem`.
- `SSL_do_handshake() failed` — клиент завершил рукопожатие из-за неподдерживаемого шифра или устаревшего сертификата.
- `connect() failed (111: Connection refused)` — бекенд (frontend/directus/pgadmin) не запущен или слушает другой порт.

## 2. Убедиться, что Nginx слушает порт 443

```bash
sudo ss -tlnp | grep ':443'
```

Если порт не открыт, проверьте, что в `ops/nginx/default.conf` есть блок `listen 443 ssl http2;` и контейнер запущен с монтированным каталогом сертификатов:
```yaml
volumes:
  - ./ops/nginx/default.conf:/etc/nginx/conf.d/default.conf:ro
  - ./ops/nginx/certs:/etc/nginx/certs:ro
```

## 3. Проверить сертификаты

```bash
ls -l ops/nginx/certs
openssl x509 -in ops/nginx/certs/fullchain.pem -noout -dates -subject -issuer
```

Убедитесь, что файлы существуют, читаемы контейнером (права `600/640`) и срок действия `notAfter` не истёк. При необходимости заново запустите Certbot:
```bash
sudo certbot certonly --standalone -d uks.delightsoft.ru
sudo cp /etc/letsencrypt/live/uks.delightsoft.ru/fullchain.pem /opt/AZ_work/uks2/ops/nginx/certs/
sudo cp /etc/letsencrypt/live/uks.delightsoft.ru/privkey.pem /opt/AZ_work/uks2/ops/nginx/certs/
sudo chown root:root /opt/AZ_work/uks2/ops/nginx/certs/*.pem
sudo chmod 600 /opt/AZ_work/uks2/ops/nginx/certs/*.pem
```

После обновления сертификатов перезапустите контейнер:
```bash
docker compose up -d nginx
```

## 4. Проверить конфигурацию префиксов

Если сайт открывается, но `/admin` или `/db` отвечают 404/редиректят на корень, убедитесь, что:
- В `ops/nginx/default.conf` есть блоки `location /admin/` и `location /db/`.
- В `.env` задан `PGADMIN_BASE_PATH=/db`, а `DIRECTUS_PUBLIC_URL` и `DIRECTUS_REFRESH_COOKIE_PATH` указывают на `https://<домен>/admin` и `/admin` соответственно.
- После изменения `.env` перезапущены `pgadmin`, `directus` и `nginx`.

## 5. Проверить цепочку сертификатов со стороны клиента

```bash
openssl s_client -connect uks.delightsoft.ru:443 -servername uks.delightsoft.ru -showcerts | openssl x509 -noout -issuer -subject -enddate
```

В ответе должен быть валидный выпуск Let’s Encrypt (issuer `R3`/`E1`) или ваш собственный CA. Если отображается `self signed`, значит Nginx читает не тот `fullchain.pem`.

## 6. Разрешить HTTP→HTTPS редирект

Чтобы избежать двойной конфигурации, добавьте в `default.conf` блок, который перенаправляет весь трафик с 80 на 443:
```nginx
server {
    listen 80;
    server_name uks.delightsoft.ru;
    return 301 https://$host$request_uri;
}
```

Поместите его перед основным сервером HTTPS. После правок выполните `docker compose up -d nginx`.

Следуя этим шагам, можно восстановить рабочее HTTPS-соединение и корректный доступ к `/`, `/admin` и `/db` через Nginx.
