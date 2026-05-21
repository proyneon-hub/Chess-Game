// Avoid requiring tailwindcss types to prevent TS2307 in environments
// where the package or its types are not installed.
type Config = Record<string, any>;

// Tailwind scans only the app, component, and legacy pages folders so unused
// utility classes can be removed from the production CSS bundle.
const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};

export default config;
