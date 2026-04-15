import { TouchableOpacity, Text } from "react-native";

const NextButton = ({
  disabled,
  onPress,
}: {
  disabled: boolean;
  onPress?: () => void;
}) => {
  return (
    <TouchableOpacity
      style={{ width: 150, height: 50 }}
      className={`ml-4 rounded-full items-center justify-center ${
        disabled ? "bg-gray-300" : "bg-blue-500"
      }`}
      disabled={disabled}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text className="text-white font-bold text-lg">다음</Text>
    </TouchableOpacity>
  );
};

export default NextButton;
