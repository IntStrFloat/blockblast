const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { createApi } = require('../server.cjs');

const API_KEY = 'test-api-key';

function createHarness() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bloxx-backend-'));
  const dataPath = path.join(dir, 'data.json');
  let nowMs = Date.parse('2026-06-15T12:00:00.000Z');
  const api = createApi({
    apiKey: API_KEY,
    dataPath,
    now: () => new Date(nowMs),
  });

  async function request(method, url, body, authToken, includeApiKey = true) {
    return api.handle({
      method,
      url,
      headers: {
        ...(includeApiKey ? { 'x-api-key': API_KEY } : {}),
        ...(authToken ? { authorization: `Bearer ${authToken}` } : {}),
      },
      body: body === undefined ? '' : JSON.stringify(body),
    });
  }

  return {
    request,
    advance(ms) {
      nowMs += ms;
    },
    setNow(iso) {
      nowMs = Date.parse(iso);
    },
    cleanup() {
      fs.rmSync(dir, { recursive: true, force: true });
    },
  };
}

test('health reports record-only mode and needs no engine runtime', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bloxx-backend-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const api = createApi({
    apiKey: API_KEY,
    dataPath: path.join(dir, 'data.json'),
  });

  const health = await api.handle({ method: 'GET', url: '/api/health', headers: {}, body: '' });
  assert.equal(health.status, 200);
  assert.equal(health.json.ok, true);
  assert.equal(health.json.mode, 'record-only');
  // Реплей-верификация снята: сервер больше не зависит от движка, поэтому дрейф
  // движка физически не может ронять ranked-сабмиты.
  assert.equal(health.json.engine, undefined);
});

test('bootstrap creates an anonymous profile and reuses it with bearer auth', async (t) => {
  const h = createHarness();
  t.after(h.cleanup);

  const first = await h.request('POST', '/api/profile/bootstrap', { nickname: 'PixelNova' });
  assert.equal(first.status, 200);
  assert.equal(first.json.profile.nickname, 'PixelNova');
  assert.match(first.json.profile.tag, /^[A-Z0-9]{3}$/);
  assert.ok(first.json.authToken);

  const second = await h.request(
    'POST',
    '/api/profile/bootstrap',
    { nickname: 'OtherName' },
    first.json.authToken,
  );
  assert.equal(second.status, 200);
  assert.deepEqual(second.json.profile, first.json.profile);
  assert.equal(second.json.authToken, first.json.authToken);
});

test('rename changes only nickname and keeps server-owned tag', async (t) => {
  const h = createHarness();
  t.after(h.cleanup);

  const session = await h.request('POST', '/api/profile/bootstrap', { nickname: 'PixelNova' });
  const renamed = await h.request(
    'POST',
    '/api/profile/rename',
    { nickname: 'NeonComet', tag: 'BAD' },
    session.json.authToken,
  );

  assert.equal(renamed.status, 200);
  assert.equal(renamed.json.profile.nickname, 'NeonComet');
  assert.equal(renamed.json.profile.tag, session.json.profile.tag);
});

