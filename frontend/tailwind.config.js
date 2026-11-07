export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: { void: "#05080d", panel: "#0a1118", edge: "#13303a", neon: "#39ff88", cyan2: "#22d3ee", azure: "#3b82f6" },
      fontFamily: { mono: ['"Cascadia Mono"', "Consolas", "ui-monospace", "monospace"] },
    },
  },
  plugins: [],
};