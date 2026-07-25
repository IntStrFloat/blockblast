import { StyleSheet, View } from 'react-native';
import Animated, { FadeOut, ReduceMotion, ZoomIn } from 'react-native-reanimated';

import { AppText, colors, mascotPalette, radii, spacing } from '@/ui';

interface SpeechBubbleProps {
  text: string;
  /**
   * Куда смотрит хвостик: к Капи (по умолчанию — он стоит слева) или по центру
   * (прощание при потере, когда Капи уже улетел вниз).
   */
  tail?: 'left' | 'center';
}

/**
 * «Голос Капи»: тёплый кремовый пузырь с чернильным текстом (контраст ≥4.5:1),
 * округлый шрифт Fredoka (отделяет реплику персонажа от системного UI), мягкая
 * clay-тень и хвостик к зверьку. Появляется spring-«поп»-ом (как будто сказал),
 * уходит быстрым фейдом; и то и другое уважает системный reduce-motion.
 * Родитель монтирует пузырь только когда есть текст (потеря §10.4 / интро §11).
 */
export function SpeechBubble({ text, tail = 'left' }: SpeechBubbleProps) {
  return (
    <Animated.View
      entering={ZoomIn.springify().damping(13).stiffness(170).reduceMotion(ReduceMotion.System)}
      exiting={FadeOut.duration(140).reduceMotion(ReduceMotion.System)}
      style={styles.root}
    >
      <View style={styles.bubble}>
        <AppText preset="speech" style={styles.text}>
          {text}
        </AppText>
      </View>
      <View style={[styles.tail, tail === 'left' ? styles.tailLeft : styles.tailCenter]} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
  },
  bubble: {
    maxWidth: 220,
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.s,
    borderRadius: radii.card,
    backgroundColor: mascotPalette.speechBg,
    borderWidth: 1,
    borderColor: mascotPalette.speechBorder,
    // Мягкая «вылепленная» тень — рифма с claymorphism-карточками (спека 04).
    shadowColor: colors.clayShadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  text: {
    color: mascotPalette.speechInk,
    textAlign: 'center',
    lineHeight: 20,
  },
  tail: {
    width: 13,
    height: 13,
    marginTop: -7,
    backgroundColor: mascotPalette.speechBg,
    // Только нижне-правые грани → после поворота образуют чистый край в цвет рамки.
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: mascotPalette.speechBorder,
    transform: [{ rotate: '45deg' }],
    borderRadius: 3,
  },
  tailCenter: {
    alignSelf: 'center',
  },
  tailLeft: {
    alignSelf: 'flex-start',
    marginLeft: 28,
  },
});
