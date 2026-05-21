/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allows this nested app to import shared source files from the repository
  // root, such as ../components/ChessBoard.
  experimental: {
    externalDir: true,
  },
};

module.exports = nextConfig;
