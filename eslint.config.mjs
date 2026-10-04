import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/**
 * The React Compiler rules in eslint-config-next assume every module is a pure
 * React render. The WebGL layer is not: an R3F scene mutates three.js objects —
 * materials, geometries, transforms — inside `useFrame`, sixty times a second,
 * outside React entirely. That is the documented and correct R3F pattern, not an
 * accident, and it is also what the brief demands: context.txt's performance
 * rules ask for memoised geometry, refs for animation targets, and disposal on
 * unmount. A compiler that assumed render purity would fight all three.
 *
 * So `react-hooks/immutability` is switched off for the imperative layer only,
 * where its assumption is wrong. It stays on everywhere else — the DOM
 * components, the hooks and the config modules — where it is correct and does
 * real work.
 *
 * `react-hooks/set-state-in-effect` and `react-hooks/refs` are NOT disabled:
 * those caught genuine problems in this codebase and the code was fixed instead.
 */
const IMPERATIVE_RENDER_LOOP = [
  "src/components/three/**",
  "src/components/chapters/**",
  "src/shaders/**",
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: IMPERATIVE_RENDER_LOOP,
    rules: {
      "react-hooks/immutability": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;