/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          dark: '#24282b',
          gold: '#c89b3c',
          goldLight: '#ead07d',
          slate: '#343a40'
        }
      }
    },
  },
  plugins: [],
}
