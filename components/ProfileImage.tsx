import { Image } from "react-native";

export const ProfileImage = ({ size = 60 }: { size?: number }) => {
  const imageUrl = "https://avatars.githubusercontent.com/u/108007761?v=4";

  return (
    <Image
      source={{ uri: imageUrl }}
      className="rounded-full mt-5 border-2 border-gray-300"
      style={{ width: size, height: size }}
    />
  );
};
