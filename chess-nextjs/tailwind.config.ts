import type { Config } from "tailwindcss";

// This nested app scans its own app directory plus the shared root components
// folder where the ChessBoard component lives.
const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "../components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};

export default config;
