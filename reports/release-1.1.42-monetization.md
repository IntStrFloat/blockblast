# Релиз монетизации 1.1.42 / 47

Дата: 30 сентября 2026. Пакет: `com.intstrfloat.blockblast`.

[Подписанный AAB](C:/Users/Dima2/Documents/blockblast/dist/blockblast-1.1.42-vc47.aab)

- Размер: 90,868,688 байт (86.66 MiB).
- SHA-256 файла: `E620D74371B167B1F9C74FFA17049C318E3C601306B1EA0BF0EA826451FA6F2B`.
- SHA-256 сертификата: `74:2D:E4:9B:C8:AC:57:19:FD:64:02:94:0F:A8:13:C1:A9:8C:D8:50:B6:7F:40:5B:1D:13:DE:D7:5E:6D:20:E3`.
- Существующий `credentials/release.jks` сохранён; ключ не создавался и не заменялся.

## Результат

Межстраничная реклама: первый показ после шести завершений, затем минимум четыре
завершения и 180 секунд; все счётчики режимов сбрасываются при impression.
Проигрыши Adventure и экраны с предложенной добровольной наградой защищены.
SDK init и подготовка форматов разделены; удалены безусловные загрузки обоих
форматов при старте и после закрытия. Общая подписка возвращает rewarded-кнопки
после загрузки. Продолжение стоит перед повтором и явно обещает просмотр рекламы;
бонус XP выделен основной кнопкой. Rewarded load_id связывает реальные загрузки
и показы вместо фиктивного ad_loaded при show.

[Файлы, правила размещений и сравнение Boost](C:/Users/Dima2/Documents/blockblast/docs/monetization/2026-09-30-refactor.md).
Gradle dependencyInsight подтверждает Yandex SDK 8.3.0 и адаптер myTarget 5.45.3.4.
В текущем Boost у межстраничной рекламы Блока Yandex+VK и Adfox, у Судоку только
Yandex без Adfox. Дополнительной сети, отсутствующей у Блока, не обнаружено.

## Проверки

- 180 Jest-наборов / 1183 теста: PASS; 16 backend-тестов: PASS.
- TypeScript: PASS; ESLint: 0 ошибок, 2 существующих предупреждения вне области правок.
- git diff --check: PASS.
- bundleRelease --rerun-tasks: BUILD SUCCESSFUL, 822 задачи выполнены.
- Финальная упаковка bundleRelease: BUILD SUCCESSFUL, последние busy guards
  подтверждены sourcemap; asset в AAB побайтно совпадает с финальным JS bundle.
- jarsigner: код 0, `jar verified.`; сертификат совпадает с ожидаемым.
- bundletool validate: код 0; dump manifest подтверждает пакет, 1.1.42 и versionCode 47.
- В самом AAB подтверждены production ID -1/-2/-3, demo ID этих форматов отсутствуют.

Команды проверки из корня проекта (JBR 21 в PATH):

```powershell
jarsigner -verify -verbose -certs dist/blockblast-1.1.42-vc47.aab
keytool -printcert -jarfile dist/blockblast-1.1.42-vc47.aab
java -jar output/release-1.1.36/bundletool-all-1.18.3.jar validate --bundle=dist/blockblast-1.1.42-vc47.aab
java -jar output/release-1.1.36/bundletool-all-1.18.3.jar dump manifest --bundle=dist/blockblast-1.1.42-vc47.aab --module=base
```

Логи проверок: `output/monetization-*.log`, manifest —
`output/monetization-manifest.xml`.

## Границы проверки

Реальные показы SDK на устройстве не проверены: ADB не обнаружил подключённых
устройств. Callback-потоки и выдача наград проверялись двойником SDK. Доля загрузок
и eCPM требуют измерения после публикации. Частота не установлена как доказанная
причина падения eCPM; следить также за доходом на игрока и удержанием.

Настройки Boost не менялись; AAB не загружался в магазин. Релиз включает текущую
рабочую копию с сохранёнными ранее существовавшими изменениями.
