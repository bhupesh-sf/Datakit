
import React from 'react';

import { Tooltip } from '@/components/ui/Tooltip';
import { Button } from '@/components/ui/Button';

interface ProductHuntButtonProps {
  /** Custom size for the button (defaults to 'sm') */
  size?: 'sm' | 'md' | 'lg';
  /** Custom variant for the button (defaults to 'ghost') */
  variant?: 'ghost' | 'primary' | 'secondary' | 'outline';
  /** Custom button text (defaults to 'Support on ProductHunt') */
  text?: string;
  /** Additional CSS classes */
  className?: string;
  /** Whether this is being rendered in the collapsed sidebar */
  collapsed?: boolean;
}

/**
 * ProductHunt button component that links to the product's ProductHunt page
 */
const ProductHuntButton: React.FC<ProductHuntButtonProps> = ({
  size = 'sm',
  variant = 'primary',
  text = 'Support on ProductHunt',
  className = '',
  collapsed = false,
}) => {
  // The ProductHunt URL for your product
  const productHuntUrl = 'https://www.producthunt.com/products/datakit';

  // If in collapsed mode, just show the icon with a tooltip
  if (collapsed) {
    return (
      <Tooltip content="Support on ProductHunt" color="primary">
        <a
          href={productHuntUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#da552f] hover:text-white transition-custom p-2 hover:bg-[#da552f] hover:bg-opacity-30 rounded"
          aria-label="Support on ProductHunt"
        >
          <ProductHuntIcon size={16} />
        </a>
      </Tooltip>
    );
  }

  // In expanded mode, show button with text
  return (
    <Button
      variant={variant}
      size={size}
      className={`flex items-center ${className}`}
      asChild
    >
      <a
        href={productHuntUrl}
        target="_blank" 
        rel="noopener noreferrer"
        className="inline-flex items-center"
      >
        <ProductHuntIcon size={14} className="mr-1.5 text-[#da552f]" />
        <span className="text-xs">{text}</span>
      </a>
    </Button>
  );
};

// Custom ProductHunt icon component
const ProductHuntIcon: React.FC<{ size?: number, className?: string }> = ({ 
  size = 24, 
  className = '' 
}) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="currentColor"
    className={className}
  >
    <path d="M12 0C5.376 0 0 5.376 0 12s5.376 12 12 12 12-5.376 12-12S18.624 0 12 0zm0 21.6c-5.304 0-9.6-4.296-9.6-9.6s4.296-9.6 9.6-9.6 9.6 4.296 9.6 9.6-4.296 9.6-9.6 9.6zm1.2-14.4H8.4v10.8h3v-3.6h1.8c2.4 0 4.2-1.8 4.2-3.6s-1.8-3.6-4.2-3.6zm0 5.4h-1.8V9h1.8c.96 0 1.8.84 1.8 1.8s-.84 1.8-1.8 1.8z" />
  </svg>
);

export default ProductHuntButton;