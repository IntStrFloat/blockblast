import { AppMetricaTransport } from '../transport.native';

function createSdk() {
  return {
    activate: jest.fn(),
    reportEvent: jest.fn(),
    sendEventsBuffer: jest.fn(),
    setDataSendingEnabled: jest.fn(),
  };
}

describe('AppMetricaTransport', () => {
  it('activates the official SDK once and forwards events and buffer flushes', () => {
    const sdk = createSdk();
    const transport = new AppMetricaTransport({
      sdk,
      getApiKey: () => '00000000-0000-4000-8000-000000000001',
      dev: false,
    });

    transport.initialize({ enabled: true });
    transport.initialize({ enabled: true });
    transport.reportEvent('play_tapped', { source: 'home' });
    transport.sendEventsBuffer();

    expect(sdk.activate).toHaveBeenCalledTimes(1);
    expect(sdk.activate).toHaveBeenCalledWith({
      apiKey: '00000000-0000-4000-8000-000000000001',
      statisticsSending: true,
      logs: false,
    });
    expect(sdk.reportEvent).toHaveBeenCalledWith('play_tapped', { source: 'home' });
    expect(sdk.sendEventsBuffer).toHaveBeenCalledTimes(1);
  });

  it('applies opt-out before activation and supports opt-in without restart', () => {
    const sdk = createSdk();
    const transport = new AppMetricaTransport({
      sdk,
      getApiKey: () => '00000000-0000-4000-8000-000000000001',
      dev: false,
    });

    transport.initialize({ enabled: false });
    expect(sdk.activate).toHaveBeenCalledWith(
      expect.objectContaining({ statisticsSending: false }),
    );
    expect(() => transport.reportEvent('blocked', {})).toThrow('not ready');

    transport.setDataSendingEnabled(true);
    transport.reportEvent('enabled', {});

    expect(sdk.setDataSendingEnabled).toHaveBeenCalledWith(true);
    expect(sdk.reportEvent).toHaveBeenCalledWith('enabled', {});
  });
});
