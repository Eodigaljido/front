import { Search } from "lucide-react-native";
import { View, Text, TextInput } from "react-native";

export const SearchBar = () => {
  return (
    <View className="flex-row items-center h-15 px-2 bg-gray-200 rounded-lg">
      <Search size={20} strokeWidth={2} color="#888" />

      <TextInput
        className="ml-2 flex-1 min-w-0 text-gray-500"
        placeholder="친구, 채팅방 검색"
        numberOfLines={1}
      />
    </View>
  );
};
