const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const TICKET_POOL_SIZE = 10;
const TICKET_TTL_MS = 14 * 24 * 60 * 60 * 1000;
const MAX_MOVES = 20_000;
const MAX_SCORE = 100_000_000;

function createApi(options) {
  const apiKey = options.apiKey ?? '';
  const now = options.now ?? (() => new Date());
  const store = createJsonStore(options.dataPath);

  async function handle(request) {
    const method = String(request.method ?? 'GET').toUpperCase();
    const pathname = new URL(request.url ?? '/', 'http://localhost').pathname;
    const headers = lowerCaseHeaders(request.headers ?? {});

    if (method === 'OPTIONS') return response(204, null);
    // Record-only: сервер хранит лучший счёт и НЕ реплеит ходы, поэтому не зависит
    // от движка — дрейф движка больше не может ронять ranked-сабмиты.
    if (pathname === '/api/health') return response(200, { ok: true, mode: 'record-only' });
    if (apiKey && headers['x-api-key'] !== apiKey) {
      return response(401, { error: 'invalid_api_key' });
    }

    let body = {};
    if (request.body) {
      try {
        body = JSON.parse(request.body);
      } catch {
        return response(400, { error: 'invalid_json' });
      }
    }

    if (method === 'POST' && pathname === '/api/profile/bootstrap') {
      const existing = authenticate(store.read(), headers.authorization);
      if (existing) {
        return response(200, {
          profile: publicProfile(existing.user),
          authToken: existing.token,
        });
      }
      const nickname = validateNickname(body.nickname);
      if (!nickname.ok) return response(400, { error: nickname.error });

      const data = store.read();
      const userId = crypto.randomUUID();
      const authToken = randomToken();
      const user = {
        id: userId,
        nickname: nickname.value,
        tag: uniqueTag(data),
        tokenHash: hashToken(authToken),
        createdAt: now().toISOString(),
        updatedAt: now().toISOString(),
      };
      data.users[userId] = user;
      store.write(data);
      return response(200, { profile: publicProfile(user), authToken });
    }

    const session = authenticate(store.read(), headers.authorization);
    if (!session) return response(401, { error: 'invalid_auth' });

    if (method === 'POST' && pathname === '/api/profile/rename') {
      const nickname = validateNickname(body.nickname);
      if (!nickname.ok) return response(400, { error: nickname.error });
      const data = store.read();
      const user = data.users[session.user.id];
      user.nickname = nickname.value;
      user.updatedAt = now().toISOString();
      store.write(data);
      return response(200, { profile: publicProfile(user) });
    }

    if (method === 'POST' && pathname === '/api/tickets') {
      const data = store.read();
      const nowMs = now().getTime();
      const valid = Object.values(data.tickets).filter(
        (ticket) =>
          ticket.userId === session.user.id &&
          ticket.consumedAt === null &&
          new Date(ticket.expiresAt).getTime() > nowMs,
      );
      while (valid.length < TICKET_POOL_SIZE) {
        const ticket = {
          ticketId: crypto.randomUUID(),
          userId: session.user.id,
          seed: crypto.randomBytes(4).readInt32LE(0),
          issuedAt: now().toISOString(),
          expiresAt: new Date(nowMs + TICKET_TTL_MS).toISOString(),
          consumedAt: null,
        };
        data.tickets[ticket.ticketId] = ticket;
        valid.push(ticket);
      }
      store.write(data);
      return response(200, {
        tickets: valid.slice(0, TICKET_POOL_SIZE).map(publicTicket),
      });
    }

    if (method === 'GET' && pathname === '/api/leaderboard') {
      return response(200, buildSnapshot(store.read(), session.user.id, now()));
    }

    if (method === 'POST' && pathname === '/api/runs') {
      const parsed = validateRunPayload(body);
      if (!parsed.ok) return response(400, { error: parsed.error });

      const data = store.read();
      // Record-only: доверяем лучшему счёту клиента (реплей-верификация снята —
      // продуктовое решение «только рекорд»). Тикет теперь необязателен: если он
      // передан и валиден — гасим его (ротация сидов), но он НИКОГДА не блокирует
      // запись результата. Так «после каждой игры синхронизируется рекорд» всегда.
      const ticket = parsed.value.ticketId ? data.tickets[parsed.value.ticketId] : null;

      const before = buildSnapshot(data, session.user.id, now());
      if (
        ticket &&
        ticket.userId === session.user.id &&
        ticket.consumedAt === null &&
        new Date(ticket.expiresAt).getTime() > now().getTime()
      ) {
        ticket.consumedAt = now().toISOString();
      }
      data.runs.push({
        id: crypto.randomUUID(),
        ticketId: ticket ? ticket.ticketId : null,
        userId: session.user.id,
        score: parsed.value.score,
        durationMs: parsed.value.durationMs,
        movesCount: parsed.value.moves.length,
        completedAt: now().toISOString(),
      });
      store.write(data);

      const snapshot = buildSnapshot(data, session.user.id, now());
      const oldRank = before.currentPlayer.rank;
      const newRank = snapshot.currentPlayer.rank;
      return response(200, {
        snapshot,
        impact: {
          score: parsed.value.score,
          weeklyBest: snapshot.currentPlayer.weeklyBest,
          rank: newRank,
          rankDelta: oldRank !== null && newRank !== null ? oldRank - newRank : null,
          improved: snapshot.currentPlayer.weeklyBest > before.currentPlayer.weeklyBest,
          queued: false,
        },
      });
    }

    return response(404, { error: 'not_found' });
  }

  return { handle };
}

