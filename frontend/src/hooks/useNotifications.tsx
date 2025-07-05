import React, { createContext, useContext, useState, useCallback } from 'react';
import SuccessSnackbar from '@/components/common/SuccessSnackbar';

interface Notification {
  id: string;
  title: string;
  message: string;
  icon?: 'check' | 'user' | 'shield';
  duration?: number;
}

interface NotificationContextType {
  showSuccess: (title: string, message: string, options?: Partial<Notification>) => void;
  removeNotification: (id: string) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const showSuccess = useCallback((
    title: string, 
    message: string, 
    options: Partial<Notification> = {}
  ) => {
    const id = Math.random().toString(36).substr(2, 9);
    const notification: Notification = {
      id,
      title,
      message,
      icon: options.icon || 'check',
      duration: options.duration || 5000,
    };

    setNotifications(prev => [...prev, notification]);
  }, []);

  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(notification => notification.id !== id));
  }, []);

  return (
    <NotificationContext.Provider value={{ showSuccess, removeNotification }}>
      {children}
      
      {/* Render notifications */}
      {notifications.map((notification, index) => (
        <div
          key={notification.id}
          style={{ 
            position: 'fixed',
            top: `${1 + index * 6}rem`, // Stack notifications vertically
            right: '1rem',
            zIndex: 50 + index // Ensure proper stacking
          }}
        >
          <SuccessSnackbar
            isVisible={true}
            onClose={() => removeNotification(notification.id)}
            title={notification.title}
            message={notification.message}
            icon={notification.icon}
            duration={notification.duration}
          />
        </div>
      ))}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};