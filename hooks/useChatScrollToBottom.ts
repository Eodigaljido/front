import { useCallback, useRef, useState } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

export const CHAT_SCROLL_BOTTOM_THRESHOLD = 96;

export function isNearChatScrollBottom(nativeEvent: NativeScrollEvent): boolean {
  const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
  if (contentSize.height <= layoutMeasurement.height) return true;
  return (
    layoutMeasurement.height + contentOffset.y >=
    contentSize.height - CHAT_SCROLL_BOTTOM_THRESHOLD
  );
}

export function useChatScrollToBottom(
  scrollToEnd: (animated?: boolean) => void,
) {
  const nearBottomRef = useRef(true);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);

  const handleScrollPosition = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const near = isNearChatScrollBottom(event.nativeEvent);
      nearBottomRef.current = near;
      setShowScrollToBottom(!near);
    },
    [],
  );

  const scrollToBottomPress = useCallback(() => {
    nearBottomRef.current = true;
    setShowScrollToBottom(false);
    scrollToEnd(true);
  }, [scrollToEnd]);

  const maybeScrollToEnd = useCallback(
    (animated = true) => {
      if (nearBottomRef.current) scrollToEnd(animated);
    },
    [scrollToEnd],
  );

  const stickToBottom = useCallback(() => {
    nearBottomRef.current = true;
    setShowScrollToBottom(false);
    scrollToEnd(true);
  }, [scrollToEnd]);

  return {
    showScrollToBottom,
    nearBottomRef,
    handleScrollPosition,
    scrollToBottomPress,
    maybeScrollToEnd,
    stickToBottom,
  };
}
