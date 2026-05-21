# 공유 링크 — 프론트(앱) 명세

> **대상:** React Native / Expo 프론트  
> **공유 도메인:** `https://share.eodigaljido.rjsgud.com`  
> **작성 기준일:** 2026-05-20

---

## 1. 목표

- 앱 내 「공유」 시 **동작하는 HTTPS 링크** 생성  
- 링크 클릭 시 **공유 루트 탭 + 해당 코스 상세**로 진입  
- **친구 추가**도 동일 도메인·딥링크 (`/friends/add/{friendCode}`)  
- EAS production 빌드·스토어 배포 환경과 동일 설정 유지  

---

## 2. 이미 반영된 항목 (현재 코드베이스)

| 항목 | 파일 | 상태 |
|------|------|------|
| 공유 URL 생성 | `utils/shareCourse.ts` | ✅ `EXPO_PUBLIC_SHARE_BASE_URL` + `/courses/public/{id}` |
| OS 공유 시트 | `utils/shareCourse.ts` → `Share.share` | ✅ |
| React Navigation linking | `constants/shareLinking.ts`, `App.tsx` | ✅ `courses/public/:viewCourseId` → `SharedRoute` |
| Expo scheme | `app.config.js` | ✅ `eodigaljido` |
| Android App Link host | `app.config.js` | ✅ `share.eodigaljido.rjsgud.com`, path `/courses/public` |
| iOS associatedDomains | `app.config.js` | ✅ `applinks:share.eodigaljido.rjsgud.com` |
| 상세 진입 (in-app) | `SharedRouteScreen.tsx` | ✅ `viewCourseId` 파라미터 |
| 로컬 env | `.env` | ✅ `EXPO_PUBLIC_SHARE_BASE_URL=https://share.eodigaljido.rjsgud.com` |
| 친구 초대 URL | `utils/shareFriend.ts` | ✅ `/friends/add/{friendCode}` |
| 친구 링크 공유 | `AllScreen` 모달 「링크 공유」 | ✅ |
| 친구 링크 수신 | `AllScreen` + linking `All` | ✅ 확인 후 `POST /friends/add` |
| 친구 추가 API | `api/friend/friends.ts` | ✅ `addFriendByCode` (백엔드 구현 대기) |
| App Link path | `app.config.js` | ✅ `/friends/add` |

---

## 3. 프론트가 해야 할 일

### 3.1 환경 변수 (필수)

| 변수 | 값 | 비고 |
|------|-----|------|
| `EXPO_PUBLIC_SHARE_BASE_URL` | `https://share.eodigaljido.rjsgud.com` | API URL과 분리 |
| `EXPO_PUBLIC_API_BASE_URL` | 기존 백엔드 API | 공유 URL에 쓰지 않음 |

**로컬:** `.env`  
**EAS production:**

```powershell
npx eas-cli env:create production --name EXPO_PUBLIC_SHARE_BASE_URL --value https://share.eodigaljido.rjsgud.com --visibility plaintext
# 또는 env:push 시 .env.eas.production에 포함
```

배포 빌드마다 `eas env:list production`으로 값 확인.

---

### 3.2 빌드·배포 (필수)

| 작업 | 설명 |
|------|------|
| **development build / EAS build** | Universal Link·App Link는 **Expo Go만으로는 불완전**. 스토어·내부 테스트용 **네이티브 빌드** 필요 |
| `app.config.js` 변경 후 | **새 네이티브 빌드** (OTA만으로 associatedDomains·intentFilters 반영 안 됨) |
| Android 지문 | 백엔드 `assetlinks.json`에 **EAS keystore SHA-256** 전달 (빌드 후 `eas credentials -p android` 등으로 확인) |
| iOS Team ID | 백엔드 AASA의 `appID`에 **Apple Team ID** 전달 |

```powershell
npx eas-cli build -p android --profile production
npx eas-cli build -p ios --profile production   # iOS 출시 시
```

---

### 3.3 백엔드 완료 후 연동 테스트 (필수)

| # | 시나리오 | 기대 결과 |
|---|----------|-----------|
| 1 | 앱에서 코스 공유 → 링크 복사 | `https://share.eodigaljido.rjsgud.com/courses/public/{id}` |
| 2 | 링크를 **미설치 기기** 브라우저에서 열기 | 랜딩 HTML, 404 처리 |
| 3 | 링크를 **앱 설치 기기**에서 열기 | 앱 실행 → 공유 루트 → 해당 코스 상세 |
| 4 | 카카오톡에 링크 전송 | 미리보기(OG) 표시 |
| 5 | 로그아웃 상태에서 링크 | (아래 3.4) 동작 정의 후 테스트 |

