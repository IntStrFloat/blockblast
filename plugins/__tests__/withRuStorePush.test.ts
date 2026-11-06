// eslint-disable-next-line @typescript-eslint/no-require-imports
const plugin = require('../withRuStorePush.js') as {
  patchProjectBuildGradle(contents: string): string;
  addProjectIdMeta(manifest: unknown, projectId: string): unknown;
};

const { patchProjectBuildGradle, addProjectIdMeta } = plugin;

const ALLPROJECTS = `allprojects {
  repositories {
    google()
    mavenCentral()
  }
}
`;

const PROJECT_ID_META = 'ru.rustore.sdk.pushclient.project_id';

type ManifestApp = {
  $: Record<string, string>;
  'meta-data'?: { $: Record<string, string> }[];
};
const makeManifest = (): { manifest: { application: ManifestApp[] } } => ({
  manifest: { application: [{ $: { 'android:name': '.MainApplication' } }] },
});
const projectIdMetas = (m: { manifest: { application: ManifestApp[] } }) =>
  (m.manifest.application[0]['meta-data'] ?? []).filter(
    (item) => item.$['android:name'] === PROJECT_ID_META,
  );

describe('withRuStorePush config plugin', () => {
  it('adds the RuStore maven repo to allprojects.repositories', () => {
    const out = patchProjectBuildGradle(ALLPROJECTS);
    expect(out).toContain('nexus-external.rustore.ru/repository/maven-rustore-exposed/');
  });

  it('is idempotent for the maven repo', () => {
    const once = patchProjectBuildGradle(ALLPROJECTS);
    expect(patchProjectBuildGradle(once)).toBe(once);
  });

  it('migrates the legacy endpoint ahead of JitPack so its 401 cannot block RuStore', () => {
    const input = ALLPROJECTS.replace('mavenCentral()', `mavenCentral()
    maven { url 'https://www.jitpack.io' }
    maven { url 'https://artifactory-external.vkpartner.ru/artifactory/maven' }`);
    const output = patchProjectBuildGradle(input);
    expect(output).not.toContain('artifactory-external.vkpartner.ru');
    expect(output).toContain("includeGroup 'ru.ok.tracer'");
    expect(output.indexOf('nexus-external.vkteam.ru')).toBeLessThan(output.indexOf('jitpack.io'));
    expect(output.indexOf('nexus-external.rustore.ru')).toBeLessThan(output.indexOf('jitpack.io'));
    expect(patchProjectBuildGradle(output)).toBe(output);
  });

  it('throws when no allprojects.repositories block exists', () => {
    expect(() => patchProjectBuildGradle('buildscript {}')).toThrow(
      /allprojects\.repositories/,
    );
  });

  it('writes the project_id meta-data into the manifest', () => {
    const manifest = makeManifest();
    addProjectIdMeta(manifest, 'proj-xyz');
    const metas = projectIdMetas(manifest);
    expect(metas).toHaveLength(1);
    expect(metas[0].$['android:value']).toBe('proj-xyz');
  });

  it('upserts (no duplicate) when applied twice', () => {
    const manifest = makeManifest();
    addProjectIdMeta(manifest, 'a');
    addProjectIdMeta(manifest, 'b');
    const metas = projectIdMetas(manifest);
    expect(metas).toHaveLength(1);
    expect(metas[0].$['android:value']).toBe('b');
  });
});
