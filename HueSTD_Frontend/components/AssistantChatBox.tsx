import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bot,
  ChevronDown,
  Loader2,
  MessageCircle,
  Search,
  Send,
  Sparkles,
  UserRound,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import { useLocation } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { useAuth } from '../context/AuthContext';
import {
  assistantRealtime,
  AssistantChatMessage,
  AssistantSessionJoined,
  createAssistantConnection,
} from '../services/assistantRealtime';
import 'katex/dist/katex.min.css';

interface PendingQueueItem {
  id: string;
  text: string;
  createdAt: string;
}

const DEFAULT_VISIBLE_MESSAGES = 24;
const MAX_LOCAL_MESSAGES = 60;
const SESSION_VERSION = 'v3';
const ASSISTANT_PERSONA = 'default';

const LABELS = {
  title: 'HueSTD Assistant',
  connecting: 'Đang kết nối realtime...',
  reconnecting: 'Đang kết nối lại...',
  offline: 'Đang ngoại tuyến',
  online: 'Đang trực tuyến',
  inputPlaceholder: 'Hỏi về tài liệu, chức năng hoặc thao tác trong HueSTD...',
  typing: 'Assistant đang xử lý...',
  searchPlaceholder: 'Tìm trong cuộc trò chuyện...',
  loadOlder: 'Tải thêm tin nhắn cũ',
  noResults: 'Không tìm thấy tin nhắn phù hợp',
  offlineQueued: 'Tin nhắn sẽ được gửi khi có mạng trở lại.',
  user: 'Bạn',
  assistant: 'Assistant',
} as const;

const dedupeMessages = (messages: AssistantChatMessage[]) => {
  const map = new Map<string, AssistantChatMessage>();
  for (const message of messages) {
    map.set(message.id, message);
  }

  return Array.from(map.values()).sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
};

