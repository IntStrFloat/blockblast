import { useEffect, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { t } from '@/core/i18n';
import { useAnalyticsStore } from '@/features/analytics';
import { useLang } from '@/features/settings';
import { AppText, GameButton, Overlay, colors, radii, spacing } from '@/ui';

import type { NicknameValidationError } from '../nickname';
import { useProfileStore } from '../store';

type SyncState = 'ready' | 'syncing' | 'offline';

function syncDotColor(state: SyncState): string {
  if (state === 'ready') return colors.success;
  if (state === 'syncing') return colors.accent;
  return colors.textDim;
}

interface ProfileOverlayProps {
  visible: boolean;
  onClose: () => void;
}

type OverlayError = NicknameValidationError | 'remote_unavailable' | 'server_rejected';

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
  const initial = (profile.nickname.trim()[0] ?? '?').toUpperCase();

  return (
    <Overlay>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.m }}>
        <View
          style={{
            width: 52,
            height: 52,
            borderRadius: radii.card,
            backgroundColor: colors.accent,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <AppText preset="title" style={{ fontSize: 24, color: colors.bgBottom }}>
            {initial}
          </AppText>
        </View>
        <View style={{ flex: 1 }}>
          <AppText preset="title" style={{ fontSize: 20 }} numberOfLines={1}>
            {profile.nickname}
          </AppText>
          <AppText preset="caption" style={{ color: colors.textDim }}>
            #{profile.tag}
          </AppText>
        </View>
      </View>

      <View style={{ gap: spacing.xs }}>
        <AppText preset="caption" style={{ color: colors.textDim }}>
          {t('profile.placeholder', lang).toUpperCase()}
        </AppText>
        <TextInput
          value={draft}
          editable={!saving}
          onChangeText={setDraft}
          placeholder={t('profile.placeholder', lang)}
          placeholderTextColor={colors.textDim}
          style={{
            borderRadius: radii.button,
            backgroundColor: colors.cardSolid,
            color: colors.textPrimary,
            borderWidth: 1,
            borderColor: resolvedErrorKey ? colors.danger : colors.hairline,
            paddingHorizontal: 14,
            paddingVertical: 12,
            fontSize: 16,
          }}
        />
        {resolvedErrorKey ? (
          <AppText preset="caption" style={{ color: colors.danger }}>
            {t(resolvedErrorKey, lang)}
          </AppText>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: syncDotColor(syncState),
              }}
            />
            <AppText preset="caption" style={{ color: colors.textDim }}>
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

      <View style={{ flexDirection: 'row', gap: spacing.s }}>
        <GameButton
          label={t('profile.reroll', lang)}
          variant="ghost"
          style={{ flex: 1 }}
          disabled={saving}
          onPress={() => {
            reroll();
            setDraft(useProfileStore.getState().profile.nickname);
            setLocalError(null);
          }}
        />
        <GameButton
          label={saving ? t('profile.saving', lang) : t('profile.save', lang)}
          style={{ flex: 1 }}
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

      <Pressable onPress={onClose} hitSlop={8} style={{ alignSelf: 'center', paddingVertical: spacing.xs }}>
        <AppText preset="caption" style={{ color: colors.textDim }}>
          {t('profile.close', lang)}
        </AppText>
      </Pressable>
    </Overlay>
  );
}

export function ProfileOverlay({ visible, onClose }: ProfileOverlayProps) {
  if (!visible) return null;
  return <ProfileOverlayContent onClose={onClose} />;
}
