import eslint from '@eslint/js';
import angular from 'angular-eslint';
import boundaries from 'eslint-plugin-boundaries';
import tseslint from 'typescript-eslint';

const appRoot = 'src/app';

const layerElements = [
  { type: 'core', pattern: `${appRoot}/core/**/*`, partialMatch: false },
  { type: 'ports', pattern: `${appRoot}/ports/**/*`, partialMatch: false },
  { type: 'adapters', pattern: `${appRoot}/adapters/**/*`, partialMatch: false },
  { type: 'state', pattern: `${appRoot}/state/**/*`, partialMatch: false },
  { type: 'input', pattern: `${appRoot}/input/**/*`, partialMatch: false },
  { type: 'features', pattern: `${appRoot}/features/**/*`, partialMatch: false },
];

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.angular/**',
      '**/coverage/**',
      '**/out-tsc/**',
      'android/**',
      'docs/contracts/**',
      'docs/reference/**',
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  ...angular.configs.tsRecommended,
  {
    files: ['**/*.ts'],
    plugins: { boundaries },
    settings: {
      'boundaries/elements': layerElements,
    },
    rules: {
      'boundaries/dependencies': [
        'error',
        {
          default: 'disallow',
          checkAllOrigins: true,
          policies: [
            { from: { element: { type: 'core' } }, allow: { to: { element: { type: 'core' } } } },
            { from: { element: { type: 'ports' } }, allow: { to: { element: { types: { anyOf: ['core', 'ports'] } } } } },
            { from: { element: { type: 'adapters' } }, allow: { to: { element: { types: { anyOf: ['core', 'ports', 'adapters'] } } } } },
            { from: { element: { type: 'state' } }, allow: { to: { element: { types: { anyOf: ['core', 'ports'] } } } } },
            { from: { element: { type: 'input' } }, allow: { to: { element: { types: { anyOf: ['core', 'state', 'input'] } } } } },
            { from: { element: { type: 'features' } }, allow: { to: { element: { types: { anyOf: ['core', 'state', 'input', 'ports', 'features'] } } } } },
            { from: { element: { type: 'ports' } }, allow: { to: { module: { origin: 'external' } } } },
            { from: { element: { type: 'adapters' } }, allow: { to: { module: { origin: 'external' } } } },
            { from: { element: { type: 'state' } }, allow: { to: { module: { origin: 'external' } } } },
            { from: { element: { type: 'input' } }, allow: { to: { module: { origin: 'external' } } } },
            { from: { element: { type: 'features' } }, allow: { to: { module: { origin: 'external' } } } },
          ],
        },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_' },
      ],
      // M10 S3: nothing is logged in production builds; src/main.ts (bootstrap failure) is the one exception below.
      'no-console': 'error',
      '@typescript-eslint/no-magic-numbers': [
        'error',
        { ignore: [0, 1, -1, 2], ignoreEnums: true, ignoreNumericLiteralTypes: true },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: 'Literal[value=/^#[0-9A-Fa-f]{3,8}$/]',
          message: 'Colors belong in src/config/tunables.ts.',
        },
      ],
      'no-restricted-globals': [
        'error',
        { name: 'window', message: 'Platform APIs belong in adapters or the composition root.' },
        { name: 'document', message: 'Platform APIs belong in adapters or the composition root.' },
        { name: 'navigator', message: 'Platform APIs belong in adapters or the composition root.' },
        { name: 'localStorage', message: 'Platform APIs belong in adapters or the composition root.' },
        { name: 'sessionStorage', message: 'Platform APIs belong in adapters or the composition root.' },
        { name: 'indexedDB', message: 'Platform APIs belong in adapters or the composition root.' },
      ],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['@capacitor/*'], message: 'Capacitor APIs belong in adapters or the composition root.' },
          ],
        },
      ],
      'no-restricted-properties': [
        'error',
        { object: 'document', property: 'fullscreenElement', message: 'Fullscreen belongs in an adapter.' },
        { object: 'document', property: 'exitFullscreen', message: 'Fullscreen belongs in an adapter.' },
        { object: 'document', property: 'requestFullscreen', message: 'Fullscreen belongs in an adapter.' },
        { object: 'window', property: 'showOpenFilePicker', message: 'File access belongs in an adapter.' },
        { object: 'window', property: 'showSaveFilePicker', message: 'File access belongs in an adapter.' },
      ],
    },
  },
  {
    files: [
      `${appRoot}/adapters/**/*.ts`,
      `${appRoot}/app.config.ts`,
      'src/main.ts',
      'capacitor.config.ts',
    ],
    rules: {
      'no-restricted-globals': 'off',
      'no-restricted-imports': 'off',
      'no-restricted-properties': 'off',
    },
  },
  {
    files: ['capacitor.config.ts'],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
  {
    files: ['src/main.ts', '**/*.spec.ts'],
    rules: { 'no-console': 'off' },
  },
  {
    files: ['src/config/**/*.ts', '**/*.spec.ts', `${appRoot}/core/fixtures/**/*.ts`],
    rules: {
      '@typescript-eslint/no-magic-numbers': 'off',
      'no-restricted-syntax': 'off',
    },
  },
  {
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      globals: {
        URL: 'readonly',
        console: 'readonly',
        process: 'readonly',
      },
    },
  },
  {
    files: [`${appRoot}/**/core/**/*.ts`],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            '../ports/**', '../adapters/**', '../state/**', '../input/**', '../features/**',
            '../../ports/**', '../../adapters/**', '../../state/**', '../../input/**', '../../features/**',
            '@angular/**', '@capacitor/**',
          ],
        },
      ],
    },
  },
  {
    files: [`${appRoot}/**/ports/**/*.ts`],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: ['../adapters/**', '../state/**', '../input/**', '../features/**', '@capacitor/**'] },
      ],
    },
  },
  {
    files: [`${appRoot}/**/state/**/*.ts`],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: ['../adapters/**', '../input/**', '../features/**', '@capacitor/**'] },
      ],
    },
  },
  {
    files: [`${appRoot}/**/input/**/*.ts`],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: ['../ports/**', '../adapters/**', '../features/**', '@capacitor/**'] },
      ],
    },
  },
  {
    files: [`${appRoot}/**/features/**/*.ts`],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: ['../adapters/**', '../../adapters/**', '@capacitor/**'] },
      ],
    },
  },
  ...angular.configs.templateRecommended.map((config) => ({
    ...config,
    files: ['**/*.html'],
  })),
);
