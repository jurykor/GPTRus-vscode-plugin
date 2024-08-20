/**@type {import('eslint').Linter.Config} */
// eslint-disable-next-line no-undef
module.exports = {
    root: true,
    env: { node: true, es2022: true, browser: true },
    parser: '@typescript-eslint/parser',
    plugins: ['@typescript-eslint'],
    extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
    rules: {
        semi: [2, 'always'],
        '@typescript-eslint/no-unused-vars': 1,
        '@typescript-eslint/no-explicit-any': 1,
        '@typescript-eslint/explicit-module-boundary-types': 1,
        '@typescript-eslint/no-non-null-assertion': 1,
    },
};
