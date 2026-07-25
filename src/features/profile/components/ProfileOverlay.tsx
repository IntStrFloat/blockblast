import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { t } from '@/core/i18n';
import { useAnalyticsStore } from '@/features/analytics';
import { MascotBadge, getShowcaseAvatar } from '@/features/mascot';
import { useLang } from '@/features/settings';
import { AppText, spacing } from '@/ui';

import type { NicknameValidationError } from '../nickname';
import { useProfileStore } from '../store';

type SyncState = 'ready' | 'syncing' | 'offline';
type OverlayError = NicknameValidationError | 'remote_unavailable' | 'server_rejected';

interface ProfileOverlayProps {
  visible: boolean;
  onClose: () => void;
}

function syncDotColor(state: SyncState): string {
  if (state === 'ready') return '#A9E16E';
  if (state === 'syncing') return '#FFE46B';
  return 'rgba(229,246,255,0.62)';
}

function errorKey(error: OverlayError | null) {
  switch (error) {
    case 'too_short':
      return 'profile.errorTooShort';
    case 'too_long':
      return 'profile.errorTooLong';
    case 'invalid_chars':
      return 'profile.errorInvalid';
    case 'server_rejected':
      return 'profile.errorServer';
    case 'remote_unavailable':
      return 'profile.syncOffline';
    default:
      return null;
  }
}

function CloseIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="m6 6 12 12M18 6 6 18" stroke="#F4FAFF" strokeWidth={2.6} strokeLinecap="round" />
    </Svg>
  );
}

function ProfileAction({
  label,
  primary = false,
  disabled = false,
  onPress,
}: {
  label: string;
  primary?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.action,
        primary ? styles.actionPrimary : styles.actionSecondary,
        disabled && styles.actionDisabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <AppText preset="button" numberOfLines={1} style={[styles.actionText, primary && styles.actionTextPrimary]}>
        {label}
      </AppText>
    </Pressable>
  );
}

function ProfileOverlayContent({ onClose }: { onClose: () => void }) {
  const lang = useLang();
  const profile = useProfileStore((state) => state.profile);
  const reroll = useProfileStore((state) => state.reroll);
  const rename = useProfileStore((state) => state.rename);
  const syncStatus = useProfileStore((state) => state.syncStatus);
  const storeError = useProfileStore((state) => state.lastError);
  const [draft, setDraft] = useState(profile.nickname);
  const [localError, setLocalError] = useState<OverlayError | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    useAnalyticsStore.getState().track('profile_chip_opened', { source: 'home' });
  }, []);

  const resolvedError = localError ?? storeError;
  const resolvedErrorKey = errorKey(resolvedError);
  const syncState: SyncState =
    syncStatus === 'ready' ? 'ready' : syncStatus === 'syncing' ? 'syncing' : 'offline';
  const showcase = getShowcaseAvatar();

  return (
    <Animated.View entering={FadeIn.duration(160)} style={styles.scrim}>
      <Animated.View entering={ZoomIn.duration(180)} style={styles.card}>
        <LinearGradient colors={['#4B77EE', '#2155CB']} style={styles.hero}>
          <View style={styles.avatarFrame}>
            <MascotBadge avatar={showcase} size={56} />
          </View>
          <View style={styles.identity}>
            <AppText preset="speech" numberOfLines={1} style={styles.profileTitle}>
              {t('profile.title', lang)}
            </AppText>
            <AppText preset="caption" numberOfLines={1} style={styles.profileTag}>
              #{profile.tag}
            </AppText>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('profile.close', lang)}
            hitSlop={8}
            onPress={onClose}
            style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
          >
            <CloseIcon />
          </Pressable>
        </LinearGradient>

        <View style={styles.body}>
          <View style={styles.nicknameGroup}>
            <AppText preset="caption" style={styles.inputLabel}>
              {t('profile.placeholder', lang).toUpperCase()}
            </AppText>
            <TextInput
              value={draft}
              editable={!saving}
              onChangeText={(value) => {
                setDraft(value);
                setLocalError(null);
              }}
              accessibilityLabel={t('profile.placeholder', lang)}
              placeholder={t('profile.placeholder', lang)}
              placeholderTextColor="rgba(27,86,199,0.56)"
              style={[styles.input, resolvedErrorKey ? styles.inputError : null]}
            />
            {resolvedErrorKey ? (
              <AppText preset="caption" style={styles.errorText}>
                {t(resolvedErrorKey, lang)}
              </AppText>
            ) : (
              <View style={styles.syncStatus}>
                <View style={[styles.syncDot, { backgroundColor: syncDotColor(syncState) }]} />
                <AppText preset="caption" style={styles.syncText}>
                  {t(
                    syncState === 'ready'
                      ? 'profile.syncReady'
                      : syncState === 'syncing'
                        ? 'profile.syncing'
                        : 'profile.syncOffline',
                    lang,
                  )}
                </AppText>
              </View>
            )}
          </View>

          <View style={styles.actions}>
            <ProfileAction
              label={t('profile.reroll', lang)}
              disabled={saving}
              onPress={() => {
                reroll();
                setDraft(useProfileStore.getState().profile.nickname);
                setLocalError(null);
              }}
            />
            <ProfileAction
              primary
              label={saving ? t('profile.saving', lang) : t('profile.save', lang)}
              disabled={saving}
              onPress={async () => {
                setSaving(true);
                const result = await rename(draft);
                setSaving(false);
                if (!result.ok) {
                  setLocalError(result.error);
                  return;
                }
                setLocalError(null);
                onClose();
              }}
            />
          </View>

          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            style={({ pressed }) => [styles.dismiss, pressed && styles.pressed]}
          >
            <AppText preset="caption" style={styles.dismissText}>
              {t('profile.close', lang)}
            </AppText>
          </Pressable>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

