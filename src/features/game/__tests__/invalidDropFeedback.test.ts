import { playInvalidDropFeedback } from '../sound/feedback';

jest.mock('../sound/sounds', () => ({
  playSound: jest.fn(),
}));
const { playSound: mockPlaySound } = jest.requireMock('../sound/sounds') as {
  playSound: jest.Mock;
};

jest.mock('expo-haptics', () => ({
  performAndroidHapticsAsync: jest.fn(() => Promise.resolve()),
  AndroidHaptics: {
    Confirm: 'confirm',
    Drag_Start: 'drag-start',
    Gesture_End: 'gesture-end',
    Reject: 'reject',
  },
}));
const { performAndroidHapticsAsync: mockHaptics } = jest.requireMock('expo-haptics') as {
  performAndroidHapticsAsync: jest.Mock;
};

beforeEach(() => {
  mockPlaySound.mockClear();
  mockHaptics.mockClear();
});

describe('playInvalidDropFeedback', () => {
  it('даёт Reject-хаптику при включённой вибрации', () => {
    playInvalidDropFeedback({ sound: true, haptics: true });
    expect(mockHaptics).toHaveBeenCalledWith('reject');
  });

  it('молчит при выключенной вибрации', () => {
    playInvalidDropFeedback({ sound: true, haptics: false });
    expect(mockHaptics).not.toHaveBeenCalled();
  });

  it('не играет звук (для невалидного дропа нет ассета — только хаптика)', () => {
    playInvalidDropFeedback({ sound: true, haptics: true });
    expect(mockPlaySound).not.toHaveBeenCalled();
  });
});
