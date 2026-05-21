// PostCSS runs Tailwind first to expand utility classes, then Autoprefixer adds
// vendor prefixes where needed for browser compatibility.
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
