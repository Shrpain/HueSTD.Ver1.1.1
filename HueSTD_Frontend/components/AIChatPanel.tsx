import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Bot, User, AlertCircle, ArrowDown, Lock, MessageCircle, CheckCircle } from 'lucide-react';
import { chatWithDocument, getMyAiUsage, ChatMessage, getSystemPrompt } from '../services/aiService';
import { useAuth } from '../context/AuthContext';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { supabase } from '../services/supabase';
import 'katex/dist/katex.min.css';

interface AIChatPanelProps {
    documentTitle: string;
    extractedText: string;
    onClose: () => void;
}

const AIChatPanel: React.FC<AIChatPanelProps> = ({ documentTitle, extractedText, onClose }) => {
    const { user, isAuthenticated } = useAuth();
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [isAiReady, setIsAiReady] = useState(false);
    const [showScrollButton, setShowScrollButton] = useState(false);
    const [isLimitExceeded, setIsLimitExceeded] = useState(false);
    const [remainingMessages, setRemainingMessages] = useState<number | null>(null);
    const [hasDedicatedApi, setHasDedicatedApi] = useState(false);
    const [notAuthenticated, setNotAuthenticated] = useState(false);

    const messagesContainerRef = useRef<HTMLDivElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Fetch initial usage
    const fetchUsage = useCallback(async () => {
        try {
            const usage = await getMyAiUsage();
            const dedicated = !!usage.hasDedicatedApi;
            setHasDedicatedApi(dedicated);
            setRemainingMessages(usage.remaining);
            setIsLimitExceeded(!dedicated && !usage.isUnlocked && usage.remaining <= 0);
            setNotAuthenticated(false);
        } catch (err: any) {
            if (err?.status === 401 || err?.error?.status === 401) {
                setNotAuthenticated(true);
                setIsAiReady(true);
            }
        }
    }, []);

    useEffect(() => {
        fetchUsage();
    }, [fetchUsage]);

    // Realtime subscription for AI unlock notifications
    useEffect(() => {
        const channel = supabase
            .channel('ai_unlock_realtime')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'notifications',
                    filter: "type=eq.ai_unlock_approved"
                },
                () => {
                    fetchUsage();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [fetchUsage]);

    // Realtime: admin cấp API / cập nhật usage — refresh ngay
    useEffect(() => {
        if (!user?.id) return;
        const channel = supabase
            .channel(`my_ai_usage_${user.id}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'user_ai_usages',
                    filter: `user_id=eq.${user.id}`
                },
                () => {
                    fetchUsage();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user?.id, fetchUsage]);

    // Auto-scroll
    useEffect(() => {
        if (messagesContainerRef.current) {
            const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
            const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
            if (isNearBottom) {
                scrollToBottom();
            }
        }
    }, [messages, isTyping]);

    useEffect(() => {
        let mounted = true;
        const initChat = async () => {
            if (extractedText) {
                setIsTyping(true);
                try {
                    const systemPrompt = getSystemPrompt(extractedText);
                    const response = await chatWithDocument(systemPrompt, extractedText, true);
                    if (mounted) {
                        setMessages([{ id: 'welcome', role: 'assistant', content: response, timestamp: new Date() }]);
                        setIsAiReady(true);
                        fetchUsage();
                    }
                } catch (err: any) {
                    if (mounted) {
                        if (err.status === 401 || err.error?.status === 401) {
                            setMessages([{
                                id: 'unauth',
                                role: 'assistant',
                                content: 'Vui lòng đăng nhập để sử dụng AI.',
                                timestamp: new Date()
                            }]);
                            setNotAuthenticated(true);
                        } else if (err.errorCode === 'limit_exceeded') {
                            setMessages([{ id: 'limit', role: 'assistant', content: err.message, timestamp: new Date() }]);
                            setIsLimitExceeded(true);
                        } else {
                            setMessages([{ id: 'error', role: 'assistant', content: "Xin lỗi, không thể đọc tài liệu.", timestamp: new Date() }]);
                        }
                        setIsAiReady(true);
                    }
                } finally {
                    if (mounted) setIsTyping(false);
                }
            } else {
                if (mounted) {
                    setMessages([{ id: 'no-content', role: 'assistant', content: "Tài liệu không có nội dung.", timestamp: new Date() }]);
                    setIsAiReady(true);
                }
            }
        };
        initChat();
        setTimeout(scrollToBottom, 100);
        return () => { mounted = false; };
    }, [extractedText, fetchUsage]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const handleScroll = () => {
        if (messagesContainerRef.current) {
            const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
            const isNotAtBottom = scrollHeight - scrollTop - clientHeight > 100;
            setShowScrollButton(isNotAtBottom);
        }
    };

    const handleSendMessage = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!inputValue.trim() || isTyping || !isAiReady || isLimitExceeded || notAuthenticated) return;

        const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', content: inputValue, timestamp: new Date() };
        setMessages(prev => [...prev, userMsg]);
        setInputValue('');
        setIsTyping(true);
        setTimeout(scrollToBottom, 50);

        try {
            const responseText = await chatWithDocument(userMsg.content, extractedText);
            setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'assistant', content: responseText, timestamp: new Date() }]);
            fetchUsage();
        } catch (err: any) {
            if (err.status === 401 || err.error?.status === 401) {
                setMessages(prev => [...prev, {
                    id: (Date.now() + 1).toString(),
                    role: 'assistant',
                    content: 'Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.',
                    timestamp: new Date()
                }]);
                setNotAuthenticated(true);
            } else if (err.errorCode === 'limit_exceeded') {
                setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'assistant', content: err.message, timestamp: new Date() }]);
                setIsLimitExceeded(true);
            } else {
                setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'assistant', content: 'Có lỗi xảy ra.', timestamp: new Date() }]);
            }
        } finally {
            setIsTyping(false);
        }
    };

    const isDisabled = (!hasDedicatedApi && isLimitExceeded) || !isAiReady || notAuthenticated;

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }} className="bg-slate-50">
            {/* Chưa đăng nhập — yêu cầu đăng nhập */}
            {notAuthenticated && (
                <div className="mx-4 mt-3 bg-slate-100 border border-slate-300 rounded-xl p-3 flex items-start gap-3 text-slate-700 text-sm">
                    <Lock size={16} className="mt-0.5 shrink-0 text-slate-500" />
                    <div>
                        <p className="font-semibold">Bạn chưa đăng nhập</p>
                        <p className="text-xs text-slate-500 mt-0.5">Vui lòng đăng nhập để sử dụng tính năng Hỏi AI.</p>
                    </div>
                </div>
            )}

            {/* API riêng — không giới hạn */}
            {hasDedicatedApi && (
                <div className="mx-4 mt-3 bg-emerald-50 border border-emerald-200 rounded-lg p-2 flex items-center gap-2 text-emerald-800 text-xs">
                    <CheckCircle size={14} className="shrink-0" />
                    <span>Bạn đã được cấp API</span>
                </div>
            )}

            {/* Gói miễn phí — cảnh báo sắp hết lượt */}
            {!hasDedicatedApi && remainingMessages !== null && !isLimitExceeded && remainingMessages <= 3 && (
                <div className="mx-4 mt-3 bg-amber-50 border border-amber-200 rounded-lg p-2 flex items-center gap-2 text-amber-800 text-xs">
                    <AlertCircle size={14} className="shrink-0" />
                    <span>Còn <strong>{remainingMessages}</strong> lượt hỏi AI miễn phí. Liên hệ Admin nếu cần thêm.</span>
                </div>
            )}

            {/* Messages Area */}
            <div
                ref={messagesContainerRef}
                onScroll={handleScroll}
                style={{ flex: 1, minHeight: 0, overflowY: 'auto', scrollBehavior: 'smooth' }}
                className="p-4 relative"
            >
                {extractedText.length < 50 && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 flex items-start gap-3 text-yellow-800 text-sm mb-4">
                        <AlertCircle size={16} className="mt-0.5 shrink-0" />
                        <p>Tài liệu có ít nội dung.</p>
                    </div>
                )}

                <div className="space-y-4">
                    {messages.map((msg) => (
                        <div key={msg.id} className={`flex items-start gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-indigo-100 text-indigo-600' : 'bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-md'}`}>
                                {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
                            </div>
                            <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm shadow-sm ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-white text-slate-700 border rounded-bl-none'}`}>
                                {msg.role === 'user' ? (
                                    <span className="whitespace-pre-wrap">{msg.content}</span>
                                ) : (
                                    <div className="prose prose-sm prose-slate max-w-none [&_p]:my-1.5 [&_ul]:my-2 [&_ol]:my-2 [&_li]:my-0.5 [&_h1]:text-base [&_h1]:font-bold [&_h2]:text-sm [&_h2]:font-semibold [&_h3]:text-sm [&_.katex]:text-[0.95em] [&_strong]:font-semibold [&_code]:bg-slate-100 [&_code]:px-1 [&_code]:rounded">
                                        <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                                            {msg.content}
                                        </ReactMarkdown>
                                    </div>
                                )}
                                <p className={`text-[10px] mt-2 opacity-70 ${msg.role === 'user' ? 'text-indigo-200 text-right' : 'text-slate-400'}`}>
                                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </p>

                                {/* Contact Admin button when limit exceeded */}
                                {msg.id !== 'welcome' && msg.id !== 'no-content' && msg.id !== 'error' && (() => {
                                    const isLimitMsg = msg.content?.includes('hết lượt') || msg.content?.includes('liên hệ Admin') || msg.content?.includes('Hết lượt');
                                    if (msg.role === 'assistant' && isLimitMsg && !isLimitExceeded) return null;
                                    return null;
                                })()}
                            </div>
                        </div>
                    ))}

                    {isTyping && (
                        <div className="flex items-start gap-2">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-white shadow-md">
                                <Bot size={16} />
                            </div>
                            <div className="bg-white border rounded-2xl rounded-bl-none px-4 py-3 shadow-sm">
                                <div className="flex gap-1.5">
                                    <span className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                                    <span className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                                    <span className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
                <div ref={messagesEndRef} />
            </div>

            {/* Scroll to bottom button */}
            {showScrollButton && (
                <button
                    onClick={scrollToBottom}
                    className="absolute bottom-20 right-6 p-2 bg-white text-violet-600 rounded-full shadow-lg border border-slate-200 hover:bg-slate-50 transition-all z-10 animate-in fade-in zoom-in duration-200"
                    aria-label="Cuộn xuống dưới"
                >
                    <ArrowDown size={20} />
                </button>
            )}

                    {/* Limit exceeded banner */}
            {isLimitExceeded && (
                <div className="mx-4 mb-2 bg-red-50 border border-red-200 rounded-xl p-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-red-700 text-sm">
                        <Lock size={16} className="shrink-0" />
                        <span>Bạn đã hết lượt hỏi AI miễn phí. Vui lòng liên hệ Admin để tiếp tục.</span>
                    </div>
                    <a
                        href="/admin/settings?tab=custom"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white text-xs rounded-lg hover:bg-red-700 transition-colors shrink-0 no-underline"
                    >
                        <MessageCircle size={14} />
                        Liên hệ Admin
                    </a>
                </div>
            )}

            {/* Input Area */}
            <div style={{ flexShrink: 0 }} className="p-3 bg-white border-t">
                <form onSubmit={handleSendMessage} className="flex items-end gap-2 bg-slate-100 border border-slate-200 rounded-2xl p-2 focus-within:ring-2 focus-within:ring-violet-500/50">
                    <textarea
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSendMessage();
                            }
                        }}
                        placeholder={
                            notAuthenticated
                                ? "Vui lòng đăng nhập để sử dụng AI..."
                                : isLimitExceeded
                                    ? "Bạn đã hết lượt..."
                                    : !isAiReady
                                        ? "AI đang đọc tài liệu..."
                                        : "Hỏi gì đó về tài liệu này..."
                        }
                        className="flex-1 bg-transparent border-0 focus:ring-0 p-2 text-sm text-slate-700 resize-none max-h-24 min-h-[40px] outline-none disabled:cursor-not-allowed"
                        rows={1}
                        disabled={isDisabled}
                    />
                    <button
                        type="submit"
                        disabled={!inputValue.trim() || isTyping || isDisabled}
                        className="p-2.5 bg-violet-600 text-white rounded-xl hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        <Send size={18} />
                    </button>
                </form>
            </div>
        </div>
    );
};

export default AIChatPanel;
