import Svg, { Circle, Path } from 'react-native-svg';

import { colors } from '../theme';

interface UserIconProps {
  size?: number;
  color?: string;
}

/** Профиль: голова + плечи. Контурный стиль, stroke 2. */
export function UserIcon({ size = 22, color = colors.textPrimary }: UserIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={8} r={4} stroke={color} strokeWidth={2} />
      <Path
        d="M4 20c0-3.314 3.582-6 8-6s8 2.686 8 6"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
