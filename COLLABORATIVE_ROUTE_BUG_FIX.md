# 공동 루트 초대 기능 버그 수정 요구사항

## 📋 목차
1. [현재 문제](#현재-문제)
2. [근본 원인](#근본-원인)
3. [요구사항 상세](#요구사항-상세)
4. [API 엔드포인트 수정](#api-엔드포인트-수정)
5. [백엔드 체크포인트](#백엔드-체크포인트)
6. [테스트 시나리오](#테스트-시나리오)
7. [핵심 요약](#핵심-요약)

---

## 현재 문제

### 사용자 재현 경로
```
1. 내 루트 → 수정 → 공유 → 공동 루트 초대
2. 친구에게 공유 → 특정 친구에게 초대 전송
3. 새로운 채팅방 생성 + 초대 메시지 전송 ✅
4. 친구가 초대 메시지 클릭
5. "루트를 찾을 수 없어요" 오류 발생 ❌
```

### 로그 분석

**저장된 루트 상태:**
```json
{
  "uuid": "06f07eb4-6af6-49fa-bcbb-1eee3c8e5389",
  "title": "창원 루트",
  "collaborative": false,  ← ❌ false로 저장됨!
  "chatRoomUuid": "93417386-ddf1-4d79-87d8-ba6fe2319a14",
  "version": 34
}
```

**친구 멤버 추가 시도:**
```
POST /api/courses/my/06f07eb4-6af6-49fa-bcbb-1eee3c8e5389/members
{ "userUuid": "friend-uuid" }

응답: 404 COURSE_NOT_COLLABORATIVE
메시지: "COURSE_NOT_COLLABORATIVE"
```

**친구가 접근 시도:**
```
GET /api/courses/my/06f07eb4-6af6-49fa-bcbb-1eee3c8e5389
또는
GET /api/courses/collaborative/06f07eb4-6af6-49fa-bcbb-1eee3c8e5389

응답: 
  - 404 (NOT_FOUND)
  - 또는 403 (해당 코스에 접근할 권한이 없습니다)
```

---

## 근본 원인

**루트가 공동 편집 모드(`collaborative: true`)로 저장되지 않음**

### 현재 흐름
```
프론트엔드 → PATCH /api/courses/my/{id}
            { collaborative: true, chatRoomUuid: "..." }
            
백엔드 → collaborative 필드 무시
      → 항상 collaborative: false로 저장
      
결과 → 멤버 추가 불가
    → 친구가 접근 불가
```

### 영향 범위
| 기능 | 현재 | 필요 |
|------|------|------|
| **루트 저장** | ✅ 성공 | ✅ 성공 |
| **채팅방 생성** | ✅ 성공 | ✅ 성공 |
| **멤버 추가** | ❌ 실패 (404) | ✅ 성공 |
| **친구 접근** | ❌ 실패 (403/404) | ✅ 성공 |
| **친구 편집** | ❌ 불가능 | ✅ 가능 |

---

## 요구사항 상세

### 요구사항 1: 루트 저장 시 collaborative 플래그 저장

**현재 동작:**
```typescript
// 백엔드에서 collaborative 필드를 무시함
UPDATE courses 
SET title = ?, stops = ?, legs = ?
WHERE uuid = ?;
// ❌ collaborative 필드 누락
```

**필요한 동작:**
```typescript
// collaborative 필드를 명시적으로 처리
UPDATE courses 
SET title = ?, 
    stops = ?, 
    legs = ?,
    collaborative = ?  // ← 반드시 포함
WHERE uuid = ?;
```

### 요구사항 2: 공동 루트만 멤버 추가 가능

**현재 동작:**
```typescript
// collaborative 상태와 관계없이 404 반환
if (course.collaborative !== true) {
  return { status: 404, message: "COURSE_NOT_COLLABORATIVE" };
}
```

**필요한 동작:**
```typescript
// collaborative: true인 루트에만 멤버 추가 가능
if (!course.collaborative) {
  return { status: 400, message: "루트를 공동 편집 모드로 전환해주세요" };
}

// 멤버 추가 성공
await addMember(courseId, userUuid);
return { status: 201, message: "멤버 추가 완료" };
```

### 요구사항 3: 멤버로 등록된 친구가 루트 접근 가능

**현재 동작:**
```typescript
// 멤버 등록이 실패했으므로 친구는 접근 불가
GET /api/courses/my/{courseId}
→ 403 Forbidden (권한 없음)

GET /api/courses/collaborative/{courseId}
→ 404 Not Found
```

**필요한 동작:**
```typescript
// 멤버로 등록되면 접근 가능
GET /api/courses/my/{courseId}
→ 200 OK (루트 정보 반환)

GET /api/courses/collaborative/{courseId}
→ 200 OK (collaborative: true인 루트 정보 반환)
```

---

## API 엔드포인트 수정

### 1. 루트 저장/수정 (PATCH)

**엔드포인트:**
```
PATCH /api/courses/my/{courseId}
```

**요청 본문:**
```json
{
  "title": "공동 루트",
  "stops": [
    { "name": "출발", "lat": 35.2271, "lng": 128.5831 },
    { "name": "경유지", "lat": 35.2300, "lng": 128.5900 },
    { "name": "도착", "lat": 35.2350, "lng": 128.6000 }
  ],
  "legs": [
    { "mode": "walk", "minutes": 10 },
    { "mode": "transit", "transitType": "subway", "minutes": 20 }
  ],
  "collaborative": true,
  "chatRoomUuid": "93417386-ddf1-4d79-87d8-ba6fe2319a14"
}
```

**현재 동작:**
- ❌ `collaborative` 필드 무시
- ❌ 항상 `collaborative: false`로 저장

**필요한 동작:**
- ✅ `collaborative` 필드 값 확인
- ✅ 요청 값 그대로 DB에 저장
- ✅ 응답에 `"collaborative": true` 포함

**응답 본문:**
```json
{
  "uuid": "06f07eb4-6af6-49fa-bcbb-1eee3c8e5389",
  "title": "공동 루트",
  "collaborative": true,
  "chatRoomUuid": "93417386-ddf1-4d79-87d8-ba6fe2319a14",
  "version": 1
}
```

---

### 2. 멤버 추가

**엔드포인트:**
```
POST /api/courses/my/{courseId}/members
```

**요청 본문:**
```json
{
  "userUuid": "friend-uuid-123"
}
```

**현재 동작:**
```
상태: 404
메시지: COURSE_NOT_COLLABORATIVE
원인: collaborative: false이므로 멤버 추가 불가
```

**필요한 동작:**
```
1. 루트의 collaborative 값 확인
2. collaborative: false면:
   - 상태: 400
   - 메시지: 루트를 공동 편집 모드로 전환해주세요
3. collaborative: true면:
   - 멤버 추가 실행
   - 상태: 201 Created
   - 응답: { "userUuid": "...", "role": "EDITOR", ... }
```

**응답 본문 (성공):**
```json
{
  "userUuid": "friend-uuid-123",
  "userId": "friend-id",
  "nickname": "친구이름",
  "role": "EDITOR",
  "addedAt": "2026-06-22T11:06:00Z"
}
```

---

### 3. 루트 조회 (친구 입장)

**엔드포인트 A:**
```
GET /api/courses/my/{courseId}
```

**엔드포인트 B:**
```
GET /api/courses/collaborative/{courseId}
```

**현재 동작:**
```
친구 계정으로 요청 시:
- 404 Not Found (권한 없음)
- 또는 403 Forbidden (접근 불가)
```

**필요한 동작:**
```
1. courseId의 collaborative 값 확인
2. collaborative: false면:
   - 루트 소유자만 접근 가능
3. collaborative: true면:
   - 멤버로 등록된 모든 사용자가 접근 가능
   - 친구도 접근 가능 ✅
```

**응답 본문 (친구가 접근 시 200 OK):**
```json
{
  "uuid": "06f07eb4-6af6-49fa-bcbb-1eee3c8e5389",
  "title": "창원 루트",
  "collaborative": true,
  "chatRoomUuid": "93417386-ddf1-4d79-87d8-ba6fe2319a14",
  "version": 34,
  "stops": [...],
  "legs": [...]
}
```

---

### 4. 루트 편집 (친구가 편집)

**엔드포인트:**
```
PATCH /api/courses/my/{courseId}
```

**현재 동작:**
```
친구 계정으로 요청 시:
- 403 Forbidden (해당 코스에 접근할 권한이 없습니다)
```

**필요한 동작:**
```
1. courseId의 collaborative 값 확인
2. collaborative: true면:
   - 멤버로 등록된 사용자의 편집 허용
3. 버전 충돌 처리 (409)
4. 편집 성공 (200)
```

---

## 백엔드 체크포인트

### 체크포인트 1: 저장 로직

**파일 위치:** `CourseController.java` 또는 해당 Service

**현재 코드:**
```java
// ❌ 잘못된 것
public void saveCourse(Course course) {
    course.setTitle(request.getTitle());
    course.setStops(request.getStops());
    course.setLegs(request.getLegs());
    // collaborative 필드 누락!
    courseRepository.save(course);
}
```

**수정 후 코드:**
```java
// ✅ 올바른 것
public void saveCourse(Course course) {
    course.setTitle(request.getTitle());
    course.setStops(request.getStops());
    course.setLegs(request.getLegs());
    course.setCollaborative(request.isCollaborative());  // ← 추가
    courseRepository.save(course);
}
```

---

### 체크포인트 2: 멤버 추가 검증

**파일 위치:** `CourseMemberController.java` 또는 해당 Service

**현재 코드:**
```java
// ❌ 잘못된 것
public void addMember(String courseId, String userUuid) {
    Course course = courseRepository.findById(courseId);
    if (course == null || !course.isCollaborative()) {
        throw new ApiException(404, "COURSE_NOT_COLLABORATIVE");
    }
    // ...
}
```

**수정 후 코드:**
```java
// ✅ 올바른 것
public void addMember(String courseId, String userUuid) {
    Course course = courseRepository.findById(courseId);
    
    // 1. 루트 존재 여부 확인
    if (course == null) {
        throw new ApiException(404, "NOT_FOUND", "루트를 찾을 수 없습니다");
    }
    
    // 2. 공동 편집 모드 확인
    if (!course.isCollaborative()) {
        throw new ApiException(400, "NOT_COLLABORATIVE", 
            "루트를 공동 편집 모드로 전환해주세요");
    }
    
    // 3. 멤버 추가
    CourseMember member = new CourseMember();
    member.setCourseId(courseId);
    member.setUserUuid(userUuid);
    member.setRole("EDITOR");
    courseMemberRepository.save(member);
}
```

---

### 체크포인트 3: 루트 조회 권한

**파일 위치:** `CourseQueryService.java` 또는 해당 Service

**현재 코드:**
```java
// ❌ 잘못된 것
public Course getCourse(String courseId, String currentUserUuid) {
    Course course = courseRepository.findById(courseId);
    
    // 소유자만 접근 가능
    if (!course.getOwnerUuid().equals(currentUserUuid)) {
        throw new ApiException(403, "FORBIDDEN");
    }
    
    return course;
}
```

**수정 후 코드:**
```java
// ✅ 올바른 것
public Course getCourse(String courseId, String currentUserUuid) {
    Course course = courseRepository.findById(courseId);
    
    if (course == null) {
        throw new ApiException(404, "NOT_FOUND");
    }
    
    // 1. 소유자는 항상 접근 가능
    if (course.getOwnerUuid().equals(currentUserUuid)) {
        return course;
    }
    
    // 2. 공동 편집 루트면 멤버 확인
    if (course.isCollaborative()) {
        boolean isMember = courseMemberRepository.existsByCoursIdAndUserUuid(
            courseId, currentUserUuid
        );
        if (isMember) {
            return course;  // ✅ 친구도 접근 가능
        }
    }
    
    // 3. 그 외의 경우 거부
    throw new ApiException(403, "FORBIDDEN", 
        "이 루트에 접근할 권한이 없습니다");
}
```

---

### 체크포인트 4: 루트 편집 권한

**파일 위치:** `CourseUpdateService.java` 또는 해당 Service

**현재 코드:**
```java
// ❌ 잘못된 것
public void updateCourse(String courseId, String currentUserUuid, UpdateRequest request) {
    Course course = courseRepository.findById(courseId);
    
    // 소유자만 편집 가능
    if (!course.getOwnerUuid().equals(currentUserUuid)) {
        throw new ApiException(403, "FORBIDDEN");
    }
    
    // 편집 진행...
}
```

**수정 후 코드:**
```java
// ✅ 올바른 것
public void updateCourse(String courseId, String currentUserUuid, UpdateRequest request) {
    Course course = courseRepository.findById(courseId);
    
    if (course == null) {
        throw new ApiException(404, "NOT_FOUND");
    }
    
    boolean canEdit = false;
    
    // 1. 소유자는 항상 편집 가능
    if (course.getOwnerUuid().equals(currentUserUuid)) {
        canEdit = true;
    }
    // 2. 공동 편집 루트면 멤버 확인
    else if (course.isCollaborative()) {
        CourseMember member = courseMemberRepository.findByCoursIdAndUserUuid(
            courseId, currentUserUuid
        );
        if (member != null && ("EDITOR".equals(member.getRole()) || "OWNER".equals(member.getRole()))) {
            canEdit = true;  // ✅ 친구도 편집 가능
        }
    }
    
    if (!canEdit) {
        throw new ApiException(403, "FORBIDDEN", 
            "이 루트를 편집할 권한이 없습니다");
    }
    
    // 편집 진행...
    course.setTitle(request.getTitle());
    course.setStops(request.getStops());
    // ...
    courseRepository.save(course);
}
```

---

## 테스트 시나리오

### 시나리오 1: 공동 루트 저장

**Step 1: 사용자A가 루트를 공동 편집으로 저장**
```bash
PATCH /api/courses/my/06f07eb4-6af6-49fa-bcbb-1eee3c8e5389
Content-Type: application/json
Authorization: Bearer token-A

{
  "title": "창원 루트",
  "stops": [...],
  "legs": [...],
  "collaborative": true,
  "chatRoomUuid": "93417386-ddf1-4d79-87d8-ba6fe2319a14"
}
```

**기대 결과:**
```json
HTTP 200 OK
{
  "uuid": "06f07eb4-6af6-49fa-bcbb-1eee3c8e5389",
  "title": "창원 루트",
  "collaborative": true,  ✅ true로 저장됨
  "chatRoomUuid": "93417386-ddf1-4d79-87d8-ba6fe2319a14",
  "version": 1
}
```

---

### 시나리오 2: 친구 멤버 추가

**Step 2: 사용자A가 친구B를 초대**
```bash
POST /api/courses/my/06f07eb4-6af6-49fa-bcbb-1eee3c8e5389/members
Content-Type: application/json
Authorization: Bearer token-A

{
  "userUuid": "friend-uuid-B"
}
```

**기대 결과:**
```json
HTTP 201 Created
{
  "userUuid": "friend-uuid-B",
  "userId": "friend-id",
  "nickname": "친구이름",
  "role": "EDITOR",
  "addedAt": "2026-06-22T11:06:00Z"
}
```

**DB 상태:**
```
course_members 테이블:
- courseId: 06f07eb4-6af6-49fa-bcbb-1eee3c8e5389
- userUuid: friend-uuid-B
- role: EDITOR
```

---

### 시나리오 3: 친구가 루트 조회 (초대장 클릭)

**Step 3: 친구B가 초대장 링크 클릭 (라우팅)**
```
URL: routes/collaborative/06f07eb4-6af6-49fa-bcbb-1eee3c8e5389
→ RouteCreateScreen 열림
→ useCollaborativeRouteEntry 훅 실행
→ fetchCollaborativeAccess 호출
```

**Step 3-1: 권한 확인 API 호출**
```bash
GET /api/courses/collaborative/06f07eb4-6af6-49fa-bcbb-1eee3c8e5389
Authorization: Bearer token-B
```

**기대 결과:**
```json
HTTP 200 OK
{
  "courseUuid": "06f07eb4-6af6-49fa-bcbb-1eee3c8e5389",
  "title": "창원 루트",
  "collaborative": true,
  "chatRoomUuid": "93417386-ddf1-4d79-87d8-ba6fe2319a14",
  "version": 1,
  "myRole": "EDITOR",
  "canEdit": true
}
```

**현재 결과 (버그):**
```
❌ HTTP 404 Not Found
❌ 메시지: COURSE_NOT_COLLABORATIVE
→ 사용자 화면에 "루트를 찾을 수 없어요" 토스트
→ 뒤로 이동
```

---

### 시나리오 4: 친구가 루트 편집

**Step 4: 친구B가 루트의 정류장 정보 변경**
```bash
PATCH /api/courses/my/06f07eb4-6af6-49fa-bcbb-1eee3c8e5389
Content-Type: application/json
Authorization: Bearer token-B

{
  "stops": [
    { "name": "출발", "lat": 35.2271, "lng": 128.5831 },
    { "name": "새로운 경유지", "lat": 35.2400, "lng": 128.6100 },
    { "name": "도착", "lat": 35.2350, "lng": 128.6000 }
  ],
  "legs": [...],
  "version": 1
}
```

**기대 결과:**
```json
HTTP 200 OK
{
  "uuid": "06f07eb4-6af6-49fa-bcbb-1eee3c8e5389",
  "title": "창원 루트",
  "version": 2,
  "updatedAt": "2026-06-22T11:07:00Z",
  "modifierUuid": "friend-uuid-B",
  "modifierUserId": "friend-id"
}
```

**현재 결과 (버그):**
```
❌ HTTP 403 Forbidden
❌ 메시지: 해당 코스에 접근할 권한이 없습니다
```

---

### 시나리오 5: 사용자A가 편집 내용 확인

**Step 5: 사용자A가 실시간 동기화로 친구의 편집 확인**
```bash
GET /api/courses/my/06f07eb4-6af6-49fa-bcbb-1eee3c8e5389
Authorization: Bearer token-A
```

**기대 결과:**
```json
HTTP 200 OK
{
  "uuid": "06f07eb4-6af6-49fa-bcbb-1eee3c8e5389",
  "title": "창원 루트",
  "version": 2,
  "stops": [
    { "name": "출발", ... },
    { "name": "새로운 경유지", ... },  ✅ 친구가 변경한 내용
    { "name": "도착", ... }
  ],
  "modifierUuid": "friend-uuid-B",  ✅ 누가 변경했는지 표시
  "modifierUserId": "friend-id"
}
```

---

## 핵심 요약

### 문제
- ❌ 루트의 `collaborative` 필드가 항상 `false`로 저장됨
- ❌ 친구를 멤버로 추가할 수 없음
- ❌ 친구가 루트에 접근할 수 없음

### 원인
- 백엔드에서 저장 요청의 `collaborative` 필드를 무시함
- `collaborative` 값을 DB에 저장하지 않음

### 해결책
1. **저장 로직 수정**
   - PATCH/POST 요청의 `collaborative` 필드 확인
   - 해당 값을 DB에 저장

2. **멤버 추가 검증**
   - `collaborative: true`인 루트에만 멤버 추가 허용
   - `collaborative: false`면 400 에러 반환

3. **접근 권한 수정**
   - `collaborative: true`면 모든 멤버가 접근/편집 가능
   - `collaborative: false`면 소유자만 접근/편집 가능

4. **역할 기반 접근 제어**
   - OWNER: 모든 작업 가능
   - EDITOR: 조회/편집 가능
   - VIEWER: 조회만 가능

### 수정 필요 API
| API | 메서드 | 수정 내용 |
|-----|--------|----------|
| `/api/courses/my/{id}` | PATCH | collaborative 필드 저장 |
| `/api/courses/my/{id}/members` | POST | 멤버 추가 검증 강화 |
| `/api/courses/my/{id}` | GET | 권한 기반 조회 허용 |
| `/api/courses/collaborative/{id}` | GET | 멤버 권한 확인 |

### 기대 효과
✅ 친구 초대 기능 정상 작동  
✅ 친구가 초대장 클릭 시 루트 로드 성공  
✅ 친구가 루트 공동 편집 가능  
✅ 실시간 협업 기능 활성화  

---

## 참고사항

### 프론트엔드 현황
- ✅ 사용자 입장에서는 올바르게 작동 중
- ✅ 공동 루트 설정 UI 작동 정상
- ✅ 친구 초대 메시지 전송 정상
- ✅ 로그에서 `collaborative: true` 전송 확인

### 백엔드 확인 필요
- [ ] `collaborative` 필드 저장 로직 확인
- [ ] 멤버 추가 API 검증 로직 확인
- [ ] 조회 권한 체크 로직 확인
- [ ] 테스트 시나리오 실행

---

**작성일:** 2026-06-22  
**관련 이슈:** 공동 루트 초대 시 친구가 루트를 찾을 수 없음  
**우선순위:** 높음 (기능 마비)
