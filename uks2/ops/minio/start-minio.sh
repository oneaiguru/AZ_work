#!/bin/sh
set -eu

DATA_ROOT="${MINIO_DATA_DIR:-/data}"

cleanup_file() {
  file_path="$1"
  if [ -f "$file_path" ]; then
    echo "[minio-prestart] Removing stale metadata: $file_path" >&2
    rm -f "$file_path"
  fi
}

cleanup_file "$DATA_ROOT/.minio.sys/buckets/.usage.json"
cleanup_file "$DATA_ROOT/.minio.sys/buckets/.bloomcycle.bin"

exec /usr/bin/docker-entrypoint.sh "$@"
