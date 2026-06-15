import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#24272d',
        muted: '#727783',
        paper: '#fffefb',
        surface: '#fffefb',
        'surface-2': '#f0f4f5',
        line: '#d8dee1',
        accent: '#de6f61',
        ocean: '#216b83',
        moss: '#7c9361'
      },
      boxShadow: {
        soft: '0 12px 32px rgba(38,48,55,.08)',
        deep: '0 20px 60px rgba(38,48,55,.12)'
      },
      borderRadius: {
        panel: '10px'
      }
    }
  },
  plugins: []
};

export default config;
