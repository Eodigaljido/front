import { Alert, Platform, Share } from "react-native";

export function getShareBaseUrl(): string {
  const raw =
    typeof process !== "undefined" &&
    process.env?.EXPO_PUBLIC_SHARE_BASE_URL != null
      ? String(process.env.EXPO_PUBLIC_SHARE_BASE_URL).trim()
      : typeof process !== "undefined" &&
          process.env?.EXPO_PUBLIC_API_BASE_URL != null
        ? String(process.env.EXPO_PUBLIC_API_BASE_URL).trim()
        : "";
  return raw.replace(/\/+$/, "");
}

/** 공유 코스 링크(웹·딥링크 대비). 앱 설치 시 SharedRoute `viewCourseId`와 동일 id 사용 */
export function buildPublicCourseShareUrl(courseId: string): string {
  const id = String(courseId ?? "").trim();
  const base = getShareBaseUrl();
  if (!base || !id) return "";
  return `${base}/courses/public/${encodeURIComponent(id)}`;
}

export async function sharePublicCourse(opts: {
  courseId: string;
  title: string;
}): Promise<void> {
  const courseId = String(opts.courseId ?? "").trim();
  const title = String(opts.title ?? "코스").trim() || "코스";
  if (!courseId) {
    Alert.alert('', '코스 ID 없음');
    return;
  }

  const url = buildPublicCourseShareUrl(courseId);
  const message = url ? `${title}\n${url}` : `${title}\nID: ${courseId}`;

  try {
    const result = await Share.share(
      Platform.select({
        ios: { message, url: url || undefined, title },
        android: { message, title },
        default: { message, title },
      }) ?? { message, title },
    );
    if (result.action === Share.dismissedAction) return;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.toLowerCase().includes("cancel") || msg.toLowerCase().includes("dismiss")) {
      return;
    }
    Alert.alert('', '공유 실패');
  }
}
