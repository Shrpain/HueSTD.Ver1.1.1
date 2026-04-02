import React, { useState, useEffect, useCallback, useRef } from 'react';
import { MessageCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../services/supabase';
import { chatService } from '../../services/chatService';
import { Conversation, ConversationListItem, Message, TypingStatus } from '../../types/chat';
import { useRealtimeChat, ensureSupabaseSessionForRealtime } from './hooks/useRealtimeChat';
import ChatList from './ChatList';
import ChatWindow from './ChatWindow';
import NewChatModal from './NewChatModal';

interface DraftDirectChatUser {
  id: string;
  fullName: string | null;
  avatarUrl: string | null;
  email: string | null;
}

const ChatModule: React.FC = () => {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<ConversationListItem[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<ConversationListItem | null>(null);
  const [draftDirectChat, setDraftDirectChat] = useState<DraftDirectChatUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [showNewChat, setShowNewChat] = useState(false);
  const conversationsRef = useRef(conversations);
  conversationsRef.current = conversations;

  const fetchConversations = useCallback(async () => {
    try {
      const { data } = await chatService.getConversations();
      setConversations(data || []);
    } catch (error) {
      console.error('Failed to fetch conversations:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    void fetchConversations();
  }, [fetchConversations, user?.id]);

  const syncConversationActivity = useCallback(
    (message: Message, options?: { markRead?: boolean }) => {
      const isOwnMessage = String(message.senderId) === String(user?.id);
      const isActiveConversation = selectedConversation?.id === message.conversationId;
      const shouldMarkRead = options?.markRead || (isActiveConversation && document.visibilityState === 'visible');

      setConversations((prev) => {
        const targetConversation = prev.find((conv) => conv.id === message.conversationId);
        if (!targetConversation) {
          void fetchConversations();
          return prev;
        }

        const updated = prev.map((conv) =>
          conv.id === message.conversationId
            ? {
                ...conv,
                lastMessageContent: message.content,
                lastMessageAt: message.createdAt,
                unreadCount: shouldMarkRead ? 0 : conv.unreadCount + (!isOwnMessage ? 1 : 0),
              }
            : conv
        );

        return updated.sort(
          (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
        );
      });
    },
    [fetchConversations, selectedConversation?.id, user?.id]
  );

  useEffect(() => {
    if (!user?.id) return;

    let cancelled = false;
    const rtState: { channel: ReturnType<typeof supabase.channel> | null } = { channel: null };

    void (async () => {
      const ok = await ensureSupabaseSessionForRealtime();
      if (!ok || cancelled) return;

      const channel = supabase
        .channel(`global-chat-updates-${user.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
          },
          (payload) => {
            const conversationId = payload.new.conversation_id as string | undefined;
            if (!conversationId) return;
            if (!conversationsRef.current.some((conv) => conv.id === conversationId)) return;

            syncConversationActivity({
              id: String(payload.new.id ?? ''),
              conversationId,
              senderId: String(payload.new.sender_id ?? ''),
              senderName: '',
              senderAvatar: '',
              content: String(payload.new.content ?? ''),
              contentType: 'text',
              isEdited: false,
              isDeleted: false,
              createdAt: String(payload.new.created_at ?? new Date().toISOString()),
              reactions: [],
            });
          }
        )
        .subscribe();

      rtState.channel = channel;
      if (cancelled) {
        supabase.removeChannel(channel);
        rtState.channel = null;
      }
    })();

    return () => {
      cancelled = true;
      const channel = rtState.channel;
      if (channel) {
        supabase.removeChannel(channel);
        rtState.channel = null;
      }
    };
  }, [syncConversationActivity, user?.id]);

  const handleNewMessageFromRealtime = useCallback(
    (message: Message) => {
      window.dispatchEvent(new CustomEvent('CHAT_NEW_MESSAGE', { detail: message }));
      syncConversationActivity(message);

      if (selectedConversation?.id === message.conversationId && document.visibilityState === 'visible') {
        void chatService.markAsRead(message.conversationId).catch(() => {});
      }
    },
    [selectedConversation?.id, syncConversationActivity]
  );

  const handleMessageUpdated = useCallback((message: Message) => {
    window.dispatchEvent(new CustomEvent('CHAT_MESSAGE_UPDATED', { detail: message }));
  }, []);

  const handleMessageDeleted = useCallback((messageId: string) => {
    window.dispatchEvent(new CustomEvent('CHAT_MESSAGE_DELETED', { detail: { messageId } }));
  }, []);

  const { sendTyping, sendMessageBroadcast, isConnected } = useRealtimeChat({
    conversationId: selectedConversation?.id || '',
    currentUserId: user?.id || '',
    onNewMessage: handleNewMessageFromRealtime,
    onMessageUpdated: handleMessageUpdated,
    onMessageDeleted: handleMessageDeleted,
    onTypingUpdate: (status: TypingStatus) => {
      window.dispatchEvent(new CustomEvent('CHAT_TYPING', { detail: status }));
    },
    onReactionUpdate: (data: { messageId: string; reactions: any[] }) => {
      window.dispatchEvent(new CustomEvent('CHAT_REACTION', { detail: data }));
    },
  });

  const handleConversationSelect = (conv: ConversationListItem) => {
    setDraftDirectChat(null);
    setSelectedConversation(conv);
    setConversations((prev) =>
      prev.map((item) => (item.id === conv.id ? { ...item, unreadCount: 0 } : item))
    );
    void chatService.markAsRead(conv.id).catch(() => {});
  };

  const conversationToListItem = (data: Conversation, directPeerId: string): ConversationListItem => {
    const peer =
      data.type === 'direct'
        ? data.members.find((member) => member.userId === directPeerId)
        : undefined;

    return {
      id: data.id,
      type: data.type,
      name: data.name,
      avatarUrl: data.avatarUrl,
      otherUserId: data.type === 'direct' ? directPeerId : undefined,
      otherUserName: peer?.userName,
      otherUserAvatar: peer?.userAvatar,
      lastMessageAt: data.lastMessageAt,
      lastMessageContent: data.lastMessage?.content,
      memberCount: data.memberCount,
      unreadCount: data.unreadCount,
      isPinned: false,
      isMuted: false,
    };
  };

  const handleDraftChatReady = useCallback(
    (conversation: Conversation, peerUserId: string) => {
      const listItem = conversationToListItem(conversation, peerUserId);
      setDraftDirectChat(null);
      setSelectedConversation(listItem);
      void fetchConversations();
    },
    [fetchConversations]
  );

  const handleNewChat = (peer: DraftDirectChatUser) => {
    const existingConversation = conversations.find(
      (conversation) =>
        conversation.type === 'direct' && String(conversation.otherUserId) === String(peer.id)
    );

    if (existingConversation) {
      handleConversationSelect(existingConversation);
      setShowNewChat(false);
      return;
    }

    setSelectedConversation(null);
    setDraftDirectChat(peer);
    setShowNewChat(false);
  };

  return (
    <div className="flex h-full min-h-0 w-full bg-white rounded-2xl shadow-sm overflow-hidden">
      <ChatList
        conversations={conversations}
        selectedId={selectedConversation?.id}
        onSelect={handleConversationSelect}
        onNewChat={() => setShowNewChat(true)}
        loading={loading}
      />

      {selectedConversation || draftDirectChat ? (
        <ChatWindow
          conversationId={selectedConversation?.id}
          conversationType={selectedConversation?.type || 'direct'}
          conversationName={
            selectedConversation?.type === 'direct'
              ? selectedConversation.otherUserName
              : selectedConversation?.name || draftDirectChat?.fullName || draftDirectChat?.email || 'Nguoi dung'
          }
          conversationAvatar={
            selectedConversation?.type === 'direct'
              ? selectedConversation.otherUserAvatar
              : draftDirectChat?.avatarUrl || undefined
          }
          currentUserId={user?.id || ''}
          onTyping={sendTyping}
          onMessageBroadcast={sendMessageBroadcast}
          onConversationUpdate={syncConversationActivity}
          isRealtimeConnected={isConnected}
          draftPeer={
            draftDirectChat
              ? {
                  userId: draftDirectChat.id,
                  userName: draftDirectChat.fullName || draftDirectChat.email || 'Nguoi dung',
                  userAvatar: draftDirectChat.avatarUrl || '',
                  email: draftDirectChat.email || '',
                }
              : undefined
          }
          onDraftConversationCreated={handleDraftChatReady}
        />
      ) : (
        <div className="flex-1 min-h-0 flex items-center justify-center bg-slate-50">
          <div className="text-center">
            <div className="w-20 h-20 bg-teal-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <MessageCircle size={40} className="text-teal-600" />
            </div>
            <h2 className="text-xl font-black text-slate-800 mb-2">Tin nhan</h2>
            <p className="text-slate-500 mb-4">Chon cuoc tro chuyen hoac bat dau cuoc tro chuyen moi</p>
            <button
              onClick={() => setShowNewChat(true)}
              className="inline-flex items-center gap-2 px-6 py-3 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-teal-100"
            >
              <MessageCircle size={20} />
              Tin nhan moi
            </button>
          </div>
        </div>
      )}

      {showNewChat && (
        <NewChatModal
          onClose={() => setShowNewChat(false)}
          onSelect={handleNewChat}
        />
      )}
    </div>
  );
};

export default ChatModule;
