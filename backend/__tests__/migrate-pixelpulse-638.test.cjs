const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { migrateStore } = require('../migrations/2026-06-20-pixelpulse-638-weekly-best.cjs');

test('migrates PixelPulse 638 to 3706 once and preserves a backup', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bloxx-migration-'));
  const dataPath = path.join(dir, 'store.json');
  const backupPath = path.join(dir, 'store.before-migration.json');
  const userId = 'pixelpulse-user';
  const original = {
    users: {
      [userId]: { id: userId, nickname: 'PixelPulse', tag: '638' },
    },
    tickets: {},
    runs: [
      {
        id: 'existing-run',
        ticketId: 'existing-ticket',
        userId,
        score: 474,
        durationMs: 1000,
        movesCount: 17,
        completedAt: '2026-06-19T14:20:59.838Z',
      },
    ],
  };
  fs.writeFileSync(dataPath, JSON.stringify(original));

  const first = migrateStore({ dataPath, backupPath });
  const second = migrateStore({ dataPath, backupPath });
  const migrated = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

  assert.equal(first.changed, true);
  assert.equal(second.changed, false);
  assert.deepEqual(JSON.parse(fs.readFileSync(backupPath, 'utf8')), original);
  assert.equal(
    Math.max(...migrated.runs.filter((run) => run.userId === userId).map((run) => run.score)),
    3706,
  );
  assert.equal(
    migrated.runs.filter((run) => run.migrationId === '2026-06-20-pixelpulse-638-weekly-best').length,
    1,
  );
});
