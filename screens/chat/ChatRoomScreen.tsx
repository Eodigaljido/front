import { RoomHeader } from "@/components/chat/RoomHeader";
import { RoomFooter } from "@/components/chat/RoomFooter";
import { BubbleChat, BubbleChatProps } from "@/stories/chat/BubbleChat";
import { useRef, useState } from "react";
import { View, ScrollView } from "react-native";

type Message = Omit<BubbleChatProps, "style"> & { id: string };

const MOCK_MESSAGES: Message[] = [
  {
    id: "1",
    text: "끝말잇기 ㄱ?",
    isMine: false,
    sentAt: new Date(2026, 3, 13, 9, 0),
    userName: "내친구 진석",
  },
  {
    id: "2",
    text: "ㄱㄱ",
    isMine: true,
    sentAt: new Date(2026, 3, 13, 9, 1),
  },
  {
    id: "3",
    text: "나 먼저함 기차",
    isMine: false,
    sentAt: new Date(2026, 3, 13, 9, 2),
    userName: "내친구 진석",
  },
  {
    id: "4",
    text: "차표",
    isMine: true,
    sentAt: new Date(2026, 3, 13, 9, 3),
  },
  {
    id: "5",
    text: "표지판",
    isMine: false,
    sentAt: new Date(2026, 3, 13, 9, 4),
    userName: "내친구 진석",
  },
];

export const ChatRoomScreen = () => {
  const [messages, setMessages] = useState<Message[]>(MOCK_MESSAGES);
  const scrollViewRef = useRef<ScrollView>(null);

  const handleSend = (text: string) => {
    const newMessage: Message = {
      id: Date.now().toString(),
      text,
      isMine: true,
      sentAt: new Date(),
    };
    setMessages((prev) => [...prev, newMessage]);
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 50);
  };

  return (
    <View className="flex-1">
      <RoomHeader />
      <ScrollView
        ref={scrollViewRef}
        className="flex-1"
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 12,
          paddingBottom: 180,
        }}
      >
        {messages.map((msg) => (
          <BubbleChat
            key={msg.id}
            text={msg.text}
            isMine={msg.isMine}
            sentAt={msg.sentAt}
            userName={msg.userName}
          />
        ))}
      </ScrollView>
      <RoomFooter onSend={handleSend} />
    </View>
  );
};
