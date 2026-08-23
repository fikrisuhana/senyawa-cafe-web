import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f5f3ff",
          100: "#ede9fe",
          500: "#7c5cff",
          600: "#6d45f0",
          700: "#5b34d6",
        },
      },
    },
  },
  plugins: [],
};

export default config;
