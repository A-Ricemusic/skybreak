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
			// Existing truthiness and array iteration need a separate behavior review.
			"roblox-ts/lua-truthiness": "warn",
			"roblox-ts/no-array-pairs": "warn",
			// Valid roblox-ts 3 LuaTuple/$tuple usage; migration would alter return semantics.
			"roblox-ts/no-user-defined-lua-tuple": "off",
			// Avoid autofixes that change scheduling or tuple binding behavior.
			"roblox-ts/prefer-task-library": "off",
			"roblox-ts/misleading-lua-tuple-checks": "off",
			// Existing intentional fire-and-forget call; retain its behavior.
			"no-void": "warn",
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
			"@typescript-eslint/no-explicit-any": "warn",
			// Existing Roblox callback aliases, dynamic require, and marker interface are intentional.
			"@typescript-eslint/no-this-alias": "warn",
			"@typescript-eslint/no-require-imports": "warn",
			"@typescript-eslint/no-empty-object-type": "warn",
		},
	},
	{ ...prettier, files },
);
