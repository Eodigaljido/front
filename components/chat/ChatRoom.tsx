import { View, Text, Image, TouchableOpacity } from "react-native";
import { useNavigation, NavigationProp } from "@react-navigation/native";

type RootStackParamList = {
  ChatRoomScreen: undefined;
};

export const ChatRoom = () => {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const chatRooms = [
    {
      id: "1",
      name: "김태호",
      message: "오늘 저녁 운동 같이 하실래요?",
      imageUrl: "https://avatars.githubusercontent.com/u/108007761?v=4",
      unreadCount: 3,
      time: "14:30",
    },
    {
      id: "2",
      name: "송주영",
      message: "안녕하세요!!#!#!@#!#!#!",
      imageUrl: "https://avatars.githubusercontent.com/u/162583068?v=4",
      unreadCount: 12,
      time: "12:45",
    },
    {
      id: "3",
      name: "박건형",
      message: "코스 추천 감사합니다!",
      imageUrl: "https://avatars.githubusercontent.com/u/162693556?v=4",
      unreadCount: 0,
      time: "10:20",
    },
    {
      id: "4",
      name: "박창연",
      message: "내일은 강변 코스로 갈게요.",
      imageUrl: "https://avatars.githubusercontent.com/u/140193710?v=4",
      unreadCount: 1,
      time: "09:15",
    },
    {
      id: "5",
      name: "류지우",
      message: "지금 출발해도 될까요?",
      imageUrl: "https://avatars.githubusercontent.com/u/126925788?v=4",
      unreadCount: 0,
      time: "08:00",
    },
    {
      id: "6",
      name: "송주영",
      message: "안녕하세요!!#!#!@#!#!#!",
      imageUrl: "https://avatars.githubusercontent.com/u/162583068?v=4",
      unreadCount: 9,
      time: "어제",
    },
    {
      id: "7",
      name: "송주영",
      message: "안녕하세요!!#!#!@#!#!#!",
      imageUrl: "https://avatars.githubusercontent.com/u/162583068?v=4",
      unreadCount: 5,
      time: "3일 전",
    },
    // {
    //   id: "8",
    //   name: "송주영",
    //   message: "안녕하세요!!#!#!@#!#!#!",
    //   imageUrl: "https://avatars.githubusercontent.com/u/162583068?v=4",
    // },
    // {
    //   id: "9",
    //   name: "송주영",
    //   message: "안녕하세요!!#!#!@#!#!#!",
    //   imageUrl: "https://avatars.githubusercontent.com/u/162583068?v=4",
    // },
    // {
    //   id: "10",
    //   name: "송주영",
    //   message: "안녕하세요!!#!#!@#!#!#!",
    //   imageUrl: "https://avatars.githubusercontent.com/u/162583068?v=4",
    // },
    // {
    //   id: "11",
    //   name: "송주영",
    //   message: "안녕하세요!!#!#!@#!#!#!",
    //   imageUrl: "https://avatars.githubusercontent.com/u/162583068?v=4",
    // },
    // {
    //   id: "12",
    //   name: "송주영",
    //   message: "안녕하세요!!#!#!@#!#!#!",
    //   imageUrl: "https://avatars.githubusercontent.com/u/162583068?v=4",
    // },
  ];

  return (
    <View>
      {chatRooms.map((room) => (
        <TouchableOpacity
          key={room.id}
          className="flex-row items-center justify-between py-3 mb-2"
          activeOpacity={0.5}
          onPress={() => navigation.navigate("ChatRoomScreen")}
        >
          <View className="flex-row items-center flex-1">
            <View style={{ position: "relative" }}>
              <Image
                source={{
                  uri: room.imageUrl,
                }}
                className="rounded-full"
                style={{ width: 50, height: 50 }}
              />
              {room.unreadCount > 0 && (
                <View
                  style={{
                    position: "absolute",
                    top: -2,
                    right: -2,
                    backgroundColor: "#5c8efa",
                    borderRadius: 10,
                    minWidth: 18,
                    height: 18,
                    justifyContent: "center",
                    alignItems: "center",
                    paddingHorizontal: 4,
                  }}
                >
                  <Text
                    style={{ color: "white", fontSize: 11, fontWeight: "bold" }}
                  >
                    {room.unreadCount > 9 ? "9+" : room.unreadCount}
                  </Text>
                </View>
              )}
            </View>
            <View
              className="justify-center"
              style={{ marginLeft: 10, flex: 1 }}
            >
              <Text className="text-base font-semibold">{room.name}</Text>
              <Text
                className={`text-sm ${
                  room.unreadCount > 0
                    ? "font-semibold text-gray-500"
                    : "font-medium text-gray-500"
                }`}
              >
                {room.message}
              </Text>
            </View>
          </View>
          <Text className="text-xs text-gray-700 ml-2">{room.time}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};
