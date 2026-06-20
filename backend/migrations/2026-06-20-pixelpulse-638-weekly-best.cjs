const fs = require('node:fs');

const MIGRATION_ID = '2026-06-20-pixelpulse-638-weekly-best';
const WEEK_START_ISO = '2026-06-15T00:00:00.000Z';
const WEEK_END_ISO = '2026-06-22T00:00:00.000Z';
const COMPLETED_AT = '2026-06-20T00:00:00.000Z';
const TARGET_SCORE = 3706;

function migrateStore({ dataPath, backupPath = `${dataPath}.${MIGRATION_ID}.bak` }) {
  const originalText = fs.readFileSync(dataPath, 'utf8');
  const data = JSON.parse(originalText);
  const users = Object.values(data.users ?? {}).filter(
    (user) => user.nickname === 'PixelPulse' && user.tag === '638',
  );
  if (users.length !== 1) {
    throw new Error(`Expected one PixelPulse / 638 profile, found ${users.length}`);
  }

  const user = users[0];
  const weeklyRuns = (data.runs ?? []).filter(
    (run) =>
      run.userId === user.id &&
      run.completedAt >= WEEK_START_ISO &&
      run.completedAt < WEEK_END_ISO,
  );
  const currentBest = weeklyRuns.reduce((best, run) => Math.max(best, run.score), 0);
  const alreadyApplied = weeklyRuns.some((run) => run.migrationId === MIGRATION_ID);
  if (alreadyApplied || currentBest >= TARGET_SCORE) {
    return { changed: false, currentBest, userId: user.id };
  }

  fs.writeFileSync(backupPath, originalText, { flag: 'wx' });
  data.runs.push({
    id: `migration-${MIGRATION_ID}`,
    ticketId: `migration-${MIGRATION_ID}`,
    userId: user.id,
    score: TARGET_SCORE,
    durationMs: 0,
    movesCount: 0,
    completedAt: COMPLETED_AT,
    migrationId: MIGRATION_ID,
  });

  const tempPath = `${dataPath}.${MIGRATION_ID}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(data, null, 2));
  fs.renameSync(tempPath, dataPath);
  return { changed: true, currentBest: TARGET_SCORE, userId: user.id, backupPath };
}

if (require.main === module) {
  const dataPath = process.argv[2];
  if (!dataPath) {
    throw new Error('Usage: node migration.cjs <data-path> [backup-path]');
  }
  const result = migrateStore({ dataPath, backupPath: process.argv[3] });
  console.log(JSON.stringify(result));
}

module.exports = { migrateStore };
