import { planLocalNotifications, type PlannerInput } from '../local/planner';

// Среда 2026-07-08, 21:00 локального времени (уход приложения в фон вечером).
const NOW = new Date(2026, 6, 8, 21, 0, 0);

function input(overrides: Partial<PlannerInput> = {}): PlannerInput {
  return {
    todayIso: '2026-07-08',
    streak: { lastDay: '2026-07-08', count: 3 },
    protectorAvailable: false,
    tournamentPlayedThisWeek: true,
    tournamentCurrentRank: 5,
    prizePlayedTargetWeek: true,
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

  it('пропущен один день, но protector ещё доступен → напоминание сегодня в 19:00', () => {
    const afternoon = new Date(2026, 6, 8, 15, 0, 0);
    const plan = planLocalNotifications(
      input({
        streak: { lastDay: '2026-07-06', count: 4 },
        protectorAvailable: true,
      }),
      afternoon,
    );
    const streak = plan.find((p) => p.kind === 'streak');
    expect(streak).toBeDefined();
    expect(streak!.fireAt.getDate()).toBe(8);
    expect(streak!.fireAt.getHours()).toBe(19);
  });

  it('gap=2 без доступного protector → без напоминания о стрике', () => {
    const afternoon = new Date(2026, 6, 8, 15, 0, 0);
    const plan = planLocalNotifications(
      input({
        streak: { lastDay: '2026-07-06', count: 4 },
        protectorAvailable: false,
      }),
      afternoon,
    );
    expect(plan.find((p) => p.kind === 'streak')).toBeUndefined();
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

  it('в понедельник prizeReady сегодня зависит от участия в только что завершившейся неделе', () => {
    const mondayMorning = new Date(2026, 7, 24, 9, 0, 0);
    const plan = planLocalNotifications(
      input({
        todayIso: '2026-08-24',
        tournamentPlayedThisWeek: false,
        tournamentCurrentRank: null,
        prizePlayedTargetWeek: true,
      }),
      mondayMorning,
    );
    expect(plan.find((p) => p.kind === 'tournamentEnd')).toBeUndefined();
    const prize = plan.find((p) => p.kind === 'prizeReady');
    expect(prize).toBeDefined();
    expect(prize!.fireAt.getDate()).toBe(24);
    expect(prize!.fireAt.getHours()).toBe(11);
  });

  it('в понедельник без участия на прошлой неделе prizeReady не ставится', () => {
    const mondayMorning = new Date(2026, 7, 24, 9, 0, 0);
    const plan = planLocalNotifications(
      input({
        todayIso: '2026-08-24',
        tournamentPlayedThisWeek: false,
        tournamentCurrentRank: null,
        prizePlayedTargetWeek: false,
      }),
      mondayMorning,
    );
    expect(plan.find((p) => p.kind === 'prizeReady')).toBeUndefined();
  });

  it('не играл на неделе → без турнирных уведомлений', () => {
    const plan = planLocalNotifications(
      input({
        tournamentPlayedThisWeek: false,
        tournamentCurrentRank: null,
        prizePlayedTargetWeek: false,
      }),
      NOW,
    );
    expect(plan.find((p) => p.kind === 'tournamentEnd')).toBeUndefined();
    expect(plan.find((p) => p.kind === 'prizeReady')).toBeUndefined();
  });

  it('не планирует ложный дедлайн постоянной Adventure-кампании', () => {
    const plan = planLocalNotifications(
      input({ streak: { lastDay: null, count: 0 } }),
      NOW,
    );
    expect(plan.find((p) => p.kind === 'seasonEnding')).toBeUndefined();
  });

  it('планирует правдивое напоминание о сохранённом Adventure run', () => {
    const plan = planLocalNotifications(
      input({
        streak: { lastDay: null, count: 0 },
        tournamentPlayedThisWeek: false,
        tournamentCurrentRank: null,
        prizePlayedTargetWeek: false,
        savedRun: { mode: 'adventure' },
      }),
      NOW,
    );
    expect(plan).toContainEqual({
      kind: 'savedRun',
      fireAt: new Date(2026, 6, 9, 18, 0, 0),
      params: { savedMode: 'adventure' },
    });
  });

  it('uses the G09 server deadline only for calendar-theme refresh', () => {
    const plan = planLocalNotifications(
      input({
        streak: { lastDay: null, count: 0 },
        tournamentPlayedThisWeek: false,
        tournamentCurrentRank: null,
        prizePlayedTargetWeek: false,
        adventureThemeWindowEndIso: new Date(2026, 6, 12, 21, 0, 0).toISOString(),
      }),
      NOW,
    );
    const theme = plan.find((item) => item.kind === 'seasonEnding');
    expect(theme?.fireAt).toEqual(new Date(2026, 6, 11, 18, 0, 0));
  });

  it('лимит: максимум одно уведомление в календарный день, приоритет за стриком', () => {
    const plan = planLocalNotifications(input(), NOW);
    const days = kindsByDay(plan);
    expect(days).toContain('streak@2026-7-9');
    expect(new Set(days).size).toBe(days.length);
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
