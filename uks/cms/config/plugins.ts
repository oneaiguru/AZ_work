export default ({ env }) => {
  const provider = env("UPLOAD_PROVIDER", "local");

  const uploadConfig =
    provider === "aws-s3"
      ? {
          provider: "aws-s3",
          providerOptions: {
            baseUrl: env("UPLOAD_BASE_URL"),
            s3Options: {
              endpoint: env("MINIO_ENDPOINT"),
              region: env("AWS_REGION", "us-east-1"),
              accessKeyId: env("MINIO_ACCESS_KEY"),
              secretAccessKey: env("MINIO_SECRET_KEY"),
              params: {
                Bucket: env("MINIO_BUCKET_PUBLIC"),
              },
              forcePathStyle: env.bool("MINIO_FORCE_PATH_STYLE", true),
              sslEnabled: env.bool("MINIO_USE_SSL", false),
            },
          },
        }
      : {};

  return {
    upload: {
      config: uploadConfig,
    },
  };
};
