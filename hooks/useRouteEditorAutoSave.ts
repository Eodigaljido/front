import { useCallback, useEffect, useRef } from 'react';

const DEFAULT_DEBOUNCE_MS = 1500;

export type UseRouteEditorAutoSaveOptions = {
  enabled: boolean;
  syncKey: string;
  onSave: () => Promise<unknown>;
  debounceMs?: number;
};

/** 개인 루트 편집 — 변경 후 디바운스 자동 저장 */
export function useRouteEditorAutoSave({
  enabled,
  syncKey,
  onSave,
  debounceMs = DEFAULT_DEBOUNCE_MS,
}: UseRouteEditorAutoSaveOptions): { flush: () => Promise<void> } {
  const onSaveRef = useRef(onSave);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirtyRef = useRef(false);
  const enabledRef = useRef(enabled);

  onSaveRef.current = onSave;
  enabledRef.current = enabled;

  const flush = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (!enabledRef.current) return;
    if (!dirtyRef.current) return;
    dirtyRef.current = false;
    await onSaveRef.current();
  }, []);

  useEffect(() => {
    if (!enabled) {
      dirtyRef.current = false;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    dirtyRef.current = true;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      dirtyRef.current = false;
      void onSaveRef.current();
    }, debounceMs);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [syncKey, enabled, debounceMs]);

  useEffect(() => {
    return () => {
      void flush();
    };
  }, [flush]);

  return { flush };
}
