import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    FileText, Check, X, Search, Loader2,
    RefreshCw, ChevronLeft, ChevronRight, MessageSquare, Save,
    Eye, Download, Calendar, User, BookOpen, Tag, Building,
    Send, Pencil, Trash, Clock, AlertCircle, XCircle, CheckCircle2, PanelRightClose
} from 'lucide-react';
import api from '../../services/api';
import { supabase } from '../../services/supabase';
import { DocumentType } from '../../types';

interface Document {
    id: string;
    title: string;
    description?: string;
    uploaderName?: string;
    school?: string;
    subject?: string;
    type?: string;
    isApproved: boolean;
    views: number;
    downloads: number;
    createdAt: string;
}

interface DocumentDetail extends Document {
    fileUrl?: string;
    uploaderId: string;
    year?: string;
}

interface Comment {
    id: string;
    documentId: string;
    userId: string;
    authorName: string;
    authorAvatar?: string | null;
    content: string;
    createdAt: string;
    updatedAt?: string;
}

const PAGE_SIZE = 10;

function parseDocumentsPayload(data: unknown): {
    items: Document[];
    totalCount: number;
    page: number;
    pageSize: number;
    totalPages: number;
} {
    if (Array.isArray(data)) {
        return { items: data, totalCount: data.length, page: 1, pageSize: data.length, totalPages: 1 };
    }
    if (data && typeof data === 'object') {
        const o = data as Record<string, unknown>;
        const raw = o.documents ?? o.Documents;
        const items = Array.isArray(raw) ? (raw as Document[]) : [];
        const totalCount = typeof o.totalCount === 'number'
            ? o.totalCount : typeof o.TotalCount === 'number' ? (o.TotalCount as number) : items.length;
        const page = typeof o.page === 'number'
            ? o.page : typeof o.Page === 'number' ? (o.Page as number) : 1;
        const pageSize = typeof o.pageSize === 'number'
            ? o.pageSize : typeof o.PageSize === 'number' ? (o.PageSize as number) : PAGE_SIZE;
        let totalPages = typeof o.totalPages === 'number'
            ? o.totalPages : typeof o.TotalPages === 'number' ? (o.TotalPages as number) : 0;
        if (!totalPages && pageSize > 0) totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
        if (!totalPages) totalPages = 1;
        return { items, totalCount, page, pageSize, totalPages };
    }
    return { items: [], totalCount: 0, page: 1, pageSize: PAGE_SIZE, totalPages: 1 };
}

