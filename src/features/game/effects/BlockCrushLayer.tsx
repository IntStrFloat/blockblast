import { View } from 'react-native';
import Animated, { Keyframe } from 'react-native-reanimated';

import type { ClearPresentation } from '../animation/clearPresentation';
import { Block } from '../components/Block';

interface BlockCrushLayerProps {
  presentation: ClearPresentation;
}

export function BlockCrushLayer({ presentation }: BlockCrushLayerProps) {
  return (
    <>
      {presentation.fragments.map((fragment) => {
        const animation = fragment.reducedMotion
          ? new Keyframe({
              0: { opacity: 1, transform: [{ scale: 1 }] },
              52: { opacity: 0.9, transform: [{ scale: 1.035 }] },
              100: { opacity: 0, transform: [{ scale: 0.92 }] },
            })
              .duration(180)
              .delay(fragment.delay)
          : new Keyframe({
              0: {
                opacity: 1,
                transform: [
                  { translateX: 0 },
                  { translateY: 0 },
                  { rotate: '0deg' },
                  { scaleX: 1 },
                  { scaleY: 1 },
                ],
              },
              24: {
                opacity: 1,
                transform: [
                  { translateX: 0 },
                  { translateY: 0 },
                  { rotate: '0deg' },
                  { scaleX: 1.08 },
                  { scaleY: 0.82 },
                ],
              },
              46: {
                opacity: 1,
                transform: [
                  { translateX: fragment.dx * 0.24 },
                  { translateY: fragment.dy * 0.24 },
                  { rotate: `${fragment.rotateDeg * 0.25}deg` },
                  { scaleX: 0.98 },
                  { scaleY: 1.04 },
                ],
              },
              100: {
                opacity: 0,
                transform: [
                  { translateX: fragment.dx },
                  { translateY: fragment.dy },
                  { rotate: `${fragment.rotateDeg}deg` },
                  { scaleX: 0.26 },
                  { scaleY: 0.26 },
                ],
              },
            })
              .duration(210)
              .delay(fragment.delay);

        return (
          <Animated.View
            key={fragment.id}
            entering={animation}
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: fragment.x,
              top: fragment.y,
              width: fragment.width,
              height: fragment.height,
              overflow: 'hidden',
            }}
          >
            <View style={{ position: 'absolute', left: fragment.sourceX, top: fragment.sourceY }}>
              <Block size={fragment.sourceSize} color={fragment.color} />
            </View>
          </Animated.View>
        );
      })}
    </>
  );
}
