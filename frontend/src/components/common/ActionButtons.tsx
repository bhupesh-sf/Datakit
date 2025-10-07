import React, { useState } from 'react';
import { Book, History, ExternalLink, MessageSquare, Menu, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/Button';
import { Tooltip } from '@/components/ui/Tooltip';
import FeedbackButton from '@/components/common/FeedbackButton';
import useFeedback from '@/hooks/feedback/useFeedback';

import discord from '@/assets/discord.png';

export const DISCORD_URL = 'https://discord.gg/gZmXmhbBdP';

interface UnifiedActionButtonsProps {
  /** Context for feedback button */
  feedbackContext?: string;
  /** Custom Discord invite URL */
  discordInviteUrl?: string;
  /** Custom documentation URL */
  docsUrl?: string;
  /** Custom landing page URL */
  landingPageUrl?: string;
  /** Custom ProductHunt URL */
  productHuntUrl?: string;
  /** Show minimal version when files are loaded */
  minimal?: boolean;
}

/**
 * Action buttons with consistent styling and hierarchy
 * Docs > Discord > Feedback > ProductHunt
 */
const ActionButtons: React.FC<UnifiedActionButtonsProps> = ({
  feedbackContext,
  discordInviteUrl = DISCORD_URL,
  docsUrl = 'https://docs.datakit.page/',
  landingPageUrl = 'https://datakit.studio',
  minimal = false,
  // productHuntUrl = "https://www.producthunt.com/products/datakit",
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { t } = useTranslation();
  
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
  } = useFeedback({ context: feedbackContext });

  if (minimal) {
    // Minimal version - only essential actions when files are loaded
    return (
      <div className="flex items-center gap-1 bg-dark backdrop-blur-sm rounded-lg">
        {/* Studio Button */}
        <Tooltip placement="bottom" content={t('common.actionButtons.tooltips.datakitStudio', { defaultValue: 'DataKit Studio' })}>
          <Button
            variant="ghost"
            size="sm"
            asChild
            className="!px-2 !py-1 min-w-0 opacity-70 hover:opacity-100"
          >
            <a
              href={landingPageUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={t('common.actionButtons.dataKitStudio', { defaultValue: 'DataKit Studio' })}
            >
              <ExternalLink size={14} />
            </a>
          </Button>
        </Tooltip>

        {/* Feedback Button - Essential CTA */}
        <Tooltip placement="bottom" content={t('common.actionButtons.feedback', { defaultValue: 'Feedback' })}>
          <FeedbackButton
            context={feedbackContext}
            variant="ghost"
            size="sm"
            text=""
            className="!px-2 !py-1 min-w-0 opacity-90 hover:opacity-100 hover:scale-105 transition-all duration-200"
          />
        </Tooltip>

        <Tooltip placement="bottom" content={t('common.actionButtons.documentation', { defaultValue: 'Documentation' })}>
          <Button
            variant="ghost"
            size="sm"
            asChild
            className="!px-2 !py-1 min-w-0 opacity-70 hover:opacity-100"
          >
            <a
              href={docsUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={t('common.actionButtons.viewDocumentation', { defaultValue: 'View documentation' })}
            >
              <Book size={14} />
            </a>
          </Button>
        </Tooltip>

        <Tooltip placement="bottom" content={t('common.actionButtons.discord', { defaultValue: 'Discord' })}>
          <Button
            variant="ghost"
            size="sm"
            asChild
            className="!px-2 !py-1 min-w-0 opacity-70 hover:opacity-100"
          >
            <a
              href={discordInviteUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={t('common.actionButtons.joinDiscord', { defaultValue: 'Join our Discord' })}
            >
              <img
                src={discord}
                alt={t('common.actionButtons.discord', { defaultValue: 'Discord' })}
                className="w-4 h-4"
              />
            </a>
          </Button>
        </Tooltip>
      </div>
    );
  }

  const renderFeedbackModal = () => (
    showFeedbackModal && (
      <div className="fixed inset-0 backdrop-blur-sm bg-black/60 flex items-center justify-center z-50">
        <div className="bg-black p-4 rounded-lg shadow-lg w-96 border border-white/10">
          <h3 className="text-lg font-medium mb-4">{t('common.actionButtons.feedbackModal.title', { defaultValue: 'Share Your Feedback' })}</h3>

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
                <span>{t('common.actionButtons.feedbackModal.thankYou', { defaultValue: 'Thank you for your feedback!' })}</span>
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
                <label className="block text-sm font-medium mb-2 text-white">
                  {t('common.actionButtons.feedbackModal.emailLabel', { defaultValue: 'Email (optional)' })}
                </label>
                <input
                  type="email"
                  value={feedbackEmail}
                  onChange={(e) => setFeedbackEmail(e.target.value)}
                  placeholder={t('common.actionButtons.feedbackModal.emailPlaceholder', { defaultValue: 'your.email@example.com' })}
                  className="w-full p-2 rounded border border-white/20 bg-black/50 text-white placeholder-white/50"
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-2 text-white">
                  {t('common.actionButtons.feedbackModal.messageLabel', { defaultValue: 'Message *' })}
                </label>
                <textarea
                  value={feedbackMessage}
                  onChange={(e) => setFeedbackMessage(e.target.value)}
                  placeholder={t('common.actionButtons.feedbackModal.messagePlaceholder', { defaultValue: 'Share your thoughts, suggestions, or report issues...' })}
                  rows={4}
                  className="w-full p-2 rounded border border-white/20 bg-black/50 text-white placeholder-white/50 resize-none"
                  required
                />
              </div>
            </>
          )}

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={closeFeedbackModal}
              disabled={isSubmitting}
            >
              {feedbackSuccess ? t('common.actionButtons.feedbackModal.close', { defaultValue: 'Close' }) : t('common.actionButtons.feedbackModal.cancel', { defaultValue: 'Cancel' })}
            </Button>
            {!feedbackSuccess && (
              <Button
                variant="primary"
                size="sm"
                onClick={handleSubmitFeedback}
                disabled={isSubmitting || !feedbackMessage.trim()}
              >
                {isSubmitting ? t('common.actionButtons.feedbackModal.sending', { defaultValue: 'Sending...' }) : t('common.actionButtons.feedbackModal.sendFeedback', { defaultValue: 'Send Feedback' })}
              </Button>
            )}
          </div>
        </div>
      </div>
    )
  );

  return (
    <>
      {/* Desktop Layout */}
      <div className="hidden lg:flex items-center gap-4 backdrop-blur-sm rounded-lg">
        {/* Primary Actions - Left side */}
        <div className="flex items-center gap-2">
          {/* Studio Link */}
          <Button variant="ghost" size="sm" asChild>
            <a
              href={landingPageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center"
            >
              <ExternalLink size={14} className="text-white/80 mr-1.5" />
              <span className="text-xs bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">{t('common.actionButtons.datakitStudio', { defaultValue: 'DataKit Studio' })}</span>
            </a>
          </Button>

          {/* Feedback Button - Primary CTA */}
          <FeedbackButton
            context={feedbackContext}
            variant="primary"
            size="sm"
            text={t('common.actionButtons.feedback', { defaultValue: 'Feedback' })}
            className="font-medium text-white/90 hover:text-white hover:scale-105 transition-all duration-200 drop-shadow-sm"
          />
        </div>

        {/* Icon Actions - Right side */}
        <div className="flex items-center gap-1">
          <Tooltip placement="bottom" content={t('common.actionButtons.documentation', { defaultValue: 'Documentation' })}>
            <Button
              variant="ghost"
              size="sm"
              asChild
              className="!px-2 !py-1 min-w-0"
            >
              <a
                href={docsUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={t('common.actionButtons.viewDocumentation', { defaultValue: 'View documentation' })}
              >
                <Book size={14} />
              </a>
            </Button>
          </Tooltip>

          <Tooltip placement="bottom" content={t('common.actionButtons.discord', { defaultValue: 'Discord' })}>
            <Button
              variant="ghost"
              size="sm"
              asChild
              className="!px-2 !py-1 min-w-0"
            >
              <a
                href={discordInviteUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={t('common.actionButtons.joinDiscord', { defaultValue: 'Join our Discord' })}
              >
                <img
                  src={discord}
                  alt={t('common.actionButtons.discord', { defaultValue: 'Discord' })}
                  className="w-4 h-4"
                />
              </a>
            </Button>
          </Tooltip>

          <Tooltip placement="bottom" content={t('common.actionButtons.whatsNew', { defaultValue: 'What\'s New' })}>
            <Button
              variant="ghost"
              size="sm"
              asChild
              className="!px-2 !py-1 min-w-0"
            >
              <a
                href="https://datakit.canny.io/changelog"
                target="_blank"
                rel="noopener noreferrer"
                aria-label={t('common.actionButtons.viewChangelog', { defaultValue: 'View changelog' })}
              >
                <History size={14} />
              </a>
            </Button>
          </Tooltip>
        </div>
      </div>

      {/* Tablet Layout */}
      <div className="lg:hidden relative">
        <div className="flex items-center gap-2">
          {/* Primary Feedback Button - Always visible on tablet */}
          <FeedbackButton
            context={feedbackContext}
            variant="primary"
            size="sm"
            text={t('common.actionButtons.feedback', { defaultValue: 'Feedback' })}
            className="font-medium text-white/90 hover:text-white hover:scale-105 transition-all duration-200 drop-shadow-sm"
          />
          
          {/* Menu Toggle */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="!px-2 !py-1 min-w-0"
          >
            {isMenuOpen ? <X size={16} /> : <Menu size={16} />}
          </Button>
        </div>

        {/* Tablet Menu Dropdown */}
        {isMenuOpen && (
          <div className="absolute right-0 top-full mt-2 bg-black/95 border border-white/10 rounded-lg shadow-lg backdrop-blur-sm z-50 min-w-[200px]">
            <div className="p-2 space-y-1">
              <a
                href={landingPageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 px-3 py-2 text-sm text-white/80 hover:text-white hover:bg-white/10 rounded-md transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                <ExternalLink size={16} />
                {t('common.actionButtons.datakitStudio', { defaultValue: 'DataKit Studio' })}
              </a>
              
              <a
                href={docsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 px-3 py-2 text-sm text-white/80 hover:text-white hover:bg-white/10 rounded-md transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                <Book size={16} />
                {t('common.actionButtons.documentation', { defaultValue: 'Documentation' })}
              </a>
              
              <a
                href={discordInviteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 px-3 py-2 text-sm text-white/80 hover:text-white hover:bg-white/10 rounded-md transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                <img src={discord} alt={t('common.actionButtons.discord', { defaultValue: 'Discord' })} className="w-4 h-4" />
                {t('common.actionButtons.discord', { defaultValue: 'Discord' })}
              </a>
              
              <a
                href="https://datakit.canny.io/changelog"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 px-3 py-2 text-sm text-white/80 hover:text-white hover:bg-white/10 rounded-md transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                <History size={16} />
                {t('common.actionButtons.whatsNew', { defaultValue: 'What\'s New' })}
              </a>
            </div>
          </div>
        )}
      </div>

    </>
  );
};

export default ActionButtons;
