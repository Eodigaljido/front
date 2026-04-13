import type { StorybookConfig } from '@storybook/react-native-web-vite';

const config: StorybookConfig = {
  "stories": [
    "../stories/**/*.mdx",
    "../stories/**/*.stories.@(js|jsx|mjs|ts|tsx)"
  ],
  "addons": [
    "@chromatic-com/storybook",
    "@storybook/addon-vitest",
    "@storybook/addon-a11y",
    "@storybook/addon-docs",
  ],
  "framework": "@storybook/react-native-web-vite",
  viteFinal: async (config) => {
    // Remove react-docgen-plugin to prevent conflicts with React Native
    // babel.config.js presets (babel-preset-expo, reanimated, nativewind)
    config.plugins = config.plugins?.filter(
      (p) => !(p && typeof p === 'object' && 'name' in p && (p as any).name === 'storybook:react-docgen-plugin')
    );
    return config;
  },
};
export default config;