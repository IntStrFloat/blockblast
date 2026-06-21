// eslint-disable-next-line @typescript-eslint/no-require-imports
const plugin = require('../withRuStorePush.js') as {
  patchProjectBuildGradle(contents: string): string;
  addMessagingService(manifest: unknown): unknown;
};

const { patchProjectBuildGradle, addMessagingService } = plugin;

const ALLPROJECTS = `allprojects {
  repositories {
    google()
    mavenCentral()
  }
}
`;

type ManifestApp = {
  $: Record<string, string>;
  service?: { $: Record<string, string>; 'intent-filter': unknown[] }[];
};
const makeManifest = (): { manifest: { application: ManifestApp[] } } => ({
  manifest: { application: [{ $: { 'android:name': '.MainApplication' } }] },
});

describe('withRuStorePush config plugin', () => {
  it('adds the RuStore maven repo to allprojects.repositories', () => {
    const out = patchProjectBuildGradle(ALLPROJECTS);
    expect(out).toContain('artifactory-external.vkpartner.ru/artifactory/maven');
  });

  it('is idempotent for the maven repo', () => {
    const once = patchProjectBuildGradle(ALLPROJECTS);
    expect(patchProjectBuildGradle(once)).toBe(once);
  });

  it('throws when no allprojects.repositories block exists', () => {
    expect(() => patchProjectBuildGradle('buildscript {}')).toThrow(
      /allprojects\.repositories/,
    );
  });

  it('declares the RuStore messaging service with the messaging-event intent-filter', () => {
    const manifest = makeManifest();
    addMessagingService(manifest);
    const app = manifest.manifest.application[0];
    expect(app.service?.[0].$['android:name']).toBe(
      'ru.reactnativerustorepush.deps.MessagingService',
    );
    expect(app.service?.[0].$['android:exported']).toBe('true');
    expect(
      (app.service?.[0]['intent-filter'][0] as { action: { $: Record<string, string> }[] })
        .action[0].$['android:name'],
    ).toBe('ru.rustore.sdk.pushclient.MESSAGING_EVENT');
  });

  it('does not duplicate the service when applied twice', () => {
    const manifest = makeManifest();
    addMessagingService(manifest);
    addMessagingService(manifest);
    expect(manifest.manifest.application[0].service).toHaveLength(1);
  });
});
