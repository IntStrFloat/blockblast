@AGENTS.md

# Block Blast — клон на Expo React Native

Казуальная block-puzzle (8×8, drag-n-drop, очистка линий) для Android (RuStore) и iOS. Оффлайн, без регистрации, монетизация за флагами.

## Документация (источник истины — читать перед работой над разделом)

| Спека | Что описывает |
|---|---|
| [docs/specs/00-game-analysis.md](docs/specs/00-game-analysis.md) | Анализ оригинала: правила, скоринг, UX, монетизация Hungry Studio |
| [docs/specs/01-screens.md](docs/specs/01-screens.md) | Экраны (Home/Game/Settings), оверлеи Pause/GameOver, фичи каждого |
| [docs/specs/02-architecture.md](docs/specs/02-architecture.md) | Модули, структура src/, зависимости, стек, MMKV-ключи, тесты |
| [docs/specs/03-game-engine.md](docs/specs/03-game-engine.md) | core/engine: правила, фигуры, формула очков, API, события |
| [docs/specs/04-design-system.md](docs/specs/04-design-system.md) | Токены, темы блоков, типографика, все анимации/хаптика/звук |
| [docs/specs/05-monetization.md](docs/specs/05-monetization.md) | AdsProvider/IapProvider, флаги, частоты, Yandex Ads + RuStore Billing |
| [docs/specs/06-audience.md](docs/specs/06-audience.md) | ЦА Gen Z/Alpha, принципы, фишки v1 и v1.1, анти-чеклист |
| [docs/specs/07-performance.md](docs/specs/07-performance.md) | Бюджеты 60fps, правила рендера/анимаций, решение Views-не-Skia |
| [docs/specs/08-build-release.md](docs/specs/08-build-release.md) | Локальная сборка AAB (prebuild+gradle+JBR), keystore, чек-лист RuStore |
| [docs/runbooks/android-app-signing.md](docs/runbooks/android-app-signing.md) | PEPK, upload certificate и обязательная проверка подписи AAB |
| [docs/specs/09-mascot.md](docs/specs/09-mascot.md) | Маскот «Капи»: поведение, прокачка/эволюция, помощники, интро, перф (retention) |

План реализации: docs/plans/ (если есть — выполнять по нему).

## Конвенции кода

- TypeScript strict; `npx tsc --noEmit` и `npm test` зелёные перед каждым коммитом.
- `core/engine` — чистый TS, ноль импортов React/RN; правится только вместе с тестами.
- Модули `features/*` экспортируют public API через `index.ts`; внутрь чужого модуля не импортируем.
- Текст — только `AppText` (пресеты), никаких `fontWeight`/сырых `<Text>`. Цвета — только из `ui/theme.ts`.
- Все игровые числа — в конфигах (GameConfig, MONETIZATION), не в логике.
- Анимации — Reanimated shared values на UI-потоке; в drag-пути никаких setState/runOnJS (кроме дропа). См. 07.
- Строки UI — через `core/i18n` (ru/en), включая тексты похвал (два тона).
- Коммиты: conventional (`feat(game): …`), сообщения на русском допустимы.

## Команды

```bash
npm test                  # Jest (движок + сторы)
npx tsc --noEmit          # типы
npx expo start            # dev
npx expo prebuild -p android && node scripts/patch-signing.js
cd android && .\gradlew bundleRelease   # signed AAB (см. 08)
```

## Чего НЕ делать

- Не добавлять нативные зависимости без обоснования в 07 (бюджет: только mmkv сверх Expo).
- Не показывать рекламу/попапы вопреки анти-чеклисту из 06.
- Не коммитить credentials/ (keystore, пароли) и серверные креды.
- Не собирать `assembleRelease` для публикации: релизный артефакт — подписанный AAB.
- Не создавать новый release keystore: обновления подписываются существующим `credentials/release.jks`.
