/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      screens: {
        'xxs': '340px',
        'xs': '363px',
        'xxl': '1320px',
      },
      colors: {
        'picto-primary': '#9929fb',
        'picto-primary-dark': '#650fa0',
        'soft-white': '#f0f1f3',
        'soft-dark': '#87909d',
      },
    },
  },
  plugins: [require("daisyui")],
  daisyui: {
    themes: ["light", "dark", "cupcake"],
  },
}
