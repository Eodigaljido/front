// @ts-nocheck
import { View, Text, TextInput, TouchableOpacity, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';

export default function LoginScreen() {
  const navigation = useNavigation();
  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
      <View className="items-center justify-center flex-1 px-10 bg-white">
        {/* 로고 */}
        <Image
          source={require('@/assets/logo.png')}
          className="w-48 h-48 mb-3 rounded-2xl"
          resizeMode="contain"
        />

        {/* 타이틀 */}
        <Text className="mb-12 text-2xl font-bold">
          어디
          <Text className="text-blue-500">
            갈<Text className="text-green-600">지</Text>도
          </Text>
        </Text>

        {/* 입력 */}
        <View className="w-full gap-6 mb-7">
          <TextInput
            placeholder="이메일 또는 아이디 입력"
            className="w-full h-auto px-5 py-4 bg-gray-100 rounded-full"
          />
          <TextInput
            placeholder="비밀번호 입력"
            secureTextEntry
            className="w-full h-auto px-5 py-4 bg-gray-100 rounded-full"
          />
        </View>
        {/* 버튼 */}
        <TouchableOpacity
          activeOpacity={0.7}
          className="items-center justify-center w-full h-12 mt-2 bg-blue-500 rounded-full"
        >
          <Text className="font-bold text-white">로그인</Text>
        </TouchableOpacity>

        {/* 링크 */}
        <View className="flex-row items-center gap-2 mt-5">
          <Text className="text-sm text-gray-700">비밀번호 찾기</Text>
          <Text className="text-base font-black text-gray-300">|</Text>
          <TouchableOpacity activeOpacity={0.3} onPress={() => navigation.navigate('Signup')}>
            <Text className="text-sm text-gray-700">회원가입</Text>
          </TouchableOpacity>
        </View>

        {/* 소셜 */}
        <View className="flex-row gap-4 mt-6">
          <TouchableOpacity
            activeOpacity={0.7}
            className="items-center justify-center w-12 h-12 bg-[#ffeb00] rounded-full overflow-hidden"
          >
            <Image
              style={{ width: '75%', height: '75%' }}
              source={require('@/assets/kakaotalk_sharing_btn/kakaotalk_sharing_btn_small.png')}
              resizeMode="contain"
            />
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.7}
            className="items-center justify-center w-12 h-12 bg-white border border-gray-200 rounded-full"
          >
            <Image
              style={{ width: '50%', height: '50%' }}
              source={{
                uri: 'https://e7.pngegg.com/pngimages/734/947/png-clipart-google-logo-google-g-logo-icons-logos-emojis-tech-companies-thumbnail.png',
              }}
              resizeMode="contain"
            />
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}
