"use client";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, Grid, Users } from "lucide-react";
import type { ViewMode } from "../hooks/useViewMode";

interface ViewModeSelectorProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
}

export default function ViewModeSelector({ viewMode, onViewModeChange }: ViewModeSelectorProps) {
  return (
    <Tabs value={viewMode} onValueChange={(value) => onViewModeChange(value as ViewMode)}>
      <TabsList className="grid w-full max-w-md grid-cols-3">
        <TabsTrigger value="table" className="flex items-center gap-2">
          <Table className="w-4 h-4" />
          テーブル
        </TabsTrigger>
        <TabsTrigger value="gallery" className="flex items-center gap-2">
          <Grid className="w-4 h-4" />
          ギャラリー
        </TabsTrigger>
        <TabsTrigger value="organization" className="flex items-center gap-2">
          <Users className="w-4 h-4" />
          組織図
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}