import { useCallback, useEffect, useRef, useState } from "react";
import type { TypingEvent } from "./useChatSocket";

const AUTO_REMOVE_MS = 6000;

export function useTypingIndicator(myUuid: string | undefined) {
  const [typingUsers, setTypingUsers] = useState<Map<string, string>>(
    new Map(),
  );
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const myUuidRef = useRef(myUuid);

  useEffect(() => {
    myUuidRef.current = myUuid;
  }, [myUuid]);

  useEffect(() => {
    return () => {
      timers.current.forEach(clearTimeout);
      timers.current.clear();
    };
  }, []);

  const handleTypingEvent = useCallback((event: TypingEvent) => {
    if (event.senderUuid === myUuidRef.current) return;

    const { senderUuid, senderNickname, isTyping } = event;
    const existing = timers.current.get(senderUuid);
    if (existing) clearTimeout(existing);

    if (isTyping) {
      setTypingUsers((prev) => {
        const next = new Map(prev);
        next.set(senderUuid, senderNickname);
        return next;
      });

      const timer = setTimeout(() => {
        setTypingUsers((prev) => {
          const next = new Map(prev);
          next.delete(senderUuid);
          return next;
        });
        timers.current.delete(senderUuid);
      }, AUTO_REMOVE_MS);

      timers.current.set(senderUuid, timer);
    } else {
      timers.current.delete(senderUuid);
      setTypingUsers((prev) => {
        const next = new Map(prev);
        next.delete(senderUuid);
        return next;
      });
    }
  }, []);

  return { handleTypingEvent, typingText: buildTypingText(typingUsers) };
}

function buildTypingText(users: Map<string, string>): string {
  const names = Array.from(users.values());
  if (names.length === 0) return "";
  if (names.length === 1) return `${names[0]}님이 타이핑 중...`;
  if (names.length === 2) return `${names[0]}, ${names[1]}님이 타이핑 중...`;
  return `${names[0]} 외 ${names.length - 1}명이 타이핑 중...`;
}
