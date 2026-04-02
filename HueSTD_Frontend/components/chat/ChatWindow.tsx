import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Send, Users, MoreVertical, Paperclip, X, Flag } from 'lucide-react';
import { chatService } from '../../services/chatService';
import { uploadDocumentFile } from '../../services/api';
import { Conversation, Message, TypingStatus } from '../../types/chat';

interface ChatWindowProps {
  conversationId?: string;
  conversationType: 'direct' | 'group';
  conversationName?: string;
  conversationAvatar?: string;
  currentUserId: string;
  onTyping: (userId: string, isTyping: boolean) => void;
  onMessageBroadcast: (message: Message) => void;
  onConversationUpdate: (message: Message, options?: { markRead?: boolean }) => void;
  isRealtimeConnected: boolean;
  draftPeer?: {
    userId: string;
    userName: string;
    userAvatar: string;
    email?: string;
  };
  onDraftConversationCreated?: (conversation: Conversation, peerUserId: string) => void;
}

const RECENT_BUFFER_TTL_MS = 10000;

const ChatWindow: React.FC<ChatWindowProps> = ({
  conversationId,
  conversationType,
  conversationName,
  conversationAvatar,
  currentUserId,
  onTyping,
  onMessageBroadcast,
  onConversationUpdate,
  isRealtimeConnected,
  draftPeer,
  onDraftConversationCreated,
}) => {
  const isDraftConversation = !conversationId && !!draftPeer;

  const [messages, setMessages] = useState<Message[]>([]);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [typingStatus, setTypingStatus] = useState<TypingStatus | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedFilePreviewUrl, setSelectedFilePreviewUrl] = useState<string | null>(null);
  const [reportingMessageId, setReportingMessageId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageInputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const typingIndicatorTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingSendRef = useRef(false);
  const isRealtimeConnectedRef = useRef(isRealtimeConnected);
  const recentBufferedMessagesRef = useRef<Map<string, Message>>(new Map());
  const latestMessagesRequestRef = useRef(0);
  const conversationRef = useRef<Conversation | null>(null);

  isRealtimeConnectedRef.current = isRealtimeConnected;
  conversationRef.current = conversation;

  const getAvatarFallback = useCallback((name?: string, email?: string) => {
    const seed = name || email || 'U';
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(seed)}&background=0d9488&color=fff&size=100`;
  }, []);

  const sortMessages = useCallback(
    (items: Message[]) =>
      [...items].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      ),
    []
  );

  const isImageUrl = useCallback((value?: string) => {
    if (!value) return false;
    return /\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?|$)/i.test(value);
  }, []);

  const formatFileSize = useCallback((size?: number) => {
    if (!size) return '';
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }, []);

  const resetComposerHeight = useCallback(() => {
    if (!messageInputRef.current) return;
    messageInputRef.current.style.height = '24px';
  }, []);

  const clearSelectedFile = useCallback(() => {
    if (selectedFilePreviewUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(selectedFilePreviewUrl);
    }
    setSelectedFile(null);
    setSelectedFilePreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [selectedFilePreviewUrl]);

  const bufferRecentMessage = useCallback((message: Message) => {
    if (!message?.id || String(message.id).startsWith('temp-')) return;
    if (message.isDeleted) {
      recentBufferedMessagesRef.current.delete(message.id);
      return;
    }
    recentBufferedMessagesRef.current.set(message.id, message);
    window.setTimeout(() => {
      recentBufferedMessagesRef.current.delete(message.id);
    }, RECENT_BUFFER_TTL_MS);
  }, []);

  const upsertMessage = useCallback(
    (prev: Message[], message: Message) => {
      if (message.isDeleted) {
        return sortMessages(prev.filter((item) => item.id !== message.id));
      }
      const byId = new Map(prev.map((item) => [item.id, item] as const));
      const existing = byId.get(message.id);
      byId.set(message.id, existing ? { ...existing, ...message } : message);
      return sortMessages(Array.from(byId.values()));
    },
    [sortMessages]
  );

  const mergeApiMessages = useCallback(
    (prev: Message[], apiMessages: Message[]) => {
      const mergedById = new Map<string, Message>();

      for (const apiMessage of apiMessages) {
        if (apiMessage.isDeleted) {
          recentBufferedMessagesRef.current.delete(apiMessage.id);
          continue;
        }
        mergedById.set(apiMessage.id, apiMessage);
        recentBufferedMessagesRef.current.delete(apiMessage.id);
      }

      for (const prevMessage of prev) {
        if (prevMessage.isDeleted) continue;
        if (String(prevMessage.id).startsWith('temp-') && !mergedById.has(prevMessage.id)) {
          mergedById.set(prevMessage.id, prevMessage);
        }
      }

      for (const bufferedMessage of recentBufferedMessagesRef.current.values()) {
        if (bufferedMessage.isDeleted) continue;
        if (!mergedById.has(bufferedMessage.id)) {
          mergedById.set(bufferedMessage.id, bufferedMessage);
        }
      }

      return sortMessages(Array.from(mergedById.values()));
    },
    [sortMessages]
  );

  const getConversationFallbackMessages = useCallback(
    (conversationData: Conversation | null) => {
      if (!conversationData?.lastMessage || conversationData.lastMessage.isDeleted) return [];
      return [conversationData.lastMessage];
    },
    []
  );

  const fetchMessages = useCallback(
    async (opts?: { merge?: boolean; silent?: boolean }) => {
      if (!conversationId) {
        setMessages([]);
        if (!opts?.silent) setLoading(false);
        return;
      }

      const merge = opts?.merge ?? false;
      const silent = opts?.silent ?? false;
      const requestId = ++latestMessagesRequestRef.current;

      try {
        const { data } = await chatService.getMessages(conversationId);
        const apiMessages = data || [];
        setMessages((prev) => {
          if (requestId !== latestMessagesRequestRef.current) {
            return prev;
          }

          const fallbackMessages =
            apiMessages.length === 0 ? getConversationFallbackMessages(conversationRef.current) : [];
          const nextMessages = apiMessages.length > 0 ? apiMessages : fallbackMessages;

          const shouldMerge =
            merge ||
            prev.length > 0 ||
            recentBufferedMessagesRef.current.size > 0 ||
            prev.some((message) => String(message.id).startsWith('temp-'));

          return shouldMerge ? mergeApiMessages(prev, nextMessages) : sortMessages(nextMessages);
        });
      } catch (error) {
        console.error('Failed to fetch messages:', error);
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [conversationId, getConversationFallbackMessages, mergeApiMessages, sortMessages]
  );

  const fetchConversation = useCallback(async () => {
    if (!conversationId) {
      setConversation(null);
      return;
    }

    try {
      const { data } = await chatService.getConversation(conversationId);
      setConversation(data);
      if (data?.lastMessage && !data.lastMessage.isDeleted) {
        setMessages((prev) => {
          if (prev.length > 0) return prev;
          return sortMessages([data.lastMessage!]);
        });
      }
    } catch (error) {
      console.error('Failed to fetch conversation:', error);
    }
  }, [conversationId, sortMessages]);

  useEffect(() => {
    latestMessagesRequestRef.current += 1;
    setLoading(true);
    setTypingStatus(null);
    setMessages([]);
    setConversation(null);
    recentBufferedMessagesRef.current.clear();
    if (conversationId) {
      void fetchMessages();
      void fetchConversation();
    } else {
      setLoading(false);
    }

    return () => {
      latestMessagesRequestRef.current += 1;
      clearSelectedFile();
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (typingIndicatorTimeoutRef.current) {
        clearTimeout(typingIndicatorTimeoutRef.current);
      }
    };
  }, [clearSelectedFile, conversationId, fetchConversation, fetchMessages]);

  useEffect(() => {
    if (!conversationId || loading) return;

    let cancelled = false;
    let inFlight = false;

    const poll = async () => {
      if (cancelled || document.visibilityState !== 'visible' || inFlight) return;
      if (isRealtimeConnectedRef.current) return;
      if (pendingSendRef.current) return;

      inFlight = true;
      try {
        await fetchMessages({ merge: true, silent: true });
      } finally {
        inFlight = false;
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') void poll();
    };

    const intervalId = window.setInterval(poll, 8000);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [conversationId, fetchMessages, loading]);

  useEffect(() => {
    if (!conversationId || conversationType !== 'direct') return;

    const syncSeenState = async () => {
      if (document.visibilityState !== 'visible') return;
      await fetchConversation();
    };

    void syncSeenState();
    const intervalId = window.setInterval(syncSeenState, 3000);

    return () => {
      clearInterval(intervalId);
    };
  }, [conversationId, conversationType, fetchConversation]);

  useEffect(() => {
    if (!conversationId || document.visibilityState !== 'visible') return;
    void chatService.markAsRead(conversationId).catch(() => {});
  }, [conversationId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typingStatus]);

  useEffect(() => {
    const handleNewMessage = (e: Event) => {
      const message = (e as CustomEvent<Message>).detail;
      if (message.conversationId !== conversationId) return;

      bufferRecentMessage(message);
      setMessages((prev) => upsertMessage(prev, message));
      setTypingStatus(null);
    };

    const handleMessageUpdated = (e: Event) => {
      const message = (e as CustomEvent<Message>).detail;
      if (message.conversationId !== conversationId) return;

      bufferRecentMessage(message);
      setMessages((prev) => upsertMessage(prev, message));
    };

    const handleMessageDeleted = (e: Event) => {
      const { messageId } = (e as CustomEvent<{ messageId: string }>).detail;
      recentBufferedMessagesRef.current.delete(messageId);
      setMessages((prev) => prev.filter((item) => item.id !== messageId));
    };

    const handleTyping = (e: Event) => {
      const status = (e as CustomEvent<TypingStatus>).detail;
      setTypingStatus(status);

      if (typingIndicatorTimeoutRef.current) {
        clearTimeout(typingIndicatorTimeoutRef.current);
      }

      typingIndicatorTimeoutRef.current = setTimeout(() => {
        setTypingStatus(null);
      }, 2200);
    };

    const handleReaction = (e: Event) => {
      const { messageId, reactions } = (e as CustomEvent<{ messageId: string; reactions: any[] }>).detail;
      setMessages((prev) =>
        prev.map((item) => (item.id === messageId ? { ...item, reactions } : item))
      );
    };

    window.addEventListener('CHAT_NEW_MESSAGE', handleNewMessage);
    window.addEventListener('CHAT_MESSAGE_UPDATED', handleMessageUpdated);
    window.addEventListener('CHAT_MESSAGE_DELETED', handleMessageDeleted);
    window.addEventListener('CHAT_TYPING', handleTyping);
    window.addEventListener('CHAT_REACTION', handleReaction);

    return () => {
      window.removeEventListener('CHAT_NEW_MESSAGE', handleNewMessage);
      window.removeEventListener('CHAT_MESSAGE_UPDATED', handleMessageUpdated);
      window.removeEventListener('CHAT_MESSAGE_DELETED', handleMessageDeleted);
      window.removeEventListener('CHAT_TYPING', handleTyping);
      window.removeEventListener('CHAT_REACTION', handleReaction);

      if (typingIndicatorTimeoutRef.current) {
        clearTimeout(typingIndicatorTimeoutRef.current);
      }
    };
  }, [bufferRecentMessage, conversationId, upsertMessage]);

  const handleSend = async () => {
    const content = newMessage.trim();
    if ((!content && !selectedFile) || sending) return;

    const tempId = `temp-${Date.now()}`;
    const effectiveConversationId = conversationId || `draft-${draftPeer?.userId || 'peer'}`;
    const tempFileUrl = selectedFilePreviewUrl || undefined;
    const tempMessage: Message = {
      id: tempId,
      conversationId: effectiveConversationId,
      senderId: currentUserId,
      senderName: 'Ban',
      senderAvatar: '',
      content: content || selectedFile?.name || '',
      contentType: selectedFile ? 'file' : 'text',
      fileUrl: tempFileUrl,
      fileName: selectedFile?.name,
      fileSize: selectedFile?.size,
      isEdited: false,
      isDeleted: false,
      createdAt: new Date().toISOString(),
      reactions: [],
    };

    setMessages((prev) => upsertMessage(prev, tempMessage));
    setNewMessage('');
    resetComposerHeight();
    setSending(true);
    pendingSendRef.current = true;

    try {
      let resolvedConversationId = conversationId;
      let uploadedFileUrl: string | undefined;
      let uploadedFileName: string | undefined;

      if (selectedFile) {
        const uploadResult = await uploadDocumentFile(selectedFile);
        uploadedFileUrl = uploadResult.fileUrl;
        uploadedFileName = uploadResult.fileName;
      }

      if (!resolvedConversationId && draftPeer) {
        const { data: createdConversation } = await chatService.createDirectConversation({
          userId: draftPeer.userId,
        });
        resolvedConversationId = createdConversation.id;
        onDraftConversationCreated?.(createdConversation, draftPeer.userId);
      }

      if (!resolvedConversationId) {
        throw new Error('Conversation ID is required before sending a message.');
      }

      const { data } = await chatService.sendMessage(resolvedConversationId, {
        content: content || uploadedFileName || selectedFile?.name || '',
        contentType: selectedFile ? 'file' : 'text',
        fileUrl: uploadedFileUrl,
        fileName: uploadedFileName || selectedFile?.name,
        fileSize: selectedFile?.size,
      });
      bufferRecentMessage(data);
      setMessages((prev) => {
        const withoutTemp = prev.filter((message) => message.id !== tempId);
        return upsertMessage(withoutTemp, data);
      });
      clearSelectedFile();
      onMessageBroadcast(data);
      onConversationUpdate(data, { markRead: true });
      await chatService.markAsRead(resolvedConversationId);
      void fetchConversation();
    } catch (error) {
      console.error('Failed to send message:', error);
      setMessages((prev) => prev.filter((message) => message.id !== tempId));
    } finally {
      setSending(false);
      pendingSendRef.current = false;
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const nextValue = e.target.value;
    setNewMessage(nextValue);
    e.target.style.height = '24px';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 128)}px`;
    onTyping(currentUserId, true);

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      onTyping(currentUserId, false);
    }, 2000);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    clearSelectedFile();
    setSelectedFile(file);
    if (file.type.startsWith('image/')) {
      setSelectedFilePreviewUrl(URL.createObjectURL(file));
    } else {
      setSelectedFilePreviewUrl(null);
    }
  };

  const handleReportMessage = async (message: Message) => {
    if (reportingMessageId) return;

    const confirmed = window.confirm('Bao cao tin nhan nay toi admin de kiem duyet?');
    if (!confirmed) return;

    setReportingMessageId(message.id);
    try {
      await chatService.reportMessage(message.id, undefined, {
        messageContent: message.content,
        senderName: message.senderName,
        conversationId: message.conversationId,
      });
      window.alert('Da gui bao cao toi admin.');
    } catch (error) {
      console.error('Failed to report message:', error);
      window.alert('Khong the bao cao tin nhan luc nay.');
    } finally {
      setReportingMessageId(null);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const formatTime = (dateStr: string) =>
    new Date(dateStr).toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
    });

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return 'Hom nay';
    if (date.toDateString() === yesterday.toDateString()) return 'Hom qua';

    return date.toLocaleDateString('vi-VN', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
  };

  const getSeenMessageId = () => {
    if (conversationType !== 'direct' || !conversation) return null;

    const otherMember = conversation.members.find((member) => member.userId !== currentUserId);
    if (!otherMember?.lastReadAt) return null;

    const ownMessages = messages.filter(
      (message) =>
        message.senderId === currentUserId &&
        !String(message.id).startsWith('temp-') &&
        !message.isDeleted
    );

    for (let index = ownMessages.length - 1; index >= 0; index -= 1) {
      const message = ownMessages[index];
      if (new Date(otherMember.lastReadAt).getTime() >= new Date(message.createdAt).getTime()) {
        return message.id;
      }
    }

    return null;
  };

  const seenMessageId = getSeenMessageId();

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
      <div className="h-16 shrink-0 border-b border-slate-100 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          {conversationType === 'direct' ? (
            <img
              src={
                conversationAvatar ||
                getAvatarFallback(conversationName, draftPeer?.email)
              }
              alt={conversationName}
              onError={(event) => {
                event.currentTarget.src = getAvatarFallback(conversationName, draftPeer?.email);
              }}
              className="w-10 h-10 rounded-full object-cover"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center">
              <Users size={20} className="text-teal-600" />
            </div>
          )}
          <div>
            <h3 className="font-bold text-slate-800">{conversationName || 'Cuoc tro chuyen'}</h3>
            {typingStatus?.isTyping ? (
              <p className="text-xs text-teal-600 font-medium">Dang nhap...</p>
            ) : conversationType === 'group' ? (
              <p className="text-xs text-slate-500">Nhom</p>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <MoreVertical size={20} className="text-slate-600" />
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4 bg-slate-50">
        {loading ? (
          <div className="flex justify-center items-center h-full">
            <div className="animate-spin w-8 h-8 border-4 border-teal-600 border-t-transparent rounded-full" />
          </div>
        ) : messages.length === 0 && !conversation?.lastMessage ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 bg-slate-200 rounded-full flex items-center justify-center mb-4">
              <Send size={24} className="text-slate-400" />
            </div>
            <p className="text-slate-500 font-medium">Bat dau cuoc tro chuyen</p>
            <p className="text-slate-400 text-sm mt-1">
              {isDraftConversation
                ? 'Chi khi gui tin nhan dau tien thi cuoc tro chuyen moi xuat hien trong danh sach chat'
                : 'Gui tin nhan de bat dau'}
            </p>
          </div>
        ) : (
          <>
            {messages.map((message, index) => {
              const isOwn = message.senderId === currentUserId;
              const showDate =
                index === 0 ||
                formatDate(messages[index - 1].createdAt) !== formatDate(message.createdAt);
              const sendState = String(message.id).startsWith('temp-') ? 'Dang gui' : 'Da gui';

              return (
                <React.Fragment key={message.id}>
                  {showDate && (
                    <div className="flex justify-center">
                      <span className="px-3 py-1 bg-white rounded-full text-xs text-slate-500 font-medium shadow-sm">
                        {formatDate(message.createdAt)}
                      </span>
                    </div>
                  )}
                  <div className={`flex min-w-0 ${isOwn ? 'justify-end' : 'justify-start'}`}>
                    <div className={`min-w-0 max-w-[70%] ${isOwn ? 'order-2' : 'order-1'}`}>
                      {!isOwn && (
                        <div className="flex items-center gap-2 mb-1">
                          <img
                            src={
                              message.senderAvatar ||
                              getAvatarFallback(message.senderName)
                            }
                            alt={message.senderName}
                            onError={(event) => {
                              event.currentTarget.src = getAvatarFallback(message.senderName);
                            }}
                            className="w-6 h-6 rounded-full"
                          />
                          <span className="text-xs font-bold text-slate-600">{message.senderName}</span>
                          <button
                            type="button"
                            onClick={() => void handleReportMessage(message)}
                            disabled={reportingMessageId === message.id}
                            className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-rose-500 disabled:opacity-50"
                            title="Bao cao tin nhan"
                          >
                            <Flag size={12} />
                          </button>
                        </div>
                      )}
                      <div
                        className={`px-4 py-2.5 rounded-2xl ${
                          isOwn
                            ? 'bg-teal-600 text-white rounded-br-md'
                            : 'bg-white text-slate-800 rounded-bl-md shadow-sm'
                        } ${message.isDeleted ? 'italic opacity-60' : ''} min-w-0 overflow-hidden`}
                      >
                        {message.fileUrl && isImageUrl(message.fileUrl) && (
                          <a href={message.fileUrl} target="_blank" rel="noreferrer" className="block mb-2">
                            <img
                              src={message.fileUrl}
                              alt={message.fileName || 'image'}
                              className="max-h-64 w-auto max-w-full rounded-xl object-cover"
                            />
                          </a>
                        )}
                        {message.fileUrl && !isImageUrl(message.fileUrl) && (
                          <a
                            href={message.fileUrl}
                            target="_blank"
                            rel="noreferrer"
                            className={`mb-2 flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm ${
                              isOwn ? 'bg-teal-500/30 text-white' : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            <span className="truncate">{message.fileName || 'Tap dinh kem'}</span>
                            <span className="shrink-0 text-xs opacity-80">{formatFileSize(message.fileSize)}</span>
                          </a>
                        )}
                        {!!message.content && !(message.fileUrl && message.content === message.fileName) && (
                          <p className="text-sm whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                            {message.content}
                          </p>
                        )}
                        {message.reactions && message.reactions.length > 0 && (
                          <div className={`flex gap-1 mt-1 flex-wrap ${isOwn ? 'justify-end' : 'justify-start'}`}>
                            {message.reactions.map((reaction, i) => (
                              <span key={i} className="text-xs bg-slate-100 px-1.5 py-0.5 rounded-full">
                                {reaction.reaction} {reaction.count > 1 && reaction.count}
                              </span>
                            ))}
                          </div>
                        )}
                        <div className={`flex items-center gap-1 mt-1 ${isOwn ? 'justify-end' : 'justify-start'}`}>
                          {message.isEdited && (
                            <span className={`text-[10px] ${isOwn ? 'text-teal-200' : 'text-slate-400'}`}>
                              Da sua
                            </span>
                          )}
                          {isOwn && (
                            <span className={`text-[10px] ${isOwn ? 'text-teal-200' : 'text-slate-400'}`}>
                              {message.id === seenMessageId ? 'Da xem' : sendState}
                            </span>
                          )}
                          <span className={`text-[10px] ${isOwn ? 'text-teal-200' : 'text-slate-400'}`}>
                            {formatTime(message.createdAt)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </React.Fragment>
              );
            })}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      <div className="shrink-0 p-4 border-t border-slate-100 bg-white">
        {selectedFile && (
          <div className="mb-3 flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
            {selectedFilePreviewUrl ? (
              <img
                src={selectedFilePreviewUrl}
                alt={selectedFile.name}
                className="h-12 w-12 rounded-xl object-cover"
              />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-200 text-slate-600">
                <Paperclip size={18} />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-700">{selectedFile.name}</p>
              <p className="text-xs text-slate-500">{formatFileSize(selectedFile.size)}</p>
            </div>
            <button
              type="button"
              onClick={clearSelectedFile}
              className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-600"
            >
              <X size={16} />
            </button>
          </div>
        )}
        <div className="flex items-end gap-2">
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept="image/*,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.zip,.rar"
            onChange={handleFileSelect}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={sending}
            className="p-3 bg-slate-100 hover:bg-slate-200 disabled:bg-slate-100 text-slate-600 rounded-xl transition-colors"
          >
            <Paperclip size={18} />
          </button>
          <div className="flex-1 min-w-0 flex items-end bg-slate-100 rounded-2xl px-4 py-2 overflow-hidden">
            <textarea
              ref={messageInputRef}
              value={newMessage}
              onChange={handleInputChange}
              onKeyPress={handleKeyPress}
              placeholder="Nhap tin nhan..."
              rows={1}
              className="flex-1 min-w-0 bg-transparent resize-none text-sm leading-6 focus:outline-none max-h-32 overflow-y-auto whitespace-pre-wrap break-words [overflow-wrap:anywhere]"
              style={{ minHeight: '24px' }}
            />
          </div>
          <button
            onClick={() => void handleSend()}
            disabled={(!newMessage.trim() && !selectedFile) || sending}
            className="p-3 bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 text-white rounded-xl transition-colors shadow-lg shadow-teal-100"
          >
            <Send size={20} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatWindow;
