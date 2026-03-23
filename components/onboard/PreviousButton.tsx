import { TouchableOpacity, Text } from "react-native";

interface PreviousButtonProps {
  onPress?: () => void;
}

const PreviousButton = ({ onPress }: PreviousButtonProps) => {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{ width: 150, height: 50 }}
      className="py-3 px-6"
    >
      <Text className="text-gray-800 font-bold text-lg">이전</Text>
    </TouchableOpacity>
  );
};

export default PreviousButton;
