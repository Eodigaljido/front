import { useNavigation } from "@react-navigation/native";
import { ChevronLeft } from "lucide-react-native";
import { TouchableOpacity, View, Text } from "react-native";

export const BackButton = () => {
  const navigation = useNavigation();

  return (
    <TouchableOpacity
      onPress={() => navigation.goBack()}
      accessibilityRole="button"
      accessibilityLabel="뒤로 가기"
    >
      <View className="w-6 h-6 rounded-full justify-center items-center">
        <ChevronLeft size={30} color="white" />
      </View>
    </TouchableOpacity>
  );
};
