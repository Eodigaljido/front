import { tokenStorage } from "../utils/tokenStorage";

export function getApiBaseUrl(): string {
  return String(process.env.EXPO_PUBLIC_API_BASE_URL ?? "").replace(/\/+$/, "");
}

export type MultipartFilePart = {
  uri: string;
  name: string;
  type: string;
};

export class MultipartHttpError extends Error {
  status: number;
  body: unknown;
  url: string;

  constructor(url: string, status: number, body: unknown, message?: string) {
    super(message ?? `HTTP ${status}`);
    this.name = "MultipartHttpError";
    this.url = url;
    this.status = status;
    this.body = body;
  }
}

function joinUrl(base: string, path: string): string {
  const p = String(path ?? "").replace(/^\/+/, "");
  return `${base}/${p}`;
}

async function parseJsonSafe(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

/**
 * React Native APK에서 axios+FormData 가 Network Error 나는 경우가 많아 fetch 사용.
 * Content-Type 은 설정하지 않음 (boundary 자동).
 */
export async function fetchMultipart(
  path: string,
  method: "POST" | "PATCH",
  parts: { field: string; file: MultipartFilePart }[],
  options?: {
    accessToken?: string | null;
    silent?: boolean;
    /** 파일 외에 함께 보낼 텍스트/JSON 파트 (예: Spring @RequestPart 객체) */
    fields?: { field: string; value: string; type?: string }[];
  },
): Promise<{ status: number; data: unknown }> {
  const base = getApiBaseUrl();
  if (!base) {
    throw new Error("EXPO_PUBLIC_API_BASE_URL is empty");
  }

  const token =
    options?.accessToken ?? (await tokenStorage.getAccessToken());
  const url = joinUrl(base, path);

  const form = new FormData();
  for (const { field, value, type } of options?.fields ?? []) {
    // 일반 문자열로 append 하면 RN 이 content-type 을 지정하지 않아
    // 서버에서 application/octet-stream 으로 처리되어 415 가 난다.
    // { string, type, name } 객체로 넘겨 파트별 Content-Type 을 명시한다.
    form.append(field, {
      string: value,
      type: type ?? "application/json",
      name: field,
    } as unknown as Blob);
  }
  for (const { field, file } of parts) {
    form.append(field, {
      uri: file.uri,
      name: file.name,
      type: file.type,
    } as unknown as Blob);
  }

  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(url, { method, headers, body: form });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!options?.silent) {
      console.warn("[ERR]", "network", path, msg);
    }
    throw e;
  }

  const data = await parseJsonSafe(res);
  if (!res.ok) {
    const message =
      (data as { message?: string })?.message ??
      (data as { error?: string })?.error ??
      res.statusText;
    if (!options?.silent) {
      console.warn("[ERR]", res.status, path, message, data);
    }
    throw new MultipartHttpError(path, res.status, data, String(message));
  }

  return { status: res.status, data };
}

export function mimeFromUri(uri: string, fallback = "image/jpeg"): string {
  const name = uri.split("/").pop() ?? "";
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "png") return "image/png";
  if (ext === "gif") return "image/gif";
  if (ext === "webp") return "image/webp";
  if (ext === "heic" || ext === "heif") return "image/jpeg";
  return fallback;
}

export function fileNameFromUri(uri: string, fallback: string): string {
  const name = uri.split("/").pop() ?? "";
  return name.trim() ? name : fallback;
}
