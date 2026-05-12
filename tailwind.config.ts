import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "SF Pro Text",
          "SF Pro Display",
          "system-ui",
          "Segoe UI",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
      },
      colors: {
        // Bedrijf-accents: gedempt, professioneel (lijkt op SF system colors)
        bb: {
          primary: "#0A84FF",   // SF Blue
          soft:    "#E8F2FF",
          softDark:"#0A2540",
          ink:     "#0B5FBF",
        },
        sl: {
          primary: "#30B26F",   // gedempt groen
          soft:    "#E6F6EE",
          softDark:"#0F2A1A",
          ink:     "#1F7A4E",
        },
        kl: {
          primary: "#E07A1F",   // warm oranje, niet neon
          soft:    "#FBEEDD",
          softDark:"#2A1A0C",
          ink:     "#9A4F12",
        },
      },
      boxShadow: {
        // Apple-stijl: zacht, geen glow
        card:    "0 1px 2px 0 rgba(15,23,42,0.04)",
        elev:    "0 4px 12px -4px rgba(15,23,42,0.10), 0 2px 4px -2px rgba(15,23,42,0.06)",
        // Donker variants
        "card-dark": "0 1px 2px 0 rgba(0,0,0,0.4)",
        "elev-dark": "0 4px 12px -4px rgba(0,0,0,0.5), 0 2px 4px -2px rgba(0,0,0,0.4)",
      },
      borderRadius: {
        // Apple gebruikt vaak 10/12/16/20px continuous corners
        "apple-sm": "10px",
        "apple":    "14px",
        "apple-lg": "20px",
      },
      fontSize: {
        // SF Pro-stijl hierarchie (in rem, dichtbij Apple HIG)
        "hero":    ["2.125rem", { lineHeight: "1.15", letterSpacing: "-0.022em", fontWeight: "600" }],
        "h1":      ["1.5rem",   { lineHeight: "1.2",  letterSpacing: "-0.019em", fontWeight: "600" }],
        "h2":      ["1.125rem", { lineHeight: "1.3",  letterSpacing: "-0.014em", fontWeight: "600" }],
        "body":    ["0.9375rem",{ lineHeight: "1.45", letterSpacing: "-0.005em" }],
        "footnote":["0.8125rem",{ lineHeight: "1.4",  letterSpacing: "0" }],
        "caption": ["0.6875rem",{ lineHeight: "1.4",  letterSpacing: "0.02em" }],
      },
    },
  },
  plugins: [],
};

export default config;
