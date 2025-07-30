"use client";

import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import type { UserDetailResponse } from '@/api/types';

interface OrganizationNodeProps {
  data: {
    user: UserDetailResponse;
  };
}

const OrganizationNode = memo(({ data }: OrganizationNodeProps) => {
  const { user } = data;

  return (
    <Card className="w-64 shadow-lg border-2 hover:border-primary/50 transition-colors bg-background">
      <Handle type="target" position={Position.Top} />
      
      <CardHeader className="pb-2">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10">
            <AvatarFallback className="text-sm font-semibold">
              {user.name.charAt(0)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-sm truncate">{user.name}</h4>
            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0">
        <div className="space-y-2">
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
          {user.roles && user.roles.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {user.roles.slice(0, 2).map((role) => (
                <Badge key={role.id} variant="outline" className="text-xs">
                  {role.name}
                </Badge>
              ))}
              {user.roles.length > 2 && (
                <Badge variant="outline" className="text-xs">
                  +{user.roles.length - 2}
                </Badge>
              )}
            </div>
          )}
        </div>
      </CardContent>
      
      <Handle type="source" position={Position.Bottom} />
    </Card>
  );
});

OrganizationNode.displayName = 'OrganizationNode';
export default OrganizationNode; 