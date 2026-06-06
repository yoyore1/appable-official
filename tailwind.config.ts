import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Appable palette — driven by CSS variables (see globals.css)
        cream: "rgb(var(--cream) / <alpha-value>)",
        sand: "rgb(var(--sand) / <alpha-value>)",
        coral: {
          DEFAULT: "rgb(var(--coral) / <alpha-value>)",
          soft: "rgb(var(--coral-soft) / <alpha-value>)",
          deep: "rgb(var(--coral-deep) / <alpha-value>)",
        },
        peach: "rgb(var(--peach) / <alpha-value>)",
        charcoal: {
          DEFAULT: "rgb(var(--charcoal) / <alpha-value>)",
          soft: "rgb(var(--charcoal-soft) / <alpha-value>)",
        },
        moss: "rgb(var(--moss) / <alpha-value>)",
        warmgrey: "rgb(var(--warmgrey) / <alpha-value>)",
        line: "rgb(var(--line) / <alpha-value>)",
      },
      fontFamily: {
        // Characterful display + refined body. Loaded from Fontshare in globals.css.
        display: ['"Clash Display"', "ui-sans-serif", "sans-serif"],
        body: ['"Satoshi"', "ui-sans-serif", "sans-serif"],
      },
      borderRadius: {
        xl: "1rem",
        "2xl": "1.5rem",
        "3xl": "2rem",
        "4xl": "2.75rem",
      },
      boxShadow: {
        soft: "0 8px 30px -8px rgb(var(--charcoal) / 0.10), 0 2px 8px -4px rgb(var(--charcoal) / 0.06)",
        float: "0 20px 60px -16px rgb(var(--coral) / 0.22), 0 6px 18px -8px rgb(var(--charcoal) / 0.10)",
        lift: "0 28px 70px -18px rgb(var(--coral) / 0.30)",
        inset: "inset 0 2px 6px rgb(var(--charcoal) / 0.06)",
      },
      keyframes: {
        breathe: {
          "0%, 100%": { transform: "scale(1) translate(0,0)", opacity: "0.9" },
          "50%": { transform: "scale(1.08) translate(1%, -1%)", opacity: "1" },
        },
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(14px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "pulse-soft": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.55" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        breathe: "breathe 14s ease-in-out infinite",
        "fade-up": "fade-up 0.6s cubic-bezier(0.22, 1, 0.36, 1) both",
        "pulse-soft": "pulse-soft 2.4s ease-in-out infinite",
        shimmer: "shimmer 1.8s infinite",
      },
    },
  },
  plugins: [],
};

export default config;
