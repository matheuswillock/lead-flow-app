// Vitest + Vite may attempt to load PostCSS; guard to avoid invalid plugin resolution during tests
const isVitest = process.env.VITEST
const config = {
  plugins: isVitest ? [] : ["@tailwindcss/postcss"],
};

export default config;
