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

## Signed store AAB

Use `npm run build:aab` from the repository root. It performs Android prebuild,
applies the signing configuration, builds bundleRelease and verifies the
published certificate before copying the AAB into dist/.

Increase app.json version/versionCode and package.json/package-lock.json version
before each new store upload. A local rebuild of an existing version is not an upload.

The expected signer certificate SHA-256 is:

```text
74:2D:E4:9B:C8:AC:57:19:FD:64:02:94:0F:A8:13:C1:
A9:8C:D8:50:B6:7F:40:5B:1D:13:DE:D7:5E:6D:20:E3
```

Verify the final artifact with `jarsigner -verify` and
`keytool -printcert -jarfile`. Require successful verification and that exact
fingerprint. Self-signed certificate and timestamp warnings are expected for
this upload identity.

## Local artifacts

`npm run build:apk` produces a standalone APK with local debug signing;
`npm run build:aab -- --unsigned` produces an unsigned AAB. Neither is a signed
store update. They do not require or generate a replacement release key.
The unsigned AAB must contain no JAR signer entries. Restore the existing
credentials before creating a signed store artifact.
