import React from 'react';
import discord from '@/assets/discord.png';

interface DiscordButtonProps {
  variant?: 'primary' | 'secondary';
  size?: 'sm' | 'md';
  text?: string;
  inviteUrl?: string;
}

const DiscordButton: React.FC<DiscordButtonProps> = ({ 
  size = 'sm',
  text = 'Discord',
  inviteUrl = 'https://discord.gg/grKvFZHh'
}) => {
  const baseClasses = 'inline-flex items-center gap-2 rounded font-medium transition-colors hover:text-primary';
  
  const sizeClasses = {
    sm: 'px-3 py-1 text-xs',
    md: 'px-4 py-2 text-sm'
  };

  const iconSize = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5';

  return (
    <a
      href={inviteUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={`${baseClasses} ${sizeClasses[size]}`}
      title="Join our Discord community"
    >
      <img 
        src={discord} 
        alt="Discord" 
        className={iconSize}
      />
      {text}
    </a>
  );
};

export default DiscordButton;