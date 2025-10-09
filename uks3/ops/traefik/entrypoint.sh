#!/bin/sh
set -euo pipefail

ACME_FILE="/etc/traefik/acme/acme.json"
mkdir -p "$(dirname "$ACME_FILE")"
if [ ! -f "$ACME_FILE" ]; then
  touch "$ACME_FILE"
  chmod 600 "$ACME_FILE"
fi

CHALLENGE="${TRAEFIK_ACME_CHALLENGE:-http01}"
EXTRA_ARGS=""

case "$CHALLENGE" in
  http01)
    EXTRA_ARGS="--certificatesresolvers.le.acme.httpchallenge=true --certificatesresolvers.le.acme.httpchallenge.entrypoint=web"
    ;;
  tlsalpn01)
    EXTRA_ARGS="--certificatesresolvers.le.acme.tlschallenge=true"
    ;;
  dns01)
    if [ -z "${TRAEFIK_DNS_PROVIDER:-}" ]; then
      echo "TRAEFIK_DNS_PROVIDER must be set for dns01 challenge" >&2
      exit 1
    fi
    EXTRA_ARGS="--certificatesresolvers.le.acme.dnschallenge=true --certificatesresolvers.le.acme.dnschallenge.provider=${TRAEFIK_DNS_PROVIDER}"
    ;;
  *)
    echo "Unknown ACME challenge: $CHALLENGE" >&2
    exit 1
    ;;
esac

exec traefik --configFile=/etc/traefik/traefik.yml $EXTRA_ARGS "$@"
