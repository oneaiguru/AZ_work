/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  experimental: {
    typedRoutes: true,
  },
  eslint: {
    dirs: ["src"],
  },
  poweredByHeader: false,
  trailingSlash: false,
};

export default nextConfig;
