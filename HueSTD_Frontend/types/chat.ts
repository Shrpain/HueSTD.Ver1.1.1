export interface Conversation {
  id: string;
  type: 'direct' | 'group';
  name?: string;
  avatarUrl?: string;
  createdBy: string;
  createdAt: string;
  lastMessageAt: string;
  memberCount: number;
  lastMessage?: Message;
  members: ConversationMember[];
  unreadCount: number;
}

export interface ConversationMember {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  role: 'owner' | 'admin' | 'member';
  nickname?: string;
  joinedAt: string;
  lastReadAt: string;
  isOnline: boolean;
}

export interface ConversationListItem {
  id: string;
  type: 'direct' | 'group';
  name?: string;
  avatarUrl?: string;
  otherUserId?: string;
  otherUserName?: string;
  otherUserAvatar?: string;
  lastMessageAt: string;
  lastMessageContent?: string;
  memberCount: number;
  unreadCount: number;
  isPinned: boolean;
  isMuted: boolean;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  content: string;
  contentType: 'text' | 'file' | 'system';
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  replyToId?: string;
  replyToContent?: string;
  replyToSenderName?: string;
  isEdited: boolean;
  isDeleted: boolean;
  createdAt: string;
  reactions: Reaction[];
}

export interface Reaction {
  id: string;
  reaction: string;
  userId: string;
  userName: string;
  count: number;
  users: { id: string; name: string }[];
}

export interface CreateDirectRequest {
  userId: string;
}

export interface CreateGroupRequest {
  name: string;
  memberIds: string[];
}

export interface SendMessageRequest {
  content: string;
  contentType?: 'text' | 'file';
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  replyToId?: string;
}

export interface EditMessageRequest {
  content: string;
}

export interface AddReactionRequest {
  reaction: string;
}

export interface UpdateConversationRequest {
  name?: string;
  avatarUrl?: string;
  isArchived?: boolean;
  isMuted?: boolean;
  isPinned?: boolean;
}

export interface TypingStatus {
  userId: string;
  isTyping: boolean;
}

export interface RealtimeMessage {
  type: 'message' | 'typing' | 'reaction';
  event: string;
  payload: any;
}
