export type GroupType = 'PUBLIC' | 'PRIVATE';
export type MemberRole = 'ADMIN' | 'MEMBER';
export type JoinStatus = 'JOINED' | 'PENDING';
export type JoinRequestAction = 'APPROVE' | 'REJECT';

export interface Group {
  uuid: string;
  name: string;
  description: string;
  profileImageUrl: string | null;
  type: GroupType;
  requiresApproval: boolean;
  viewCount: number;
  memberCount: number;
  joinedByMe: boolean;
  adminUuid: string;
  adminUserId: string;
}

export interface GroupChatRoom {
  uuid: string;
  name: string;
  createdAt: string;
}

export interface GroupPost {
  uuid: string;
  authorUuid: string;
  authorUserId: string;
  authorNickname: string;
  authorProfileImageUrl: string | null;
  content: string;
  imageUrls: string[];
  createdAt: string;
  updatedAt: string;
}

export interface GroupMember {
  userUuid: string;
  userId: string;
  nickname: string;
  profileImageUrl: string | null;
  role: MemberRole;
  joinedAt: string;
}

export interface JoinRequest {
  requestId: number;
  requesterUuid: string;
  requesterUserId: string;
  requesterNickname: string;
  requesterProfileImageUrl: string | null;
  createdAt: string;
}

export interface RouteStep {
  id: number;
  name: string;
  stayMinutes: number;
  latitude: number;
  longitude: number;
  address: string;
}

export interface GroupRoute {
  id: string;
  title: string;
  meta: string;
  category: string;
  region: string;
  thumbnail: string;
  views: number;
  overallDurationMinutes: number;
  departure: string;
  arrival: string;
  rating: number;
  reviewCount: number;
  routeSteps: RouteStep[];
  tags: string[];
  authorUuid: string;
  authorUserId: string;
  savedByMe: boolean;
}

export interface PageResponse<T> {
  totalElements: number;
  totalPages: number;
  numberOfElements: number;
  first: boolean;
  last: boolean;
  size: number;
  content: T[];
  number: number;
  empty: boolean;
}

export interface CreateGroupRequest {
  name: string;
  description: string;
  profileImageUrl?: string | null;
  type: GroupType;
  requiresApproval: boolean;
}

export interface UpdateGroupRequest {
  name?: string;
  description?: string;
  profileImageUrl?: string | null;
  type?: GroupType;
  requiresApproval?: boolean;
}

export interface CreatePostRequest {
  content: string;
  imageUrls?: string[];
}

export interface UpdatePostRequest {
  content: string;
  imageUrls?: string[];
}
