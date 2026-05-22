# 공유·친구 초대 기능 — 백엔드 작업 명세

> **대상:** 백엔드 개발 / DevOps  
> **연동:** Expo 앱 `com.eodigaljido.app`, share-web `https://share.eodigaljido.rjsgud.com`  
> **API 베이스:** `EXPO_PUBLIC_API_BASE_URL` (예: `http://3.36.85.213:8080`)  
> **Swagger:** http://3.36.85.213:8080/swagger-ui/index.html  
> **Swagger 대조·공동편집·신규 API:** [backend-api-request-from-swagger.md](./backend-api-request-from-swagger.md)  
> **작성일:** 2026-05-20

---

## 0. 한 줄 요약

카톡·문자로 나가는 **공유 링크**를 위해, (1) **비로그인 preview API** 2개, (2) **기존 공개 코스·친구 추가 API** 의 인증/권한 정리, (3) **CORS** 를 백엔드에서 반드시 처리해야 합니다.  
지금 share-web에서 보이는 **401** 은 프론트 버그가 아니라 **Spring Security `permitAll` 미설정** 이 주원인입니다.

---

## 1. 기능 목표 (백엔드 관점)

| 사용자 시나리오 | 백엔드 역할 |
|-----------------|-------------|
| 앱 **미설치**, 코스 링크 클릭 | preview API로 **제목·지역·썸네일** 등 최소 정보 제공 (비로그인) |
| 앱 **미설치**, 친구 링크 클릭 | preview API로 **초대자 닉네임·코드** 제공 (비로그인) |
| 앱 **설치·로그인**, 코스 링크 | `GET /api/courses/{courseId}` 로 **공개 코스 상세** (로그인 Bearer) |
| 앱 **설치·로그인**, 친구 링크 | `POST /api/friends/add` 로 **친구 관계 생성** (로그인 Bearer) |

> HTML 랜딩·Universal Links JSON·SPA UI는 **share-web / DevOps** 담당.  
> 본 문서는 **REST API + Security + CORS** 만 다룹니다.

---

## 2. URL·식별자 (앱과 동일해야 함)

### 2.1 공유 도메인 (참고)

| 항목 | 값 |
|------|-----|
| HTTPS 공유 베이스 | `https://share.eodigaljido.rjsgud.com` |
| 코스 링크 | `/courses/public/{courseId}` |
| 친구 링크 | `/friends/add/{friendCode}` |
| 앱 커스텀 스킴 | `eodigaljido://` (동일 path) |

### 2.2 ID 규칙

| 필드 | 설명 |
|------|------|
| `courseId` | 공개(PUBLISHED) 코스의 서버 ID. 앱 `GET /api/courses/public` 목록·`GET /api/courses/{courseId}` 와 **동일 문자열** |
| `friendCode` | 초대 **발신자** 코드. 앱 `GET /api/friends/code` 응답과 동일 (예: `ESSP3P`) |

로컬 전용 ID (`ur-...` 등)는 앱에서 공유 링크 생성을 막음 → API에 오면 **404**.

---

## 3. 우선순위

| 우선순위 | 작업 | 없을 때 증상 |
|----------|------|----------------|
| **P0** | preview API 2개 구현 + **permitAll** | share-web **401**, 「잠시 후 다시 시도」 |
| **P0** | CORS에 share 도메인 허용 | 브라우저에서 API 호출 차단 |
| **P0** | `POST /api/friends/add` 동작·에러 코드 정리 | 앱에서 친구 추가 실패 |
| **P1** | `GET /api/courses/{courseId}` 비로그인 시 공개 코스만 200 | preview 장애 시 share-web fallback |
| **P1** | Rate limit·Cache-Control on preview | 공유 트래픽 대비 |
| **P2** | Swagger 문서·프론트 전달 필드 확정 | 연동 혼선 |

---

## 4. Spring Security — 비로그인 허용 (P0)

share-web·카톡 인앱 브라우저는 **Authorization 헤더 없음**.  
아래 `GET` 은 **401/403 없이** 동작해야 합니다.

