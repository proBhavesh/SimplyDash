import React, { useState } from 'react';

interface TooltipProps {
  children: React.ReactNode;
  content: string;
}

export const Tooltip: React.FC<TooltipProps> = ({ children, content }) => {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div
      className="relative inline-block"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children}
      {isVisible && (
        <div className="absolute z-10 p-2 text-sm text-white bg-gray-800 rounded-md shadow-md -top-8 left-1/2 transform -translate-x-1/2">
          {content}
        </div>
      )}
    </div>
  );
};

export const TooltipProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => children;
export const TooltipTrigger: React.FC<{ children: React.ReactNode }> = ({ children }) => <>{children}</>;
export const TooltipContent: React.FC<{ children: React.ReactNode }> = ({ children }) => <>{children}</>;