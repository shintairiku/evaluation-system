"use client";

import { useState } from 'react';

export type ViewMode = 'table' | 'gallery' | 'organization';

export function useViewMode(defaultMode: ViewMode = 'table') {
  const [viewMode, setViewMode] = useState<ViewMode>(defaultMode);

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
  };

  return {
    viewMode,
    setViewMode: handleViewModeChange,
  };
}