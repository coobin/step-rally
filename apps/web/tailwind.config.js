/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          red: '#981a1e',
          'red-dark': '#7a1215',
          gold: '#b45309',
        }
      }
    },
  },
  plugins: [],
}
