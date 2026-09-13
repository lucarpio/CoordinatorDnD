import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          '"Google Sans Flex"',
          "-apple-system",
          "BlinkMacSystemFont",
          '"Segoe UI"',
          "Roboto",
          "Helvetica",
          "Arial",
          "sans-serif",
        ],
      },
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        dnd: {
          dark: "#0b0c10",
          card: "#12141c",
          border: "#232736",
          crimson: "#e63946",
          gold: "#d4af37",
          amber: "#f59e0b",
          emerald: "#10b981",
        }
      },
    },
  },
  plugins: [],
};
export default config;
