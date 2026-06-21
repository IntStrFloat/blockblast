import Svg, { Path } from 'react-native-svg';

import { colors } from '../theme';

interface ChevronIconProps {
  size?: number;
  color?: string;
  direction?: 'left' | 'right';
}

/** Шеврон навигации (вместо символов «<» / «>»). Контурный, stroke 2.5. */
export function ChevronIcon({
  size = 20,
  color = colors.textPrimary,
  direction = 'right',
}: ChevronIconProps) {
  const d = direction === 'left' ? 'M15 18l-6-6 6-6' : 'M9 6l6 6-6 6';
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d={d} stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
