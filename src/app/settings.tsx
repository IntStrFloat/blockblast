import Constants from 'expo-constants';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Linking, Pressable, ScrollView, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { t } from '@/core/i18n';
import type { LangSetting } from '@/core/i18n';
import { useAnalyticsStore } from '@/features/analytics';
import { MONETIZATION } from '@/features/monetization';
import {
  requestNotificationPermissions,
} from '@/features/notifications';
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
  ConfirmDialog,
  GameButton,
  LockIcon,
  radii,
  spacing,
} from '@/ui';

const HOME_BLUE = ['#2548B8', '#1998DC'] as const;
const PRIVACY_URL = 'https://bloxx.193.160.208.95.nip.io/privacy.html';

type SettingsTab = 'game' | 'appearance' | 'data';

/** Мир, на котором открывается тема (для подсказки закрытых). */
const THEME_WORLD: Record<string, number> = Object.fromEntries(
  Object.entries(PROGRESSION_CONFIG.worldThemeId).map(([world, id]) => [id, Number(world)]),
);

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={{ gap: spacing.s }}>
      <AppText preset="caption" style={styles.sectionTitle}>
        {title.toUpperCase()}
      </AppText>
      <View style={styles.sectionCard}>{children}</View>
    </View>
  );
}

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
    <View style={[styles.row, !first && styles.rowWithDivider]}>
      <AppText preset="body" style={styles.rowLabel}>
        {label}
      </AppText>
      <View style={styles.rowControl}>{children}</View>
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
      style={({ pressed }) => [styles.chip, active && styles.chipActive, pressed && styles.pressed]}
    >
      {active ? <CheckIcon size={14} color="#1A56C7" /> : null}
      <AppText preset="caption" style={[styles.chipText, active && styles.chipTextActive]}>
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
      style={({ pressed }) => [
        styles.themeTile,
        active && styles.themeTileActive,
        !unlocked && styles.themeTileLocked,
        pressed && unlocked && styles.pressed,
      ]}
    >
      <View style={styles.swatches}>
        {swatches.slice(0, 6).map((color, index) => (
          <View
            key={`${color}-${index}`}
            style={{ width: 16, height: 16, borderRadius: 5, backgroundColor: color }}
          />
        ))}
      </View>
      <View style={styles.themeTileLabel}>
        {!unlocked ? <LockIcon size={13} color="rgba(230,244,255,0.72)" /> : null}
        {active ? <CheckIcon size={13} color="#FFF7D6" /> : null}
        <AppText preset="caption" numberOfLines={2} style={styles.themeTileText}>
          {label}
        </AppText>
      </View>
    </Pressable>
  );
}

