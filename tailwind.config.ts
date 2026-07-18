import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Dunkler Tech-Look als Default, akzentuiert mit einem kräftigen Grün.
        brand: {
          DEFAULT: "#16a34a",
          fg: "#052e16",
          50: "#f0fdf4",
          600: "#16a34a",
          700: "#15803d",
        },
      },
      // Mindest-Touchgröße gemäß Spec (ausreichend große Klickflächen).
      minHeight: {
        touch: "3rem",
      },
      minWidth: {
        touch: "3rem",
      },
    },
  },
  plugins: [],
};

export default config;
