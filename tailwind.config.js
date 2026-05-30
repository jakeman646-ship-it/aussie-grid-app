/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: "#0A2540",
          50: "#E6EAF0",
          100: "#C0C9D8",
          200: "#8E9CB6",
          300: "#5C6F94",
          400: "#2F4773",
          500: "#0A2540",
          600: "#091F36",
          700: "#07182A",
          800: "#04111E",
          900: "#020912",
        },
        energy: {
          DEFAULT: "#22C55E",
          50: "#E8FAEF",
          100: "#C7F2D5",
          200: "#8FE5AD",
          300: "#56D784",
          400: "#22C55E",
          500: "#1BA34D",
          600: "#15803D",
          700: "#106030",
          800: "#0B4022",
          900: "#062012",
        },
      },
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
      },
      boxShadow: {
        soft: "0 1px 2px rgba(10,37,64,0.04), 0 4px 12px rgba(10,37,64,0.06)",
      },
    },
  },
  plugins: [],
};
