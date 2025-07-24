"use client";

import { useState, useEffect, useActionState } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  User, 
  Mail, 
  Save,
  X
} from "lucide-react";
import type { UserDetailResponse, UserUpdate, Department, Stage, Role } from '@/api/types';
import type { UUID } from '@/api/types/common';
import { updateUserAction, getProfileOptionsAction } from '@/api/server-actions/users';

interface UserEditViewModalProps {
  user: UserDetailResponse | null;
  isOpen: boolean;
  onClose: () => void;
  onUserUpdate?: (updatedUser: UserDetailResponse) => void;
}

// Server action for form submission
async function handleUpdateUserProfile(prevState: any, formData: FormData) {
  try {
    // Extract form data
    const departmentId = formData.get('department_id') as string;
    const stageId = formData.get('stage_id') as string;
    
    const userData: UserUpdate = {
      name: formData.get('name') as string,
      email: formData.get('email') as string,
      employee_code: formData.get('employee_code') as string,
      job_title: formData.get('job_title') as string,
      department_id: departmentId === 'unset' ? undefined : departmentId as UUID,
      stage_id: stageId === 'unset' ? undefined : stageId as UUID,
      status: formData.get('status') as any,
      subordinate_ids: [], // Keep empty for profile edit
    };

    // Get user ID from form
    const userId = formData.get('user_id') as UUID;
    
    if (!userId) {
      return { success: false, user: null, error: 'ユーザーIDが見つかりません' };
    }

    // Filter out empty values
    Object.keys(userData).forEach(key => {
      if (userData[key as keyof UserUpdate] === '' || userData[key as keyof UserUpdate] === null) {
        delete userData[key as keyof UserUpdate];
      }
    });

    const result = await updateUserAction(userId, userData);

    if (result.success && result.data) {
      return { success: true, user: result.data, error: null };
    } else {
      return { success: false, user: null, error: result.error || 'プロフィールの更新に失敗しました' };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'プロフィールの更新中にエラーが発生しました';
    return { success: false, user: null, error: errorMessage };
  }
}

export default function UserEditViewModal({ 
  user, 
  isOpen, 
  onClose,
  onUserUpdate
}: UserEditViewModalProps) {
  // useActionState for form handling
  const [actionState, formAction, isPending] = useActionState(
    handleUpdateUserProfile,
    { success: false, user: null, error: null }
  );

  // Profile options state for departments/stages
  const [profileOptions, setProfileOptions] = useState<{
    departments: Department[];
    stages: Stage[];
    roles: Role[];
  }>({
    departments: [],
    stages: [],
    roles: []
  });

  const [formData, setFormData] = useState({
    name: '',
    employee_code: '',
    email: '',
    job_title: '',
    department_id: '',
    stage_id: '',
    status: ''
  });

  // Fetch profile options when component mounts
  useEffect(() => {
    const fetchProfileOptions = async () => {
      try {
        const result = await getProfileOptionsAction();
        if (result.success && result.data) {
          setProfileOptions({
            departments: result.data.departments,
            stages: result.data.stages,
            roles: result.data.roles
          });
        }
      } catch (error) {
        console.error('Failed to fetch profile options:', error);
      }
    };

    fetchProfileOptions();
  }, []);

  // Initialize form data when user changes
  useEffect(() => {
    if (user) {
      const initialData = {
        name: user.name,
        employee_code: user.employee_code,
        email: user.email,
        job_title: user.job_title || '',
        department_id: user.department?.id || 'unset',
        stage_id: user.stage?.id || 'unset',
        status: user.status
      };
      setFormData(initialData);
    }
  }, [user]);

  // Handle success/error after form submission
  useEffect(() => {
    if (actionState?.success && actionState?.user) {
      toast.success('プロフィールが正常に更新されました');
      onUserUpdate?.(actionState.user);
      onClose();
    } else if (actionState?.error) {
      toast.error(actionState.error);
    }
  }, [actionState, onUserUpdate, onClose]);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };


  const getUserInitials = (name: string) => {
    return name.split(' ').map(part => part[0]).join('').toUpperCase();
  };

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

  if (!user) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-5xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <User className="h-5 w-5" />
            ユーザー編集
          </DialogTitle>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          {/* Hidden fields for form data */}
          <input type="hidden" name="user_id" value={user.id} />
          <input type="hidden" name="department_id" value={formData.department_id} />
          <input type="hidden" name="stage_id" value={formData.stage_id} />

          {/* Error display */}
          {actionState?.error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {actionState.error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
          {/* ユーザー基本情報カード */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">基本情報</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarFallback className="bg-primary/10 text-primary font-semibold text-lg">
                    {getUserInitials(user.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{user.name}</span>
                    {getStatusBadge(user.status)}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {user.employee_code}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">名前</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    placeholder="名前を入力"
                    disabled={isPending}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="employee_code">従業員コード</Label>
                  <Input
                    id="employee_code"
                    value={formData.employee_code}
                    onChange={(e) => handleInputChange('employee_code', e.target.value)}
                    placeholder="従業員コードを入力"
                    disabled={isPending}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">メールアドレス</Label>
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    placeholder="メールアドレスを入力"
                    disabled={isPending}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="job_title">役職</Label>
                <Input
                  id="job_title"
                  value={formData.job_title}
                  onChange={(e) => handleInputChange('job_title', e.target.value)}
                  placeholder="役職を入力"
                  disabled={isPending}
                />
              </div>
            </CardContent>
          </Card>

          {/* 組織・ロール情報カード */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">組織・ロール</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="department">部署</Label>
                  <Select 
                    name="department_id"
                    value={formData.department_id} 
                    onValueChange={(value) => handleInputChange('department_id', value)}
                    disabled={isPending}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="部署を選択" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unset">未設定</SelectItem>
                      {profileOptions.departments.map((dept) => (
                        <SelectItem key={dept.id} value={dept.id}>
                          {dept.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="stage">ステージ</Label>
                  <Select 
                    name="stage_id"
                    value={formData.stage_id} 
                    onValueChange={(value) => handleInputChange('stage_id', value)}
                    disabled={isPending}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="ステージを選択" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unset">未設定</SelectItem>
                      {profileOptions.stages.map((stage) => (
                        <SelectItem key={stage.id} value={stage.id}>
                          {stage.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">ステータス</Label>
                <Select 
                  name="status"
                  value={formData.status} 
                  onValueChange={(value) => handleInputChange('status', value)}
                  disabled={isPending}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="ステータスを選択" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">アクティブ</SelectItem>
                    <SelectItem value="inactive">非アクティブ</SelectItem>
                    <SelectItem value="pending_approval">承認待ち</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>現在のロール</Label>
                <div className="flex flex-wrap gap-2">
                  {user.roles.map((role) => (
                    <Badge key={role.id} variant="outline">
                      {role.name}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

          <DialogFooter className="gap-2">
            <Button 
              type="button"
              variant="outline" 
              onClick={onClose} 
              disabled={isPending}
            >
              <X className="h-4 w-4 mr-2" />
              キャンセル
            </Button>
            <Button 
              type="submit"
              disabled={isPending}
            >
              {isPending ? (
                <>
                  保存中...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  変更を保存
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}