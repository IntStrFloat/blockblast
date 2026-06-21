import Svg, { Path } from 'react-native-svg';

import { colors } from '../theme';

interface CheckIconProps {
  size?: number;
  color?: string;
}

/** Галочка пройденного узла карты. Контурный, stroke 2.5. */
export function CheckIcon({ size = 16, color = colors.bgBottom }: CheckIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M5 13l4 4L19 7"
        stroke={color}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
