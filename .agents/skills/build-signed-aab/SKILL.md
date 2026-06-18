---
name: build-signed-aab
description: Build, sign, and verify this project's Android App Bundle releases with the existing published signing identity. Use whenever an agent is asked to build, rebuild, publish, prepare, or version an Android release, AAB, store artifact, RuStore release, or production mobile build for this repository.
---

# Build Signed AAB

Follow this workflow for every Android store release. The required artifact is
a signed AAB using the existing `credentials/release.jks`.

## Invariants

- Never create or replace the release keystore.
- Never commit `credentials/`, passwords, PEPK output, certificates, or `.env.local`.
- Increment `android.versionCode` for every store upload.
- Build `bundleRelease`; do not substitute `assembleRelease`.
- Use Android Studio JBR when the system Java is older than 17.
- Verify the final AAB before reporting success.

## Release workflow

1. Read `docs/specs/08-build-release.md` and
   `docs/runbooks/android-app-signing.md`.
2. Inspect current versions and increase:
   - `app.json` Expo version and Android `versionCode`;
   - `package.json` and root package entries in `package-lock.json`;
   - `android/app/build.gradle` when the generated native folder is retained.
3. Run `npm run lint`, `npm run typecheck`, `npx jest --runInBand`, and
   relevant backend tests.
4. If prebuild was regenerated, run `node scripts/patch-signing.js`.
5. Set `JAVA_HOME` to Android Studio JBR and run:

```bash
cd android
./gradlew bundleRelease --rerun-tasks --console=plain
```

6. Copy the resulting AAB to `dist/` with the version in its filename.
7. Verify:

```bash
jarsigner -verify -verbose -certs path/to/release.aab
keytool -printcert -jarfile path/to/release.aab
```

Require exit code 0 and `jar verified`. Self-signed certificate and timestamp
warnings are expected for this local upload key.

Confirm package/version metadata and certificate SHA-256:

```text
74:2D:E4:9B:C8:AC:57:19:FD:64:02:94:0F:A8:13:C1:
A9:8C:D8:50:B6:7F:40:5B:1D:13:DE:D7:5E:6D:20:E3
```

8. Report the absolute AAB path, `versionCode`, file size, SHA-256, signer
   fingerprint, and verification commands.

## PEPK enrollment

PEPK is a one-time store enrollment operation, not a release step. Accept
either the store's 136-character hex encryption key or a PEM public-key path:

```bash
bash scripts/export-pepk-key.sh '<store-encryption-key-hex-or-public-key.pem>'
```

Do not pass passwords as command arguments. Upload the generated ZIP and PEM
from `dist/store-key-export/pepk_out.zip` and
`dist/store-key-export/upload-certificate.pem` to the corresponding store
fields.
