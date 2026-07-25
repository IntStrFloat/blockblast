import { getJSON, removeKey, setString } from '@/core/storage';

import {
  FTUE_STORAGE_KEY,
  FTUE_VERSION,
  migrateFtueState,
  shouldEnterFtue,
  useFtueStore,
} from '../ftueStore';

const NEW_INSTALL = {
  version: FTUE_VERSION,
  status: 'not_started' as const,
  startedAt: null,
  placements: 0,
  invalidDrops: 0,
  completedAt: null,
  skipReason: null,
};

beforeEach(() => {
  removeKey(FTUE_STORAGE_KEY);
  useFtueStore.setState(NEW_INSTALL);
});

describe('FTUE v2 migration', () => {
  it('keeps a brand-new install eligible', () => {
    const state = migrateFtueState({
      persisted: null,
      legacyTutorialDone: false,
      gamesPlayed: 0,
      now: 100,
    });
    expect(state).toEqual(NEW_INSTALL);
    expect(shouldEnterFtue(state, 0)).toBe(true);
  });

  it('maps the old tutorialDone flag to complete', () => {
    setString('tutorial.done', '1');
    const state = migrateFtueState({
      persisted: null,
      legacyTutorialDone: true,
      gamesPlayed: 0,
      now: 200,
    });
    expect(state.status).toBe('complete');
    expect(state.completedAt).toBe(200);
    expect(shouldEnterFtue(state, 0)).toBe(false);
  });

  it('does not enroll existing players even when the old flag is absent', () => {
    const state = migrateFtueState({
      persisted: null,
      legacyTutorialDone: false,
      gamesPlayed: 1,
      now: 300,
    });
    expect(state.status).toBe('complete');
    expect(shouldEnterFtue(state, 1)).toBe(false);
  });

  it('restores a valid v2 in-progress state', () => {
    const state = migrateFtueState({
      persisted: { ...NEW_INSTALL, status: 'clear_line', placements: 2, invalidDrops: 1 },
      legacyTutorialDone: false,
      gamesPlayed: 0,
    });
    expect(state).toMatchObject({ status: 'clear_line', placements: 2, invalidDrops: 1 });
  });
});

describe('action-driven FTUE state machine', () => {
  it('advances only through game actions and completes after celebration', () => {
    const store = useFtueStore.getState();
    store.start(10);
    expect(useFtueStore.getState().status).toBe('grab_piece');

    useFtueStore.getState().recordGrab();
    expect(useFtueStore.getState().status).toBe('valid_drop');

    useFtueStore.getState().recordValidDrop();
    expect(useFtueStore.getState()).toMatchObject({ status: 'clear_line', placements: 1 });

    useFtueStore.getState().recordLineClear();
    expect(useFtueStore.getState().status).toBe('celebrating');

    useFtueStore.getState().completeAfterCelebration(20);
    expect(useFtueStore.getState()).toMatchObject({ status: 'complete', completedAt: 20 });
    expect(getJSON(FTUE_STORAGE_KEY)).toMatchObject({ status: 'complete', placements: 1 });
  });

  it('counts invalid drops and makes skip terminal', () => {
    useFtueStore.getState().start(10);
    useFtueStore.getState().recordInvalidDrop();
    useFtueStore.getState().recordInvalidDrop();
    useFtueStore.getState().skip('user', 15);
    useFtueStore.getState().recordGrab();

    expect(useFtueStore.getState()).toMatchObject({
      status: 'skipped',
      invalidDrops: 2,
      completedAt: 15,
      skipReason: 'user',
    });
  });
});
