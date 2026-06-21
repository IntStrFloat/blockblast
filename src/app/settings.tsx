import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { Linking, Pressable, ScrollView, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, type ReactNode } from 'react';

import { t } from '@/core/i18n';
import type { LangSetting } from '@/core/i18n';
import { useAnalyticsStore } from '@/features/analytics';
import { MONETIZATION } from '@/features/monetization';
import { PROGRESSION_CONFIG } from '@/features/progression';
import { useScores } from '@/features/scores';
import { useLang, useSettings } from '@/features/settings';
import {
  WORLD_THEMES,
  setActiveWorldTheme,
  useActiveWorldTheme,
  useUnlockedWorldThemes,
} from '@/features/themes';
import {
  AppText,
  CheckIcon,
  ChevronIcon,
  ClayCard,
  ConfirmDialog,
  GameButton,
  IconButton,
  LockIcon,
  colors,
  radii,
  spacing,
} from '@/ui';

/** Мир, на котором открывается тема (для подсказки на закрытых). */
const THEME_WORLD: Record<string, number> = Object.fromEntries(
  Object.entries(PROGRESSION_CONFIG.worldThemeId).map(([world, id]) => [id, Number(world)]),
);

const PRIVACY_URL = 'https://bloxx.193.160.208.95.nip.io/privacy.html';

/** Секция настроек: муты-заголовок + «глиняная» карточка с рядами. */
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={{ gap: spacing.s }}>
      <AppText preset="caption" style={{ color: colors.textDim, marginLeft: spacing.xs }}>
        {title.toUpperCase()}
      </AppText>
      <ClayCard style={{ paddingVertical: spacing.xs }}>{children}</ClayCard>
    </View>
  );
}

/** Ряд внутри секции с тонким разделителем (кроме первого). */
function Row({
  label,
  children,
  first = false,
}: {
  label: string;
  children: ReactNode;
  first?: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
        gap: 12,
        borderTopWidth: first ? 0 : 1,
        borderTopColor: colors.hairline,
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
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={{
        minHeight: 36,
        paddingHorizontal: 14,
        justifyContent: 'center',
        borderRadius: radii.button,
        backgroundColor: active ? colors.accent : colors.cardRaised,
        borderWidth: 1,
        borderColor: active ? colors.accent : colors.hairline,
      }}
    >
      <AppText preset="caption" style={{ color: active ? colors.bgBottom : colors.textPrimary }}>
        {label}
      </AppText>
    </Pressable>
  );
}

