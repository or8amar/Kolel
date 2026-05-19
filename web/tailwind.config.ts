import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: "#1a1f3c",
          light: "#252b52",
          pale: "#eef0f7",
        },
        gold: {
          DEFAULT: "#c9a84c",
          light: "#e8c97e",
          pale: "#fdf6e3",
        },
        cream: "#faf7f2",
        ink: {
          DEFAULT: "#1a1f3c",
          mid: "#4a5068",
          light: "#8b93b5",
        },
        line: "#e8e4dc",
        success: {
          DEFAULT: "#5a9a7a",
          pale: "#edf7f2",
        },
        danger: {
          DEFAULT: "#c46060",
          pale: "#fdf0f0",
        },
        warning: {
          DEFAULT: "#d4943a",
          pale: "#fef6ec",
        },
      },
      borderRadius: {
        ep: "16px",
        "ep-sm": "10px",
      },
      boxShadow: {
        ep: "0 2px 8px rgba(26,31,60,0.08)",
        "ep-md": "0 4px 20px rgba(26,31,60,0.14)",
        "ep-lg": "0 8px 40px rgba(26,31,60,0.20)",
      },
      maxWidth: {
        app: "480px",
      },
    },
  },
  plugins: [],
};

export default config;
