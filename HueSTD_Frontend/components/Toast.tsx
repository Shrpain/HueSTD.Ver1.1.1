import React, { useEffect, useState } from 'react';

export interface ToastProps {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'error' | 'warning';
  duration?: number;
  onClose: (id: string) => void;
}

const Toast: React.FC<ToastProps> = ({ id, title, message, type = 'info', duration = 5000, onClose }) => {
  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        onClose(id);
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [id, duration, onClose]);

  const typeStyles = {
    info: 'bg-blue-600 border-blue-700',
    success: 'bg-teal-600 border-teal-700',
    error: 'bg-red-600 border-red-700',
    warning: 'bg-amber-500 border-amber-600'
  };

  const typeIcons = {
    info: '🔔',
    success: '✅',
    error: '❌',
    warning: '⚠️'
  };

  return (
    <div
      className={`${typeStyles[type]} text-white px-4 py-3 rounded-lg shadow-lg border flex items-start gap-3 min-w-[300px] max-w-md animate-slide-in-right`}
      style={{ animation: 'slideInRight 0.3s ease-out' }}
    >
      <span className="text-xl flex-shrink-0">{typeIcons[type]}</span>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm">{title}</p>
        <p className="text-xs opacity-90 mt-0.5 break-words whitespace-pre-wrap">{message}</p>
      </div>
      <button
        onClick={() => onClose(id)}
        className="text-white/80 hover:text-white flex-shrink-0 transition-colors"
      >
        ✕
      </button>
    </div>
  );
};

// Toast Container
interface ToastContainerProps {
  toasts: ToastProps[];
  onClose: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onClose }) => {
  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2">
      {toasts.map((toast) => (
        <Toast key={toast.id} {...toast} onClose={onClose} />
      ))}
    </div>
  );
};

// Toast Context
interface ToastContextType {
  showToast: (toast: Omit<ToastProps, 'id' | 'onClose'>) => void;
}

export const ToastContext = React.createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = React.useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

interface ToastProviderProps {
  children: React.ReactNode;
}

export const ToastProvider: React.FC<ToastProviderProps> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastProps[]>([]);

  const showToast = (toast: Omit<ToastProps, 'id' | 'onClose'>) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { ...toast, id, onClose: removeToast }]);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <ToastContainer toasts={toasts} onClose={removeToast} />
    </ToastContext.Provider>
  );
};

// Helper function to determine toast type from notification type
export const getNotificationToastType = (notificationType: string): 'info' | 'success' | 'error' | 'warning' => {
  switch (notificationType) {
    case 'approval':
    case 'success':
      return 'success';
    case 'rejection':
    case 'deletion':
    case 'error':
      return 'error';
    case 'warning':
      return 'warning';
    default:
      return 'info';
  }
};

export default Toast;
