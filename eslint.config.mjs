import typescriptEslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import path from "node:path";
import { fileURLToPath } from "node:url";
import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all
});


export default [
    {
        ignores: [
            "**/node_modules",
            "eslint.config.mjs",
        ],
    },
    ...compat.extends("plugin:@typescript-eslint/recommended"),
    {
        files: ["**/*.ts", "**/*.js"],
        plugins: {
            "@typescript-eslint": typescriptEslint,
        },
        languageOptions: {
            globals: {},
            parser: tsParser,
            ecmaVersion: "latest",
            sourceType: "module",
            parserOptions: {
                project: true,
                tsconfigRootDir: __dirname,
            },
        },
        rules: {
            "@typescript-eslint/consistent-type-imports": "error",
            "@typescript-eslint/no-explicit-any": 1,
            "@typescript-eslint/no-unsafe-declaration-merging": 1,
            "@typescript-eslint/no-unused-vars": 1,
            // Wyłączamy regułę no-require-imports
            "@typescript-eslint/no-require-imports": "off",
        },
    }
];