function ThemeTile({
  swatches,
  label,
  active,
  unlocked,
  onPress,
}: {
  swatches: string[];
  label: string;
  active: boolean;
  unlocked: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      disabled={!unlocked}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active, disabled: !unlocked }}
      style={{
        width: 100,
        padding: spacing.s,
        gap: spacing.s,
        alignItems: 'center',
        borderRadius: radii.card,
        backgroundColor: colors.cardRaised,
        borderWidth: 2,
        borderColor: active ? colors.accent : colors.hairline,
        opacity: unlocked ? 1 : 0.45,
      }}
    >
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, justifyContent: 'center' }}>
        {swatches.slice(0, 6).map((color, i) => (
          <View
            key={`${color}-${i}`}
            style={{ width: 16, height: 16, borderRadius: 5, backgroundColor: color }}
          />
        ))}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        {!unlocked ? <LockIcon size={12} /> : active ? <CheckIcon size={12} color={colors.accent} /> : null}
        <AppText
          preset="caption"
          numberOfLines={1}
          style={{ color: active ? colors.accent : colors.textPrimary }}
        >
          {label}
        </AppText>
      </View>
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
  const activeThemeId = useActiveWorldTheme().id;
  const unlockedThemeIds = new Set(useUnlockedWorldThemes().map((theme) => theme.id));

  const [resetOpen, setResetOpen] = useState(false);
  const confirmReset = () => setResetOpen(true);

  const langOptions: { value: LangSetting; label: string }[] = [
    { value: 'system', label: t('settings.langSystem', lang) },
    { value: 'ru', label: 'RU' },
    { value: 'en', label: 'EN' },
  ];

  const switchTrack = { true: colors.accent, false: colors.track };

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.s,
          paddingHorizontal: spacing.l,
          paddingTop: spacing.s,
          paddingBottom: spacing.s,
        }}
      >
        <IconButton
          onPress={() => router.back()}
          accessibilityLabel={t('settings.title', lang)}
          size={44}
        >
          <ChevronIcon direction="left" />
        </IconButton>
        <AppText preset="title" style={{ fontSize: 22 }}>
          {t('settings.title', lang)}
        </AppText>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: spacing.l, paddingTop: spacing.s, gap: spacing.l }}
        showsVerticalScrollIndicator={false}
      >
        <Section title={t('settings.secAudio', lang)}>
          <Row label={t('settings.sound', lang)} first>
            <Switch
              value={settings.sound}
              onValueChange={(value) => settings.update({ sound: value })}
              trackColor={switchTrack}
            />
          </Row>
          <Row label={t('settings.haptics', lang)}>
            <Switch
              value={settings.haptics}
              onValueChange={(value) => settings.update({ haptics: value })}
              trackColor={switchTrack}
            />
          </Row>
        </Section>

        <Section title={t('settings.secFeel', lang)}>
          <Row label={t('settings.showMascot', lang)} first>
            <Switch
              value={settings.showMascot}
              onValueChange={(v) => settings.update({ showMascot: v })}
              trackColor={switchTrack}
            />
          </Row>
          <Row label={t('settings.praiseTone', lang)}>
            <View style={{ flexDirection: 'row', gap: spacing.s }}>
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
        </Section>

        <View style={{ gap: spacing.s }}>
          <AppText preset="caption" style={{ color: colors.textDim, marginLeft: spacing.xs }}>
            {t('settings.worldTheme', lang).toUpperCase()}
          </AppText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s }}>
            {WORLD_THEMES.map((theme) => {
              const unlocked = unlockedThemeIds.has(theme.id);
              const active = theme.id === activeThemeId;
              const label = unlocked
                ? t(theme.nameKey, lang)
                : `${t('settings.themeLocked', lang)} ${THEME_WORLD[theme.id] ?? ''}`.trim();
              return (
                <ThemeTile
                  key={theme.id}
                  swatches={theme.cellColors}
                  label={label}
                  active={active}
                  unlocked={unlocked}
                  onPress={() => setActiveWorldTheme(theme.id)}
                />
              );
            })}
          </View>
        </View>

        <Section title={t('settings.secLangData', lang)}>
          <Row label={t('settings.language', lang)} first>
            <View style={{ flexDirection: 'row', gap: spacing.s }}>
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
              trackColor={switchTrack}
            />
          </Row>
        </Section>

        {MONETIZATION.iapEnabled ? (
          <View style={{ gap: spacing.s }}>
            <GameButton label={t('settings.removeAds', lang)} onPress={() => {}} />
            <GameButton
              label={t('settings.restorePurchases', lang)}
              variant="ghost"
              onPress={() => {}}
            />
          </View>
        ) : null}

        <View style={{ alignItems: 'center', gap: spacing.xs, marginTop: spacing.xs }}>
          <Pressable onPress={() => Linking.openURL(PRIVACY_URL).catch(() => {})} hitSlop={8}>
            <AppText preset="caption" style={{ textDecorationLine: 'underline' }}>
              {t('settings.privacy', lang)}
            </AppText>
          </Pressable>
          <AppText preset="caption" style={{ color: colors.textDim }}>
            {t('settings.version', lang)}: {Constants.expoConfig?.version ?? '1.1.0'}
          </AppText>
        </View>

        <GameButton
          label={t('settings.resetBest', lang)}
          variant="danger"
          onPress={confirmReset}
        />
      </ScrollView>

      <ConfirmDialog
        visible={resetOpen}
        title={t('settings.resetBest', lang)}
        message={t('settings.resetBestConfirm', lang)}
        confirmLabel={t('settings.confirm', lang)}
        cancelLabel={t('settings.cancel', lang)}
        destructive
        onConfirm={() => {
          setResetOpen(false);
          resetBest();
        }}
        onCancel={() => setResetOpen(false)}
      />
    </SafeAreaView>
  );
}
