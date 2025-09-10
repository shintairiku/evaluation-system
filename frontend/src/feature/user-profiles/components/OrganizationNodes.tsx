/**
 * React Flow node components for organization charts
 */
import React from 'react';
import { Handle, Position } from 'reactflow';
import type { UserDetailResponse } from '@/api/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Building2, Users, User, Mail, Loader2 } from 'lucide-react';

// Organization node component - represents departments or teams
export const OrgNode = ({ 
  data
}: { 
  data: { 
    name: string; 
    userCount: number; 
    isDepartment?: boolean;
    isLoading?: boolean;
    onClick?: () => void;
  };
}) => {
  const { name, userCount, isDepartment = false, isLoading = false, onClick } = data;
  
  const getNodeStyle = () => {
    if (isDepartment) {
      return 'bg-gradient-to-br from-blue-600 to-blue-700 text-white border-blue-800 shadow-lg';
    } else {
      return 'bg-gradient-to-br from-blue-50 to-blue-100 text-blue-900 border-blue-300 hover:from-blue-100 hover:to-blue-200 cursor-pointer shadow-md hover:shadow-lg transition-all duration-300';
    }
  };
  
  const handleStyle = {
    background: '#3b82f6',
    width: 10,
    height: 10,
    border: '3px solid #ffffff',
    borderRadius: '50%',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
  };
  
  return (
    <div className="relative">
      <Handle type="target" position={Position.Top} id="top" style={handleStyle} />
      <Card className={`w-64 transition-all duration-300 ${getNodeStyle()}`} onClick={onClick}>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${isDepartment ? 'bg-blue-500/20' : 'bg-blue-200/50'}`}>
              {isLoading ? (
                <Loader2 className={`w-6 h-6 animate-spin ${isDepartment ? 'text-white' : 'text-blue-700'}`} />
              ) : (
                <Building2 className={`w-6 h-6 ${isDepartment ? 'text-white' : 'text-blue-700'}`} />
              )}
            </div>
            <div className="text-center flex-1">
              <CardTitle className={`text-base font-bold ${isDepartment ? 'text-white' : 'text-blue-900'}`}>
                {name}
              </CardTitle>
              <CardDescription className={`text-sm mt-1 font-medium ${isDepartment ? 'text-blue-100' : 'text-blue-700'}`}>
                {isLoading ? 'Loading...' : `${userCount}人`}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>
      <Handle type="source" position={Position.Bottom} id="bottom" style={handleStyle} />
    </div>
  );
};

// User card node component
export const UserNode = ({ data }: { 
  data: { 
    user: UserDetailResponse; 
    isLoading?: boolean;
    onClick?: () => void;
  } 
}) => {
  const { user, isLoading = false, onClick } = data;
  
  const getCardStyle = () => {
    let baseStyle = '';
    if (user.status === 'pending_approval') {
      baseStyle = 'border-orange-300 bg-orange-50/50';
    } else if (user.roles?.some((role) => role.name.toLowerCase().includes('admin'))) {
      baseStyle = 'border-blue-400 bg-blue-50/50';
    } else if (user.roles?.some((role) => role.name.toLowerCase().includes('manager'))) {
      baseStyle = 'border-green-400 bg-green-50/50';
    } else if (user.roles?.some((role) => role.name.toLowerCase().includes('supervisor'))) {
      baseStyle = 'border-purple-400 bg-purple-50/50';
    } else {
      baseStyle = 'border-gray-200 bg-white';
    }
    
    const interactiveStyle = onClick ? 'cursor-pointer hover:shadow-xl' : 'hover:shadow-lg';
    // Keep visuals the same, only ensure this node sits above edges
    return `${baseStyle} shadow-md ${interactiveStyle} transition-all duration-300 relative z-10`;
  };

  const getStatusBadge = (status: string) => {
    const baseClasses = "font-medium px-2 py-1";
    switch (status) {
      case 'active':
        return <Badge variant="default" className={`bg-green-100 text-green-800 ${baseClasses}`}>アクティブ</Badge>;
      case 'inactive':
        return <Badge variant="secondary" className={`bg-red-100 text-red-800 ${baseClasses}`}>非アクティブ</Badge>;
      case 'pending_approval':
        return <Badge variant="outline" className={`bg-yellow-100 text-yellow-800 ${baseClasses}`}>承認待ち</Badge>;
      default:
        return <Badge variant="secondary" className={baseClasses}>{status}</Badge>;
    }
  };

  const handleStyle = {
    background: '#3b82f6',
    width: 10,
    height: 10,
    border: '3px solid #ffffff',
    borderRadius: '50%',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
  };

  return (
    <div className="relative">
      <Handle type="target" position={Position.Top} id="top" style={handleStyle} />
      <Card className={`w-72 sm:w-64 md:w-72 group ${getCardStyle()}`} onClick={onClick}>
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center">
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 text-white animate-spin" />
                  ) : (
                    <User className="w-4 h-4 text-white" />
                  )}
                </div>
                <CardTitle className="text-lg font-bold text-gray-900">{user.name}</CardTitle>
                {onClick && !isLoading && (
                  <div className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-xs text-gray-500">Click to expand</span>
                  </div>
                )}
              </div>
              <CardDescription className="flex items-center gap-1 mt-2 text-sm font-medium text-gray-600">
                <span className="bg-gray-100 px-2 py-1 rounded text-xs font-mono">{user.employee_code}</span>
              </CardDescription>
              {user.job_title && (
                <CardDescription className="mt-2 font-semibold text-gray-700 bg-gray-50 px-3 py-1 rounded-lg">
                  {user.job_title}
                </CardDescription>
              )}
            </div>
            <div className="ml-2">
              {getStatusBadge(user.status)}
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* Email */}
          <div className="flex items-center gap-3 text-sm bg-white/50 p-2 rounded-lg">
            <Mail className="w-4 h-4 text-gray-500 flex-shrink-0" />
            <span className="truncate font-medium text-gray-700" title={user.email}>
              {user.email}
            </span>
          </div>

          {/* Department */}
          <div className="flex items-center gap-3 text-sm">
            <Building2 className="w-4 h-4 text-gray-500 flex-shrink-0" />
            {user.department ? (
              <Badge variant="outline" className="text-xs font-medium bg-blue-50 text-blue-700 border-blue-200">
                {user.department.name}
              </Badge>
            ) : (
              <span className="text-gray-500 text-sm">部署未設定</span>
            )}
          </div>

          {/* Stage */}
          <div className="flex items-center gap-3 text-sm">
            <Users className="w-4 h-4 text-gray-500 flex-shrink-0" />
            {user.stage ? (
              <Badge variant="secondary" className="text-xs font-medium bg-gray-100 text-gray-700">
                {user.stage.name}
              </Badge>
            ) : (
              <span className="text-gray-500 text-sm">ステージ未設定</span>
            )}
          </div>

          {/* Roles */}
          <div className="space-y-2">
            <div className="text-xs font-bold text-gray-700 uppercase tracking-wide">ロール</div>
            <div className="flex flex-wrap gap-1.5">
              {user.roles && user.roles.length > 0 ? (
                user.roles.map((role) => (
                  <Badge key={role.id} variant="outline" className="text-xs font-medium bg-white/70 border-gray-300 text-gray-700">
                    {role.name}
                  </Badge>
                ))
              ) : (
                <span className="text-xs text-gray-500">ロール未設定</span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
      <Handle type="source" position={Position.Bottom} id="bottom" style={handleStyle} />
    </div>
  );
};