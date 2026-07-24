import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f2fbf6",
          100: "#dcf4e6",
          500: "#43a873",
          600: "#2f8f60",
          700: "#23724e",
          800: "#1d5c40",
          900: "#174b35"
        },
        mint: {
          50: "#f0fbf6",
          100: "#d8f4e8",
          500: "#4fb985",
          600: "#32946a",
          700: "#267556"
        }
      },
      boxShadow: {
        soft: "0 1px 3px rgba(23, 75, 53, 0.08), 0 12px 30px rgba(67, 168, 115, 0.10)"
      }
    }
  },
  plugins: []
};

export default config;
