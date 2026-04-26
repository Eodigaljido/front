import { Search } from "lucide-react-native";
import { useState } from "react";
import { View, TextInput } from "react-native";

interface SearchBarProps {
  onSearch?: (query: string) => void;
}

export const SearchBar = ({ onSearch }: SearchBarProps) => {
  const [text, setText] = useState("");

  const handleSubmit = () => {
    onSearch?.(text.trim());
  };

  return (
    <View className="flex-row items-center h-15 px-2 bg-gray-100 rounded-full">
      <Search size={20} strokeWidth={2} color="#6B7280" />
      <TextInput
        className="ml-2 flex-1 min-w-0 text-sm text-gray-800"
        placeholder="채팅방 검색"
        numberOfLines={1}
        value={text}
        onChangeText={setText}
        onSubmitEditing={handleSubmit}
        returnKeyType="search"
      />
    </View>
  );
};
