import React, { useState } from 'react';
import { X, Eye, EyeOff, User, Mail, Lock, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/hooks/auth/useAuth';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultMode?: 'login' | 'signup';
}

const AuthModal: React.FC<AuthModalProps> = ({ 
  isOpen, 
  onClose, 
  defaultMode = 'login' 
}) => {
  const [mode, setMode] = useState<'login' | 'signup'>(defaultMode);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
  });

  const { login, signup, isLoading, error, clearError } = useAuth();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (error) clearError();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (mode === 'login') {
        await login({
          email: formData.email,
          password: formData.password,
        });
      } else {
        await signup({
          email: formData.email,
          password: formData.password,
          name: formData.name,
        });
      }
      onClose();
    } catch (error) {
      // Error is handled by the auth store
    }
  };

  const toggleMode = () => {
    setMode(mode === 'login' ? 'signup' : 'login');
    clearError();
    setFormData({ email: '', password: '', name: '' });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ 
              type: "spring",
              stiffness: 300,
              damping: 30,
              duration: 0.3 
            }}
            className="bg-black backdrop-blur-xl border border-white/20 rounded-lg shadow-2xl w-full max-w-md relative"
            onClick={(e) => e.stopPropagation()}
          >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <h2 className="text-lg font-medium text-white">
            {mode === 'login' ? 'Sign In to DataKit' : 'Create DataKit Account'}
          </h2>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name field - only for signup */}
            {mode === 'signup' && (
              <div>
                <label className="block text-sm font-medium text-white/90 mb-2">
                  Full Name
                </label>
                <div className="relative">
                  <User size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/50" />
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    className="w-full pl-10 pr-4 py-2 bg-background/20 border border-white/20 rounded-md text-white placeholder-white/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                    placeholder="Enter your full name"
                    required
                  />
                </div>
              </div>
            )}

            {/* Email field */}
            <div>
              <label className="block text-sm font-medium text-white/90 mb-2">
                Email Address
              </label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/50" />
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className="w-full pl-10 pr-4 py-2 bg-background/20 border border-white/20 rounded-md text-white placeholder-white/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  placeholder="Enter your email"
                  required
                />
              </div>
            </div>

            {/* Password field */}
            <div>
              <label className="block text-sm font-medium text-white/90 mb-2">
                Password
              </label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/50" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  className="w-full pl-10 pr-10 py-2 bg-background/20 border border-white/20 rounded-md text-white placeholder-white/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  placeholder="Enter your password"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-white/50 hover:text-white/70 transition-colors"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Error message */}
            {error && (
              <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                <AlertCircle size={16} className="text-destructive flex-shrink-0" />
                <span className="text-sm text-destructive">{error}</span>
              </div>
            )}

            {/* Submit button */}
            <Button
              variant="outline"
              type="submit"
              className="w-full"
              disabled={isLoading}
            >
              {isLoading 
                ? (mode === 'login' ? 'Signing In...' : 'Creating Account...') 
                : (mode === 'login' ? 'Sign In' : 'Create Account')
              }
            </Button>
          </form>

          {/* Mode toggle */}
          <div className="mt-6 text-center">
            <span className="text-sm text-white/70">
              {mode === 'login' ? "Don't have an account? " : "Already have an account? "}
            </span>
            <button
              onClick={toggleMode}
              className="text-sm text-primary hover:text-primary-foreground transition-colors font-medium"
            >
              {mode === 'login' ? 'Sign up' : 'Sign in'}
            </button>
          </div>

          {/* Benefits section for signup */}
          {mode === 'signup' && (
            <div className="mt-6 p-4 bg-background/10 rounded-md border border-white/5">
              <h3 className="text-sm font-medium text-white/90 mb-2">
                Why create a DataKit account?
              </h3>
              <ul className="text-xs text-white/70 space-y-1">
                <li>• Access to DataKit AI models with built-in credits</li>
                <li>• Sync your settings across devices</li>
                <li>• Priority support and new features</li>
                <li>• Usage analytics and insights</li>
              </ul>
            </div>
          )}
        </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default AuthModal;