test('record-only: weekly best is the max of submitted scores, runs are counted', async (t) => {
  const h = createHarness();
  t.after(h.cleanup);

  const session = await h.request('POST', '/api/profile/bootstrap', { nickname: 'PixelNova' });
  const ticketsResponse = await h.request(
    'POST',
    '/api/tickets',
    undefined,
    session.json.authToken,
  );
  assert.equal(ticketsResponse.status, 200);
  assert.equal(ticketsResponse.json.tickets.length, 10);

  const [firstTicket, secondTicket] = ticketsResponse.json.tickets;
  const firstRun = await h.request(
    'POST',
    '/api/runs',
    {
      ticketId: firstTicket.ticketId,
      seed: firstTicket.seed,
      score: 120,
      durationMs: 10_000,
      moves: [{ trayIndex: 0, row: 0, col: 0 }],
    },
    session.json.authToken,
  );
  assert.equal(firstRun.status, 200);
  assert.equal(firstRun.json.snapshot.currentPlayer.weeklyBest, 120);

  // Меньший последующий счёт не понижает рекорд, но считается партией.
  const lowerRun = await h.request(
    'POST',
    '/api/runs',
    {
      ticketId: secondTicket.ticketId,
      seed: secondTicket.seed,
      score: 80,
      durationMs: 10_000,
      moves: [{ trayIndex: 0, row: 0, col: 0 }],
    },
    session.json.authToken,
  );
  assert.equal(lowerRun.status, 200);
  assert.equal(lowerRun.json.snapshot.currentPlayer.weeklyBest, 120);
  assert.equal(lowerRun.json.snapshot.currentPlayer.runsCount, 2);

  // Record-only принимает «голый» payload { score } — без тикета/сида/ходов.
  const bareRun = await h.request(
    'POST',
    '/api/runs',
    { score: 200 },
    session.json.authToken,
  );
  assert.equal(bareRun.status, 200);
  assert.equal(bareRun.json.snapshot.currentPlayer.weeklyBest, 200);
  assert.equal(bareRun.json.snapshot.currentPlayer.runsCount, 3);

  const idempotent = await h.request(
    'POST',
    '/api/runs',
    { proofId: 'proof-retry-1', score: 250 },
    session.json.authToken,
  );
  const retried = await h.request(
    'POST',
    '/api/runs',
    { proofId: 'proof-retry-1', score: 250 },
    session.json.authToken,
  );
  assert.equal(idempotent.json.snapshot.currentPlayer.runsCount, 4);
  assert.equal(retried.json.snapshot.currentPlayer.runsCount, 4);
});

test('leaderboard week rolls at Monday midnight in Moscow time', async (t) => {
  const h = createHarness();
  t.after(h.cleanup);

  const session = await h.request('POST', '/api/profile/bootstrap', { nickname: 'PixelNova' });

  h.setNow('2026-07-05T20:59:59.000Z');
  const before = await h.request('GET', '/api/leaderboard', undefined, session.json.authToken);
  assert.equal(before.status, 200);
  assert.equal(before.json.weekKey, '2026-06-29');
  assert.equal(before.json.weekStartIso, '2026-06-28T21:00:00.000Z');
  assert.equal(before.json.weekEndIso, '2026-07-05T21:00:00.000Z');

  h.setNow('2026-07-05T21:00:00.000Z');
  const after = await h.request('GET', '/api/leaderboard', undefined, session.json.authToken);
  assert.equal(after.status, 200);
  assert.equal(after.json.weekKey, '2026-07-06');
  assert.equal(after.json.weekStartIso, '2026-07-05T21:00:00.000Z');
  assert.equal(after.json.weekEndIso, '2026-07-12T21:00:00.000Z');
});

test('weekly outcomes use the final server rank, not a midweek cached rank', async (t) => {
  const h = createHarness();
  t.after(h.cleanup);

  const me = await h.request('POST', '/api/profile/bootstrap', { nickname: 'PixelNova' });
  await h.request('POST', '/api/runs', { score: 900 }, me.json.authToken);
  const leader = await h.request('POST', '/api/profile/bootstrap', { nickname: 'TopPlayer' });
  await h.request('POST', '/api/runs', { score: 1_000 }, leader.json.authToken);
  const midweek = await h.request('GET', '/api/leaderboard', undefined, me.json.authToken);
  assert.equal(midweek.json.currentPlayer.rank, 2);

  for (let index = 0; index < 8; index += 1) {
    const rival = await h.request('POST', '/api/profile/bootstrap', {
      nickname: `Rival${index}`,
    });
    await h.request('POST', '/api/runs', { score: 990 - index }, rival.json.authToken);
  }
  const pending = await h.request('GET', '/api/weekly/outcomes', undefined, me.json.authToken);
  assert.deepEqual(pending.json.outcomes, []);
  h.setNow('2026-06-22T00:00:00.000Z');

  const outcomes = await h.request('GET', '/api/weekly/outcomes', undefined, me.json.authToken);
  assert.equal(outcomes.status, 200);
  assert.equal(outcomes.json.outcomes.length, 1);
  assert.equal(outcomes.json.outcomes[0].rank, 10);
  assert.equal(outcomes.json.outcomes[0].reward, null);
});

