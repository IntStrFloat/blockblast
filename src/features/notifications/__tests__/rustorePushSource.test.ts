declare const __dirname: string;

const fs = jest.requireActual<{ readFileSync(path: string, encoding: string): string }>('fs');

describe('RuStore push native source contract', () => {
  it('uses projectId, reports errors, and routes taps through resolvePushRoute', () => {
    const src = fs.readFileSync(`${__dirname}/../rustorePush.native.ts`, 'utf8');
    expect(src).toContain("from 'react-native-rustore-push'");
    expect(src).toContain('PUSH.projectId');
    expect(src).toContain('function reportPushError');
    expect(src).toContain('resolvePushRoute');
    expect(src).toContain('export const RuStorePushProvider');
    expect(src).toContain('requestPermission');
  });
});
