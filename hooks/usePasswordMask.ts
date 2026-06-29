import { useState, useRef, useEffect, useCallback } from 'react';

const MASK_DELAY_MS = 800;
const MASK_CHAR = '•';

export function usePasswordMask() {
  const realPasswordRef = useRef('');
  const [displayPassword, setDisplayPassword] = useState('');
  const [revealed, setRevealed] = useState(false);
  const revealedRef = useRef(false);
  const maskTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (maskTimerRef.current) clearTimeout(maskTimerRef.current);
    };
  }, []);

  // 눈 아이콘 토글: 켜면 전체 평문, 끄면 전체 마스킹
  const toggleReveal = useCallback(() => {
    setRevealed(prev => {
      const next = !prev;
      revealedRef.current = next;
      if (maskTimerRef.current) clearTimeout(maskTimerRef.current);
      setDisplayPassword(
        next ? realPasswordRef.current : MASK_CHAR.repeat(realPasswordRef.current.length),
      );
      return next;
    });
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

    // 눈 아이콘 ON: 평문 그대로 표시
    if (revealedRef.current) {
      if (maskTimerRef.current) clearTimeout(maskTimerRef.current);
      setDisplayPassword(newReal);
      return newReal;
    }

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

  // 포커스 아웃 시 전체 마스킹 (눈 아이콘 ON 이면 평문 유지)
  const maskAll = useCallback(() => {
    if (maskTimerRef.current) clearTimeout(maskTimerRef.current);
    if (revealedRef.current) {
      setDisplayPassword(realPasswordRef.current);
    } else {
      setDisplayPassword(MASK_CHAR.repeat(realPasswordRef.current.length));
    }
  }, []);

  return { displayPassword, realPasswordRef, handleInput, maskAll, revealed, toggleReveal };
}
