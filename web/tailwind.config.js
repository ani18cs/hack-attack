/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        accessible: {
          bg: '#000000',
          card: '#121212',
          border: '#333333',
          yellow: '#FFDD00',
          danger: '#FF3333',
          safe: '#00FF66',
          text: '#FFFFFF'
        }
      }
    },
  },
  plugins: [],
}
