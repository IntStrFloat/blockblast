import { useEffect, useState } from 'react';
import Animated, { Keyframe } from 'react-native-reanimated';

import {
  clearPresentationLifetimeMs,
  type ClearPresentation,
} from '../animation/clearPresentation';
import { BlockCrushLayer } from './BlockCrushLayer';
import { LineHighlightLayer } from './LineHighlightLayer';

interface ClearLayerProps {
  presentation: ClearPresentation | null;
}

export function ClearLayer({ presentation }: ClearLayerProps) {
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
    <>
      <BlockCrushLayer fragments={presentation.fragments} />
      <LineHighlightLayer presentation={presentation} />
      <ClearSparkLayer presentation={presentation} />
    </>
  );
}

function ClearSparkLayer({ presentation }: ClearLayerProps) {
  if (!presentation) return null;

  return (
    <>
      {presentation.sparks.map((spark) => {
        const animation = new Keyframe({
          0: {
            opacity: 0,
            transform: [{ translateX: 0 }, { translateY: 0 }, { scale: 0.2 }],
          },
          24: {
            opacity: 1,
            transform: [
              { translateX: spark.dx * 0.25 },
              { translateY: spark.dy * 0.25 },
              { scale: 1.4 },
            ],
          },
          100: {
            opacity: 0,
            transform: [
              { translateX: spark.dx },
              { translateY: spark.dy },
              { scale: 0.1 },
            ],
          },
        })
          .duration(260)
          .delay(spark.delay);

        return (
          <Animated.View
            key={spark.id}
            entering={animation}
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: spark.x - spark.size / 2,
              top: spark.y - spark.size * 1.8,
              width: spark.size,
              height: spark.size * 3.6,
              borderRadius: 999,
              backgroundColor: '#FFFFFF',
            }}
          />
        );
      })}
    </>
  );
}
