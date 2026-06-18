#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
PROPERTIES_FILE="${KEYSTORE_PROPERTIES:-$ROOT_DIR/credentials/keystore.properties}"
PEPK_JAR="${PEPK_JAR:-$ROOT_DIR/pepk.jar}"
ENCRYPTION_KEY_INPUT="${1:-${PEPK_ENCRYPTION_KEY:-${PEPK_ENCRYPTION_KEY_PATH:-}}}"
OUTPUT_DIR="${2:-${PEPK_OUTPUT_DIR:-$ROOT_DIR/dist/store-key-export}}"
PEPK_OUTPUT="$OUTPUT_DIR/pepk_out.zip"
UPLOAD_CERTIFICATE="$OUTPUT_DIR/upload-certificate.pem"
MAX_STORE_FILE_BYTES=102400

usage() {
  cat <<'EOF'
Usage:
  bash scripts/export-pepk-key.sh <encryption-key-hex|public-key.pem> [output-directory]

Exports the existing release private key with pepk.jar and creates the PEM
upload certificate from the same keystore. Passwords are requested by
PEPK/keytool and are never written to the repository or command line.

Optional environment variables:
  JAVA_BIN                 Explicit Java executable
  KEYTOOL_BIN              Explicit keytool executable
  PEPK_JAR                 Path to pepk.jar
  KEYSTORE_PROPERTIES      Path to keystore.properties
  PEPK_ENCRYPTION_KEY      Store-provided 136-character hex encryption key
  PEPK_ENCRYPTION_KEY_PATH Store-provided PEM encryption public key
  PEPK_OUTPUT_DIR          Output directory
  FORCE=1                  Replace existing output files
EOF
}

fail() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}

read_property() {
  local key="$1"
  sed -n "s/^[[:space:]]*${key}[[:space:]]*=[[:space:]]*//p" "$PROPERTIES_FILE" |
    tail -n 1 |
    tr -d '\r'
}

