# Android APK / AAB

The only supported application build target is Android. Deliver APK or AAB;
do not add iOS, web exports or a separate C++ build pipeline.
Read the exact SDK documentation at https://docs.expo.dev/versions/v56.0.0/
before changing Expo integration code.

- `npm ci` installs pinned dependencies and applies patches.
- `npm run build:apk` creates a standalone ARM64 APK with local debug signing.
- `npm run build:aab` creates the store AAB using the existing release identity.
- `npm run build:aab -- --unsigned` creates an explicitly unsigned local AAB.
- Native CMake/C++ tasks required by React Native and its Android modules must
  remain; they are part of APK/AAB compilation, not extra product targets.
- Run lint, typecheck, Jest and backend tests for build/configuration changes.
- Keep generated native projects, APK/AAB files, bundles, logs and QA captures
  ignored. Do not commit credentials, service config or `.env.local`.

## Store releases

Use `.agents/skills/build-signed-aab/SKILL.md` for a signed store AAB.
Reuse `credentials/release.jks`; never generate or replace the release key.
Increment Android versionCode before each store upload. Local rebuilds of the
same source version do not consume a new store versionCode.
Verify the AAB signer against the published certificate before calling it ready
for upload. Local APK signing and an unsigned AAB are not store release signing.
PEPK is a one-time enrollment operation, not a routine build step.

## Persistent Android emulator

Follow `docs/runbooks/android-emulator.md`: one stored AVD per game, reused
across features, branches, worktrees and chats. Resolve its registered AVD and
serial before using historical QA helpers. Reuse the existing Block Blastic
instance; do not create or clone an AVD for a new feature. Keep its data unless
the test explicitly requires resetting it. Coordinate concurrent agents.
