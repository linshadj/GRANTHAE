import security from "eslint-plugin-security";

export default [
  {
    ignores: [
      "node_modules/**",
      "public/css/**",
    ],
  },
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        Buffer: "readonly",
        clearTimeout: "readonly",
        console: "readonly",
        fetch: "readonly",
        process: "readonly",
        setTimeout: "readonly",
        URLSearchParams: "readonly",
      },
    },
    plugins: {
      security,
    },
    rules: {
      "security/detect-bidi-characters": "error",
      "security/detect-eval-with-expression": "error",
      "security/detect-new-buffer": "error",
      "security/detect-non-literal-regexp": "error",
      "security/detect-pseudoRandomBytes": "error",
      "security/detect-unsafe-regex": "error",
    },
  },
];
