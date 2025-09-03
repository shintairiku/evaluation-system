"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users } from "lucide-react";
import type { HierarchyMode } from './types';

interface HierarchyCardProps {
  mode: HierarchyMode;
  disabled?: boolean;
  children: React.ReactNode;
}

export default function HierarchyCard({ 
  mode, 
  disabled = false,
  children 
}: HierarchyCardProps) {
  if (disabled) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5" />
            階層関係
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="p-4 text-center text-sm text-muted-foreground bg-gray-50 rounded-lg border-2 border-dashed">
            役職を選択してください
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Users className="h-5 w-5" />
          階層関係
          {mode === 'setup' && (
            <Badge variant="secondary" className="text-xs ml-2">
              セットアップ
            </Badge>
          )}
          {mode === 'edit' && (
            <Badge variant="outline" className="text-xs ml-2">
              編集モード
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {children}
      </CardContent>
    </Card>
  );
}