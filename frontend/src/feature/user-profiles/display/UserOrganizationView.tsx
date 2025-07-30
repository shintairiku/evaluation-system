"use client";

import { useMemo } from 'react';
import type { UserDetailResponse } from '@/api/types';
import { AlertCircle, Users, ChevronRight, ChevronDown } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

interface UserOrganizationViewProps {
  users: UserDetailResponse[];
  onUserUpdate?: (user: UserDetailResponse) => void;
}

export default function UserOrganizationView({ users }: UserOrganizationViewProps) {
  // Build hierarchy from the users prop directly
  const hierarchy = useMemo(() => {
    return buildHierarchyFromUsers(users);
  }, [users]);

  if (hierarchy.length === 0) {
    return (
      <div className="h-[600px] w-full border rounded-lg flex items-center justify-center">
        <div className="text-center">
          <Users className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold text-muted-foreground">組織図データがありません</h3>
          <p className="text-sm text-muted-foreground mt-2">
            ユーザー間の上司-部下関係が設定されていません。
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[600px] w-full border rounded-lg p-4 overflow-auto">
      <div className="space-y-4">
        <div className="text-sm text-muted-foreground">
          組織図 ({users.length}件のユーザー)
        </div>
        <HierarchyTree users={hierarchy} />
      </div>
    </div>
  );
}

// Component to render hierarchy tree
function HierarchyTree({ users }: { users: UserDetailResponse[] }) {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  const toggleNode = (userId: string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(userId)) {
      newExpanded.delete(userId);
    } else {
      newExpanded.add(userId);
    }
    setExpandedNodes(newExpanded);
  };

  const renderUserNode = (user: UserDetailResponse, level: number = 0) => {
    const hasSubordinates = user.subordinates && user.subordinates.length > 0;
    const isExpanded = expandedNodes.has(user.id);

    return (
      <div key={user.id} className="space-y-2">
        <div 
          className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors"
          style={{ marginLeft: `${level * 20}px` }}
        >
          {hasSubordinates && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => toggleNode(user.id)}
              className="h-6 w-6 p-0"
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
          )}
          
          <Avatar className="h-8 w-8">
            <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
          </Avatar>
          
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-sm truncate">{user.name}</h4>
            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
          </div>
          
          <div className="flex flex-wrap gap-1">
            {user.department && (
              <Badge variant="secondary" className="text-xs">
                {user.department.name}
              </Badge>
            )}
            {user.stage && (
              <Badge variant="outline" className="text-xs">
                {user.stage.name}
              </Badge>
            )}
          </div>
        </div>
        
        {hasSubordinates && isExpanded && (
          <div className="space-y-2">
            {user.subordinates!.map(subordinate => 
              renderUserNode(subordinate, level + 1)
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-2">
      {users.map(user => renderUserNode(user))}
    </div>
  );
}

// Function to build hierarchy from users data
function buildHierarchyFromUsers(users: UserDetailResponse[]): UserDetailResponse[] {
  // Find root users (users without supervisors or whose supervisors are not in the list)
  const rootUsers = users.filter(user => {
    if (!user.supervisor) return true;
    return !users.find(u => u.id === user.supervisor?.id);
  });

  return rootUsers;
}
