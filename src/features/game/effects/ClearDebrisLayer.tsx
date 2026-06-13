import Animated, { Keyframe } from 'react-native-reanimated';

import type { ClearPresentation } from '../animation/clearPresentation';

interface ClearDebrisLayerProps {
  presentation: ClearPresentation;
}

export function ClearDebrisLayer({ presentation }: ClearDebrisLayerProps) {
  return (
    <>
      {presentation.debris.map((debris) => {
        const animation = new Keyframe({
          0: {
            opacity: 0,
            transform: [
              { translateX: 0 },
              { translateY: 0 },
              { rotate: '0deg' },
              { scale: 0.65 },
            ],
          },
          16: {
            opacity: 1,
            transform: [
              { translateX: 0 },
              { translateY: 0 },
              { rotate: '0deg' },
              { scale: 1 },
            ],
          },
          62: {
            opacity: 0.94,
            transform: [
              { translateX: debris.dx * 0.72 },
              { translateY: debris.dy * 0.72 },
              { rotate: `${debris.rotateDeg * 0.72}deg` },
              { scale: 0.82 },
            ],
          },
          100: {
            opacity: 0,
            transform: [
              { translateX: debris.dx },
              { translateY: debris.dy },
              { rotate: `${debris.rotateDeg}deg` },
              { scale: 0.24 },
            ],
          },
        })
          .duration(debris.duration)
          .delay(debris.delay);

        return (
          <Animated.View
            key={debris.id}
            entering={animation}
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: debris.x - debris.size / 2,
              top: debris.y - debris.size / 2,
              width: debris.size,
              height: debris.size,
              borderRadius: Math.max(1, debris.size * 0.18),
              borderWidth: Math.max(0.5, debris.size * 0.08),
              borderColor: 'rgba(255,255,255,0.72)',
              backgroundColor: debris.color,
            }}
          />
        );
      })}

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
