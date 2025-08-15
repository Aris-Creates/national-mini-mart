/** @type {import('tailwindcss').Config} */
const colors = require('tailwindcss/colors');

module.exports = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Define your color palette here
        border: colors.slate[700],
        background: colors.slate[900], // Main background
        surface: colors.slate[800],    // Sidebars, headers, cards
        
        primary: {
          DEFAULT: colors.blue[500], // Main accent color for buttons, active links
          foreground: colors.blue[50], // Text on top of primary color
        },
        secondary: {
          DEFAULT: colors.slate[700], // Hover state for non-active items
          foreground: colors.slate[50],
        },
        
        // Text colors
        text: colors.slate[200], // Default text
        'muted-foreground': colors.slate[400], // Lighter, secondary text
        
        // Destructive/logout action colors
        destructive: {
          DEFAULT: colors.red[600],
          foreground: colors.red[50],
        },
      },
      borderRadius: {
        lg: `0.5rem`,
        md: `calc(0.5rem - 2px)`,
        sm: `calc(0.5rem - 4px)`,
      },
    },
  },
  plugins: [],
}