function SettingsTabButton({
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
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.tab, active && styles.tabActive, pressed && styles.pressed]}
    >
      <AppText preset="caption" numberOfLines={1} style={[styles.tabText, active && styles.tabTextActive]}>
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
  const resetBest = useScores((state) => state.resetBest);
  const activeThemeId = useActiveWorldTheme().id;
  const unlockedThemeIds = new Set(useUnlockedWorldThemes().map((theme) => theme.id));
  const [activeTab, setActiveTab] = useState<SettingsTab>('game');
  const [resetOpen, setResetOpen] = useState(false);
  const [notificationBusy, setNotificationBusy] = useState(false);

  const configureNotifications = async () => {
    if (notificationBusy) return;
    setNotificationBusy(true);
    try {
      const decision = await requestNotificationPermissions('settings');
      if (decision.outcome !== 'granted') {
        await Linking.openSettings();
      }
    } finally {
      setNotificationBusy(false);
    }
  };

  const langOptions: { value: LangSetting; label: string }[] = [
    { value: 'system', label: t('settings.langSystem', lang) },
    { value: 'ru', label: 'RU' },
    { value: 'en', label: 'EN' },
  ];
  const tabs: { id: SettingsTab; label: string }[] = [
    { id: 'game', label: t('settings.tabGame', lang) },
    { id: 'appearance', label: t('settings.tabAppearance', lang) },
    { id: 'data', label: t('settings.tabData', lang) },
  ];
  const switchTrack = { true: '#A9E16E', false: 'rgba(8, 48, 137, 0.62)' };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <LinearGradient colors={HOME_BLUE} style={styles.background} />

      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel={t('leaderboard.back', lang)}
          hitSlop={8}
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
        >
          <ChevronIcon direction="left" size={24} color="#F4FAFF" />
        </Pressable>
        <AppText preset="speech" style={styles.title}>
          {t('settings.title', lang)}
        </AppText>
        <View style={styles.headerSpacer} />
      </View>

      <View accessibilityRole="tablist" style={styles.tabRail}>
        {tabs.map((tab) => (
          <SettingsTabButton
            key={tab.id}
            label={tab.label}
            active={activeTab === tab.id}
            onPress={() => setActiveTab(tab.id)}
          />
        ))}
      </View>

      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {activeTab === 'game' ? (
          <>
            <Section title={t('settings.secAudio', lang)}>
              <Row label={t('settings.sound', lang)} first>
                <Switch
                  value={settings.sound}
                  onValueChange={(value) => settings.update({ sound: value })}
                  accessibilityRole="switch"
                  accessibilityLabel={t('settings.sound', lang)}
                  accessibilityState={{ checked: settings.sound }}
                  trackColor={switchTrack}
                  thumbColor="#FFFFFF"
                />
              </Row>
              <Row label={t('settings.haptics', lang)}>
                <Switch
                  value={settings.haptics}
                  onValueChange={(value) => settings.update({ haptics: value })}
                  accessibilityRole="switch"
                  accessibilityLabel={t('settings.haptics', lang)}
                  accessibilityState={{ checked: settings.haptics }}
                  trackColor={switchTrack}
                  thumbColor="#FFFFFF"
                />
              </Row>
            </Section>

            <Section title={t('settings.secFeel', lang)}>
              <Row label={t('settings.showMascot', lang)} first>
                <Switch
                  value={settings.showMascot}
                  onValueChange={(value) => settings.update({ showMascot: value })}
                  accessibilityRole="switch"
                  accessibilityLabel={t('settings.showMascot', lang)}
                  accessibilityState={{ checked: settings.showMascot }}
                  trackColor={switchTrack}
                  thumbColor="#FFFFFF"
                />
              </Row>
            </Section>
          </>
        ) : null}

        {activeTab === 'appearance' ? (
          <>
            <Section title={t('settings.secFeel', lang)}>
              <Row label={t('settings.praiseTone', lang)} first>
                <View style={styles.chipGroup}>
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

            <Section title={t('settings.worldTheme', lang)}>
              <View style={styles.themeGrid}>
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
            </Section>
          </>
        ) : null}

        {activeTab === 'data' ? (
          <>
            <Section title={t('settings.secLangData', lang)}>
              <Row label={t('settings.language', lang)} first>
                <View style={styles.chipGroup}>
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
                  accessibilityRole="switch"
                  accessibilityLabel={t('settings.analytics', lang)}
                  accessibilityState={{ checked: !analyticsOptOut }}
                  trackColor={switchTrack}
                  thumbColor="#FFFFFF"
                />
              </Row>
              <Row label={t('settings.notifications', lang)}>
                <GameButton
                  label={t('settings.notificationsManage', lang)}
                  disabled={notificationBusy}
                  onPress={() => {
                    void configureNotifications();
                  }}
                  variant="ghost"
                />
              </Row>
            </Section>

            {MONETIZATION.iapEnabled ? (
              <View style={styles.purchaseActions}>
                <GameButton label={t('settings.removeAds', lang)} onPress={() => {}} />
                <GameButton
                  label={t('settings.restorePurchases', lang)}
                  variant="ghost"
                  onPress={() => {}}
                />
              </View>
            ) : null}

            <View style={styles.meta}>
              <Pressable
                onPress={() => Linking.openURL(PRIVACY_URL).catch(() => {})}
                accessibilityRole="link"
                hitSlop={8}
                style={({ pressed }) => [styles.privacyLink, pressed && styles.pressed]}
              >
                <AppText preset="caption" style={styles.metaText}>
                  {t('settings.privacy', lang)}
                </AppText>
              </Pressable>
              <AppText preset="caption" style={styles.metaText}>
                {t('settings.version', lang)}: {Constants.expoConfig?.version ?? '1.1.0'}
              </AppText>
            </View>

            <GameButton
              label={t('settings.resetBest', lang)}
              variant="danger"
              onPress={() => setResetOpen(true)}
            />
          </>
        ) : null}
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

