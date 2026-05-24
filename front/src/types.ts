export interface User {
  id: string;
  username: string;
  passwordHash?: string;
  displayName: string;
  avatarTitle: string;
  createdAt: string;
}

export interface FriendRequest {
  id: string;
  fromUserId: string;
  toUserId: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: string;
}

export interface Memorial {
  id: string;
  title: string;
  url: string;
  rawText: string;
  sender: string;
  category: '经略阁' | '寻乐记' | '创意坊';
  summary: string;
  keywords: string[];
  entertainmentRatio: number;
  severityLevel: '日常请安' | '微臣急奏' | '十万火急' | '弹劾奏章';
  status: 'pending' | 'approved' | 'rejected' | 'held';
  imperialComment?: string;
  createdTime: string;
  approvedTime?: string;
  fromUserId?: string;
  toUserId?: string;
  fromUserDisplayName?: string;
  toUserDisplayName?: string;
  senderReadAt?: string;
  voiceCommentPath?: string;
  voiceCommentMime?: string;
  voiceCommentDurationMs?: number;
}

export interface DailyBriefing {
  id: string;
  date: string;
  overallHealth: string;
  imperialReport: string;
  categoryStatistics: {
    category: string;
    count: number;
    avgEntertainment: number;
  }[];
  activeSenders: string[];
}
