import { useEffect, useState } from 'react';
import { View } from 'react-native';

import {
  clearPresentationLifetimeMs,
  type ClearPresentation,
} from '../animation/clearPresentation';
import { BlockCrushLayer } from './BlockCrushLayer';
import { ClearDebrisLayer } from './ClearDebrisLayer';

interface GameEffectsLayerProps {
  presentation: ClearPresentation | null;
}

export function GameEffectsLayer({ presentation }: GameEffectsLayerProps) {
  const [expiredKey, setExpiredKey] = useState<string | null>(null);

  useEffect(() => {
    if (!presentation) return;
    const timer = setTimeout(
      () => setExpiredKey(presentation.key),
      clearPresentationLifetimeMs(presentation),
    );
    return () => clearTimeout(timer);
  }, [presentation]);

  if (!presentation || expiredKey === presentation.key) return null;

  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: '100%',
        height: '100%',
        overflow: 'visible',
      }}
    >
      <BlockCrushLayer fragments={presentation.fallingFragments} />
      <ClearDebrisLayer debris={presentation.debris} />
    </View>
  );
}
