'use client';

import { useDroppable } from '@dnd-kit/core';
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Users, ChevronDown, ChevronRight, Settings } from 'lucide-react';

import type { StageData } from '../types';
import { useHydration } from '../hooks/useHydration';
import { getStageCardClasses, getCardHeaderClasses } from '../utils/classNames';
import { SCROLL_CONFIG, DESCRIPTION_SCROLL } from '../constants';
import UserCard from './UserCard';

interface StageColumnProps {
  /** Stage data including users and metadata */
  stage: StageData;
  /** Whether the component is in edit mode for drag & drop */
  editMode: boolean;
  /** Callback when stage edit is requested */
  onEditStage?: (stage: StageData) => void;
}

/**
 * Stage Column Component (Droppable)
 * 
 * Implements the StageColumn specified in .kiro design.md component hierarchy:
 * StageColumn (各ステージ)
 * ├── StageColumnHeader  
 * └── UserCardList
 *     └── UserCard (ドラッグ可能)
 */
export default function StageColumn({ stage, editMode, onEditStage }: StageColumnProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const isMounted = useHydration();

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  const droppableConfig = isMounted ? {
    id: stage.id,
  } : { id: stage.id, disabled: true };

  const { isOver, setNodeRef } = useDroppable(droppableConfig);

  return (
    <Card 
      ref={setNodeRef}
      className={getStageCardClasses(isExpanded, isMounted, isOver, editMode)}
    >
      {/* Stage Column Header - Clickable */}
      <CardHeader 
        className={getCardHeaderClasses(isExpanded)}
        onClick={toggleExpanded}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-2">
            {/* Expand/Collapse Icon */}
            <Button
              variant="ghost"
              size="sm"
              className="p-1 h-auto"
              onClick={(e) => {
                e.stopPropagation();
                toggleExpanded();
              }}
            >
              {isExpanded ? (
                <ChevronDown size={16} />
              ) : (
                <ChevronRight size={16} />
              )}
            </Button>
            
            <CardTitle className="text-lg font-semibold text-gray-900">
              {stage.name}
            </CardTitle>
          </div>
          
          <div className="flex items-center gap-2 self-start">
            <Badge variant="secondary" className="flex items-center gap-1">
              <Users size={14} />
              {stage.users.length}
            </Badge>
            
            {/* Settings Icon */}
            {onEditStage && (
              <Button
                variant="ghost"
                size="sm"
                className="p-1 h-auto opacity-60 hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation();
                  onEditStage(stage);
                }}
                title="ステージを編集"
              >
                <Settings size={14} />
              </Button>
            )}
          </div>
        </div>
        
        {stage.description && (
          <p className={`text-sm text-gray-600 mt-1 ml-7 ${DESCRIPTION_SCROLL.MAX_HEIGHT} ${DESCRIPTION_SCROLL.OVERFLOW}`}>
            {stage.description}
          </p>
        )}
      </CardHeader>

      {/* User Card List - Only shown when expanded */}
      {isExpanded && (
        <CardContent className={`space-y-3 ${SCROLL_CONFIG.MAX_HEIGHT} ${SCROLL_CONFIG.OVERFLOW} ${SCROLL_CONFIG.PADDING}`}>
          {stage.users.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-gray-400">
              <Users size={24} className="mb-2" />
              <p className="text-sm">ユーザーなし</p>
              {editMode && (
                <p className="text-xs mt-1">
                  ここにドラッグして移動
                </p>
              )}
            </div>
          ) : (
            stage.users.map(user => (
              <UserCard 
                key={user.id} 
                user={user}
              />
            ))
          )}
        </CardContent>
      )}
    </Card>
  );
}