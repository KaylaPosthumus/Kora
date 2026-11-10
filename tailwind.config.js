/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        /**
         * Kora's palette. Replaces Coriander's corigreen / sakura / warmstone.
         *
         * `korablue` carries every action; `saffron` is an accent for attention
         * and nothing else — it is bright enough to fight the blue if it is used
         * for anything routine. The ramps keep the same step names, so a class
         * only changes its prefix.
         */
        korablue: {
          50: "#F2F7FC",
          100: "#DBE9F7",
          200: "#BCD5F0",
          300: "#92BAE5",
          400: "#5E97D4",
          // 5.4:1 against white — the lightest step that holds white button text.
          500: "#2C6FB5",
          600: "#22588F",
          700: "#1A426C",
          800: "#122C48",
          900: "#0A1826",
        },
        saffron: {
          50: "#FFFAF0",
          100: "#FDEFD3",
          200: "#FBE0AC",
          300: "#F8CC78",
          400: "#F5B546",
          // Takes dark text only. White on this is 2.1:1 and fails outright.
          500: "#F09D1C",
          600: "#C87D13",
          700: "#9A5F0F",
          800: "#6B420B",
          900: "#3D2606",
        },
        korastone: {
          50: "#FDFDFC",
          // The page ground. Near-white and near-neutral: the old warmstone was
          // a beige built for a green brand and went muddy under blue.
          100: "#FAFAF9",
          200: "#F4F4F2",
          // Held darker than the ground would suggest, because at this lightness
          // the border is what separates a white card from what is behind it.
          300: "#E8E8E4",
          400: "#DEDEDA",
          500: "#CBCBC6",
          600: "#9C9C97",
          700: "#73736E",
          800: "#4E4E4A",
          900: "#2B2B28",
          950: "#1C1C1A",
          1000: "#121211",
        },
      },
      fontFamily: {
        sans: ["Inter", "sans-serif"],
      },
    },
  },
  plugins: [],
};
