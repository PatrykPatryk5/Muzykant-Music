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
