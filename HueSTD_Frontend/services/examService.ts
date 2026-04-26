import api from './api';

export interface ExamOption {
  id?: string;
  key: string; // A, B, C, D
  text: string;
  isCorrect: boolean;
}

export interface ExamQuestion {
  id?: string;
  text: string;
  points: number;
  options: ExamOption[];
  sourceRefs?: string;
}

export interface ExamDocument {
  id?: string;
  title: string;
  description?: string;
  durationMinutes: number;
  sourceDocumentIds: string[];
  questions: ExamQuestion[];
  status?: 'draft' | 'ready' | 'published';
  createdAt?: string;
}

export interface ExamSource {
  id: string;
  title: string;
  type: string;
  subject: string;
}

export const examService = {
  getSources: async (search?: string): Promise<ExamSource[]> => {
    const response = await api.get('/Exam/sources', { params: { search } });
    return response.data;
  },

  getUserDocuments: async (): Promise<any[]> => {
    const response = await api.get('/documents');
    return response.data || [];
  },

  createManualExam: async (payload: ExamDocument): Promise<ExamDocument> => {
    // Mặc định luôn là 'draft' vì chỉ lưu vào kho cá nhân
    const response = await api.post('/Exam/manual', { ...payload, status: 'draft' });
    return response.data;
  },

  getMyExams: async (): Promise<ExamDocument[]> => {
    const response = await api.get('/Exam/my-exams');
    return response.data;
  },

  updateManualExam: async (id: string, payload: ExamDocument): Promise<ExamDocument> => {
    const response = await api.put(`/Exam/${id}`, payload);
    return response.data;
  },

  deleteExam: async (id: string): Promise<void> => {
    await api.delete(`/Exam/${id}`);
  },

  getExam: async (id: string): Promise<ExamDocument> => {
    const response = await api.get(`/Exam/${id}`);
    return response.data;
  }
};

export default examService;
