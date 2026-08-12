export default {
  ignores: ["node_modules/**", "docs/**"],
  languageOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
    globals: {
      window: "readonly",
      document: "readonly",
      requestAnimationFrame: "readonly",
      URL: "readonly",
      Blob: "readonly",
      Image: "readonly",
      console: "readonly",
      setTimeout: "readonly",
      HTMLInputElement: "readonly",
      HTMLCanvasElement: "readonly",
      HTMLImageElement: "readonly",
    },
  },
  rules: {
    "no-unused-vars": [
      "error",
      { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
    ],
    "no-undef": "error",
  },
};
