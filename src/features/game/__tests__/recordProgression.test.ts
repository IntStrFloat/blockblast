import {
  RECORD_PROGRESS,
  recordProgressFor,
  recordProgressWindowFor,
  recordSceneIntensityFor,
} from '../animation/recordProgression';

describe('recordProgressFor', () => {
  it('keeps the first run out of the mid-run record celebration path', () => {
    expect(recordProgressFor(0, 0)).toMatchObject({ stage: 'first_run', remaining: 0 });
    expect(recordProgressFor(500, 0, 0)).toMatchObject({
      stage: 'first_run',
      remaining: 0,
      progress: 0,
    });
  });

  it('uses bounded pursuit and near-record windows', () => {
    expect(recordProgressWindowFor(200)).toEqual({ pursuit: 180, near: 60 });
    expect(recordProgressWindowFor(2_000)).toEqual({ pursuit: 360, near: 120 });
    expect(recordProgressWindowFor(100_000)).toEqual({ pursuit: 1_200, near: 300 });
  });

  it('moves monotonically through normal, pursuit, near and record states', () => {
    const best = 2_000;
    const target = best + 1;
    const pursuitStart = target - recordProgressWindowFor(best).pursuit;
    const nearStart = target - recordProgressWindowFor(best).near;

    expect(recordProgressFor(pursuitStart - 1, best).stage).toBe('normal');
    expect(recordProgressFor(pursuitStart, best).stage).toBe('pursuit');
    expect(recordProgressFor(nearStart - 1, best).stage).toBe('pursuit');
    expect(recordProgressFor(nearStart, best).stage).toBe('near');
    expect(recordProgressFor(best, best)).toMatchObject({ stage: 'near', remaining: 1 });
    expect(recordProgressFor(best + 1, best, best)).toMatchObject({
      stage: 'record_broken',
      remaining: 0,
      lead: 1,
    });
    expect(recordProgressFor(best + 2, best, best + 1).stage).toBe('post_record');
  });

  it('supports a direct jump across the record without replaying the crossing', () => {
    expect(recordProgressFor(1_500, 1_000, 200).stage).toBe('record_broken');
    expect(recordProgressFor(1_600, 1_000, 1_500).stage).toBe('post_record');
  });

  it('clamps progress and exposes calmer post-record scene intensity', () => {
    expect(recordProgressFor(-10, 1_000).progress).toBe(0);
    expect(recordProgressFor(3_000, 1_000, 2_000).progress).toBe(1);
    expect(recordSceneIntensityFor('normal')).toBe(0);
    expect(recordSceneIntensityFor('near')).toBeGreaterThan(
      recordSceneIntensityFor('pursuit'),
    );
    expect(recordSceneIntensityFor('record_broken')).toBe(1);
    expect(recordSceneIntensityFor('post_record')).toBeLessThan(1);
  });

  it('keeps configuration numbers centralized and ordered', () => {
    expect(RECORD_PROGRESS.pursuitRatio).toBeGreaterThan(RECORD_PROGRESS.nearRatio);
    expect(RECORD_PROGRESS.pursuitMin).toBeGreaterThan(RECORD_PROGRESS.nearMin);
    expect(RECORD_PROGRESS.pursuitMax).toBeGreaterThan(RECORD_PROGRESS.nearMax);
  });
});
