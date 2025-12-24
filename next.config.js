/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: __dirname,
  experimental: {
    serverActions: {
      // ставим с запасом: 100 мегабайт
      bodySizeLimit: '100mb',
    },
    // allow larger multipart/form-data uploads for app routes
    middlewareClientMaxBodySize: '100mb',
  },
};

module.exports = nextConfig;
