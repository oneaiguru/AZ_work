# Настройка доступа к Google Sheets

1. Создайте проект в [Google Cloud Console](https://console.cloud.google.com/).
2. Включите API **Google Sheets**.
3. Создайте **сервисный аккаунт** и загрузите JSON‑файл с ключами
   (например, `service-account-credentials.json`).
4. В каждой таблице, указанной в `config.json`, добавьте адрес сервисного
   аккаунта как **Editor**.
5. Поместите файл ключей рядом с `config.json` (не храните его в репозитории).

Пример фрагмента `config.json`:
```json
{
  "sheets": [
    {
      "id": "1AbCdEfGhIjKlMnOp",
      "range": "Лист1!A1:E100",
      "credentials": "service-account-credentials.json"
    }
  ]
}
```
