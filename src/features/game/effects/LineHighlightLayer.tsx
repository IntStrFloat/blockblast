import { LinearGradient } from 'expo-linear-gradient';
import { View } from 'react-native';
import Animated, { Keyframe } from 'react-native-reanimated';

import { radii } from '@/ui';

import type { ClearPresentation } from '../animation/clearPresentation';

const RAINBOW = [
  '#FF4D8D',
  '#FFB83D',
  '#FFF27A',
  '#5DFFB2',
  '#4DD8FF',
  '#7D73FF',
  '#F26BFF',
] as const;

interface LineHighlightLayerProps {
  presentation: ClearPresentation;
}

function lineFrames(orientation: 'row' | 'col') {
  return orientation === 'row'
    ? new Keyframe({
        0: { opacity: 0, transform: [{ scaleX: 0.72 }] },
        24: { opacity: 1, transform: [{ scaleX: 1.025 }] },
        52: { opacity: 1, transform: [{ scaleX: 1 }] },
        76: { opacity: 0.9, transform: [{ scaleX: 1 }] },
        100: { opacity: 0, transform: [{ scaleX: 1.04 }] },
      })
    : new Keyframe({
        0: { opacity: 0, transform: [{ scaleY: 0.72 }] },
        24: { opacity: 1, transform: [{ scaleY: 1.025 }] },
        52: { opacity: 1, transform: [{ scaleY: 1 }] },
        76: { opacity: 0.9, transform: [{ scaleY: 1 }] },
        100: { opacity: 0, transform: [{ scaleY: 1.04 }] },
      });
}

export function LineHighlightLayer({ presentation }: LineHighlightLayerProps) {
  return (
    <>
      {presentation.lines.map((line) => {
        const horizontal = line.orientation === 'row';
        const bloom = Math.max(5, Math.round(Math.min(line.width, line.height) * 0.34));
        const lineAnimation = lineFrames(line.orientation)
          .duration(presentation.reducedMotion ? 210 : 440)
          .delay(line.delay);

        return (
          <View key={line.id} pointerEvents="none">
            <Animated.View
              entering={lineAnimation}
              style={{
                position: 'absolute',
                left: horizontal ? line.x : line.x - bloom,
                top: horizontal ? line.y - bloom : line.y,
                width: horizontal ? line.width : line.width + bloom * 2,
                height: horizontal ? line.height + bloom * 2 : line.height,
              }}
            >
              <LinearGradient
                colors={RAINBOW}
                start={horizontal ? { x: 0, y: 0.5 } : { x: 0.5, y: 0 }}
                end={horizontal ? { x: 1, y: 0.5 } : { x: 0.5, y: 1 }}
                style={{
                  width: '100%',
                  height: '100%',
                  borderRadius: radii.cell + bloom,
                  opacity: 0.34,
                }}
              />
            </Animated.View>

            <Animated.View
              entering={lineFrames(line.orientation)
                .duration(presentation.reducedMotion ? 190 : 390)
                .delay(line.delay + 20)}
              style={{
                position: 'absolute',
                left: horizontal ? line.x : line.x + line.width / 2 - 1.5,
                top: horizontal ? line.y + line.height / 2 - 1.5 : line.y,
                width: horizontal ? line.width : 3,
                height: horizontal ? 3 : line.height,
              }}
            >
              <LinearGradient
                colors={RAINBOW}
                start={horizontal ? { x: 0, y: 0.5 } : { x: 0.5, y: 0 }}
                end={horizontal ? { x: 1, y: 0.5 } : { x: 0.5, y: 1 }}
                style={{ width: '100%', height: '100%', borderRadius: 999 }}
              />
            </Animated.View>

            {line.segments.map((segment, segmentIndex) => {
              const chroma = RAINBOW[(segmentIndex + line.index) % RAINBOW.length];
              const contour = new Keyframe({
                0: { opacity: 0, transform: [{ scale: 0.86 }] },
                22: { opacity: 1, transform: [{ scale: 1.08 }] },
                45: { opacity: 1, transform: [{ scale: 1 }] },
                74: { opacity: 1, transform: [{ scale: 1 }] },
                100: { opacity: 0, transform: [{ scale: 1.035 }] },
              })
                .duration(presentation.reducedMotion ? 205 : 345)
                .delay(line.delay + segmentIndex * 5);

              return (
                <Animated.View
                  key={segment.id}
                  entering={contour}
                  style={{
                    position: 'absolute',
                    left: segment.x,
                    top: segment.y,
                    width: segment.width,
                    height: segment.height,
                  }}
                >
                  <View
                    style={{
                      position: 'absolute',
                      left: -4,
                      top: -4,
                      right: -4,
                      bottom: -4,
                      borderRadius: radii.cell + 4,
                      borderWidth: 4,
                      borderColor: chroma,
                      opacity: 0.28,
                    }}
                  />
                  <View
                    style={{
                      position: 'absolute',
                      left: -2,
                      top: -2,
                      right: -2,
                      bottom: -2,
                      borderRadius: radii.cell + 2,
                      borderWidth: 2,
                      borderColor: chroma,
                      opacity: 0.9,
                    }}
                  />
                  <View
                    style={{
                      position: 'absolute',
                      left: 1,
                      top: 1,
                      right: 1,
                      bottom: 1,
                      borderRadius: Math.max(2, radii.cell - 1),
                      borderWidth: 1.5,
                      borderColor: '#FFFFFF',
                    }}
                  />
                </Animated.View>
              );
            })}
          </View>
        );
      })}

      {presentation.intersections.map((intersection) => {
        const flare = new Keyframe({
          0: { opacity: 0, transform: [{ scale: 0.15 }, { rotate: '0deg' }] },
          28: { opacity: 1, transform: [{ scale: 1.22 }, { rotate: '10deg' }] },
          52: { opacity: 0.92, transform: [{ scale: 0.88 }, { rotate: '18deg' }] },
          100: { opacity: 0, transform: [{ scale: 1.75 }, { rotate: '34deg' }] },
        })
          .duration(presentation.reducedMotion ? 190 : 315)
          .delay(90);
        const expansion = intersection.width * 0.72;

        return (
          <Animated.View
            key={intersection.id}
            entering={flare}
            style={{
              position: 'absolute',
              left: intersection.x - expansion / 2,
              top: intersection.y - expansion / 2,
              width: intersection.width + expansion,
              height: intersection.height + expansion,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <View
              style={{
                position: 'absolute',
                width: '100%',
                height: '100%',
                borderRadius: radii.cell + expansion,
                backgroundColor: '#FFFFFF',
                opacity: 0.18,
              }}
            />
            <View
              style={{
                width: '72%',
                height: '72%',
                borderRadius: radii.cell + 3,
                borderWidth: 3,
                borderColor: '#FFFFFF',
                backgroundColor: intersection.colors[0],
                opacity: 0.88,
              }}
            />
            <View
              style={{
                position: 'absolute',
                width: '18%',
                height: '100%',
                borderRadius: 999,
                backgroundColor: '#FFFFFF',
                opacity: 0.94,
              }}
            />
            <View
              style={{
                position: 'absolute',
                width: '100%',
                height: '18%',
                borderRadius: 999,
                backgroundColor: '#FFFFFF',
                opacity: 0.94,
              }}
            />
          </Animated.View>
        );
      })}
    </>
  );
}
