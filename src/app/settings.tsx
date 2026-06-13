import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { Alert, Linking, Pressable, ScrollView, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { ReactNode } from 'react';

import { t } from '@/core/i18n';
import type { LangSetting } from '@/core/i18n';
import { useAnalyticsStore } from '@/features/analytics';
import { MONETIZATION } from '@/features/monetization';
import { useScores } from '@/features/scores';
import { useLang, useSettings } from '@/features/settings';
import { AppText, BLOCK_THEMES, GameButton, colors, radii, spacing } from '@/ui';

const PRIVACY_URL = 'https://bloxx.193.160.208.95.nip.io/privacy.html';

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
        gap: 12,
      }}
    >
      <AppText preset="body" style={{ flexShrink: 1 }}>
        {label}
      </AppText>
      {children}
    </View>
  );
}

function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: radii.button,
        backgroundColor: active ? colors.accent : colors.surface,
      }}
    >
      <AppText preset="caption" style={{ color: active ? '#1B2A4A' : colors.textPrimary }}>
        {label}
      </AppText>
    </Pressable>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const lang = useLang();
  const settings = useSettings();
  const analyticsOptOut = useAnalyticsStore((state) => state.optOut);
  const setAnalyticsOptOut = useAnalyticsStore((state) => state.setOptOut);
  const resetBest = useScores((s) => s.resetBest);

  const confirmReset = () => {
    Alert.alert(t('settings.resetBest', lang), t('settings.resetBestConfirm', lang), [
      { text: t('settings.cancel', lang), style: 'cancel' },
      { text: t('settings.confirm', lang), style: 'destructive', onPress: resetBest },
    ]);
  };

  const langOptions: { value: LangSetting; label: string }[] = [
    { value: 'system', label: t('settings.langSystem', lang) },
    { value: 'ru', label: 'RU' },
    { value: 'en', label: 'EN' },
  ];

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={{ padding: spacing.l, gap: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: spacing.m }}>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <AppText preset="title">{'<'}</AppText>
          </Pressable>
          <AppText preset="title">{t('settings.title', lang)}</AppText>
        </View>

        <Row label={t('settings.sound', lang)}>
          <Switch
            value={settings.sound}
            onValueChange={(value) => settings.update({ sound: value })}
            trackColor={{ true: colors.accent }}
          />
        </Row>

        <Row label={t('settings.haptics', lang)}>
          <Switch
            value={settings.haptics}
            onValueChange={(value) => settings.update({ haptics: value })}
            trackColor={{ true: colors.accent }}
          />
        </Row>

        <Row label={t('settings.praiseTone', lang)}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Chip
              label={t('settings.toneClassic', lang)}
              active={settings.praiseTone === 'classic'}
              onPress={() => settings.update({ praiseTone: 'classic' })}
            />
            <Chip
              label={t('settings.toneMeme', lang)}
              active={settings.praiseTone === 'meme'}
              onPress={() => settings.update({ praiseTone: 'meme' })}
            />
          </View>
        </Row>

        <Row label={t('settings.blockTheme', lang)}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {BLOCK_THEMES.map((theme) => (
              <Pressable
                key={theme.id}
                onPress={() => settings.update({ themeId: theme.id })}
                style={{
                  padding: 6,
                  borderRadius: radii.button,
                  backgroundColor: settings.themeId === theme.id ? colors.accent : colors.surface,
                }}
              >
                <View style={{ flexDirection: 'row', gap: 3 }}>
                  {theme.cellColors.slice(0, 4).map((color) => (
                    <View
                      key={color}
                      style={{ width: 14, height: 14, borderRadius: 3, backgroundColor: color }}
                    />
                  ))}
                </View>
              </Pressable>
            ))}
          </View>
        </Row>

        <Row label={t('settings.language', lang)}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {langOptions.map((option) => (
              <Chip
                key={option.value}
                label={option.label}
                active={settings.lang === option.value}
                onPress={() => settings.update({ lang: option.value })}
              />
            ))}
          </View>
        </Row>

        <Row label={t('settings.analytics', lang)}>
          <Switch
            value={!analyticsOptOut}
            onValueChange={(value) => setAnalyticsOptOut(!value)}
            trackColor={{ true: colors.accent }}
          />
        </Row>

        {MONETIZATION.iapEnabled ? (
          <View style={{ gap: spacing.s, marginTop: spacing.m }}>
            <GameButton label={t('settings.removeAds', lang)} onPress={() => {}} />
            <GameButton
              label={t('settings.restorePurchases', lang)}
              variant="ghost"
              onPress={() => {}}
            />
          </View>
        ) : null}

        <View style={{ marginTop: spacing.l, gap: spacing.s }}>
          <Pressable onPress={() => Linking.openURL(PRIVACY_URL).catch(() => {})}>
            <AppText preset="caption" style={{ textDecorationLine: 'underline' }}>
              {t('settings.privacy', lang)}
            </AppText>
          </Pressable>
          <AppText preset="caption">
            {t('settings.version', lang)}: {Constants.expoConfig?.version ?? '1.1.0'}
          </AppText>
        </View>

        <View style={{ marginTop: spacing.xl }}>
          <GameButton
            label={t('settings.resetBest', lang)}
            variant="danger"
            onPress={confirmReset}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
