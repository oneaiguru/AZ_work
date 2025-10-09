#!/bin/sh

error() {
  echo "$*" >&2
  exit 1
}

if [ -z "${TRAEFIK_EMAIL:-}" ]; then
  error "TRAEFIK_EMAIL must be set for ACME registration."
fi

if [ ! -f /acme.json ]; then
  touch /acme.json || error "Failed to create /acme.json"
fi
chmod 600 /acme.json 2>/dev/null || true

challenge="${TRAEFIK_ACME_CHALLENGE:-http}"
challenge=$(printf '%s' "$challenge" | tr '[:upper:]' '[:lower:]')

set -- traefik \
  --providers.docker=true \
  --providers.docker.exposedbydefault=false \
  --entrypoints.web.address=:80 \
  --entrypoints.websecure.address=:443 \
  --certificatesresolvers.le.acme.email="${TRAEFIK_EMAIL}" \
  --certificatesresolvers.le.acme.storage=/acme.json

case "$challenge" in
  http)
    set -- "$@" \
      --certificatesresolvers.le.acme.httpchallenge=true \
      --certificatesresolvers.le.acme.httpchallenge.entrypoint=web
    ;;
  tls)
    set -- "$@" \
      --certificatesresolvers.le.acme.tlschallenge=true
    ;;
  dns)
    if [ -z "${TRAEFIK_DNS_PROVIDER:-}" ]; then
      error "TRAEFIK_DNS_PROVIDER must be set when TRAEFIK_ACME_CHALLENGE=dns."
    fi
    set -- "$@" \
      --certificatesresolvers.le.acme.dnschallenge=true \
      --certificatesresolvers.le.acme.dnschallenge.provider="${TRAEFIK_DNS_PROVIDER}"
    if [ -n "${TRAEFIK_DNS_PROPAGATION_TIMEOUT:-}" ]; then
      set -- "$@" "--certificatesresolvers.le.acme.dnschallenge.delaybeforecheck=${TRAEFIK_DNS_PROPAGATION_TIMEOUT}"
    fi
    if [ -n "${TRAEFIK_DNS_RESOLVERS:-}" ]; then
      set -- "$@" "--certificatesresolvers.le.acme.dnschallenge.resolvers=${TRAEFIK_DNS_RESOLVERS}"
    fi
    if [ "${TRAEFIK_DNS_DISABLE_PROPAGATION_CHECK:-false}" = "true" ]; then
      set -- "$@" --certificatesresolvers.le.acme.dnschallenge.disablePropagationCheck=true
    fi
    ;;
  *)
    error "Unknown TRAEFIK_ACME_CHALLENGE '$challenge'. Expected http, tls, or dns."
    ;;
esac

if [ -n "${TRAEFIK_ACME_CA_SERVER:-}" ]; then
  set -- "$@" "--certificatesresolvers.le.acme.caserver=${TRAEFIK_ACME_CA_SERVER}"
fi

if [ -n "${TRAEFIK_EXTRA_ACME_ARGS:-}" ]; then
  for arg in ${TRAEFIK_EXTRA_ACME_ARGS:-}; do
    set -- "$@" "$arg"
  done
fi

if [ -n "${TRAEFIK_EXTRA_ARGS:-}" ]; then
  for arg in ${TRAEFIK_EXTRA_ARGS:-}; do
    set -- "$@" "$arg"
  done
fi

exec "$@"
