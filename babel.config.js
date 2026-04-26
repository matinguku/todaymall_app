module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    // Required for react-native-reanimated v4 + react-native-worklets.
    // Compiles `'worklet'` directives so animations run on the UI thread
    // instead of falling back to the JS thread. MUST be listed last.
    'react-native-worklets/plugin',
  ],
  env: {
    production: {
      plugins: [
        // Strip console.* calls from production bundles. The codebase has
        // ~770 console statements; without this, Hermes evaluates every
        // arg on each call (string concat, JSON.stringify, etc.).
        // `exclude: ['error', 'warn']` keeps real diagnostics intact.
        ['transform-remove-console', { exclude: ['error', 'warn'] }],
      ],
    },
  },
};
