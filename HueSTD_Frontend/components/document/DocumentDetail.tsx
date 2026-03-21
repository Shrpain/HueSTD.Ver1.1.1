import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, FileText, Download, Sparkles, ArrowLeft, CheckCircle, MessageCircle, Send } from 'lucide-react';
import { Document } from '../../types';
import AIChatPanel from '../AIChatPanel';
import { extractTextFromPdf } from '../../services/aiService';
import api, { downloadFile } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

interface DocumentCommentDto {
  id: string;
  documentId: string;
  userId: string;
  authorName: string;
  authorAvatar?: string | null;
  content: string;
  createdAt: string;
}

interface DocumentDetailProps {
  document: Document;
  allDocuments: Document[];
  onClose: () => void;
  onViewIncrement: (docId: string) => void;
}

const DocumentDetail: React.FC<DocumentDetailProps> = ({ document, allDocuments, onClose, onViewIncrement }) => {
  const { isAuthenticated } = useAuth();
  const [showAIChat, setShowAIChat] = useState(false);
  const [extractedText, setExtractedText] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractProgress, setExtractProgress] = useState('');
  const [comments, setComments] = useState<DocumentCommentDto[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentDraft, setCommentDraft] = useState('');
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);

  useEffect(() => {
    onViewIncrement(document.id);
    // Chỉ tăng lượt xem khi đổi tài liệu (tránh phụ thuộc callback cha gây lặp)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [document.id]);

  const loadComments = useCallback(async () => {
    setCommentsLoading(true);
    setCommentError(null);
    try {
      const res = await api.get<DocumentCommentDto[]>(`/documents/${document.id}/comments`);
      setComments(Array.isArray(res.data) ? res.data : []);
    } catch {
      setComments([]);
      setCommentError('Không tải được bình luận.');
    } finally {
      setCommentsLoading(false);
    }
  }, [document.id]);

  useEffect(() => {
    void loadComments();
  }, [loadComments]);

  const handleAskAI = async () => {
    setShowAIChat(true);
    setExtractedText('');

    if (document.fileUrl) {
      setIsExtracting(true);
      setExtractProgress('Đang đọc tài liệu...');
      try {
        const text = await extractTextFromPdf(document.fileUrl, (status) => setExtractProgress(status));
        setExtractedText(text);
      } catch (err) {
        console.error('Extraction failed:', err);
        setExtractedText('');
      } finally {
        setIsExtracting(false);
      }
    }
  };

  const handleSubmitComment = async () => {
    const text = commentDraft.trim();
    if (!isAuthenticated || !text || commentSubmitting) return;
    setCommentSubmitting(true);
    setCommentError(null);
    try {
      const res = await api.post<DocumentCommentDto>(`/documents/${document.id}/comments`, { content: text });
      setComments((prev) => [res.data, ...prev]);
      setCommentDraft('');
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      setCommentError(msg || 'Gửi bình luận thất bại. Vui lòng thử lại.');
    } finally {
      setCommentSubmitting(false);
    }
  };

  const handleDownload = async () => {
    try {
      await api.post(`/documents/${document.id}/download`);
      if (document.fileUrl) {
        await downloadFile(document.fileUrl, `${document.title || 'document'}.pdf`);
      }
    } catch (err) {
      console.error('Download error:', err);
      if (document.fileUrl) {
        await downloadFile(document.fileUrl, `${document.title || 'document'}.pdf`);
      }
    }
  };

  const latestDoc = allDocuments.find(d => d.id === document.id) || document;

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        style={{
          WebkitBackdropFilter: 'blur(6px)',
          backdropFilter: 'blur(6px)'
        }}
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        className="relative z-10"
        style={{
          background: 'white',
          width: '100%',
          maxWidth: '1280px',
          height: '85vh',
          borderRadius: '2.5rem',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'row',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)'
        }}
      >
        {/* Left - PDF Preview */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            background: '#f1f5f9',
            overflow: 'hidden',
            minHeight: 0
          }}
        >
          <div
            style={{
              padding: '1rem',
              borderBottom: '1px solid #e2e8f0',
              background: 'white',
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-teal-50 rounded-lg flex items-center justify-center text-teal-600">
                <FileText size={18} />
              </div>
              <h3 className="font-bold text-slate-800 line-clamp-1">{document.title}</h3>
            </div>
            <button className="md:hidden p-2" onClick={onClose}>
              <X size={20} />
            </button>
          </div>

          <div style={{ flex: 1, overflow: 'hidden', minHeight: 0 }}>
            {document.fileUrl?.toLowerCase().endsWith('.pdf') ? (
              <iframe
                src={document.fileUrl}
                style={{
                  width: '100%',
                  height: '100%',
                  border: 'none'
                }}
                title={document.title}
              />
            ) : (
              <div
                style={{
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '2rem'
                }}
              >
                <div className="bg-white w-full max-w-md text-center rounded-2xl shadow-sm p-12 space-y-4">
                  <div className="w-20 h-28 mx-auto border-4 border-slate-100 rounded-lg flex items-center justify-center text-slate-300">
                    <FileText size={48} />
                  </div>
                  <p className="text-slate-400 font-medium">Xem trước không khả dụng</p>
                  <a
                    href={document.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block mt-4 bg-teal-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-teal-700"
                  >
                    Mở file gốc
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right - Sidebar */}
        <div
          style={{
            width: '400px',
            background: 'white',
            borderLeft: '1px solid #e2e8f0',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            minHeight: 0
          }}
        >
          {showAIChat ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
              <div
                style={{
                  flexShrink: 0,
                  padding: '1rem',
                  borderBottom: '1px solid #e2e8f0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowAIChat(false)}
                    className="p-1.5 hover:bg-slate-50 rounded-xl transition-colors text-slate-500"
                  >
                    <ArrowLeft size={18} />
                  </button>
                  <h4 className="font-black text-[13px] text-slate-800 uppercase tracking-wider flex items-center gap-2">
                    <Sparkles size={16} className="text-violet-600" /> Trợ lý AI
                  </h4>
                </div>
              </div>

              <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                {isExtracting ? (
                  <div
                    style={{
                      flex: 1,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '2rem',
                      textAlign: 'center'
                    }}
                  >
                    <div className="relative">
                      <div className="absolute inset-0 bg-violet-200 rounded-full animate-ping opacity-20"></div>
                      <div className="bg-violet-100 p-4 rounded-full text-violet-600 relative">
                        <Sparkles size={32} className="animate-pulse" />
                      </div>
                    </div>
                    <div className="mt-4">
                      <h3 className="font-bold text-slate-800">Đang đọc tài liệu</h3>
                      <p className="text-sm text-slate-500 mt-1">{extractProgress}</p>
                    </div>
                  </div>
                ) : (
                  <AIChatPanel
                    documentTitle={document.title}
                    extractedText={extractedText}
                    onClose={() => setShowAIChat(false)}
                  />
                )}
              </div>
            </div>
          ) : (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
              <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', minHeight: 0 }} className="space-y-8">
                <div className="space-y-4">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                    <CheckCircle size={14} className="text-teal-500" /> Thông tin cơ bản
                  </h4>
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400 font-bold">Trường học</span>
                      <span className="text-slate-800 font-black">{document.school}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400 font-bold">Môn học</span>
                      <span className="text-slate-800 font-black">{document.subject}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400 font-bold">Năm học</span>
                      <span className="text-slate-800 font-black">{document.year || '—'}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400 font-bold">Ngày đăng</span>
                      <span className="text-slate-800 font-black">{new Date(document.createdAt).toLocaleDateString('vi-VN')}</span>
                    </div>
                  </div>
                  {document.description ? (
                    <p className="text-xs text-slate-500 leading-relaxed font-medium">{document.description}</p>
                  ) : null}

                  <div className="rounded-xl border border-slate-100 bg-slate-50 overflow-hidden flex flex-col min-h-[140px] max-h-[280px]">
                    <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-100 bg-white/80">
                      <MessageCircle size={14} className="text-slate-400" />
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Bình luận</span>
                    </div>
                    <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2 min-h-[72px]">
                      {commentsLoading ? (
                        <p className="text-xs text-slate-400 text-center py-4">Đang tải bình luận…</p>
                      ) : comments.length === 0 ? (
                        <p className="text-xs text-slate-400 text-center py-4 italic">Chưa có bình luận. Hãy là người đầu tiên!</p>
                      ) : (
                        comments.map((c) => (
                          <div key={c.id} className="text-xs bg-white rounded-lg px-2.5 py-2 border border-slate-100 shadow-sm">
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <span className="font-bold text-slate-700 truncate">{c.authorName}</span>
                              <span className="text-[10px] text-slate-400 shrink-0">
                                {new Date(c.createdAt).toLocaleString('vi-VN')}
                              </span>
                            </div>
                            <p className="text-slate-600 leading-relaxed whitespace-pre-wrap break-words">{c.content}</p>
                          </div>
                        ))
                      )}
                    </div>
                    <div className="p-2 border-t border-slate-100 bg-white space-y-2">
                      {commentError ? <p className="text-[11px] text-red-600 px-1">{commentError}</p> : null}
                      {isAuthenticated ? (
                        <div className="flex gap-2">
                          <textarea
                            value={commentDraft}
                            onChange={(e) => setCommentDraft(e.target.value)}
                            placeholder="Viết bình luận…"
                            maxLength={2000}
                            rows={2}
                            className="flex-1 text-xs rounded-lg border border-slate-200 px-2.5 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500"
                          />
                          <button
                            type="button"
                            onClick={() => void handleSubmitComment()}
                            disabled={commentSubmitting || !commentDraft.trim()}
                            className="shrink-0 self-end bg-teal-600 text-white p-2.5 rounded-xl hover:bg-teal-700 disabled:opacity-40 disabled:pointer-events-none transition-colors"
                            title="Gửi"
                          >
                            <Send size={16} />
                          </button>
                        </div>
                      ) : (
                        <p className="text-[11px] text-slate-500 px-1 text-center">Đăng nhập để tham gia bình luận.</p>
                      )}
                    </div>
                  </div>
                </div>

              </div>

              <div
                style={{
                  flexShrink: 0,
                  padding: '1.5rem',
                  borderTop: '1px solid #e2e8f0',
                  background: 'white'
                }}
                className="space-y-4"
              >
                <div className="flex gap-3">
                  <button
                    onClick={handleAskAI}
                    className="flex-1 bg-violet-600 text-white py-3 rounded-2xl font-black flex items-center justify-center gap-2 hover:bg-violet-700 shadow-xl shadow-violet-100 transition-all active:scale-95"
                  >
                    <Sparkles size={18} />
                    Hỏi AI
                  </button>
                  <button
                    onClick={handleDownload}
                    className="flex-1 bg-teal-600 text-white py-3 rounded-2xl font-black flex items-center justify-center gap-2 hover:bg-teal-700 shadow-xl shadow-teal-100 transition-all active:scale-95"
                  >
                    <Download size={18} />
                    Tải về
                  </button>
                </div>

              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, window.document.body);
};

export default DocumentDetail;
