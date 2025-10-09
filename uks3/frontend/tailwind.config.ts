import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#0f4c81',
        accent: '#1c8cd6',
        surface: {
          DEFAULT: '#ffffff',
          muted: '#f1f5f9'
        },
        'primary-dark': '#0c3a61'
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif']
      },
      boxShadow: {
        elevation: '0 20px 45px rgba(16,43,63,0.12)',
        'elevation-strong': '0 24px 60px rgba(16,43,63,0.18)'
      },
      borderRadius: {
        xl: '24px',
        lg: '16px',
        md: '8px'
      }
    }
  },
  plugins: []
};

export default config;
