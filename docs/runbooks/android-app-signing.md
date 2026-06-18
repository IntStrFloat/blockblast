# Android app signing and PEPK

This project must preserve the signing identity of the already published app.
The canonical keystore is `credentials/release.jks`, alias `blockblast`.
Never generate a replacement release key for an update.

## One-time store enrollment

1. Copy the store encryption key or download its PEM public key.
2. Keep `pepk.jar` in the repository root. It is ignored by Git.
3. Run from Git Bash:

```bash
bash scripts/export-pepk-key.sh <encryption-key-hex-or-public-key.pem>
```

The command asks for the local keystore and key passwords. It creates:

- `dist/store-key-export/pepk_out.zip` - upload in the PEPK ZIP field.
- `dist/store-key-export/upload-certificate.pem` - upload as the upload certificate.

Both files are generated from the existing release keystore. The script rejects
missing inputs, refuses accidental overwrite, and enforces the store's 100 KB
limit. Use `FORCE=1` only when intentionally regenerating an enrollment export.

PEPK export is a one-time enrollment operation. Do not run it for every release.
Back up `credentials/release.jks` and `credentials/keystore.properties` outside
the repository before enrollment.

## Every Android release

1. Increment `expo.version`, `android.versionCode`, `package.json`, and the
   native Gradle version when `android/` is retained.
2. Run tests, lint, and typecheck.
3. Ensure `android/app/build.gradle` uses `signingConfigs.release` backed by
   `credentials/keystore.properties`.
4. Build an Android App Bundle:

```bash
export JAVA_HOME="/c/Program Files/Android/Android Studio/jbr"
export PATH="$JAVA_HOME/bin:$PATH"
cd android
./gradlew bundleRelease --rerun-tasks --console=plain
```

5. Publish `android/app/build/outputs/bundle/release/app-release.aab`.
6. Verify the bundle:

```bash
jarsigner -verify -verbose -certs \
  android/app/build/outputs/bundle/release/app-release.aab
```

Verification succeeds only when the command exits with code 0 and prints
`jar verified`. Warnings about a self-signed certificate or a missing timestamp
are expected for this local upload key.

The signer certificate must retain SHA-256 fingerprint:

```text
74:2D:E4:9B:C8:AC:57:19:FD:64:02:94:0F:A8:13:C1:
A9:8C:D8:50:B6:7F:40:5B:1D:13:DE:D7:5E:6D:20:E3
```

Do not use `assembleRelease` or upload a universal APK for a normal store
release unless the store explicitly requests an APK for a separate test track.
