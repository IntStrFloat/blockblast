<!-- ANDROID-AVD-POLICY:START -->
Local Android tests follow `C:/Users/Dima2/.codex/android-avd-policy/README.md` and `registry.json`: one stored working AVD per game/app; reuse or safely remove before replacement. Resolve registered name/serial before historical QA helpers.
<!-- ANDROID-AVD-POLICY:END -->

# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v56.0.0/ before writing any code.

# Android release contract

For every Android store release, use the repository skill
`.agents/skills/build-signed-aab/SKILL.md`.

- Build `bundleRelease` and deliver a signed `.aab`, not an APK.
- Reuse `credentials/release.jks`; never generate or replace the release key.
- Increment Android `versionCode` before every store upload.
- Verify the AAB signer and expected certificate fingerprint before reporting completion.
- Use `scripts/export-pepk-key.sh` only for the one-time store key enrollment.
