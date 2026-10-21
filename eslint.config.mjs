/**
 * @file Flat ESLint configuration enforcing strict TypeScript rules and 100% JSDoc documentation coverage.
 * @module eslint.config
 */

import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import jsdoc from 'eslint-plugin-jsdoc';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  jsdoc.configs['flat/recommended-typescript-error'],
  {
    plugins: {
      jsdoc,
    },
    files: ['scripts/**/*.ts', 'e2e/**/*.ts', 'vitest.config.ts'],
    rules: {
      'jsdoc/require-file-overview': 'error',
      'jsdoc/require-jsdoc': [
        'error',
        {
          publicOnly: false,
          require: {
            FunctionDeclaration: true,
            MethodDefinition: true,
            ClassDeclaration: true,
            ClassExpression: true,
            ArrowFunctionExpression: false,
            FunctionExpression: false,
          },
          contexts: [
            'TSInterfaceDeclaration',
            'TSTypeAliasDeclaration',
            'TSEnumDeclaration',
            'PropertyDefinition',
            'TSPropertySignature',
            'ExportNamedDeclaration:has(VariableDeclaration)',
          ],
        },
      ],
      'jsdoc/require-param': 'error',
      'jsdoc/require-param-description': 'error',
      'jsdoc/require-param-type': 'off',
      'jsdoc/require-returns': 'error',
      'jsdoc/require-returns-description': 'error',
      'jsdoc/require-returns-type': 'off',
      'jsdoc/require-description': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-empty': 'error',
    },
  },
);
