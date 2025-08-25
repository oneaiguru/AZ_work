# Таби

Приложение напоминает и контролирует действия, перечисленные в Google Sheets.
Напоминания отображаются в статус-баре, пока действие не выполнено или не истёк
срок выполнения.

## Сборка и тестирование
1. Установите Android Studio и OpenJDK 17.
2. Импортируйте проект (`Проекты/Медицина/Таби`) в Android Studio.
3. Скопируйте `config.json` в каталог `app/src/main/assets`.
4. Выполните в терминале (на Windows используйте `gradlew.bat`):
   ```bash
   ./gradlew assembleDebug    # сборка
   ./gradlew test             # модульные тесты
   ```

## Установка
### Режим разработчика
1. Включите на телефоне **USB‑отладку**.
2. Подключите устройство и выполните (на Windows используйте `gradlew.bat`):
   ```bash
   ./gradlew installDebug
   ```

### Продакшн
1. Сгенерируйте release‑ключ и настройте `signingConfig` в `app/build.gradle.kts`.
2. Соберите релиз (на Windows используйте `gradlew.bat`):
   ```bash
   ./gradlew assembleRelease
   ```
3. Подписанный APK (`app-release.apk`) установите вручную либо загрузите в Google Play.

## Лицензия
MIT License
