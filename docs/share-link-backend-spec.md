# 공유 링크 — 백엔드·인프라 명세

> **백엔드 작업 목록·API 계약·Security·CORS·체크리스트:**  
> **[share-feature-backend-spec.md](./share-feature-backend-spec.md)** ← 백엔드 팀에 이 파일을 우선 전달  
>
> **대상:** 백엔드 / DevOps  
> **연동 앱:** Eodigaljido (`com.eodigaljido.app`)  
> **공유 도메인:** `https://share.eodigaljido.rjsgud.com`  
> **작성 기준일:** 2026-05-20

---

## 1. 목표

카카오톡·문자 등으로 전달된 링크를 눌렀을 때:

1. **앱 미설치** → 웹에서 코스 미리보기 + 스토어/앱 설치 안내  
2. **앱 설치** → 같은 URL로 앱이 열리고 **공유 코스 상세** 화면으로 이동  

프론트는 이미 아래 URL 형식으로 공유합니다.

```text
https://share.eodigaljido.rjsgud.com/courses/public/{courseId}
```

`courseId`는 앱의 공개 코스 API와 동일한 ID입니다.

---

## 2. 인프라 (필수)

| 항목 | 요구사항 |
|------|----------|
| DNS | `share.eodigaljido.rjsgud.com` → 웹/API 서버 (A 또는 CNAME) |
| TLS | **HTTPS 필수** (Let's Encrypt 등). HTTP만 있으면 카톡·iOS App Link 불가 |
| API 서버 | 기존 `EXPO_PUBLIC_API_BASE_URL` (예: `http://3.36.85.213:8080`)와 **분리 가능**. 공유 도메인은 랜딩·well-known 전용으로 두어도 됨 |

---

## 3. 웹 랜딩 페이지 (필수)

### 3.1 라우트

| Method | Path | 설명 |
|--------|------|------|
| `GET` | `/courses/public/{courseId}` | 공유 링크 진입점 (HTML 응답) |

- `courseId`: URL 인코딩된 문자열, 앱·API와 동일 ID  
- 존재하지 않거나 비공개 코스: **404** + 간단한 안내 HTML  
- `Accept: application/json` 등 API 클라이언트만 오는 경우: 선택적으로 JSON 분기 가능 (아래 4절)

### 3.2 HTML 페이지 최소 구성

- 코스 **제목** (필수)  
- **지역·카테고리·소요시간** 등 1~2줄 요약 (가능하면)  
- 정적 지도 이미지 또는 텍스트 경로 요약 (선택)  
- 버튼 **「앱에서 열기」**  
  - 링크: `https://share.eodigaljido.rjsgud.com/courses/public/{courseId}` (동일 URL, App Link가 앱을 열도록)  
  - 보조: `eodigaljido://courses/public/{courseId}` (앱 스킴, 선택)  
- 버튼 **「Google Play에서 받기」** / **「App Store에서 받기」** (스토어 URL 확정 후 연결)  
- OG 메타 (카톡 미리보기용, 권장):

```html
<meta property="og:title" content="{코스 제목} | 어디갈지도" />
<meta property="og:description" content="{한 줄 설명}" />
<meta property="og:url" content="https://share.eodigaljido.rjsgud.com/courses/public/{courseId}" />
<meta property="og:type" content="website" />
<!-- og:image: 앱 로고 또는 코스 대표 이미지 URL -->
```

### 3.3 데이터 소스

기존 공개 코스 API를 재사용합니다 (프론트 기준 후보):

- 목록: `GET /api/courses/public`  
- 상세: `GET /api/courses/{courseId}` (공개된 코스만 200)

랜딩 서버가 API 서버와 다르면 **서버 간** 또는 **BFF**에서 위 API를 호출해 HTML을 렌더링하면 됩니다.

---

## 4. API (권장, 랜딩·앱 공통)

웹 랜딩을 SPA로 만들 경우를 위해 JSON 응답을 두면 유지보수에 유리합니다.

| Method | Path | 응답 |
|--------|------|------|
| `GET` | `/api/courses/public/{courseId}/preview` | 공유용 최소 필드 (비로그인 허용) |

**응답 예시 (필드명은 기존 DTO에 맞게 조정 가능):**

```json
{
  "courseId": "abc-123",
  "title": "한강 데이트 코스",
  "region": "서울",
  "category": "데이트",
  "durationLabel": "약 3시간",
  "thumbnailUrl": "https://...",
  "isPublic": true
}
```

- `isPublic: false` 또는 없음 → 404  
- Rate limit·캐시(Cache-Control) 권장 (공유 링크 트래픽 대비)

### ⚠️ 401 오류 (현재 자주 발생)

share-web이 `GET /api/courses/public/{courseId}/preview` 를 호출할 때 **401**이 나면, Spring Security 등에서 **비로그인 허용(permitAll)** 이 안 된 상태입니다.

**백엔드에서 반드시 허용할 경로 (인증 없음):**

| Method | Path |
|--------|------|
| GET | `/api/courses/public` |
| GET | `/api/courses/public/{courseId}/preview` |
| GET | `/api/courses/{courseId}` | 공개(PUBLISHED+share) 코스만 200, 그 외 404 |

**Spring 예시:**

```java
.requestMatchers(HttpMethod.GET,
    "/api/courses/public",
    "/api/courses/public/*/preview",
    "/api/courses/*"  // 또는 preview 전용만
).permitAll()
```

- share-web·카톡 링크는 **Bearer 토큰이 없음** → 401이면 랜딩에 「잠시 후 다시 시도」만 보임  
- 앱은 로그인 토큰이 있어 같은 API가 200으로 보일 수 있음 (백엔드·프론트 불일치)

**친구 초대 preview도 동일:**

| Method | Path |
|--------|------|
| GET | `/api/friends/code/{friendCode}/preview` |

401 예: `GET /api/friends/code/ESSP3P/preview` → Spring `permitAll` 에 위 경로 추가

**CORS:** `https://share.eodigaljido.rjsgud.com` origin 허용

---

## 5. iOS Universal Links (필수)

### 5.1 파일 위치

```text
GET https://share.eodigaljido.rjsgud.com/.well-known/apple-app-site-association
```

- `Content-Type: application/json`  
- **리다이렉트 없이** 200 (301/302 금지)  
- 확장자 없음  

### 5.2 내용 예시

```json
{
  "applinks": {
    "apps": [],
    "details": [
      {
        "appID": "{Apple Team ID}.com.eodigaljido.app",
        "paths": ["/courses/public/*"]
      }
    ]
  }
}
```

- `{Apple Team ID}`: Apple Developer 팀 ID (10자)  
- 앱 `bundleIdentifier`: `com.eodigaljido.app` (프론트 `app.json`과 동일)

---

## 6. Android App Links (필수)

### 6.1 파일 위치

```text
GET https://share.eodigaljido.rjsgud.com/.well-known/assetlinks.json
```

- `Content-Type: application/json`  
- 리다이렉트 없이 200  

### 6.2 내용 예시

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "com.eodigaljido.app",
      "sha256_cert_fingerprints": [
        "AA:BB:CC:..."
      ]
    }
  }
]
```

- `sha256_cert_fingerprints`: **Play/App 배포용 서명 키** SHA-256 (EAS credentials / Play Console 앱 서명에서 확인)  
- 디버그·릴리스 키가 다르면 **둘 다** 넣을 수 있음  

---

## 7. CORS·보안 (권장)

| 항목 | 권장 |
|------|------|
| 공개 코스 preview | 인증 없이 조회 가능 (공유 목적) |
| 비공개·삭제 코스 | 404, 상세 메시지 최소화 |
| robots | `noindex` 가능 (검색엔진 노출 정책에 따름) |
| HTTPS | API 키가 HTML에 노출되지 않도록 서버 렌더 또는 BFF |

---

## 8. 검증 체크리스트 (백엔드 완료 기준)

- [ ] `https://share.eodigaljido.rjsgud.com/courses/public/{유효ID}` 브라우저에서 HTML 표시  
- [ ] 잘못된 ID → 404  
- [ ] `apple-app-site-association` HTTPS 200, JSON 유효  
- [ ] `assetlinks.json` HTTPS 200, 패키지·지문 일치  
- [ ] 카카오톡에 링크 붙여넣기 시 제목·설명 미리보기 (OG)  
- [ ] (실기기) 앱 설치 후 링크 탭 → 앱 실행·해당 코스 화면 (프론트 빌드·스토어 설치 후 공동 테스트)

