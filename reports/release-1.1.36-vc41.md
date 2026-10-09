Релиз Android 1.1.36 (versionCode 41)

AAB: C:\Users\Dima2\Documents\blockblast\dist\blockblast-1.1.36-vc41-release.aab
Пакет: com.intstrfloat.blockblast
Размер: 90789472 байт (86,58 МиБ; 90,79 МБ).
SHA-256 AAB: 293A61477E5680451EB6A2410C55B955C43694D149BEF04E08288C972A2E9A01
SHA-256 сертификата: 74:2D:E4:9B:C8:AC:57:19:FD:64:02:94:0F:A8:13:C1:A9:8C:D8:50:B6:7F:40:5B:1D:13:DE:D7:5E:6D:20:E3

Подпись существующим credentials/release.jks сохранена. Jarsigner завершился с кодом 0 и подтвердил jar verified. Bundletool validate завершился с кодом 0. В манифесте AAB проверены пакет com.intstrfloat.blockblast, versionName 1.1.36, versionCode 41. Предупреждения jarsigner о самоподписанном сертификате, отсутствии timestamp и порядке ZIP-записей не препятствуют успешной проверке.

Версии обновлены в app.json, package.json, корневых записях package-lock.json и android/app/build.gradle. Исходные изменения из предыдущей задачи вошли в сборку.

Проверки до сборки: 131 набор Jest / 861 тест; backend — 12 тестов; TypeScript — без ошибок; ESLint — без ошибок, два прежних предупреждения. bundleRelease --rerun-tasks --console=plain: BUILD SUCCESSFUL, 784 задачи, 18 мин 6 с.

Эмулятор Arrows_API_29 запущен, serial emulator-5554, Android 10 / API 29, x86_64, 1080 × 1920. Версия 1.1.35 обновлена через adb install -r без очистки данных. Для установки собран отдельный APK штатной задачей assembleRelease; проверены его release-подпись, версия и полное совпадение встроенного кода игры с AAB:
AAB/APK embedded game SHA256: 172920D77B569199C7560C730A97AE35E785F8883457411C60066F05E36AB98E

Запуск MainActivity: Status ok, COLD, TotalTime 3544 ms. Проверены домашний экран, вход в приключение, перенос фигуры на поле; цель изменилась с 0/212 на 9/212. Игра оставлена открытой в приключениях. В журнале процесса после запуска и хода не найдено FATAL EXCEPTION, Fatal signal, JavascriptException или WorkletsError. Звук разрушения и победа на физическом устройстве этим запуском не проверялись.

Команды проверки (использован JBR 21 из Android Studio):

    jarsigner -verify -verbose -certs dist/blockblast-1.1.36-vc41-release.aab
    keytool -printcert -jarfile dist/blockblast-1.1.36-vc41-release.aab
    java -jar output/release-1.1.36/bundletool-all-1.18.3.jar validate --bundle=dist/blockblast-1.1.36-vc41-release.aab
    java -jar output/release-1.1.36/bundletool-all-1.18.3.jar dump manifest --bundle=dist/blockblast-1.1.36-vc41-release.aab --module=base
    apksigner verify --verbose --print-certs android/app/build/outputs/apk/release/app-release.apk
    adb -s emulator-5554 shell dumpsys package com.intstrfloat.blockblast

Логи, метаданные и скриншоты: output/release-1.1.36/.
Скриншот игры: output/release-1.1.36/emulator-playing.png.
