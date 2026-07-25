import { parseShowcase } from '../logic/showcase';
import { MascotFigure } from './MascotArt';

/**
 * Аватар-бейдж Капи по витринной строке (retention фаза 3): чужие строки
 * лидерборда и собственный профиль. Невалидная/пустая строка — ничего.
 */
export function MascotBadge({
  avatar,
  size = 26,
}: {
  avatar: string | null | undefined;
  size?: number;
}) {
  const showcase = parseShowcase(avatar);
  if (!showcase) return null;
  return <MascotFigure stage={showcase.stage} equipped={showcase.equipped} size={size} />;
}
