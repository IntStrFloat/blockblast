import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';

import { t } from '@/core/i18n';
import { useLang } from '@/features/settings';
import { AppText, GameButton, StarIcon, spacing } from '@/ui';

import type { AdventureFailureTip } from '../logic/failure';
import { JewelIcon } from './JewelIcon';

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

export function FailOverlay({ onRetry, onRetryWithHelp, onExit, objective, current, target, remaining, tip, helpEligible = false, disabled = false }: Props) {
  const lang = useLang();
  const [showTip, setShowTip] = useState(false);
  const resultLabel = `${t(objective === 'jewels' ? 'adventure.failureCollected' : 'adventure.failureScore', lang)} ${current}/${target}, ${t('adventure.failureRemaining', lang)} ${remaining}`;
  const tipLabel = t(`adventure.failureTip.${tip}` as const, lang);
  const canHelp = helpEligible && onRetryWithHelp != null;

  return (
    <Animated.View entering={FadeIn.duration(220)} style={styles.scrim}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Animated.View entering={ZoomIn.duration(220)} style={styles.panel} accessibilityViewIsModal>
          <LinearGradient colors={['#173C5A', '#102A47']} style={styles.surface}>
            <AppText preset="title" style={styles.title}>{t('adventure.failedTitle', lang)}</AppText>
            <View accessible accessibilityLabel={resultLabel} style={styles.result}>
              <View style={styles.counter}>
                {objective === 'jewels' ? <JewelIcon size={36} /> : <StarIcon size={30} color="#FFCE55" />}
                <AppText preset="score" style={styles.value}>{current}/{target}</AppText>
              </View>
              <View style={styles.track}>
                <View style={[styles.fill, { width: `${Math.max(0, Math.min(100, current / Math.max(1, target) * 100))}%` }]} />
              </View>
            </View>
            <View style={styles.actions}>
              {canHelp ? <GameButton label={lang === 'ru' ? 'С подсказкой · бесплатно' : 'With a hint · free'} onPress={onRetryWithHelp} disabled={disabled} /> : null}
              <GameButton label={t('adventure.retry', lang)} onPress={onRetry} size="lg" variant={canHelp ? 'ghost' : 'primary'} disabled={disabled} />
              <GameButton label={t('adventure.exit', lang)} variant="ghost" onPress={onExit} disabled={disabled} />
            </View>
            <Pressable accessibilityRole="button" accessibilityState={{ expanded: showTip }} onPress={() => setShowTip((value) => !value)} style={styles.tipButton}>
              <AppText preset="caption" style={styles.tipLabel}>{lang === 'ru' ? 'Совет' : 'Tip'}</AppText>
            </Pressable>
            {showTip ? <AppText preset="body" style={styles.tip}>{tipLabel}</AppText> : null}
          </LinearGradient>
        </Animated.View>
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  scrim: { ...StyleSheet.absoluteFill, zIndex: 240, paddingHorizontal: spacing.l, paddingVertical: spacing.xl, backgroundColor: 'rgba(3,15,29,0.7)' },
  scrollContent: { flexGrow: 1, justifyContent: 'center', alignItems: 'center' },
  panel: { width: '100%', maxWidth: 368, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(126,231,255,0.42)', borderRadius: 24 },
  surface: { alignItems: 'center', gap: spacing.m, padding: spacing.l },
  title: { color: '#FFFFFF', fontSize: 24, lineHeight: 32, textAlign: 'center' },
  result: { width: '100%', gap: 12, alignItems: 'center' },
  counter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  value: { fontSize: 28, color: '#FFFFFF' },
  track: { width: '100%', height: 10, borderRadius: 5, overflow: 'hidden', backgroundColor: '#284B63' },
  fill: { height: '100%', borderRadius: 5, backgroundColor: '#67DFD8' },
  actions: { width: '100%', gap: spacing.s, paddingTop: spacing.s },
  tipButton: { minHeight: 48, minWidth: 80, alignItems: 'center', justifyContent: 'center' },
  tipLabel: { color: '#BEEAF6' },
  tip: { color: '#FFFFFF', fontSize: 15, lineHeight: 21, textAlign: 'center' },
});
