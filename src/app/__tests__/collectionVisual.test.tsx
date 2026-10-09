import React from 'react';
import { act, create } from 'react-test-renderer';

import CapyScreen from '../capy';

const mockTrack = jest.fn();
const mockPush = jest.fn();
const mockMascot = { unlocked: ['hat-casquette'], equipped: { hat: 'hat-casquette' } };

jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, back: jest.fn() }) }));
jest.mock('@/features/analytics', () => ({ useAnalyticsStore: { getState: () => ({ track: mockTrack }) } }));
jest.mock('@/features/settings', () => ({ useLang: () => 'ru' }));
jest.mock('@/features/progression', () => ({
  stageForLevel: () => 1,
  useProgression: (select: (state: { level: number }) => unknown) => select({ level: 1 }),
  rewardDisplayName: ({ id }: { id: string }) => id,
}));
jest.mock('@/features/mascot/store', () => ({ useMascot: () => mockMascot }));
jest.mock('@/features/mascot', () => ({ MascotFigure: () => null }));
jest.mock('@/features/mascot/components/MascotArt', () => {
  const ReactLocal = jest.requireActual<typeof import('react')>('react');
  return { CosmeticIcon: (props: object) => ReactLocal.createElement('cosmetic-icon', props) };
});
jest.mock('@/features/mascot/components/Wardrobe', () => {
  const ReactLocal = jest.requireActual<typeof import('react')>('react');
  return { Wardrobe: (props: object) => ReactLocal.createElement('wardrobe', props) };
});
jest.mock('@/features/profile', () => ({ ProfileOverlay: () => null }));
jest.mock('@/ui', () => {
  const ReactLocal = jest.requireActual<typeof import('react')>('react');
  const component = (name: string) => ({ children, ...props }: { children?: React.ReactNode }) => ReactLocal.createElement(name, props, children);
  return {
    AppText: component('app-text'), ClayCard: component('card'), GameButton: component('game-button'),
    ScreenHeader: component('header'), CheckIcon: component('check-icon'), LockIcon: component('lock-icon'),
    colors: {}, spacing: { m: 16, s: 8, xs: 4, xl: 24 },
  };
});

describe('collection slot previews', () => {
  it('shows each slot’s own availability and equipped item, not a global acquired flag', () => {
    let renderer: ReturnType<typeof create>;
    act(() => { renderer = create(<CapyScreen />); });
    const hat = renderer!.root.findAllByProps({ testID: 'capy-collection-hat' })[0];
    const skin = renderer!.root.findAllByProps({ testID: 'capy-collection-skin' })[0];
    const hatArt = hat.findAll((node) => String(node.type) === 'cosmetic-icon')[0];
    const skinArt = skin.findAll((node) => String(node.type) === 'cosmetic-icon')[0];
    expect(hatArt.props.id).toBe('hat-casquette');
    expect(hatArt.props.muted).toBe(false);
    expect(hat.findAll((node) => String(node.type) === 'check-icon')).toHaveLength(1);
    expect(skinArt.props.id).toMatch(/^skin-/);
    expect(skinArt.props.muted).toBe(true);
    expect(skin.findAll((node) => String(node.type) === 'check-icon')).toHaveLength(0);
    act(() => { hat.props.onPress(); });
    expect(renderer!.root.findAll((node) => String(node.type) === 'wardrobe')[0].props.visible).toBe(true);
    act(() => renderer!.unmount());
  });
});
