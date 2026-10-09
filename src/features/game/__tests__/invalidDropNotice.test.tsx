import React from 'react';
import { Pressable } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { useAnalyticsStore } from '@/features/analytics';
import { useSettings } from '@/features/settings';

import {
  InvalidDropNotice,
  useInvalidDropNotice,
  type InvalidDropReason,
} from '../components/InvalidDropNotice';

function Probe() {
  const api = useInvalidDropNotice('classic');
  return (
    <>
      <InvalidDropNotice message={api.message} />
      <Pressable testID="occupied" onPress={() => api.report('occupied')} />
      <Pressable testID="outside" onPress={() => api.report('outside-board')} />
      <Pressable testID="unavailable" onPress={() => api.report('unavailable')} />
      <Pressable testID="valid" onPress={api.recordValidDrop} />
    </>
  );
}

function renderedText(tree: ReactTestRenderer) {
  return tree.root.findAllByType('Text' as never).map((node) => node.children.join('')).join('');
}

describe('invalid drop notice', () => {
  let tree!: ReactTestRenderer;
  let trackSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(Date, 'now').mockReturnValue(10_000);
    useSettings.setState({ lang: 'ru' });
    trackSpy = jest.spyOn(useAnalyticsStore.getState(), 'track').mockImplementation(() => null);
    act(() => { tree = create(<Probe />); });
  });

  afterEach(() => {
    act(() => tree.unmount());
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  function report(reason: InvalidDropReason) {
    const testId = reason === 'outside-board' ? 'outside' : reason;
    act(() => tree.root.findByProps({ testID: testId }).props.onPress());
  }

  it('explains an occupied placement only after the repeated error', () => {
    report('occupied');
    expect(renderedText(tree)).toBe('');
    report('occupied');
    expect(renderedText(tree)).toContain('Клетки заняты');
    expect(trackSpy).toHaveBeenLastCalledWith('invalid_drop', expect.objectContaining({
      reason: 'occupied',
      streak: 2,
      placement_index: 0,
    }));
  });

  it('keeps outside-board return neutral and explains an unavailable piece', () => {
    report('outside-board');
    expect(renderedText(tree)).toBe('');
    report('unavailable');
    expect(renderedText(tree)).toContain('Освободи место другой фигурой');
  });

  it('clears the occupied streak after a valid placement', () => {
    report('occupied');
    act(() => tree.root.findByProps({ testID: 'valid' }).props.onPress());
    report('occupied');
    expect(renderedText(tree)).toBe('');
  });
});
