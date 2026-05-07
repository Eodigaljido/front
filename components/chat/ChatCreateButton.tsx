import { RootStackParamList } from "@/App";
import { NavigationProp, useNavigation } from "@react-navigation/native";
import { Plus } from "lucide-react-native";
import { TouchableOpacity } from "react-native";

export const ChatCreatingButton = () => {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  return (
    <TouchableOpacity
      className="p-2 rounded-full"
      activeOpacity={0.7}
      onPress={() => navigation.navigate("ChatCreatingScreen")}
    >
      <Plus color="#6C6C6C" strokeWidth={2} />
    </TouchableOpacity>
  );
};
