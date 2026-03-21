import React from 'react';
import { Search, FileText, Eye, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import { Document, DocumentType } from '../../types';
import { useToast } from '../Toast';
import api, { downloadFile } from '../../services/api';

interface DocumentListProps {
  documents: Document[];
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  activeType: string;
  setActiveType: (type: string) => void;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  schoolFilter: string;
  setSchoolFilter: (school: string) => void;
  onDocumentSelect: (doc: Document) => void;
  onRefresh: () => void;
}

const DocumentList: React.FC<DocumentListProps> = ({
  documents,
  currentPage,
  totalPages,
  onPageChange,
  activeType,
  setActiveType,
  searchTerm,
  setSearchTerm,
  schoolFilter,
  setSchoolFilter,
  onDocumentSelect,
  onRefresh
}) => {
  const { showToast } = useToast();
  const itemsPerPage = 10;

  const filteredDocuments = documents.filter((doc) => {
    const matchesType = activeType === 'Tất cả' || doc.type === activeType;
    const matchesSearch =
      doc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.subject?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSchool = schoolFilter === 'Tất cả' || doc.school === schoolFilter;
    return matchesType && matchesSearch && matchesSchool;
  });

  const uniqueSchools = ['Tất cả', ...new Set(documents.map((d) => d.school).filter(Boolean))];

  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedDocuments = filteredDocuments.slice(startIndex, endIndex);

  const handleDownload = async (doc: Document, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      showToast({
        type: 'info',
        title: 'Bắt đầu tải về',
        message: `Đang chuẩn bị tải tài liệu: ${doc.title}`,
        duration: 3000
      });
      await api.post(`/documents/${doc.id}/download`);
      if (doc.fileUrl) {
        await downloadFile(doc.fileUrl, `${doc.title || 'document'}.pdf`);
      }
    } catch (err) {
      console.error('Download error:', err);
      showToast({
        type: 'error',
        title: 'Lỗi tải về',
        message: 'Không thể tải tài liệu. Vui lòng thử lại.',
        duration: 4000
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-white p-4 rounded-2xl border shadow-sm space-y-4">
        <div className="flex flex-wrap gap-2">
          {['Tất cả', ...Object.values(DocumentType)].map((type) => (
            <button
              key={type}
              onClick={() => setActiveType(type)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                activeType === type ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {type}
            </button>
          ))}
        </div>
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tên tài liệu, môn học..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-10 pr-4 text-sm focus:ring-2 focus:ring-teal-500 transition-all outline-none"
            />
          </div>
          <select
            value={schoolFilter}
            onChange={(e) => setSchoolFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-4 text-sm focus:ring-2 focus:ring-teal-500 outline-none"
          >
            {uniqueSchools.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Documents Table */}
      <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
        {filteredDocuments.length === 0 ? (
          <div className="text-center py-12 text-slate-400">Không tìm thấy tài liệu nào</div>
        ) : (
          <>
            {/* Pagination - Top */}
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <div className="text-sm text-slate-500">
                Hiển thị {startIndex + 1}-{Math.min(endIndex, filteredDocuments.length)} của {filteredDocuments.length} tài liệu
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 text-sm rounded-lg border hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
                >
                  <ChevronLeft size={16} />
                  Trước
                </button>
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  const page = i + 1;
                  return (
                    <button
                      key={page}
                      onClick={() => onPageChange(page)}
                      className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                        currentPage === page
                          ? 'bg-teal-600 text-white'
                          : 'border hover:bg-slate-50'
                      }`}
                    >
                      {page}
                    </button>
                  );
                })}
                <button
                  onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 text-sm rounded-lg border hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
                >
                  Sau
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Tài liệu</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Trường</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase hidden md:table-cell">Người đăng</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase text-center">Thống kê</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase text-right">Hành động</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {paginatedDocuments.map((doc) => (
                    <tr
                      key={doc.id}
                      className="hover:bg-slate-50/80 transition-all duration-300 cursor-pointer hover:shadow-md hover:scale-[1.01]"
                      onClick={() => onDocumentSelect(doc)}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3 group">
                          <div className="w-10 h-10 bg-teal-50 text-teal-600 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:bg-teal-100 group-hover:scale-110 transition-all duration-300">
                            <FileText size={20} />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-800 line-clamp-1 group-hover:text-teal-700 transition-colors duration-300">{doc.title}</p>
                            <p className="text-xs text-slate-500 group-hover:text-teal-600 transition-colors duration-300">
                              {doc.subject} • {doc.type}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-slate-600 group-hover:text-teal-700 transition-colors duration-300">{doc.school}</span>
                      </td>
                      <td className="px-6 py-4 hidden md:table-cell">
                        <div className="flex items-center gap-2 group">
                          <img
                            src={doc.uploaderAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(doc.uploader || 'U')}&background=0d9488&color=fff`}
                            className="w-6 h-6 rounded-full group-hover:scale-110 transition-transform duration-300"
                            alt=""
                          />
                          <span className="text-xs text-slate-600 font-medium group-hover:text-teal-700 transition-colors duration-300">{doc.uploader}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-3">
                          <div className="flex items-center gap-1.5 bg-blue-50 px-2 py-1 rounded-lg">
                            <Eye size={12} className="text-blue-500" />
                            <span className="text-xs font-bold text-blue-700">{doc.views?.toLocaleString() || 0}</span>
                          </div>
                          <div className="flex items-center gap-1.5 bg-emerald-50 px-2 py-1 rounded-lg">
                            <Download size={12} className="text-emerald-500" />
                            <span className="text-xs font-bold text-emerald-700">{doc.downloads?.toLocaleString() || 0}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                          <button
                            className="p-2 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-all"
                            onClick={(e) => handleDownload(doc, e)}
                          >
                            <Download size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default DocumentList;
