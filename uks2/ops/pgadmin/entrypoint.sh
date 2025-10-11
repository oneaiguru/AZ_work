#!/bin/sh
set -eu

CERT_DIR=${PGADMIN_CERT_DIR:-/certs}
CERT_FILE=${PGADMIN_CERTIFICATE_FILE:-$CERT_DIR/server.crt}
KEY_FILE=${PGADMIN_KEY_FILE:-$CERT_DIR/server.key}
DOMAIN=${PGADMIN_SSL_DOMAIN:-pgadmin.localhost}
DAYS=${PGADMIN_SSL_DAYS:-365}

if [ "${PGADMIN_ENABLE_TLS:-}" = "0" ] || [ "${PGADMIN_ENABLE_TLS:-}" = "False" ]; then
  export PGADMIN_ENABLE_TLS=0
else
  mkdir -p "$CERT_DIR"
  if [ ! -f "$CERT_FILE" ] || [ ! -f "$KEY_FILE" ]; then
    echo "Generating self-signed certificate for $DOMAIN (valid ${DAYS}d)"
    openssl req -x509 -nodes -newkey rsa:4096 \
      -keyout "$KEY_FILE" -out "$CERT_FILE" \
      -days "$DAYS" -subj "/CN=$DOMAIN" >/dev/null 2>&1
  else
    echo "Using existing TLS certificate in $CERT_DIR"
  fi
  chmod 600 "$KEY_FILE"
  export PGADMIN_ENABLE_TLS=1
  export PGADMIN_CERTIFICATE_FILE="$CERT_FILE"
  export PGADMIN_KEY_FILE="$KEY_FILE"
fi

exec /entrypoint.sh "$@"
