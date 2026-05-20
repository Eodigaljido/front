# 어디갈지도 — 빌드 · 배포 가이드

심사·출시 기준으로 **지금 레포 상태**에서 앱을 빌드하고 스토어에 올리는 순서입니다.

---

## 1. 사전 확인

| 항목 | 확인 |
|------|------|
| Node.js | 20 LTS 권장 |
| Expo 계정 | `npx eas-cli whoami` → `rjsgud49` |
| `.env` | 로컬 개발용 (Git 미포함). **출시 API·키는 EAS production에 등록** |
| `expo doctor` | `npx expo-doctor` → 17/17 통과 |
| 커밋 | 배포할 변경사항 `main`에 push |

---

## 2. 로컬 개발 (심사 시연)

```powershell
cd front
npm install
npx expo start -c
```

- Expo Go로 UI 확인 가능. **공유 링크·App Link·일부 네이티브 지도**는 **스토어/내부 테스트 빌드**에서 확인.
- 출시용이 아닌 테스트 로그인: `.env`의 `EXPO_PUBLIC_TEST_LOGIN=1` (EAS production에는 `0`).

---

## 3. EAS Production 환경 변수

빌드는 **`.env`가 아니라 EAS `production` 환경** 값을 씁니다.

### 필수 변수

| 변수 | 출시 예시 |
|------|-----------|
| `EXPO_PUBLIC_API_BASE_URL` | 운영 API URL |
| `EXPO_PUBLIC_SHARE_BASE_URL` | `https://share.eodigaljido.rjsgud.com` |
| `EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY` | (값) |
| `EXPO_PUBLIC_GOOGLE_MAPS_DIRECTIONS_API_KEY` | (값) |
| `EXPO_PUBLIC_KAKAO_REST_API_KEY` | (값) |
| `EXPO_PUBLIC_TMAP_APP_KEY` | (값) |
| `EXPO_PUBLIC_WEATHER_API_KEY` | (값) |
| `EXPO_PUBLIC_OAUTH_REDIRECT_URI` | (값) |
| `EXPO_PUBLIC_TEST_LOGIN` | **`0`** |

```powershell
npx eas-cli env:list production
# 없으면
npx eas-cli env:push production
```

빈 값 변수는 push 오류 날 수 있음 → **값 있는 항목만** 등록.

---

## 4. Android Production 빌드

```powershell
npx eas-cli build -p android --profile production
```

- **산출물:** AAB (`eas.json` → `app-bundle`)
- **versionCode:** EAS `autoIncrement` (빌드마다 +1)
- 빌드 로그: [Expo Builds](https://expo.dev/accounts/rjsgud49/projects/Eodigaljido/builds)

완료 후 터미널 또는 대시보드에서 **AAB 다운로드 URL** 확인.

### 빌드 전 체크

- [ ] `package.json` / `package-lock.json` 의존성 정리 후 `npm install`
- [ ] `npx expo-doctor` 통과
- [ ] EAS production env에 `EXPO_PUBLIC_TEST_LOGIN=0`
- [ ] `app.config.js` 변경(딥링크 등) 후에는 **반드시 새 네이티브 빌드** (OTA만으로는 부족)

---

## 5. Play Store 업로드

### A. EAS Submit (권장, 최초 1회 설정 필요)

Google Play **서비스 계정 JSON**을 EAS에 등록한 뒤:

```powershell
npx eas-cli submit -p android --profile production --id <BUILD_ID>
```

한 번에 빌드+제출:

```powershell
npx eas-cli build -p android --profile production --auto-submit-with-profile production
```

> 최초에 `Google Service Account Keys cannot be set up in --non-interactive mode` → 대화형 `npx eas-cli submit -p android`로 키 등록 후 재시도.

### B. Play Console 수동

1. AAB 다운로드  
2. [Play Console](https://play.google.com/console) → **내부 테스트** (또는 프로덕션)  
3. 새 릴리스 → AAB 업로드 → 검토·출시  

`eas.json` 기본 트랙: `internal`.

---

## 6. iOS (필요 시)

```powershell
npx eas-cli build -p ios --profile production
npx eas-cli submit -p ios --profile production --id <BUILD_ID>
```

Apple Developer·인증서는 EAS credentials로 관리.

---

## 7. 공유 링크 (별도 작업)

| 구분 | 담당 | 상태 |
|------|------|------|
| 앱 공유 URL·딥링크 | 이 레포 (`shareCourse`, `shareFriend`, `app.config.js`) | 코드 반영됨 |
| 웹 랜딩 | `eodigaljido-share-web` (Vite, 별도 프로젝트) | 별도 배포 |
| DNS·HTTPS | `share.eodigaljido.rjsgud.com` | 인프라 |
| `/.well-known` | 웹 또는 서버 | App Link용 |

**앱만 올려도** 공유는 URL 문자열 전송까지 가능. **링크 클릭 → 웹/앱 자동 열기**는 웹 랜딩 + well-known 배포 후 확인.

---

## 8. 심사·데모 시나리오 제안

1. 로그인 → 홈 → 공유 루트 코스 열람  
2. 루트 제작 → 저장 → 내 루트  
3. 코스 공유(링크 생성) — 수신은 웹/앱 준비 후  
4. 전체 탭 → 친구 추가(코드·링크 공유)  
5. 채팅 목록·방 입장  

---

## 9. 자주 나는 문제

| 증상 | 조치 |
|------|------|
| `expo doctor` 실패 | `npx expo install --fix` 후 `npm install` |
| Metro `react-native` resolve 실패 | `npx expo start -c`, 필요 시 `node_modules` 삭제 후 재설치 |
| 빌드는 됐는데 API가 dev | `eas env:list production` URL·`TEST_LOGIN` 확인 |
| App Link 안 열림 | 새 빌드 설치, well-known·도메인 HTTPS 확인 |

---

## 10. 한 줄 요약

```powershell
npm install
npx expo-doctor
npx eas-cli env:list production
npx eas-cli build -p android --profile production
npx eas-cli submit -p android --profile production --id <BUILD_ID>
```