test('weekly final archive captures a late improvement from cached #10 to final #2', async (t) => {
  const h = createHarness();
  t.after(h.cleanup);

  const me = await h.request('POST', '/api/profile/bootstrap', { nickname: 'PixelNova' });
  await h.request('POST', '/api/runs', { score: 500 }, me.json.authToken);
  for (let index = 0; index < 9; index += 1) {
    const rival = await h.request('POST', '/api/profile/bootstrap', {
      nickname: `Ahead${index}`,
    });
    await h.request(
      'POST',
      '/api/runs',
      { score: index === 0 ? 2_500 : 1_500 - index },
      rival.json.authToken,
    );
  }
  const midweek = await h.request('GET', '/api/leaderboard', undefined, me.json.authToken);
  assert.equal(midweek.json.currentPlayer.rank, 10);

  await h.request('POST', '/api/runs', { score: 2_000 }, me.json.authToken);
  h.setNow('2026-06-22T00:00:00.000Z');
  const outcomes = await h.request('GET', '/api/weekly/outcomes', undefined, me.json.authToken);

  assert.equal(outcomes.json.outcomes[0].rank, 2);
  assert.equal(outcomes.json.outcomes[0].reward.prize.points, 700);
});

test('weekly claim is owner-bound and idempotently returns one stable receipt', async (t) => {
  const h = createHarness();
  t.after(h.cleanup);

  const me = await h.request('POST', '/api/profile/bootstrap', { nickname: 'PixelNova' });
  const other = await h.request('POST', '/api/profile/bootstrap', { nickname: 'OtherOne' });
  await h.request('POST', '/api/runs', { score: 2_000 }, other.json.authToken);
  await h.request('POST', '/api/runs', { score: 1_500 }, me.json.authToken);
  h.setNow('2026-06-22T00:00:00.000Z');

  const outcomes = await h.request('GET', '/api/weekly/outcomes', undefined, me.json.authToken);
  const outcome = outcomes.json.outcomes[0];
  assert.equal(outcome.rank, 2);
  assert.equal(outcome.reward.prize.points, 700);
  assert.match(outcome.reward.rewardId, /^weekly:2026-06-15:.+:rank-2$/);

  const [first, second] = await Promise.all([
    h.request(
      'POST',
      '/api/weekly/rewards/claim',
      { rewardId: outcome.reward.rewardId },
      me.json.authToken,
    ),
    h.request(
      'POST',
      '/api/weekly/rewards/claim',
      { rewardId: outcome.reward.rewardId },
      me.json.authToken,
    ),
  ]);
  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  assert.deepEqual(second.json.receipt, first.json.receipt);
  assert.equal(first.json.receipt.effectScope, 'local_profile');

  const foreign = await h.request(
    'POST',
    '/api/weekly/rewards/claim',
    { rewardId: outcome.reward.rewardId },
    other.json.authToken,
  );
  assert.equal(foreign.status, 404);

  const recovered = await h.request('GET', '/api/weekly/outcomes', undefined, me.json.authToken);
  assert.deepEqual(recovered.json.outcomes[0].receipt, first.json.receipt);
});

test('weekly archive keeps deterministic tie ranks and returns multiple missed weeks', async (t) => {
  const h = createHarness();
  t.after(h.cleanup);

  const first = await h.request('POST', '/api/profile/bootstrap', { nickname: 'TieFirst' });
  const second = await h.request('POST', '/api/profile/bootstrap', { nickname: 'TieSecond' });
  await h.request('POST', '/api/runs', { score: 1_000 }, first.json.authToken);
  await h.request('POST', '/api/runs', { score: 1_000 }, second.json.authToken);

  h.setNow('2026-06-22T12:00:00.000Z');
  const firstWeekOne = await h.request('GET', '/api/weekly/outcomes', undefined, first.json.authToken);
  const secondWeekOne = await h.request('GET', '/api/weekly/outcomes', undefined, second.json.authToken);
  assert.deepEqual(
    [firstWeekOne.json.outcomes[0].rank, secondWeekOne.json.outcomes[0].rank].sort(),
    [1, 2],
  );

  await h.request('POST', '/api/runs', { score: 1_100 }, first.json.authToken);
  h.setNow('2026-06-29T12:00:00.000Z');
  await h.request('POST', '/api/runs', { score: 1_200 }, first.json.authToken);
  h.setNow('2026-07-06T12:00:00.000Z');

  const missed = await h.request('GET', '/api/weekly/outcomes', undefined, first.json.authToken);
  assert.deepEqual(
    missed.json.outcomes.map((item) => item.weekKey),
    ['2026-06-29', '2026-06-22', '2026-06-15'],
  );
  const repeated = await h.request('GET', '/api/weekly/outcomes', undefined, first.json.authToken);
  assert.deepEqual(repeated.json.outcomes, missed.json.outcomes);
});

