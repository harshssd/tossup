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
    // framer-motion is restricted EVERYWHERE by default so new (platform)
    // surfaces are protected without enumeration; the legacy auction dirs below
    // carve themselves out until they retire (2026-08 audit C10 + review).
    files: ["src/**"],
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
  {
    // Legacy auction world — allowed until retirement.
    files: [
      "src/app/auction/**",
      "src/app/auctions/**",
      "src/app/captain/**",
      "src/app/bid/**",
      "src/app/live/**",
      "src/app/auth/**",
      "src/app/leagues/**",
      "src/components/auction/**",
      "src/components/live/**",
      "src/components/teams/**",
      "src/components/events/**",
      "src/components/leagues/**",
      "src/components/PageTransition.tsx",
    ],
    rules: { "no-restricted-imports": "off" },
  },
]);

export default eslintConfig;