---

## 9. 프론트에 전달할 정보 (백엔드 → 프론트)

작업 완료 시 아래를 공유해 주세요.

1. 공유 도메인 최종 URL (변경 시)  
2. Apple Team ID (AASA 작성에 사용한 값)  
3. Android `sha256_cert_fingerprints` (assetlinks에 등록한 값)  
4. Play Store / App Store URL (랜딩 버튼용)  
5. preview API 스펙 확정본 (필드명)

---

## 10. 참고 — 앱이 기대하는 URL·스킴

| 용도 | 값 |
|------|-----|
| HTTPS 공유 | `https://share.eodigaljido.rjsgud.com/courses/public/{courseId}` |
| 커스텀 스킴 | `eodigaljido://courses/public/{courseId}` |
| Android package | `com.eodigaljido.app` |
| iOS bundle id | `com.eodigaljido.app` |

---

## 11. 일정 제안 (우선순위)

1. DNS + HTTPS  
2. `/courses/public/{id}` HTML 랜딩 (MVP: 제목 + 앱에서 열기)  
3. `apple-app-site-association` + `assetlinks.json`  
4. OG 메타·preview API·스토어 링크 (개선)

---

# 부록 A. 친구 추가 링크 (코스 공유와 동일 도메인)

## A.1 URL 형식

