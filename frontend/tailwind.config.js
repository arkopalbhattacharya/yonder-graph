/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['JetBrains Mono', 'Fira Code', 'SF Mono', 'monospace'],
        mono: ['JetBrains Mono', 'Fira Code', 'SF Mono', 'monospace'],
        serif: ['Newsreader', 'Playfair Display', 'Lora', 'Georgia', 'Cambria', 'serif'],
      },
      colors: {
        surface: {
          light: '#F8F8F9',
          dark: '#0F0F12',
        },
        panel: {
          light: '#FFFFFF',
          dark: '#18181C',
        },
        text: {
          primary: {
            light: '#1B1B1B',
            dark: '#F5F5F7',
          },
          secondary: {
            light: '#5F5F5F',
            dark: '#9E9EA8',
          },
        },
        michaels: {
          red: {
            DEFAULT: '#CF1F2E',
            hover: '#B71825',
            active: '#9B2C2C',
            dark: '#E53E3E',
            light: '#F8D2CB',
          },
          charcoal: {
            DEFAULT: '#1B1B1B',
            950: '#0F0F12',
            900: '#18181C',
            800: '#222227',
            700: '#2D2D35',
          },
          coral: '#ED7064',
          amber: '#EBAB33',
          teal: '#009783',
          blue: '#0475BC',
        },
      },
    },
  },
  plugins: [],
};
