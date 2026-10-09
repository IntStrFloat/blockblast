import React from 'react';
import { act, create } from 'react-test-renderer';

import { Wardrobe } from '../components/Wardrobe';

const mockEquip = jest.fn();
const mockUnequip = jest.fn();
let mockMascotState: { unlocked: string[]; equipped: Record<string, string> };

jest.mock('@/features/settings', () => ({ useLang: () => 'ru' }));
jest.mock('@/features/progression', () => ({
  PROGRESSION_CONFIG: jest.requireActual('@/features/progression/logic/config').PROGRESSION_CONFIG,
  rewardDisplayName: jest.requireActual('@/features/progression/logic/presentation').rewardDisplayName,
  stageForLevel: () => 1,
  progressFor: () => ({ level: 1, pointsInLevel: 0, pointsToNext: 2000 }),
  useProgression: (select: (state: { lifetimePoints: number }) => unknown) => select({ lifetimePoints: 0 }),
}));
jest.mock('../store', () => ({
  useMascot: Object.assign(
    (select: (state: typeof mockMascotState) => unknown) => select(mockMascotState),
    { getState: () => ({ equip: mockEquip, unequip: mockUnequip }) },
  ),
}));
jest.mock('../components/Mascot', () => ({ Mascot: () => null, useMascotMotion: () => ({}) }));
jest.mock('../components/MascotArt', () => {
  const ReactLocal = jest.requireActual<typeof import('react')>('react');
  return { CosmeticIcon: (props: object) => ReactLocal.createElement('cosmetic-icon', props) };
});
jest.mock('expo-linear-gradient', () => {
  const ReactLocal = jest.requireActual<typeof import('react')>('react');
  return { LinearGradient: ({ children }: { children?: React.ReactNode }) => ReactLocal.createElement('gradient', {}, children) };
});
jest.mock('@/ui', () => {
  const ReactLocal = jest.requireActual<typeof import('react')>('react');
  const component = (name: string) => ({ children, ...props }: { children?: React.ReactNode }) => ReactLocal.createElement(name, props, children);
  return {
    AppText: component('app-text'), CheckIcon: component('check-icon'), LockIcon: component('lock-icon'),
    colors: {}, mascotPalette: {}, spacing: { m: 16, s: 8, xs: 4, l: 24 },
  };
});

const legacyIds = ['skin-chrome', 'hat-tophat', 'face-vr-visor', 'skin-obsidian', 'hat-halo'];

beforeEach(() => {
  mockMascotState = { unlocked: ['hat-casquette'], equipped: {} };
  jest.clearAllMocks();
});

describe('wardrobe availability', () => {
  it('hides unobtainable legacy items but retains locked progression rewards', () => {
    let renderer: ReturnType<typeof create>;
    act(() => { renderer = create(<Wardrobe visible onClose={jest.fn()} />); });
    const icons = renderer!.root.findAll((node) => String(node.type) === 'cosmetic-icon');
    const ids = icons.map((icon) => icon.props.id);
    for (const id of legacyIds) expect(ids).not.toContain(id);
    expect(ids).toContain('face-glasses');
    expect(icons.find((icon) => icon.props.id === 'face-glasses')!.props.muted).not.toBe(true);
    const locked = renderer!.root.findAll((node) => node.props.accessibilityRole === 'button' && node.props.accessibilityLabel?.includes('очки Капи'))[0];
    expect(locked.props.accessibilityLabel).toContain('3');
    act(() => { locked.props.onPress(); });
    expect(mockEquip).not.toHaveBeenCalled();
    act(() => renderer!.unmount());
  });

  it('keeps unlocked legacy items available for equip with readable names', () => {
    mockMascotState.unlocked.push('skin-chrome');
    let renderer: ReturnType<typeof create>;
    act(() => { renderer = create(<Wardrobe visible onClose={jest.fn()} />); });
    const tile = renderer!.root.findAll((node) => node.props.accessibilityRole === 'button' && node.props.accessibilityLabel?.includes('Хромированный образ'))[0];
    expect(tile.props.accessibilityLabel).not.toContain('ур.');
    act(() => { tile.props.onPress(); });
    expect(mockEquip).toHaveBeenCalledWith('skin', 'skin-chrome');
    act(() => renderer!.unmount());
  });

  it('preserves an equipped legacy item even if an older unlocked list omitted it', () => {
    mockMascotState.equipped.hat = 'hat-halo';
    let renderer: ReturnType<typeof create>;
    act(() => { renderer = create(<Wardrobe visible onClose={jest.fn()} />); });
    const tile = renderer!.root.findAll((node) => node.props.accessibilityRole === 'button' && node.props.accessibilityLabel?.includes('Нимб'))[0];
    expect(tile.props.accessibilityState).toEqual({ disabled: false, selected: true });
    act(() => { tile.props.onPress(); });
    expect(mockUnequip).toHaveBeenCalledWith('hat');
    act(() => renderer!.unmount());
  });
});
