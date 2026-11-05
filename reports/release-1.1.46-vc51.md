# Android 1.1.46 / versionCode 51

Сборка завершена 01.11.2026 (Москва).

- AAB: [blockblast-1.1.46-vc51-release.aab](C:/Users/Dima2/Documents/blockblast/dist/blockblast-1.1.46-vc51-release.aab)
- Пакет: `com.intstrfloat.blockblast`
- Версия: **1.1.46**, `versionCode` **51**
- Размер: **121 077 691 байт / 115,47 МиБ**
- SHA-256 файла: `1478F418D33FC962995896F1F5A16BD4FAF4281310A04FF0C46588A148504ED0`
- SHA-256 сертификата: `74:2D:E4:9B:C8:AC:57:19:FD:64:02:94:0F:A8:13:C1:A9:8C:D8:50:B6:7F:40:5B:1D:13:DE:D7:5E:6D:20:E3`
- Архитектуры: `arm64-v8a`, `armeabi-v7a`, `x86`, `x86_64`.

## Изменения и проверки

Версии повышены в [app.json](C:/Users/Dima2/Documents/blockblast/app.json), [package.json](C:/Users/Dima2/Documents/blockblast/package.json), двух корневых записях [package-lock.json](C:/Users/Dima2/Documents/blockblast/package-lock.json) и [android/app/build.gradle](C:/Users/Dima2/Documents/blockblast/android/app/build.gradle). Сборка включает текущие исправления производительности, завершения уровней и верхней панели. Существующий release-ключ сохранён; его SHA-256 до и после сборки совпал.

- `npm run lint`: exit 0; 0 ошибок, одно прежнее предупреждение `seasons.ts:35`.
- `npm run typecheck`: exit 0.
- `npx jest --runInBand`: **196 наборов / 1331 тест прошли**.
- `npm run backend:test`: **16 тестов прошли**.
- `bundleRelease --rerun-tasks`: **BUILD SUCCESSFUL**, 822 задачи выполнены, 53 мин 35 с. Служебный init-скрипт ограничивает параллелизм Metro и CMake, сохраняя production entry и release-подпись.
- `jarsigner -verify -verbose -certs`: exit 0, `jar verified`; сертификат соответствует опубликованной игре.
- `keytool -printcert -jarfile`: exit 0; ожидаемый SHA-256 сертификата подтверждён.
- `bundletool validate`: exit 0.
- `bundletool dump manifest`: пакет, 1.1.46 / 51 и отсутствие `debuggable` проверены непосредственно в AAB.
- Проверены production entry `expo-router/entry`, отсутствие QA entry в source map и bundle, совпадение встроенного Hermes bundle со сборочным файлом.
- `ANDROID_SYNCHRONOUSLY_UPDATE_UI_PROPS:true` подтверждён в CMake-конфигурациях всех четырёх архитектур.

Логи и машиночитаемый результат: [output/release-1.1.46-vc51](C:/Users/Dima2/Documents/blockblast/output/release-1.1.46-vc51), [artifact-verification.json](C:/Users/Dima2/Documents/blockblast/output/release-1.1.46-vc51/artifact-verification.json).

Предупреждения jarsigner о self-signed сертификате, timestamp и порядке ZIP-записей соответствуют прежним релизам; проверка JarFile и bundletool успешна. Итоговый AAB в этом шаге не запускался на устройстве. Предыдущие проверки игрового процесса и компоновки описаны в [отчёте производительности](C:/Users/Dima2/Documents/blockblast/reports/gameplay-performance-2026-10-30.json) и [отчёте верхней панели](C:/Users/Dima2/Documents/blockblast/reports/header-layout-2026-10-30.json).

## Воспроизведение проверки

```powershell
$releaseAab = 'C:/Users/Dima2/Documents/blockblast/dist/blockblast-1.1.46-vc51-release.aab'
$releaseJbr = 'C:/Program Files/Android/Android Studio/jbr/bin'
& "$releaseJbr/jarsigner.exe" -verify -verbose -certs $releaseAab
& "$releaseJbr/keytool.exe" -printcert -jarfile $releaseAab
& "$releaseJbr/java.exe" -jar 'C:/Users/Dima2/Documents/blockblast/output/release-1.1.36/bundletool-all-1.18.3.jar' validate "--bundle=$releaseAab"
& "$releaseJbr/java.exe" -jar 'C:/Users/Dima2/Documents/blockblast/output/release-1.1.36/bundletool-all-1.18.3.jar' dump manifest "--bundle=$releaseAab" --module=base
Get-FileHash -LiteralPath $releaseAab -Algorithm SHA256
```

## RuStore

Версия **1.1.46(51)** загружена через авторизованную [RuStore Консоль, приложение 2063722466](https://console.rustore.ru/apps/2063722466/versions) и **отправлена на модерацию 01.11.2026**. Итоговый видимый статус — **Waiting for moderation**. Подтверждены **автоматическая публикация после одобрения** и **100% аудитории**. На момент проверки активной остаётся 1.1.45(50); новая версия ещё не опубликована.

SEO-текст «Что нового» — 471 символ, сохранён в [whats-new-ru.txt](C:/Users/Dima2/Documents/blockblast/output/release-1.1.46-vc51/whats-new-ru.txt). Он описывает только выполненные исправления и естественно использует ключевые слова «головоломка с блоками», «комбо», «линии», «без интернета», «Путешествие». Также исправлено устаревшее пояснение разрешений: POST_NOTIFICATIONS действительно используется уведомлениями; [актуальное пояснение](C:/Users/Dima2/Documents/blockblast/output/release-1.1.46-vc51/permissions-reasons-ru.txt) сверено с кодом.

Подтверждение отправки, автоматического режима и охвата: [скриншот](C:/Users/Dima2/Documents/blockblast/output/release-1.1.46-vc51/rustore-moderation.jpg), [статус JSON](C:/Users/Dima2/Documents/blockblast/output/release-1.1.46-vc51/rustore-publication.json). Следующий этап зависит от решения модерации RuStore.
