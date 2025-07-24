"use client";

import { useActionState, useState, useEffect } from 'react';
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
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { 
  User, 
  Mail, 
  Building, 
  Save,
  X,
  AlertCircle
} from "lucide-react";
import { updateUserAction } from '@/api/server-actions/users';
import type { UserDetailResponse, UserUpdate, Department, Stage, Role } from '@/api/types/user';
import type { UUID } from '@/api/types/common';

interface EditProfileModalProps {
  user: UserDetailResponse;
  isOpen: boolean;
  onClose: () => void;
  onUserUpdate?: (updatedUser: UserDetailResponse) => void;
  departments?: Department[];
  stages?: Stage[];
  roles?: Role[];
}

// Form wrapper function for useActionState
const formActionWrapper = (
  userId: UUID,
  onSuccess: (user: UserDetailResponse) => void,
  onError: (error: string) => void
) => async (prevState: any, formData: FormData) => {
  try {
    // Extract form data
    const userData: UserUpdate = {
      name: formData.get('name') as string,
      email: formData.get('email') as string,
      employee_code: formData.get('employee_code') as string,
      job_title: formData.get('job_title') as string,
      department_id: formData.get('department_id') as UUID || undefined,
      stage_id: formData.get('stage_id') as UUID || undefined,
      role_ids: JSON.parse(formData.get('role_ids') as string || '[]'),
      supervisor_id: formData.get('supervisor_id') as UUID || undefined,
      subordinate_ids: [], // Keep empty for profile edit - subordinates managed separately
    };

    // Filter out empty values
    Object.keys(userData).forEach(key => {
      if (userData[key as keyof UserUpdate] === '' || userData[key as keyof UserUpdate] === null) {
        delete userData[key as keyof UserUpdate];
      }
    });

    const result = await updateUserAction(userId, userData);

    if (result.success && result.data) {
      onSuccess(result.data);
      return { success: true, user: result.data, error: null };
    } else {
      onError(result.error || 'プロフィールの更新に失敗しました');
      return { success: false, user: null, error: result.error || 'プロフィールの更新に失敗しました' };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'プロフィールの更新中にエラーが発生しました';
    onError(errorMessage);
    return { success: false, user: null, error: errorMessage };
  }
};

type FormDataType = {
  name: string;
  email: string;
  employee_code: string;
  job_title: string;
  department_id: string;
  stage_id: string;
  role_ids: UUID[];
  supervisor_id: string;
};

export default function EditProfileModal({
  user,
  isOpen,
  onClose,
  onUserUpdate,
  departments = [],
  stages = [],
  roles = []
}: EditProfileModalProps) {
  // Form state management
  const [formData, setFormData] = useState<FormDataType>({
    name: user.name,
    email: user.email,
    employee_code: user.employee_code,
    job_title: user.job_title || '',
    department_id: user.department?.id || '',
    stage_id: user.stage?.id || '',
    role_ids: user.roles.map(role => role.id),
    supervisor_id: '', // TODO: Get from user data when supervisor relationship is implemented
  });

  // Success and error handlers
  const handleSuccess = (updatedUser: UserDetailResponse) => {
    toast.success('プロフィールが正常に更新されました');
    onUserUpdate?.(updatedUser);
    onClose();
  };

  const handleError = (error: string) => {
    toast.error(error);
  };

  // useActionState hook for form submission
  const [actionState, formAction, isPending] = useActionState(
    formActionWrapper(user.id, handleSuccess, handleError),
    { success: false, user: null, error: null }
  );

  // Reset form data when user changes or modal opens
  useEffect(() => {
    if (isOpen) {
      setFormData({
        name: user.name,
        email: user.email,
        employee_code: user.employee_code,
        job_title: user.job_title || '',
        department_id: user.department?.id || '',
        stage_id: user.stage?.id || '',
        role_ids: user.roles.map(role => role.id),
        supervisor_id: '',
      });
    }
  }, [user, isOpen]);

  // Form field update handler
  const handleFieldChange = (field: string, value: string | string[]) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

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

  const getSelectedRoleNames = () => {
    return roles
      .filter(role => formData.role_ids.includes(role.id))
      .map(role => role.name)
      .join(', ') || 'ロールが選択されていません';
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            プロフィール編集
          </DialogTitle>
        </DialogHeader>

        <form action={formAction} className="space-y-6">
          {/* Hidden fields for form data */}
          <input type="hidden" name="department_id" value={formData.department_id} />
          <input type="hidden" name="stage_id" value={formData.stage_id} />
          <input type="hidden" name="role_ids" value={JSON.stringify(formData.role_ids)} />
          <input type="hidden" name="supervisor_id" value={formData.supervisor_id} />

          {/* Error display */}
          {actionState?.error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              {actionState.error}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column - User Basic Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <User className="w-5 h-5" />
                  基本情報
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* User Avatar and Status */}
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

                {/* Name Input */}
                <div className="space-y-2">
                  <Label htmlFor="name">名前 *</Label>
                  <Input
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={(e) => handleFieldChange('name', e.target.value)}
                    placeholder="名前を入力"
                    disabled={isPending}
                    required
                  />
                </div>

                {/* Email Input */}
                <div className="space-y-2">
                  <Label htmlFor="email">メールアドレス *</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleFieldChange('email', e.target.value)}
                    placeholder="メールアドレスを入力"
                    disabled={isPending}
                    required
                  />
                </div>

                {/* Employee Code Input */}
                <div className="space-y-2">
                  <Label htmlFor="employee_code">従業員コード *</Label>
                  <Input
                    id="employee_code"
                    name="employee_code"
                    value={formData.employee_code}
                    onChange={(e) => handleFieldChange('employee_code', e.target.value)}
                    placeholder="従業員コードを入力"
                    disabled={isPending}
                    required
                  />
                </div>

                {/* Job Title Input */}
                <div className="space-y-2">
                  <Label htmlFor="job_title">役職</Label>
                  <Input
                    id="job_title"
                    name="job_title"
                    value={formData.job_title}
                    onChange={(e) => handleFieldChange('job_title', e.target.value)}
                    placeholder="役職を入力"
                    disabled={isPending}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Right Column - Organization Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Building className="w-5 h-5" />
                  組織情報
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Department Select */}
                <div className="space-y-2">
                  <Label>部署</Label>
                  <Select
                    value={formData.department_id}
                    onValueChange={(value) => handleFieldChange('department_id', value)}
                    disabled={isPending}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="部署を選択" />
                    </SelectTrigger>
                    <SelectContent>
                      {departments.map((dept) => (
                        <SelectItem key={dept.id} value={dept.id}>
                          {dept.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Stage Select */}
                <div className="space-y-2">
                  <Label>ステージ</Label>
                  <Select
                    value={formData.stage_id}
                    onValueChange={(value) => handleFieldChange('stage_id', value)}
                    disabled={isPending}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="ステージを選択" />
                    </SelectTrigger>
                    <SelectContent>
                      {stages.map((stage) => (
                        <SelectItem key={stage.id} value={stage.id}>
                          {stage.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Roles Display - TODO: Implement multi-select when needed */}
                <div className="space-y-2">
                  <Label>ロール</Label>
                  <div className="p-3 border rounded-md bg-muted/50">
                    <p className="text-sm text-muted-foreground">
                      {getSelectedRoleNames()}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      ロールの変更は管理者にお問い合わせください
                    </p>
                  </div>
                </div>

                {/* Current Values Display */}
                <div className="space-y-3 pt-4">
                  <h4 className="font-medium text-sm">現在の設定:</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">部署:</span>
                      <span>{user.department?.name || '未設定'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">ステージ:</span>
                      <span>{user.stage?.name || '未設定'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">ロール数:</span>
                      <span>{user.roles.length} 個</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Submit Button */}
          <DialogFooter className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isPending}
            >
              <X className="w-4 h-4 mr-2" />
              キャンセル
            </Button>
            <Button
              type="submit"
              disabled={isPending}
            >
              {isPending ? (
                <>
                  <LoadingSpinner size="sm" className="mr-2" />
                  更新中...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  プロフィールを更新
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
} 