
import axios from 'axios';
import { supabase } from './supabase';

// Expect VITE_API_BASE_URL already includes path prefix when needed.
// Examples:
// - Local/preview with proxy: VITE_API_BASE_URL=/api
// - Direct backend: VITE_API_BASE_URL=http://localhost:5136/api
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '';

const api = axios.create({
  baseURL: apiBaseUrl,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add a request interceptor (Handles cleanup and FormData)
api.interceptors.request.use(
  (config) => {
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];
    }
    return config;
  },
  (error) => Promise.reject(error)
);

let isExpiredToastShowing = false;

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const message = error?.response?.data?.message || error?.response?.data?.error || '';
    const config = error?.config;

    // Tránh hiện thông báo nếu:
    // 1. Đã đang hiện một cái rồi
    // 2. Lỗi xảy ra khi app đang thử check trạng thái đăng nhập lúc khởi tạo (Auth/me, Profile/me)
    const isInitialAuthCheck = config?.url?.includes('/Auth/me') || config?.url?.includes('/Profile/me');

    if ((status === 401 || (status === 403 && String(message).toLowerCase().includes('jwt'))) && !isInitialAuthCheck) {
      // Clear local state
      localStorage.removeItem('user');

      if (!isExpiredToastShowing) {
        isExpiredToastShowing = true;
        window.dispatchEvent(new CustomEvent('auth-toast', {
          detail: {
            type: 'error',
            title: 'Phiên đăng nhập đã hết hạn',
            message: 'Vui lòng đăng nhập lại để tiếp tục.',
          },
        }));

        // Reset flag after 3 seconds to allow future valid notifications
        setTimeout(() => {
          isExpiredToastShowing = false;
        }, 3000);
      }

      window.dispatchEvent(new Event('auth-session-expired'));
    }

    return Promise.reject(error);
  }
);

// ===== Notification API =====
export const broadcastNotification = async (title: string, message: string, type: string = 'system') => {
  const response = await api.post('/Notification/broadcast', { title, message, type });
  return response.data;
};

// Upload file qua backend (backend dùng Supabase service role, tránh RLS).
// Dùng chung instance api để token luôn được gửi kèm.
export const uploadDocumentFile = async (file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  const response = await api.post<{ fileUrl: string; fileName: string }>('/documents/upload-file', formData);
  return response.data;
};

/**
 * Downloads a file directly to the user's computer.
 * Fetches the URL as a blob to bypass the browser's default behavior of opening files (like PDFs) in a new tab.
 */
export const downloadFile = async (url: string, fileName: string) => {
  try {
    const response = await axios({
      url,
      method: 'GET',
      responseType: 'blob',
    });

    // Create a temporary link element to trigger the download
    const blob = new Blob([response.data]);
    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();

    // Cleanup
    if (link.parentNode) {
      link.parentNode.removeChild(link);
    }
    window.URL.revokeObjectURL(blobUrl);
  } catch (error) {
    console.error('[API] Download failed:', error);
    // Fallback: try opening in new tab if blob download fails
    window.open(url, '_blank');
  }
};

export default api;
