import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      // Default Tailwind colors will be used, no custom palette defined
    },
  },
  plugins: [],
};

export default config;
