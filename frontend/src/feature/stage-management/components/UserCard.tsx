'use client';

import { useDraggable } from '@dnd-kit/core';
import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Mail, GripVertical } from 'lucide-react';
import type { UserCardData } from '../types';

interface UserCardProps {
  user: UserCardData;
  isDragOverlay?: boolean;
}

/**
 * User Card Component (Draggable)
 * 
 * Implements the draggable UserCard specified in .kiro design.md:
 * UserCard (ドラッグ可能)
 * 
 * Displays user information as specified in the interface:
 * - name, employee_code, job_title, email
 */
export default function UserCard({ user, isDragOverlay = false }: UserCardProps) {
  const [isMounted, setIsMounted] = useState(false);

  // Hydration guard
  useEffect(() => {
    setIsMounted(true);
  }, []);

  const draggableConfig = isMounted ? {
    id: user.id,
    data: {
      user,
      stageId: user.current_stage_id,
    },
  } : { id: user.id, disabled: true };

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable(draggableConfig);

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : undefined;

  // Get user initials for avatar
  const initials = user.name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={`
        ${isMounted ? 'cursor-grab' : 'cursor-default'} transition-all duration-200
        ${isDragging ? 'opacity-50 rotate-3 scale-105' : ''}
        ${isDragOverlay ? 'rotate-3 scale-105 shadow-xl' : 'hover:shadow-md hover:scale-[1.02]'}
        ${isMounted ? 'active:cursor-grabbing' : ''}
      `}
      {...(isMounted ? listeners : {})}
      {...(isMounted ? attributes : {})}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {/* User Avatar */}
          <Avatar className="h-10 w-10">
            <AvatarFallback className="bg-blue-100 text-blue-700 font-medium">
              {initials}
            </AvatarFallback>
          </Avatar>

          {/* User Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-medium text-gray-900 truncate">
                {user.name}
              </h4>
              <GripVertical size={14} className="text-gray-400 opacity-60" />
            </div>
            
            <div className="space-y-1">
              <Badge variant="outline" className="text-xs">
                {user.employee_code}
              </Badge>
              
              {user.job_title && (
                <p className="text-sm text-gray-600 truncate">
                  {user.job_title}
                </p>
              )}
              
              <div className="flex items-center gap-1 text-xs text-gray-500">
                <Mail size={12} />
                <span className="truncate">{user.email}</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}