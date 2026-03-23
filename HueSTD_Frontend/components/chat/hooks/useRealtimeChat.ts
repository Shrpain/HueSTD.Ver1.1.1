import { useEffect, useRef, useCallback, useState } from 'react';
import { supabase, syncSupabaseRealtimeAuth } from '../../../services/supabase';
import { Message, TypingStatus } from '../../../types/chat';

/** Khôi phục JWT từ localStorage vào supabase.auth — AuthContext đã gọi setSession rồi,
 *  nhưng nếu useRealtimeChat chạy trước (SSR-like timing) thì cần gọi lại. */
export async function ensureSupabaseSessionForRealtime(): Promise<boolean> {
  const token = localStorage.getItem('accessToken');
  const refreshToken = localStorage.getItem('refreshToken') ?? '';
  if (!token) return false;
  const { error } = await supabase.auth.setSession({
    access_token: token,
    refresh_token: refreshToken,
  });
  if (error) {
    console.warn('[Chat Realtime] setSession failed:', error.message);
    return false;
  }
  await syncSupabaseRealtimeAuth(token);
  return true;
}

interface UseRealtimeChatOptions {
  conversationId: string;
  currentUserId: string;
  onNewMessage?: (message: Message) => void;
  onMessageUpdated?: (message: Message) => void;
  onMessageDeleted?: (messageId: string) => void;
  onTypingUpdate?: (status: TypingStatus) => void;
  onReactionUpdate?: (data: { messageId: string; reactions: any[] }) => void;
}

interface BroadcastMessagePayload {
  message: Message;
}

interface BroadcastDeletePayload {
  messageId: string;
}

type RealtimeMessageRow = Record<string, unknown>;

const buildMessageFromRow = (
  row: RealtimeMessageRow,
  overrides?: Partial<Pick<Message, 'senderName' | 'senderAvatar' | 'replyToContent' | 'replyToSenderName'>>
): Message => ({
  id: String(row.id ?? ''),
  conversationId: String(row.conversation_id ?? ''),
  senderId: String(row.sender_id ?? ''),
  senderName: overrides?.senderName || 'Thanh vien',
  senderAvatar: overrides?.senderAvatar || '',
  content: String(row.content ?? ''),
  contentType: (row.content_type as Message['contentType']) || 'text',
  fileUrl: row.file_url ? String(row.file_url) : undefined,
  fileName: row.file_name ? String(row.file_name) : undefined,
  fileSize: typeof row.file_size === 'number' ? row.file_size : undefined,
  replyToId: row.reply_to_id ? String(row.reply_to_id) : undefined,
  replyToContent: overrides?.replyToContent,
  replyToSenderName: overrides?.replyToSenderName,
  isEdited: Boolean(row.is_edited),
  isDeleted: Boolean(row.is_deleted),
  createdAt: String(row.created_at ?? new Date().toISOString()),
  reactions: [],
});

