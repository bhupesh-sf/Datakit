import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { X, Mail, MessageSquare, Check } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface SidebarFeedbackButtonProps {
  context?: string;
  className?: string;
}

/**
 * Sidebar-specific feedback button with centered modal
 */
const SidebarFeedbackButton: React.FC<SidebarFeedbackButtonProps> = ({
  className = '',
}) => {
  const { t } = useTranslation();
  const [showModal, setShowModal] = useState(false);
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async () => {
    if (!message.trim()) return;
    
    setIsSubmitting(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      setSuccess(true);
      setTimeout(() => {
        setShowModal(false);
        setSuccess(false);
        setMessage('');
        setEmail('');
      }, 2000);
    } catch (err) {
      console.error('Failed to send feedback:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className={`flex items-center gap-2.5 px-2 py-1.5 text-xs text-white/70 hover:text-white/90 hover:bg-white/5 rounded transition-all duration-200 group w-full text-left ${className}`}
      >
        <svg className="h-3.5 w-3.5 text-white/50 group-hover:text-white/70 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
        <span className="font-medium">Send Feedback</span>
      </button>

      {/* Feedback Modal - Styled like AuthModal without animations */}
      {showModal && createPortal(
        <div 
          className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setShowModal(false)}
        >
          <div 
            className="bg-black backdrop-blur-xl border border-white/20 rounded-lg shadow-2xl w-full max-w-md relative max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-white/10">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-medium text-white">
                  {t('feedback.modal.title', { defaultValue: 'Share Your Feedback' })}
                </h2>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-white/70 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div className="p-6">
              {success ? (
                <div className="text-center py-8">
                  <div className="flex items-center justify-center mb-4">
                    <div className="bg-green-500 rounded-full p-3">
                      <Check size={24} className="text-white" />
                    </div>
                  </div>
                  <h3 className="text-lg font-medium text-white mb-2">
                    {t('feedback.modal.success', { defaultValue: 'Thank you for your feedback!' })}
                  </h3>
                  <p className="text-white/70 text-sm">
                    We appreciate you taking the time to help us improve DataKit.
                  </p>
                </div>
              ) : (
                <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} className="space-y-4">
                  {/* Email field */}
                  <div>
                    <label className="block text-sm font-medium text-white/90 mb-2">
                      {t('feedback.modal.emailLabel', { defaultValue: 'Email (optional)' })}
                    </label>
                    <div className="relative">
                      <Mail
                        size={16}
                        className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/50"
                      />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-background/20 border border-white/20 rounded-md text-white placeholder-white/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
                        placeholder={t('feedback.modal.emailPlaceholder', { defaultValue: 'your.email@example.com' })}
                      />
                    </div>
                  </div>

                  {/* Message field */}
                  <div>
                    <label className="block text-sm font-medium text-white/90 mb-2">
                      {t('feedback.modal.messageLabel', { defaultValue: 'Message *' })}
                    </label>
                    <div className="relative">
                      <MessageSquare
                        size={16}
                        className="absolute left-3 top-3 text-white/50"
                      />
                      <textarea
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        rows={4}
                        className="w-full pl-10 pr-4 py-3 bg-background/20 border border-white/20 rounded-md text-white placeholder-white/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors resize-none"
                        placeholder={t('feedback.modal.messagePlaceholder', { defaultValue: 'Share your thoughts, suggestions, or report issues...' })}
                        required
                      />
                    </div>
                  </div>

                  {/* Submit button */}
                  <Button
                    variant="outline"
                    type="submit"
                    className="w-full py-3"
                    disabled={isSubmitting || !message.trim()}
                  >
                    {isSubmitting ? (
                      <div className="flex items-center gap-2">
                        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        <span>Sending...</span>
                      </div>
                    ) : (
                      t('common.buttons.submit', { defaultValue: 'Submit' })
                    )}
                  </Button>
                </form>
              )}

              {/* Footer note */}
              {!success && (
                <div className="mt-6 p-4 bg-gradient-to-r from-primary/10 to-secondary/10 rounded-md border border-primary/20">
                  <p className="text-xs text-white/70 text-center">
                    Your feedback helps us improve DataKit for everyone. We read every message and appreciate your input.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

export default SidebarFeedbackButton;