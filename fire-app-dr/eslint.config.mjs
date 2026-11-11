import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    files: ["components/ui/**/*.{ts,tsx}", "hooks/use-mobile.ts"],
    rules: {
      // These files are vendored verbatim from shadcn@4.17.0. Keep the
      // registry source intact while applying the stricter rules to Site code.
      "@typescript-eslint/no-unused-vars": "off",
      "react-hooks/purity": "off",
      "react-hooks/set-state-in-effect": "off",
    },
  },
  {
    files: ["app/**/*.{ts,tsx}"],
    rules: {
      // The app displays local brand artwork and authenticated R2 customer
      // photos whose dimensions and remote loader URLs are not known at build.
      "@next/next/no-img-element": "off",
    },
  },
  {
    files: ["app/dashboard.tsx"],
    rules: {
      // This dashboard intentionally loads server data when views and dialogs
      // open. Those asynchronous effects update local UI state after fetches.
      "react-hooks/set-state-in-effect": "off",
    },
  },
]);

export default eslintConfig;
