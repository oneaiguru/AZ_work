#!/bin/sh
set -eu

# Resolve the script location without relying on the caller's working
# directory so we can safely operate on repository-relative paths even when
# the script is launched from somewhere else (for example inside Docker build
# steps).
SCRIPT_PATH=$0
case $SCRIPT_PATH in
  /*) ;;
  *) SCRIPT_PATH=$(pwd)/$SCRIPT_PATH ;;
esac

# "dirname" does not canonicalise the path, so resolve the absolute path to the
# directory that contains this script and, from there, the project root.
SCRIPT_DIR=$(cd "$(dirname "$SCRIPT_PATH")" && pwd -P)
PROJECT_ROOT=$(cd "$SCRIPT_DIR/.." && pwd -P)

cd "$PROJECT_ROOT"

BASE64_FILE="gradle/wrapper/gradle-wrapper.jar.base64"
TARGET_JAR="gradle/wrapper/gradle-wrapper.jar"

normalize_gradle_launcher() {
  LAUNCHER="$PROJECT_ROOT/gradlew"
  [ -f "$LAUNCHER" ] || return 0

  if command -v python3 >/dev/null 2>&1; then
    python3 - "$LAUNCHER" <<'PY'
import pathlib
import sys

path = pathlib.Path(sys.argv[1])
data = path.read_bytes()

if b"\r" not in data:
    sys.exit(0)

normalized = data.replace(b"\r\n", b"\n").replace(b"\r", b"\n")
path.write_bytes(normalized)
PY
  else
    TMP_FILE="$LAUNCHER.tmp"
    # "sed" ships with BusyBox and all of our JDK base images, so we can
    # rely on it to drop trailing carriage returns without needing extra
    # dependencies.
    sed 's/\r$//' "$LAUNCHER" > "$TMP_FILE"
    mv "$TMP_FILE" "$LAUNCHER"
  fi

  chmod 0755 "$LAUNCHER"
}

normalize_gradle_launcher

FORCE=false
if [ "${1:-}" = "--force" ]; then
  FORCE=true
fi

if [ "$FORCE" = true ] && [ -f "$TARGET_JAR" ]; then
  rm -f "$TARGET_JAR"
fi

if [ -f "$TARGET_JAR" ]; then
  echo "Gradle wrapper JAR already restored at $PROJECT_ROOT/$TARGET_JAR"
  exit 0
fi

if [ ! -f "$BASE64_FILE" ]; then
  echo "Base64 source $PROJECT_ROOT/$BASE64_FILE is missing" >&2
  exit 1
fi

DECODE_TMP="$TARGET_JAR.tmp"
cleanup() {
  rm -f "$DECODE_TMP"
}
trap cleanup EXIT

if command -v python3 >/dev/null 2>&1; then
  python3 - "$BASE64_FILE" "$DECODE_TMP" <<'PY'
import base64
import pathlib
import sys

base64_path = pathlib.Path(sys.argv[1])
target_path = pathlib.Path(sys.argv[2])

try:
    raw = base64_path.read_bytes()
    normalized = b"".join(raw.split())
    decoded = base64.b64decode(normalized, validate=True)
except Exception as exc:  # pylint: disable=broad-except
    print(f"Failed to decode {base64_path}: {exc}", file=sys.stderr)
    sys.exit(1)

target_path.write_bytes(decoded)
PY
else
  # Normalise whitespace before decoding so that we can tolerate embedded
  # newlines regardless of which base64 implementation is available.
  if base64 --help 2>&1 | grep -q -- '--ignore-garbage'; then
    tr -d '\r\n\t ' < "$BASE64_FILE" |
      base64 --decode --ignore-garbage > "$DECODE_TMP"
  elif base64 --help 2>&1 | grep -q -- '--decode'; then
    tr -d '\r\n\t ' < "$BASE64_FILE" |
      base64 --decode > "$DECODE_TMP"
  else
    tr -d '\r\n\t ' < "$BASE64_FILE" |
      base64 -d > "$DECODE_TMP"
  fi
fi

mv "$DECODE_TMP" "$TARGET_JAR"
chmod 0644 "$TARGET_JAR"
echo "Gradle wrapper JAR restored to $PROJECT_ROOT/$TARGET_JAR"
