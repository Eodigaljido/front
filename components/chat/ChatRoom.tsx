import { View, Text, Image } from "react-native";

export const ChatRoom = () => {
  const chatRooms = [
    {
      id: "1",
      name: "김태호",
      message: "오늘 저녁 운동 같이 하실래요?",
      imageUrl: "https://avatars.githubusercontent.com/u/108007761?v=4",
    },
    {
      id: "2",
      name: "송주영",
      message: "안녕하세요!!#!#!@#!#!#!",
      imageUrl: "https://avatars.githubusercontent.com/u/162583068?v=4",
    },
    {
      id: "3",
      name: "박건형",
      message: "코스 추천 감사합니다!",
      imageUrl: "https://avatars.githubusercontent.com/u/162693556?v=4",
    },
    {
      id: "4",
      name: "박창연",
      message: "내일은 강변 코스로 갈게요.",
      imageUrl: "https://avatars.githubusercontent.com/u/140193710?v=4",
    },
    {
      id: "5",
      name: "류지우",
      message: "지금 출발해도 될까요?",
      imageUrl: "https://avatars.githubusercontent.com/u/126925788?v=4",
    },
    {
      id: "6",
      name: "송주영",
      message: "안녕하세요!!#!#!@#!#!#!",
      imageUrl: "https://avatars.githubusercontent.com/u/162583068?v=4",
    },
    {
      id: "7",
      name: "송주영",
      message: "안녕하세요!!#!#!@#!#!#!",
      imageUrl: "https://avatars.githubusercontent.com/u/162583068?v=4",
    },
    {
      id: "8",
      name: "송주영",
      message: "안녕하세요!!#!#!@#!#!#!",
      imageUrl: "https://avatars.githubusercontent.com/u/162583068?v=4",
    },
    {
      id: "9",
      name: "송주영",
      message: "안녕하세요!!#!#!@#!#!#!",
      imageUrl: "https://avatars.githubusercontent.com/u/162583068?v=4",
    },
    {
      id: "10",
      name: "송주영",
      message: "안녕하세요!!#!#!@#!#!#!",
      imageUrl: "https://avatars.githubusercontent.com/u/162583068?v=4",
    },
    {
      id: "11",
      name: "송주영",
      message: "안녕하세요!!#!#!@#!#!#!",
      imageUrl: "https://avatars.githubusercontent.com/u/162583068?v=4",
    },
    {
      id: "12",
      name: "송주영",
      message: "안녕하세요!!#!#!@#!#!#!",
      imageUrl: "https://avatars.githubusercontent.com/u/162583068?v=4",
    },
  ];

  return (
    <View>
      {chatRooms.map((room) => (
        <View key={room.id} className="flex-row items-center py-3">
          <Image
            source={{
              uri: room.imageUrl,
            }}
            className="rounded-full"
            style={{ width: 50, height: 50 }}
          />
          <View className="justify-center" style={{ marginLeft: 5 }}>
            <Text className="text-base font-semibold">{room.name}</Text>
            <Text className="text-sm text-gray-500">{room.message}</Text>
          </View>
        </View>
      ))}
    </View>
  );
};
