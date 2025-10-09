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

http_address="${TRAEFIK_ENTRYPOINTS_HTTP_ADDRESS:-:80}"
https_address="${TRAEFIK_ENTRYPOINTS_HTTPS_ADDRESS:-:443}"
docker_endpoint="${TRAEFIK_PROVIDERS_DOCKER_ENDPOINT:-unix:///var/run/docker.sock}"
log_level="${TRAEFIK_LOG_LEVEL:-INFO}"
acme_storage="${TRAEFIK_CERTIFICATES_ACME_STORAGE:-/acme.json}"
acme_email="${TRAEFIK_CERTIFICATES_ACME_EMAIL:-${TRAEFIK_EMAIL:-}}"

if [ -z "$acme_email" ]; then
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

  acme_email="letsencrypt@${fallback_domain}"
  warn "TRAEFIK_CERTIFICATES_ACME_EMAIL is not set. Using fallback '${acme_email}'. Configure TRAEFIK_CERTIFICATES_ACME_EMAIL (or legacy TRAEFIK_EMAIL) with a monitored inbox to receive Let's Encrypt expiry notices."
fi

acme_dir=$(dirname "$acme_storage")
if [ ! -d "$acme_dir" ]; then
  if ! mkdir -p "$acme_dir"; then
    error "Failed to create directory '$acme_dir' for ACME storage"
    exit 1
  fi
fi
if [ ! -f "$acme_storage" ]; then
  if ! touch "$acme_storage"; then
    error "Failed to create $acme_storage"
    exit 1
  fi
fi
chmod 600 "$acme_storage" 2>/dev/null || true

challenge="${TRAEFIK_ACME_CHALLENGE:-http}"
challenge=$(printf '%s' "$challenge" | tr '[:upper:]' '[:lower:]')

set -- traefik \
  --configFile=/traefik.yml \
  --providers.docker=true \
  "--providers.docker.endpoint=${docker_endpoint}" \
  --providers.docker.exposedbydefault=false \
  "--log.level=${log_level}" \
  "--entrypoints.web.address=${http_address}" \
  --entrypoints.web.http.redirections.entrypoint.to=websecure \
  --entrypoints.web.http.redirections.entrypoint.scheme=https \
  "--entrypoints.websecure.address=${https_address}" \
  --entrypoints.websecure.http.tls=true \
  --entrypoints.websecure.http.tls.certresolver=le \
  "--certificatesresolvers.le.acme.email=${acme_email}" \
  "--certificatesresolvers.le.acme.storage=${acme_storage}"

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
