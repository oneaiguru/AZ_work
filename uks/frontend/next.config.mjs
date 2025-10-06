/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  eslint: {
    dirs: ["src"],
  },
  poweredByHeader: false,
  trailingSlash: false,
};

export default nextConfig;
