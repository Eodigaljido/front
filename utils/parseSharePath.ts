/** 공유·친구 초대 URL/경로에서 courseId·friendCode 추출 */

export type ParsedSharePath =
  | { type: 'course'; courseId: string }
  | { type: 'friend'; friendCode: string };

function normalizePath(input: string): string {
  const raw = String(input ?? '').trim();
  if (!raw) return '';
  try {
    if (/^https?:\/\//i.test(raw) || /^eodigaljido:\/\//i.test(raw)) {
      const u = new URL(raw.replace(/^eodigaljido:\/\//i, 'https://placeholder/'));
      return decodeURIComponent(u.pathname.replace(/\/+$/, ''));
    }
  } catch {
    // fall through
  }
  const path = raw.replace(/^eodigaljido:\/\//i, '').replace(/\?.*$/, '');
  return decodeURIComponent(path.startsWith('/') ? path : `/${path}`);
}

export function parseSharePathFromUrl(urlOrPath: string): ParsedSharePath | null {
  const path = normalizePath(urlOrPath);
  if (!path) return null;

  const course = path.match(/\/courses\/public\/([^/]+)/i);
  if (course?.[1]) {
    const courseId = String(course[1]).trim();
    if (courseId) return { type: 'course', courseId };
  }

  const friend = path.match(/\/friends\/add\/([^/]+)/i);
  if (friend?.[1]) {
    const friendCode = String(friend[1]).trim();
    if (friendCode) return { type: 'friend', friendCode };
  }

  return null;
}
