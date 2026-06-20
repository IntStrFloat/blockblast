import { isHelperUnlocked } from '@/features/progression';

import type { HelperId } from './types';

/**
 * Можно ли использовать помощника прямо сейчас (спека 15 §3).
 * Гейт разлока читается из Уровня Игры (progression), не из MASCOT_CONFIG.
 * Доступен, если помощник открыт И (ещё не использован сегодня ИЛИ есть заряд из дейли-дропа).
 */
export function canUseHelper(
  usedDay: string | undefined,
  today: string,
  gameLevel: number,
  helper: HelperId,
  charges = 0,
): boolean {
  return isHelperUnlocked(helper, gameLevel) && (usedDay !== today || charges > 0);
}
