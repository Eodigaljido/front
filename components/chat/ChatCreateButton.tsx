import { rootNavigate } from "@/navigation/rootNavigation";
import { Plus } from "lucide-react-native";
import React from "react";
import { TouchableOpacity } from "react-native";

export const ChatCreatingButton = () => {
  return (
    <TouchableOpacity
      className="p-2 rounded-full"
      activeOpacity={0.7}
      onPress={() => rootNavigate("MeetHome")}
    >
      <Plus color="#6C6C6C" strokeWidth={2} />
    </TouchableOpacity>
  );
};