resolve_from_android_app() {
  local configured_path="$1"
  local path_dir
  local path_name

  if [[ "$configured_path" = /* || "$configured_path" =~ ^[A-Za-z]:[\\/] ]]; then
    path_dir="$(dirname "$configured_path")"
    path_name="$(basename "$configured_path")"
  else
    path_dir="$ROOT_DIR/android/app/$(dirname "$configured_path")"
    path_name="$(basename "$configured_path")"
  fi

  (cd "$path_dir" && printf '%s/%s\n' "$(pwd -P)" "$path_name")
}

find_java() {
  if [[ -n "${JAVA_BIN:-}" ]]; then
    printf '%s\n' "$JAVA_BIN"
  elif [[ -n "${JAVA_HOME:-}" && -x "$JAVA_HOME/bin/java" ]]; then
    printf '%s\n' "$JAVA_HOME/bin/java"
  elif [[ -x "/c/Program Files/Android/Android Studio/jbr/bin/java.exe" ]]; then
    printf '%s\n' "/c/Program Files/Android/Android Studio/jbr/bin/java.exe"
  elif command -v java >/dev/null 2>&1; then
    command -v java
  else
    fail "Java was not found. Set JAVA_HOME to Android Studio JBR."
  fi
}

find_keytool() {
  local java_path="$1"
  local java_dir
  java_dir="$(dirname "$java_path")"

  if [[ -n "${KEYTOOL_BIN:-}" ]]; then
    printf '%s\n' "$KEYTOOL_BIN"
  elif [[ -x "$java_dir/keytool" ]]; then
    printf '%s\n' "$java_dir/keytool"
  elif [[ -x "$java_dir/keytool.exe" ]]; then
    printf '%s\n' "$java_dir/keytool.exe"
  elif command -v keytool >/dev/null 2>&1; then
    command -v keytool
  else
    fail "keytool was not found next to Java."
  fi
}

file_size() {
  if stat -c %s "$1" >/dev/null 2>&1; then
    stat -c %s "$1"
  else
    stat -f %z "$1"
  fi
}

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  usage
  exit 0
fi

[[ -f "$PROPERTIES_FILE" ]] || fail "Missing $PROPERTIES_FILE"
[[ -f "$PEPK_JAR" ]] || fail "Missing $PEPK_JAR"
[[ -n "$ENCRYPTION_KEY_INPUT" ]] || {
  usage
  fail "Pass the store-provided encryption public key."
}

if [[ -f "$ENCRYPTION_KEY_INPUT" ]]; then
  ENCRYPTION_MODE="pem"
elif [[ "$ENCRYPTION_KEY_INPUT" =~ ^[[:xdigit:]]{136}$ ]]; then
  ENCRYPTION_MODE="hex"
else
  fail "Encryption key must be a PEM file or a 136-character hex value."
fi

STORE_FILE="$(read_property storeFile)"
KEY_ALIAS="$(read_property keyAlias)"
[[ -n "$STORE_FILE" ]] || fail "storeFile is missing in $PROPERTIES_FILE"
[[ -n "$KEY_ALIAS" ]] || fail "keyAlias is missing in $PROPERTIES_FILE"

KEYSTORE_PATH="$(resolve_from_android_app "$STORE_FILE")"
[[ -f "$KEYSTORE_PATH" ]] || fail "Keystore not found: $KEYSTORE_PATH"

JAVA="$(find_java)"
KEYTOOL="$(find_keytool "$JAVA")"
JAVA_VERSION="$("$JAVA" -version 2>&1 | head -n 1)"
JAVA_MAJOR="$(printf '%s\n' "$JAVA_VERSION" | sed -E 's/.*version "([0-9]+)(\.([0-9]+))?.*/\1 \3/' | awk '{ print ($1 == 1 ? $2 : $1) }')"
[[ "$JAVA_MAJOR" =~ ^[0-9]+$ ]] || fail "Could not parse Java version: $JAVA_VERSION"
(( JAVA_MAJOR >= 17 )) || fail "Java 17 or newer is required. Found: $JAVA_VERSION"
printf 'Using %s\n' "$JAVA_VERSION"

if [[ "${FORCE:-0}" != "1" && ( -e "$PEPK_OUTPUT" || -e "$UPLOAD_CERTIFICATE" ) ]]; then
  fail "Output already exists. Remove it or rerun with FORCE=1."
fi

mkdir -p "$OUTPUT_DIR"
rm -f "$PEPK_OUTPUT" "$UPLOAD_CERTIFICATE"
cleanup_partial_output() {
  status=$?
  if (( status != 0 )); then
    rm -f "$PEPK_OUTPUT" "$UPLOAD_CERTIFICATE"
  fi
  exit "$status"
}
trap cleanup_partial_output EXIT

printf '\nExporting the existing app-signing key. Enter keystore/key passwords when prompted.\n'
if [[ "$ENCRYPTION_MODE" == "pem" ]]; then
  "$JAVA" -jar "$PEPK_JAR" \
    --keystore "$KEYSTORE_PATH" \
    --alias "$KEY_ALIAS" \
    --output "$PEPK_OUTPUT" \
    --rsa-aes-encryption \
    --encryption-key-path "$ENCRYPTION_KEY_INPUT" \
    --include-cert
else
  "$JAVA" -jar "$PEPK_JAR" \
    --keystore "$KEYSTORE_PATH" \
    --alias "$KEY_ALIAS" \
    --output "$PEPK_OUTPUT" \
    --encryptionkey="$ENCRYPTION_KEY_INPUT" \
    --include-cert
fi

printf '\nCreating the upload certificate. Enter the keystore password when prompted.\n'
"$KEYTOOL" -exportcert -rfc \
  -keystore "$KEYSTORE_PATH" \
  -alias "$KEY_ALIAS" \
  -file "$UPLOAD_CERTIFICATE"

for output in "$PEPK_OUTPUT" "$UPLOAD_CERTIFICATE"; do
  [[ -s "$output" ]] || fail "Output is empty: $output"
  size="$(file_size "$output")"
  (( size <= MAX_STORE_FILE_BYTES )) ||
    fail "$(basename "$output") is $size bytes; the store limit is $MAX_STORE_FILE_BYTES bytes."
done

printf '\nCreated store signing files:\n'
printf '  %s\n' "$PEPK_OUTPUT"
printf '  %s\n' "$UPLOAD_CERTIFICATE"

if command -v sha256sum >/dev/null 2>&1; then
  sha256sum "$PEPK_OUTPUT" "$UPLOAD_CERTIFICATE"
fi

trap - EXIT
