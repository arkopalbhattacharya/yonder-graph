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
          light: '#FAFAFA',
          dark: '#09090B',
        },
        panel: {
          light: '#FFFFFF',
          dark: '#111114',
        },
        text: {
          primary: {
            light: '#111827',
            dark: '#EDEDED',
          },
          secondary: {
            light: '#6B7280',
            dark: '#A1A1AA',
          },
        },
      },
    },
  },
  plugins: [],
};
