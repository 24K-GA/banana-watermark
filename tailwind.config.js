/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        'hand': ['"Patrick Hand"', 'cursive'],
        'marker': ['"Kalam"', 'cursive'],
      },
      colors: {
        'banana-bg': '#fdfbf7',
        'banana-text': '#2d2d2d',
        'banana-accent': '#ff4d4d',
        'banana-accent-hover': '#ff3333',
        'banana-secondary': '#2d5da1',
        'banana-muted': '#e5e0d8',
        'banana-yellow': '#fff9c4',
      },
    },
  },
  plugins: [],
}
