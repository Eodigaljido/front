import React from "react";
import { View } from "react-native";
import { X } from "lucide-react-native";

export const CancelButton = () => {
  return (
    <View className="w-6 h-6 rounded-full justify-center items-center">
      <X size={16} />
    </View>
  );
};
