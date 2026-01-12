/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['pdf-to-img', 'pdfjs-dist'],
    // Disable fetch caching in development for always-fresh API data
    staleTimes: {
      dynamic: 0,
      static: 0,
    },
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Externalize pdf-to-img and pdfjs-dist to avoid webpack bundling issues
      config.externals = config.externals || [];
      config.externals.push({
        'pdf-to-img': 'commonjs pdf-to-img',
        'pdfjs-dist': 'commonjs pdfjs-dist',
        'pdfjs-dist/legacy/build/pdf.mjs': 'commonjs pdfjs-dist/legacy/build/pdf.mjs',
      });
    }
    return config;
  },
}

module.exports = nextConfig
