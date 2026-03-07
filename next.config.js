const nextConfig = {
  reactStrictMode: true,
  turbopack: {
    // Force the root to the project directory to ignore stray package-lock.json in home folder
    root: '.'
  }
};

module.exports = nextConfig;
