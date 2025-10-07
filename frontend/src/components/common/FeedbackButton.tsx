import { FC, useRef } from 'react';
import { createPortal } from 'react-dom';
import { MessageSquare } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/Button';

import useFeedback from '@/hooks/feedback/useFeedback';

interface FeedbackButtonProps {
  /** Context to include with feedback */
  context?: string;
  /** Custom size for the button (defaults to 'sm') */
  size?: 'sm' | 'md' | 'lg';
  /** Custom variant for the button (defaults to 'ghost') */
  variant?: 'ghost' | 'primary' | 'secondary' | 'outline';
  /** Custom button text (defaults to 'Share Feedback') */
  text?: string;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Reusable feedback button component with modal
 * Compatible with Cloudflare Workers backend
 */
const FeedbackButton: FC<FeedbackButtonProps> = ({
  context,
  size = 'sm',
  variant = 'primary',
  text,
  className = '',
}) => {
  const { t } = useTranslation();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const {
    showFeedbackModal,
    feedbackEmail,
    feedbackMessage,
    isSubmitting,
    feedbackSuccess,
    feedbackError,
    openFeedbackModal,
    closeFeedbackModal,
    setFeedbackEmail,
    setFeedbackMessage,
    handleSubmitFeedback,
  } = useFeedback({
    context
  });

  return (
    <>
      {/* Feedback Button */}
      <Button
        ref={buttonRef}
        variant={variant}
        size={size}
        onClick={openFeedbackModal}
        className={`flex items-center ${className}`}
      >
        <MessageSquare size={14} className={text ? "mr-1.5 text-white" : "text-white drop-shadow-sm"} />
        {text && <span className="text-xs">{text}</span>}
        {text === undefined && <span className="text-xs">{t('feedback.button.text')}</span>}
      </Button>

      {/* Feedback Modal - Rendered via Portal */}
      {showFeedbackModal && createPortal(
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-transparent z-40"
            onClick={closeFeedbackModal}
          />
          {/* Modal positioned relative to button */}
          <div 
            className="fixed z-50 w-80 bg-black/95 border border-white/20 rounded-lg shadow-xl backdrop-blur-sm"
            style={{
              top: buttonRef.current ? buttonRef.current.getBoundingClientRect().bottom + window.scrollY + 8 : '50vh',
              left: buttonRef.current ? Math.max(16, Math.min(window.innerWidth - 336, buttonRef.current.getBoundingClientRect().left + window.scrollX)) : '50vw',
              transform: !buttonRef.current ? 'translate(-50%, -50%)' : 'none'
            }}
          >
            <div className="p-4">
            <h3 className="text-lg font-medium mb-4">{t('feedback.modal.title')}</h3>

            {feedbackSuccess ? (
              <div className="bg-primary/10 border border-primary/30 rounded p-3 mb-4 text-white text-sm">
                <div className="flex items-center">
                  <div className="mr-2 bg-primary rounded-full p-1">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M20 6L9 17l-5-5"></path>
                    </svg>
                  </div>
                  <span>{t('feedback.modal.success')}</span>
                </div>
              </div>
            ) : (
              <>
                {feedbackError && (
                  <div className="bg-destructive/10 border border-destructive/30 rounded p-3 mb-4 text-destructive text-sm">
                    {feedbackError}
                  </div>
                )}

                <div className="mb-4">
                  <label
                    htmlFor="feedback-email"
                    className="block text-sm font-medium text-white/80 mb-1"
                  >
{t('feedback.modal.emailLabel')}
                  </label>
                  <input
                    id="feedback-email"
                    type="email"
                    value={feedbackEmail}
                    onChange={(e) => setFeedbackEmail(e.target.value)}
                    placeholder={t('feedback.modal.emailPlaceholder')}
                    className="w-full px-3 py-2 bg-background border border-white/10 rounded-md focus:outline-none focus:border-primary text-sm"
                  />
                </div>

                <div className="mb-4">
                  <label
                    htmlFor="feedback-message"
                    className="block text-sm font-medium text-white/80 mb-1"
                  >
{t('feedback.modal.messageLabel')}
                  </label>
                  <textarea
                    id="feedback-message"
                    value={feedbackMessage}
                    onChange={(e) => setFeedbackMessage(e.target.value)}
                    placeholder={t('feedback.modal.messagePlaceholder')}
                    rows={4}
                    className="w-full px-3 py-2 bg-background border border-white/10 rounded-md focus:outline-none focus:border-primary text-sm"
                  />
                </div>

                <div className="flex justify-end space-x-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={closeFeedbackModal}
                  >
{t('common.buttons.cancel')}
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleSubmitFeedback}
                    disabled={isSubmitting}
                    className="min-w-[80px]"
                  >
                    {isSubmitting ? (
                      <div className="flex items-center">
                        <svg
                          className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          ></circle>
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          ></path>
                        </svg>
                        <span>{t('feedback.modal.sending')}</span>
                      </div>
                    ) : (
                      t('common.buttons.submit')
                    )}
                  </Button>
                </div>
              </>
            )}
            </div>
          </div>
        </>,
        document.body
      )}
    </>
  );
};

export default FeedbackButton;
