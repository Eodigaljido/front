import React, { useCallback, useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useFocusEffect, useNavigation, useNavigationState } from '@react-navigation/native';

const TAB_ORDER = ['Home', 'Route', 'Chat', 'Meet', 'All'] as const;
const SWIPE_MIN_DISTANCE = 60;
const SWIPE_MIN_VELOCITY = 400;

const TIMING = { duration: 200, easing: Easing.out(Easing.quad) };

interface Props {
  children: React.ReactNode;
}

export default function SwipeTabWrapper({ children }: Props) {
  const navigation = useNavigation<any>();
  const currentIndex = useNavigationState(state => state.index);
  const opacity = useSharedValue(0);

  useFocusEffect(
    useCallback(() => {
      opacity.value = 0;
      opacity.value = withTiming(1, TIMING);
      return () => {
        opacity.value = 0;
      };
    }, [opacity]),
  );

  const animatedStyle = useAnimatedStyle(() => ({
    flex: 1,
    opacity: opacity.value,
  }));

  const handleSwipe = useCallback(
    (dx: number, vx: number) => {
      if (dx < -SWIPE_MIN_DISTANCE || vx < -SWIPE_MIN_VELOCITY) {
        const next = Math.min(currentIndex + 1, TAB_ORDER.length - 1);
        if (next !== currentIndex) navigation.navigate(TAB_ORDER[next]);
      } else if (dx > SWIPE_MIN_DISTANCE || vx > SWIPE_MIN_VELOCITY) {
        const prev = Math.max(currentIndex - 1, 0);
        if (prev !== currentIndex) navigation.navigate(TAB_ORDER[prev]);
      }
    },
    [currentIndex, navigation],
  );

  const swipeGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-20, 20])
        .failOffsetY([-15, 15])
        .runOnJS(true)
        .onEnd(e => handleSwipe(e.translationX, e.velocityX)),
    [handleSwipe],
  );

  return (
    <GestureDetector gesture={swipeGesture}>
      <Animated.View style={animatedStyle} collapsable={false}>
        {children}
      </Animated.View>
    </GestureDetector>
  );
}
