import withNuxt from './.nuxt/eslint.config.mjs'

// .vue files are markup only: reactive state, handlers and store access belong in app/services.
const forbidden = ['ref', 'reactive', 'computed', 'watch', 'watchEffect', 'onMounted', 'storeToRefs']

export default withNuxt({
  files: ['app/**/*.vue'],
  rules: {
    'no-restricted-syntax': [
      'error',
      ...forbidden.map((name) => ({
        selector: `CallExpression[callee.name='${name}']`,
        message: `Move \`${name}\` into the component's service file (app/services/**).`,
      })),
      {
        selector: "CallExpression[callee.name=/^use.*Store$/]",
        message: 'Access stores from the service file, not the .vue file.',
      },
    ],
  },
})
