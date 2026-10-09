import { getJSON, removeKey, setString } from '@/core/storage';

import {
  FTUE_METRIC_VERSION,
  FTUE_STORAGE_KEY,
  FTUE_VERSION,
  migrateFtueState,
  shouldEnterFtue,
  shouldShowFtueAssistance,
  useFtueStore,
} from '../ftueStore';

const NEW_INSTALL = {
  version: FTUE_VERSION,
  status: 'not_started' as const,
  variant: 'control' as const,
  metricVersion: FTUE_METRIC_VERSION as typeof FTUE_METRIC_VERSION,
  startedAt: null,
  placements: 0,
  invalidDrops: 0,
  completedAt: null,
  skipReason: null,
  runId: null,
  guidedClearAt: null,
  acceptedMovesAfterFixture: 0,
  movesSinceLastClear: 0,
  invalidDropsSinceLastClear: 0,
  assistanceActive: false,
  assistanceUsedSinceLastClear: false,
  practicePromptVisible: false,
  metricWindowClosed: false,
  outcome: null,
};

beforeEach(() => {
  removeKey(FTUE_STORAGE_KEY);
  useFtueStore.setState(NEW_INSTALL);
});

describe('FTUE migration', () => {
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

  it('maps the old tutorialDone flag to a closed measurement', () => {
    setString('tutorial.done', '1');
    const state = migrateFtueState({
      persisted: null,
      legacyTutorialDone: true,
      gamesPlayed: 0,
      now: 200,
    });
    expect(state).toMatchObject({
      status: 'complete',
      completedAt: 200,
      metricWindowClosed: true,
    });
    expect(shouldEnterFtue(state, 0)).toBe(false);
  });

  it('migrates the old celebration to a guided result, never independent success', () => {
    const state = migrateFtueState({
      persisted: { ...NEW_INSTALL, version: 3, status: 'celebrating', runId: 'run-old' },
      legacyTutorialDone: false,
      gamesPlayed: 0,
      now: 250,
    });
    expect(state).toMatchObject({
      status: 'guided_success',
      outcome: 'guided_success',
      guidedClearAt: 250,
      variant: 'control',
    });
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

  it.each(['complete', 'skipped'] as const)(
    'keeps the v4 measurement window open across a %s checkpoint resume',
    (status) => {
      const state = migrateFtueState({
        persisted: {
          ...NEW_INSTALL,
          status,
          runId: 'tutorial-resume',
          guidedClearAt: 20,
          completedAt: 30,
          metricWindowClosed: false,
        },
        legacyTutorialDone: false,
        gamesPlayed: 0,
      });
      expect(state).toMatchObject({ status, metricWindowClosed: false });
    },
  );
});

describe('independent-clear FTUE state machine', () => {
  function beginTreatment(): void {
    useFtueStore.getState().beginAttempt('tutorial-new', 'independent_clear', 10);
  }

  function finishPreparedClear(): void {
    useFtueStore.getState().recordAcceptedPlacement({
      clearedLines: 2,
      followedHighlight: true,
      now: 20,
    });
    useFtueStore.getState().finishGuidedCelebration(21);
  }

  it('keeps the prepared clear guided and opens independent three-piece play', () => {
    beginTreatment();
    const result = useFtueStore.getState().recordAcceptedPlacement({
      clearedLines: 2,
      followedHighlight: true,
      now: 20,
    });
    expect(result).toMatchObject({
      phase: 'guided',
      clearOutcome: 'guided_success',
      acceptedMovesAfterFixture: 0,
    });
    expect(useFtueStore.getState()).toMatchObject({
      status: 'guided_success',
      outcome: 'guided_success',
    });

    useFtueStore.getState().finishGuidedCelebration(21);
    expect(useFtueStore.getState()).toMatchObject({
      status: 'independent_play',
      practicePromptVisible: true,
      completedAt: null,
    });
  });

  it('shows non-blocking assistance only after difficulty and excludes that clear', () => {
    beginTreatment();
    finishPreparedClear();
    useFtueStore.getState().recordInvalidDrop();
    expect(shouldShowFtueAssistance(useFtueStore.getState())).toBe(false);
    useFtueStore.getState().recordInvalidDrop();
    expect(shouldShowFtueAssistance(useFtueStore.getState())).toBe(true);

    const assisted = useFtueStore.getState().recordAcceptedPlacement({
      clearedLines: 1,
      followedHighlight: true,
      now: 30,
    });
    expect(assisted.clearOutcome).toBe('assisted_clear');
    expect(useFtueStore.getState()).toMatchObject({
      status: 'independent_play',
      outcome: 'assisted_clear',
      acceptedMovesAfterFixture: 1,
      assistanceActive: false,
    });
  });

  it('keeps outside-board returns neutral but counts occupied conflicts as difficulty', () => {
    beginTreatment();
    finishPreparedClear();

    useFtueStore.getState().recordInvalidDrop('outside-board');
    useFtueStore.getState().recordInvalidDrop('outside-board');
    expect(useFtueStore.getState().invalidDropsSinceLastClear).toBe(0);
    expect(shouldShowFtueAssistance(useFtueStore.getState())).toBe(false);

    useFtueStore.getState().recordInvalidDrop('occupied');
    useFtueStore.getState().recordInvalidDrop('occupied');
    expect(useFtueStore.getState().invalidDropsSinceLastClear).toBe(2);
    expect(shouldShowFtueAssistance(useFtueStore.getState())).toBe(true);
  });

  it('keeps a clear assisted after any highlighted step in the same plan', () => {
    beginTreatment();
    finishPreparedClear();
    useFtueStore.getState().recordInvalidDrop();
    useFtueStore.getState().recordInvalidDrop();
    useFtueStore.getState().recordAcceptedPlacement({
      clearedLines: 0,
      followedHighlight: true,
      now: 30,
    });
    const assistedClear = useFtueStore.getState().recordAcceptedPlacement({
      clearedLines: 1,
      followedHighlight: false,
      now: 40,
    });
    expect(assistedClear).toMatchObject({
      phase: 'assisted',
      clearOutcome: 'assisted_clear',
      acceptedMovesAfterFixture: 2,
      metricWindowClosed: false,
    });
    const independent = useFtueStore.getState().recordAcceptedPlacement({
      clearedLines: 1,
      followedHighlight: false,
      now: 50,
    });
    expect(independent).toMatchObject({
      phase: 'independent',
      clearOutcome: 'independent_success',
      acceptedMovesAfterFixture: 3,
      metricWindowClosed: true,
    });
    expect(useFtueStore.getState()).toMatchObject({
      status: 'complete',
      outcome: 'independent_success',
    });
  });

  it('keeps measuring a skipper after the prepared fixture without showing help', () => {
    beginTreatment();
    useFtueStore.getState().skip('user', 12);
    useFtueStore.getState().recordAcceptedPlacement({
      clearedLines: 2,
      followedHighlight: false,
      preparedFixtureMove: true,
      now: 20,
    });
    const realClear = useFtueStore.getState().recordAcceptedPlacement({
      clearedLines: 1,
      followedHighlight: false,
      now: 30,
    });
    expect(realClear.clearOutcome).toBe('independent_success');
    expect(useFtueStore.getState()).toMatchObject({
      status: 'skipped',
      skipReason: 'user',
      acceptedMovesAfterFixture: 1,
      outcome: 'independent_success',
      metricWindowClosed: true,
    });
    expect(shouldShowFtueAssistance(useFtueStore.getState())).toBe(false);
  });

  it('counts a skipper deviation as post-fixture play instead of discarding the first real clear', () => {
    beginTreatment();
    useFtueStore.getState().skip('user', 12);
    useFtueStore.getState().recordAcceptedPlacement({
      clearedLines: 0,
      followedHighlight: false,
      preparedFixtureMove: false,
      now: 20,
    });
    const clear = useFtueStore.getState().recordAcceptedPlacement({
      clearedLines: 1,
      followedHighlight: false,
      preparedFixtureMove: false,
      now: 30,
    });
    expect(clear).toMatchObject({
      clearOutcome: 'independent_success',
      acceptedMovesAfterFixture: 2,
    });
  });

  it('keeps the repaired current FTUE as the control', () => {
    useFtueStore.getState().beginAttempt('tutorial-control', 'control', 10);
    useFtueStore.getState().recordAcceptedPlacement({
      clearedLines: 2,
      followedHighlight: true,
      now: 20,
    });
    useFtueStore.getState().finishGuidedCelebration(30);
    expect(useFtueStore.getState()).toMatchObject({
      status: 'complete',
      outcome: 'guided_success',
      metricVersion: FTUE_METRIC_VERSION,
      metricWindowClosed: false,
    });
    const measured = useFtueStore.getState().recordAcceptedPlacement({
      clearedLines: 1,
      followedHighlight: false,
      now: 40,
    });
    expect(measured).toMatchObject({
      clearOutcome: 'independent_success',
      acceptedMovesAfterFixture: 1,
    });
    expect(getJSON(FTUE_STORAGE_KEY)).toMatchObject({ status: 'complete' });
  });

  it('closes treatment after ten accepted post-fixture moves without inventing a win', () => {
    beginTreatment();
    finishPreparedClear();
    for (let move = 1; move <= 10; move += 1) {
      useFtueStore.getState().recordAcceptedPlacement({
        clearedLines: 0,
        followedHighlight: move >= 2,
        now: 30 + move,
      });
    }
    expect(useFtueStore.getState()).toMatchObject({
      status: 'complete',
      acceptedMovesAfterFixture: 10,
      metricWindowClosed: true,
      outcome: 'guided_success',
    });
  });
});
