#!/bin/sh
set -eu
SCRIPT_DIR="$(dirname "$0")"
BASE64_FILE="$SCRIPT_DIR/../gradle/wrapper/gradle-wrapper.jar.base64"
TARGET_JAR="$SCRIPT_DIR/../gradle/wrapper/gradle-wrapper.jar"

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

base64 -d "$BASE64_FILE" > "$TARGET_JAR"
chmod 0644 "$TARGET_JAR"
echo "Gradle wrapper JAR restored to $TARGET_JAR"
