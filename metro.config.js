const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);
const nativeWindConfig = withNativeWind(config, { input: "./global.css" });

/** Storybook은 개발 시에만 로드 (EAS production에서 ERR_REQUIRE_ESM 방지) */
const storybookEnabled = process.env.EXPO_PUBLIC_STORYBOOK_ENABLED === "true";

if (storybookEnabled) {
  const { withStorybook } = require("@storybook/react-native/metro/withStorybook");
  module.exports = withStorybook(nativeWindConfig, {
    enabled: true,
    configPath: "./.rnstorybook",
  });
} else {
  module.exports = nativeWindConfig;
}
