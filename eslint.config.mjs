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
    files: ['scripts/**/*.ts'], // ONLY lint the scripts directory
    rules: {
      'jsdoc/require-jsdoc': ['error', {
        require: {
          FunctionDeclaration: true,
          MethodDefinition: true,
          ClassDeclaration: true,
          ArrowFunctionExpression: true,
          FunctionExpression: true
        }
      }],
      'jsdoc/require-param': 'error',
      'jsdoc/require-returns': 'off',
      'jsdoc/require-description': 'error',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      'no-empty': 'off'
    }
  }
);
