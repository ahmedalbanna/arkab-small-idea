// @ts-check
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import eslintConfigPrettier from "eslint-config-prettier";

export default tseslint.config(
  // Global ignores
  { ignores: ["dist/", "node_modules/", "*.js", "*.mjs", "*.cjs"] },

  // Base config for all TS/TSX files
  js.configs.recommended,
  ...tseslint.configs.recommended,

  // Main source config
  {
    files: ["src/**/*.{ts,tsx}", "server.ts"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      // React Hooks
      ...reactHooks.configs.recommended.rules,

      // React Refresh — only on src components
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],

      // Restrict console — allow the structured logger and server-side logging
      "no-console": [
        "error",
        {
          allow: ["warn", "error", "info", "debug"],
        },
      ],

      // Ban explicit `any` — warn so we can fix incrementally
      "@typescript-eslint/no-explicit-any": "warn",

      // Catch unused variables (TS already catches these, but ESLint can too)
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],

      // Enforce `import type` for type-only imports
      "@typescript-eslint/consistent-type-imports": ["error", { prefer: "type-imports" }],

      // Warn on require() instead of import
      "@typescript-eslint/no-require-imports": "error",
    },
  },

  // Allow console.log in server.ts (server-side logging)
  {
    files: ["server.ts"],
    rules: {
      "no-console": "off",
    },
  },

  // Allow direct console in ErrorBoundary (critical error reporting)
  {
    files: ["src/components/ErrorBoundary.tsx"],
    rules: {
      "no-console": "off",
    },
  },

  // The logger itself needs to call console methods
  {
    files: ["src/plugins/logger.ts"],
    rules: {
      "no-console": "off",
    },
  },

  // Test files — relaxed rules
  {
    files: ["src/test/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/consistent-type-imports": "off",
      "react-refresh/only-export-components": "off",
      "react-hooks/globals": "off",
      "no-console": "off",
      "no-empty": "off",
      "no-useless-assignment": "off",
    },
  },

  // Prettier compatibility (must be last)
  eslintConfigPrettier,
);
