module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      // reanimated 미사용 시 false로 프리셋이 reanimated 플러그인을 넣지 않음 (네이티브 NPE 방지)
      [
        "babel-preset-expo",
        { jsxImportSource: "nativewind", reanimated: false },
      ],
      "nativewind/babel",
    ],
    plugins: ["react-native-reanimated/plugin"],
  };
};
