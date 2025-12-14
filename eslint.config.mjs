// import tseslint from "@typescript-eslint/eslint-plugin"
// import tsparser from "@typescript-eslint/parser"
// import nextConfig from "eslint-config-next"

// export default [
//   ...nextConfig,

//   {
//     ignores: ["node_modules/**", ".next/**", "out/**", "build/**", "next-env.d.ts"],
//   },

//   {
//     files: ["**/*.ts", "**/*.tsx"],
//     languageOptions: {
//       parser: tsparser,
//       parserOptions: {
//         project: "./tsconfig.json",
//       },
//     },
//     plugins: {
//       "@typescript-eslint": tseslint,
//     },
//   },
// ]

import nextVitals from "eslint-config-next/core-web-vitals"
import nextTs from "eslint-config-next/typescript"
import { defineConfig, globalIgnores } from "eslint/config"

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
    // Ignore dialog transaction component to silence React effect state lint there
    "src/components/bridge-form/TransactionDialog.tsx",
  ]),
])

export default eslintConfig
