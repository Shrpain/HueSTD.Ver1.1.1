import React from 'react';
import { Search, Plus, Users } from 'lucide-react';
import { ConversationListItem } from '../../types/chat';

interface ChatListProps {
  conversations: ConversationListItem[];
  selectedId?: string;
  onSelect: (conv: ConversationListItem) => void;
  onNewChat: () => void;
  loading: boolean;
}

const ChatList: React.FC<ChatListProps> = ({
  conversations,
  selectedId,
  onSelect,
  onNewChat,
  loading,
}) => {
  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) {
      return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    } else if (days === 1) {
      return 'Hôm qua';
    } else if (days < 7) {
      return date.toLocaleDateString('vi-VN', { weekday: 'short' });
    } else {
      return date.toLocaleDateString('vi-VN', { day: 'numeric', month: 'short' });
    }
  };

  return (
    <div className="w-80 h-full min-h-0 border-r border-slate-100 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-slate-100">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-black text-slate-800">Tin nhắn</h2>
          <button
            onClick={onNewChat}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <Plus size={20} className="text-slate-600" />
          </button>
        </div>
      </div>

      {/* Conversation Items */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {loading ? (
          <div className="p-4 space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex items-center gap-3 animate-pulse">
                <div className="w-12 h-12 bg-slate-200 rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-slate-200 rounded w-3/4" />
                  <div className="h-3 bg-slate-200 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : conversations.length === 0 ? (
          <div className="p-8 text-center">
            <MessageCircle size={48} className="mx-auto text-slate-300 mb-3" />
            <p className="text-slate-500 font-medium">Chưa có cuộc trò chuyện nào</p>
            <button
              onClick={onNewChat}
              className="mt-4 text-teal-600 font-bold hover:underline"
            >
              Bắt đầu trò chuyện
            </button>
          </div>
        ) : (
          conversations.map((conv) => (
            <div
              key={conv.id}
              onClick={() => onSelect(conv)}
              className={`p-4 cursor-pointer hover:bg-slate-50 transition-colors ${
                selectedId === conv.id ? 'bg-teal-50' : ''
              } ${conv.unreadCount > 0 ? 'bg-blue-50/50' : ''}`}
            >
              <div className="flex items-center gap-3">
                {/* Avatar */}
                <div className="relative shrink-0">
                  {conv.type === 'direct' ? (
                    <img
                      src={conv.otherUserAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(conv.otherUserName || 'U')}&background=0d9488&color=fff&size=100`}
                      alt={conv.otherUserName}
                      className="w-12 h-12 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-teal-100 flex items-center justify-center">
                      <Users size={20} className="text-teal-600" />
                    </div>
                  )}
                  {conv.type === 'direct' && (
                    <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center">
                    <h3 className="font-bold text-slate-800 truncate">
                      {conv.type === 'direct' ? conv.otherUserName : conv.name}
                    </h3>
                    <span className="text-[11px] text-slate-400 shrink-0 ml-2">
                      {formatTime(conv.lastMessageAt)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center mt-0.5">
                    <p className="text-sm text-slate-500 truncate flex-1">
                      {conv.lastMessageContent || 'Bắt đầu cuộc trò chuyện'}
                    </p>
                    {conv.unreadCount > 0 && (
                      <div className="ml-2 w-5 h-5 bg-teal-600 rounded-full flex items-center justify-center shrink-0">
                        <span className="text-[10px] text-white font-bold">
                          {conv.unreadCount > 9 ? '9+' : conv.unreadCount}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

const MessageCircle = ({ size, className }: { size: number; className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
  </svg>
);

export default ChatList;