const truncateText = (text: string, max = 600) => {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}...`;
};

const createLocalAssistantMessage = (
  sessionId: string,
  content: string,
  quickReplies: string[] = []
): AssistantChatMessage => ({
  id: `assistant-${Date.now()}`,
  sessionId,
  role: 'assistant',
  content,
  timestamp: new Date().toISOString(),
  quickReplies,
});

const buildStorageKey = (userId: string, suffix: string) => `assistant:${SESSION_VERSION}:${userId}:${suffix}`;

const AssistantChatBox: React.FC = () => {
  const { user, isAuthenticated } = useAuth();
  const location = useLocation();

  const [sessionId] = useState(`assistant-primary-${SESSION_VERSION}`);
  const [isOpen, setIsOpen] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [messages, setMessages] = useState<AssistantChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(DEFAULT_VISIBLE_MESSAGES);
  const [quickReplies, setQuickReplies] = useState<string[]>([]);
  const [pendingQueue, setPendingQueue] = useState<PendingQueueItem[]>([]);
  const [notificationPermissionAsked, setNotificationPermissionAsked] = useState(false);
  const [featureFlags, setFeatureFlags] = useState<Record<string, boolean>>({});
  const [humanHandoverAvailable, setHumanHandoverAvailable] = useState(false);
  const [lastError, setLastError] = useState('');
  const hasJoinedSessionRef = useRef(false);

  const connectionRef = useRef(createAssistantConnection());
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const isConnectedRef = useRef(false);
  const pendingQueueRef = useRef<PendingQueueItem[]>(pendingQueue);
  const pathnameRef = useRef(location.pathname);
  const userRef = useRef(user);

  useEffect(() => {
    if (!user?.id) return;

    try {
      const savedMessages = localStorage.getItem(buildStorageKey(user.id, 'messages'));
      const savedQueue = localStorage.getItem(buildStorageKey(user.id, 'pendingQueue'));

      if (savedMessages) {
        const parsed = JSON.parse(savedMessages) as AssistantChatMessage[];
        setMessages(dedupeMessages(parsed).slice(-MAX_LOCAL_MESSAGES));
      }

      if (savedQueue) {
        setPendingQueue(JSON.parse(savedQueue) as PendingQueueItem[]);
      }
    } catch {
      localStorage.removeItem(buildStorageKey(user.id, 'messages'));
      localStorage.removeItem(buildStorageKey(user.id, 'pendingQueue'));
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    localStorage.setItem(
      buildStorageKey(user.id, 'messages'),
      JSON.stringify(messages.slice(-MAX_LOCAL_MESSAGES))
    );
  }, [messages, user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    localStorage.setItem(buildStorageKey(user.id, 'pendingQueue'), JSON.stringify(pendingQueue));
  }, [pendingQueue, user?.id]);

  useEffect(() => {
    pendingQueueRef.current = pendingQueue;
  }, [pendingQueue]);

  useEffect(() => {
    pathnameRef.current = location.pathname;
  }, [location.pathname]);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    if (!user?.id) {
      setIsOpen(false);
      setMessages([]);
      setQuickReplies([]);
      setPendingQueue([]);
      setSearchQuery('');
      setNotificationPermissionAsked(false);
      setFeatureFlags({});
      setHumanHandoverAvailable(false);
      setVisibleCount(DEFAULT_VISIBLE_MESSAGES);
      setIsTyping(false);
      setIsConnecting(false);
      setIsReconnecting(false);
      setLastError('');
      hasJoinedSessionRef.current = false;
    }
  }, [user?.id]);

  const filteredMessages = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();
    if (!normalizedSearch) {
      return messages;
    }

    return messages.filter((message) => message.content.toLowerCase().includes(normalizedSearch));
  }, [messages, searchQuery]);

  const visibleMessages = useMemo(
    () => filteredMessages.slice(Math.max(0, filteredMessages.length - visibleCount)),
    [filteredMessages, visibleCount]
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [visibleMessages, isTyping]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !user?.id) return;

    const connection = connectionRef.current;

    const handleJoined = (payload: AssistantSessionJoined) => {
      setFeatureFlags(payload.featureFlags || {});
      setHumanHandoverAvailable(payload.humanHandoverAvailable);
      setQuickReplies(payload.suggestedReplies || []);
      setMessages((prev) => {
        const welcomeNeeded = payload.messages.length === 0 && prev.length === 0;
        return dedupeMessages([
          ...payload.messages,
          ...prev,
          ...(welcomeNeeded
            ? [
                {
                  id: `${payload.sessionId}-welcome`,
                  sessionId: payload.sessionId,
                  role: 'assistant' as const,
                  content: payload.welcomeMessage,
                  timestamp: new Date().toISOString(),
                  quickReplies: payload.suggestedReplies || [],
                },
              ]
            : []),
        ]);
      });
      setIsConnecting(false);
      setIsReconnecting(false);
      isConnectedRef.current = true;
      hasJoinedSessionRef.current = true;
    };

    const handleAssistantMessage = (payload: AssistantChatMessage) => {
      setMessages((prev) => dedupeMessages([...prev, payload]));
      setQuickReplies(payload.quickReplies || []);
      setIsTyping(false);
      setLastError('');
      if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
        new Notification('HueSTD Assistant', { body: truncateText(payload.content, 140) });
      }
    };

    const handleTypingStarted = () => setIsTyping(true);
    const handleTypingFinished = () => setIsTyping(false);
    const handleRequestFailed = (payload: { message?: string }) => {
      setIsTyping(false);
      setLastError(payload.message || 'Không thể xử lý yêu cầu lúc này.');
    };

    connection.onreconnecting(() => {
      setIsReconnecting(true);
      isConnectedRef.current = false;
      setLastError('');
    });

    connection.onreconnected(() => {
      setIsReconnecting(false);
      isConnectedRef.current = true;
      void joinAssistantSession();
      void flushPendingQueue();
    });

    connection.onclose(() => {
      isConnectedRef.current = false;
      setIsTyping(false);
      setLastError('Kết nối tới assistant đã đóng. Hệ thống sẽ kết nối lại khi cần.');
    });

    connection.on('AssistantSessionJoined', handleJoined);
    connection.on('AssistantMessageReceived', handleAssistantMessage);
    connection.on('AssistantTypingStarted', handleTypingStarted);
    connection.on('AssistantTypingFinished', handleTypingFinished);
    connection.on('AssistantRequestFailed', handleRequestFailed);

    return () => {
      connection.off('AssistantSessionJoined', handleJoined);
      connection.off('AssistantMessageReceived', handleAssistantMessage);
      connection.off('AssistantTypingStarted', handleTypingStarted);
      connection.off('AssistantTypingFinished', handleTypingFinished);
      connection.off('AssistantRequestFailed', handleRequestFailed);
      void connection.stop();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, user?.id]);

  const getMetadata = () => ({
    page: pathnameRef.current,
    title: document.title,
    userId: userRef.current?.id || '',
    userRole: userRef.current?.role || 'user',
  });

  const getModuleFromPath = () => pathnameRef.current.replace('/', '') || 'dashboard';

  const joinAssistantSession = async () => {
    if (!isAuthenticated || !userRef.current?.id) return;

    if (!hasJoinedSessionRef.current) {
      setIsConnecting(true);
    }
    setLastError('');

    const connection = connectionRef.current;
    await assistantRealtime.start(connection);
    isConnectedRef.current = true;

    await assistantRealtime.joinSession(connection, {
      sessionId,
      locale: 'vi-VN',
      persona: ASSISTANT_PERSONA,
      pagePath: pathnameRef.current,
      pageTitle: document.title,
      module: getModuleFromPath(),
      contextSummary: `Người dùng ${userRef.current?.fullName || userRef.current?.email} đang ở ${pathnameRef.current}`,
      metadata: getMetadata(),
    });
  };

  useEffect(() => {
    if (!isOpen || !isAuthenticated || !user?.id) return;
    if (hasJoinedSessionRef.current && isConnectedRef.current) return;
    void joinAssistantSession();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, isAuthenticated, user?.id]);

  const requestNotificationsIfNeeded = async () => {
    if (!('Notification' in window) || notificationPermissionAsked) return;
    setNotificationPermissionAsked(true);
    try {
      await Notification.requestPermission();
    } catch {
      // ignore permission errors
    }
  };

  const flushPendingQueue = async () => {
    if (!pendingQueueRef.current.length || !isOnline || !isConnectedRef.current) return;

    for (const queued of pendingQueueRef.current) {
      try {
        await assistantRealtime.sendUserMessage(connectionRef.current, {
          sessionId,
          message: queued.text,
          locale: 'vi-VN',
          persona: ASSISTANT_PERSONA,
          pagePath: pathnameRef.current,
          pageTitle: document.title,
          module: getModuleFromPath(),
          contextSummary: `Gửi lại hàng đợi ngoại tuyến cho ${userRef.current?.fullName || userRef.current?.email}`,
          metadata: getMetadata(),
        });
        setPendingQueue((prev) => prev.filter((item) => item.id !== queued.id));
      } catch {
        return;
      }
    }
  };

  useEffect(() => {
    void flushPendingQueue();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline, pendingQueue.length]);

  const queueOfflineMessage = (text: string) => {
    const queued: PendingQueueItem = {
      id: `queued-${Date.now()}`,
      text,
      createdAt: new Date().toISOString(),
    };
    setPendingQueue((prev) => [...prev, queued]);
    setMessages((prev) => [...prev, createLocalAssistantMessage(sessionId, LABELS.offlineQueued, quickReplies)]);
  };

  const sendToAssistant = async (message: string) => {
    await assistantRealtime.sendUserMessage(connectionRef.current, {
      sessionId,
      message,
      locale: 'vi-VN',
      persona: ASSISTANT_PERSONA,
      pagePath: pathnameRef.current,
      pageTitle: document.title,
      module: getModuleFromPath(),
      contextSummary: `Người dùng ${userRef.current?.fullName || userRef.current?.email} đang ở ${pathnameRef.current}`,
      metadata: getMetadata(),
    });
  };

  const handleSend = async (overrideMessage?: string) => {
    const message = (overrideMessage ?? inputValue).trim();
    if (!message || !isAuthenticated || !user?.id) return;

    const userMessage: AssistantChatMessage = {
      id: `local-${Date.now()}`,
      sessionId,
      role: 'user',
      content: message,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => dedupeMessages([...prev, userMessage]));
    setInputValue('');
    setIsTyping(true);
    setLastError('');
    await requestNotificationsIfNeeded();

    if (!isOnline || !isConnectedRef.current) {
      setIsTyping(false);
      queueOfflineMessage(message);
      return;
    }

    try {
      await sendToAssistant(message);
    } catch (error) {
      console.error('[AssistantChatBox] Failed to send message:', error);
      setIsTyping(false);
      setLastError(error instanceof Error ? error.message : 'Không thể gửi tin nhắn tới assistant.');
      queueOfflineMessage(message);
    }
  };

  if (!isAuthenticated || !user?.id) {
    return null;
  }

  return (
    <div className="fixed bottom-3 right-3 z-40 md:bottom-4 md:right-4">
      {isOpen ? (
        <section
          aria-label="HueSTD Assistant"
          aria-live="polite"
          className="w-[min(320px,calc(100vw-0.75rem))] sm:w-[340px] overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-xl shadow-slate-200/70"
        >
          <header className="bg-gradient-to-r from-teal-600 to-emerald-500 px-3.5 py-3 text-white">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/15">
                  <Sparkles size={15} />
                </div>
                <div>
                  <p className="text-sm font-black leading-none">{LABELS.title}</p>
                  <div className="mt-1 flex items-center gap-2 text-[11px] text-white/85">
                    {isOnline ? <Wifi size={12} /> : <WifiOff size={12} />}
                    <span>{isReconnecting ? LABELS.reconnecting : isOnline ? LABELS.online : LABELS.offline}</span>
                    <span>•</span>
                    <UserRound size={12} />
                    <span className="max-w-[210px] truncate">{user.fullName || user.email}</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                aria-label="Đóng hộp chat trợ lý"
                className="rounded-lg p-1.5 hover:bg-white/10"
              >
                <X size={16} />
              </button>
            </div>
          </header>

          <div className="border-b border-slate-100 bg-white px-3 py-2.5">
            <div className="flex items-center gap-2 rounded-xl bg-slate-100 px-2.5 py-2">
              <Search size={14} className="text-slate-400" />
              <input
                aria-label={LABELS.searchPlaceholder}
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder={LABELS.searchPlaceholder}
                className="w-full bg-transparent text-xs outline-none"
              />
            </div>
            {lastError && (
              <div className="mt-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] text-rose-700">
                {lastError}
              </div>
            )}
            {!!pendingQueue.length && (
              <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-700">
                Có {pendingQueue.length} tin nhắn đang chờ gửi lại khi kết nối ổn định.
              </div>
            )}
          </div>

          <div className="h-[320px] sm:h-[360px] overflow-y-auto bg-slate-50 px-3 py-3" role="log" aria-live="polite">
            {isConnecting ? (
              <div className="flex h-full items-center justify-center text-sm text-slate-500">
                <Loader2 size={18} className="mr-2 animate-spin" />
                {LABELS.connecting}
              </div>
            ) : (
              <div className="space-y-3">
                {filteredMessages.length > visibleCount && (
                  <button
                    onClick={() => setVisibleCount((current) => current + DEFAULT_VISIBLE_MESSAGES)}
                    className="mx-auto flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-semibold text-slate-600 shadow-sm"
                  >
                    <ChevronDown size={14} />
                    {LABELS.loadOlder}
                  </button>
                )}

                {visibleMessages.length === 0 && searchQuery ? (
                  <div className="rounded-2xl bg-white px-4 py-3 text-sm text-slate-500 shadow-sm">
                    {LABELS.noResults}
                  </div>
                ) : (
                  visibleMessages.map((message) => {
                    const isUser = message.role === 'user';
                    return (
                      <div key={message.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                        <div
                          className={`max-w-[90%] rounded-2xl px-3 py-2.5 text-xs shadow-sm ${
                            isUser ? 'rounded-br-md bg-teal-600 text-white' : 'rounded-bl-md bg-white text-slate-700'
                          }`}
                        >
                          <div className="mb-1 flex items-center gap-2 text-[11px] opacity-70">
                            {isUser ? <MessageCircle size={12} /> : <Bot size={12} />}
                            <span>{isUser ? LABELS.user : LABELS.assistant}</span>
                            <span>•</span>
                            <span>
                              {new Date(message.timestamp).toLocaleTimeString('vi-VN', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                          {isUser ? (
                            <p className="whitespace-pre-wrap break-words">{message.content}</p>
                          ) : (
                            <>
                              <div className="prose prose-sm max-w-none text-slate-700 prose-p:my-1.5 prose-headings:my-1.5 prose-headings:font-bold prose-ul:my-1.5 prose-ol:my-1.5 prose-li:my-1 prose-pre:overflow-x-auto prose-pre:rounded-lg prose-pre:bg-slate-900 prose-pre:p-2 prose-code:rounded prose-code:bg-slate-100 prose-code:px-1 prose-code:py-0.5 prose-code:text-[0.85em]">
                                <ReactMarkdown
                                  remarkPlugins={[remarkMath]}
                                  rehypePlugins={[rehypeKatex]}
                                  components={{
                                    a: ({ ...props }) => (
                                      <a {...props} target="_blank" rel="noreferrer" className="font-semibold text-teal-700 underline" />
                                    ),
                                    img: ({ ...props }) => <img {...props} className="max-h-64 rounded-xl object-cover" />,
                                    table: ({ ...props }) => (
                                      <div className="overflow-x-auto">
                                        <table {...props} className="min-w-full border-collapse text-xs" />
                                      </div>
                                    ),
                                    th: ({ ...props }) => <th {...props} className="border border-slate-200 bg-slate-100 px-2 py-1 text-left" />,
                                    td: ({ ...props }) => <td {...props} className="border border-slate-200 px-2 py-1 align-top" />,
                                  }}
                                >
                                  {message.content}
                                </ReactMarkdown>
                              </div>
                              {!!message.quickReplies?.length && featureFlags.quickReplies !== false && (
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                  {message.quickReplies.map((reply) => (
                                    <button
                                      key={`${message.id}-${reply}`}
                                      onClick={() => void handleSend(reply)}
                                      className="rounded-full border border-teal-200 bg-teal-50 px-2.5 py-1 text-[11px] font-semibold text-teal-700"
                                    >
                                      {reply}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}

                {isTyping && (
                  <div className="flex justify-start">
                    <div className="rounded-2xl rounded-bl-md bg-white px-3 py-2.5 text-xs text-slate-500 shadow-sm">
                      {LABELS.typing}
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          <div className="border-t border-slate-100 bg-white p-2.5">
            <div className="flex items-end gap-2 rounded-xl bg-slate-100 p-1.5">
              <textarea
                aria-label={LABELS.inputPlaceholder}
                value={inputValue}
                onChange={(event) => setInputValue(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    void handleSend();
                  }
                }}
                placeholder={LABELS.inputPlaceholder}
                rows={1}
                className="max-h-24 min-h-[38px] flex-1 resize-none bg-transparent px-2 py-1.5 text-xs outline-none"
              />
              <button
                onClick={() => void handleSend()}
                disabled={!inputValue.trim() || isConnecting}
                aria-label="Gửi tin nhắn"
                className="rounded-lg bg-teal-600 p-2.5 text-white transition-colors hover:bg-teal-700 disabled:bg-slate-300"
              >
                <Send size={14} />
              </button>
            </div>
          </div>
        </section>
      ) : (
        <button
          onClick={() => setIsOpen(true)}
          aria-label="Mở hộp chat trợ lý"
          className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-r from-teal-600 to-emerald-500 text-white shadow-xl shadow-teal-200 transition-transform hover:scale-105"
        >
          <Sparkles size={18} />
        </button>
      )}
    </div>
  );
};

export default AssistantChatBox;

