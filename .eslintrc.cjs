module.exports = {
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended',
    'next/core-web-vitals',
  ],
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'react'],
  root: true,
  env: {
    node: true,
    browser: true,
    es6: true,
    jest: true,
  },
  settings: {
    react: {
      version: 'detect',
    },
  },
  rules: {
    // Add any custom rules here
  },
};
