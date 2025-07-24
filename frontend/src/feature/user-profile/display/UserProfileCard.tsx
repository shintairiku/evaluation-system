"use client";

import { useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { 
  User, 
  Mail, 
  Building, 
  MapPin,
  Edit,
  Award,
  Calendar,
  Code
} from "lucide-react";
import EditProfileModal from '../components/EditProfileModal';
import type { UserDetailResponse, Department, Stage, Role } from '@/api/types/user';

interface UserProfileCardProps {
  user: UserDetailResponse;
  onUserUpdate?: (updatedUser: UserDetailResponse) => void;
  departments?: Department[];
  stages?: Stage[];
  roles?: Role[];
}

export default function UserProfileCard({ 
  user, 
  onUserUpdate,
  departments = [],
  stages = [],
  roles = []
}: UserProfileCardProps) {
  const { user: clerkUser } = useUser();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Helper functions
  const getUserInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      active: { label: 'アクティブ', variant: 'default' as const },
      pending_approval: { label: '承認待ち', variant: 'secondary' as const },
      inactive: { label: '非アクティブ', variant: 'destructive' as const },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.active;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const handleEditProfile = () => {
    setIsEditModalOpen(true);
  };

  const handleModalClose = () => {
    setIsEditModalOpen(false);
  };

  const handleUserUpdate = (updatedUser: UserDetailResponse) => {
    onUserUpdate?.(updatedUser);
    setIsEditModalOpen(false);
  };

  return (
    <>
      <Card className="w-full max-w-4xl mx-auto">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-2xl flex items-center gap-2">
              <User className="w-6 h-6" />
              プロフィール
            </CardTitle>
            <Button 
              onClick={handleEditProfile}
              className="flex items-center gap-2"
            >
              <Edit className="w-4 h-4" />
              編集
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* User Basic Information */}
          <div className="flex items-start gap-6">
            <Avatar className="h-24 w-24">
              <AvatarFallback className="bg-primary/10 text-primary font-semibold text-2xl">
                {getUserInitials(user.name)}
              </AvatarFallback>
            </Avatar>
            
            <div className="flex-1 space-y-3">
              <div className="flex items-center gap-3">
                <h2 className="text-3xl font-bold">{user.name}</h2>
                {getStatusBadge(user.status)}
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  <span>{user.email}</span>
                </div>
                
                <div className="flex items-center gap-2">
                  <Code className="w-4 h-4 text-muted-foreground" />
                  <span>従業員コード: {user.employee_code}</span>
                </div>
                
                {user.job_title && (
                  <div className="flex items-center gap-2">
                    <Award className="w-4 h-4 text-muted-foreground" />
                    <span>{user.job_title}</span>
                  </div>
                )}
                
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <span>登録日: {formatDate(user.created_at)}</span>
                </div>
              </div>
              
              {user.job_title && (
                <div className="bg-muted/50 p-3 rounded-lg">
                  <p className="text-sm font-medium text-muted-foreground">役職</p>
                  <p className="font-semibold">{user.job_title}</p>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Organization Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Department */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Building className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium">部署</span>
              </div>
              <div className="pl-6">
                <p className="font-semibold">{user.department?.name || '未設定'}</p>
                {user.department?.description && (
                  <p className="text-sm text-muted-foreground">{user.department.description}</p>
                )}
              </div>
            </div>

            {/* Stage */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium">ステージ</span>
              </div>
              <div className="pl-6">
                <p className="font-semibold">{user.stage?.name || '未設定'}</p>
                {user.stage?.description && (
                  <p className="text-sm text-muted-foreground">{user.stage.description}</p>
                )}
              </div>
            </div>

            {/* Roles */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Award className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium">ロール</span>
              </div>
              <div className="pl-6">
                {user.roles.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {user.roles.map((role) => (
                      <Badge key={role.id} variant="secondary">
                        {role.name}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">ロールが設定されていません</p>
                )}
              </div>
            </div>
          </div>

          <Separator />

          {/* Clerk Information */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-medium text-blue-900 mb-2 flex items-center gap-2">
              <User className="w-4 h-4" />
              認証情報
            </h3>
            <div className="text-sm text-blue-700 space-y-1">
              <p>Clerk User ID: {user.clerk_user_id}</p>
              <p>認証メール: {clerkUser?.primaryEmailAddress?.emailAddress}</p>
              <p>認証ステータス: 認証済み</p>
            </div>
          </div>

          {/* Profile Completion Status */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h3 className="font-medium text-green-900 mb-2">プロフィール完成度</h3>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm">基本情報</span>
                <Badge variant="default">完了</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">組織情報</span>
                <Badge variant={user.department && user.stage ? "default" : "secondary"}>
                  {user.department && user.stage ? "完了" : "未完了"}
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">ロール設定</span>
                <Badge variant={user.roles.length > 0 ? "default" : "secondary"}>
                  {user.roles.length > 0 ? "完了" : "未完了"}
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Edit Profile Modal */}
      <EditProfileModal
        user={user}
        isOpen={isEditModalOpen}
        onClose={handleModalClose}
        onUserUpdate={handleUserUpdate}
        departments={departments}
        stages={stages}
        roles={roles}
      />
    </>
  );
} 