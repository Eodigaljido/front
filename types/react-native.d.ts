/// <reference types="nativewind/types" />
/**
 * react-native 모듈 타입을 @types/react-native에서 사용하도록 지정합니다.
 * className 등 NativeWind 확장은 types/nativewind.d.ts에서 병합됩니다.
 */
declare module 'react-native' {
  export * from '@types/react-native';
}
