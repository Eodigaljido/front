import { useEffect, useRef, useState } from 'react';
import {
  fetchCollaborativeAccess,
  collaborativeAccessDeniedMessage,
  type CollaborativeAccess,
} from '../api/collaborativeCourse';
import { safeGoBack } from '../navigation/rootNavigation';

export type CollaborativeEntryStatus =
  | 'idle'
  | 'checking'
  | 'granted'
  | 'denied';

type Options = {
  editRouteId?: string;
  collaborative?: boolean;
  navigation: { goBack: () => void; canGoBack?: () => boolean };
  showToast: (message: string) => void;
  onGranted?: (access: CollaborativeAccess) => void;
};

/**
 * 딥링크·pendingShareLink 로 RouteCreate(collaborative) 진입 시 권한 검증.
 * collaborative + editRouteId 가 없으면 idle(검증 생략).
 */
export function useCollaborativeRouteEntry({
  editRouteId,
  collaborative,
  navigation,
  showToast,
  onGranted,
}: Options): {
  status: CollaborativeEntryStatus;
  access: CollaborativeAccess | null;
} {
  const [status, setStatus] = useState<CollaborativeEntryStatus>('idle');
  const [access, setAccess] = useState<CollaborativeAccess | null>(null);
  const onGrantedRef = useRef(onGranted);
  onGrantedRef.current = onGranted;

  const courseId = String(editRouteId ?? '').trim();
  // 로컬 사용자 저장 루트(ur-로 시작)는 서버 확인 불필요
  const isLocalRoute = courseId.startsWith('ur-');
  const shouldCheck = collaborative === true && Boolean(courseId) && !isLocalRoute;

  useEffect(() => {
    if (!shouldCheck) {
      setStatus('idle');
      setAccess(null);
      return;
    }

    let cancelled = false;
    setStatus('checking');
    setAccess(null);

    void fetchCollaborativeAccess(courseId).then((result) => {
      if (cancelled) return;
      if (result.ok) {
        setAccess(result.access);
        setStatus('granted');
        onGrantedRef.current?.(result.access);
        return;
      }
      setStatus('denied');
      showToast(collaborativeAccessDeniedMessage(result.reason));
      safeGoBack(navigation);
    });

    return () => {
      cancelled = true;
    };
  }, [shouldCheck, courseId, navigation, showToast]);

  return { status, access };
}
