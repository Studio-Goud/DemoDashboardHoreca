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
          primary: "#C8963E",
          dark: "#1a0f00",
          light: "#FFF8F0",
        },
        sl: {
          primary: "#E63946",
          dark: "#1a0005",
          light: "#FFF0F1",
        },
      },
    },
  },
  plugins: [],
};

export default config;
