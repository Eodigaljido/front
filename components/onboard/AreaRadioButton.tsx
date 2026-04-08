import React from "react";
import { TouchableOpacity, Text } from "react-native";

export default function AreaRadioButton({
  label,
  value,
  onPress,
}: {
  label: string;
  value: boolean;
  onPress: () => void;
}): React.JSX.Element {
  return (
    <TouchableOpacity
      className={`flex-1 items-center justify-center rounded-full py-3 px-6 border-2 ${
        value ? "border-blue-500 bg-blue-500" : "border-gray-300 bg-gray-200"
      }`}
      onPress={onPress}
      activeOpacity={1}
    >
      <Text
        className={`text-lg font-bold text-center ${
          value ? "text-white" : "text-gray-800"
        }`}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}
