import { RoomHeader } from "@/components/chat/RoomHeader";
import { RoomFooter } from "@/components/chat/RoomFooter";
import { View } from "react-native";

import { BubbleChat } from "@/stories/chat/BubbleChat";

const BubbleChatMock = () => {
  return (
    <View style={{ justifyContent: "flex-end" }}>
      <BubbleChat
        isMine={true}
        sended={true}
        message="안녕하세요!!!!"
        timestamp="오후 3:45"
      />
      <BubbleChat
        isMine={false}
        message="안녕하세요! 반갑습니다."
        timestamp="오후 3:46"
        sended={true}
      />
      <BubbleChat
        isMine={true}
        sended={true}
        message="반갑습니다잉"
        timestamp="오후 3:47"
      />
      <BubbleChat
        isMine={true}
        sended={true}
        message="동해물과 백두산이 마르고 닳도록 하느님이 보우하사 우리나라 만세 무궁화 삼천리 화려 강산 대한 사람 대한으로 길이 보전하세 동해물과 백두산이 마르고 닳도록 하느님이 보우하사 우리나라 만세 무궁화 삼천리 화려 강산 대한 사람 대한으로 길이 보전하세 동해물과 백두산이 마르고 닳도록 하느님이 보우하사 우리나라 만세 무궁화 삼천리 화려 강산 대한 사람 대한으로 길이 보전하세"
        timestamp="오후 3:47"
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