async function enrichMessage(row: RealtimeMessageRow): Promise<Message> {
  const senderId = row.sender_id ? String(row.sender_id) : '';
  if (!senderId) {
    return buildMessageFromRow(row);
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, avatar_url')
    .eq('id', senderId)
    .maybeSingle();

  return buildMessageFromRow(row, {
    senderName: profile?.full_name || 'Thanh vien',
    senderAvatar: profile?.avatar_url || '',
  });
}

export function useRealtimeChat({
  conversationId,
  currentUserId,
  onNewMessage,
  onMessageUpdated,
  onMessageDeleted,
  onTypingUpdate,
  onReactionUpdate,
}: UseRealtimeChatOptions) {
  const messagesChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const typingChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const callbacksRef = useRef({
    onNewMessage,
    onMessageUpdated,
    onMessageDeleted,
    onTypingUpdate,
    onReactionUpdate,
  });
  callbacksRef.current = {
    onNewMessage,
    onMessageUpdated,
    onMessageDeleted,
    onTypingUpdate,
    onReactionUpdate,
  };

  useEffect(() => {
    if (!conversationId) return;

    let cancelled = false;

    const setup = async () => {
      const ok = await ensureSupabaseSessionForRealtime();
      if (cancelled) return;
      if (!ok) {
        console.warn('[Chat Realtime] Không có phiên Supabase hợp lệ — tin nhắn có thể không cập nhật tức thì.');
        return;
      }
      if (cancelled) return;

      /**
       * Trước đây: 1 channel với 6 postgres_changes + broadcast + presence → join nặng, dễ TIMED_OUT.
       * Nay:
       * - Kênh tin nhắn: chỉ 1 listener event '*' trên bảng messages (cùng filter).
       * - Kênh typing: chỉ broadcast, không postgres.
       * Reactions: không subscribe toàn bảng message_reactions (gây tải toàn DB). Có thể bổ sung sau khi có filter theo conversation.
       */
      const messagesChannelName = `chat-msg:${conversationId}`;
      const messagesChannel = supabase.channel(messagesChannelName);

      messagesChannel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        async (payload) => {
          const eventType = (payload as { eventType?: string }).eventType;

          if (eventType === 'INSERT') {
            const row = (payload as { new: RealtimeMessageRow }).new;
            const message = buildMessageFromRow(row);
            if (String(message.senderId) !== String(currentUserId)) {
              callbacksRef.current.onNewMessage?.(message);
              void enrichMessage(row)
                .then((enrichedMessage) => {
                  callbacksRef.current.onMessageUpdated?.(enrichedMessage);
                })
                .catch((error) => {
                  console.warn('[Chat Realtime] Enrich INSERT message failed, using payload only:', error);
                });
            }
            return;
          }

          if (eventType === 'UPDATE') {
            const row = (payload as { new: RealtimeMessageRow }).new;
            if (row.is_deleted) {
              callbacksRef.current.onMessageDeleted?.(row.id as string);
              return;
            }
            const message = buildMessageFromRow(row);
            callbacksRef.current.onMessageUpdated?.(message);
            void enrichMessage(row)
              .then((enrichedMessage) => {
                callbacksRef.current.onMessageUpdated?.(enrichedMessage);
              })
              .catch((error) => {
                console.warn('[Chat Realtime] Enrich UPDATE message failed, using payload only:', error);
              });
            return;
          }

          if (eventType === 'DELETE') {
            const oldRow = (payload as { old: Record<string, unknown> }).old;
            callbacksRef.current.onMessageDeleted?.(oldRow.id as string);
          }
        }
      );

      if (cancelled) {
        void supabase.removeChannel(messagesChannel);
        return;
      }

      messagesChannel.subscribe((status, err) => {
        const connected = status === 'SUBSCRIBED';
        setIsConnected(connected);
        console.log(`[Chat Realtime] ${messagesChannelName}: ${status}`, err ?? '');
        if (status === 'TIMED_OUT' || status === 'CHANNEL_ERROR') {
          console.warn(
            '[Chat Realtime] Kênh tin nhắn lỗi/timeout — đang dùng polling API trong ChatWindow (nếu có).'
          );
        }
      });

      messagesChannelRef.current = messagesChannel;

      const typingChannelName = `chat-typing:${conversationId}`;
      const typingChannel = supabase.channel(typingChannelName, {
        config: {
          broadcast: { self: false },
        },
      });

      typingChannel.on('broadcast', { event: 'typing' }, ({ payload }) => {
        if (String(payload.userId) !== String(currentUserId)) {
          callbacksRef.current.onTypingUpdate?.(payload as TypingStatus);
        }
      });

      typingChannel.on('broadcast', { event: 'message' }, ({ payload }) => {
        const data = payload as BroadcastMessagePayload;
        if (!data?.message) return;
        if (String(data.message.senderId) === String(currentUserId)) return;
        callbacksRef.current.onNewMessage?.(data.message);
      });

      typingChannel.on('broadcast', { event: 'message_deleted' }, ({ payload }) => {
        const data = payload as BroadcastDeletePayload;
        if (!data?.messageId) return;
        callbacksRef.current.onMessageDeleted?.(data.messageId);
      });

      if (cancelled) {
        void supabase.removeChannel(typingChannel);
        void supabase.removeChannel(messagesChannel);
        return;
      }

      typingChannel.subscribe((status, err) => {
        console.log(`[Chat Realtime] ${typingChannelName}: ${status}`, err ?? '');
      });

      typingChannelRef.current = typingChannel;
    };

    void setup();

    return () => {
      cancelled = true;
      if (messagesChannelRef.current) {
        supabase.removeChannel(messagesChannelRef.current);
        messagesChannelRef.current = null;
      }
      if (typingChannelRef.current) {
        supabase.removeChannel(typingChannelRef.current);
        typingChannelRef.current = null;
      }
      setIsConnected(false);
    };
  }, [conversationId, currentUserId]);

  const sendTyping = useCallback((userId: string, isTyping: boolean) => {
    typingChannelRef.current?.send({
      type: 'broadcast',
      event: 'typing',
      payload: { userId, isTyping },
    });
  }, []);

  const sendMessageBroadcast = useCallback((message: Message) => {
    typingChannelRef.current?.send({
      type: 'broadcast',
      event: 'message',
      payload: { message },
    });
  }, []);

  const sendMessageDeletedBroadcast = useCallback((messageId: string) => {
    typingChannelRef.current?.send({
      type: 'broadcast',
      event: 'message_deleted',
      payload: { messageId },
    });
  }, []);

  /** Presence đã tắt trên kênh tin nhắn để giảm tải join; giữ API để sau này bật lại nếu cần. */
  const trackPresence = useCallback(async (_userInfo: { userId: string; name: string; avatar?: string }) => {
    /* no-op */
  }, []);

  return {
    isConnected,
    sendTyping,
    sendMessageBroadcast,
    sendMessageDeletedBroadcast,
    trackPresence,
  };
}
