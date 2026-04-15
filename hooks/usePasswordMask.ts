import { useState, useRef, useEffect, useCallback } from 'react';

const MASK_DELAY_MS = 800;
const MASK_CHAR = '•';

export function usePasswordMask() {
  const realPasswordRef = useRef('');
  const [displayPassword, setDisplayPassword] = useState('');
  const maskTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (maskTimerRef.current) clearTimeout(maskTimerRef.current);
    };
  }, []);

  // 입력 처리: 마지막 타이핑 문자를 MASK_DELAY_MS 후 •로 교체
  // 실제 비밀번호 값을 반환
  const handleInput = useCallback((inputText: string): string => {
    const prevReal = realPasswordRef.current;
    const newReal =
      inputText.length >= prevReal.length
        ? prevReal + inputText.slice(prevReal.length)
        : prevReal.slice(0, inputText.length);

    realPasswordRef.current = newReal;

    if (inputText.length > prevReal.length) {
      const addedLen = inputText.length - prevReal.length;
      setDisplayPassword(MASK_CHAR.repeat(newReal.length - addedLen) + newReal.slice(-addedLen));
      if (maskTimerRef.current) clearTimeout(maskTimerRef.current);
      maskTimerRef.current = setTimeout(
        () => setDisplayPassword(MASK_CHAR.repeat(newReal.length)),
        MASK_DELAY_MS,
      );
    } else {
      if (maskTimerRef.current) clearTimeout(maskTimerRef.current);
      setDisplayPassword(MASK_CHAR.repeat(newReal.length));
    }

    return newReal;
  }, []);

  // 포커스 아웃 시 전체 마스킹
  const maskAll = useCallback(() => {
    if (maskTimerRef.current) clearTimeout(maskTimerRef.current);
    setDisplayPassword(MASK_CHAR.repeat(realPasswordRef.current.length));
  }, []);

  return { displayPassword, realPasswordRef, handleInput, maskAll };
}
