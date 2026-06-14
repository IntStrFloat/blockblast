import Svg, { Path } from 'react-native-svg';

import { colors } from '../theme';

interface CrownIconProps {
  size?: number;
  color?: string;
}

/** Кастомная корона (вместо emoji 👑). Цвет по умолчанию — акцентное золото. */
export function CrownIcon({ size = 14, color = colors.accent }: CrownIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5z"
        fill={color}
        stroke={color}
        strokeWidth={1.2}
        strokeLinejoin="round"
      />
      <Path d="M19 19c0 .55-.45 1-1 1H6c-.55 0-1-.45-1-1v-1h14v1z" fill={color} />
    </Svg>
  );
}