function createJsonStore(dataPath) {
  if (!dataPath) throw new Error('dataPath is required');
  fs.mkdirSync(path.dirname(dataPath), { recursive: true });

  function read() {
    try {
      const parsed = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
      return {
        users: parsed.users ?? {},
        tickets: parsed.tickets ?? {},
        runs: parsed.runs ?? [],
      };
    } catch {
      return { users: {}, tickets: {}, runs: [] };
    }
  }

  function write(data) {
    const tempPath = `${dataPath}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(data), { encoding: 'utf8', mode: 0o600 });
    fs.renameSync(tempPath, dataPath);
  }

  return { read, write };
}

function authenticate(data, authorization) {
  if (!authorization?.startsWith('Bearer ')) return null;
  const token = authorization.slice('Bearer '.length);
  const tokenHash = hashToken(token);
  const user = Object.values(data.users).find((candidate) =>
    safeEqual(candidate.tokenHash, tokenHash),
  );
  return user ? { user, token } : null;
}

function validateNickname(input) {
  const value = String(input ?? '').trim().replace(/\s+/g, '');
  if (value.length < 3) return { ok: false, error: 'nickname_too_short' };
  if (value.length > 16) return { ok: false, error: 'nickname_too_long' };
  if (!/^[A-Za-z0-9_]+$/.test(value)) {
    return { ok: false, error: 'nickname_invalid_chars' };
  }
  return { ok: true, value };
}

function validateRunPayload(body) {
  // Record-only: обязателен только валидный score. ticketId/seed/moves/durationMs
  // необязательны — старые клиенты шлют их (игнорируем как доказательство),
  // упрощённый клиент может прислать «голый» { score }.
  if (!Number.isInteger(body.score) || body.score < 0 || body.score > MAX_SCORE) {
    return { ok: false, error: 'invalid_run' };
  }
  const durationMs =
    Number.isFinite(body.durationMs) && body.durationMs >= 0 && body.durationMs <= 24 * 60 * 60 * 1000
      ? body.durationMs
      : 0;
  const ticketId = typeof body.ticketId === 'string' ? body.ticketId : null;
  const seed = Number.isInteger(body.seed) ? body.seed : null;
  const moves = [];
  if (Array.isArray(body.moves)) {
    if (body.moves.length > MAX_MOVES) return { ok: false, error: 'invalid_run' };
    for (const move of body.moves) {
      if (
        !Number.isInteger(move?.trayIndex) ||
        !Number.isInteger(move?.row) ||
        !Number.isInteger(move?.col)
      ) {
        return { ok: false, error: 'invalid_move' };
      }
      moves.push({ trayIndex: move.trayIndex, row: move.row, col: move.col });
    }
  }
  return { ok: true, value: { ticketId, seed, score: body.score, durationMs, moves } };
}

function buildSnapshot(data, currentUserId, date) {
  const week = utcWeek(date);
  const users = Object.values(data.users);
  const weeklyRuns = data.runs.filter(
    (run) => run.completedAt >= week.weekStartIso && run.completedAt < week.weekEndIso,
  );
  const records = users
    .map((user) => {
      const runs = weeklyRuns.filter((run) => run.userId === user.id);
      const best = runs.reduce((max, run) => Math.max(max, run.score), 0);
      const achievedAt =
        runs
          .filter((run) => run.score === best)
          .map((run) => run.completedAt)
          .sort()[0] ?? null;
      return { user, best, runsCount: runs.length, achievedAt };
    })
    .filter((record) => record.best > 0)
    .sort(
      (a, b) =>
        b.best - a.best ||
        a.runsCount - b.runsCount ||
        String(a.achievedAt).localeCompare(String(b.achievedAt)),
    );

  const rankedEntries = records.map((record, index) =>
    publicEntry(record, index + 1, record.user.id === currentUserId),
  );
  const currentRanked = rankedEntries.find((entry) => entry.isCurrentPlayer);
  const currentUser = data.users[currentUserId];
  const currentPlayer =
    currentRanked ??
    ({
      ...publicProfile(currentUser),
      rank: null,
      weeklyBest: 0,
      runsCount: 0,
      achievedAt: null,
      isCurrentPlayer: true,
    });

  return {
    weekKey: week.weekKey,
    weekStartIso: week.weekStartIso,
    weekEndIso: week.weekEndIso,
    generatedAt: date.toISOString(),
    source: 'remote',
    isCached: false,
    currentPlayer,
    entries: rankedEntries.slice(0, 100),
  };
}

function utcWeek(date) {
  const start = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0),
  );
  const day = start.getUTCDay();
  start.setUTCDate(start.getUTCDate() - (day === 0 ? 6 : day - 1));
  const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
  return {
    weekKey: start.toISOString().slice(0, 10),
    weekStartIso: start.toISOString(),
    weekEndIso: end.toISOString(),
  };
}

function publicProfile(user) {
  return { nickname: user.nickname, tag: user.tag };
}

function publicEntry(record, rank, isCurrentPlayer) {
  return {
    ...publicProfile(record.user),
    rank,
    weeklyBest: record.best,
    runsCount: record.runsCount,
    achievedAt: record.achievedAt,
    isCurrentPlayer,
  };
}

function publicTicket(ticket) {
  return {
    ticketId: ticket.ticketId,
    seed: ticket.seed,
    expiresAt: ticket.expiresAt,
  };
}

function uniqueTag(data) {
  const used = new Set(Object.values(data.users).map((user) => user.tag));
  for (let attempt = 0; attempt < 1000; attempt += 1) {
    const tag = crypto.randomBytes(3).toString('hex').slice(0, 3).toUpperCase();
    if (!used.has(tag)) return tag;
  }
  throw new Error('tag_space_exhausted');
}

function randomToken() {
  return crypto.randomBytes(32).toString('base64url');
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function lowerCaseHeaders(headers) {
  return Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [key.toLowerCase(), String(value)]),
  );
}

function response(status, json) {
  return { status, json };
}

module.exports = { createApi };
