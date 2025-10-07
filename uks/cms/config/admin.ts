export default ({ env }) => ({
  auth: {
    secret: env("ADMIN_JWT_SECRET"),
    sessions: {
      maxRefreshTokenLifespan: env.int(
        "ADMIN_MAX_REFRESH_TOKEN_LIFESPAN",
        60 * 60 * 24 * 7
      ),
      maxSessionLifespan: env.int(
        "ADMIN_MAX_SESSION_LIFESPAN",
        60 * 60 * 24 * 30
      ),
    },
  },
  apiToken: {
    salt: env("API_TOKEN_SALT"),
  },
  transfer: {
    token: {
      salt: env("TRANSFER_TOKEN_SALT"),
    },
  },
  secrets: {
    encryptionKey: env("ENCRYPTION_KEY"),
  },
  flags: {
    nps: env.bool("FLAG_NPS", true),
    promoteEE: env.bool("FLAG_PROMOTE_EE", true),
  },
});