---

### 3.4 로그아웃 상태 딥링크 (권장, 미구현 시 TODO)

현재 `initialRouteName`이 비로그인 시 `Login`입니다.  
외부 링크로 진입 시:

1. `courseId`를 **임시 저장** (AsyncStorage 등)  
2. 로그인·온보딩 완료 후 `SharedRoute` + `viewCourseId`로 **1회 이동**  

| 상태 | 담당 |
|------|------|
| 명세·우선순위 | 프론트 |
| 구현 | `App.tsx` 또는 `linking.subscribe` + auth store |

---

### 3.5 스토어 URL (백엔드 랜딩 연동용, 프론트 제공)

백엔드 랜딩 HTML에 넣을 링크. 스토어 등록 후 확정:

| 플랫폼 | URL (확정 후 기입) |
|--------|-------------------|
| Google Play | `https://play.google.com/store/apps/details?id=com.eodigaljido.app` |
| App Store | `{앱스토어 ID 확정 후}` |

→ 백엔드 팀에 전달 (`docs/share-link-backend-spec.md` 9절).

---

### 3.6 공유 진입점 점검 (권장)

공유 버튼이 있는 화면에서 URL이 새 도메인으로 나가는지 확인:

| 화면 | 함수 |
|------|------|
| `HomeScreen` | `sharePublicCourse` |
| `SharedRouteScreen` | (상세 내 공유 있으면 동일 유틸 사용 여부 확인) |
| 기타 | `grep sharePublicCourse` 로 전수 확인 |

---

### 3.7 문서·협업 (권장)

- 백엔드에 `docs/share-link-backend-spec.md` 전달  
- Android SHA-256, Apple Team ID, 스토어 URL 회신 요청  
- 공동 QA 체크리스트 공유 (백엔드 명세 8절 + 본 문서 3.3)

---

## 4. 수정 시 주의사항

| 변경 | 영향 |
|------|------|
| URL path 변경 (`/courses/public/...`) | `shareCourse.ts`, `shareLinking.ts`, **백엔드 AASA paths**, 랜딩 라우트 **동시 수정** |
| 공유 도메인 변경 | `.env`, EAS env, `app.config.js` host, 백엔드 DNS·well-known |
| `courseId` 형식 변경 | API·앱·랜딩 **전부 동일 규칙** |

---

## 5. 프론트 완료 체크리스트

- [x] `EXPO_PUBLIC_SHARE_BASE_URL` 로컬 `.env` 설정  
- [ ] EAS `production`에 동일 변수 등록  
- [ ] production Android/iOS **네이티브 빌드** 1회 이상 (linking 반영)  
- [ ] EAS Android keystore SHA-256 → 백엔드 `assetlinks.json` 반영 요청  
- [ ] Apple Team ID → 백엔드 AASA 반영 요청  
- [ ] 백엔드 랜딩·well-known 배포 후 실기기 링크 테스트  
- [ ] (선택) 로그아웃 상태 딥링크 보류·구현  
- [ ] (선택) Play/App Store URL 백엔드에 전달  

---

## 6. 관련 파일 맵

```text
utils/shareCourse.ts          # 코스 URL 생성 + Share API
utils/shareFriend.ts          # 친구 초대 URL + Share API
constants/shareLinking.ts     # Navigation linking prefixes·paths
screens/AllScreen.tsx         # 친구 코드 모달, 링크 공유·수신
api/friend/friends.ts         # getMyFriendCode, addFriendByCode
App.tsx                       # NavigationContainer linking={appLinking}
app.config.js                 # scheme, associatedDomains, intentFilters
screens/SharedRouteScreen.tsx # viewCourseId → 상세 모달
.env                          # EXPO_PUBLIC_SHARE_BASE_URL
api/courses.ts                # fetchSharedCourseDetail 등 (앱 내 데이터)
```

---

## 7. 백엔드 의존 관계

```text
[프론트] 공유 버튼 → HTTPS URL 생성
        ↓
[백엔드] DNS/HTTPS + 랜딩 HTML + well-known
        ↓
[OS]     App Link / Universal Link → [프론트] SharedRoute 상세
```

백엔드 랜딩·well-known **없이**는 링크가 브라우저에서만 열리거나 404이며, 앱 자동 실행이 되지 않습니다.  
프론트는 **백엔드 8절 체크리스트 완료 후** 3.3 테스트를 진행하면 됩니다.
