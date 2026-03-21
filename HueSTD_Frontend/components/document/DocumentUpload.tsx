import React, { useState } from 'react';
import { X, CheckCircle, Upload, FileText, Loader2 } from 'lucide-react';
import { DocumentType } from '../../types';
import { HUE_UNIVERSITIES } from '../../constants';
import api, { uploadDocumentFile } from '../../services/api';
import { useToast } from '../Toast';

interface DocumentUploadProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const DocumentUpload: React.FC<DocumentUploadProps> = ({ isOpen, onClose, onSuccess }) => {
  const { showToast } = useToast();
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadType, setUploadType] = useState(DocumentType.EXAM);
  const [uploadSchool, setUploadSchool] = useState('ĐH Khoa học Huế');
  const [uploadYear, setUploadYear] = useState('');
  const [uploadSubject, setUploadSubject] = useState('');
  const [uploadDescription, setUploadDescription] = useState('');
  const [uploadFileUrl, setUploadFileUrl] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadMethod, setUploadMethod] = useState<'file' | 'link'>('file');
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  const resetForm = () => {
    setUploadTitle('');
    setUploadDescription('');
    setUploadFileUrl('');
    setUploadFile(null);
    setUploadSubject('');
    setUploadYear('');
    setUploadError(null);
    setUploadSuccess(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploadLoading(true);
    setUploadError(null);

    showToast({
      type: 'info',
      title: 'Đang xử lý',
      message: 'Đang tải tài liệu lên hệ thống...',
      duration: 3000
    });

    try {
      let finalFileUrl = uploadFileUrl;

      if (uploadMethod === 'file' && uploadFile) {
        const uploadResult = await uploadDocumentFile(uploadFile);
        finalFileUrl = uploadResult.fileUrl;
      }

      await api.post('/documents/contribute', {
        title: uploadTitle,
        description: uploadDescription,
        fileUrl: finalFileUrl,
        school: uploadSchool,
        subject: uploadSubject,
        type: uploadType,
        year: uploadYear,
      });

      setUploadSuccess(true);
      showToast({
        type: 'success',
        title: 'Thành công',
        message: 'Tài liệu của bạn đã được tải lên và đang chờ duyệt.',
        duration: 5000
      });

      setTimeout(() => {
        handleClose();
        onSuccess();
      }, 2000);
    } catch (err: any) {
      const status = err.response?.status;
      const msg = err.response?.data?.message || err.message;
      if (status === 401) {
        setUploadError('Vui lòng đăng nhập để tải tài liệu lên.');
      } else {
        setUploadError(msg || 'Lỗi khi tải tài liệu');
      }
      showToast({
        type: 'error',
        title: 'Lỗi tải lên',
        message: msg || 'Lỗi khi tải tài liệu. Vui lòng thử lại.',
        duration: 5000
      });
    } finally {
      setUploadLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-6 border-b flex items-center justify-between">
          <h2 className="text-xl font-black text-slate-800">Đóng góp tài liệu mới</h2>
          <button onClick={handleClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 transition-colors">
            <X size={20} />
          </button>
        </div>

        {uploadSuccess ? (
          <div className="p-12 flex flex-col items-center text-center space-y-4">
            <div className="w-16 h-16 bg-teal-50 text-teal-600 rounded-full flex items-center justify-center">
              <CheckCircle size={40} />
            </div>
            <h3 className="text-2xl font-black text-slate-800">Tải lên thành công!</h3>
            <p className="text-slate-500 font-medium">Tài liệu của bạn đã được lưu. Cảm ơn bạn đã đóng góp!</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-8 space-y-6 overflow-y-auto max-h-[75vh]">
            {uploadError && (
              <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm flex items-center gap-2">
                <X size={16} />
                {uploadError}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest px-1">Tên tài liệu</label>
                <input
                  type="text"
                  required
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  placeholder="Ví dụ: Đề thi Toán A1"
                  className="w-full bg-slate-50 border-none rounded-2xl px-5 py-3.5 text-sm focus:ring-2 focus:ring-teal-500 transition-all outline-none"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest px-1">Trường đại học</label>
                <select
                  value={uploadSchool}
                  onChange={(e) => setUploadSchool(e.target.value)}
                  className="w-full bg-slate-50 border-none rounded-2xl px-5 py-3.5 text-sm focus:ring-2 focus:ring-teal-500 transition-all outline-none"
                >
                  {HUE_UNIVERSITIES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest px-1">Loại tài liệu</label>
                <select
                  value={uploadType}
                  onChange={(e) => setUploadType(e.target.value as DocumentType)}
                  className="w-full bg-slate-50 border-none rounded-2xl px-5 py-3.5 text-sm focus:ring-2 focus:ring-teal-500 transition-all outline-none"
                >
                  {Object.values(DocumentType).map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest px-1">Môn học</label>
                <input
                  type="text"
                  value={uploadSubject}
                  onChange={(e) => setUploadSubject(e.target.value)}
                  placeholder="Ví dụ: Giải tích 1"
                  className="w-full bg-slate-50 border-none rounded-2xl px-5 py-3.5 text-sm focus:ring-2 focus:ring-teal-500 transition-all outline-none"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest px-1">Năm học</label>
                <input
                  type="text"
                  value={uploadYear}
                  onChange={(e) => setUploadYear(e.target.value)}
                  placeholder="2024"
                  className="w-full bg-slate-50 border-none rounded-2xl px-5 py-3.5 text-sm focus:ring-2 focus:ring-teal-500 transition-all outline-none"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest px-1">Mô tả</label>
              <textarea
                value={uploadDescription}
                onChange={(e) => setUploadDescription(e.target.value)}
                placeholder="Mô tả ngắn về tài liệu..."
                rows={3}
                className="w-full bg-slate-50 border-none rounded-2xl px-5 py-3.5 text-sm focus:ring-2 focus:ring-teal-500 transition-all outline-none resize-none"
              />
            </div>

            <div className="flex gap-2 mb-4">
              <button
                type="button"
                onClick={() => setUploadMethod('file')}
                className={`flex-1 py-2 rounded-xl text-sm font-bold transition-colors ${
                  uploadMethod === 'file' ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Tải file
              </button>
              <button
                type="button"
                onClick={() => setUploadMethod('link')}
                className={`flex-1 py-2 rounded-xl text-sm font-bold transition-colors ${
                  uploadMethod === 'link' ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Dán link
              </button>
            </div>

            {uploadMethod === 'file' ? (
              <div
                className="border-2 border-dashed border-slate-200 rounded-3xl p-10 text-center hover:border-teal-400 hover:bg-teal-50 transition-all cursor-pointer group"
                onClick={() => document.getElementById('file-upload')?.click()}
              >
                <input
                  id="file-upload"
                  type="file"
                  className="hidden"
                  accept=".pdf,.doc,.docx,.ppt,.pptx"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                />
                {uploadFile ? (
                  <div className="space-y-2">
                    <FileText className="mx-auto text-teal-600" size={40} />
                    <p className="font-bold text-slate-800">{uploadFile.name}</p>
                    <p className="text-xs text-slate-400">{(uploadFile.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                ) : (
                  <>
                    <Upload className="mx-auto text-slate-200 group-hover:text-teal-500 mb-4 transition-colors" size={40} />
                    <p className="text-sm font-black text-slate-600">Click hoặc kéo thả file</p>
                    <p className="text-xs text-slate-400 mt-2 font-medium">Hỗ trợ: PDF, DOCX, PPTX (Tối đa 50MB)</p>
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <input
                  type="url"
                  value={uploadFileUrl}
                  onChange={(e) => setUploadFileUrl(e.target.value)}
                  placeholder="https://drive.google.com/..."
                  className="w-full bg-slate-50 border-none rounded-2xl px-5 py-3.5 text-sm focus:ring-2 focus:ring-teal-500 transition-all outline-none"
                />
                <p className="text-xs text-slate-400">Dán link từ Google Drive, Dropbox...</p>
              </div>
            )}

            <button
              type="submit"
              disabled={uploadLoading}
              className="w-full bg-teal-600 text-white py-4 rounded-2xl font-black shadow-xl shadow-teal-100 hover:bg-teal-700 transition-all active:scale-95 disabled:opacity-50"
            >
              {uploadLoading ? (
                <Loader2 className="animate-spin mx-auto" size={20} />
              ) : (
                'Tải tài liệu lên ngay'
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default DocumentUpload;
