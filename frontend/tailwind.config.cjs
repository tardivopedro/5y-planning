/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f0f4ff",
          100: "#dce4ff",
          200: "#b3c4ff",
          300: "#809cff",
          400: "#4c72ff",
          500: "#1f4bff",
          600: "#153ad6",
          700: "#102ca3",
          800: "#0b1d70",
          900: "#050f3d"
        }
      }
    }
  },
  plugins: []
};
