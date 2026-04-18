import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bb: {
          primary: "#00B8FF",   // neon blauw
          soft: "#E0F4FF",
          dark: "#006FAA",
          glow: "#38D1FF",
        },
        sl: {
          primary: "#00D27A",   // neon groen
          soft: "#DAFBE9",
          dark: "#008C4F",
          glow: "#3DE79A",
        },
      },
      boxShadow: {
        "neon-bb": "0 0 0 1px rgba(0,184,255,0.35), 0 0 24px -4px rgba(0,184,255,0.45)",
        "neon-sl": "0 0 0 1px rgba(0,210,122,0.35), 0 0 24px -4px rgba(0,210,122,0.45)",
        card: "0 1px 2px 0 rgba(15,23,42,0.04), 0 1px 3px 0 rgba(15,23,42,0.06)",
      },
    },
  },
  plugins: [],
};

export default config;
