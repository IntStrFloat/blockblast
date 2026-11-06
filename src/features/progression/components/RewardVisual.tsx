import { View } from 'react-native';

import { CandyIcon } from '@/ui/icons/CandyIcon';
import { nightCandy as n } from '@/ui/nightCandy';
import { CandyCosmetic } from '@/ui/primitives/CandyCosmetic';
import { getWorldTheme } from '@/features/themes/catalog';

import type { LevelReward } from '../logic/types';

/** Share the actual wardrobe item art across reward previews. */
export function RewardVisual({ reward, size = 40 }: { reward: LevelReward; size?: number }) {
  if (reward.kind === 'cosmetic') return <CandyCosmetic id={reward.id} size={size} />;
  if (reward.kind === 'helper')
    return (
      <CandyIcon
        name={reward.id === 'hint' ? 'bulb' : 'swap'}
        color={reward.id === 'hint' ? n.sun : n.sky}
        size={size}
      />
    );
  const palette = getWorldTheme(reward.themeId).cellColors;
  return (
    <View style={{ width: size, height: size, flexDirection: 'row', flexWrap: 'wrap', gap: 2 }}>
      {palette.slice(0, 4).map((color, index) => (
        <View
          key={index}
          style={{
            width: (size - 2) / 2,
            height: (size - 2) / 2,
            borderRadius: 4,
            backgroundColor: color,
          }}
        />
      ))}
    </View>
  );
}
