import js from '@eslint/js';
import obsidian from 'eslint-plugin-obsidianmd';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// Use type information for official Obsidian rules, while linting JavaScript.
const rules = Object.assign({}, ...obsidian.configs.recommended.map(config =>
  Object.fromEntries(Object.entries(config.rules || {}).filter(([name]) => name.startsWith('obsidianmd/')))
));
export default [
  { ignores: ['dist/**', 'main.js', 'research/**', '.dev-profile/**', 'artifacts/**', 'node_modules/**'] },
  {
    files: ['src/**/*.js'],
    plugins: { obsidianmd: obsidian },
    languageOptions: { parser: tseslint.parser, parserOptions: { project: './tsconfig.json' }, ecmaVersion: 'latest', sourceType: 'commonjs', globals: { ...globals.browser, ...globals.commonjs, Plugin: 'off' } },
    rules: { ...js.configs.recommended.rules, ...rules }
  }
];
