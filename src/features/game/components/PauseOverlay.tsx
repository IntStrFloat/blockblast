import { Pressable, StyleSheet, Switch, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { t } from '@/core/i18n';
import { useLang, useSettings } from '@/features/settings';
import { AppText, colors, radii, spacing } from '@/ui';

interface PauseOverlayProps {
  onClose: () => void;
  onRestart: () => void;
  onHome: () => void;
}

type RowIcon = 'sound' | 'haptics' | 'home' | 'restart';

function SettingsIcon({ icon }: { icon: RowIcon }) {
  if (icon === 'sound') {
    return (
      <Svg width={30} height={30} viewBox="0 0 30 30" fill="none">
        <Path d="M4 12h6l7-6v18l-7-6H4v-6z" fill="#FFFFFF" />
        <Path d="M21 10c2.6 2.6 2.6 7.4 0 10M24 7c4.2 4.2 4.2 11.8 0 16" stroke="#FFFFFF" strokeWidth={2.4} strokeLinecap="round" />
      </Svg>
    );
  }
  if (icon === 'haptics') {
    return (
      <Svg width={30} height={30} viewBox="0 0 30 30" fill="none">
        <Path d="M10 5.5h10a2 2 0 0 1 2 2v15a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2v-15a2 2 0 0 1 2-2z" stroke="#FFFFFF" strokeWidth={2.4} />
        <Path d="M4 11l-2 4 2 4M26 11l2 4-2 4" stroke="#FFFFFF" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    );
  }
  if (icon === 'home') {
    return (
      <Svg width={30} height={30} viewBox="0 0 30 30" fill="none">
        <Path d="M4 14.5 15 5l11 9.5v10H18v-7h-6v7H4v-10z" fill="#FFFFFF" stroke="#FFFFFF" strokeWidth={1.8} strokeLinejoin="round" />
      </Svg>
    );
  }
  return (
    <Svg width={30} height={30} viewBox="0 0 30 30" fill="none">
      <Path d="M24 10a10 10 0 1 0 1 8M24 10V4m0 6h-6" stroke="#FFFFFF" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function ToggleRow({
  icon,
  label,
  value,
  onValueChange,
}: {
  icon: RowIcon;
  label: string;
  value: boolean;
  onValueChange: (next: boolean) => void;
}) {
  return (
    <View style={styles.row}>
      <SettingsIcon icon={icon} />
      <AppText
        preset="button"
        style={styles.rowLabel}
        numberOfLines={2}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
      >
        {label}
      </AppText>
      <Switch
        value={value}
        onValueChange={onValueChange}
        accessibilityRole="switch"
        accessibilityLabel={label}
        accessibilityState={{ checked: value }}
        trackColor={{ false: '#293D87', true: '#53D45E' }}
        thumbColor="#FFFFFF"
      />
    </View>
  );
}

function ActionRow({
  icon,
  label,
  buttonLabel,
  onPress,
}: {
  icon: RowIcon;
  label: string;
  buttonLabel: string;
  onPress: () => void;
}) {
  return (
    <View style={styles.row}>
      <SettingsIcon icon={icon} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={onPress}
        style={({ pressed }) => [styles.actionButton, styles.actionButtonWide, pressed && styles.pressed]}
      >
        <AppText
          preset="button"
          style={styles.actionButtonText}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
        >
          {buttonLabel}
        </AppText>
      </Pressable>
    </View>
  );
}

export function PauseOverlay({ onClose, onRestart, onHome }: PauseOverlayProps) {
  const lang = useLang();
  const sound = useSettings((s) => s.sound);
  const haptics = useSettings((s) => s.haptics);
  const update = useSettings((s) => s.update);

  return (
    <Animated.View entering={FadeIn.duration(120)} importantForAccessibility="yes" style={styles.scrim}>
      <View
        accessibilityViewIsModal
        importantForAccessibility="yes"
        onAccessibilityEscape={onClose}
        style={styles.panel}
      >
        <View style={styles.header}>
          <AppText
            preset="title"
            style={styles.title}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.55}
          >
            {t('settings.title', lang)}
          </AppText>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('pause.resume', lang)}
            hitSlop={10}
            onPress={onClose}
            style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
          >
            <AppText preset="title" maxFontSizeMultiplier={1} style={styles.closeText}>×</AppText>
          </Pressable>
        </View>

        <View style={styles.body}>
          <ToggleRow
            icon="sound"
            label={t('pause.sound', lang)}
            value={sound}
            onValueChange={(next) => update({ sound: next })}
          />
          <ToggleRow
            icon="haptics"
            label={t('pause.haptics', lang)}
            value={haptics}
            onValueChange={(next) => update({ haptics: next })}
          />
          <ActionRow
            icon="home"
            label={t('pause.home', lang)}
            buttonLabel={t('pause.home', lang)}
            onPress={onHome}
          />
          <ActionRow
            icon="restart"
            label={t('pause.restart', lang)}
            buttonLabel={t('pause.restart', lang)}
            onPress={onRestart}
          />
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  scrim: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 220,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.l,
    backgroundColor: 'rgba(5,12,30,0.78)',
  },
  panel: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#5E86E8',
    borderWidth: 2,
    borderColor: '#8EB0FF',
    boxShadow: '0 14px 24px rgba(1, 8, 30, 0.5)',
  },
  header: {
    minHeight: 64,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 64,
  },
  title: {
    textAlign: 'center',
    fontFamily: 'Unbounded_700Bold',
    fontSize: 32,
  },
  closeButton: {
    position: 'absolute',
    right: 12,
    top: 7,
    width: 50,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    color: '#DCE7FF',
    fontFamily: 'Unbounded_700Bold',
    fontSize: 46,
    lineHeight: 48,
  },
  body: {
    marginHorizontal: spacing.m,
    marginBottom: spacing.m,
    paddingHorizontal: spacing.m,
    borderRadius: radii.card,
    backgroundColor: '#3549A0',
    borderWidth: 1,
    borderColor: 'rgba(12,28,91,0.38)',
  },
  row: {
    minHeight: 78,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(11,24,85,0.52)',
  },
  rowLabel: {
    flex: 1,
    fontFamily: 'Unbounded_700Bold',
    fontSize: 20,
  },
  actionButton: {
    minWidth: 116,
    minHeight: 48,
    paddingHorizontal: spacing.m,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#137A22',
    borderWidth: 1,
    borderColor: '#45C95A',
    boxShadow: '0 5px 6px rgba(5, 66, 7, 0.45)',
  },
  actionButtonWide: {
    flex: 1,
  },
  actionButtonText: {
    color: colors.textPrimary,
    fontFamily: 'Unbounded_700Bold',
    fontSize: 16,
  },
  pressed: {
    opacity: 0.72,
    transform: [{ scale: 0.97 }],
  },
});
