"use client";

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { 
  Users, 
  UserCheck, 
  Crown,
  ChevronDown,
  ChevronUp 
} from "lucide-react";
import type { UserDetailResponse } from '@/api/types';

interface HierarchyDisplayCardProps {
  user: UserDetailResponse;
  isLoading?: boolean;
}

export default function HierarchyDisplayCard({ user, isLoading }: HierarchyDisplayCardProps) {
  const getUserInitials = (name: string) => {
    return name.split(' ').map(part => part[0]).join('').toUpperCase();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'inactive':
        return 'bg-red-100 text-red-800';
      case 'pending_approval':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Get peers (colleagues at same level - subordinates of the same supervisor)
  const peers = useMemo(() => {
    // Since user.supervisor is of type User (not UserDetailResponse), it doesn't have subordinates
    // For now, we'll return an empty array. In a real implementation, we'd need to fetch this data
    // or ensure the supervisor data includes subordinates information
    return [];
  }, []);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5" />
            階層関係
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 animate-pulse">
            <div className="h-16 bg-gray-200 rounded"></div>
            <div className="h-16 bg-gray-200 rounded"></div>
            <div className="h-16 bg-gray-200 rounded"></div>
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
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Supervisor Section */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Crown className="h-4 w-4" />
            <span>上司</span>
          </div>
          {user.supervisor ? (
            <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border">
              <Avatar className="h-10 w-10">
                <AvatarFallback className="bg-blue-100 text-blue-700 text-sm">
                  {getUserInitials(user.supervisor.name)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm truncate">
                    {user.supervisor.name}
                  </span>
                  <Badge variant="outline" className={getStatusColor(user.supervisor.status)}>
                    {user.supervisor.status === 'active' ? 'アクティブ' : 
                     user.supervisor.status === 'inactive' ? '非アクティブ' : '承認待ち'}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {user.supervisor.employee_code} • {user.supervisor.job_title || '役職未設定'}
                </div>
              </div>
              <ChevronUp className="h-4 w-4 text-blue-500" />
            </div>
          ) : (
            <div className="p-3 text-center text-sm text-muted-foreground bg-gray-50 rounded-lg border-2 border-dashed">
              上司が設定されていません
            </div>
          )}
        </div>

        {/* Current User Position */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <UserCheck className="h-4 w-4" />
            <span>現在のユーザー</span>
          </div>
          <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg border-2 border-green-200">
            <Avatar className="h-10 w-10">
              <AvatarFallback className="bg-green-100 text-green-700 text-sm">
                {getUserInitials(user.name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm truncate">
                  {user.name}
                </span>
                <Badge variant="outline" className={getStatusColor(user.status)}>
                  {user.status === 'active' ? 'アクティブ' : 
                   user.status === 'inactive' ? '非アクティブ' : '承認待ち'}
                </Badge>
              </div>
              <div className="text-xs text-muted-foreground truncate">
                {user.employee_code} • {user.job_title || '役職未設定'}
              </div>
            </div>
          </div>
        </div>

        {/* Subordinates Section */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <ChevronDown className="h-4 w-4" />
            <span>部下 ({user.subordinates?.length || 0}人)</span>
          </div>
          {user.subordinates && user.subordinates.length > 0 ? (
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {user.subordinates.map((subordinate) => (
                <div key={subordinate.id} className="flex items-center gap-3 p-2 bg-orange-50 rounded-lg border">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-orange-100 text-orange-700 text-xs">
                      {getUserInitials(subordinate.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate">
                        {subordinate.name}
                      </span>
                      <Badge variant="outline" className={`${getStatusColor(subordinate.status)} text-xs`}>
                        {subordinate.status === 'active' ? 'アクティブ' : 
                         subordinate.status === 'inactive' ? '非アクティブ' : '承認待ち'}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {subordinate.employee_code} • {subordinate.job_title || '役職未設定'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-3 text-center text-sm text-muted-foreground bg-gray-50 rounded-lg border-2 border-dashed">
              部下がいません
            </div>
          )}
        </div>

        {/* Summary Statistics */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span>組織情報</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-blue-50 rounded-lg text-center">
              <div className="text-lg font-semibold text-blue-700">
                {user.supervisor ? '1' : '0'}
              </div>
              <div className="text-xs text-blue-600">上司</div>
            </div>
            <div className="p-3 bg-orange-50 rounded-lg text-center">
              <div className="text-lg font-semibold text-orange-700">
                {user.subordinates?.length || 0}
              </div>
              <div className="text-xs text-orange-600">部下</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}