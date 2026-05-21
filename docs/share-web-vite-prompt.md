# 공유 랜딩 웹 빌드 프롬프트 (Vite + React + TS + Tailwind + Axios)

> AI/개발자에게 **이 문서만** 전달해 `eodigaljido-share-web` 프로젝트를 생성.  
> 앱(Expo)과 **URL·스킴·디자인 톤** 일치 필수.

---

## 요약

| 항목 | 값 |
|------|-----|
| 서비스 | 어디갈지도 (Eodigaljido) |
| 도메인 | `https://share.eodigaljido.rjsgud.com` |
| 역할 | 공유 링크 → 웹 미리보기 → 앱 열기 / 스토어 |
| 앱 스킴 | `eodigaljido` |
| 패키지 | `com.eodigaljido.app` |

---

## 스택

Vite · React 19 · TypeScript · Tailwind 3 · Axios · `react-router-dom` · `react-helmet-async` · `lucide-react`  
(Next/MUI/Redux 사용 금지)

```bash
npm create vite@latest eodigaljido-share-web -- --template react-ts
cd eodigaljido-share-web
npm i axios react-router-dom react-helmet-async lucide-react
npm i -D tailwindcss postcss autoprefixer && npx tailwindcss init -p
```

배포: SPA — 모든 경로 `index.html` (`/.well-known` 제외).

---

## 환경 변수 (`.env.example`)

```env
VITE_API_BASE_URL=http://3.36.85.213:8080
VITE_SHARE_SITE_URL=https://share.eodigaljido.rjsgud.com
VITE_APP_SCHEME=eodigaljido
VITE_PLAY_STORE_URL=https://play.google.com/store/apps/details?id=com.eodigaljido.app
VITE_APP_STORE_URL=
VITE_OG_IMAGE_URL=https://share.eodigaljido.rjsgud.com/og-default.png
```

개발 시 Vite proxy: `/api` → `VITE_API_BASE_URL`.

---

## 디자인 (앱과 동일 톤)

- 배경 `#F0F5FF`, 카드 흰색, primary `#2563EB`, 텍스트 `#1A1A2E`
- Pretendard, 모바일 우선 `max-w-md mx-auto`, 카드 `rounded-2xl` + 연한 파란 테두리
- Primary 버튼: 파란 배경 / Secondary: 흰색 테두리
- 공통 레이아웃: Header(로고+어디갈지도) · Main · Footer(스토어 링크)

---

## 라우팅 (변경 금지)

| Path | 페이지 |
|------|--------|
| `/` | 홈 — 소개 + 앱 다운로드 |
| `/courses/public/:courseId` | **공유 코스** 랜딩 |
| `/friends/add/:friendCode` | **친구 초대** 랜딩 |
| `*` | 404 |

`public/.well-known/apple-app-site-association` · `assetlinks.json`  
paths: `/courses/public/*`, `/friends/add/*` · 패키지 `com.eodigaljido.app` (Team ID·SHA256은 placeholder + README 안내)

---

## 페이지 요약 — 기대 UX (필수)

| 상황 | 코스 공유 | 친구 초대 |
|------|-----------|-----------|
| **앱 없음 (브라우저)** | preview API로 **미리보기**(제목·지역·썸네일 등). 지도·저장·안내 시작은 **앱 전용** → 「Google Play / App Store에서 설치」 강조 | preview로 닉네임·코드 표시. 「앱 설치 후 친구 추가」 |
| **앱 있음** | 「앱에서 코스 보기」→ Universal Link / 스킴 → 앱 `SharedRoute` + `viewCourseId` | 「앱에서 친구 추가」→ 앱 `All` + 확인 Alert → `POST /friends/add` |
| **preview API 401** | API 실패해도 **설치·앱 열기 버튼은 항상 표시**. 본문: 「앱에서 전체 코스 보기」. 재시도는 보조(백엔드 permitAll 전까지 한계) | 동일. 코드(`ESSP3P`)는 URL에서 표시 가능 |
| **preview API 200** | 미리보기 + 「앱에서 열기」·스토어 | 닉네임·아바타 + 「앱에서 친구 추가」·스토어 |

> 401 = 백엔드가 비로그인 preview를 막음. share-web 버그가 아니면 **백엔드 permitAll** 필요.

### 코스 `/courses/public/:id`
- API (axios **Authorization·쿠키 금지**):
  1. `GET /api/courses/public/{id}/preview`
  2. 실패 시 `GET /api/courses/{id}` (공개만)
- **401/404:** ErrorState에 「앱에서 전체 보기」+ Play/App Store + `openInApp(courseId)` (재시도만 메인 CTA로 두지 말 것)
- **200:** 썸네일, 제목, 지역·카테고리·소요, 출발→도착, 태그. 하단 고정: 「앱에서 코스 보기」「앱 설치」
- OG: 제목·지역·썸네일

### 친구 `/friends/add/:code`
- API: `GET /api/friends/code/{code}/preview` (401 시 URL의 code만 표시)
- **401:** 「{code} 친구 초대」+ 「앱 설치」+ 「앱에서 친구 추가」
- **200:** 아바타, `{닉네임}님 친구 초대`, 코드 박스
- OG: `{닉네임}님의 친구 초대 | 어디갈지도`

### 홈 `/`
- 슬로건 + 기능 3줄 + 스토어 CTA

### 404
- 안내 + 홈 링크

---

## 앱 열기 (`src/utils/openInApp.ts`)

```ts
// eodigaljido://courses/public/{id}  또는  eodigaljido://friends/add/{code}
// 버튼: 스킴 시도 → 실패 시 universal URL 또는 스토어
```

HTTPS URL은 앱과 동일 path 유지.

---

## 폴더 (핵심만)

```
src/
  api/          client, courses, friends
  components/   AppShell, Header, Footer, Button, TagChip, Skeleton, ErrorState
  pages/        Home, CourseShare, FriendInvite, NotFound
  utils/        openInApp, formatDuration
  config/       env.ts
  router.tsx
```

---

## 백엔드 요청 (CORS)

- `https://share.eodigaljido.rjsgud.com` origin 허용
- preview API 2개 권장 (명세: `share-link-backend-spec.md` 부록 A)

---

## 완료 기준

- [ ] 두 공유 URL에서 데이터·OG·앱 열기 버튼 동작
- [ ] 모바일 375px 레이아웃 OK
- [ ] `npm run build` 성공
- [ ] well-known JSON 배포

---

## AI 실행 지시 (복붙)

```
eodigaljido-share-web를 위 명세대로 생성하라.
Vite+React+TS+Tailwind+Axios, 라우트 4개, 앱 톤 디자인, axios preview+fallback,
react-helmet-async OG, openInApp, .well-known, 한국어 UI, README·.env.example 포함.
과한 추상화·불필요 주석 금지.
```
