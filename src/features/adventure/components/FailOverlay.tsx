import { ScrollView, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { t } from '@/core/i18n';
import { useReducedMotion } from '@/features/game/animation/useReducedMotion';
import { useLang } from '@/features/settings';
import {
  AppText,
  CandyBackground,
  CandyCapy,
  CandyIcon,
  CandyProgress,
  GameButton,
  nightCandy as n,
} from '@/ui';
import type { AdventureFailureTip } from '../logic/failure';

interface Props {
  onRetry: () => void;
  onRetryWithHelp?: () => void;
  onExit: () => void;
  objective: 'score' | 'jewels';
  current: number;
  target: number;
  remaining: number;
  tip: AdventureFailureTip;
  helpEligible?: boolean;
  disabled?: boolean;
}

export function FailOverlay({
  onRetry,
  onExit,
  objective,
  current,
  target,
  remaining,
  tip,
  disabled = false,
}: Props) {
  const lang = useLang();
  const ru = lang === 'ru';
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const resultLabel = `${t(objective === 'jewels' ? 'adventure.failureCollected' : 'adventure.failureScore', lang)} ${current}/${target}, ${t('adventure.failureRemaining', lang)} ${remaining}`;
  return (
    <Animated.View
      entering={reduced ? undefined : FadeIn.duration(280)}
      accessibilityViewIsModal
      style={{ position: 'absolute', inset: 0, zIndex: 240, backgroundColor: n.night900 }}
    >
      <CandyBackground />
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          width: '100%',
          maxWidth: 520,
          alignSelf: 'center',
          paddingHorizontal: 20,
          paddingTop: insets.top + 120,
          paddingBottom: Math.max(30, insets.bottom + 16),
          gap: 16,
          alignItems: 'center',
        }}
        showsVerticalScrollIndicator={false}
      >
        <AppText
          style={{
            fontFamily: 'Nunito_900Black',
            color: n.mandarin,
            fontSize: 12,
            letterSpacing: 1.44,
          }}
        >
          {ru ? 'ПРИКЛЮЧЕНИЕ' : 'ADVENTURE'}
        </AppText>
        <AppText
          accessibilityRole="header"
          style={{
            fontFamily: 'Unbounded_900Black',
            fontSize: 28,
            lineHeight: 34,
            textAlign: 'center',
          }}
        >
          {ru ? 'Партия окончена' : 'Game over'}
        </AppText>
        <View
          accessible
          accessibilityLabel={resultLabel}
          style={{ width: '100%', alignItems: 'center', gap: 12 }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <CandyIcon name={objective === 'jewels' ? 'gem' : 'chart'} size={32} color={n.sky} />
            <AppText
              numberOfLines={1}
              adjustsFontSizeToFit
              style={{
                fontFamily: 'Unbounded_900Black',
                fontSize: 56,
                lineHeight: 68,
                textShadowColor: 'rgba(5,8,40,0.5)',
                textShadowOffset: { width: 0, height: 6 },
                textShadowRadius: 0,
              }}
            >
              {current} / {target}
            </AppText>
          </View>
          <View style={{ width: '80%' }}>
            <CandyProgress value={current / Math.max(1, target)} color={n.sky} />
          </View>
          <AppText style={{ color: n.lavender, fontFamily: 'Nunito_900Black', fontSize: 16 }}>
            {t('adventure.failureRemaining', lang)} {remaining}
          </AppText>
        </View>
        <View style={{ flex: 1, minHeight: 64 }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <CandyCapy size={44} />
          <AppText
            style={{
              flex: 1,
              fontFamily: 'Nunito_800ExtraBold',
              fontSize: 14,
              lineHeight: 20,
              color: n.lavender,
            }}
          >
            {t(`adventure.failureTip.${tip}` as const, lang)}
          </AppText>
        </View>
        <GameButton
          label={t('adventure.retry', lang)}
          size="lg"
          onPress={onRetry}
          disabled={disabled}
          style={{ width: '100%' }}
          icon={<CandyIcon name="retry" color={n.sunInk} size={24} />}
        />
        <GameButton
          label={ru ? 'Домой' : 'Home'}
          variant="ghost"
          onPress={onExit}
          disabled={disabled}
          style={{ width: '100%' }}
          icon={<CandyIcon name="home" size={24} />}
        />
      </ScrollView>
    </Animated.View>
  );
}
