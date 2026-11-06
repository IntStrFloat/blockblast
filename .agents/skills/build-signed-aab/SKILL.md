---
name: build-signed-aab
description: Build and verify this repository's signed Android AAB for a store release using its existing published signing identity.
---

# Signed Android AAB

Read `docs/specs/08-build-release.md` and `docs/runbooks/android-app-signing.md`.
The only application artifacts are APK and AAB; native CMake/C++ tasks remain
internal Android dependencies.

For a signed store release:

1. Reuse `credentials/release.jks` and `credentials/keystore.properties`.
   Never create or replace the release key, commit credentials or print passwords.
2. Before a new store upload, increase app.json version/versionCode and align
   package.json/package-lock.json versions. Do not bump versions for a local
   rebuild when no upload is requested.
3. Run lint, typecheck, Jest and backend tests.
4. Run `npm run build:aab`. Restore real service settings when missing; do not
   weaken the signed release checks to make a store build pass.
5. Verify jarsigner succeeds and keytool reports the expected certificate:

```text
74:2D:E4:9B:C8:AC:57:19:FD:64:02:94:0F:A8:13:C1:
A9:8C:D8:50:B6:7F:40:5B:1D:13:DE:D7:5E:6D:20:E3
```

Report AAB path, package/versionCode, size, SHA-256 and signer verification.
PEPK is a one-time store enrollment step; use the signing runbook only if that
operation is requested.

If the user requests a local APK or explicitly unsigned AAB, honor that choice:
use `npm run build:apk` or `npm run build:aab -- --unsigned`. Verify and label
that artifact accurately; do not claim it is a signed store release or require
an existing release key just to test the game locally.
