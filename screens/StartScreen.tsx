import { View, Text, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function StartScreen() {
  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="items-center justify-center flex-1 gap-4">
        {/* 타이틀 */}
        <Text className="mb-6 text-5xl font-black tracking-tight">
          어디
          <Text className="text-blue-500">
            갈<Text className="text-green-600">지</Text>도
          </Text>
        </Text>

        {/* 로고 */}
        <Image source={require('@/assets/logo.png')} className="w-56 h-56" resizeMode="contain" />

        {/* 서브타이틀 */}
        <Text className="text-base font-semibold text-gray-800">
          코스를 통해 만남이 이루어지는 곳
        </Text>
      </View>
    </SafeAreaView>
  );
}
