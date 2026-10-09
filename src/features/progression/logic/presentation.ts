import type { Lang } from '@/core/i18n';

import type { LevelReward } from './types';

const REWARD_NAMES: Record<string, { ru: string; en: string }> = {
  'hat-casquette': { ru: 'кепка Капи', en: 'Capi cap' },
  'face-glasses': { ru: 'очки Капи', en: 'Capi glasses' },
  'acc-headphones': { ru: 'наушники Капи', en: 'Capi headphones' },
  'skin-mint': { ru: 'мятный образ', en: 'mint look' },
  'hat-panama': { ru: 'панама Капи', en: 'Capi panama' },
  'face-sunglasses': { ru: 'солнечные очки', en: 'sunglasses' },
  'acc-scarf': { ru: 'шарф Капи', en: 'Capi scarf' },
  'skin-coral': { ru: 'коралловый образ', en: 'coral look' },
  'hat-beanie': { ru: 'шапка Капи', en: 'Capi beanie' },
  'face-star-eyes': { ru: 'звёздные очки', en: 'star glasses' },
  'acc-backpack': { ru: 'рюкзак Капи', en: 'Capi backpack' },
  hint: { ru: 'помощник «Подсказка»', en: 'Hint helper' },
  swap: { ru: 'помощник «Замена»', en: 'Swap helper' },
};

export function rewardDisplayName(reward: LevelReward, lang: Lang): string {
  if (reward.kind === 'world') {
    return lang === 'ru' ? `дизайн мира ${reward.world}` : `World ${reward.world} theme`;
  }
  return REWARD_NAMES[reward.id]?.[lang] ?? reward.id;
}
