import Svg, { Path } from 'react-native-svg';

import { colors } from '../theme';

interface TrophyIconProps {
  size?: number;
  color?: string;
}

/** Кубок «карты достижений» (вместо emoji 🏆). Заливка золотом. */
export function TrophyIcon({ size = 18, color = colors.accent }: TrophyIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M6 4h12v3a6 6 0 0 1-12 0V4z"
        fill={color}
      />
      <Path
        d="M5 5H3v1a4 4 0 0 0 4 4V8a2 2 0 0 1-2-2V5zM19 5h2v1a4 4 0 0 1-4 4V8a2 2 0 0 0 2-2V5z"
        fill={color}
      />
      <Path d="M11 12h2v4h-2zM8 17h8v3H8z" fill={color} />
    </Svg>
  );
}
