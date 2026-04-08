import { TouchableOpacity, View, Text } from "react-native";

export default function RadioButton({
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
      className={`flex-row items-center mt-10 mb-2 rounded-full py-3 px-6 border-2 ${
        value ? "border-blue-500 bg-blue-500" : "border-gray-300 bg-gray-200"
      }`}
      onPress={onPress}
      activeOpacity={1}
    >
      <View className={`w-5 h-10 rounded-full`} />
      <Text
        className={`text-base font-bold ${
          value ? "text-white" : "text-gray-800"
        }`}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}
