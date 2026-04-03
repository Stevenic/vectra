import js from '@eslint/js';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';

export default [
    {
        ignores: ['lib/**', 'dist/**', '_ts3.4/**', 'node_modules/**', 'samples/**', 'bin/**']
    },
    js.configs.recommended,
    {
        files: ['src/**/*.ts'],
        languageOptions: {
            parser: tsParser,
            parserOptions: {
                project: './tsconfig.json',
                sourceType: 'module'
            },
            globals: {
                console: 'readonly',
                process: 'readonly',
                Buffer: 'readonly',
                __dirname: 'readonly',
                __filename: 'readonly',
                require: 'readonly',
                module: 'readonly',
                exports: 'readonly',
                setTimeout: 'readonly',
                clearTimeout: 'readonly',
                setInterval: 'readonly',
                clearInterval: 'readonly',
                URL: 'readonly',
                URLSearchParams: 'readonly',
                fetch: 'readonly',
                AbortController: 'readonly',
                Response: 'readonly',
                Headers: 'readonly',
                ReadableStream: 'readonly',
                TextDecoder: 'readonly',
                globalThis: 'readonly',
                Uint8Array: 'readonly',
                ArrayBuffer: 'readonly',
                DataView: 'readonly',
                Map: 'readonly',
                Set: 'readonly',
                WeakMap: 'readonly',
                Promise: 'readonly',
                Proxy: 'readonly',
                Symbol: 'readonly',
                BigInt: 'readonly',
                queueMicrotask: 'readonly',
                structuredClone: 'readonly',
                crypto: 'readonly',
                performance: 'readonly',
                EventTarget: 'readonly',
                Event: 'readonly',
                CustomEvent: 'readonly',
                FormData: 'readonly',
                Blob: 'readonly',
                File: 'readonly',
                FileReader: 'readonly',
                atob: 'readonly',
                btoa: 'readonly',
                Iterator: 'readonly',
                SharedArrayBuffer: 'readonly',
                Atomics: 'readonly',
                FinalizationRegistry: 'readonly',
                WeakRef: 'readonly',
            }
        },
        plugins: {
            '@typescript-eslint': tsPlugin
        },
        rules: {
            // Turn off base rules that conflict with TS
            'no-unused-vars': 'off',
            'no-undef': 'off', // TypeScript handles this
            'no-redeclare': 'off',
            'no-dupe-class-members': 'off',

            // TypeScript-specific rules
            '@typescript-eslint/no-unused-vars': ['warn', {
                argsIgnorePattern: '^_',
                varsIgnorePattern: '^_',
                caughtErrorsIgnorePattern: '^_'
            }],
            '@typescript-eslint/no-explicit-any': 'warn',
            '@typescript-eslint/no-redeclare': 'error',

            // Downgraded to warn — fix incrementally
            'no-case-declarations': 'warn',
            'preserve-caught-error': 'off',

            // General quality rules
            'no-console': 'off',
            'no-constant-condition': 'warn',
            'no-debugger': 'error',
            'no-duplicate-case': 'error',
            'no-empty': ['warn', { allowEmptyCatch: true }],
            'no-extra-boolean-cast': 'warn',
            'no-irregular-whitespace': 'warn',
            'no-unreachable': 'warn',
            'eqeqeq': ['warn', 'always', { null: 'ignore' }],
            'no-var': 'error',
            'prefer-const': ['warn', { destructuring: 'all' }]
        }
    },
    {
        files: ['src/**/*.spec.ts'],
        languageOptions: {
            globals: {
                describe: 'readonly',
                it: 'readonly',
                before: 'readonly',
                beforeEach: 'readonly',
                after: 'readonly',
                afterEach: 'readonly',
                context: 'readonly'
            }
        },
        rules: {
            // Relax rules for test files
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-unused-vars': 'off',
            'no-empty': 'off'
        }
    }
];
