'use client';

import { useDroppable } from '@dnd-kit/core';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Users, ChevronDown, ChevronRight } from 'lucide-react';
import type { StageData } from '../types';
import UserCard from './UserCard';

interface StageColumnProps {
  stage: StageData;
  editMode: boolean;
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
export default function StageColumn({ stage, editMode }: StageColumnProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  // Hydration guard
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Toggle expand/collapse
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
      className={`
        ${isExpanded ? 'min-h-[500px]' : 'min-h-[auto]'} transition-all duration-200
        ${isMounted && isOver ? 'ring-2 ring-blue-500 bg-blue-50' : ''}
        ${editMode ? 'border-orange-300 bg-orange-50/30' : ''}
      `}
    >
      {/* Stage Column Header - Clickable */}
      <CardHeader 
        className={`pb-3 cursor-pointer hover:bg-gray-50 transition-colors ${!isExpanded ? 'pb-4' : ''}`}
        onClick={toggleExpanded}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
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
          
          <Badge variant="secondary" className="flex items-center gap-1">
            <Users size={14} />
            {stage.users.length}
          </Badge>
        </div>
        
        {stage.description && (
          <p className="text-sm text-gray-600 mt-1 ml-7">
            {stage.description}
          </p>
        )}
      </CardHeader>

      {/* User Card List - Only shown when expanded */}
      {isExpanded && (
        <CardContent className="space-y-3">
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