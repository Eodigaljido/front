// @ts-nocheck
import { Text } from "react-native";

export default function Description({
  desc,
}: {
  desc: string;
}): React.JSX.Element {
  return (
    <Text className="text-lg text-gray-400 text-left font-bold px-5">
      {desc}
    </Text>
  );
}
