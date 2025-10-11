FROM nginx:1.27-alpine

RUN apk add --no-cache openssl

COPY entrypoint.d/10-generate-cert.sh /docker-entrypoint.d/10-generate-cert.sh
RUN chmod +x /docker-entrypoint.d/10-generate-cert.sh

# Copy default configuration so the image works even without bind mounts.
COPY default.conf /etc/nginx/conf.d/default.conf
