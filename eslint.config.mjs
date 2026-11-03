import tseslint from "typescript-eslint";
import roblox from "eslint-plugin-roblox-ts";
import prettier from "eslint-config-prettier";
import globals from "globals";

const files = ["src/**/*.{ts,tsx}", "tools/**/*.ts"];

export default tseslint.config(
	{
		ignores: [
			"**/node_modules/**", "out/**", "build/**", "include/**",
			"docs/**", "assets/**", "reference/**", "patches/**",
			"src/tests/legacy/*.ts", "src/shared/VoiceCues.ts", "src/shared/VoiceBanks.ts",
			"src/shared/SoundBank.ts", "src/shared/UploadedAssetSpecs.ts",
			// Match Prettier's TypeScript-only scope, including ignoring this config.
			"**/*.{js,mjs,cjs}",
		],
	},
	...tseslint.configs.recommended.map((config) => ({ ...config, files })),
	{
		...roblox.configs.recommended,
		files: ["src/**/*.{ts,tsx}"],
		languageOptions: {
			...roblox.configs.recommended.languageOptions,
			parserOptions: { project: "./tsconfig.json", tsconfigRootDir: import.meta.dirname },
		},
		rules: {
			...roblox.configs.recommended.rules,
			// Explicit Luau presence checks and reviewed array iteration.
			"roblox-ts/lua-truthiness": "error",
			"roblox-ts/no-array-pairs": "error",
			// Valid roblox-ts 3 LuaTuple/$tuple usage; migration would alter return semantics.
			"roblox-ts/no-user-defined-lua-tuple": "off",
			// Avoid autofixes that change scheduling or tuple binding behavior.
			"roblox-ts/prefer-task-library": "off",
			"roblox-ts/misleading-lua-tuple-checks": "off",
			// Intentional discarded values require a local explanation.
			"no-void": "error",
		},
	},
	{
		files: ["tools/**/*.ts"],
		languageOptions: { globals: { ...globals.node, Bun: "readonly" } },
	},
	{
		files,
		rules: {
			// Intentional unused callback/destructuring bindings use an underscore prefix.
			"@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" }],
			"@typescript-eslint/no-explicit-any": "error",
			// Intentional exceptions require a local explanation.
			"@typescript-eslint/no-this-alias": "error",
			"@typescript-eslint/no-require-imports": "error",
			"@typescript-eslint/no-empty-object-type": "error",
		},
	},
	{ ...prettier, files },
);
