# 루트 기록(Route History) - 백엔드 구현 스펙

## 📋 목차

1. [개요](#개요)
2. [프론트엔드 흐름](#프론트엔드-흐름)
3. [백엔드 구현 사항](#백엔드-구현-사항)
4. [데이터베이스 스키마](#데이터베이스-스키마)
5. [API 엔드포인트](#api-엔드포인트)
6. [구현 예시](#구현-예시)
7. [체크리스트](#체크리스트)

---

## 개요

공동 편집 중 루트에 대한 모든 변경 사항(채팅, 루트 수정)을 타임라인으로 기록하고 조회할 수 있는 기능입니다.

**핵심:** 루트 ID와 채팅방을 연결하여, 그 채팅방에서 발생하는 모든 메시지와 루트 수정을 하나의 기록으로 저장합니다.

---

## 프론트엔드 흐름

```
1. 사용자가 루트 생성
   └─ MyRouteScreen

2. "초대" 버튼 클릭
   └─ CollaborativeFriendInviteModal에서 친구 선택

3. 친구를 1대1 채팅방으로 초대
   └─ inviteFriendsToRouteChat API 호출
   └─ route_chat_context 생성 (route_id ↔ chat_room_id 연결)

4. 공동 편집 시작
   └─ RouteCreateScreen (collaborative: true)

5. 편집 중 채팅 또는 루트 수정
   └─ socketSend(message) 또는 PATCH /api/courses/my/{courseId}

6. 기록 탭 열기
   └─ RouteCollaborativeChatSheet에서 "기록" 탭 선택
   └─ GET /api/route-history/{courseId}/feed 호출
   └─ RouteHistoryFeed 컴포넌트에서 타임라인 표시
```

---

## 백엔드 구현 사항

### 1️⃣ 채팅 메시지 저장 시 (POST /chats/{roomUuid}/messages)

**요청:**
```json
{
  "content": "경유지 추가할게요"
}
```

**백엔드 로직:**

```typescript
// 1. 채팅방이 어느 루트와 연결되어 있는지 확인
const routeChatContext = await getRouteChatContext(chatRoomId);

// 2. route_id가 있으면 메시지에 포함
const message = {
  room_id: chatRoomId,
  user_id: userId,
  message_type: "TEXT",
  content: "경유지 추가할게요",
  route_id: routeChatContext?.route_id,  // ← 자동으로 감지!
  created_at: new Date()
};

// 3. 저장
await saveMessage(message);
```

**저장되는 데이터:**
```sql
INSERT INTO chat_messages (
  room_id, 
  user_id, 
  message_type, 
  content, 
  route_id,
  created_at
) VALUES (
  'chat-AB', 
  'user-A', 
  'TEXT', 
  '경유지 추가할게요', 
  'route-123',
  NOW()
);
```

---

### 2️⃣ 루트 수정 시 (PATCH /api/courses/my/{courseId})

**요청:**
```json
{
  "stops": [/* 수정된 정류장 */],
  "legs": [/* 수정된 이동 구간 */]
}
```

**백엔드 로직:**

```typescript
// 1. 루트 저장
const updatedCourse = await updateCourse(courseId, payload);

// 2. 수정 유형 파악 (STOP_ADDED, STOP_REMOVED, LEG_UPDATED, TITLE_CHANGED 등)
const changeType = detectChangeType(oldCourse, updatedCourse);

// 3. route_chat_context에서 채팅방 ID 조회
const context = await getRouteChatContext(courseId);
if (!context) return; // 연결된 채팅방 없으면 스킵

// 4. chat_messages에 기록 저장
const record = {
  room_id: context.chat_room_id,
  message_type: changeType,  // "ROUTE_STOP_ADDED", "ROUTE_TITLE_CHANGED" 등
  route_id: courseId,
  user_id: userId,
  edit_type: changeType,
  edit_details: {
    // 변경 상세 정보
    stopName: "신세계백화점",
    lat: 35.2271,
    lng: 128.5831
  },
  created_at: new Date()
};

// 5. 저장
await saveMessage(record);
```

**저장되는 데이터:**
```sql
INSERT INTO chat_messages (
  room_id,
  message_type,
  route_id,
  user_id,
  edit_type,
  edit_details,
  created_at
) VALUES (
  'chat-AB',
  'ROUTE_STOP_ADDED',
  'route-123',
  'user-A',
  'STOP_ADDED',
  '{"stopName": "신세계백화점", "lat": 35.2271, "lng": 128.5831}',
  NOW()
);
```

---

### 3️⃣ 루트 기록 조회 (GET /api/route-history/{courseId}/feed)

**요청:**
```
GET /api/route-history/route-123/feed?page=0&size=30
```

**백엔드 로직:**

```typescript
// 1. chat_messages에서 route_id 필터링
const messages = await db.query(`
  SELECT * FROM chat_messages 
  WHERE route_id = ? 
  ORDER BY created_at DESC 
  LIMIT ? OFFSET ?
`, [courseId, size, page * size]);

// 2. RouteFeedItem 형식으로 변환
const items = messages.map(msg => ({
  type: msg.message_type.startsWith('ROUTE_') ? 'COURSE' : 'CHAT',
  itemId: msg.id,
  actorUuid: msg.user_id,
  actorNickname: msg.user_nickname,
  actorProfileImageUrl: msg.user_profile_image,
  content: msg.content,  // 채팅 메시지만 있음
  action: msg.message_type,
  editDescription: generateEditDescription(msg),  // 한국어 설명
  createdAt: msg.created_at
}));

// 3. 응답 반환
return {
  items,
  pageInfo: {
    page,
    size,
    total: messages.total,
    totalPages: Math.ceil(messages.total / size)
  }
};
```

**응답 예시:**
```json
{
  "items": [
    {
      "type": "COURSE",
      "itemId": 1,
      "action": "ROUTE_STOP_ADDED",
      "actorNickname": "홍길동",
      "actorProfileImageUrl": "https://...",
      "content": null,
      "editDescription": "홍길동님이 경유지를 추가했습니다",
      "createdAt": "2026-06-22T10:05:00Z"
    },
    {
      "type": "CHAT",
      "itemId": 2,
      "action": "CHAT_SENDED",
      "actorNickname": "홍길동",
      "actorProfileImageUrl": "https://...",
      "content": "경유지 추가할게요",
      "editDescription": "홍길동님이 메시지를 보냈습니다",
      "createdAt": "2026-06-22T10:05:30Z"
    },
    {
      "type": "COURSE",
      "itemId": 3,
      "action": "ROUTE_TITLE_CHANGED",
      "actorNickname": "김영희",
      "actorProfileImageUrl": "https://...",
      "content": null,
      "editDescription": "김영희님이 루트 이름을 변경했습니다",
      "createdAt": "2026-06-22T10:10:00Z"
    }
  ],
  "pageInfo": {
    "page": 0,
    "size": 30,
    "total": 100,
    "totalPages": 4
  }
}
```

---

## 데이터베이스 스키마

### 1. route_chat_context 테이블 (기존 또는 신규)

```sql
CREATE TABLE route_chat_context (
    uuid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    route_id UUID NOT NULL UNIQUE,  -- 1개 루트는 1개 채팅방과만 연결
    chat_room_id UUID NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'EDITING',  -- EDITING, COMPLETED
    created_by_uuid UUID NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    last_modified_by_uuid UUID,
    last_modified_at TIMESTAMP,
    edit_count INT DEFAULT 0,
    
    FOREIGN KEY (route_id) REFERENCES courses(uuid) ON DELETE CASCADE,
    FOREIGN KEY (chat_room_id) REFERENCES chat_rooms(uuid),
    FOREIGN KEY (created_by_uuid) REFERENCES users(uuid),
    FOREIGN KEY (last_modified_by_uuid) REFERENCES users(uuid)
);

CREATE UNIQUE INDEX idx_route_chat_context_route_id 
    ON route_chat_context(route_id);
CREATE INDEX idx_route_chat_context_chat_room 
    ON route_chat_context(chat_room_id);
```

### 2. chat_messages 테이블 (수정)

```sql
-- 새로운 컬럼 추가
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS (
    route_id UUID,
    message_type VARCHAR(50) DEFAULT 'TEXT',
    edit_type VARCHAR(50),
    edit_details JSONB
);

-- 인덱스 추가
CREATE INDEX idx_chat_messages_route_id 
    ON chat_messages(route_id);
CREATE INDEX idx_chat_messages_room_and_type 
    ON chat_messages(room_id, message_type);
```

**message_type 종류:**

| Type | 설명 | 언제 생성 |
|------|------|---------|
| TEXT | 일반 채팅 메시지 | 사용자가 채팅 입력 |
| ROUTE_STOP_ADDED | 경유지 추가 | PATCH 요청에서 stops 추가 감지 |
| ROUTE_STOP_REMOVED | 경유지 삭제 | PATCH 요청에서 stops 삭제 감지 |
| ROUTE_LEG_UPDATED | 이동 구간 수정 | PATCH 요청에서 legs 수정 감지 |
| ROUTE_TITLE_CHANGED | 루트 이름 변경 | PATCH 요청에서 title 수정 감지 |
| ROUTE_EDITING_COMPLETED | 편집 완료 | POST /complete-editing 호출 |
| ROUTE_EDITING_RESUMED | 편집 재개 | POST /resume-editing 호출 |

---

## API 엔드포인트

### 1. 메시지 저장 (기존)

```
POST /chats/{roomUuid}/messages

요청:
{
  "content": "경유지 추가할게요"
}

백엔드: route_id 자동 감지 & 저장
```

### 2. 루트 수정 (기존)

```
PATCH /api/courses/my/{courseId}

요청:
{
  "title": "상남동 루트",
  "stops": [...],
  "legs": [...]
}

백엔드: 변경 유형 감지 & chat_messages에 기록 생성
```

### 3. 루트 기록 조회 (신규 또는 기존)

```
GET /api/route-history/{courseId}/feed?page=0&size=30

응답:
{
  "items": [RouteFeedItem],
  "pageInfo": {
    "page": 0,
    "size": 30,
    "total": 100,
    "totalPages": 4
  }
}
```

---

## 구현 예시

### 변경 유형 감지 함수 (TypeScript)

```typescript
function detectChangeType(
  oldCourse: Course,
  newCourse: Course
): string {
  // 제목 변경
  if (oldCourse.title !== newCourse.title) {
    return 'ROUTE_TITLE_CHANGED';
  }

  const oldStopsLength = oldCourse.stops?.length || 0;
  const newStopsLength = newCourse.stops?.length || 0;

  // 경유지 추가
  if (newStopsLength > oldStopsLength) {
    return 'ROUTE_STOP_ADDED';
  }

  // 경유지 삭제
  if (newStopsLength < oldStopsLength) {
    return 'ROUTE_STOP_REMOVED';
  }

  // 이동 구간 수정
  if (!deepEqual(oldCourse.legs, newCourse.legs)) {
    return 'ROUTE_LEG_UPDATED';
  }

  // 기타 수정
  return 'ROUTE_UPDATED';
}
```

### editDescription 생성 함수 (TypeScript)

```typescript
function generateEditDescription(message: ChatMessage): string {
  const actor = message.actorNickname || '사용자';

  switch (message.action) {
    case 'CHAT_SENDED':
      return `${actor}님이 메시지를 보냈습니다`;
    case 'CHAT_EDITED':
      return `${actor}님이 메시지를 수정했습니다`;
    case 'CHAT_DELETED':
      return `${actor}님이 메시지를 삭제했습니다`;
    case 'ROUTE_STOP_ADDED':
      return `${actor}님이 경유지를 추가했습니다`;
    case 'ROUTE_STOP_REMOVED':
      return `${actor}님이 경유지를 삭제했습니다`;
    case 'ROUTE_LEG_UPDATED':
      return `${actor}님이 이동 구간을 수정했습니다`;
    case 'ROUTE_TITLE_CHANGED':
      return `${actor}님이 루트 이름을 변경했습니다`;
    case 'ROUTE_EDITING_COMPLETED':
      return `${actor}님이 편집을 완료했습니다`;
    case 'ROUTE_EDITING_RESUMED':
      return `${actor}님이 편집을 재개했습니다`;
    default:
      return `${actor}님이 루트를 수정했습니다`;
  }
}
```

---

## 체크리스트

### 데이터베이스

- [ ] `route_chat_context` 테이블 생성 또는 확인
- [ ] `chat_messages` 테이블에 다음 컬럼 추가
  - [ ] `route_id` (UUID, 외래키)
  - [ ] `message_type` (VARCHAR)
  - [ ] `edit_type` (VARCHAR)
  - [ ] `edit_details` (JSONB)
- [ ] 인덱스 생성
  - [ ] `idx_route_chat_context_route_id`
  - [ ] `idx_chat_messages_route_id`
  - [ ] `idx_chat_messages_room_and_type`

### API: POST /chats/{roomUuid}/messages

- [ ] 메시지 저장 시 `route_chat_context` 조회
- [ ] `route_id` 자동 감지하여 `chat_messages.route_id`에 저장
- [ ] `message_type` 설정 (TEXT, IMAGE, ROUTE 등)

### API: PATCH /api/courses/my/{courseId}

- [ ] 루트 저장 후 변경 유형 감지
- [ ] `route_chat_context` 조회
- [ ] `chat_messages`에 기록 생성
  - [ ] `message_type`: ROUTE_STOP_ADDED, ROUTE_TITLE_CHANGED 등
  - [ ] `edit_type`: 상세 유형
  - [ ] `edit_details`: JSON 형식의 상세 정보

### API: GET /api/route-history/{courseId}/feed

- [ ] `chat_messages`에서 `route_id` 필터링
- [ ] `createdAt` 기준으로 정렬
- [ ] 페이징 처리 (page, size)
- [ ] RouteFeedItem 형식으로 변환
  - [ ] `type`: "CHAT" 또는 "COURSE"
  - [ ] `action`: message_type
  - [ ] `editDescription`: 한국어 설명
  - [ ] `content`: 채팅 메시지만 포함
- [ ] `pageInfo` 반환

### 비즈니스 로직

- [ ] 1 루트 = 1 채팅방 (route_chat_context의 UNIQUE 제약)
- [ ] 편집 중 모든 변경이 기록되는지 확인
- [ ] 권한 확인 (루트 멤버 또는 채팅방 멤버)

---

## 참고사항

- 프론트엔드에서 기록 조회는 이미 구현됨 (RouteHistoryFeed 컴포넌트)
- 백엔드는 데이터만 올바르게 저장하면 프론트엔드에서 자동으로 표시됨
- 모든 변경 기록은 불변(immutable)이므로 삭제 후에도 기록은 유지됨

---

**작성일:** 2026-06-22  
**상태:** 프론트엔드 완료, 백엔드 구현 예정
