import React from 'react';
import { act, create } from 'react-test-renderer';

import { useWeeklyGoalWeekKey } from '../useWeeklyGoalWeekKey';

function Probe({ onValue }: { onValue: (value: string) => void }) {
  onValue(useWeeklyGoalWeekKey());
  return null;
}

describe('useWeeklyGoalWeekKey', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-07-05T20:59:59.900Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('updates while mounted at Monday 00:00 Moscow time', () => {
    const values: string[] = [];
    let tree!: ReturnType<typeof create>;
    act(() => {
      tree = create(<Probe onValue={(value) => values.push(value)} />);
    });
    expect(values.at(-1)).toBe('2026-06-29');

    act(() => {
      jest.advanceTimersByTime(200);
    });

    expect(values.at(-1)).toBe('2026-07-06');
    act(() => tree.unmount());
  });
});
