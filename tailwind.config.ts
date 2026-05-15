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
        // Year-6000 layer: display font (Space Grotesk) en mono (JetBrains).
        // Geladen via next/font in app/layout.tsx als CSS-variabelen.
        display: [
          "var(--font-display)",
          "-apple-system",
          "BlinkMacSystemFont",
          "system-ui",
          "sans-serif",
        ],
        mono: [
          "var(--font-mono)",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Monaco",
          "monospace",
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
        // Sci-fi layer — alle waardes mappen naar CSS-vars in globals.css
        // zodat theme-toggle in toekomst makkelijk is. Gebruik als
        // `bg-sf-bg`, `text-sf-accent`, `border-sf-hairline` etc.
        sf: {
          bg:           "var(--sf-bg)",
          surface:      "var(--sf-bg-surface)",
          elevated:     "var(--sf-bg-elevated)",
          overlay:      "var(--sf-bg-overlay)",
          fg:           "var(--sf-fg)",
          "fg-muted":   "var(--sf-fg-muted)",
          "fg-dim":     "var(--sf-fg-dim)",
          accent:       "var(--sf-accent)",
          "accent-soft":"var(--sf-accent-soft)",
          "accent-2":   "var(--sf-accent-2)",
          success:      "var(--sf-success)",
          warning:      "var(--sf-warning)",
          danger:       "var(--sf-danger)",
          hairline:     "var(--sf-hairline)",
          glass:        "var(--sf-glass)",
        },
      },
      boxShadow: {
        // Apple-stijl: zacht, geen glow
        card:    "0 1px 2px 0 rgba(15,23,42,0.04)",
        elev:    "0 4px 12px -4px rgba(15,23,42,0.10), 0 2px 4px -2px rgba(15,23,42,0.06)",
        // Donker variants
        "card-dark": "0 1px 2px 0 rgba(0,0,0,0.4)",
        "elev-dark": "0 4px 12px -4px rgba(0,0,0,0.5), 0 2px 4px -2px rgba(0,0,0,0.4)",
        // Sci-fi glow effects — voor interactieve elementen + key data
        "sf-glow":         "0 0 32px var(--sf-accent-glow)",
        "sf-glow-tight":   "0 0 12px var(--sf-accent-glow)",
        "sf-glow-success": "0 0 24px rgba(0, 255, 148, 0.30)",
        "sf-glow-danger":  "0 0 24px rgba(255, 61, 92, 0.30)",
        // Inner glow voor "ingegraveerd" gevoel op cards
        "sf-inset":        "inset 0 1px 0 0 rgba(255,255,255,0.06)",
      },
      backdropBlur: {
        // Glassmorphism — verwijst naar CSS-var zodat 1 plek de waarde bepaalt
        sf:        "var(--sf-blur)",
        "sf-strong":"var(--sf-blur-strong)",
      },
      transitionTimingFunction: {
        "sf-spring":      "var(--sf-spring-stiff)",
        "sf-spring-soft": "var(--sf-spring-soft)",
        "sf-snap":        "var(--sf-ease-snap)",
      },
      transitionDuration: {
        "sf-instant":   "100ms",
        "sf-fast":      "200ms",
        "sf-base":      "300ms",
        "sf-slow":      "500ms",
        "sf-cinematic": "1200ms",
      },
      borderRadius: {
        // Apple gebruikt vaak 10/12/16/20px continuous corners
        "apple-sm": "10px",
        "apple":    "14px",
        "apple-lg": "20px",
        // Sci-fi: strakker. 0 = blueprint, 4/8/12 standaard. Geen 14/20.
        "sf-0":     "0px",
        "sf-sm":    "4px",
        "sf":       "8px",
        "sf-lg":    "12px",
      },
      fontSize: {
        // SF Pro-stijl hierarchie (in rem, dichtbij Apple HIG)
        "hero":    ["2.125rem", { lineHeight: "1.15", letterSpacing: "-0.022em", fontWeight: "600" }],
        "h1":      ["1.5rem",   { lineHeight: "1.2",  letterSpacing: "-0.019em", fontWeight: "600" }],
        "h2":      ["1.125rem", { lineHeight: "1.3",  letterSpacing: "-0.014em", fontWeight: "600" }],
        "body":    ["0.9375rem",{ lineHeight: "1.45", letterSpacing: "-0.005em" }],
        "footnote":["0.8125rem",{ lineHeight: "1.4",  letterSpacing: "0" }],
        "caption": ["0.6875rem",{ lineHeight: "1.4",  letterSpacing: "0.02em" }],
        // Sci-fi schaal — krappere tracking bij groot, ruimer bij caps.
        // Display sizes pakken het Space Grotesk font automatisch via
        // `font-display` class.
        "sf-display":  ["2.5rem",  { lineHeight: "1.05", letterSpacing: "-0.025em", fontWeight: "600" }],
        "sf-h1":       ["1.75rem", { lineHeight: "1.15", letterSpacing: "-0.020em", fontWeight: "600" }],
        "sf-h2":       ["1.375rem",{ lineHeight: "1.25", letterSpacing: "-0.015em", fontWeight: "600" }],
        "sf-h3":       ["1.125rem",{ lineHeight: "1.3",  letterSpacing: "-0.010em", fontWeight: "500" }],
        "sf-body":     ["0.9375rem",{ lineHeight: "1.5", letterSpacing: "-0.005em" }],
        "sf-small":    ["0.8125rem",{ lineHeight: "1.4", letterSpacing: "0" }],
        "sf-caps":     ["0.6875rem",{ lineHeight: "1.4", letterSpacing: "0.05em", fontWeight: "500" }],
        "sf-mono":     ["0.875rem",{ lineHeight: "1.3",  letterSpacing: "0" }],
      },
    },
  },
  plugins: [],
};

export default config;
