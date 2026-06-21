import { Pressable } from 'react-native';
import type { ReactNode } from 'react';

import { colors, radii } from '../theme';

interface IconButtonProps {
  children: ReactNode;
  onPress: () => void;
  accessibilityLabel: string;
  /** Сторона квадратной кнопки (по умолчанию 48; не меньше 44 для тача). */
  size?: number;
}

/** Квадратная «глиняная» иконочная кнопка (настройки, назад и т.п.). */
export function IconButton({ children, onPress, accessibilityLabel, size = 48 }: IconButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => ({
        width: size,
        height: size,
        borderRadius: radii.button,
        backgroundColor: pressed ? colors.cardRaised : colors.cardSolid,
        borderWidth: 1,
        borderColor: colors.hairline,
        alignItems: 'center',
        justifyContent: 'center',
      })}
    >
      {children}
    </Pressable>
  );
}
