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
    verifyRun: ({ score }) => ({ ok: true, score }),
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
    cleanup() {
      fs.rmSync(dir, { recursive: true, force: true });
    },
  };
}

test('health exposes the engine fingerprint for drift detection', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bloxx-backend-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const api = createApi({
    apiKey: API_KEY,
    dataPath: path.join(dir, 'data.json'),
    engineFingerprint: () => 'abc12345',
  });

  const health = await api.handle({ method: 'GET', url: '/api/health', headers: {}, body: '' });
  assert.equal(health.status, 200);
  assert.equal(health.json.ok, true);
  assert.equal(health.json.engine, 'abc12345');
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

test('weekly leaderboard uses one personal best and rejects reused tickets', async (t) => {
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

  const replay = await h.request(
    'POST',
    '/api/runs',
    {
      ticketId: firstTicket.ticketId,
      seed: firstTicket.seed,
      score: 999,
      durationMs: 10_000,
      moves: [],
    },
    session.json.authToken,
  );
  assert.equal(replay.status, 409);

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
