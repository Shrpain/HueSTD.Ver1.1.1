import api from './api';
import {
  Conversation,
  ConversationListItem,
  Message,
  CreateDirectRequest,
  CreateGroupRequest,
  SendMessageRequest,
  EditMessageRequest,
  AddReactionRequest,
  UpdateConversationRequest,
} from '../types/chat';

interface ReportMessageFallbackPayload {
  messageContent: string;
  senderName: string;
  conversationId: string;
}

export const chatService = {
  // Conversations
  getConversations: () =>
    api.get<ConversationListItem[]>('/Chat/conversations'),

  getConversation: (id: string) =>
    api.get<Conversation>(`/Chat/conversations/${id}`),

  createDirectConversation: (data: CreateDirectRequest) =>
    api.post<Conversation>('/Chat/conversations/direct', data),

  createGroupConversation: (data: CreateGroupRequest) =>
    api.post<Conversation>('/Chat/conversations/group', data),

  updateConversation: (id: string, data: UpdateConversationRequest) =>
    api.put<Conversation>(`/Chat/conversations/${id}`, data),

  deleteConversation: (id: string) =>
    api.delete(`/Chat/conversations/${id}`),

  leaveConversation: (id: string) =>
    api.post(`/Chat/conversations/${id}/leave`),

  markAsRead: (id: string) =>
    api.post(`/Chat/conversations/${id}/read`),

  // Messages
  getMessages: (conversationId: string, page = 1, pageSize = 20) =>
    api.get<Message[]>(`/Chat/conversations/${conversationId}/messages`, {
      params: { page, pageSize },
    }),

  sendMessage: (conversationId: string, data: SendMessageRequest) =>
    api.post<Message>(`/Chat/conversations/${conversationId}/messages`, data),

  editMessage: (messageId: string, data: EditMessageRequest) =>
    api.put<Message>(`/Chat/messages/${messageId}`, data),

  deleteMessage: (messageId: string) =>
    api.delete(`/Chat/messages/${messageId}`),

  adminDeleteMessage: (messageId: string) =>
    api.delete(`/Chat/messages/${messageId}/admin-delete`),

  reportMessage: async (messageId: string, reason?: string, fallbackPayload?: ReportMessageFallbackPayload) => {
    try {
      return await api.post(`/Chat/messages/${messageId}/report`, { reason });
    } catch (error: any) {
      if (error?.response?.status !== 404 || !fallbackPayload) {
        throw error;
      }

      return api.post('/Notification/notify-admins', {
        title: 'Bao cao tin nhan chat',
        type: 'chat_report',
        message: `MessageId: ${messageId}\nConversation: ${fallbackPayload.conversationId}\nNguoi gui tin nhan: ${fallbackPayload.senderName}\nNoi dung nguyen van:\n${fallbackPayload.messageContent}${reason ? `\nLy do: ${reason}` : ''}`,
      });
    }
  },

  // Reactions
  addReaction: (messageId: string, data: AddReactionRequest) =>
    api.post(`/Chat/messages/${messageId}/reactions`, data),

  removeReaction: (messageId: string) =>
    api.delete(`/Chat/messages/${messageId}/reactions`),

  // Members
  addMember: (conversationId: string, userId: string) =>
    api.post(`/Chat/conversations/${conversationId}/members`, { userId }),

  removeMember: (conversationId: string, userId: string) =>
    api.delete(`/Chat/conversations/${conversationId}/members/${userId}`),
};
