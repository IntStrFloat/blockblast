import { COSMETICS } from './cosmetics';
import type { Slot, Stage } from './types';

/**
 * Витринный образ Капи (retention фаза 3): компактная строка
 * `stage|skin|hat|face|accessory|aura` для передачи с рекордом на бэкенд
 * и отрисовки бейджа у чужих строк лидерборда. Пустой слот — пустая строка.
 */

const SLOT_ORDER: Slot[] = ['skin', 'hat', 'face', 'accessory', 'aura'];
export const SHOWCASE_MAX_LENGTH = 96;

const CATALOG_BY_ID = new Map(COSMETICS.map((c) => [c.id, c.slot] as const));

export interface Showcase {
  stage: Stage;
  equipped: Partial<Record<Slot, string>>;
}

export function serializeShowcase(stage: Stage, equipped: Partial<Record<Slot, string>>): string {
  const slots = SLOT_ORDER.map((slot) => equipped[slot] ?? '');
  return [String(stage), ...slots].join('|');
}

/** Парс с защитой: битые слоты отбрасываются, битый формат целиком → null. */
export function parseShowcase(raw: string | null | undefined): Showcase | null {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > SHOWCASE_MAX_LENGTH) return null;
  const parts = raw.split('|');
  if (parts.length !== SLOT_ORDER.length + 1) return null;
  const stage = Number(parts[0]);
  if (!Number.isInteger(stage) || stage < 1 || stage > 4) return null;

  const equipped: Partial<Record<Slot, string>> = {};
  for (let i = 0; i < SLOT_ORDER.length; i += 1) {
    const slot = SLOT_ORDER[i];
    const id = parts[i + 1];
    if (id !== '' && CATALOG_BY_ID.get(id) === slot) equipped[slot] = id;
  }
  return { stage: stage as Stage, equipped };
}
