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

      {/* Feedback Button - Primary with text */}
      <FeedbackButton
        context={feedbackContext}
        variant="primary"
        size="sm"
        text="Share Feedback"
        className=""
      />

      {/* Discord Button - Icon only with tooltip */}
      <Tooltip placement="bottom" content="Join our Discord">
        <Button variant="ghost" size="sm" asChild className="!px-2 !py-1 min-w-0">
          <a
            href={discordInviteUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Join our Discord community"
          >
            <img src={discord} alt="Discord" className="w-4 h-4 fill-primary fitext-primary" />
          </a>
        </Button>
      </Tooltip>

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
    </div>
  );
};

export default ActionButtons;
