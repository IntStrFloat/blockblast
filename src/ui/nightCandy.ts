/** Exact values from the supplied “Ночная карамель · 1.0” HTML. */
export const nightCandy = {
  night950: '#0B0E2E',
  night900: '#0F1348',
  night850: '#141A5C',
  night800: '#1A2170',
  night700: '#232C88',
  cell: '#1D246E',
  lavender: '#C8CDFB',
  muted: '#9DA6F0',
  white: '#FFFFFF',
  sun: '#FFC93C',
  sunEdge: '#D99A00',
  sunInk: '#3B2400',
  coral: '#FF4F6A',
  coralEdge: '#B8263F',
  mint: '#34E0A1',
  mintEdge: '#149E6E',
  sky: '#48BBFF',
  skyEdge: '#1C7FD0',
  mandarin: '#FF8A2A',
  mandarinEdge: '#C85F0B',
  grape: '#A47BFF',
  grapeEdge: '#6E45D6',
  border: 'rgba(255,255,255,0.12)',
  blockColors: ['#FF4F6A', '#FF9B2E', '#FFD43F', '#3FDB85', '#42B4FF', '#9C6BFF', '#FF6FCF'],
  motion: { tap: 80, snap: 140, sheet: 280, clear: 420, combo: 650, celebrate: 1200, return: 200 },
} as const;

export function formatNumber(value: number): string {
  return Math.max(0, Math.trunc(value))
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

export function dayLabel(count: number, lang: string): string {
  if (lang !== 'ru') return count === 1 ? 'day' : 'days';
  const n = Math.abs(count) % 100;
  if (n >= 11 && n <= 14) return 'дней';
  return n % 10 === 1 ? 'день' : n % 10 >= 2 && n % 10 <= 4 ? 'дня' : 'дней';
}