| Method | Path | 비고 |
|--------|------|------|
| `GET` | `/api/courses/public` | 공개 코스 목록 (기존) |
| `GET` | `/api/courses/public/{courseId}/preview` | **신규 권장** |
| `GET` | `/api/courses/{courseId}` | **공개 코스만** 200, 그 외 404 |
| `GET` | `/api/friends/code/{friendCode}/preview` | **신규 권장** |

**인증 필수 (변경 없음)**

| Method | Path |
|--------|------|
| `GET` | `/api/friends/code` | 내 친구 코드 |
| `GET` | `/api/friends` | 친구 목록 |
| `POST` | `/api/friends/add` | 친구 추가 |
| `POST` | `/api/courses/{courseId}/save` 등 | 저장·리뷰·내 코스 |

### 4.1 Spring Security 6 예시

```java
http.authorizeHttpRequests(auth -> auth
    .requestMatchers(HttpMethod.GET,
        "/api/courses/public",
        "/api/courses/public/*/preview",
        "/api/courses/*",                    // 상세: 컨트롤러에서 공개 여부 검사
        "/api/friends/code/*/preview"
    ).permitAll()
    .anyRequest().authenticated()
);
```

> `GET /api/courses/*` 를 permitAll 할 때, **비공개·타인 비공개 코스는 반드시 404** (403 대신 404 권장 — ID 존재 여부 노출 최소화).

### 4.2 검증 (배포 후 필수)

```bash
# 토큰 없이 — 모두 200 (유효 ID/코드 기준)
curl -i "http://{API_HOST}/api/courses/public/{courseId}/preview"
curl -i "http://{API_HOST}/api/friends/code/ESSP3P/preview"

# 토큰 없이 — 잘못된 값 → 404
curl -i "http://{API_HOST}/api/courses/public/invalid-id/preview"
curl -i "http://{API_HOST}/api/friends/code/XXXXXX/preview"
```

**401이 나오면 P0 미완료.**

---

## 5. CORS (P0)

share-web origin에서 API를 직접 호출합니다.

| 설정 | 값 |
|------|-----|
| Allowed Origins | `https://share.eodigaljido.rjsgud.com` |
| 개발용 (선택) | `http://localhost:5173` (Vite) |
| Methods | `GET`, `POST`, `OPTIONS` |
| Headers | `Content-Type`, `Authorization` (앱 WebView 대비) |
| Credentials | share-web은 쿠키 미사용 → `false` 가능 |

**Preflight:** `OPTIONS /api/**` 200.

---

## 6. API 명세 — 코스 preview (P0)

### `GET /api/courses/public/{courseId}/preview`

공유 링크·OG·share-web 카드용 **최소 필드**. 비로그인 허용.

**Path**

| 이름 | 타입 | 설명 |
|------|------|------|
| `courseId` | string | 공개 코스 ID |

**성공 `200`**

```json
{
  "courseId": "7ecc5401-xxxx",
  "title": "한강 데이트 코스",
  "region": "서울",
  "category": "데이트",
  "durationLabel": "약 3시간",
  "thumbnailUrl": "https://cdn.example.com/thumb.jpg",
  "departure": "여의도역",
  "arrival": "뚝섬",
  "tags": ["야경", "산책"],
  "saveCount": 120,
  "rating": 4.5,
  "isPublic": true
}
```

| 필드 | 필수 | 설명 |
|------|------|------|
| `courseId` | O | |
| `title` | O | OG `og:title` |
| `region` | 권장 | |
| `category` | 권장 | |
| `durationLabel` | 권장 | 예: `약 3시간` (서버에서 포맷) |
| `thumbnailUrl` | 권장 | HTTPS 절대 URL, OG `og:image` |
| `departure` / `arrival` | 선택 | 한 줄 요약용 |
| `tags` | 선택 | 최대 4개까지 잘라도 됨 |
| `saveCount` / `rating` | 선택 | |
| `isPublic` | O | `false`면 404 처리 |

**에러**

