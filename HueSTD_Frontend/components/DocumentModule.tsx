import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Upload } from 'lucide-react';
import { Document, DocumentApiResponse, normalizeDocument } from '../types';
import { DocumentList, DocumentUpload, DocumentDetail } from './document';
import Skeleton, { SkeletonTable } from './Skeleton';
import { useToast } from './Toast';
import api from '../services/api';
import { supabase } from '../services/supabase';

interface DocumentModuleProps {
  onRequireLogin?: () => void;
}

const DocumentModule: React.FC<DocumentModuleProps> = ({ onRequireLogin }) => {
  const { showToast } = useToast();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [activeType, setActiveType] = useState<string>('Tất cả');
  const [showUpload, setShowUpload] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [schoolFilter, setSchoolFilter] = useState('Tất cả');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [currentPage, setCurrentPage] = useState(1);

  const fetchDocuments = useCallback(async (showLoadingState = true) => {
    if (showLoadingState) {
      setLoading(true);
      setError(null);
    }

    try {
      const response = await api.get<DocumentApiResponse[]>('/documents');
      const mapped = response.data.map(normalizeDocument);
      setDocuments(mapped);
      setError(null);
    } catch (err: any) {
      console.error('Failed to fetch documents:', err);
      const errorMsg = err.response?.data?.message || 'Không thể tải danh sách tài liệu. Vui lòng thử lại.';
      setError(errorMsg);
      showToast({
        type: 'error',
        title: 'Lỗi tải dữ liệu',
        message: errorMsg,
        duration: 5000
      });
    } finally {
      if (showLoadingState) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  useEffect(() => {
    const handleRefresh = () => {
      console.log('[DocumentModule] Received refresh event, fetching documents...');
      fetchDocuments(false);
    };
    window.addEventListener('REFRESH_DOCUMENTS', handleRefresh);

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const debouncedFetch = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        fetchDocuments(false);
      }, 500);
    };

    let pollingInterval: NodeJS.Timeout | null = null;
    const startPolling = () => {
      if (!pollingInterval) {
        console.log('[DocumentModule] Starting polling fallback...');
        pollingInterval = setInterval(() => {
          console.log('[DocumentModule] Polling for updates...');
          fetchDocuments(false);
        }, 30000);
      }
    };

    const channel = supabase
      .channel('public_documents_changes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'documents' },
        () => {
          debouncedFetch();
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'documents' },
        () => {
          debouncedFetch();
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'documents' },
        () => {
          debouncedFetch();
        }
      )
      .subscribe((status) => {
        console.log('[DocumentModule] Realtime Status:', status);
        if (status === 'SUBSCRIBED') {
          console.log('✅ DocumentModule Realtime Connected');
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn('⚠️ DocumentModule Realtime Error. Starting polling fallback...');
          startPolling();
        }
      });

    return () => {
      window.removeEventListener('REFRESH_DOCUMENTS', handleRefresh);
      if (debounceTimer) clearTimeout(debounceTimer);
      if (pollingInterval) clearInterval(pollingInterval);
      supabase.removeChannel(channel);
    };
  }, [fetchDocuments]);

  const viewedDocsRef = useRef<Set<string>>(new Set());

  const handleViewIncrement = (docId: string) => {
    if (!viewedDocsRef.current.has(docId)) {
      viewedDocsRef.current.add(docId);
      api.post(`/documents/${docId}/view`).catch((err) => {
        console.error('View increment error:', err);
      });
      setDocuments(prev => prev.map(d =>
        d.id === docId ? { ...d, views: (d.views || 0) + 1 } : d
      ));
    }
  };

  const handleDocumentSelect = (doc: Document) => {
    setSelectedDoc(doc);
  };

  const totalPages = Math.ceil(documents.length / 10);

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Tài liệu & Đề thi</h1>
          <p className="text-slate-500 text-sm">Tìm kiếm hàng nghìn tài liệu học tập chất lượng tại Huế</p>
        </div>
        <button
          onClick={() => setShowUpload(true)}
          className="bg-teal-600 text-white px-5 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-teal-700 transition-all shadow-lg shadow-teal-100"
        >
          <Upload size={18} />
          Đóng góp tài liệu
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center text-red-600">
              <span className="text-lg">!</span>
            </div>
            <div>
              <p className="font-bold text-red-800">Đã xảy ra lỗi</p>
              <p className="text-sm text-red-600">{error}</p>
            </div>
          </div>
          <button
            onClick={() => fetchDocuments()}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-bold"
          >
            Thử lại
          </button>
        </div>
      )}

      {loading ? (
        <div className="space-y-6">
          <div className="bg-white p-4 rounded-2xl border shadow-sm">
            <div className="flex justify-between items-center">
              <div className="space-y-2">
                <Skeleton width={200} height={24} />
                <Skeleton width={300} height={16} />
              </div>
              <Skeleton width={150} height={40} variant="rectangular" />
            </div>
          </div>
          <div className="bg-white p-4 rounded-2xl border shadow-sm space-y-4">
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Skeleton key={i} width={80} height={32} variant="rectangular" />
              ))}
            </div>
            <div className="flex gap-4">
              <Skeleton className="flex-1" height={40} variant="rectangular" />
              <Skeleton width={200} height={40} variant="rectangular" />
            </div>
          </div>
          <SkeletonTable rows={8} columns={5} />
        </div>
      ) : (
        <DocumentList
          documents={documents}
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          activeType={activeType}
          setActiveType={setActiveType}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          schoolFilter={schoolFilter}
          setSchoolFilter={setSchoolFilter}
          onDocumentSelect={handleDocumentSelect}
          onRefresh={() => fetchDocuments()}
        />
      )}

      {selectedDoc && (
        <DocumentDetail
          document={selectedDoc}
          allDocuments={documents}
          onClose={() => setSelectedDoc(null)}
          onViewIncrement={handleViewIncrement}
        />
      )}

      <DocumentUpload
        isOpen={showUpload}
        onClose={() => setShowUpload(false)}
        onSuccess={() => fetchDocuments()}
      />
    </div>
  );
};

export default DocumentModule;