export function ProfileOverlay({ visible, onClose }: ProfileOverlayProps) {
  if (!visible) return null;
  return <ProfileOverlayContent onClose={onClose} />;
}

const styles = StyleSheet.create({
  scrim: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 100,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.l,
    backgroundColor: 'rgba(5, 25, 87, 0.68)',
  },
  card: {
    width: '100%',
    maxWidth: 360,
    overflow: 'hidden',
    borderRadius: 24,
    backgroundColor: '#2358C9',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.38)',
    boxShadow: '0 18px 36px rgba(2, 20, 83, 0.48)',
  },
  hero: {
    minHeight: 102,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.m,
    padding: spacing.m,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.22)',
  },
  avatarFrame: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.55)',
  },
  identity: {
    flex: 1,
    gap: 4,
  },
  profileTitle: {
    color: '#FFFFFF',
    fontFamily: 'Fredoka_700Bold',
    fontSize: 28,
  },
  profileTag: {
    alignSelf: 'flex-start',
    color: 'rgba(238,249,255,0.92)',
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 13,
  },
  closeButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    backgroundColor: 'rgba(6,49,148,0.28)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
  },
  body: {
    gap: spacing.m,
    padding: spacing.m,
    backgroundColor: '#245BCB',
  },
  nicknameGroup: {
    gap: spacing.s,
  },
  inputLabel: {
    marginLeft: spacing.xs,
    color: 'rgba(231,246,255,0.78)',
    fontFamily: 'Fredoka_700Bold',
    fontSize: 12,
    letterSpacing: 0.7,
  },
  input: {
    minHeight: 50,
    borderRadius: 15,
    backgroundColor: '#FFFFFF',
    color: '#174AAE',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.74)',
    paddingHorizontal: 14,
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 18,
  },
  inputError: {
    borderColor: '#FF8E94',
  },
  errorText: {
    color: '#FFE1E3',
  },
  syncStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 18,
  },
  syncDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  syncText: {
    color: 'rgba(235,248,255,0.80)',
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.s,
  },
  action: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.s,
    borderRadius: 15,
    borderWidth: 1,
  },
  actionPrimary: {
    backgroundColor: '#FFE46B',
    borderColor: '#FFF4A9',
    boxShadow: '0 4px 7px rgba(104, 70, 0, 0.28)',
  },
  actionSecondary: {
    backgroundColor: 'rgba(7,52,157,0.42)',
    borderColor: 'rgba(255,255,255,0.34)',
  },
  actionDisabled: {
    opacity: 0.48,
  },
  actionText: {
    color: '#FFFFFF',
    fontFamily: 'Fredoka_700Bold',
    fontSize: 15,
  },
  actionTextPrimary: {
    color: '#1A4DAE',
  },
  dismiss: {
    minHeight: 36,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.m,
  },
  dismissText: {
    color: 'rgba(234,248,255,0.78)',
    textDecorationLine: 'underline',
  },
  pressed: {
    opacity: 0.74,
    transform: [{ scale: 0.97 }],
  },
});