test('adventure season is a server-owned 14 day window', async (t) => {
  const h = createHarness();
  t.after(h.cleanup);

  const session = await h.request('POST', '/api/profile/bootstrap', { nickname: 'PixelNova' });

  h.setNow('2026-07-05T21:00:00.000Z');
  const first = await h.request('GET', '/api/adventure/season', undefined, session.json.authToken);
  assert.equal(first.status, 200);
  assert.equal(first.json.seasonId, 1);
  assert.equal(first.json.windowStartIso, '2026-07-05T21:00:00.000Z');
  assert.equal(first.json.windowEndIso, '2026-07-19T21:00:00.000Z');
  assert.equal(first.json.durationDays, 14);

  h.setNow('2026-07-19T20:59:59.000Z');
  const beforeRoll = await h.request('GET', '/api/adventure/season', undefined, session.json.authToken);
  assert.equal(beforeRoll.json.seasonId, 1);

  h.setNow('2026-07-19T21:00:00.000Z');
  const afterRoll = await h.request('GET', '/api/adventure/season', undefined, session.json.authToken);
  assert.equal(afterRoll.json.seasonId, 2);
  assert.equal(afterRoll.json.windowStartIso, '2026-07-19T21:00:00.000Z');
  assert.equal(afterRoll.json.windowEndIso, '2026-08-02T21:00:00.000Z');
});

test('avatar: сабмит сохраняет витринный образ и отдаёт его в списке', async (t) => {
  const h = createHarness();
  t.after(h.cleanup);

  const session = await h.request('POST', '/api/profile/bootstrap', { nickname: 'PixelNova' });
  const token = session.json.authToken;

  const submit = await h.request(
    'POST',
    '/api/runs',
    { score: 1200, avatar: '2|skin-mint||face-glasses||' },
    token,
  );
  assert.equal(submit.status, 200);
  assert.equal(submit.json.snapshot.currentPlayer.avatar, '2|skin-mint||face-glasses||');

  const board = await h.request('GET', '/api/leaderboard', undefined, token);
  assert.equal(board.json.entries[0].avatar, '2|skin-mint||face-glasses||');

  // Следующий сабмит без avatar не затирает сохранённый образ.
  const bare = await h.request('POST', '/api/runs', { score: 900 }, token);
  assert.equal(bare.status, 200);
  assert.equal(bare.json.snapshot.currentPlayer.avatar, '2|skin-mint||face-glasses||');
});

test('avatar: невалидное поле игнорируется, сабмит проходит', async (t) => {
  const h = createHarness();
  t.after(h.cleanup);

  const session = await h.request('POST', '/api/profile/bootstrap', { nickname: 'PixelNova' });
  const token = session.json.authToken;

  const weird = await h.request(
    'POST',
    '/api/runs',
    { score: 700, avatar: '<script>alert(1)</script>' },
    token,
  );
  assert.equal(weird.status, 200);
  assert.equal(weird.json.snapshot.currentPlayer.avatar, null);

  const tooLong = await h.request(
    'POST',
    '/api/runs',
    { score: 800, avatar: `1|${'x'.repeat(200)}` },
    token,
  );
  assert.equal(tooLong.status, 200);
  assert.equal(tooLong.json.snapshot.currentPlayer.avatar, null);

  const nonString = await h.request('POST', '/api/runs', { score: 900, avatar: 42 }, token);
  assert.equal(nonString.status, 200);
  assert.equal(nonString.json.snapshot.currentPlayer.avatar, null);
});

test('API key and bearer token are required on protected operations', async (t) => {
  const h = createHarness();
  t.after(h.cleanup);

  const missingKey = await apiWithoutKey(h, 'POST', '/api/profile/bootstrap', {
    nickname: 'PixelNova',
  });
  assert.equal(missingKey.status, 401);

  const missingBearer = await h.request('POST', '/api/tickets');
  assert.equal(missingBearer.status, 401);
});

async function apiWithoutKey(h, method, url, body) {
  return h.request(method, url, body, null, false);
}
