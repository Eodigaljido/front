import { Alert, Platform, Share } from "react-native";
import Constants from "expo-constants";
import { SHARE_LINK_HOST } from "../constants/shareLinking";
import {
  linkCourseChatRoomForShare,
  promptCreateCourseChatRoom,
} from "../data/routeCollaborativeChat";

export function getShareBaseUrl(): string {
  const fromEnv = String(process.env.EXPO_PUBLIC_SHARE_BASE_URL ?? "").trim();
  const fromExtra = String(
    (Constants.expoConfig?.extra as { shareBaseUrl?: string } | undefined)
      ?.shareBaseUrl ?? "",
  ).trim();
  const raw =
    fromEnv ||
    fromExtra ||
    `https://${SHARE_LINK_HOST}`;
  return raw.replace(/\/+$/, "");
}

/** 서버·공개 코스만 링크 공유 가능 (로컬 전용 `ur-` 제외) */
export function resolveShareablePublicCourseId(
  courseId: string | number | null | undefined,
): string | null {
  const id = String(courseId ?? "").trim();
  if (!id || id === "undefined" || id === "null") return null;
  if (id.startsWith("ur-")) return null;
  return id;
}

/** 공유 코스 링크. 앱·웹: /courses/public/{courseId} */
export function buildPublicCourseShareUrl(courseId: string): string {
  const id = resolveShareablePublicCourseId(courseId);
  const base = getShareBaseUrl();
  if (!base || !id) return "";
  return `${base}/courses/public/${encodeURIComponent(id)}`;
}

export async function sharePublicCourse(opts: {
  courseId: string;
  title: string;
  accessToken?: string | null;
  myUuid?: string | null;
  existingChatRoomUuid?: string | null;
  onChatRoomLinked?: (roomUuid: string) => void;
}): Promise<void> {
  const title = String(opts.title ?? "코스").trim() || "코스";
  const shareId = resolveShareablePublicCourseId(opts.courseId);

  if (!shareId) {
    Alert.alert(
      "",
      "기기에만 저장된 루트는 링크로 공유할 수 없어요.\n루트 제작에서 저장한 뒤 「공개」로 올리고 다시 시도해 주세요.",
    );
    return;
  }

  const url = buildPublicCourseShareUrl(shareId);
  if (!url.includes("/courses/public/")) {
    Alert.alert("", "공유 링크를 만들지 못했어요.");
    return;
  }

  const existingRoom = String(opts.existingChatRoomUuid ?? "").trim();
  if (!existingRoom) {
    const createChat = await promptCreateCourseChatRoom();
    if (
      createChat &&
      opts.accessToken &&
      String(opts.myUuid ?? "").trim()
    ) {
      const roomUuid = await linkCourseChatRoomForShare({
        accessToken: opts.accessToken,
        myUuid: String(opts.myUuid),
        routeId: shareId,
        routeTitle: title,
        existingChatRoomUuid: existingRoom || null,
      });
      if (roomUuid) opts.onChatRoomLinked?.(roomUuid);
    }
  }

  const message = `${title}\n${url}`;

  try {
    const result = await Share.share(
      Platform.select({
        ios: { message, title },
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
    Alert.alert("", "공유 실패");
  }
}