| HTTP | 조건 |
|------|------|
| 404 | 없는 ID, 비공개, 삭제, DRAFT |
| 401 | **금지** (비로그인 허용 미설정 시 버그) |

**캐시 (P1)**

```
Cache-Control: public, max-age=300
```

---

## 7. API 명세 — 친구 preview (P0)

### `GET /api/friends/code/{friendCode}/preview`

친구 초대 링크·share-web용. **초대 발신자** 정보만 노출. 비로그인 허용.

**Path**

| 이름 | 타입 | 설명 |
|------|------|------|
| `friendCode` | string | 대소문자 정책 팀 규칙에 따름 (앱은 trim만) |

**성공 `200`**

```json
{
  "friendCode": "ESSP3P",
  "nickname": "홍길동",
  "profileImageUrl": "https://cdn.example.com/u/1.jpg"
}
```

| 필드 | 필수 | 설명 |
|------|------|------|
| `friendCode` | O | |
| `nickname` | O | 없으면 `"어디갈지도 사용자"` 등 기본값 |
| `profileImageUrl` | 선택 | null 가능 |

**에러**

| HTTP | 조건 |
|------|------|
| 404 | 없는·만료·비활성 코드 |
| 401 | **금지** |

**보안**

- 이메일·전화번호·내부 userId **노출 금지**
- 탈퇴 사용자 코드 → 404

---

## 8. API 명세 — 기존 연동 (확인·보완)

### 8.1 공개 코스 목록 (기존)

`GET /api/courses/public` — 비로그인 허용 유지.

### 8.2 공개 코스 상세 (기존 + P1)

`GET /api/courses/{courseId}`

| 호출자 | 기대 |
|--------|------|
| 비로그인 | **공개(PUBLISHED) 코스만** 200, 전체 `CourseItem` 또는 기존 DTO |
| 로그인 | 동일 + 앱에서 지도·경로·리뷰 등 사용 |
| 비공개 | 404 |

앱 `SharedRouteScreen` 딥링크가 이 API를 사용합니다. preview와 **courseId 동일**해야 합니다.

### 8.3 내 친구 코드 (기존)

`GET /api/friends/code`  
- **인증 필수**  
- 응답: `{ "friendCode": "ESSP3P" }`

### 8.4 친구 코드로 추가 (P0)

`POST /api/friends/add`  
- **인증 필수** (`Authorization: Bearer {accessToken}`)  
- **Content-Type:** `application/json`

**Request**

```json
{
  "friendCode": "ESSP3P"
}
```

**성공**

| HTTP | Body |
|------|------|
| 200 | `{ "message": "ok" }` 또는 친구 요약 DTO |
| 204 | No Content |

**에러 (앱 Alert에 `message` 표시)**

| HTTP | 조건 | `message` 예시 |
|------|------|----------------|
| 400 | 본인 코드로 추가 시도 | `자신의 친구 코드는 추가할 수 없습니다` |
| 404 | 없는 코드 | `존재하지 않는 친구 코드입니다` |
| 409 | 이미 친구 | `이미 친구입니다` |
| 401 | 미로그인 | `로그인이 필요합니다` |

**비즈니스 규칙 (권장)**

- 친구 수 상한 있으면 400/403 + 메시지
- 차단 관계면 403
- 성공 시 양방향 친구 또는 요청→수락 모델은 **기존 채팅/친구 도메인과 동일**하게

---

## 9. 공개 코스 판별 규칙 (백엔드 단일 정의)

preview·상세·목록이 **같은 조건**을 써야 합니다.

권장 조건 (팀 DB에 맞게 조정):

```
코스.status == PUBLISHED
AND 코스.shareEnabled == true   // POST /api/courses/my/{id}/share 이후
AND 코스.deletedAt IS NULL
```

- `POST /api/courses/my/{courseId}/share` — 공유 ON  
- `DELETE /api/courses/my/{courseId}/share` — 공유 OFF → preview/상세 **404**

---

## 10. DevOps (백엔드·인프라 협업)

