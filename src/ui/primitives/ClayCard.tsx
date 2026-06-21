import { View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { colors, radii, spacing } from '../theme';

interface ClayCardProps {
  children: React.ReactNode;
  /** Слегка светлее (для вложенных/выделенных блоков). */
  raised?: boolean;
  /** Акцентная рамка (например, текущая позиция / награда). */
  accent?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * «Вылепленная» (claymorphism, спека 04) карточка: сплошная приподнятая поверхность
 * с мягкой тенью и светлым верхним кантом. База для всех панелей Home/карты.
 */
export function ClayCard({ children, raised = false, accent, style }: ClayCardProps) {
  return (
    <View
      style={[
        {
          backgroundColor: raised ? colors.cardRaised : colors.cardSolid,
          borderRadius: radii.card,
          padding: spacing.m,
          borderWidth: accent ? 2 : 1,
          borderColor: accent ?? colors.hairline,
          // Мягкая «глиняная» тень (iOS) + elevation (Android).
          shadowColor: colors.clayShadow,
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.5,
          shadowRadius: 14,
          elevation: 6,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
