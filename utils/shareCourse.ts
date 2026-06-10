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
  /** 수정 화면 밖 — 코스 소개 링크만 (채팅방·공동 편집 초대 없음) */
  introOnly?: boolean;
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

  const introOnly = opts.introOnly === true;
  const existingRoom = String(opts.existingChatRoomUuid ?? "").trim();
  if (!introOnly && !existingRoom) {
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

  const message = introOnly
    ? `「${title}」 코스를 소개합니다.\n${url}`
    : `${title}\n${url}`;
  const shareTitle = introOnly ? `${title} · 코스 소개` : title;

  try {
    const result = await Share.share(
      Platform.select({
        ios: { message, title: shareTitle },
        android: { message, title: shareTitle },
        default: { message, title: shareTitle },
      }) ?? { message, title: shareTitle },
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
