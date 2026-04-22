const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const { withStorybook } = require("@storybook/react-native/metro/withStorybook");

const config = getDefaultConfig(__dirname);

const nativeWindConfig = withNativeWind(config, { input: "./global.css" });

module.exports = withStorybook(nativeWindConfig, {
  // When false, removes Storybook from bundle (useful for production)
  enabled: process.env.EXPO_PUBLIC_STORYBOOK_ENABLED === "true",

  // Path to your storybook config (default: './.rnstorybook')
  configPath: "./.rnstorybook",
});
