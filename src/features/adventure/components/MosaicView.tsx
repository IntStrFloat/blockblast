import { memo } from 'react';
import { View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { radii } from '@/ui';

import { seasonById } from '../logic/seasons';

interface Props {
  seasonId: number;
  cleared: number;
  justFilled?: number;
  width: number;
  revealed?: boolean;
}

export const MosaicView = memo(function MosaicView({
  seasonId,
  cleared,
  justFilled,
  width,
  revealed = false,
}: Props) {
  const season = seasonById(seasonId);
  const gap = Math.max(1, Math.floor(width / 150));
  const cell = Math.floor((width - gap * (season.cols - 1)) / season.cols);
  const height = season.rows * cell + (season.rows - 1) * gap;

  return (
    <View style={{ width, height, position: 'relative' }}>
      {season.tiles.map((tile) => {
        const filled = revealed || tile.index < cleared;
        const style = {
          position: 'absolute' as const,
          left: tile.col * (cell + gap),
          top: tile.row * (cell + gap),
          width: cell,
          height: cell,
          borderRadius: Math.min(2, radii.cell),
          backgroundColor: filled ? tile.color : 'rgba(38, 53, 97, 0.92)',
          borderWidth: tile.milestone ? 2 : 1,
          borderColor: tile.milestone ? '#D84F6A' : 'rgba(20, 32, 66, 0.72)',
        };
        if (tile.index === justFilled) {
          return <Animated.View key={tile.index} entering={FadeIn.duration(260)} style={style} />;
        }
        return <View key={tile.index} style={style} />;
      })}
    </View>
  );
});
