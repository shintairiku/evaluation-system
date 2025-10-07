"use client";

import { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Edit, User, Mail, Building, Trophy } from "lucide-react";
import type { UserDetailResponse } from '@/api/types';
import UserEditViewModal from './UserEditViewModal';
import { EmptyState } from '@/components/ui/empty-state';
import { MESSAGES } from '@/components/constants/messages';

interface UserGalleryViewProps {
  users: UserDetailResponse[];
  onUserUpdate?: (updatedUser: UserDetailResponse) => void;
}

export default function UserGalleryView({ users, onUserUpdate }: UserGalleryViewProps) {
  const [selectedUser, setSelectedUser] = useState<UserDetailResponse | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="default" className="bg-green-100 text-green-800">アクティブ</Badge>;
      case 'inactive':
        return <Badge variant="secondary" className="bg-red-100 text-red-800">非アクティブ</Badge>;
      case 'pending_approval':
        return <Badge variant="outline" className="bg-yellow-100 text-yellow-800">承認待ち</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };


  const handleEditUser = (userId: string) => {
    const user = users.find(u => u.id === userId);
    if (user) {
      setSelectedUser(user);
      setIsModalOpen(true);
    }
  };

  const handleCloseModal = () => {
    setSelectedUser(null);
    setIsModalOpen(false);
  };

  if (users.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-center">
        <EmptyState title={MESSAGES.users.emptyTitle} description={MESSAGES.users.emptyDescription} />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {users.map((user) => (
        <Card key={user.id} className="group hover:shadow-md transition-shadow">
          <CardHeader className="pb-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <CardTitle className="text-lg">{user.name}</CardTitle>
                <CardDescription className="flex items-center gap-1 mt-1">
                  <User className="w-3 h-3" />
                  {user.employee_code}
                </CardDescription>
                {user.job_title && (
                  <CardDescription className="mt-1 font-medium">
                    {user.job_title}
                  </CardDescription>
                )}
              </div>
              {getStatusBadge(user.status)}
            </div>
          </CardHeader>
          
          <CardContent className="space-y-3">
            {/* メールアドレス */}
            <div className="flex items-center gap-2 text-sm">
              <Mail className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <span className="truncate" title={user.email}>
                {user.email}
              </span>
            </div>

            {/* 部署 */}
            <div className="flex items-center gap-2 text-sm">
              <Building className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              {user.department ? (
                <Badge variant="outline" className="text-xs">
                  {user.department.name}
                </Badge>
              ) : (
                <span className="text-muted-foreground">部署未設定</span>
              )}
            </div>

            {/* ステージ */}
            <div className="flex items-center gap-2 text-sm">
              <Trophy className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              {user.stage ? (
                <Badge variant="secondary" className="text-xs">
                  {user.stage.name}
                </Badge>
              ) : (
                <span className="text-muted-foreground">ステージ未設定</span>
              )}
            </div>

            {/* ロール */}
            <div className="space-y-1">
              <div className="text-xs font-medium text-muted-foreground">ロール</div>
              <div className="flex flex-wrap gap-1">
                {user.roles.length > 0 ? (
                  user.roles.map((role) => (
                    <Badge key={role.id} variant="outline" className="text-xs">
                      {role.name}
                    </Badge>
                  ))
                ) : (
                  <span className="text-xs text-muted-foreground">ロール未設定</span>
                )}
              </div>
            </div>

            {/* アクションボタン */}
            <div className="flex gap-2 pt-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleEditUser(user.id)}
                className="w-full"
              >
                <Edit className="w-4 h-4 mr-1" />
                編集
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
      
      {/* ユーザー編集モーダル */}
      <UserEditViewModal
        user={selectedUser}
        allUsers={users}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onUserUpdate={onUserUpdate}
      />
    </div>
  );
}