import { useEffect, useState } from 'react';
import { TextInput, View } from 'react-native';
import { t } from '@/core/i18n';
import { useAnalyticsStore } from '@/features/analytics';
import { useLang } from '@/features/settings';
import { AppText, CandyCapy, GameButton, Overlay, nightCandy as n } from '@/ui';
import { useProfileStore } from '../store';

interface ProfileOverlayProps {
  visible: boolean;
  onClose: () => void;
  onOpenCollection?: () => void;
}
function ProfileForm({ onClose }: { onClose: () => void }) {
  const lang = useLang();
  const ru = lang === 'ru';
  const profile = useProfileStore((s) => s.profile);
  const rename = useProfileStore((s) => s.rename);
  const reroll = useProfileStore((s) => s.reroll);
  const [draft, setDraft] = useState(profile.nickname);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    useAnalyticsStore.getState().track('profile_chip_opened', { source: 'home' });
  }, []);
  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const result = await rename(draft);
      if (result.ok) onClose();
      else {
        const key =
          result.error === 'too_short'
            ? 'profile.errorTooShort'
            : result.error === 'too_long'
              ? 'profile.errorTooLong'
              : result.error === 'invalid_chars'
                ? 'profile.errorInvalid'
                : result.error === 'server_rejected'
                  ? 'profile.errorServer'
                  : 'profile.syncOffline';
        setError(t(key, lang));
      }
    } finally {
      setSaving(false);
    }
  };
  return (
    <Overlay onDismiss={onClose}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <CandyCapy size={56} />
        <View style={{ flex: 1, gap: 4 }}>
          <AppText preset="title">{ru ? 'Твоё имя' : 'Your name'}</AppText>
          <AppText style={{ color: n.muted, fontSize: 12 }}>#{profile.tag}</AppText>
        </View>
      </View>
      <TextInput
        value={draft}
        onChangeText={(value) => {
          setDraft(value);
          setError(null);
        }}
        accessibilityLabel={ru ? 'Никнейм' : 'Nickname'}
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={32}
        returnKeyType="done"
        onSubmitEditing={() => {
          void save();
        }}
        selectionColor={n.grape}
        style={{
          height: 54,
          borderRadius: 16,
          borderWidth: 2,
          borderColor: error ? n.coral : n.grape,
          paddingHorizontal: 16,
          color: n.white,
          backgroundColor: n.night900,
          fontFamily: 'Nunito_800ExtraBold',
          fontSize: 18,
        }}
      />
      {error && (
        <AppText accessibilityRole="alert" style={{ color: n.coral, fontSize: 14 }}>
          {error}
        </AppText>
      )}
      <GameButton
        label={saving ? (ru ? 'Сохраняем…' : 'Saving…') : ru ? 'Сохранить' : 'Save'}
        disabled={saving}
        onPress={() => {
          void save();
        }}
      />
      <GameButton
        label={ru ? 'Придумать другое' : 'Generate another'}
        variant="ghost"
        disabled={saving}
        onPress={() => {
          reroll();
          setDraft(useProfileStore.getState().profile.nickname);
          setError(null);
        }}
      />
      <GameButton label={ru ? 'Отмена' : 'Cancel'} variant="text" onPress={onClose} />
    </Overlay>
  );
}
export function ProfileOverlay({ visible, onClose }: ProfileOverlayProps) {
  if (!visible) return null;
  return <ProfileForm onClose={onClose} />;
}
