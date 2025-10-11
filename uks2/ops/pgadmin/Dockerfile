FROM dpage/pgadmin4:8.10

USER root
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

COPY entrypoint.sh /entrypoint-wrapper.sh
RUN chmod +x /entrypoint-wrapper.sh

USER pgadmin
ENTRYPOINT ["/entrypoint-wrapper.sh"]
CMD ["pgadmin4"]