const styles = {
  safeArea: {
    flex: 1,
    backgroundColor: HOME_BLUE[1],
  },
  background: {
    position: 'absolute' as const,
    inset: 0,
  },
  header: {
    minHeight: 58,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: spacing.m,
    paddingTop: spacing.xs,
  },
  backButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: 'rgba(255,255,255,0.11)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  headerSpacer: {
    width: 48,
    height: 48,
  },
  title: {
    color: '#FFFFFF',
    fontFamily: 'Unbounded_700Bold',
    fontSize: 27,
  },
  tabRail: {
    flexDirection: 'row' as const,
    gap: 4,
    marginHorizontal: spacing.m,
    padding: 4,
    borderRadius: 18,
    backgroundColor: 'rgba(5,45,144,0.26)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  tab: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: 4,
    borderRadius: 14,
  },
  tabActive: {
    backgroundColor: '#FFFFFF',
    boxShadow: '0 3px 7px rgba(3, 42, 129, 0.28)',
  },
  tabText: {
    color: 'rgba(237,249,255,0.82)',
    fontFamily: 'Unbounded_700Bold',
    fontSize: 13,
  },
  tabTextActive: {
    color: '#1A56C7',
  },
  scrollContent: {
    flexGrow: 1,
    gap: spacing.l,
    padding: spacing.m,
    paddingTop: spacing.l,
    paddingBottom: spacing.xl,
  },
  sectionTitle: {
    marginLeft: spacing.s,
    color: 'rgba(240,250,255,0.78)',
    fontFamily: 'Unbounded_700Bold',
    fontSize: 12,
    letterSpacing: 0.7,
  },
  sectionCard: {
    overflow: 'hidden' as const,
    borderRadius: radii.card,
    paddingHorizontal: spacing.m,
    backgroundColor: 'rgba(9,58,165,0.36)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.30)',
    boxShadow: '0 7px 14px rgba(9, 42, 124, 0.28)',
  },
  row: {
    minHeight: 64,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    gap: spacing.s,
  },
  rowWithDivider: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.16)',
  },
  rowLabel: {
    flexShrink: 1,
    color: '#FFFFFF',
    fontFamily: 'Unbounded_700Bold',
  },
  rowControl: {
    alignItems: 'flex-end' as const,
    justifyContent: 'center' as const,
  },
  chipGroup: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    justifyContent: 'flex-end' as const,
    gap: 6,
  },
  chip: {
    minHeight: 48,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 4,
    paddingHorizontal: 11,
    borderRadius: 14,
    backgroundColor: 'rgba(5, 44, 133, 0.40)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.24)',
  },
  chipActive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  chipText: {
    color: 'rgba(244,250,255,0.92)',
    fontFamily: 'Unbounded_700Bold',
  },
  chipTextActive: {
    color: '#1A56C7',
  },
  themeGrid: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: spacing.s,
    paddingVertical: spacing.m,
  },
  themeTile: {
    width: 100,
    minHeight: 102,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    gap: spacing.s,
    padding: spacing.s,
    borderRadius: 16,
    backgroundColor: 'rgba(4, 46, 140, 0.36)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.24)',
  },
  themeTileActive: {
    backgroundColor: 'rgba(255,194,43,0.24)',
    borderColor: '#FFE46B',
    borderWidth: 2,
  },
  themeTileLocked: {
    opacity: 0.54,
  },
  swatches: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    justifyContent: 'center' as const,
    gap: 4,
  },
  themeTileLabel: {
    width: '100%' as const,
    minHeight: 16,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 3,
  },
  themeTileText: {
    flexShrink: 1,
    color: '#FFFFFF',
    fontFamily: 'Unbounded_700Bold',
  },
  purchaseActions: {
    gap: spacing.s,
  },
  meta: {
    alignItems: 'center' as const,
    gap: spacing.xs,
    marginTop: -spacing.s,
  },
  privacyLink: {
    minHeight: 48,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: spacing.s,
  },
  metaText: {
    color: 'rgba(235,249,255,0.74)',
    textDecorationLine: 'underline' as const,
  },
  pressed: {
    opacity: 0.72,
    transform: [{ scale: 0.97 }],
  },
} as const;
