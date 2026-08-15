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
    // Platform code stays free of framer-motion: the dep is confined to the
    // legacy auction UI (slated for retirement) and the platform animates with
    // CSS/Tailwind. This boundary lets the dependency die with the legacy code
    // instead of leaking into new surfaces (2026-08 audit C10).
    files: [
      "src/components/platform/**",
      "src/lib/platform/**",
      "src/app/discover/**",
      "src/app/club/**",
      "src/app/tournaments/**",
      "src/app/player/**",
      "src/app/home/**",
      "src/app/start/**",
      "src/app/notifications/**",
      "src/app/embed/**",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "framer-motion",
              message:
                "Platform surfaces animate with CSS/Tailwind; framer-motion is legacy-auction-only (audit C10).",
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
