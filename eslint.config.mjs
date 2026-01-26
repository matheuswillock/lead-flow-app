// Flat ESLint config (ESLint v9+) replacing legacy `extends: ['next', ...]`.
// Erro anterior: "Failed to load config 'next' to extend from." causado pela
// tentativa de resolver configs legacy via FlatCompat. Agora definimos regras
// explicitamente a partir dos plugins modernos.

import nextPlugin from '@next/eslint-plugin-next'
import tseslint from 'typescript-eslint'

export default [
  // Regras base TypeScript (sem type-aware para manter velocidade)
  ...tseslint.configs.recommended,
  // Plugin Next declarado também no escopo raiz para ferramentas que verificam presença
  {
    name: 'next-plugin-root-declaration',
    plugins: { '@next/next': nextPlugin },
  },
  // Configurações do Next (recommended + core-web-vitals)
  {
    name: 'next-and-core-web-vitals',
    files: ['**/*.{ts,tsx,js,jsx}'],
    plugins: {
      '@next/next': nextPlugin,
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,
      // Customizações do projeto
      'react/no-unescaped-entities': 'off',
      '@next/next/no-page-custom-font': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      'react-hooks/exhaustive-deps': 'off',
      '@next/next/no-img-element': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { 
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_'
      }],
      'no-console': ['error', { allow: ['error', 'warn', 'info'] }],
    },
  },
  // Override para arquivo gerado pelo Next
  {
    name: 'next-env-override',
    files: ['next-env.d.ts'],
    rules: {
      '@typescript-eslint/triple-slash-reference': 'off',
    },
  },
  // Ignora arquivos de build/gerados
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      'dist/**',
      'coverage/**',
    ],
  },
]