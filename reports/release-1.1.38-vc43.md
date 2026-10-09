Релиз Android 1.1.38 — versionCode 43

AAB: C:\Users\Dima2\Documents\blockblast\dist\blockblast-1.1.38-vc43-release.aab
Пакет: com.intstrfloat.blockblast
Размер: 90 789 921 байт (90,79 МБ / 86,58 МиБ).
SHA-256 файла: C315C328F768C01377A9F1FF1C633CE7791B28125065AD42EA5B95A24161DE78
SHA-256 сертификата: 74:2D:E4:9B:C8:AC:57:19:FD:64:02:94:0F:A8:13:C1:A9:8C:D8:50:B6:7F:40:5B:1D:13:DE:D7:5E:6D:20:E3

Включено текущее состояние рабочего дерева с исправлением вылета при нажатии «Домой» в «Приключении». Контейнер игрового поля сохраняется в нативном дереве при отключении ввода, что устраняет конфликт Fabric при смене родителя дочерних элементов. Регрессионный тест проверяет выход из меню паузы. Исходный код исправления найден в карте исходников релизного JavaScript; содержимое JavaScript внутри AAB побайтно соответствует сгенерированному релизному файлу по SHA-256.

Версии повышены в app.json, package.json, корневых записях package-lock.json и android/app/build.gradle. Новые зависимости и дополнительные абстракции не добавлены. Использован существующий credentials/release.jks; контрольная сумма файла ключа до и после сборки совпадает.

Проверки:

- Jest: 131 набор, 877 тестов — прошли.
- Backend: 12 тестов — прошли.
- TypeScript: без ошибок.
- ESLint: без ошибок; два прежних предупреждения в adventure/logic/seasons.ts и mascot/logic/types.ts.
- git diff --check: без ошибок в изменённых файлах.
- bundleRelease --rerun-tasks --console=plain: BUILD SUCCESSFUL за 8 мин 31 с, 784 задачи выполнены.
- Jarsigner: код 0, jar verified.
- Keytool: код 0; сертификат совпадает с сертификатом опубликованного приложения.
- Bundletool validate: код 0.
- Манифест AAB: com.intstrfloat.blockblast, versionName 1.1.38, versionCode 43.
- В AAB включены armeabi-v7a, arm64-v8a, x86, x86_64.

Сборка выполнена локально с Android Studio JBR 21. Предупреждения jarsigner о самоподписанном сертификате, отсутствии timestamp и порядке ZIP-записей не препятствуют успешной проверке.

Команды проверки из корня проекта (утилиты подписи из Android Studio JBR):

    jarsigner -verify -verbose -certs dist/blockblast-1.1.38-vc43-release.aab
    keytool -printcert -jarfile dist/blockblast-1.1.38-vc43-release.aab
    java -jar output/release-1.1.36/bundletool-all-1.18.3.jar validate --bundle=dist/blockblast-1.1.38-vc43-release.aab
    java -jar output/release-1.1.36/bundletool-all-1.18.3.jar dump manifest --bundle=dist/blockblast-1.1.38-vc43-release.aab --module=base

Логи подписи, манифест и метаданные: output/release-1.1.38/.
Лог сборки: output/release-1.1.38-build.log.
Логи проверок: output/release-1.1.38-tests.log, output/release-1.1.38-backend-tests.log, output/release-1.1.38-typecheck.log, output/release-1.1.38-lint.log.

Выход «Домой» дважды проверен в Android API 29 на текущем исходном коде перед сборкой; подробности — output/home-crash-verification.md. Отдельная установка APK, полученного из этого AAB, и проверка на физическом телефоне не выполнялись. AAB в магазин не загружался.
