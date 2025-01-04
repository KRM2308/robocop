/** @type {import('tailwindcss').Config} */
    export default {
      content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
      ],
      theme: {
        extend: {
          colors: {
            'robocop-black': '#0a0a0a',
            'robocop-silver': '#c0c0c0',
            'robocop-red': '#e60000',
            'robocop-blue': '#00a8e8',
          },
          fontFamily: {
            'robocop': ['Orbitron', 'sans-serif'],
          },
        },
      },
      plugins: [],
    }