const AdminDocumentsManagement: React.FC = () => {
    // ── Core data state ──────────────────────────────────────────────────────
    const [documents, setDocuments] = useState<Document[]>([]);
    const [totalCount, setTotalCount] = useState(0);
    const [totalPages, setTotalPages] = useState(1);
    const [docStats, setDocStats] = useState({ total: 0, approved: 0, pending: 0 });

    // ── Filter / search state ────────────────────────────────────────────────
    const [filterStatus, setFilterStatus] = useState<'all' | 'approved' | 'pending'>('all');
    const [activeType, setActiveType] = useState<string>('Tất cả');
    const [schoolFilter, setSchoolFilter] = useState<string>('Tất cả');
    const [searchInput, setSearchInput] = useState(''); // raw input
    const [searchQuery, setSearchQuery] = useState(''); // debounced
    const [page, setPage] = useState(1);

    // ── Loading / processing ────────────────────────────────────────────────
    const [tableLoading, setTableLoading] = useState(false);   // inline table spinner
    const [refreshing, setRefreshing] = useState(false);
    const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());

    // ── Detail modal ──────────────────────────────────────────────────────
    const [selectedDocument, setSelectedDocument] = useState<DocumentDetail | null>(null);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [documentToDelete, setDocumentToDelete] = useState<string | null>(null);
    const [editMode, setEditMode] = useState(false);
    const [editForm, setEditForm] = useState<Partial<DocumentDetail>>({});
    const [saving, setSaving] = useState(false);

    // ── Comments ───────────────────────────────────────────────────────────
    const [comments, setComments] = useState<Comment[]>([]);
    const [commentsLoading, setCommentsLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<'info' | 'comments'>('info');
    const [commentDraft, setCommentDraft] = useState('');
    const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
    const [editingCommentContent, setEditingCommentContent] = useState('');
    const [commentSubmitting, setCommentSubmitting] = useState(false);
    const [commentError, setCommentError] = useState<string | null>(null);
    const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null);

    // ── Refs ───────────────────────────────────────────────────────────────
    const isFetchingRef = useRef(false);
    const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const statsFetchedRef = useRef(false);

    const pendingCount = docStats.pending;

    // ── Fetch documents (with inline loading) ───────────────────────────────
    const fetchDocuments = useCallback(async (opts: { silent?: boolean } = {}) => {
        if (isFetchingRef.current) return;
        isFetchingRef.current = true;
        const { silent = false } = opts;

        if (!silent) setTableLoading(true);
        try {
            const isApprovedParam =
                filterStatus === 'approved' ? true
                : filterStatus === 'pending' ? false
                : undefined;

            const response = await api.get('/Admin/documents', {
                params: {
                    page,
                    pageSize: PAGE_SIZE,
                    ...(isApprovedParam !== undefined ? { isApproved: isApprovedParam } : {}),
                    ...(searchQuery.trim() ? { search: searchQuery.trim() } : {}),
                    ...(activeType !== 'Tất cả' ? { documentType: activeType } : {}),
                    ...(schoolFilter !== 'Tất cả' ? { school: schoolFilter } : {})
                }
            });

            const parsed = parseDocumentsPayload(response.data);
            setDocuments(parsed.items);
            setTotalCount(parsed.totalCount);
            setTotalPages(parsed.totalPages);
        } catch (error) {
            console.error('Failed to fetch documents:', error);
        } finally {
            isFetchingRef.current = false;
            if (!silent) setTableLoading(false);
        }
    }, [page, filterStatus, searchQuery, activeType, schoolFilter]);

    // ── Fetch stats ──────────────────────────────────────────────────────────
    const fetchStats = useCallback(async () => {
        try {
            const [allRes, appRes, penRes] = await Promise.all([
                api.get('/Admin/documents', { params: { page: 1, pageSize: 1 } }),
                api.get('/Admin/documents', { params: { page: 1, pageSize: 1, isApproved: true } }),
                api.get('/Admin/documents', { params: { page: 1, pageSize: 1, isApproved: false } })
            ]);
            setDocStats({
                total: parseDocumentsPayload(allRes.data).totalCount,
                approved: parseDocumentsPayload(appRes.data).totalCount,
                pending: parseDocumentsPayload(penRes.data).totalCount
            });
        } catch (e) { console.error('Failed to fetch stats:', e); }
    }, []);

    // ── Initial load ───────────────────────────────────────────────────────
    useEffect(() => {
        fetchDocuments({ silent: false });
        fetchStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── Search debounce ────────────────────────────────────────────────────
    useEffect(() => {
        if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
        searchDebounceRef.current = setTimeout(() => {
            setSearchQuery(searchInput.trim());
            setPage(1);
        }, 400);
        return () => { if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current); };
    }, [searchInput]);

    // ── Filter / search / page → fetch ─────────────────────────────────────
    useEffect(() => {
        fetchDocuments({ silent: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page, filterStatus, searchQuery, activeType, schoolFilter]);

    // ── Stats fetch every 30s + on visibility change ───────────────────────
    useEffect(() => {
        const interval = setInterval(fetchStats, 30000);
        const onVisible = () => { if (document.visibilityState === 'visible') fetchStats(); };
        document.addEventListener('visibilitychange', onVisible);
        return () => { clearInterval(interval); document.removeEventListener('visibilitychange', onVisible); };
    }, [fetchStats]);

    // ── Realtime subscription ───────────────────────────────────────────────
    useEffect(() => {
        let debounceTimer: ReturnType<typeof setTimeout> | null = null;
        const debouncedRefresh = () => {
            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                fetchDocuments({ silent: true });
                fetchStats();
            }, 800);
        };

        const channel = supabase
            .channel('admin_documents_realtime')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'documents' }, () => { debouncedRefresh(); })
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'documents' }, () => { debouncedRefresh(); })
            .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'documents' }, () => { debouncedRefresh(); })
            .subscribe();
        return () => { if (debounceTimer) clearTimeout(debounceTimer); supabase.removeChannel(channel); };
    }, [fetchDocuments, fetchStats]);

    // ── Optimistic approve ────────────────────────────────────────────────────
    const handleApprove = async (id: string) => {
        setProcessingIds(prev => new Set(prev).add(id));
        setDocuments(prev => prev.map(d => d.id === id ? { ...d, isApproved: true } : d));
        try {
            await api.put(`/Admin/documents/${id}/approve`);
            fetchStats();
        } catch (e) {
            console.error('Failed to approve:', e);
            setDocuments(prev => prev.map(d => d.id === id ? { ...d, isApproved: false } : d));
            alert('Không thể duyệt tài liệu');
        } finally {
            setProcessingIds(prev => { const s = new Set(prev); s.delete(id); return s; });
        }
    };

    // ── Optimistic reject ───────────────────────────────────────────────────
    const handleReject = async (id: string) => {
        setProcessingIds(prev => new Set(prev).add(id));
        setDocuments(prev => prev.map(d => d.id === id ? { ...d, isApproved: false } : d));
        try {
            await api.put(`/Admin/documents/${id}/reject`);
            fetchStats();
        } catch (e) {
            console.error('Failed to reject:', e);
            setDocuments(prev => prev.map(d => d.id === id ? { ...d, isApproved: true } : d));
            alert('Không thể từ chối tài liệu');
        } finally {
            setProcessingIds(prev => { const s = new Set(prev); s.delete(id); return s; });
        }
    };

    // ── Optimistic delete ────────────────────────────────────────────────────
    const handleDelete = async () => {
        if (!documentToDelete) return;
        const deletedId = documentToDelete;
        const prevDocs = [...documents];
        setDocuments(prev => prev.filter(d => d.id !== deletedId));
        setShowDeleteConfirm(false);
        setProcessingIds(prev => { const s = new Set(prev); s.delete(deletedId); return s; });
        setDocumentToDelete(null);
        try {
            await api.delete(`/Admin/documents/${deletedId}`);
            fetchStats();
        } catch (e) {
            console.error('Failed to delete:', e);
            setDocuments(prevDocs);
            alert('Không thể xóa tài liệu');
        }
    };

    const viewDocumentDetail = async (id: string) => {
        try {
            const response = await api.get(`/Admin/documents/${id}`);
            const doc = response.data as DocumentDetail;
            setSelectedDocument(doc);
            setEditForm({ ...doc });
            setEditMode(false);
            setActiveTab('info');
            setShowDetailModal(true);
            fetchComments(id);
        } catch (error) { console.error('Failed to fetch document detail:', error); }
    };

    // ── Document save ───────────────────────────────────────────────────────
    const handleSaveDocument = async () => {
        if (!selectedDocument) return;
        setSaving(true);
        try {
            const res = await api.put(`/Admin/documents/${selectedDocument.id}`, {
                title: editForm.title, description: editForm.description,
                school: editForm.school, subject: editForm.subject,
                type: editForm.type, year: editForm.year, isApproved: editForm.isApproved,
            });
            const updated = res.data as DocumentDetail;
            setSelectedDocument(updated);
            setDocuments(prev => prev.map(d => d.id === updated.id ? {
                ...d, title: updated.title, description: updated.description,
                subject: updated.subject, type: updated.type, isApproved: updated.isApproved
            } : d));
            setEditMode(false);
            fetchStats();
        } catch (e) { console.error('Failed to save document:', e); alert('Không thể lưu thay đổi'); }
        finally { setSaving(false); }
    };

    // ── Comments ────────────────────────────────────────────────────────────
    const fetchComments = useCallback(async (docId: string) => {
        setCommentsLoading(true);
        try {
            const res = await api.get(`/Documents/${docId}/comments`);
            setComments(Array.isArray(res.data) ? res.data : (res.data.comments ?? []));
        } catch (e) { console.error('Failed to fetch comments:', e); setComments([]); }
        finally { setCommentsLoading(false); }
    }, []);

    const handleSubmitComment = async () => {
        if (!selectedDocument || !commentDraft.trim()) return;
        setCommentSubmitting(true); setCommentError(null);
        try {
            const res = await api.post(`/Documents/${selectedDocument.id}/comments`, { content: commentDraft.trim() });
            setComments(prev => [res.data, ...prev]);
            setCommentDraft('');
        } catch (e: unknown) {
            const err = e as { response?: { data?: { message?: string } } };
            setCommentError(err?.response?.data?.message || 'Không thể gửi bình luận');
        } finally { setCommentSubmitting(false); }
    };

    const handleUpdateComment = async (commentId: string) => {
        if (!editingCommentContent.trim()) return;
        setCommentSubmitting(true); setCommentError(null);
        try {
            const res = await api.put(`/Documents/${selectedDocument!.id}/comments/${commentId}`, { content: editingCommentContent.trim() });
            setComments(prev => prev.map(c => c.id === commentId ? res.data : c));
            setEditingCommentId(null); setEditingCommentContent('');
        } catch (e: unknown) {
            const err = e as { response?: { data?: { message?: string } } };
            setCommentError(err?.response?.data?.message || 'Không thể cập nhật bình luận');
        } finally { setCommentSubmitting(false); }
    };

    const handleDeleteComment = async (commentId: string) => {
        setDeletingCommentId(commentId);
        try {
            await api.delete(`/Documents/${selectedDocument!.id}/comments/${commentId}`);
            setComments(prev => prev.filter(c => c.id !== commentId));
        } catch (e) { console.error('Failed to delete comment:', e); alert('Không thể xóa bình luận'); }
        finally { setDeletingCommentId(null); }
    };

    const startEditComment = (comment: Comment) => { setEditingCommentId(comment.id); setEditingCommentContent(comment.content); };
    const cancelEditComment = () => { setEditingCommentId(null); setEditingCommentContent(''); };

    const closeDetailModal = () => {
        setShowDetailModal(false); setSelectedDocument(null); setEditMode(false); setEditForm({});
        setComments([]); setCommentDraft(''); setEditingCommentId(null); setActiveTab('info');
    };

    const formatDate = (dateString: string) =>
        new Date(dateString).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

    const handleRefresh = () => {
        setRefreshing(true);
        fetchDocuments({ silent: false }).finally(() => setRefreshing(false));
        fetchStats();
    };

    return (
        <div className="space-y-6">

            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800">Quản lý Tài liệu</h2>
                    <p className="text-gray-600 mt-1">Duyệt và quản lý tài liệu trên hệ thống</p>
                </div>
                <button onClick={handleRefresh} disabled={refreshing}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-lg shadow-indigo-100">
                    <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
                    {refreshing ? 'Đang tải...' : 'Làm mới'}
                </button>
            </div>

            {/* Stats — nút lọc nhanh */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <button type="button" onClick={() => { setFilterStatus('all'); setPage(1); }}
                    className={`w-full text-left bg-blue-50 p-5 rounded-2xl border transition-all hover:scale-[1.02] hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${
                        filterStatus === 'all' ? 'border-blue-400 ring-2 ring-blue-400 ring-offset-2 shadow-sm' : 'border-blue-100'
                    }`}>
                    <div className="flex items-center justify-between pointer-events-none">
                        <div>
                            <p className="text-sm font-semibold text-blue-600">Tổng tài liệu</p>
                            <p className="text-2xl font-black text-blue-700 mt-1">{docStats.total}</p>
                            <p className="text-[11px] text-blue-500/80 mt-1">Xem tất cả · {PAGE_SIZE} / trang</p>
                        </div>
                        <FileText className="text-blue-400 shrink-0" size={36} />
                    </div>
                </button>
                <button type="button" onClick={() => { setFilterStatus('approved'); setPage(1); }}
                    className={`w-full text-left bg-green-50 p-5 rounded-2xl border transition-all hover:scale-[1.02] hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 ${
                        filterStatus === 'approved' ? 'border-emerald-400 ring-2 ring-emerald-400 ring-offset-2 shadow-sm' : 'border-green-100'
                    }`}>
                    <div className="flex items-center justify-between pointer-events-none">
                        <div>
                            <p className="text-sm font-semibold text-green-600">Đã duyệt</p>
                            <p className="text-2xl font-black text-green-700 mt-1">{docStats.approved}</p>
                            <p className="text-[11px] text-green-600/80 mt-1">Chỉ tài liệu đã duyệt</p>
                        </div>
                        <CheckCircle2 className="text-green-400 shrink-0" size={36} />
                    </div>
                </button>
                <button type="button" onClick={() => { setFilterStatus('pending'); setPage(1); }}
                    className={`w-full text-left bg-yellow-50 p-5 rounded-2xl border transition-all hover:scale-[1.02] hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 ${
                        filterStatus === 'pending' ? 'border-amber-400 ring-2 ring-amber-400 ring-offset-2 shadow-sm' : 'border-yellow-100'
                    } ${pendingCount > 0 ? 'animate-pulse' : ''}`}>
                    <div className="flex items-center justify-between pointer-events-none">
                        <div>
                            <p className="text-sm font-semibold text-yellow-600">Chờ duyệt</p>
                            <p className="text-2xl font-black text-yellow-700 mt-1 flex items-center gap-2 flex-wrap">
                                {pendingCount}
                                {pendingCount > 0 && <span className="text-xs bg-red-500 text-white px-2 py-0.5 rounded-full animate-pulse">MỚI</span>}
                            </p>
                            <p className="text-[11px] text-amber-700/80 mt-1">Chỉ tài liệu chờ duyệt</p>
                        </div>
                        <Clock className="text-yellow-400 shrink-0" size={36} />
                    </div>
                </button>
            </div>

            {/* Filters */}
            <div className="bg-white p-4 rounded-2xl border shadow-sm space-y-4">
                {/* Type filter pills */}
                <div className="flex flex-wrap gap-2">
                    {['Tất cả', ...Object.values(DocumentType)].map(type => (
                        <button key={type} onClick={() => { setActiveType(type); setPage(1); }}
                            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                                activeType === type
                                    ? 'bg-indigo-600 text-white shadow-md'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}>
                            {type}
                        </button>
                    ))}
                </div>
                {/* Search + School filter */}
                <div className="flex flex-col md:flex-row gap-4">
                    <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        {tableLoading && !documents.length ? (
                            <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                <Loader2 size={16} className="animate-spin text-gray-400" />
                            </div>
                        ) : null}
                        <input
                            type="text"
                            placeholder="Tìm kiếm tài liệu, môn học..."
                            value={searchInput}
                            onChange={e => setSearchInput(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-gray-50 text-sm"
                        />
                    </div>
                    <select value={schoolFilter} onChange={e => { setSchoolFilter(e.target.value); setPage(1); }}
                        className="bg-gray-50 border border-gray-200 rounded-xl py-2.5 px-4 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 cursor-pointer min-w-[180px]">
                        <option value="Tất cả">Tất cả trường</option>
                        {documents.filter(d => d.school).map(d => d.school!).filter((s, i, arr) => arr.indexOf(s) === i).sort().map(school => (
                            <option key={school} value={school}>{school}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full">
                        <thead className="bg-gray-50 border-b border-gray-100">
                            <tr>
                                <th className="px-6 py-3.5 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Tài liệu</th>
                                <th className="px-6 py-3.5 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Người đăng</th>
                                <th className="px-6 py-3.5 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Trạng thái</th>
                                <th className="px-6 py-3.5 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Thống kê</th>
                                <th className="px-6 py-3.5 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Ngày tạo</th>
                                <th className="px-6 py-3.5 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {tableLoading && !documents.length ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-20 text-center">
                                        <div className="flex flex-col items-center gap-3 text-gray-400">
                                            <Loader2 size={32} className="animate-spin" />
                                            <span className="text-sm">Đang tải dữ liệu...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : documents.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-16 text-center text-gray-400 text-sm">
                                        {searchQuery
                                            ? `Không có tài liệu nào khớp "${searchQuery}"`
                                            : activeType !== 'Tất cả' || schoolFilter !== 'Tất cả'
                                                ? 'Không có tài liệu nào phù hợp bộ lọc.'
                                                : 'Không có tài liệu nào trong danh sách.'}
                                    </td>
                                </tr>
                            ) : documents.map(doc => (
                                <tr key={doc.id} className="hover:bg-indigo-50/30 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="text-sm font-semibold text-gray-900">{doc.title}</div>
                                        <div className="flex flex-wrap items-center gap-1 mt-1">
                                            {doc.subject && (
                                                <span className="inline-block px-2 py-0.5 text-xs bg-indigo-50 text-indigo-600 rounded-full font-medium">{doc.subject}</span>
                                            )}
                                            {doc.type && (
                                                <span className="inline-block px-2 py-0.5 text-xs bg-teal-50 text-teal-600 rounded-full font-medium">{doc.type}</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm font-medium text-gray-800">{doc.uploaderName || 'N/A'}</div>
                                        {doc.school && <div className="text-xs text-gray-400">{doc.school}</div>}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        {doc.isApproved
                                            ? <span className="inline-flex items-center gap-1 px-3 py-1 text-xs font-bold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                                                <CheckCircle2 size={12} /> Đã duyệt
                                            </span>
                                            : <span className="inline-flex items-center gap-1 px-3 py-1 text-xs font-bold rounded-full bg-amber-50 text-amber-700 border border-amber-100">
                                                <Clock size={12} /> Chờ duyệt
                                            </span>
                                        }
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500">
                                        <div className="flex items-center gap-1"><Eye size={12} className="text-gray-300" /> {doc.views.toLocaleString()} lượt xem</div>
                                        <div className="flex items-center gap-1 mt-0.5"><Download size={12} className="text-gray-300" /> {doc.downloads.toLocaleString()} lượt tải</div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-400">{formatDate(doc.createdAt)}</td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center gap-1.5">
                                            <button onClick={() => viewDocumentDetail(doc.id)}
                                                className="p-2 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100 transition-all shadow-sm" title="Chi tiết">
                                                <PanelRightClose size={16} />
                                            </button>
                                            {!doc.isApproved ? (
                                                <button onClick={() => void handleApprove(doc.id)}
                                                    disabled={processingIds.has(doc.id)}
                                                    className="p-2 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-100 disabled:opacity-40 transition-all shadow-sm" title="Duyệt">
                                                    {processingIds.has(doc.id) ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                                                </button>
                                            ) : (
                                                <button onClick={() => void handleReject(doc.id)}
                                                    disabled={processingIds.has(doc.id)}
                                                    className="p-2 bg-amber-50 text-amber-600 rounded-xl hover:bg-amber-100 disabled:opacity-40 transition-all shadow-sm" title="Bỏ duyệt">
                                                    {processingIds.has(doc.id) ? <Loader2 size={16} className="animate-spin" /> : <XCircle size={16} />}
                                                </button>
                                            )}
                                            <button onClick={() => { setDocumentToDelete(doc.id); setShowDeleteConfirm(true); }}
                                                disabled={processingIds.has(doc.id)}
                                                className="p-2 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 disabled:opacity-40 transition-all shadow-sm" title="Xóa">
                                                {processingIds.has(doc.id) ? <Loader2 size={16} className="animate-spin" /> : <Trash size={16} />}
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {totalCount > 0 && (
                    <div className="px-6 py-3.5 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3">
                        <p className="text-sm text-gray-500">
                            Hiển thị {Math.min((page - 1) * PAGE_SIZE + 1, totalCount)}–{Math.min(page * PAGE_SIZE, totalCount)} của <strong>{totalCount}</strong> tài liệu
                            {searchQuery && <span className="text-gray-400"> · tìm: "{searchQuery}"</span>}
                        </p>
                        <div className="flex items-center gap-1.5">
                            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
                                className="px-3 py-1.5 text-sm rounded-lg border hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1">
                                <ChevronLeft size={16} /> Trước
                            </button>
                            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map(p => (
                                <button key={p} onClick={() => setPage(p)}
                                    className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                                        page === p ? 'bg-indigo-600 text-white shadow-md' : 'border hover:bg-gray-50'
                                    }`}>
                                    {p}
                                </button>
                            ))}
                            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                                className="px-3 py-1.5 text-sm rounded-lg border hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1">
                                Sau <ChevronRight size={16} />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* ── Document Detail Modal ── */}
            {showDetailModal && selectedDocument && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4"
                    onClick={e => { if (e.target === e.currentTarget) closeDetailModal(); }}>
                    <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl border border-gray-100">

                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0 bg-gradient-to-r from-indigo-50 to-white">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-indigo-100 rounded-xl">
                                    <FileText className="text-indigo-600" size={22} />
                                </div>
                                <div>
                                    <h3 className="text-lg font-black text-gray-900">Chi tiết tài liệu</h3>
                                    <p className="text-[10px] text-gray-400 font-mono">ID: {selectedDocument.id.slice(0, 8)}...</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {editMode ? (
                                    <>
                                        <button onClick={() => void handleSaveDocument()} disabled={saving}
                                            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 disabled:opacity-50 transition-all shadow-lg shadow-emerald-100">
                                            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Lưu
                                        </button>
                                        <button onClick={() => { setEditMode(false); setEditForm({ ...selectedDocument }); }}
                                            className="flex items-center gap-1.5 px-4 py-2 bg-gray-100 text-gray-600 rounded-xl text-sm font-semibold hover:bg-gray-200 transition-all">
                                            <X size={14} /> Hủy
                                        </button>
                                    </>
                                ) : (
                                    <button onClick={() => setEditMode(true)}
                                        className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100">
                                        <Pencil size={14} /> Chỉnh sửa
                                    </button>
                                )}
                                <button onClick={closeDetailModal}
                                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all">
                                    <X size={20} />
                                </button>
                            </div>
                        </div>

                        {/* Tabs */}
                        <div className="flex border-b border-gray-100 px-6 shrink-0 bg-white">
                            <button onClick={() => setActiveTab('info')}
                                className={`flex items-center gap-2 px-1 py-3 mr-6 text-sm font-bold border-b-2 transition-all ${activeTab === 'info' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
                                <FileText size={16} /> Thông tin
                            </button>
                            <button onClick={() => setActiveTab('comments')}
                                className={`flex items-center gap-2 px-1 py-3 text-sm font-bold border-b-2 transition-all ${activeTab === 'comments' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
                                <MessageSquare size={16} /> Bình luận
                                <span className="px-1.5 py-0.5 text-xs bg-gray-100 text-gray-600 rounded-full">{comments.length}</span>
                            </button>
                        </div>

                        {/* Body */}
                        <div className="flex-1 overflow-y-auto px-6 py-5">

                            {/* ── INFO TAB ── */}
                            {activeTab === 'info' && (
                                <div className="space-y-5">
                                    <div className={`flex items-center justify-between px-4 py-3 rounded-2xl ${selectedDocument.isApproved ? 'bg-emerald-50 border border-emerald-100' : 'bg-amber-50 border border-amber-100'}`}>
                                        <div className="flex items-center gap-2">
                                            {selectedDocument.isApproved
                                                ? <><CheckCircle2 size={18} className="text-emerald-600" /><span className="text-sm font-bold text-emerald-700">Đã duyệt</span></>
                                                : <><Clock size={18} className="text-amber-600" /><span className="text-sm font-bold text-amber-700">Chờ duyệt</span></>
                                            }
                                        </div>
                                        <div className="flex items-center gap-4 text-xs text-gray-500">
                                            <span className="flex items-center gap-1"><Eye size={12} /> {selectedDocument.views.toLocaleString()} lượt xem</span>
                                            <span className="flex items-center gap-1"><Download size={12} /> {selectedDocument.downloads.toLocaleString()} lượt tải</span>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="flex items-center gap-1.5 text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                                            <FileText size={13} className="text-indigo-400" /> Tiêu đề
                                        </label>
                                        {editMode ? (
                                            <input value={editForm.title ?? ''} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
                                                className="w-full px-4 py-2.5 border border-indigo-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm font-medium" />
                                        ) : (
                                            <p className="text-gray-900 font-bold text-base">{selectedDocument.title}</p>
                                        )}
                                    </div>

                                    <div>
                                        <label className="flex items-center gap-1.5 text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                                            <BookOpen size={13} className="text-indigo-400" /> Mô tả
                                        </label>
                                        {editMode ? (
                                            <textarea value={editForm.description ?? ''} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} rows={3}
                                                className="w-full px-4 py-2.5 border border-indigo-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm resize-none" />
                                        ) : (
                                            <p className="text-gray-700 text-sm leading-relaxed">{selectedDocument.description || <span className="text-gray-300 italic">Chưa có mô tả</span>}</p>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                        {[
                                            { icon: Building, label: 'Trường / Trung tâm', field: 'school' },
                                            { icon: BookOpen, label: 'Môn học', field: 'subject' },
                                            { icon: Tag, label: 'Loại tài liệu', field: 'type' },
                                            { icon: Calendar, label: 'Năm học', field: 'year' },
                                        ].map(({ icon: Icon, label, field }) => (
                                            <div key={field}>
                                                <label className="flex items-center gap-1.5 text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                                                    <Icon size={13} className="text-indigo-400" /> {label}
                                                </label>
                                                {editMode ? (
                                                    <input value={String((editForm as unknown as Record<string, string | undefined>)[field] ?? '')}
                                                        onChange={e => setEditForm(f => ({ ...f, [field]: e.target.value }))}
                                                        className="w-full px-4 py-2.5 border border-indigo-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm" />
                                                ) : (
                                                    <p className="text-sm text-gray-700 font-medium">{String((selectedDocument as unknown as Record<string, unknown>)[field] ?? '—')}</p>
                                                )}
                                            </div>
                                        ))}
                                        <div>
                                            <label className="flex items-center gap-1.5 text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                                                <User size={13} className="text-indigo-400" /> Người đăng
                                            </label>
                                            <p className="text-sm text-gray-700 font-medium">{selectedDocument.uploaderName || 'N/A'}</p>
                                        </div>
                                        <div>
                                            <label className="flex items-center gap-1.5 text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                                                <Calendar size={13} className="text-indigo-400" /> Ngày tạo
                                            </label>
                                            <p className="text-sm text-gray-700 font-medium">{formatDate(selectedDocument.createdAt)}</p>
                                        </div>
                                    </div>

                                    {editMode && (
                                        <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-2xl border border-gray-200">
                                            <span className="text-sm font-bold text-gray-700 shrink-0">Trạng thái duyệt:</span>
                                            <button onClick={() => setEditForm(f => ({ ...f, isApproved: !f.isApproved }))}
                                                className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${editForm.isApproved ? 'bg-emerald-500' : 'bg-gray-300'}`}>
                                                <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${editForm.isApproved ? 'translate-x-6' : 'translate-x-1'}`} />
                                            </button>
                                            <span className={`text-sm font-bold ${editForm.isApproved ? 'text-emerald-600' : 'text-gray-500'}`}>
                                                {editForm.isApproved ? 'Đã duyệt' : 'Chờ duyệt'}
                                            </span>
                                        </div>
                                    )}

                                    {selectedDocument.fileUrl && (
                                        <div>
                                            <label className="flex items-center gap-1.5 text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                                                <FileText size={13} className="text-indigo-400" /> File đính kèm
                                            </label>
                                            <a href={selectedDocument.fileUrl} target="_blank" rel="noopener noreferrer"
                                                className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-50 text-indigo-700 rounded-xl text-sm font-bold hover:bg-indigo-100 transition-all">
                                                <FileText size={15} /> Xem / Tải file
                                            </a>
                                        </div>
                                    )}

                                    {!editMode && (
                                        <div className="flex flex-wrap gap-3 pt-2">
                                            {!selectedDocument.isApproved ? (
                                                <button onClick={() => { handleApprove(selectedDocument.id); closeDetailModal(); }}
                                                    className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100">
                                                    <CheckCircle2 size={16} /> Duyệt tài liệu
                                                </button>
                                            ) : (
                                                <button onClick={() => { handleReject(selectedDocument.id); closeDetailModal(); }}
                                                    className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 text-white rounded-xl text-sm font-bold hover:bg-amber-600 transition-all shadow-lg shadow-amber-100">
                                                    <XCircle size={16} /> Bỏ duyệt
                                                </button>
                                            )}
                                            <button onClick={() => { setDocumentToDelete(selectedDocument.id); setShowDeleteConfirm(true); }}
                                                className="flex items-center gap-2 px-5 py-2.5 bg-red-50 text-red-600 rounded-xl text-sm font-bold hover:bg-red-100 transition-all border border-red-200">
                                                <Trash size={16} /> Xóa tài liệu
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* ── COMMENTS TAB ── */}
                            {activeTab === 'comments' && (
                                <div className="space-y-4">
                                    {commentError && (
                                        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                                            <AlertCircle size={16} /> {commentError}
                                        </div>
                                    )}
                                    <div className="bg-gray-50 rounded-2xl p-4 border border-gray-200">
                                        <label className="flex items-center gap-1.5 text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                                            <MessageSquare size={13} className="text-indigo-400" /> Thêm bình luận mới
                                        </label>
                                        <div className="flex gap-2">
                                            <textarea value={commentDraft} onChange={e => setCommentDraft(e.target.value)} rows={2} maxLength={2000}
                                                placeholder="Viết bình luận..."
                                                className="flex-1 px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm resize-none bg-white" />
                                            <button onClick={() => void handleSubmitComment()} disabled={commentSubmitting || !commentDraft.trim()}
                                                className="self-end px-4 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-indigo-100">
                                                {commentSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                                            </button>
                                        </div>
                                    </div>

                                    {commentsLoading ? (
                                        <div className="flex items-center justify-center py-10 text-gray-400 gap-2">
                                            <Loader2 size={18} className="animate-spin" /> Đang tải bình luận...
                                        </div>
                                    ) : comments.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center py-12 text-gray-300 gap-2">
                                            <MessageSquare size={40} className="opacity-30" />
                                            <p className="text-sm italic">Chưa có bình luận nào.</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {comments.map(comment => (
                                                <div key={comment.id} className="bg-white rounded-2xl border border-gray-100 p-4 hover:border-indigo-200 transition-all shadow-sm">
                                                    <div className="flex items-center justify-between mb-3">
                                                        <div className="flex items-center gap-2.5">
                                                            <div className="w-8 h-8 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-full flex items-center justify-center text-white font-bold text-xs shrink-0">
                                                                {comment.authorName?.charAt(0).toUpperCase() || '?'}
                                                            </div>
                                                            <div>
                                                                <span className="text-sm font-bold text-gray-800">{comment.authorName}</span>
                                                                <span className="text-[11px] text-gray-400 ml-2">{formatDate(comment.createdAt)}</span>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-1">
                                                            {editingCommentId === comment.id ? (
                                                                <>
                                                                    <button onClick={() => void handleUpdateComment(comment.id)}
                                                                        disabled={commentSubmitting}
                                                                        className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 disabled:opacity-40 transition-all">
                                                                        {commentSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                                                                    </button>
                                                                    <button onClick={cancelEditComment}
                                                                        className="p-1.5 bg-gray-100 text-gray-500 rounded-lg hover:bg-gray-200 transition-all">
                                                                        <X size={14} />
                                                                    </button>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <button onClick={() => startEditComment(comment)}
                                                                        className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-all" title="Sửa">
                                                                        <Pencil size={14} />
                                                                    </button>
                                                                    <button onClick={() => void handleDeleteComment(comment.id)}
                                                                        disabled={deletingCommentId === comment.id}
                                                                        className="p-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 disabled:opacity-40 transition-all" title="Xóa">
                                                                        {deletingCommentId === comment.id ? <Loader2 size={14} className="animate-spin" /> : <Trash size={14} />}
                                                                    </button>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>
                                                    {editingCommentId === comment.id ? (
                                                        <div className="space-y-2">
                                                            <textarea value={editingCommentContent}
                                                                onChange={e => setEditingCommentContent(e.target.value)} rows={3} maxLength={2000}
                                                                className="w-full px-3 py-2.5 border border-indigo-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm resize-none" />
                                                        </div>
                                                    ) : (
                                                        <p className="text-sm text-gray-700 leading-relaxed pl-10 whitespace-pre-wrap break-words">{comment.content}</p>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirm */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
                    <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-100">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-3 bg-red-100 rounded-xl">
                                <AlertCircle className="text-red-600" size={24} />
                            </div>
                            <div>
                                <h3 className="text-lg font-black text-gray-900">Xác nhận xóa</h3>
                                <p className="text-xs text-gray-400">Hành động không thể hoàn tác</p>
                            </div>
                        </div>
                        <p className="text-gray-600 mb-6 text-sm">Bạn có chắc chắn muốn xóa tài liệu này? Tất cả dữ liệu liên quan sẽ bị mất vĩnh viễn.</p>
                        <div className="flex gap-3 justify-end">
                            <button onClick={() => { setShowDeleteConfirm(false); setDocumentToDelete(null); }}
                                className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-all">
                                Hủy
                            </button>
                            <button onClick={() => void handleDelete()}
                                className="px-5 py-2.5 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-all shadow-lg shadow-red-100">
                                Xóa ngay
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminDocumentsManagement;
