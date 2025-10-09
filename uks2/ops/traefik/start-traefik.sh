#!/bin/sh

error() {
  echo "$*" >&2
}

warn() {
  error "Warning: $*"
}

strip_protocol() {
  value=$1
  value=${value#*://}
  value=${value%%/*}
  case "$value" in
    *:*)
      case "$value" in
        \[*\]*)
          : # IPv6 адрес в квадратных скобках — оставляем как есть
          ;;
        *)
          value=${value%%:*}
          ;;
      esac
      ;;
  esac
  echo "$value"
}

if [ -z "${TRAEFIK_EMAIL:-}" ]; then
  fallback_domain=""
  for candidate in "${TRAEFIK_SITE_DOMAIN:-}" "${TRAEFIK_CMS_DOMAIN:-}"; do
    if [ -n "$candidate" ]; then
      fallback_domain=$(strip_protocol "$candidate")
      break
    fi
  done

  if [ -z "$fallback_domain" ]; then
    fallback_domain=example.com
  fi

  TRAEFIK_EMAIL="letsencrypt@${fallback_domain}"
  warn "TRAEFIK_EMAIL is not set. Using fallback '${TRAEFIK_EMAIL}'. Configure TRAEFIK_EMAIL with a monitored inbox to receive Let's Encrypt expiry notices."
fi

if [ ! -f /acme.json ]; then
  if ! touch /acme.json; then
    error "Failed to create /acme.json"
    exit 1
  fi
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
      --certificatesresolvers.le.acme.httpchallenge.entrypoint=web
    ;;
  tls)
    set -- "$@" \
      --certificatesresolvers.le.acme.tlschallenge=true
    ;;
  dns)
    if [ -z "${TRAEFIK_DNS_PROVIDER:-}" ]; then
      error "TRAEFIK_DNS_PROVIDER must be set when TRAEFIK_ACME_CHALLENGE=dns."
      exit 1
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
    exit 1
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
