import type { Config } from "tailwindcss";

export default {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        mercado: {
          green: "#15803D",
          orange: "#F97316",
          ink: "#1F2937",
          soft: "#F4F7F5"
        }
      },
      borderRadius: {
        card: "1rem"
      }
    }
  },
  plugins: []
} satisfies Config;
