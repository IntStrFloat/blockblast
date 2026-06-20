# 12 — Game themes (миры/дизайны)

Статус: черновик на ревью · Обновлено: 2026-06-20
Родитель: [10-progression.md](10-progression.md) · Связь: [04-design-system](04-design-system.md) (палитры блоков, токены), [11-progression-core](11-progression-core.md) (разлок по мирам), [02](02-architecture.md).

Каждый мир — это **тема**: полный косметический рескин (фон доски, палитра блоков, цвета juice/частиц, опц. окружение Капи). Геометрия 8×8 и core-правила не меняются (10 §4). Темы открываются достижением мира (бесплатно), применяются авто и переключаются вручную.

## 1. Scope

- Каталог тем (данные) + типы.
- Применение темы к рендеру игры через токены (поверх `ui/theme.ts`).
- Открытие тем (производно от `progression.world`) и выбор активной.
- Переключатель темы в Settings.
- **Не** входит: сама прогрессия (11), экран карты (13).

## 2. Тип и каталог

```ts
// features/themes/catalog.ts
export interface WorldTheme {
  id: string;            // 'classic' | 'neon' | …  (= PROGRESSION_CONFIG.worldThemeId[world])
  nameKey: string;       // i18n-ключ ('themes.neon')
  boardBg: string;       // фон доски (токен/hex из ui/theme)
  cellEmpty: string;     // цвет пустой клетки
  blockPalette: string;  // id палитры блоков из 04 (Classic dark, Y2K-chrome, …)
  juiceColors: string[]; // цвета вспышек/частиц очистки
  praiseAccent: string;  // акцент текста похвал
  capiEnv?: 'none' | 'stars' | 'grid' | 'aurora'; // опц. лёгкое окружение Капи (transform/opacity)
}

export const WORLD_THEMES: WorldTheme[] = [
  { id: 'classic', nameKey: 'themes.classic', /* мир 1 — текущий дизайн (Classic dark) */ ... },
  { id: 'neon',    nameKey: 'themes.neon',    /* мир 2 — Y2K-chrome/неон */ ... },
  { id: 'sunset',  nameKey: 'themes.sunset',  ... },
  { id: 'mono',    nameKey: 'themes.mono',    ... },
  { id: 'aqua',    nameKey: 'themes.aqua',    ... },
  { id: 'galaxy',  nameKey: 'themes.galaxy',  ... },
  { id: 'gold',    nameKey: 'themes.gold',    ... },
];
```

- Мир 1 (`classic`) и мир 2 (`neon`) переиспользуют 2 бесплатные палитры из 06/04 (Classic dark, Y2K-chrome). Остальные — новые наборы токенов.
- Добавление темы — только данные (как темы блоков в 04): компоненты не трогаются.
- Все цвета обязаны читаться на тёмном фоне и проходить контраст (04/14).

## 3. Применение к рендеру

```ts
// features/themes/store.ts (тонкий слой над progression)
export function useActiveTheme(): WorldTheme;      // WORLD_THEMES.find(progression.activeTheme)
export function useUnlockedThemes(): WorldTheme[];  // по progression.unlockedThemes
export function setActiveTheme(id: string): void;   // делегирует progression.setActiveTheme (guard: только открытые)
```

- Игровой рендер (доска, блоки, juice, похвалы) читает токены из `useActiveTheme()` вместо хардкода. Где сейчас берутся цвета из `ui/theme.ts` напрямую — добавляется слой «активная тема перекрывает».
- `unlockedThemes`/`activeTheme` хранятся в `progression.state` (11 §5) — themes-модуль их только читает/пишет через публичный API progression. Источник истины один.

## 4. Авто-переключение и ручной выбор

- **Авто:** координатор из 11 (`useProgressionSync`) на `enteredWorld` вызывает `setActiveTheme(worldThemeId[world])` → новый мир включается сам, с тематическим празднованием (13/10 §12), **после** партии.
- **Ручной:** в Settings — список открытых тем (превью + название), тап → `setActiveTheme`. Косметическая свобода: можно вернуться к любимому миру.

## 5. Settings UI

- Секция «Тема»: горизонтальный/сеточный список открытых тем, текущая отмечена; заблокированные не показываются (или показываются затемнённо с «откроется на Мире N»). Цель тача ≥44pt.

## 6. Производительность (07)

- Тема — набор токенов; переключение меняет значения, не пересобирает горячий drag-путь. `capiEnv` — только transform/opacity, уважает reduce-motion, опц. отключается на слабых.
- Ноль новых нативных зависимостей.

## 7. i18n

- `themes.*` — названия миров (нейтральный UI-тон, ru/en). Данные, без кода.

## 8. Тесты

- `unlockedThemes` соответствует достигнутому миру; неизвестный `activeTheme` → дефолт темы текущего мира.
- `setActiveTheme` отклоняет закрытую тему.
- Авто-переключение на `enteredWorld` (через мок координатора/стора).
- Каждая `WorldTheme` имеет валидные обязательные поля и существующий `blockPalette`.

## 9. Влияние на смежные спеки

- **01:** секция «Тема» в Settings; активная тема на Game.
- **02:** модуль `features/themes` (зависит от `progression`, `ui`, `i18n`).
- **04:** темы миров поверх палитр блоков; токены фона/juice на мир.
- **05:** темы-миры бесплатны (прогресс), не IAP.
