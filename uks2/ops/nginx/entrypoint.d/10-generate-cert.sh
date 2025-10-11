#!/bin/sh
set -e

CERT_DIR="${NGINX_CERT_DIR:-/etc/nginx/certs}"
CERT_PATH="${CERT_DIR}/fullchain.pem"
KEY_PATH="${CERT_DIR}/privkey.pem"
DOMAIN="${NGINX_SSL_DOMAIN:-uks2.localhost}"
DAYS="${NGINX_SSL_DAYS:-365}"

if [ -f "$CERT_PATH" ] && [ -f "$KEY_PATH" ]; then
  echo "Using existing TLS certificate for $DOMAIN"
  exit 0
fi

echo "Generating self-signed certificate for $DOMAIN (valid ${DAYS}d)"
mkdir -p "$CERT_DIR"
TMP_CNF="$(mktemp)"
cat >"$TMP_CNF" <<EOF
[req]
default_bits = 2048
distinguished_name = req_distinguished_name
req_extensions = req_ext
x509_extensions = req_ext
prompt = no

[req_distinguished_name]
CN = $DOMAIN

[req_ext]
subjectAltName = DNS:$DOMAIN
EOF

openssl req -x509 -nodes -newkey rsa:2048 \
  -days "$DAYS" \
  -keyout "$KEY_PATH" \
  -out "$CERT_PATH" \
  -config "$TMP_CNF" >/dev/null 2>&1
rm -f "$TMP_CNF"

chmod 600 "$KEY_PATH" "$CERT_PATH"
