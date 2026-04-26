import { useNavigation } from "@react-navigation/native";
import { Info } from "lucide-react-native";
import { TouchableOpacity, View, Text } from "react-native";

export const InfoButton = () => {
  const navigation = useNavigation();

  return (
    <TouchableOpacity
      onPress={() => navigation.goBack()}
      accessibilityRole="button"
      accessibilityLabel="정보 보기"
    >
      <View className="w-6 h-6 rounded-full justify-center items-center">
        <Info size={25} color="black" />
      </View>
    </TouchableOpacity>
  );
};
