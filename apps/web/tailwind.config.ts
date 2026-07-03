import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: "#b91c1c", dark: "#7f1d1d" },
      },
    },
  },
  plugins: [],
} satisfies Config;
