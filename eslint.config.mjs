import { defineConfig } from 'eslint/config';
import obsidianmd from 'eslint-plugin-obsidianmd';
export default defineConfig([
  ...obsidianmd.configs.recommended,
  { ignores: ['main.js', 'node_modules/**', 'tests/**'] },
  { languageOptions: { parserOptions: { projectService: { allowDefaultProject: ['eslint.config.*'] } } } }
]);
