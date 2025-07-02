import React, { useState, useRef, useEffect } from 'react';
import { User, Settings, LogOut, CreditCard, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/hooks/auth/useAuth';
import AuthModal from './AuthModal';

interface UserMenuProps {
  variant?: 'sidebar' | 'header';
  className?: string;
}

const UserMenu: React.FC<UserMenuProps> = ({ 
  variant = 'header',
  className = '' 
}) => {
  const { user, isAuthenticated, logout } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await logout();
    setShowDropdown(false);
  };

  const goToSettings = () => {
    setShowDropdown(false);
    // Navigate to settings page
    window.location.href = '/settings';
  };

  if (!isAuthenticated) {
    return (
      <>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowAuthModal(true)}
          className={`w-full border border-white/30 ${className}`}
        >
          <User size={14} className="mr-0.5" />
          <span className="text-xs">Sign In</span>
        </Button>
        
        <AuthModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          defaultMode="login"
        />
      </>
    );
  }

  // Get user initials for avatar fallback
  const initials = user?.name
    ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : user?.email[0].toUpperCase() || '?';

  if (variant === 'sidebar') {
    return (
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          className={`w-full flex items-center gap-2 py-2 px-1 rounded text-white/80 hover:text-white hover:bg-white/5 transition-colors ${className}`}
        >
          {/* Avatar */}
          <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center text-xs font-medium text-white">
            {user?.avatarUrl ? (
              <img 
                src={user.avatarUrl} 
                alt={user.name || user.email}
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              initials
            )}
          </div>
          
          <div className="flex-1 text-left min-w-0">
            <div className="text-sm font-medium truncate">
              {user?.name || 'User'}
            </div>
            <div className="text-xs text-white/60 truncate">
              {user?.email}
            </div>
          </div>
          
          <ChevronDown 
            size={14} 
            className={`transition-transform ${showDropdown ? 'rotate-180' : ''}`}
          />
        </button>

        {/* Dropdown Menu with Animation */}
        <AnimatePresence>
          {showDropdown && (
            <>
              {/* Transparent Backdrop - Only covers sidebar */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="fixed left-0 top-0 bottom-0 w-64 bg-black/30 backdrop-blur-sm z-40"
                onClick={() => setShowDropdown(false)}
              />
              
              {/* Dropdown */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                transition={{ 
                  type: "spring",
                  stiffness: 300,
                  damping: 30,
                  duration: 0.2 
                }}
                className="absolute bottom-full left-0 mb-2 w-full bg-black/90 backdrop-blur-xl border border-white/20 rounded-lg shadow-2xl py-1 z-50"
              >
                <motion.button
                  whileHover={{ backgroundColor: 'rgba(255, 255, 255, 0.1)' }}
                  whileTap={{ scale: 0.98 }}
                  onClick={goToSettings}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-white/80 hover:text-white transition-colors cursor-pointer"
                >
                  <Settings size={14} />
                  Settings
                </motion.button>
                
                <hr className="border-white/10 my-1" />
                
                <motion.button
                  whileHover={{ backgroundColor: 'rgba(255, 255, 255, 0.1)' }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-white/80 hover:text-white transition-colors cursor-pointer"
                >
                  <LogOut size={14} />
                  Sign Out
                </motion.button>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // Header variant
  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className={`flex items-center gap-2 p-2 rounded text-white/80 hover:text-white hover:bg-white/5 transition-colors ${className}`}
      >
        {/* Avatar */}
        <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center text-xs font-medium text-white">
          {user?.avatarUrl ? (
            <img 
              src={user.avatarUrl} 
              alt={user.name || user.email}
              className="w-full h-full rounded-full object-cover"
            />
          ) : (
            initials
          )}
        </div>
        
        <ChevronDown 
          size={14} 
          className={`transition-transform ${showDropdown ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown Menu with Animation */}
      <AnimatePresence>
        {showDropdown && (
          <>
            {/* Transparent Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
              onClick={() => setShowDropdown(false)}
            />
            
            {/* Dropdown */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -10 }}
              transition={{ 
                type: "spring",
                stiffness: 300,
                damping: 30,
                duration: 0.2 
              }}
              className="absolute right-0 top-full mt-2 w-48 bg-darkNav/90 backdrop-blur-xl border border-white/20 rounded-lg shadow-2xl py-1 z-50"
            >
              <div className="px-3 py-2 border-b border-white/10">
                <div className="text-sm font-medium text-white">
                  {user?.name || 'User'}
                </div>
                <div className="text-xs text-white/60">
                  {user?.email}
                </div>
              </div>
              
              <motion.button
                whileHover={{ backgroundColor: 'rgba(255, 255, 255, 0.1)' }}
                whileTap={{ scale: 0.98 }}
                onClick={goToSettings}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-white/80 hover:text-white transition-colors"
              >
                <Settings size={14} />
                Settings
              </motion.button>
              
              <motion.button
                whileHover={{ backgroundColor: 'rgba(255, 255, 255, 0.1)' }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  setShowDropdown(false);
                  // Open billing portal or subscription management
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-white/80 hover:text-white transition-colors"
              >
                <CreditCard size={14} />
                Billing
              </motion.button>
              
              <hr className="border-white/10 my-1" />
              
              <motion.button
                whileHover={{ backgroundColor: 'rgba(255, 255, 255, 0.1)' }}
                whileTap={{ scale: 0.98 }}
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-white/80 hover:text-white transition-colors"
              >
                <LogOut size={14} />
                Sign Out
              </motion.button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default UserMenu;