```text
https://share.eodigaljido.rjsgud.com/friends/add/{friendCode}
```

- `friendCode`: `GET /friends/code` 로 발급되는 **초대한 사람**의 코드 (앱·API 동일)
- 수신자가 링크를 열면 앱 **전체 탭**에서 친구 추가 확인 → API 호출

## A.2 웹 랜딩 (필수)

| Method | Path | 설명 |
|--------|------|------|
| `GET` | `/friends/add/{friendCode}` | 친구 초대 HTML (비로그인 가능) |

**HTML 최소 구성**

- 초대한 사람 **닉네임** (코드로 조회, 없으면 코드만 표시)
- 「앱에서 친구 추가」 버튼 (동일 HTTPS URL)
- 앱 미설치 시 스토어 링크
- OG: `og:title` = `{닉네임}님의 친구 초대` 등

**데이터 조회 (권장)**

- `GET /api/friends/code/{friendCode}/preview` (비인증 허용)  
  → `{ friendCode, nickname, profileImageUrl? }`  
  - 잘못된 코드 → 404

## A.3 친구 추가 API (필수, 앱 연동)

프론트가 링크 수신 후 호출하는 엔드포인트 (**경로는 팀 Swagger에 맞게 확정**, 아래는 제안):

| Method | Path | Body | 인증 |
|--------|------|------|------|
| `POST` | `/friends/add` | `{ "friendCode": "ABC123" }` | Bearer 필수 |

- 성공: 200/204  
- 이미 친구: 409 + 메시지  
- 본인 코드: 400  
- 없는 코드: 404  

> 기존 `GET /friends/code`(내 코드)와 짝을 이루는 API로 구현해 주세요.

## A.4 Universal Link paths 추가

`apple-app-site-association` / `assetlinks.json` 의 `paths`에 **추가**:

```json
"paths": [
  "/courses/public/*",
  "/friends/add/*"
]
```

Android `intentFilters`: `pathPrefix: "/friends/add"` (프론트 `app.config.js`에 이미 반영)

## A.5 검증 (친구 추가)

- [ ] 링크 브라우저에서 랜딩 HTML  
- [ ] 앱 설치 + 로그인 후 링크 → 친구 추가 확인 UI → API 성공  
- [ ] 카톡 공유 미리보기
