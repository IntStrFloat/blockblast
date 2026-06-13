import { useEffect, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { t } from '@/core/i18n';
import { useAnalyticsStore } from '@/features/analytics';
import { useLang } from '@/features/settings';
import { AppText, GameButton, Overlay, colors, radii, spacing } from '@/ui';

import type { NicknameValidationError } from '../nickname';
import { useProfileStore } from '../store';

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

  return (
    <Overlay>
      <View style={{ gap: spacing.s }}>
        <AppText preset="title">{t('profile.title', lang)}</AppText>
        <AppText preset="caption">
          {profile.nickname} - {profile.tag}
        </AppText>
      </View>

      <TextInput
        value={draft}
        editable={!saving}
        onChangeText={setDraft}
        placeholder={t('profile.placeholder', lang)}
        placeholderTextColor={colors.textDim}
        style={{
          borderRadius: radii.button,
          backgroundColor: colors.surface,
          color: colors.textPrimary,
          paddingHorizontal: 14,
          paddingVertical: 12,
        }}
      />

      {resolvedErrorKey ? (
        <AppText preset="caption" style={{ color: colors.danger }}>
          {t(resolvedErrorKey, lang)}
        </AppText>
      ) : (
        <AppText preset="caption">
          {t(
            syncStatus === 'ready'
              ? 'profile.syncReady'
              : syncStatus === 'syncing'
                ? 'profile.syncing'
                : 'profile.syncOffline',
            lang,
          )}
        </AppText>
      )}

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

      <Pressable onPress={onClose} style={{ alignSelf: 'center', padding: 4 }}>
        <AppText preset="caption">{t('profile.close', lang)}</AppText>
      </Pressable>
    </Overlay>
  );
}

export function ProfileOverlay({ visible, onClose }: ProfileOverlayProps) {
  if (!visible) return null;
  return <ProfileOverlayContent onClose={onClose} />;
}
