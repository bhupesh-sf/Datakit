import React from "react";
import { Book, History } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Tooltip } from "@/components/ui/Tooltip";
import FeedbackButton from "@/components/common/FeedbackButton";

import discord from "@/assets/discord.png";

export const DISCORD_URL = "https://discord.gg/gZmXmhbBdP";

interface UnifiedActionButtonsProps {
  /** Context for feedback button */
  feedbackContext?: string;
  /** Custom Discord invite URL */
  discordInviteUrl?: string;
  /** Custom documentation URL */
  docsUrl?: string;
  /** Custom ProductHunt URL */
  productHuntUrl?: string;
}

/**
 * Action buttons with consistent styling and hierarchy
 * Docs > Discord > Feedback > ProductHunt
 */
const ActionButtons: React.FC<UnifiedActionButtonsProps> = ({
  feedbackContext,
  discordInviteUrl = DISCORD_URL,
  docsUrl = "https://docs.datakit.page/"
  // productHuntUrl = "https://www.producthunt.com/products/datakit",
}) => {
  return (
    <div className="flex items-center gap-2">
      {/* Documentation Button - Primary with text */}
      <Button variant="primary" size="sm" asChild>
        <a
          href={docsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center"
        >
          <Book size={14} className="mr-1.5" />
          <span className="text-xs">Documentation</span>
        </a>
      </Button>

      {/* Discord Button - Primary with text */}
      <Button variant="primary" size="sm" asChild>
        <a
          href={discordInviteUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center"
          title="Join our Discord community"
        >
          <img src={discord} alt="Discord" className="w-4 h-4 mr-1.5" />
          <span className="text-xs">Discord</span>
        </a>
      </Button>

      {/* Feedback Button - Icon only with tooltip */}
      <FeedbackButton
        context={feedbackContext}
        variant="primary"
        size="sm"
        text=""
        className="!px-2 !py-1 min-w-0"
        iconOnly={true}
      />

      <Tooltip placement="left" content="What's new">
        <Button
          variant="link"
          size="sm"
          className="!px-2 !py-1 min-w-0"
          asChild
        >
          <a
            href="https://datakit.canny.io/changelog"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="View changelog"
          >
            <History size={14} />
          </a>
        </Button>
      </Tooltip>

      {/* ProductHunt Button - Icon only with tooltip */}
      {/* <Tooltip placement="left" content="on ProductHunt">
        <Button
          variant="link"
          size="sm"
          className="!px-2 !py-1 min-w-0"
          asChild
        >
          <a
            href={productHuntUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Support on ProductHunt"
          >
            <ProductHuntIcon size={14} />
          </a>
        </Button>
      </Tooltip> */}
    </div>
  );
};

// const ProductHuntIcon: React.FC<{ size?: number; className?: string }> = ({
//   size = 24,
//   className = "",
// }) => (
//   <svg
//     xmlns="http://www.w3.org/2000/svg"
//     width={size}
//     height={size}
//     viewBox="0 0 24 24"
//     fill="currentColor"
//     className={className}
//   >
//     <path d="M12 0C5.376 0 0 5.376 0 12s5.376 12 12 12 12-5.376 12-12S18.624 0 12 0zm0 21.6c-5.304 0-9.6-4.296-9.6-9.6s4.296-9.6 9.6-9.6 9.6 4.296 9.6 9.6-4.296 9.6-9.6 9.6zm1.2-14.4H8.4v10.8h3v-3.6h1.8c2.4 0 4.2-1.8 4.2-3.6s-1.8-3.6-4.2-3.6zm0 5.4h-1.8V9h1.8c.96 0 1.8.84 1.8 1.8s-.84 1.8-1.8 1.8z" />
//   </svg>
// );

export default ActionButtons;
