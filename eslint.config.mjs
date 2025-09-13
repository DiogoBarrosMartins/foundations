import tseslint from 'typescript-eslint';
import eslint from '@eslint/js';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  // Regras base do ESLint
  eslint.configs.recommended,

  // Regras base para TypeScript
  ...tseslint.configs.recommended,

  // Integração com Prettier
  prettier,

  {
    ignores: ['dist/**', 'node_modules/**'],
  },

  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: ['./tsconfig.json'],
        tsconfigRootDir: import.meta.dirname,
        sourceType: 'module',
      },
    },
    rules: {
      // Permitir async sem await (NestJS usa muito)
      '@typescript-eslint/require-await': 'off',

      // NestJS usa muitos "any" implícitos → podemos baixar severidade
      '@typescript-eslint/no-unsafe-assignment': 'warn',
      '@typescript-eslint/no-unsafe-call': 'warn',
      '@typescript-eslint/no-unsafe-member-access': 'warn',
      '@typescript-eslint/no-unsafe-return': 'warn',

      // Consistência
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',

      // Estilo
      'prettier/prettier': 'warn',
    },
  },
);
