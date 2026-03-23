import React, { useState } from 'react';
import { X, Search, UserPlus } from 'lucide-react';
import api from '../../services/api';

interface NewChatModalProps {
  onClose: () => void;
  onSelect: (userId: string) => void;
}

interface UserSearchResult {
  id: string;
  fullName: string | null;
  avatarUrl: string | null;
  email: string | null;
}

const NewChatModal: React.FC<NewChatModalProps> = ({ onClose, onSelect }) => {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = async () => {
    if (!search.trim()) return;
    
    setLoading(true);
    setSearched(true);
    
    try {
      // Search users by name or email
      const { data } = await api.get<UserSearchResult[]>('/Chat/users/search', {
        params: { search: search.trim() },
      });
      setResults(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Search failed:', error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (user: UserSearchResult) => {
    onSelect(user.id);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <UserPlus size={24} className="text-teal-600" />
            <div>
              <h2 className="text-lg font-black text-slate-800">Tin nhắn mới</h2>
              <p className="text-xs text-slate-500">Tìm người để bắt đầu trò chuyện</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X size={20} className="text-slate-400" />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-slate-100">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Tìm theo tên hoặc email..."
                className="w-full pl-10 pr-4 py-2.5 bg-slate-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <button
              onClick={handleSearch}
              disabled={loading}
              className="px-4 py-2.5 bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 text-white font-bold rounded-xl transition-colors"
            >
              {loading ? '...' : 'Tìm'}
            </button>
          </div>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto">
          {!searched ? (
            <div className="p-8 text-center">
              <Search size={40} className="mx-auto text-slate-300 mb-3" />
              <p className="text-slate-500">Nhập tên hoặc email để tìm người</p>
            </div>
          ) : results.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-slate-500">Không tìm thấy người dùng nào</p>
            </div>
          ) : (
            <div className="p-2">
              {results.map((user) => (
                <button
                  key={user.id}
                  onClick={() => handleSelect(user)}
                  className="w-full flex items-center gap-3 p-3 hover:bg-slate-50 rounded-xl transition-colors"
                >
                  <img
                    src={user.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.fullName || 'U')}&background=0d9488&color=fff&size=100`}
                    alt={user.fullName || ''}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                  <div className="flex-1 min-w-0 text-left">
                    <p className="font-bold text-slate-800 truncate">{user.fullName || 'Người dùng'}</p>
                    <p className="text-sm text-slate-500 truncate">{user.email ?? ''}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default NewChatModal;
