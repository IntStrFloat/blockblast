import { Pressable, View } from 'react-native';

import { AppText, colors, radii, spacing } from '@/ui';

import { useProfileStore } from '../store';
interface ProfileChipProps {
  onPress: () => void;
}

export function ProfileChip({ onPress }: ProfileChipProps) {
  const nickname = useProfileStore((state) => state.profile.nickname);

  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      style={{
        minHeight: 44,
        borderRadius: radii.button,
        backgroundColor: colors.surface,
        paddingHorizontal: 12,
        paddingVertical: 10,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.s,
      }}
    >
      <View
        style={{
          width: 10,
          height: 10,
          borderRadius: 999,
          backgroundColor: colors.accent,
        }}
      />
      <AppText preset="caption" numberOfLines={1} style={{ color: colors.textPrimary, maxWidth: 140 }}>
        {nickname}
      </AppText>
      <AppText preset="caption">{'>'}</AppText>
    </Pressable>
  );
}
