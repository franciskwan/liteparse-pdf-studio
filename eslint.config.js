import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: ["dist/**", "node_modules/**", "playwright-report/**", "test-results/**"],
  },
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      globals: {
        Blob: "readonly",
        Buffer: "readonly",
        clearInterval: "readonly",
        console: "readonly",
        document: "readonly",
        fetch: "readonly",
        File: "readonly",
        FileList: "readonly",
        FormData: "readonly",
        HTMLInputElement: "readonly",
        navigator: "readonly",
        process: "readonly",
        Response: "readonly",
        setInterval: "readonly",
        setTimeout: "readonly",
        window: "readonly",
      },
    },
  },
];
