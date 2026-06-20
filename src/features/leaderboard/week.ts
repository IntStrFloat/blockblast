export function getUtcWeekWindow(now: Date) {
  const date = new Date(now.getTime());
  const day = date.getUTCDay();
  const diffToMonday = day === 0 ? 6 : day - 1;
  const weekStart = Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate() - diffToMonday,
  );
  const weekEnd = weekStart + 7 * 24 * 60 * 60 * 1000;
  return {
    weekKey: new Date(weekStart).toISOString().slice(0, 10),
    weekStartIso: new Date(weekStart).toISOString(),
    weekEndIso: new Date(weekEnd).toISOString(),
  };
}

export function getUtcWeekCountdown(now: Date) {
  const { weekEndIso } = getUtcWeekWindow(now);
  const totalMs = Math.max(0, new Date(weekEndIso).getTime() - now.getTime());
  const totalSeconds = Math.floor(totalMs / 1000);
  return {
    totalMs,
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
  };
}

export function createDailyChallenge(dateIso: string) {
  const [, year, month, day] = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateIso) ?? [];
  const shortYear = Number(year.slice(2));
  const monthNumber = Number(month);
  const dayNumber = Number(day);
  const seed = shortYear * 64 + dayNumber - monthNumber - 1;
  return {
    dateIso,
    seed,
    code: createChallengeCode(dateIso, seed),
  };
}

export function createChallengeCode(dateIso: string, seed: number) {
  return `${dateIso.slice(2).replaceAll('-', '')}-${(seed - 4).toString(36).toUpperCase()}`;
}

export function decodeChallengeCode(code: string) {
  const match = /^(\d{2})(\d{2})(\d{2})-([A-Z0-9]+)$/.exec(code);
  if (!match) return null;
  const [, year, month, day, encodedSeed] = match;
  const dateIso = `20${year}-${month}-${day}`;
  const seed = parseInt(encodedSeed, 36) + 4;
  return {
    dateIso,
    seed,
    code: createChallengeCode(dateIso, seed),
  };
}

export function shouldShowDailyChallenge(gamesPlayed: number) {
  return gamesPlayed >= 3;
}

export function getWeeklyGoal(current: number) {
  if (current <= 0) return { current, target: 1500, progress: 0 };
  const target = Math.ceil((current + 400) / 500) * 500;
  return { current, target, progress: current };
}
