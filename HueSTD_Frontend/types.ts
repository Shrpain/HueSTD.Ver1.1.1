export enum AppTab {
  DASHBOARD = 'dashboard',
  DOCUMENTS = 'documents',
  ADMIN = 'admin',
  PROFILE = 'profile',
  NOTIFICATIONS = 'notifications'
}

export enum DocumentType {
  EXAM = 'Đề thi',
  OUTLINE = 'Đề cương',
  REFERENCE = 'Tài liệu tham khảo',
  LECTURE = 'Bài giảng',
  ANSWER = 'Đáp án'
}

// ===== User Types =====
export interface User {
  id: string;
  name: string;
  email: string;
  school: string;
  major: string;
  avatar: string;
  points: number;
  role?: UserRole;
  rank?: number;
  badge?: string;
  totalDocuments?: number;
  totalDownloads?: number;
  averageRating?: number;
}

export enum UserRole {
  USER = 'user',
  MODERATOR = 'moderator',
  ADMIN = 'admin'
}

// Backend User response (PascalCase)
export interface UserApiResponse {
  Id: string;
  Email: string;
  FullName?: string;
  Role?: string;
  School?: string;
  Major?: string;
  AvatarUrl?: string;
  Points?: number;
  Rank?: number;
  Badge?: string;
  PublicId?: string;
  TotalDocuments?: number;
  TotalDownloads?: number;
  AverageRating?: number;
  CreatedAt?: string;
}

// ===== Document Types =====
export interface Document {
  id: string;
  title: string;
  school: string;
  subject: string;
  type: string;
  year: string;
  uploader?: string;
  uploaderId?: string;
  uploaderPublicId?: string;
  uploaderAvatar?: string;
  createdAt: string;
  views: number;
  downloads: number;
  status?: string;
  description?: string;
  fileUrl?: string;
}

// Backend Document API response (camelCase from API)
export interface DocumentApiResponse {
  id: string;
  title: string;
  description?: string;
  fileUrl: string;
  uploaderId: string;
  uploaderName: string;
  uploaderPublicId?: string;
  uploaderAvatar?: string;
  school?: string;
  subject?: string;
  type?: string;
  year?: string;
  views: number;
  downloads: number;
  createdAt: string;
}

// Helper function to normalize API response to frontend type
export const normalizeDocument = (doc: DocumentApiResponse): Document => ({
  id: doc.id,
  title: doc.title || 'Không có tiêu đề',
  school: doc.school || 'Chưa rõ',
  subject: doc.subject || 'Không xác định',
  type: doc.type || 'Tài liệu tham khảo',
  year: doc.year || '',
  uploader: doc.uploaderName,
  uploaderId: doc.uploaderId,
  uploaderPublicId: doc.uploaderPublicId,
  uploaderAvatar: doc.uploaderAvatar,
  createdAt: doc.createdAt,
  views: doc.views,
  downloads: doc.downloads,
  status: 'active',
  description: doc.description,
  fileUrl: doc.fileUrl,
});

// ===== Notification Types =====
export interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
  referenceId?: string;
}
