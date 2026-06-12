import { Share } from 'react-native';

import { t } from '@/core/i18n';
import type { Lang } from '@/core/i18n';

/**
 * Текст шеринга (стиль Wordle: личный результат, без call-to-action — спека 06).
 */
export function formatShareText(
  score: number,
  isRecord: boolean,
  lang: Lang,
): string {
  const title = t('share.title', lang);
  const scoreLine = `🧱 ${score.toLocaleString(lang === 'ru' ? 'ru-RU' : 'en-US')}`;
  const recordLine = isRecord ? `\n🔥 ${t('share.bestSuffix', lang)}` : '';
  return `${title}\n${scoreLine}${recordLine}`;
}

export async function shareScore(score: number, isRecord: boolean, lang: Lang): Promise<void> {
  try {
    await Share.share({ message: formatShareText(score, isRecord, lang) });
  } catch {
    // пользователь закрыл шит — не ошибка
  }
}
