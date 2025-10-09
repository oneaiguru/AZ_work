# Устранение проблем с TLS-сертификатами Traefik

Сообщение браузера `ERR_CERT_AUTHORITY_INVALID` означает, что Traefik отдал self-signed сертификат. Это происходит, когда Let's Encrypt не смог выдать валидный сертификат для доменов `uks.delightsoft.ru` и `cms.uks.delightsoft.ru`. Ниже приведён алгоритм диагностики и восстановления.

## 1. Проверить логи Traefik

```bash
docker compose logs -f traefik
```

Ищите строки `legolog` / `acme` с ошибками. Типовые причины:

- `acme: error: 403 :: urn:ietf:params:acme:error:unauthorized` — домен указывает не на этот сервер, либо Cloudflare/прокси подменяет ответ.
- `acme: error: 429 :: too many requests` — превышен лимит Let's Encrypt (ожидайте час и повторите).
- `failed to save certificates` — Traefik не может записать `ops/traefik/acme.json` из-за неверных прав.

## 2. Убедиться в корректности DNS

```bash
dig +short uks.delightsoft.ru
curl -I http://uks.delightsoft.ru/.well-known/acme-challenge/ping
```

Обе команды должны возвращать IP сервера и HTTP 404/401 от Traefik. Если `curl` зависает или возвращает другую страницу, проверьте DNS-записи `A`/`AAAA` и отключите сторонние прокси (например, режим «оранжевой облачки» в Cloudflare) на время выпуска сертификата.

## 3. Проверить права доступа к `acme.json`

Traefik записывает сертификаты в `ops/traefik/acme.json`. Файл должен существовать и иметь права `600`.

```bash
ls -l ops/traefik/acme.json
chmod 600 ops/traefik/acme.json
```

Если файл пустой или повреждён, удалите его и перезапустите Traefik — он создаст новый и попытается выпустить сертификат повторно.

```bash
rm ops/traefik/acme.json
cp /dev/null ops/traefik/acme.json
chmod 600 ops/traefik/acme.json
docker compose restart traefik
```

## 4. Форсировать повторный запрос сертификата

После исправления DNS/прав перезапустите весь стек, затем сделайте пробные запросы с сервера, чтобы инициировать ACME-процесс:

```bash
docker compose up -d
docker compose logs traefik | tail -n 50
curl -I https://uks.delightsoft.ru --resolve uks.delightsoft.ru:443:127.0.0.1
```

Если сертификат ещё не получен, Traefik продолжит попытки. Когда лог содержит `Server responded with a certificate`, откройте сайт в браузере и проверьте цепочку сертификатов.

## 5. Альтернативы при блокировке HTTP-01

Если публичный порт 80 заблокирован (например, корпоративный провайдер), переключитесь на DNS-01 challenge. Добавьте в `.env` ключи Cloudflare и раскомментируйте параметры (пример):

```ini
TRAEFIK_DNS_PROVIDER=cloudflare
TRAEFIK_CF_DNS_API_TOKEN=... # токен с правами Zone.DNS.Edit
```

Затем расширьте секцию `command:` в `docker-compose.yml`:

```yaml
    command:
      - --certificatesresolvers.le.acme.dnschallenge=true
      - --certificatesresolvers.le.acme.dnschallenge.provider=${TRAEFIK_DNS_PROVIDER}
      - --certificatesresolvers.le.acme.dnschallenge.disablepropagationcheck=true
```

DNS-01 позволяет выпускать сертификаты даже при закрытом порте 80, но требует управления DNS через API-провайдера.

## 6. Проверить установленный сертификат

Когда `acme.json` заполнен, убедитесь, что Traefik отдаёт цепочку Let’s Encrypt:

```bash
openssl s_client -connect uks.delightsoft.ru:443 -servername uks.delightsoft.ru -showcerts | openssl x509 -noout -issuer -subject -enddate
```

Вы должны увидеть `issuer=R3` или `Let's Encrypt`. Если выданный сертификат просрочен, удалите `acme.json` и повторите выпуск.

Следуя этим шагам, можно восстановить автоматическую выдачу сертификатов и устранить предупреждение браузера о небезопасном соединении.
