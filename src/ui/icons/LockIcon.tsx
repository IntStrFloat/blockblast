import Svg, { Path, Rect } from 'react-native-svg';

import { colors } from '../theme';

interface LockIconProps {
  size?: number;
  color?: string;
}

/** Замок заблокированного узла карты. Контурный, stroke 2. */
export function LockIcon({ size = 16, color = colors.textDim }: LockIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={5} y={11} width={14} height={9} rx={2} stroke={color} strokeWidth={2} />
      <Path
        d="M8 11V8a4 4 0 0 1 8 0v3"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
