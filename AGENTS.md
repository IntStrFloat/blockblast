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
