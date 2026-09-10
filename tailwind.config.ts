import type { Config } from "tailwindcss";

/** Layout only. Blueprint owns the components; Tailwind owns the grid. */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Apollo-ish control-room surfaces, tuned to Blueprint dark.
        surface: {
          0: "#0F1216",
          1: "#14181D",
          2: "#191E24",
          3: "#20262E",
          4: "#2A313A",
        },
        edge: "#2B333D",
        // BizTech brand, lifted from bt-web-v2 tailwind.config.ts
        "bt-green": { 400: "#70E442", 500: "#5CC433", 900: "#408F20" },
        "bt-red": { 300: "#FF647E", 400: "#E53E5A", 600: "#9A1E34" },
        "bt-blue": { 100: "#A2B1D5", 200: "#7282A8", 600: "#0D172C" },
      },
      fontFamily: {
        mono: ["JetBrains Mono", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
        sans: ["Satoshi", "Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
