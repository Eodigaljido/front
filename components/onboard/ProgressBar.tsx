// @ts-nocheck
import React from "react";
import { View, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import bar_blue from "../../assets/onboard/bar_blue.png";
import bar_gray from "../../assets/onboard/bar_gray.png";

export default function ProgressBar({
  value = 1,
}: {
  value: number;
}): React.JSX.Element {
  return (
    <SafeAreaView className="bg-white" edges={["top"]}>
      <View className="flex-row items-center justify-center gap-2 py-4">
        {[1, 2, 3, 4].map((item) => (
          <Image
            key={item}
            source={item <= value ? bar_blue : bar_gray}
            className="w-15 h-8 rounded-full"
          />
        ))}
      </View>
    </SafeAreaView>
  );
}
