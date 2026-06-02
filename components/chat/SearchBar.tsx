import { Search } from "lucide-react-native";
import React from "react";
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
    <View className="flex-row items-center px-2 bg-white rounded-full h-15">
      <Search size={20} strokeWidth={2} color="#6B7280" />
      <TextInput
        className="flex-1 min-w-0 ml-2 text-sm text-gray-800"
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
