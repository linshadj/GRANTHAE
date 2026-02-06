/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./views/**/*.{html,js,ejs}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Outfit', 'system-ui', 'sans-serif'],
        serif: ['Playfair Display', 'Georgia', 'serif'],
        luxury: ['Marcellus', 'serif'],
      },
      colors: {
        'apple-gray': '#3a4b41',    // Background (Original Dark Green)
        'apple-dark': '#e6cfa7',    // Text (Cream)
        'apple-card': '#2c3b32',    // Card BG (Original)
        'apple-blue': '#e6cfa7',    // Accents matching text
        'apple-teal': '#e6cfa7',    // Matching Cream
        'apple-gold': '#fbbf24',    // Original Gold
        'apple-text-gray': '#d1d5db', // Muted Text
        'error-red': '#af0000'
      },
      backgroundImage: {
        'gradient-dark': 'linear-gradient(to bottom, #3a4b41, #2c3b32)',
        'mesh': 'none',
      },
      boxShadow: {
        'premium': '0 4px 24px rgba(0, 0, 0, 0.04)',
        'premium-hover': '0 8px 32px rgba(0, 0, 0, 0.08)',
        'glass': '0 8px 32px 0 rgba(31, 38, 135, 0.07)',
      },
      animation: {
        'fade-in': 'fadeIn 0.6s ease-out forwards',
        'fade-in-up': 'fadeInUp 0.8s ease-out forwards',
        'slide-in-right': 'slideInRight 0.5s ease-out forwards',
        'bounce-soft': 'bounceSoft 2s infinite',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(20px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        bounceSoft: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-5px)' },
        }
      }
    },
  },
  plugins: [],
}
