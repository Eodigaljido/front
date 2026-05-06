import { RoomHeader } from "@/components/chat/RoomHeader";
import { RoomFooter } from "@/components/chat/RoomFooter";
import { View } from "react-native";

import { BubbleChat } from "@/stories/chat/BubbleChat";

const BubbleChatMock = () => {
  return (
    <View style={{ justifyContent: "flex-end" }}>
      <BubbleChat
        text="안녕하세요! 오늘 여행 계획에 대해 이야기해볼까요?"
        isMine={false}
        sentAt={new Date()}
      />
      <BubbleChat
        text="네, 좋아요! 어떤 장소를 가보고 싶으세요?"
        isMine={true}
        sentAt={new Date()}
      />
    </View>
  );
};

export const ChatRoomScreen = () => {
  return (
    <View className="flex-1">
      <RoomHeader />
      <BubbleChatMock />
      <RoomFooter />
    </View>
  );
};
