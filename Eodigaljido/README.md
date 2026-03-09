# Eodigaljido (어디갈지도)

React Native + Expo 기반 지도/루트 협업 앱 프로젝트입니다.

---

## 주요 라이브러리 / 프레임워크 버전

| 구분 | 라이브러리 / 프레임워크 | 버전 |
|------|-------------------------|------|
| 런타임 | **Expo SDK** | 54.x |
| 프레임워크 | **React** | 19.1.0 |
| 네이티브 | **React Native** | 0.81.0 |
| Expo | **expo** | ~54.0.0 |
| Expo | **expo-status-bar** | ~2.0.0 |

- **Expo Go**: SDK 54 지원 버전 사용 권장 (앱 내 Supported 54 기준)
- **Node.js**: 20.x 권장 (Expo SDK 54 기준)

---

## 실행 방법

```bash
# 의존성 설치
npm install

# 개발 서버 실행 (QR 코드로 Expo Go에서 실행)
npm start
# 또는
npx expo start
```

- iOS: Expo Go 앱에서 QR 코드 스캔
- Android: Expo Go 앱에서 QR 코드 스캔
- 웹: `npm run web`

---

## 프로젝트 구조

```
Eodigaljido/
├── App.js (또는 app/)
├── app.json
├── package.json
└── assets/
```

버전은 `package.json` 기준이며, 추가 패키지 설치 시 이 README의 버전 표를 함께 갱신하는 것을 권장합니다.
