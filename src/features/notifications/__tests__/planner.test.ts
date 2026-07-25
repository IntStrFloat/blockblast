import { planLocalNotifications, type PlannerInput } from '../local/planner';

// Среда 2026-07-08, 21:00 локального времени (уход приложения в фон вечером).
const NOW = new Date(2026, 6, 8, 21, 0, 0);

function input(overrides: Partial<PlannerInput> = {}): PlannerInput {
  return {
    todayIso: '2026-07-08',
    streak: { lastDay: '2026-07-08', count: 3 },
    playedThisWeek: true,
    currentRank: 5,
    seasonEndIso: null,
    seasonStarted: false,
    seasonCompleted: false,
    ...overrides,
  };
}

function kindsByDay(plan: ReturnType<typeof planLocalNotifications>) {
  return plan.map((p) => `${p.kind}@${p.fireAt.getFullYear()}-${p.fireAt.getMonth() + 1}-${p.fireAt.getDate()}`);
}

describe('planLocalNotifications', () => {
  it('сыграно сегодня → напоминание о стрике завтра в 19:00', () => {
    const plan = planLocalNotifications(input(), NOW);
    const streak = plan.find((p) => p.kind === 'streak');
    expect(streak).toBeDefined();
    expect(streak!.fireAt.getDate()).toBe(9);
    expect(streak!.fireAt.getHours()).toBe(19);
    expect(streak!.params).toMatchObject({ streakCount: 3 });
    expect(streak!.params).not.toHaveProperty('bonusPoints');
  });

  it('не сыграно сегодня (стрик умирает вечером) → напоминание сегодня, если ещё не поздно', () => {
    const afternoon = new Date(2026, 6, 8, 15, 0, 0);
    const plan = planLocalNotifications(
      input({ streak: { lastDay: '2026-07-07', count: 4 } }),
      afternoon,
    );
    const streak = plan.find((p) => p.kind === 'streak');
    expect(streak).toBeDefined();
    expect(streak!.fireAt.getDate()).toBe(8);
    expect(streak!.fireAt.getHours()).toBe(19);
  });

  it('мёртвый/нулевой стрик → без напоминания о стрике', () => {
    const plan = planLocalNotifications(
      input({ streak: { lastDay: '2026-07-01', count: 9 } }),
      NOW,
    );
    expect(plan.find((p) => p.kind === 'streak')).toBeUndefined();
  });

  it('играл на неделе → воскресенье 18:00 «турнир заканчивается» и понедельник 11:00 «итоги»', () => {
    const plan = planLocalNotifications(input(), NOW);
    const end = plan.find((p) => p.kind === 'tournamentEnd');
    const prize = plan.find((p) => p.kind === 'prizeReady');
    // Воскресенье этой недели — 12 июля 2026.
    expect(end).toBeDefined();
    expect(end!.fireAt.getDate()).toBe(12);
    expect(end!.fireAt.getHours()).toBe(18);
    expect(end!.params.rank).toBe(5);
    // Понедельник — 13 июля.
    expect(prize).toBeDefined();
    expect(prize!.fireAt.getDate()).toBe(13);
    expect(prize!.fireAt.getHours()).toBe(11);
  });

  it('не играл на неделе → без турнирных уведомлений', () => {
    const plan = planLocalNotifications(input({ playedThisWeek: false, currentRank: null }), NOW);
    expect(plan.find((p) => p.kind === 'tournamentEnd')).toBeUndefined();
    expect(plan.find((p) => p.kind === 'prizeReady')).toBeUndefined();
  });

  it('сезон начат и заканчивается — напоминание за 2 дня до конца', () => {
    const plan = planLocalNotifications(
      input({
        streak: { lastDay: null, count: 0 }, // без стрика — день свободен для сезона
        seasonStarted: true,
        seasonEndIso: new Date(2026, 6, 11, 12, 0, 0).toISOString(),
      }),
      NOW,
    );
    const season = plan.find((p) => p.kind === 'seasonEnding');
    expect(season).toBeDefined();
    expect(season!.fireAt.getDate()).toBe(9);
  });

  it('лимит: максимум одно уведомление в календарный день, приоритет за стриком', () => {
    // Стрик-напоминание завтра (9-е) и сезон-напоминание тоже 9-го → остаётся стрик.
    const plan = planLocalNotifications(
      input({
        seasonStarted: true,
        seasonEndIso: new Date(2026, 6, 11, 12, 0, 0).toISOString(),
      }),
      NOW,
    );
    const days = kindsByDay(plan);
    expect(days).toContain('streak@2026-7-9');
    expect(days).not.toContain('seasonEnding@2026-7-9');
  });

  it('все fireAt строго в будущем', () => {
    const lateNight = new Date(2026, 6, 12, 23, 30, 0); // воскресенье поздно — турнир-пуш уже в прошлом
    const plan = planLocalNotifications(input(), lateNight);
    for (const p of plan) {
      expect(p.fireAt.getTime()).toBeGreaterThan(lateNight.getTime());
    }
    expect(plan.find((p) => p.kind === 'tournamentEnd')).toBeUndefined();
  });
});
