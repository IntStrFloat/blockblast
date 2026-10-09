import { View } from 'react-native';

import { CosmeticIcon, HelperGlyph } from '@/features/mascot/components/MascotArt';
import { getWorldTheme } from '@/features/themes/catalog';

import type { LevelReward } from '../logic/types';

/** Share the actual wardrobe item art across reward previews. */
export function RewardVisual({ reward, size = 40 }: { reward: LevelReward; size?: number }) {
  if (reward.kind === 'cosmetic') return <CosmeticIcon id={reward.id} size={size} />;
  if (reward.kind === 'helper') return <HelperGlyph helperId={reward.id} size={size} />;
  const palette = getWorldTheme(reward.themeId).cellColors;
  return (
    <View style={{ width: size, height: size, flexDirection: 'row', flexWrap: 'wrap', gap: 2 }}>
      {palette.slice(0, 4).map((color, index) => (
        <View key={index} style={{ width: (size - 2) / 2, height: (size - 2) / 2, borderRadius: 4, backgroundColor: color }} />
      ))}
    </View>
  );
}
