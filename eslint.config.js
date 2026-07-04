import tseslint from '@typescript-eslint/eslint-plugin'
import tsparser from '@typescript-eslint/parser'
import jsxA11y from 'eslint-plugin-jsx-a11y'

export default [
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsparser,
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
    plugins: {
      '@typescript-eslint': tseslint,
      'jsx-a11y': jsxA11y,
    },
    rules: {
      ...jsxA11y.configs.recommended.rules,

      // NN #18 Error Handling, no empty catch
      'no-empty': ['error', { allowEmptyCatch: false }],

      // NN #11 AI Studio Lane, limit console noise
      'no-console': ['warn', { allow: ['warn', 'error'] }],

      // NN #21 TS Strictness, ban `any` in business code
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/ban-ts-comment': [
        'error',
        { 'ts-expect-error': 'allow-with-description', minimumDescriptionLength: 10 },
      ],

      // Extension-specific, CSP V3 prohibits eval
      'no-eval': 'error',
      'no-new-func': 'error',

      // unused vars are fine in _-prefixed names
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],

      // NN #24 Accessibility (SOP 64), critical rules for popup/options pages
      'jsx-a11y/alt-text': 'error',
      'jsx-a11y/anchor-is-valid': 'error',
      'jsx-a11y/click-events-have-key-events': 'error',
      'jsx-a11y/no-static-element-interactions': 'error',
      'jsx-a11y/label-has-associated-control': 'error',
    },
  },
  {
    files: ['tools/**', 'tests/**', 'scripts/**'],
    rules: {
      'no-console': 'off',
    },
  },
  {
    ignores: ['.output/**', '.wxt/**', 'node_modules/**', 'dist/**'],
  },
]
