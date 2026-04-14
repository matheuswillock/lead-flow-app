import type { Config } from "tailwindcss"

const config: Config = {
  darkMode: "class",
  theme: {
    container: { center: true, padding: "2rem", screens: { "2xl": "1400px" } },
    extend: {
      fontFamily: {
        sans: ["Poppins", "sans-serif"],
      },
    },
  },
}
export default config
