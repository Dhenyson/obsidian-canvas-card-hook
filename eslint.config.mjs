import obsidian from 'eslint-plugin-obsidianmd';

export default [
  { ignores: ['dist/**', 'main.js', 'research/**', '.dev-profile/**', '.documentation-profile/**', 'artifacts/**', 'node_modules/**'] },
  ...obsidian.configs.recommended,
  { files: ['src/**/*.ts'], languageOptions: { parserOptions: { project: './tsconfig.json' } } }
];
