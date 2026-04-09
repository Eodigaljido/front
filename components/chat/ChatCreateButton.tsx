import { CirclePlus } from "lucide-react-native";
import { TouchableOpacity } from "react-native";

export const ChatCreatingButton = () => {
  return (
    <TouchableOpacity className="p-2 rounded-full" activeOpacity={0.7}>
      <CirclePlus color="#6C6C6C" strokeWidth={2} />
    </TouchableOpacity>
  );
};
