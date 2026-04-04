import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // Legacy dark dashboard tokens (preserved)
        surface: {
          primary: "#0F1117",
          card: "#161922",
          hover: "#1C1F2E",
          raised: "#1E2130",
        },
        border: { DEFAULT: "#2A2D3E", light: "#353849" },
        label: { primary: "#F1F2F6", secondary: "#9BA1B0", muted: "#5F6578" },
        streams: "#6C9EFF",
        revenue: "#4ADE80",
        cat: {
          music: "#A78BFA",
          marketing: "#FBBF24",
          editorial: "#F472B6",
          product: "#22D3EE",
          live: "#FB7185",
        },
        // Shared design system (landing page aligned)
        cream: "#F6F1E7",
        ink: "#0E0E0E",
        paper: "#FAF7F2",
        signal: "#FF4A1C",
        electric: "#2C25FF",
        mint: "#1FBE7A",
        sun: "#FFD24C",
        blush: "#FFD3C9",
      },
      fontFamily: {
        sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"],
        display: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      letterSpacing: {
        tightest: "-0.04em",
      },
    },
  },
  plugins: [],
};
export default config;
