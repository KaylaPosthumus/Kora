/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        corigreen: {
          50: "#F9FBF7",
          100: "#E1E9D8",
          200: "#CCD9BC",
          300: "#B5C89F",
          400: "#9FB881",
          500: "#88A764",
          600: "#6D8650",
          700: "#52643C",
          800: "#364328",
          900: "#1B2114",
        },
        sakura: {
          50: "#FEFBFD",
          100: "#FCEDF6",
          200: "#FAE0EF",
          300: "#F8D3E7",
          400: "#F6C5E0",
          500: "#F4B8D9",
          600: "#C393AE",
          700: "#926E82",
          800: "#624A57",
          900: "#31252B",
        },
        warmstone: {
          50: "#FEFDFD",
          100: "#F9F7F4",
          200: "#F5F1ED",
          300: "#F1EBE4",
          400: "#ECE5DC",
          500: "#E8DFD4",
          600: "#BAB2AA",
          700: "#8B867F",
          800: "#5D5955",
          900: "#322706",
          950: "#201800",
          1000: "#150E00",
        },
      },
      fontFamily: {
        sans: ["Inter", "sans-serif"],
      },
    },
  },
  plugins: [],
};
