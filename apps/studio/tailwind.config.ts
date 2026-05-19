import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#ffffff",
          muted: "#7d8187",
        },
      },
    },
  },
  plugins: [],
};

export default config;
