import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // eslint-plugin-react-hooks 7.1 (con eslint-config-next 16.4) detecta más
    // casos de estas dos reglas en código que ya existía. Quedan como avisos
    // hasta que se arreglen; después hay que volver a dejarlas en "error".
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/purity": "warn",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Copias del repo que crean las sesiones de Claude Code: no son código
    // nuestro de verdad y llenaban `npm run lint` de miles de avisos.
    ".claude/**",
  ]),
]);

export default eslintConfig;
