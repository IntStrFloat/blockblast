import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { LangSetting } from '@/core/i18n';
import { useAnalyticsStore } from '@/features/analytics';
import {
  getLocalNotificationPermissionStatus,
  requestNotificationPermissions,
} from '@/features/notifications';
import { applyLocalNotificationPlan } from '@/features/notifications/local/scheduler';
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
  CandyBackground,
  CandyIcon,
  ConfirmDialog,
  GameButton,
  Overlay,
  nightCandy as n,
} from '@/ui';
import type { CandyIconName } from '@/ui/icons/CandyIcon';
import { CandyRoundButton, CandyToggle } from '@/ui/primitives/CandyControls';
import { Block } from '@/features/game/components/Block';

const PRIVACY_URL = 'https://bloxx.193.160.208.95.nip.io/privacy.html';
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <AppText style={styles.sectionTitle}>{title}</AppText>
      {children}
    </View>
  );
}
function Row({
  icon,
  label,
  detail,
  children,
}: {
  icon: CandyIconName;
  label: string;
  detail?: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.row}>
      <CandyIcon name={icon} size={22} color={n.lavender} />
      <View style={{ flex: 1, gap: 2 }}>
        <AppText style={styles.rowLabel}>{label}</AppText>
        {detail && <AppText style={styles.detail}>{detail}</AppText>}
      </View>
      {children}
    </View>
  );
}
function Segments<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.segmentRail}>
      {options.map((option) => (
        <Pressable
          key={option.value}
          accessibilityRole="button"
          accessibilityState={{ selected: option.value === value }}
          onPress={() => onChange(option.value)}
          style={[styles.segment, option.value === value && { backgroundColor: n.white }]}
        >
          <AppText
            style={{
              fontFamily: 'Nunito_800ExtraBold',
              fontSize: 14,
              lineHeight: 20,
              color: option.value === value ? n.night900 : n.lavender,
            }}
          >
            {option.label}
          </AppText>
        </Pressable>
      ))}
    </View>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const lang = useLang();
  const ru = lang === 'ru';
  const settings = useSettings();
  const analyticsOptOut = useAnalyticsStore((s) => s.optOut);
  const setAnalyticsOptOut = useAnalyticsStore((s) => s.setOptOut);
  const resetBest = useScores((s) => s.resetBest);
  const activeTheme = useActiveWorldTheme().id;
  const unlocked = new Set(useUnlockedWorldThemes().map((theme) => theme.id));
  const [resetOpen, setResetOpen] = useState(false);
  const [languageOpen, setLanguageOpen] = useState(false);
  const [permission, setPermission] = useState(false);
  const [notificationBusy, setNotificationBusy] = useState(false);
  useEffect(() => {
    let active = true;
    void getLocalNotificationPermissionStatus().then((status) => {
      if (active) setPermission(status === 'granted');
    });
    return () => {
      active = false;
    };
  }, []);
  const configureNotifications = async (enabled: boolean) => {
    if (notificationBusy) return;
    if (!enabled) {
      settings.update({ reminders: false });
      await applyLocalNotificationPlan([], lang);
      return;
    }
    setNotificationBusy(true);
    try {
      const decision = await requestNotificationPermissions('settings');
      setPermission(decision.outcome === 'granted');
      if (decision.outcome === 'granted') settings.update({ reminders: true });
      else await Linking.openSettings();
    } finally {
      setNotificationBusy(false);
    }
  };
  const themeLabel = (id: string) =>
    ({
      classic: ru ? 'Карамель' : 'Candy',
      sunset: ru ? 'Закат' : 'Sunset',
      aqua: ru ? 'Мята' : 'Mint',
      neon: ru ? 'Неон' : 'Neon',
      mono: ru ? 'Моно' : 'Mono',
      galaxy: ru ? 'Космос' : 'Galaxy',
      gold: ru ? 'Золото' : 'Gold',
    })[id] ?? id;
  return (
    <View style={styles.screen}>
      <CandyBackground />
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <CandyRoundButton
          icon="back"
          label={ru ? 'Назад' : 'Back'}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        />
        <AppText preset="title" style={{ flex: 1, textAlign: 'center' }}>
          {ru ? 'Настройки' : 'Settings'}
        </AppText>
        <View style={{ width: 48 }} />
      </View>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
      >
        <Section title={ru ? 'Игра' : 'Game'}>
          <Row icon="sound" label={ru ? 'Звук' : 'Sound'}>
            <CandyToggle
              label={ru ? 'Звук' : 'Sound'}
              value={settings.sound}
              onChange={(sound) => settings.update({ sound })}
            />
          </Row>
          <Row icon="vibration" label={ru ? 'Вибрация' : 'Haptics'}>
            <CandyToggle
              label={ru ? 'Вибрация' : 'Haptics'}
              value={settings.haptics}
              onChange={(haptics) => settings.update({ haptics })}
            />
          </Row>
          <Row
            icon="wardrobe"
            label={ru ? 'Капи на поле' : 'Capy on the board'}
            detail={ru ? 'Советы и реакции на ходы' : 'Tips and reactions'}
          >
            <CandyToggle
              label={ru ? 'Капи на поле' : 'Capy on the board'}
              value={settings.showMascot}
              onChange={(showMascot) => settings.update({ showMascot })}
            />
          </Row>
          <View style={styles.tone}>
            <AppText style={styles.rowLabel}>{ru ? 'Тон похвалы' : 'Praise tone'}</AppText>
            <Segments
              options={[
                { value: 'classic', label: ru ? 'Добрый' : 'Kind' },
                { value: 'meme', label: ru ? 'Дерзкий' : 'Cheeky' },
              ]}
              value={settings.praiseTone}
              onChange={(praiseTone) => settings.update({ praiseTone })}
            />
          </View>
        </Section>
        <Section title={ru ? 'Тема поля' : 'Board theme'}>
          <View style={styles.themes}>
            {[...WORLD_THEMES]
              .sort(
                (a, b) =>
                  ['classic', 'sunset', 'aqua'].indexOf(b.id) -
                  ['classic', 'sunset', 'aqua'].indexOf(a.id),
              )
              .map((theme) => {
                const available = unlocked.has(theme.id);
                const world = Object.entries(PROGRESSION_CONFIG.worldThemeId).find(
                  ([, id]) => id === theme.id,
                )?.[0];
                return (
                  <Pressable
                    key={theme.id}
                    accessibilityRole="button"
                    accessibilityLabel={themeLabel(theme.id)}
                    accessibilityState={{
                      selected: theme.id === activeTheme,
                      disabled: !available,
                    }}
                    disabled={!available}
                    onPress={() => setActiveWorldTheme(theme.id)}
                    style={[
                      styles.themeTile,
                      { backgroundColor: theme.boardBg },
                      theme.id === activeTheme && { borderColor: n.sun },
                      !available && { opacity: 0.45 },
                    ]}
                  >
                    <View style={styles.swatches}>
                      {theme.cellColors.slice(0, 6).map((color, i) => (
                        <Block key={i} size={15} color={color} />
                      ))}
                    </View>
                    <View style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}>
                      {!available && <CandyIcon name="lock" size={12} color={n.muted} />}
                      <AppText
                        style={{
                          fontFamily: 'Nunito_800ExtraBold',
                          color: theme.id === activeTheme ? n.sun : n.lavender,
                          fontSize: 12,
                          lineHeight: 16,
                        }}
                      >
                        {available ? themeLabel(theme.id) : `${ru ? 'Мир' : 'World'} ${world}`}
                      </AppText>
                    </View>
                  </Pressable>
                );
              })}
          </View>
        </Section>
        <Section title={ru ? 'Данные' : 'Data'}>
          <Pressable
            onPress={() => setLanguageOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={ru ? 'Язык' : 'Language'}
          >
            <Row icon="language" label={ru ? 'Язык' : 'Language'}>
              <AppText style={{ color: n.lavender }}>
                {settings.lang === 'system'
                  ? ru
                    ? 'Авто'
                    : 'Auto'
                  : settings.lang === 'ru'
                    ? 'Русский'
                    : 'English'}
              </AppText>
              <CandyIcon name="back" size={18} color={n.muted} />
            </Row>
          </Pressable>
          <Row
            icon="bell"
            label={ru ? 'Напоминания' : 'Reminders'}
            detail={ru ? 'Про серию дней' : 'Keep your streak'}
          >
            <CandyToggle
              label={ru ? 'Напоминания' : 'Reminders'}
              value={settings.reminders && permission}
              disabled={notificationBusy}
              onChange={(value) => {
                void configureNotifications(value);
              }}
            />
          </Row>
          <Row icon="chart" label={ru ? 'Анонимная статистика' : 'Anonymous analytics'}>
            <CandyToggle
              label={ru ? 'Анонимная статистика' : 'Anonymous analytics'}
              value={!analyticsOptOut}
              onChange={(value) => setAnalyticsOptOut(!value)}
            />
          </Row>
        </Section>
        <GameButton
          variant="text"
          label={ru ? 'Сбросить рекорд…' : 'Reset best score…'}
          onPress={() => setResetOpen(true)}
        />
        <Pressable
          onPress={() => {
            void Linking.openURL(PRIVACY_URL);
          }}
          accessibilityRole="link"
          accessibilityLabel={ru ? 'Конфиденциальность' : 'Privacy'}
        >
          <AppText style={styles.footer}>
            {ru ? 'Версия' : 'Version'} {Constants.expoConfig?.version ?? '1.1.46'} ·{' '}
            {ru ? 'Конфиденциальность' : 'Privacy'}
          </AppText>
        </Pressable>
      </ScrollView>
      <ConfirmDialog
        visible={resetOpen}
        title={ru ? 'Сбросить рекорд?' : 'Reset best score?'}
        message={
          ru
            ? 'Рекорд классики станет равен нулю. Прогресс Капи сохранится.'
            : 'Your Classic best becomes zero. Capy progress is kept.'
        }
        confirmLabel={ru ? 'Сбросить' : 'Reset'}
        cancelLabel={ru ? 'Отмена' : 'Cancel'}
        destructive
        onConfirm={() => {
          resetBest();
          setResetOpen(false);
        }}
        onCancel={() => setResetOpen(false)}
      />
      {languageOpen && (
        <Overlay onDismiss={() => setLanguageOpen(false)}>
          <AppText preset="title">{ru ? 'Язык' : 'Language'}</AppText>
          {(
            [
              { value: 'system', label: ru ? 'Авто' : 'Auto' },
              { value: 'ru', label: 'Русский' },
              { value: 'en', label: 'English' },
            ] as { value: LangSetting; label: string }[]
          ).map((option) => (
            <GameButton
              key={option.value}
              variant={settings.lang === option.value ? 'primary' : 'ghost'}
              label={option.label}
              onPress={() => {
                settings.update({ lang: option.value });
                setLanguageOpen(false);
              }}
            />
          ))}
        </Overlay>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: n.night900 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  content: { width: '100%', maxWidth: 520, alignSelf: 'center', paddingHorizontal: 16, gap: 16 },
  section: {
    borderRadius: 24,
    padding: 16,
    backgroundColor: 'rgba(20,26,92,0.88)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  sectionTitle: {
    fontFamily: 'Nunito_900Black',
    color: n.muted,
    fontSize: 12,
    lineHeight: 18,
    letterSpacing: 1.44,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  row: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  rowLabel: { fontFamily: 'Nunito_800ExtraBold', fontSize: 16, lineHeight: 22 },
  detail: { color: n.muted, fontSize: 12, lineHeight: 17 },
  tone: { paddingTop: 14, gap: 10 },
  segmentRail: { flexDirection: 'row', padding: 4, borderRadius: 16, backgroundColor: '#0C1044' },
  segment: {
    flex: 1,
    minHeight: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  themes: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingTop: 8 },
  themeTile: {
    width: '22%',
    flexGrow: 1,
    minWidth: 64,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.14)',
    padding: 8,
    gap: 8,
    alignItems: 'center',
  },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', width: 51, gap: 2 },
  footer: { color: n.muted, fontSize: 12, lineHeight: 18, textAlign: 'center' },
});
