'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle
} from '@/components/ui/resizable';
import { cn } from '@/lib/utils';

export interface SidePanelProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  defaultWidth?: number;
  minWidth?: number;
  maxWidth?: number;
  persistWidthKey?: string;
  className?: string;
}

export function SidePanel({
  isOpen,
  onClose,
  children,
  title,
  defaultWidth = 85,
  minWidth = 30,
  maxWidth = 95,
  persistWidthKey,
  className
}: SidePanelProps) {
  const [panelWidth, setPanelWidth] = useState(defaultWidth);

  // Load saved width from localStorage
  useEffect(() => {
    if (persistWidthKey && isOpen) {
      const savedWidth = localStorage.getItem(`sidePanel_${persistWidthKey}_width`);
      if (savedWidth) {
        const width = parseInt(savedWidth, 10);
        if (width >= minWidth && width <= maxWidth) {
          setPanelWidth(width);
        }
      }
    }
  }, [persistWidthKey, isOpen, minWidth, maxWidth]);

  // Save width to localStorage
  const handleWidthChange = useCallback((sizes: number[]) => {
    const newWidth = sizes[1]; // Panel is the second element
    setPanelWidth(newWidth);

    if (persistWidthKey) {
      localStorage.setItem(`sidePanel_${persistWidthKey}_width`, newWidth.toString());
    }
  }, [persistWidthKey]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      // Prevent body scroll when panel is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/20" onClick={onClose}>
      <ResizablePanelGroup
        direction="horizontal"
        onLayout={handleWidthChange}
        className="h-full"
      >
        {/* Invisible left panel for resizing */}
        <ResizablePanel
          defaultSize={100 - panelWidth}
          minSize={100 - maxWidth}
          maxSize={100 - minWidth}
        />

        <ResizableHandle
          withHandle
          className="bg-gray-200 hover:bg-gray-300 transition-colors duration-200 w-2 z-10"
        />

        {/* Main panel content */}
        <ResizablePanel
          defaultSize={panelWidth}
          minSize={minWidth}
          maxSize={maxWidth}
          className="flex flex-col bg-white border-l shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Panel Header */}
          <div className="flex items-center justify-between p-4 border-b bg-gray-50">
            {title && (
              <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="ml-auto p-2 hover:bg-gray-200"
              aria-label="Close panel"
            >
              <X size={16} />
            </Button>
          </div>

          {/* Panel Content */}
          <div className={cn("flex-1 overflow-hidden", className)}>
            {children}
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}

export default SidePanel;