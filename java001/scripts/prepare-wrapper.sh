#!/bin/sh
set -eu

# Resolve the project root so the script can be invoked from any directory and
# still place the decoded wrapper JAR where the Gradle wrapper expects it.
SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
PROJECT_ROOT=$(cd "$SCRIPT_DIR/.." && pwd)
BASE64_FILE="$PROJECT_ROOT/gradle/wrapper/gradle-wrapper.jar.base64"
TARGET_JAR="$PROJECT_ROOT/gradle/wrapper/gradle-wrapper.jar"

FORCE="false"
if [ "${1:-}" = "--force" ]; then
  FORCE="true"
fi

if [ "$FORCE" = "true" ] && [ -f "$TARGET_JAR" ]; then
  rm -f "$TARGET_JAR"
fi

if [ -f "$TARGET_JAR" ]; then
  echo "Gradle wrapper JAR already restored at $TARGET_JAR"
  exit 0
fi

if [ ! -f "$BASE64_FILE" ]; then
  echo "Base64 source $BASE64_FILE is missing" >&2
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
  if base64 --help 2>&1 | grep -q -- '--ignore-garbage'; then
    base64 --decode --ignore-garbage "$BASE64_FILE" > "$DECODE_TMP"
  else
    base64 --decode "$BASE64_FILE" > "$DECODE_TMP"
  fi
fi

mv "$DECODE_TMP" "$TARGET_JAR"
chmod 0644 "$TARGET_JAR"
echo "Gradle wrapper JAR restored to $TARGET_JAR"
