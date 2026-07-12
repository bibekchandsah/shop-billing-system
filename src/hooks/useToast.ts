import { useState, useCallback } from 'react';
import type { ToastMessage } from '../components/ToastContainer';

export const useToast = () => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback((type: 'success' | 'error' | 'info' | 'warning', message: React.ReactNode, duration?: number) => {
    const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    const newToast: ToastMessage = { id, type, message, duration };
    
    setToasts((prev) => [...prev, newToast]);
    return id; // Return the generated ID so caller can manually remove it if needed!
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const showSuccess = useCallback((message: React.ReactNode) => {
    showToast('success', message);
  }, [showToast]);

  const showError = useCallback((message: React.ReactNode) => {
    showToast('error', message);
  }, [showToast]);

  const showInfo = useCallback((message: React.ReactNode) => {
    showToast('info', message);
  }, [showToast]);

  const showWarning = useCallback((message: React.ReactNode) => {
    showToast('warning', message);
  }, [showToast]);

  return {
    toasts,
    showToast,
    showSuccess,
    showError,
    showInfo,
    showWarning,
    removeToast,
  };
};
