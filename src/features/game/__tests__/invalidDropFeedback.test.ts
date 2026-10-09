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
  it('sounds an occupied return and gives Reject haptics', () => {
    playInvalidDropFeedback({ sound: true, haptics: true }, 'occupied');
    expect(mockPlaySound).toHaveBeenCalledWith('drop');
    expect(mockHaptics).toHaveBeenCalledWith('reject');
  });

  it('sounds an outside-board return without rejection haptics', () => {
    playInvalidDropFeedback({ sound: true, haptics: true }, 'outside-board');
    expect(mockPlaySound).toHaveBeenCalledWith('drop');
    expect(mockHaptics).not.toHaveBeenCalled();
  });

  it('respects independently disabled sound and haptics', () => {
    playInvalidDropFeedback({ sound: false, haptics: true });
    expect(mockPlaySound).not.toHaveBeenCalled();
    expect(mockHaptics).toHaveBeenCalledWith('reject');
    mockHaptics.mockClear();
    playInvalidDropFeedback({ sound: true, haptics: false });
    expect(mockPlaySound).toHaveBeenCalledWith('drop');
    expect(mockHaptics).not.toHaveBeenCalled();
  });
});
