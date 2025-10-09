/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: true
  },
  output: 'standalone',
  eslint: {
    ignoreDuringBuilds: false
  }
};

export default nextConfig;
