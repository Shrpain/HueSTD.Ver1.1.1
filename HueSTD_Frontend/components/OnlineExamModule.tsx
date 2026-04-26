import React, { useEffect, useState } from 'react';
import {
  Plus,
  FileText,
  Clock,
  ArrowLeft,
  CheckCircle2,
  Trash2,
  Save,
  Edit,
  Play,
  Timer,
  AlertCircle,
  BookOpen,
  Check,
  Search,
  X,
  Sparkles,
} from 'lucide-react';
import { useToast } from './Toast';
import { examService, ExamDocument, ExamQuestion } from '../services/examService';
import { extractTextFromSource, generateExamFromAI } from '../services/aiService';

type ViewMode = 'list' | 'create' | 'edit' | 'take';

const createEmptyQuestion = (): ExamQuestion => ({
  text: '',
  points: 1,
  options: [
    { key: 'A', text: '', isCorrect: true },
    { key: 'B', text: '', isCorrect: false },
    { key: 'C', text: '', isCorrect: false },
    { key: 'D', text: '', isCorrect: false },
  ],
});

const OnlineExamModule: React.FC = () => {
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [exams, setExams] = useState<ExamDocument[]>([]);
  const [selectedExam, setSelectedExam] = useState<ExamDocument | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (viewMode === 'list') {
      void fetchExams();
    }
  }, [viewMode]);

  const fetchExams = async () => {
    setLoading(true);
    try {
      const data = await examService.getMyExams();
      setExams(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to fetch exams', error);
      setExams([]);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = async (examId: string) => {
    setLoading(true);
    try {
      const exam = await examService.getExam(examId);
      setSelectedExam(exam);
      setViewMode('edit');
    } catch (error) {
      console.error('Failed to fetch exam detail', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStartExam = async (examId: string) => {
    setLoading(true);
    try {
      const exam = await examService.getExam(examId);
      setSelectedExam(exam);
      setViewMode('take');
    } catch (error) {
      console.error('Failed to fetch exam for taking', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (examId: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa đề thi này không? Thao tác này không thể hoàn tác.')) {
      return;
    }

    try {
      await examService.deleteExam(examId);
      setExams((prev) => prev.filter((e) => e.id !== examId));
      setSelectedExam((prev) => (prev?.id === examId ? null : prev));
    } catch (error) {
      console.error('Failed to delete exam', error);
    }
  };

  return (
    <div className="w-full space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {viewMode === 'list' ? (
        <div className="space-y-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <h1 className="text-3xl font-black tracking-tight text-slate-800 dark:text-slate-100 transition-colors">Kho đề của tôi</h1>
              <p className="font-medium text-slate-500 dark:text-slate-400">Quản lý và luyện tập với các bộ đề thi trắc nghiệm cá nhân.</p>
            </div>
            <button
              onClick={() => {
                setSelectedExam(null);
                setViewMode('create');
              }}
              className="flex items-center justify-center gap-2 rounded-2xl bg-teal-600 px-6 py-3.5 font-black text-white shadow-xl shadow-teal-100 transition-all hover:bg-teal-700 active:scale-95"
            >
              <Plus size={20} strokeWidth={3} />
              Tạo đề thi mới
            </button>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((item) => (
                <div key={item} className="h-64 animate-pulse rounded-[2.5rem] bg-slate-100 dark:bg-slate-800" />
              ))}
            </div>
          ) : exams.length === 0 ? (
            <div className="space-y-4 rounded-[2.5rem] border border-slate-50 dark:border-slate-800 bg-white dark:bg-slate-900 p-12 text-center shadow-xl transition-colors">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-slate-50 dark:bg-slate-800 text-slate-300 dark:text-slate-600">
                <FileText size={40} />
              </div>
              <div className="space-y-1">
                <h3 className="text-xl font-bold text-slate-700 dark:text-slate-200">Chưa có đề thi nào</h3>
                <p className="mx-auto max-w-sm text-slate-400 dark:text-slate-500">Bắt đầu bằng cách tạo đề thi </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {exams.map((exam) => (
                <div
                  key={exam.id ?? exam.title}
                  className="group relative overflow-hidden rounded-[2.5rem] border border-slate-50 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xl transition-all duration-300 hover:shadow-2xl hover:shadow-teal-100/50 dark:hover:shadow-teal-900/30"
                >
                  <div className="absolute -right-8 -top-8 h-24 w-24 rounded-bl-[4rem] bg-teal-50 dark:bg-teal-900/20 opacity-50 transition-transform duration-500 group-hover:scale-150" />

                  <div className="absolute right-4 top-4 z-10 flex items-center gap-2">
                    <button
                      onClick={() => handleEdit(exam.id!)}
                      className="p-2.5 text-slate-300 hover:text-teal-600 hover:bg-teal-50 rounded-xl transition-all border border-transparent hover:border-teal-100 bg-white shadow-sm"
                      title="Chỉnh sửa"
                    >
                      <Edit size={18} />
                    </button>
                    <button
                      onClick={() => handleDelete(exam.id!)}
                      className="p-2.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all border border-transparent hover:border-red-100 bg-white shadow-sm"
                      title="Xóa đề thi"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>

                  <div className="relative space-y-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-50 text-teal-600">
                      <FileText size={24} />
                    </div>
                    <div className="space-y-1">
                      <h3 className="line-clamp-1 pr-10 text-lg font-black leading-tight text-slate-800 dark:text-slate-100">{exam.title}</h3>
                      <p className="line-clamp-2 text-sm font-medium text-slate-400 dark:text-slate-500">{exam.description || 'Không có mô tả'}</p>
                    </div>
                    <div className="flex items-center gap-4 pt-2">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 dark:text-slate-400">
                        <Clock size={14} className="text-teal-500" />
                        {exam.durationMinutes} phút
                      </div>
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 dark:text-slate-400">
                        <CheckCircle2 size={14} className="text-teal-500" />
                        {exam.questions.length} câu hỏi
                      </div>
                    </div>
                    <button
                      onClick={() => handleStartExam(exam.id!)}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-50 dark:bg-slate-800 py-3 font-black text-slate-600 dark:text-slate-300 transition-all duration-300 group-hover:bg-teal-600 group-hover:text-white"
                    >
                      Bắt đầu thi
                      <Play size={18} fill="currentColor" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : viewMode === 'take' && selectedExam ? (
        <ExamRunner exam={selectedExam} onCancel={() => setViewMode('list')} />
      ) : (
        <ManualExamCreator
          initialData={selectedExam}
          onCancel={() => setViewMode('list')}
          onSuccess={() => setViewMode('list')}
        />
      )}
    </div>
  );
};

interface ManualExamCreatorProps {
  initialData?: ExamDocument | null;
  onCancel: () => void;
  onSuccess: () => void;
}

const ManualExamCreator: React.FC<ManualExamCreatorProps> = ({ initialData, onCancel, onSuccess }) => {
  const { showToast } = useToast();
  const [saving, setSaving] = useState(false);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [userDocs, setUserDocs] = useState<any[]>([]);
  const [showDocModal, setShowDocModal] = useState(false);
  const [searchTerm, setSearchDocs] = useState('');
  const [formData, setFormData] = useState<ExamDocument>({
    title: '',
    description: '',
    durationMinutes: 60,
    sourceDocumentIds: [],
    questions: [createEmptyQuestion()],
  });

  // AI Generation States
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [aiProgress, setAiProgress] = useState(0);
  const [aiStatus, setAiStatus] = useState('');
  const [showAiConfig, setShowAiConfig] = useState(false);
  const [aiQuestionCount, setAiQuestionCount] = useState(5);
  const [extractedContent, setExtractedContent] = useState('');

  useEffect(() => {
    void fetchUserDocuments();
  }, []);

  useEffect(() => {
    if (initialData) {
      setFormData({
        ...initialData,
        sourceDocumentIds: initialData.sourceDocumentIds || [],
        questions: initialData.questions && initialData.questions.length > 0
          ? initialData.questions.map(q => ({
            ...q,
            options: q.options || [
              { key: 'A', text: '', isCorrect: true },
              { key: 'B', text: '', isCorrect: false },
              { key: 'C', text: '', isCorrect: false },
              { key: 'D', text: '', isCorrect: false },
            ]
          }))
          : [createEmptyQuestion()],
      });
    }
  }, [initialData]);

  const handleStartAiProcess = async () => {
    if (formData.sourceDocumentIds.length === 0) {
      showToast({
        type: 'error',
        title: 'Chưa chọn tài liệu',
        message: 'Vui lòng chọn ít nhất 1 tài liệu để AI có dữ liệu sinh đề.',
      });
      return;
    }

    setIsAiProcessing(true);
    setAiProgress(0);
    setAiStatus('Đang chuẩn bị tài liệu...');
    setExtractedContent('');

    try {
      let fullContent = '';
      const totalDocs = selectedDocsInfo.length;

      for (let i = 0; i < totalDocs; i++) {
        const doc = selectedDocsInfo[i];
        if (!doc.fileUrl) continue;

        const baseProgress = (i / totalDocs) * 60;
        setAiStatus(`Đang đọc: ${doc.title}...`);

        const result = await extractTextFromSource(doc.fileUrl, (status) => {
          // Inner progress within one doc (mapping status to a small range)
          console.log(`[AI] ${doc.title}: ${status}`);
        });

        fullContent += `\n--- Nguồn: ${doc.title} ---\n${result.extractedText}\n`;
        setAiProgress(baseProgress + (60 / totalDocs));
      }

      if (!fullContent.trim()) {
        throw new Error('Không thể trích xuất nội dung từ các tài liệu đã chọn.');
      }

      setExtractedContent(fullContent);
      setAiProgress(60);
      setAiStatus('Đã đọc xong tài liệu!');
      setShowAiConfig(true);
    } catch (error: any) {
      showToast({ type: 'error', title: 'Lỗi đọc tài liệu', message: error.message });
      setIsAiProcessing(false);
    }
  };

  const handleFinalAiGenerate = async () => {
    setShowAiConfig(false);
    setAiStatus('AI đang phân tích và tạo câu hỏi...');
    setAiProgress(70);

    // Simulate progress while waiting for AI
    const timer = setInterval(() => {
      setAiProgress(prev => (prev < 95 ? prev + 1 : prev));
    }, 400);

    try {
      const result = await generateExamFromAI(extractedContent, aiQuestionCount);
      clearInterval(timer);
      setAiProgress(100);
      setAiStatus('Hoàn tất!');

      if (result && result.questions) {
        setFormData(prev => ({
          ...prev,
          title: prev.title || result.title,
          description: prev.description || result.description,
          questions: result.questions.map((q: any) => ({
            text: q.text,
            points: q.points || 1,
            options: q.options.map((o: any) => ({
              key: o.key,
              text: o.text,
              isCorrect: o.isCorrect
            }))
          }))
        }));

        showToast({
          type: 'success',
          title: 'Thành công',
          message: `AI đã tạo thành công ${result.questions.length} câu hỏi cho bạn.`,
        });
      }
    } catch (error: any) {
      showToast({ type: 'error', title: 'AI lỗi', message: error.message });
    } finally {
      clearInterval(timer);
      setTimeout(() => setIsAiProcessing(false), 800);
    }
  };

  const fetchUserDocuments = async () => {
    setLoadingDocs(true);
    try {
      const docs = await examService.getUserDocuments();
      setUserDocs(docs);
    } catch (error) {
      console.error('Failed to fetch user documents', error);
    } finally {
      setLoadingDocs(false);
    }
  };

  const toggleDocument = (docId: string) => {
    setFormData((prev) => {
      const isSelected = prev.sourceDocumentIds.includes(docId);
      return {
        ...prev,
        sourceDocumentIds: isSelected
          ? prev.sourceDocumentIds.filter((id) => id !== docId)
          : [...prev.sourceDocumentIds, docId],
      };
    });
  };

  const filteredDocs = userDocs.filter((doc) =>
    doc.title.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const selectedDocsInfo = userDocs.filter((doc) =>
    formData.sourceDocumentIds.includes(doc.id),
  );

  const addQuestion = () => {
    setFormData((prev) => ({
      ...prev,
      questions: [...prev.questions, createEmptyQuestion()],
    }));
  };

  const removeQuestion = (index: number) => {
    if (formData.questions.length === 1) return;
    setFormData((prev) => ({
      ...prev,
      questions: prev.questions.filter((_, questionIndex) => questionIndex !== index),
    }));
  };

  const updateQuestion = (index: number, field: keyof ExamQuestion, value: string | number) => {
    setFormData((prev) => ({
      ...prev,
      questions: prev.questions.map((question, questionIndex) =>
        questionIndex === index ? { ...question, [field]: value } : question,
      ),
    }));
  };

  const updateOption = (questionIndex: number, optionIndex: number, value: string) => {
    setFormData((prev) => ({
      ...prev,
      questions: prev.questions.map((question, currentQuestionIndex) => {
        if (currentQuestionIndex !== questionIndex) return question;
        return {
          ...question,
          options: question.options.map((option, currentOptionIndex) =>
            currentOptionIndex === optionIndex ? { ...option, text: value } : option,
          ),
        };
      }),
    }));
  };

  const setCorrectOption = (questionIndex: number, optionIndex: number) => {
    setFormData((prev) => ({
      ...prev,
      questions: prev.questions.map((question, currentQuestionIndex) => {
        if (currentQuestionIndex !== questionIndex) return question;
        return {
          ...question,
          options: question.options.map((option, currentOptionIndex) => ({
            ...option,
            isCorrect: currentOptionIndex === optionIndex,
          })),
        };
      }),
    }));
  };

  const validateForm = () => {
    if (!formData.title.trim()) {
      showToast({ type: 'error', title: 'Thiếu tiêu đề', message: 'Vui lòng nhập tiêu đề đề thi.' });
      return false;
    }

    if (formData.durationMinutes <= 0) {
      showToast({ type: 'error', title: 'Thời gian không hợp lệ', message: 'Thời gian làm bài phải lớn hơn 0 phút.' });
      return false;
    }

    const invalidQuestion = formData.questions.find((question) => {
      const hasEmptyOption = question.options.some((option) => !option.text.trim());
      const correctCount = question.options.filter((option) => option.isCorrect).length;
      return !question.text.trim() || question.points <= 0 || hasEmptyOption || correctCount !== 1;
    });

    if (invalidQuestion) {
      showToast({
        type: 'error',
        title: 'Câu hỏi chưa hợp lệ',
        message: 'Mỗi câu hỏi phải có nội dung, điểm số hợp lệ, 4 đáp án và đúng 1 đáp án đúng.',
      });
      return false;
    }

    return true;
  };

  const handleSave = async (status: 'draft' | 'published') => {
    if (!validateForm()) return;

    setSaving(true);
    try {
      if (formData.id) {
        await examService.updateManualExam(formData.id, { ...formData, status });
      } else {
        await examService.createManualExam({ ...formData, status });
      }

      showToast({
        type: 'success',
        title: formData.id ? 'Đã cập nhật đề thi' : 'Đã lưu vào kho',
        message: formData.id
          ? 'Thay đổi của bạn đã được ghi nhận thành công.'
          : 'Đề thi của bạn đã được lưu vào kho cá nhân thành công.',
      });
      onSuccess();
    } catch (error: any) {
      showToast({
        type: 'error',
        title: 'Không thể lưu đề thi',
        message: error?.response?.data?.message || 'Vui lòng thử lại sau.',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-8 pb-20">
      <div className="flex items-center gap-4">
        <button
          onClick={onCancel}
          className="rounded-2xl bg-white p-3 text-slate-400 shadow-md transition-colors hover:text-teal-600"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="space-y-1">
          <h2 className="text-2xl font-black text-slate-800">
            {formData.id ? 'Chỉnh sửa đề thi' : 'Tạo đề thi'}
          </h2>
          <p className="text-sm font-medium text-slate-400">
            {formData.id ? 'Cập nhật lại câu hỏi và đáp án cho bộ đề.' : 'Nhập câu hỏi và đáp án để tạo bộ đề trắc nghiệm mới.'}
          </p>
        </div>
      </div>

      <div className="space-y-8 rounded-[2.5rem] border border-slate-50 bg-white p-8 shadow-xl">
        <div className="space-y-6">
          <div className="space-y-4">
            <label className="px-1 text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
              <BookOpen size={14} className="text-teal-500" />
              Tài liệu liên quan
            </label>
            <div className="flex flex-col gap-4 md:flex-row">
              <button
                type="button"
                onClick={() => setShowDocModal(true)}
                className="flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-slate-50 text-slate-600 font-black text-sm border-2 border-dashed border-slate-200 transition-all hover:border-teal-500 hover:text-teal-600 hover:bg-teal-50/30"
              >
                <Plus size={18} />
                Chọn tài liệu
              </button>

              <button
                type="button"
                onClick={handleStartAiProcess}
                className="flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-gradient-to-br from-indigo-600 via-teal-600 to-emerald-600 text-white font-black text-sm shadow-xl shadow-teal-100 transition-all hover:shadow-indigo-200 hover:-translate-y-0.5 active:translate-y-0 group"
              >
                <div className="relative">
                  <Sparkles size={18} className="group-hover:animate-bounce" />
                  <div className="absolute inset-0 animate-ping opacity-20 bg-white rounded-full" />
                </div>
                Tạo đề nhanh với AI
              </button>
            </div>

            {selectedDocsInfo.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {selectedDocsInfo.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-teal-50 text-teal-700 text-[11px] font-bold border border-teal-100 animate-in fade-in zoom-in-95"
                    >
                      <BookOpen size={12} />
                      <span className="max-w-[200px] truncate">{doc.title}</span>
                      <button
                        onClick={() => toggleDocument(doc.id)}
                        className="p-0.5 hover:bg-teal-200 rounded-full transition-colors"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

          {/* Modal chọn tài liệu */}
          {showDocModal && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <div
                className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300"
                onClick={() => setShowDocModal(false)}
              />
              <div className="relative w-full max-w-2xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-8 duration-300">
                <div className="flex items-center justify-between p-6 border-b border-slate-50">
                  <div className="space-y-1">
                    <h3 className="text-xl font-black text-slate-800">Kho tài liệu của bạn</h3>
                    <p className="text-xs font-medium text-slate-400">Chọn các tài liệu liên quan đến đề thi này</p>
                  </div>
                  <button
                    onClick={() => setShowDocModal(false)}
                    className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-xl transition-all"
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="p-6 space-y-4">
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                      type="text"
                      placeholder="Tìm kiếm tài liệu..."
                      className="w-full pl-12 pr-4 py-3.5 rounded-2xl bg-slate-50 border-none text-sm font-bold outline-none focus:ring-2 focus:ring-teal-500 transition-all"
                      value={searchTerm}
                      onChange={(e) => setSearchDocs(e.target.value)}
                    />
                  </div>

                  <div className="max-h-[40vh] overflow-y-auto space-y-2 pr-2 scrollbar-hide">
                    {loadingDocs ? (
                      <div className="flex flex-col items-center justify-center py-12 space-y-3">
                        <div className="h-10 w-10 animate-spin rounded-full border-4 border-teal-500 border-t-transparent" />
                        <p className="text-sm font-bold text-slate-400">Đang tải tài liệu...</p>
                      </div>
                    ) : filteredDocs.length === 0 ? (
                      <div className="text-center py-12 space-y-3">
                        <div className="mx-auto w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-300">
                          <Search size={32} />
                        </div>
                        <p className="text-sm font-bold text-slate-400">Không tìm thấy tài liệu phù hợp</p>
                      </div>
                    ) : (
                      filteredDocs.map((doc) => {
                        const isSelected = formData.sourceDocumentIds.includes(doc.id);
                        return (
                          <button
                            key={doc.id}
                            onClick={() => toggleDocument(doc.id)}
                            className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all text-left ${
                              isSelected
                                ? 'bg-teal-50 border-teal-500 shadow-sm'
                                : 'bg-white border-slate-50 hover:border-teal-200'
                            }`}
                          >
                            <div
                              className={`h-6 w-6 rounded-lg flex items-center justify-center transition-all ${
                                isSelected ? 'bg-teal-600 text-white' : 'bg-slate-100 text-transparent'
                              }`}
                            >
                              <Check size={14} strokeWidth={3} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm font-bold truncate ${isSelected ? 'text-teal-900' : 'text-slate-700'}`}>
                                {doc.title}
                              </p>
                              <p className="text-[10px] text-slate-400 font-black uppercase tracking-tight">
                                {doc.subject || 'Chung'} • {doc.type || 'Tài liệu'}
                              </p>
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>

                <div className="p-6 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest">
                    Đã chọn {formData.sourceDocumentIds.length} tài liệu
                  </p>
                  <button
                    onClick={() => setShowDocModal(false)}
                    className="px-8 py-3 rounded-xl bg-teal-600 text-white font-black text-sm shadow-xl shadow-teal-100 hover:bg-teal-700 active:scale-95 transition-all"
                  >
                    Xác nhận
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <label className="px-1 text-xs font-black uppercase tracking-widest text-slate-400">Thông tin cơ bản</label>
            <input
              type="text"
              placeholder="Tiêu đề đề thi"
              className="w-full rounded-2xl border-none bg-slate-50 px-5 py-4 text-sm font-bold outline-none transition-all focus:ring-2 focus:ring-teal-500"
              value={formData.title}
              onChange={(event) => setFormData((prev) => ({ ...prev, title: event.target.value }))}
            />
            <textarea
              placeholder="Mô tả chi tiết về đề thi"
              className="min-h-[100px] w-full resize-none rounded-2xl border-none bg-slate-50 px-5 py-4 text-sm font-medium outline-none transition-all focus:ring-2 focus:ring-teal-500"
              value={formData.description}
              onChange={(event) => setFormData((prev) => ({ ...prev, description: event.target.value }))}
            />
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <label className="px-1 text-xs font-black uppercase tracking-widest text-slate-400">Thời gian làm bài (phút)</label>
              <div className="relative">
                <Clock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                <input
                  type="number"
                  className="w-full rounded-2xl border-none bg-slate-50 py-4 pl-12 pr-5 text-sm font-black outline-none transition-all focus:ring-2 focus:ring-teal-500"
                  value={formData.durationMinutes}
                  onChange={(event) =>
                    setFormData((prev) => ({
                      ...prev,
                      durationMinutes: Number.parseInt(event.target.value, 10) || 0,
                    }))
                  }
                />
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="flex items-center justify-between px-1">
            <label className="text-xs font-black uppercase tracking-widest text-slate-400">
              Danh sách câu hỏi ({formData.questions.length})
            </label>
          </div>

          <div className="space-y-6">
            {formData.questions.map((question, questionIndex) => (
              <div
                key={questionIndex}
                className="group relative rounded-3xl border-2 border-slate-50 bg-white p-6 transition-all hover:border-teal-100"
              >
                <button
                  onClick={() => removeQuestion(questionIndex)}
                  className="absolute -right-3 -top-3 flex h-8 w-8 items-center justify-center rounded-full bg-red-50 text-red-500 opacity-0 shadow-sm transition-all hover:bg-red-500 hover:text-white group-hover:opacity-100"
                >
                  <Trash2 size={14} />
                </button>

                <div className="space-y-4">
                  <div className="flex gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-600 font-black text-white shadow-lg shadow-teal-100">
                      {questionIndex + 1}
                    </div>
                    <div className="flex-1 space-y-4">
                      <div className="flex flex-col gap-4 md:flex-row">
                        <textarea
                          placeholder="Nội dung câu hỏi"
                          className="flex-1 resize-none rounded-2xl border-none bg-slate-50 px-5 py-3.5 text-sm font-bold outline-none transition-all focus:ring-2 focus:ring-teal-500"
                          value={question.text}
                          onChange={(event) => updateQuestion(questionIndex, 'text', event.target.value)}
                        />
                        <div className="space-y-1 md:w-32">
                          <label className="ml-1 text-[10px] font-black uppercase text-slate-400">Số điểm</label>
                          <input
                            type="number"
                            className="w-full rounded-2xl border-none bg-slate-50 px-4 py-3.5 text-sm font-black outline-none transition-all focus:ring-2 focus:ring-teal-500"
                            value={question.points}
                            onChange={(event) =>
                              updateQuestion(questionIndex, 'points', Number.parseFloat(event.target.value) || 0)
                            }
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        {question.options.map((option, optionIndex) => (
                          <div
                            key={option.key}
                            className={`flex items-center gap-3 rounded-2xl p-1.5 transition-all ${option.isCorrect ? 'bg-teal-50 ring-1 ring-teal-100' : 'bg-white'}`}
                          >
                            <button
                              onClick={() => setCorrectOption(questionIndex, optionIndex)}
                              className={`flex h-10 w-10 items-center justify-center rounded-xl font-black transition-all ${option.isCorrect ? 'bg-teal-600 text-white shadow-lg shadow-teal-100' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}
                            >
                              {option.key}
                            </button>
                            <input
                              type="text"
                              placeholder={`Phương án ${option.key}`}
                              className="flex-1 border-none bg-transparent py-2 text-sm font-medium outline-none"
                              value={option.text}
                              onChange={(event) => updateOption(questionIndex, optionIndex, event.target.value)}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            <button
              onClick={addQuestion}
              className="flex w-full flex-col items-center justify-center gap-2 rounded-[2rem] border-2 border-dashed border-slate-200 py-6 font-black text-slate-400 transition-all hover:border-teal-500 hover:bg-teal-50/30 hover:text-teal-600"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-50 transition-colors">
                <Plus size={24} />
              </div>
              Thêm câu hỏi mới
            </button>
          </div>
        </div>

        <div className="flex flex-col items-center justify-center gap-4 border-t border-slate-50 pt-6 md:flex-row">
          <button
            disabled={saving}
            onClick={onCancel}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-100 px-8 py-4 font-black text-slate-600 transition-all hover:bg-slate-200 disabled:opacity-50 md:w-auto"
          >
            Hủy bỏ
          </button>
          <button
            disabled={saving}
            onClick={() => handleSave('draft')}
            className="flex w-full flex-1 items-center justify-center gap-2 rounded-2xl bg-teal-600 px-8 py-4 font-black text-white shadow-xl shadow-teal-100 transition-all hover:bg-teal-700 active:scale-95 disabled:opacity-50 md:w-auto"
          >
            <Save size={20} />
            {saving ? 'Đang xử lý...' : formData.id ? 'Cập nhật đề thi' : 'Lưu vào kho đề'}
          </button>
        </div>

        {/* AI Processing Modal Overlay */}
        {isAiProcessing && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-500" />

            <div className="relative w-full max-w-md bg-white rounded-[3rem] p-8 shadow-2xl animate-in zoom-in-95 duration-300 overflow-hidden">
              <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-teal-50 opacity-50 blur-3xl" />
              <div className="absolute -left-20 -bottom-20 h-64 w-64 rounded-full bg-indigo-50 opacity-50 blur-3xl" />

              <div className="relative space-y-8 text-center">
                {!showAiConfig ? (
                  <React.Fragment>
                    <div className="relative mx-auto h-24 w-24">
                      <div className="absolute inset-0 animate-spin rounded-full border-4 border-slate-100 border-t-teal-500" />
                      <div className="absolute inset-4 animate-pulse rounded-full bg-teal-50 flex items-center justify-center text-teal-600">
                        <Sparkles size={32} />
                      </div>
                    </div>

                    <div className="space-y-3">
                      <h3 className="text-2xl font-black text-slate-800 tracking-tight">Trợ lý AI HueSTD</h3>
                      <p className="text-sm font-bold text-teal-600 animate-pulse min-h-[1.25rem]">{aiStatus}</p>
                    </div>

                    <div className="space-y-2">
                      <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100 p-0.5 shadow-inner">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-teal-500 to-emerald-500 transition-all duration-500 shadow-sm"
                          style={{ width: `${aiProgress}%` }}
                        />
                      </div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Tiến trình: {Math.round(aiProgress)}%</p>
                    </div>
                  </React.Fragment>
                ) : (
                  <React.Fragment>
                    <div className="mx-auto h-20 w-20 rounded-[2rem] bg-indigo-50 flex items-center justify-center text-indigo-600 shadow-inner">
                      <BookOpen size={32} />
                    </div>

                    <div className="space-y-2">
                      <h3 className="text-2xl font-black text-slate-800 tracking-tight">Cấu hình đề thi</h3>
                      <p className="text-sm font-medium text-slate-400 px-4">AI đã đọc tài liệu thành công. Bạn muốn tạo bao nhiêu câu hỏi trắc nghiệm?</p>
                    </div>

                    <div className="flex items-center justify-center gap-3 py-4">
                      {[5, 10, 15, 20].map((num) => (
                        <button
                          key={num}
                          onClick={() => setAiQuestionCount(num)}
                          className={`h-14 w-14 rounded-2xl font-black transition-all ${aiQuestionCount === num ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-100 scale-110' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}
                        >
                          {num}
                        </button>
                      ))}
                    </div>

                    <div className="flex flex-col gap-3 pt-4">
                      <button
                        onClick={handleFinalAiGenerate}
                        className="w-full py-4 rounded-2xl bg-indigo-600 text-white font-black text-lg shadow-xl shadow-indigo-100 hover:bg-indigo-700 active:scale-95 transition-all"
                      >
                        Bắt đầu tạo ngay
                      </button>
                      <button
                        onClick={() => setIsAiProcessing(false)}
                        className="w-full py-3 rounded-2xl bg-slate-50 text-slate-400 font-black text-sm hover:bg-slate-100 transition-all"
                      >
                        Hủy bỏ
                      </button>
                    </div>
                  </React.Fragment>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// --- Component làm bài thi ---
interface ExamRunnerProps {
  exam: ExamDocument;
  onCancel: () => void;
}

const ExamRunner: React.FC<ExamRunnerProps> = ({ exam, onCancel }) => {
  const { showToast } = useToast();
  const [timeLeft, setTimeLeft] = useState(exam.durationMinutes * 60);
  const [answers, setAnswers] = useState<Record<number, string>>({}); // { questionIndex: optionKey }
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [warned, setWarned] = useState(false);

  useEffect(() => {
    if (timeLeft <= 0) {
      if (!submitted) {
        showToast({
          type: 'error',
          title: 'Hết giờ làm bài',
          message: 'Hệ thống đang tự động nộp bài và tính điểm cho bạn.',
        });
        handleSubmit();
      }
      return;
    }

    if (submitted) return;

    if (timeLeft === 30 && !warned) {
      setWarned(true);
      showToast({
        type: 'error',
        title: 'Sắp hết thời gian',
        message: 'Bạn chỉ còn 30 giây để hoàn thành bài thi!',
        duration: 5000,
      });
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft, submitted, warned, showToast]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleSelectOption = (questionIndex: number, key: string) => {
    if (submitted) return;
    setAnswers((prev) => ({ ...prev, [questionIndex]: key }));
  };

  const handleSubmit = () => {
    if (submitted) return;
    let totalScore = 0;
    exam.questions.forEach((q, idx) => {
      const correctOption = q.options.find((o) => o.isCorrect);
      if (answers[idx] === correctOption?.key) {
        totalScore += q.points;
      }
    });
    setScore(totalScore);
    setSubmitted(true);
  };

  return (
    <div className="mx-auto max-w-4xl space-y-8 pb-20">
      <div className="flex items-center justify-between gap-4 sticky top-0 bg-slate-50/80 backdrop-blur-md py-4 z-20">
        <div className="flex items-center gap-4">
          <button
            onClick={onCancel}
            className="rounded-2xl bg-white p-3 text-slate-400 shadow-md transition-colors hover:text-teal-600"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="space-y-0.5">
            <h2 className="text-xl font-black text-slate-800 truncate max-w-xs md:max-w-md">{exam.title}</h2>
            <div className="flex items-center gap-3 text-xs font-bold text-slate-400">
              <span className={`flex items-center gap-1 transition-colors ${timeLeft <= 30 && !submitted ? 'text-red-500 animate-pulse' : ''}`}>
                <Timer size={14} className={timeLeft <= 30 && !submitted ? 'text-red-500' : 'text-teal-500'} />
                {formatTime(timeLeft)}
              </span>
              <span className="flex items-center gap-1"><CheckCircle2 size={14} className="text-teal-500" /> {Object.keys(answers).length}/{exam.questions.length} câu</span>
            </div>
          </div>
        </div>

        {!submitted && (
          <button
            onClick={handleSubmit}
            className="bg-teal-600 text-white px-6 py-3 rounded-xl font-black shadow-lg shadow-teal-100 hover:bg-teal-700 transition-all active:scale-95"
          >
            Nộp bài
          </button>
        )}
      </div>

      {submitted && (
        <div className="rounded-[2.5rem] bg-teal-600 p-8 text-white shadow-2xl shadow-teal-100 animate-in zoom-in-95 duration-500">
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="h-20 w-20 rounded-full bg-white/20 flex items-center justify-center">
              <CheckCircle2 size={40} />
            </div>
            <div className="space-y-1">
              <h3 className="text-3xl font-black">Hoàn thành!</h3>
              <p className="font-bold text-teal-50/80 text-lg">Điểm số của bạn: {score.toFixed(1)} / {exam.questions.reduce((acc, q) => acc + q.points, 0).toFixed(1)}</p>
            </div>
            <button
              onClick={onCancel}
              className="bg-white text-teal-600 px-8 py-3 rounded-2xl font-black hover:bg-teal-50 transition-all active:scale-95 mt-4"
            >
              Quay lại kho đề
            </button>
          </div>
        </div>
      )}

      <div className="space-y-6">
        {exam.questions.map((q, qIdx) => (
          <div key={qIdx} className="bg-white rounded-[2rem] p-6 md:p-8 shadow-xl border border-slate-50">
            <div className="space-y-6">
              <div className="flex gap-4">
                <div className="h-10 w-10 shrink-0 bg-teal-50 text-teal-600 rounded-xl flex items-center justify-center font-black">
                  {qIdx + 1}
                </div>
                <div className="space-y-2 flex-1">
                  <p className="text-lg font-bold text-slate-800 leading-relaxed whitespace-pre-wrap">{q.text}</p>
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest">{q.points} điểm</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {q.options.map((opt) => {
                  const isSelected = answers[qIdx] === opt.key;
                  const isCorrect = opt.isCorrect;

                  let cardStyle = "border-slate-100 hover:border-teal-200 hover:bg-teal-50/30";
                  let keyStyle = "bg-slate-50 text-slate-400";

                  if (submitted) {
                    if (isCorrect) {
                      cardStyle = "border-teal-500 bg-teal-50 ring-1 ring-teal-500";
                      keyStyle = "bg-teal-600 text-white";
                    } else if (isSelected && !isCorrect) {
                      cardStyle = "border-red-500 bg-red-50 ring-1 ring-red-500";
                      keyStyle = "bg-red-600 text-white";
                    } else {
                      cardStyle = "border-slate-50 opacity-50";
                    }
                  } else if (isSelected) {
                    cardStyle = "border-teal-600 bg-teal-50 ring-1 ring-teal-600 shadow-md shadow-teal-100";
                    keyStyle = "bg-teal-600 text-white";
                  }

                  return (
                    <button
                      key={opt.key}
                      onClick={() => handleSelectOption(qIdx, opt.key)}
                      className={`flex items-center gap-4 p-4 rounded-2xl border-2 transition-all text-left group ${cardStyle}`}
                    >
                      <span className={`h-10 w-10 shrink-0 rounded-xl flex items-center justify-center font-black transition-all ${keyStyle}`}>
                        {opt.key}
                      </span>
                      <span className={`text-sm font-bold ${isSelected || (submitted && isCorrect) ? 'text-teal-900' : 'text-slate-600'}`}>
                        {opt.text}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ))}
      </div>

      {!submitted && (
        <div className="flex items-center justify-center p-8 bg-white rounded-[2rem] border border-dashed border-slate-200">
          <div className="flex flex-col items-center gap-2 text-center">
            <AlertCircle className="text-slate-300" size={32} />
            <p className="text-slate-400 font-medium">Kiểm tra kỹ các câu trả lời trước khi nộp bài!</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default OnlineExamModule;
