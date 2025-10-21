const { fontFamily } = require('tailwindcss/defaultTheme'); // ← DODAJ!

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          'Segoe UI',
          'Roboto',
          '-apple-system',
          'BlinkMacSystemFont',
          ...fontFamily.sans, // ← TERAZ ZADZIAŁA
        ],
      },
    },
  },
  plugins: [],
};