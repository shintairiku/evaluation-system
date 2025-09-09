'use client';

import { useDroppable } from '@dnd-kit/core';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users } from 'lucide-react';
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
  const { isOver, setNodeRef } = useDroppable({
    id: stage.id,
  });

  return (
    <Card 
      ref={setNodeRef}
      className={`
        min-h-[500px] transition-all duration-200
        ${isOver ? 'ring-2 ring-blue-500 bg-blue-50' : ''}
        ${editMode ? 'border-orange-300 bg-orange-50/30' : ''}
      `}
    >
      {/* Stage Column Header */}
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-gray-900">
            {stage.name}
          </CardTitle>
          <Badge variant="secondary" className="flex items-center gap-1">
            <Users size={14} />
            {stage.users.length}
          </Badge>
        </div>
        {stage.description && (
          <p className="text-sm text-gray-600 mt-1">
            {stage.description}
          </p>
        )}
      </CardHeader>

      {/* User Card List */}
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
    </Card>
  );
}