// Ontwerpbasis van ScootNav: kleuren uit het logo, twee lettertypes en zachte schaduwen
export default {
  content: ['./index.html', './src/**/*.jsx'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Inter Variable"', 'Inter', 'system-ui', 'sans-serif'],
        display: ['"Plus Jakarta Sans Variable"', '"Inter Variable"', 'system-ui', 'sans-serif']
      },
      colors: {
        // Hoofdkleur: het blauw van het logo
        brand: {
          50: '#eef4ff', 100: '#dbe6fe', 200: '#bfd3fe', 300: '#93b4fd', 400: '#6090fa',
          500: '#3b6ef6', 600: '#2554eb', 700: '#1d43d8', 800: '#1e38af', 900: '#1e348a', 950: '#172154'
        },
        // Achtergrond met een vleugje blauw
        canvas: '#f2f5fa',
        ink: '#0f1b33'
      },
      boxShadow: {
        card: '0 1px 2px rgba(15, 27, 51, 0.06), 0 8px 24px -12px rgba(15, 27, 51, 0.22)',
        float: '0 4px 12px -2px rgba(15, 27, 51, 0.18), 0 2px 4px rgba(15, 27, 51, 0.08)',
        sheet: '0 -8px 30px -10px rgba(15, 27, 51, 0.25)',
        glow: '0 10px 30px -10px rgba(37, 84, 235, 0.65)'
      }
    }
  },
  plugins: []
};
