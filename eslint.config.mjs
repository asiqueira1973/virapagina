import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      // Worker do PDF.js copiado do node_modules — código de terceiro, minificado.
      "public/pdf.worker.min.mjs",
      // Protótipo de design do produto, não faz parte do build.
      "Vira Pagina design/**",
    ],
  },
];

export default eslintConfig;
