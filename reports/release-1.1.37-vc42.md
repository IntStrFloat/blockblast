Релиз Android 1.1.37 — versionCode 42

AAB: C:\Users\Dima2\Documents\blockblast\dist\blockblast-1.1.37-vc42-release.aab
Пакет: com.intstrfloat.blockblast
Размер: 90789883 байт (86,58 МиБ / 90,79 МБ).
SHA-256 файла: 11D60BC427173606A84558DD2FA9BC094DF4DBA07489BD53E91693A6128A841C
SHA-256 сертификата: 74:2D:E4:9B:C8:AC:57:19:FD:64:02:94:0F:A8:13:C1:A9:8C:D8:50:B6:7F:40:5B:1D:13:DE:D7:5E:6D:20:E3

Включены исправления звука разрушений, завершения приключений, мерцания надписей комбо и усиленные частицы. Версии повышены в app.json, package.json, корневых записях package-lock.json и android/app/build.gradle. Подпись выполнена существующим credentials/release.jks.

Проверки: 131 набор Jest, 876 тестов — прошли; backend — 12 тестов; TypeScript — без ошибок; ESLint — без ошибок, два прежних предупреждения в adventure/logic/seasons.ts и mascot/logic/types.ts. git diff --check — без замечаний.

bundleRelease --rerun-tasks --console=plain завершился успешно за 7 мин 55 с; выполнены все 784 задачи. Для этого запуска использован JBR 21 с временными лимитами heap 4 ГиБ / metaspace 1 ГиБ. Постоянные настройки Gradle не менялись.

Jarsigner: код завершения 0, jar verified. Fingerprint совпадает с сертификатом опубликованной игры. Bundletool validate: код 0. Манифест AAB подтверждает пакет, versionName 1.1.37 и versionCode 42.

Команды проверки:

    jarsigner -verify -verbose -certs dist/blockblast-1.1.37-vc42-release.aab
    keytool -printcert -jarfile dist/blockblast-1.1.37-vc42-release.aab
    java -jar output/release-1.1.36/bundletool-all-1.18.3.jar validate --bundle=dist/blockblast-1.1.37-vc42-release.aab
    java -jar output/release-1.1.36/bundletool-all-1.18.3.jar dump manifest --bundle=dist/blockblast-1.1.37-vc42-release.aab --module=base

Логи и метаданные: output/release-1.1.37/.
Проверка анимаций и тестового APK на эмуляторе выполнена в предыдущей задаче: reports/combo-motion-2026-09-05.md. В этой задаче собран магазинный AAB; публикация в магазин не выполнялась.
