import React from "react";

interface JSONIconProps {
  size?: number;
  className?: string;
}

export const JSONIcon: React.FC<JSONIconProps> = ({ 
  size = 16, 
  className = "" 
}) => {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path 
        d="M5 3C3.89543 3 3 3.89543 3 5V19C3 20.1046 3.89543 21 5 21H19C20.1046 21 21 20.1046 21 19V5C21 3.89543 20.1046 3 19 3H5Z" 
        stroke="currentColor" 
        strokeWidth="2" 
        strokeLinecap="round" 
        strokeLinejoin="round"
      />
      <path 
        d="M8 11.5C8 12.8807 7.32843 14 6.5 14C5.67157 14 5 12.8807 5 11.5C5 10.1193 5.67157 9 6.5 9C7.32843 9 8 10.1193 8 11.5Z" 
        stroke="currentColor" 
        strokeWidth="2" 
        strokeLinecap="round" 
        strokeLinejoin="round"
      />
      <path 
        d="M19 11.5C19 12.8807 18.3284 14 17.5 14C16.6716 14 16 12.8807 16 11.5C16 10.1193 16.6716 9 17.5 9C18.3284 9 19 10.1193 19 11.5Z" 
        stroke="currentColor" 
        strokeWidth="2" 
        strokeLinecap="round" 
        strokeLinejoin="round"
      />
      <path 
        d="M12 16L12 8" 
        stroke="currentColor" 
        strokeWidth="2" 
        strokeLinecap="round" 
        strokeLinejoin="round"
      />
    </svg>
  );
};