API 서버와 share 도메인이 **분리**되어 있어도 됩니다.  
아래는 API 서버 외 **share 호스트** 작업 — 백엔드 팀이 웹팀과 나눠도 되나 **완료 전까지 앱 링크가 웹에서만 열림**.

| 항목 | 담당 | 요구 |
|------|------|------|
| DNS `share.eodigaljido.rjsgud.com` | DevOps | HTTPS |
| `/.well-known/apple-app-site-association` | DevOps/웹 | paths: `/courses/public/*`, `/friends/add/*` |
| `/.well-known/assetlinks.json` | DevOps/웹 | `com.eodigaljido.app` + Play 서명 SHA-256 |
| share-web SPA | 프론트(별도 레포) | API는 본 문서 P0 |

---

## 11. 앱·share-web 호출 흐름 (참고)

### 코스

```
[비로그인 브라우저] GET /api/courses/public/{id}/preview → 200
[앱 설치·로그인]     GET /api/courses/{id} + UI 상세
```

### 친구

```
[비로그인 브라우저] GET /api/friends/code/{code}/preview → 200
[앱 설치·로그인]     POST /api/friends/add { friendCode }
```

---

## 12. 완료 체크리스트 (백엔드 QA)

### P0

- [ ] `curl` preview 코스 — 토큰 없이 **200**
- [ ] `curl` preview 친구 — 토큰 없이 **200**
- [ ] 잘못된 courseId / friendCode → **404** (401 아님)
- [ ] CORS: share 도메인에서 브라우저 `fetch` 성공
- [ ] `POST /api/friends/add` — 로그인 시 성공, 본인 코드 400, 중복 409
- [ ] 비공개 코스 preview → 404

### P1

- [ ] `GET /api/courses/{id}` 비로그인 + 공개 코스 200
- [ ] preview `Cache-Control` 적용
- [ ] Rate limit (IP당 분당 N회 등)

### 연동

- [ ] Swagger에 경로·DTO 반영
- [ ] 프론트에 **확정 JSON 필드명** 공유 (5절·7절 표)

---

## 13. 프론트·백엔드 핸드오프

배포 후 백엔드 → 앱/웹 팀에 전달:

1. preview API **실제 응답 JSON 샘플** (코스 1건, 친구 1건)  
2. `friendCode` 대소문자·길이·문자셋 규칙  
3. 공개 코스 판별 필드명 (`shareEnabled` 등)  
4. Play Store / App Store URL (랜딩용, 선택)  
5. API 베이스 URL 프로덕션 확정

---

## 14. 일정 제안

| 단계 | 작업 | 예상 |
|------|------|------|
| 1일차 | Security permitAll + CORS + preview 2개 | 401 해소 |
| 2일차 | `POST /friends/add` 에러 코드·409/400 정리 | 친구 링크 앱 동작 |
| 3일차 | 공개 상세 비로그인·캐시·Swagger | fallback·문서 |
| 병행 | DevOps well-known (앱 링크 자동 열기) | 앱 팀과 공동 테스트 |

---

## 부록 — 앱이 사용 중인 경로 (Swagger 대조용)

| 용도 | Method | Path | 인증 |
|------|--------|------|------|
| 공개 목록 | GET | `/api/courses/public` | 없음 |
| 공개 상세 | GET | `/api/courses/{courseId}` | 없음(공개만) |
| 코스 preview | GET | `/api/courses/public/{courseId}/preview` | **없음** |
| 내 코드 | GET | `/api/friends/code` | Bearer |
| 친구 preview | GET | `/api/friends/code/{friendCode}/preview` | **없음** |
| 친구 추가 | POST | `/api/friends/add` | Bearer |
| 공유 ON | POST | `/api/courses/my/{courseId}/share` | Bearer |
| 공유 OFF | DELETE | `/api/courses/my/{courseId}/share` | Bearer |

---

## 변경 이력

| 날짜 | 내용 |
|------|------|
| 2026-05-20 | 최초 작성 (401 이슈·친구 preview·P0/P1 분리) |
