import { View, Text, Image, ScrollView } from "react-native";

export const ProfileIcon = ({ size = 60 }: { size?: number }) => {
  const names = ["김태호", "송주영", "박건형", "박창연", "류지우", "김민수"];
  const imageUrls = [
    "https://avatars.githubusercontent.com/u/108007761?v=4",
    "https://avatars.githubusercontent.com/u/162583068?v=4",
    "https://avatars.githubusercontent.com/u/162693556?v=4",
    "https://avatars.githubusercontent.com/u/140193710?v=4",
    "https://avatars.githubusercontent.com/u/126925788?v=4",
    "https://avatars.githubusercontent.com/u/3747645?v=4",
  ];

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false} // 스크롤바 숨기기
      contentContainerStyle={{
        alignItems: "flex-start",
        paddingLeft: 16,
        paddingRight: 16,
      }}
    >
      <View className="flex-row gap-5">
        {names.map((name, index) => (
          <View key={index} className="items-center">
            <Image
              source={{
                uri: imageUrls[index],
              }}
              className="rounded-full mt-5 border-2 border-gray-300"
              style={{ width: size, height: size }}
            />
            <Text className="text-sm font-semibold mt-3 text-gray-700">
              {name}
            </Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
};
