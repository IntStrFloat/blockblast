import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import Svg, { Path, Rect } from 'react-native-svg';

import { t } from '@/core/i18n';
import { useLang } from '@/features/settings';
import { AppText, GameButton, radii, spacing } from '@/ui';

interface Props {
  onRetry: () => void;
  onExit: () => void;
  disabled?: boolean;
}

export function FailOverlay({ onRetry, onExit, disabled = false }: Props) {
  const lang = useLang();

  return (
    <Animated.View entering={FadeIn.duration(220)} style={styles.scrim}>
      <Animated.View
        entering={ZoomIn.duration(220)}
        style={styles.panel}
        accessibilityViewIsModal
      >
        <LinearGradient
          colors={['#173C5A', '#102A47']}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.panelSurface}
        >
          <View style={styles.iconRing} accessible accessibilityLabel={t('adventure.failedTitle', lang)}>
            <NoMovesIcon />
          </View>

          <View style={styles.copy}>
            <AppText preset="title" style={styles.title}>
              {t('adventure.failedTitle', lang)}
            </AppText>
            <AppText preset="body" style={styles.subtitle}>
              {t('adventure.failedHint', lang)}
            </AppText>
          </View>

          <View style={styles.actions}>
            <GameButton
              label={t('adventure.retry', lang)}
              onPress={onRetry}
              size="lg"
              disabled={disabled}
            />
            <GameButton
              label={t('adventure.exit', lang)}
              variant="ghost"
              onPress={onExit}
              disabled={disabled}
            />
          </View>
        </LinearGradient>
      </Animated.View>
    </Animated.View>
  );
}

function NoMovesIcon() {
  return (
    <Svg width={64} height={64} viewBox="0 0 64 64" accessibilityElementsHidden>
      <Rect x={10} y={10} width={16} height={16} rx={4} fill="#36D7B7" />
      <Rect x={30} y={10} width={16} height={16} rx={4} fill="#67DFD8" />
      <Rect x={10} y={30} width={16} height={16} rx={4} fill="#20A9B8" />
      <Path d="m35 35 17 17m0-17L35 52" stroke="#FFCE55" strokeWidth={5} strokeLinecap="round" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  scrim: {
    ...StyleSheet.absoluteFill,
    zIndex: 240,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.l,
    backgroundColor: 'rgba(3, 15, 29, 0.7)',
  },
  panel: {
    width: '100%',
    maxWidth: 368,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(126, 231, 255, 0.42)',
    borderRadius: radii.card,
    boxShadow: '0 18px 32px rgba(0, 6, 18, 0.52)',
  },
  panelSurface: {
    alignItems: 'center',
    gap: spacing.l,
    paddingHorizontal: spacing.l,
    paddingVertical: spacing.xl,
  },
  iconRing: {
    width: 96,
    height: 96,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(126, 231, 255, 0.48)',
    borderRadius: 48,
    backgroundColor: 'rgba(7, 27, 51, 0.66)',
  },
  copy: {
    alignItems: 'center',
    gap: spacing.s,
  },
  title: {
    color: '#FFFFFF',
    fontFamily: 'Fredoka_700Bold',
    fontSize: 34,
    lineHeight: 39,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 8, 24, 0.7)',
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 2,
  },
  subtitle: {
    maxWidth: 280,
    color: '#BEEAF6',
    fontFamily: 'Fredoka_500Medium',
    fontSize: 18,
    lineHeight: 25,
    textAlign: 'center',
  },
  actions: {
    width: '100%',
    gap: spacing.s,
  },
});
