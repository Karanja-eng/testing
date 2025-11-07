/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./node_modules/shadcn-ui/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        "brand-blue": "#0f4c81",
        "brand-gray": "#6b7280",
        "brand-light": "#f8fafc",
      },
    },
  },
  plugins: [],
};
