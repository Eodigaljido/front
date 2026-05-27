import { useEffect, useState } from "react";
import {
  getCachedAuthorProfileVisible,
  resolveAuthorProfileVisible,
} from "../utils/authorProfileVisibility";

type Options = {
  isOwn?: boolean;
  /** 코스 응답의 authorProfilePublic — false면 즉시 숨김 */
  apiFlag?: boolean;
};

/**
 * 공유 코스 제작자 프로필 노출 여부.
 * true: 표시, false: 비공개·조회 불가, null: 확인 중(숨김)
 */
export function useAuthorProfileVisible(
  authorUuid: string | undefined,
  opts?: Options,
): boolean | null {
  const isOwn = opts?.isOwn === true;
  const apiFlag = opts?.apiFlag;
  const uuid = String(authorUuid ?? "").trim();

  const [visible, setVisible] = useState<boolean | null>(() => {
    if (isOwn) return true;
    if (apiFlag === false) return false;
    if (!uuid) return false;
    const cached = getCachedAuthorProfileVisible(uuid);
    if (cached !== undefined) return cached;
    return null;
  });

  useEffect(() => {
    if (isOwn) {
      setVisible(true);
      return;
    }
    if (apiFlag === false) {
      setVisible(false);
      return;
    }
    if (!uuid) {
      setVisible(false);
      return;
    }

    const cached = getCachedAuthorProfileVisible(uuid);
    if (cached !== undefined) {
      setVisible(cached);
      return;
    }

    let cancelled = false;
    setVisible(null);
    void resolveAuthorProfileVisible(uuid).then((ok) => {
      if (!cancelled) setVisible(ok);
    });
    return () => {
      cancelled = true;
    };
  }, [uuid, isOwn, apiFlag]);

  return visible;
}
