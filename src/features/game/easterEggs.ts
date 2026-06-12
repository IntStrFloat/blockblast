/** Пасхалки на абсурдных рубежах счёта (спека 06): срабатывают при пересечении. */

const EGGS: readonly { threshold: number; key: string }[] = [
  { threshold: 13_337, key: 'easterEgg.e13337' },
  { threshold: 69_420, key: 'easterEgg.e69420' },
  { threshold: 100_001, key: 'easterEgg.e100001' },
];

/**
 * i18n-ключ пасхалки, если ход пересёк порог (prev < t ≤ next).
 * При пересечении нескольких разом — самый большой порог.
 */
export function eggForScore(prevScore: number, nextScore: number): string | null {
  let found: string | null = null;
  for (const egg of EGGS) {
    if (prevScore < egg.threshold && nextScore >= egg.threshold) found = egg.key;
  }
  return found;
}
