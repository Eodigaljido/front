// @ts-nocheck
import { Text, View } from "react-native";

export default function Title({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <View className="w-full px-5 mb-4">
      <Text className="text-3xl font-bold text-black">{children}</Text>
    </View>
  );
}
