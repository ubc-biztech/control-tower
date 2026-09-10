import type { Config } from "tailwindcss";

/**
 * Same shape as bt-web-v2's config (shadcn slate base, HSL CSS variables),
 * repalettedd for Apollo: light content surfaces, BizTech navy rail.
 */
export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },

        /** The left rail. BizTech navy, from bt-web-v2's palette. */
        rail: {
          DEFAULT: "#0D172C", // bt-blue-600
          hover: "#1B253D", // bt-blue-500
          line: "#26324D", // bt-blue-400
          muted: "#7282A8", // bt-blue-200
          text: "#A2B1D5", // bt-blue-100
        },

        /** Status palette. Soft fills, readable on white. */
        status: {
          "green-bg": "#E9F6E5",
          "green-fg": "#33710F",
          "green-line": "#C2E4B4",
          "blue-bg": "#E8F1FC",
          "blue-fg": "#14539E",
          "blue-line": "#C4DAF4",
          "amber-bg": "#FCF3E1",
          "amber-fg": "#8A5300",
          "amber-line": "#EFDBAF",
          "red-bg": "#FDECEF",
          "red-fg": "#A31C33",
          "red-line": "#F4C7CE",
          "gray-bg": "#F1F3F6",
          "gray-fg": "#5F6B7C",
          "gray-line": "#DEE3EA",
        },

        "bt-green": { 400: "#70E442", 500: "#5CC433", 900: "#408F20" },
        "bt-blue": {
          0: "#BDC8E3",
          100: "#A2B1D5",
          200: "#7282A8",
          300: "#3B4866",
          400: "#26324D",
          500: "#1B253D",
          600: "#0D172C",
          700: "#0B111E",
        },
      },
      fontFamily: {
        sans: ["Urbanist", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "SFMono-Regular", "Menlo", "monospace"],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 3px)",
      },
      keyframes: {
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        "slide-in-right": {
          from: { transform: "translateX(100%)" },
          to: { transform: "translateX(0)" },
        },
        "slide-up": {
          from: { transform: "translateY(6px)", opacity: "0" },
          to: { transform: "translateY(0)", opacity: "1" },
        },
      },
      animation: {
        "fade-in": "fade-in 150ms ease-out",
        "slide-in-right": "slide-in-right 220ms cubic-bezier(0.32,0.72,0,1)",
        "slide-up": "slide-up 160ms ease-out",
      },
    },
  },
  plugins: [],
} satisfies Config;
