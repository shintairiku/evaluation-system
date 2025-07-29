"use client";

import { useState, useEffect } from 'react';
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
  X,
  Loader2
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { UserDetailResponse, UserUpdate, Department, Stage, Role, UserStatus } from '@/api/types';
import type { UUID } from '@/api/types/common';
import { updateUserAction, getProfileOptionsAction } from '@/api/server-actions/users';

interface UserEditViewModalProps {
  user: UserDetailResponse | null;
  isOpen: boolean;
  onClose: () => void;
  onUserUpdate?: (updatedUser: UserDetailResponse) => void;
}

// Loading skeleton for select dropdowns
const SelectSkeleton = () => (
  <div className="space-y-2">
    <Skeleton className="h-4 w-16" />
    <Skeleton className="h-10 w-full" />
  </div>
);

// Loading skeleton for input fields  
const InputSkeleton = () => (
  <div className="space-y-2">
    <Skeleton className="h-4 w-20" />
    <Skeleton className="h-10 w-full" />
  </div>
);

export default function UserEditViewModal({ 
  user, 
  isOpen, 
  onClose,
  onUserUpdate
}: UserEditViewModalProps) {
  // State for form handling
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingOptions, setIsLoadingOptions] = useState(true);

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
    if (!isOpen) return; // Only fetch when modal is open
    
    const fetchProfileOptions = async () => {
      setIsLoadingOptions(true);
      try {
        const result = await getProfileOptionsAction();
        
        if (result.success && result.data) {
          setProfileOptions({
            departments: result.data.departments,
            stages: result.data.stages,
            roles: result.data.roles
          });
        } else {
          toast.error('部署・ステージの選択肢の読み込みに失敗しました');
        }
      } catch (error) {
        toast.error('部署・ステージの選択肢の読み込み中にエラーが発生しました');
      } finally {
        setIsLoadingOptions(false);
      }
    };

    fetchProfileOptions();
  }, [isOpen]);

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

  // Form submission handler
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!user || isSubmitting) return;
    
    setIsSubmitting(true);
    
    try {
      const userData: UserUpdate = {
        name: formData.name,
        email: formData.email,
        employee_code: formData.employee_code,
        job_title: formData.job_title,
        department_id: formData.department_id === 'unset' ? undefined : formData.department_id as UUID,
        stage_id: formData.stage_id === 'unset' ? undefined : formData.stage_id as UUID,
        status: formData.status as UserStatus,
        subordinate_ids: [], // Keep empty for profile edit
      };

      // Filter out empty values
      Object.keys(userData).forEach(key => {
        if (userData[key as keyof UserUpdate] === '' || userData[key as keyof UserUpdate] === null) {
          delete userData[key as keyof UserUpdate];
        }
      });

      const result = await updateUserAction(user.id, userData);

      if (result.success && result.data) {
        toast.success('プロフィールが正常に更新されました');
        onUserUpdate?.(result.data);
        onClose();
      } else {
        toast.error(result.error || 'プロフィールの更新に失敗しました');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'プロフィールの更新中にエラーが発生しました';
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

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
      <DialogContent className="sm:max-w-4xl w-full">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <User className="h-5 w-5" />
            ユーザー編集
            {isLoadingOptions && (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-6">
            {/* ユーザー基本情報カード */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">基本情報</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
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

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="name">名前</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => handleInputChange('name', e.target.value)}
                      placeholder="名前を入力"
                      disabled={isSubmitting || isLoadingOptions}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="employee_code">従業員コード</Label>
                    <Input
                      id="employee_code"
                      value={formData.employee_code}
                      onChange={(e) => handleInputChange('employee_code', e.target.value)}
                      placeholder="従業員コードを入力"
                      disabled={isSubmitting || isLoadingOptions}
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
                      disabled={isSubmitting || isLoadingOptions}
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
                    disabled={isSubmitting || isLoadingOptions}
                  />
                </div>
              </CardContent>
            </Card>

            {/* 組織・ロール情報カード */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">組織・ロール</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  {isLoadingOptions ? (
                    <>
                      <SelectSkeleton />
                      <SelectSkeleton />
                    </>
                  ) : (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="department">部署</Label>
                        <Select 
                          value={formData.department_id} 
                          onValueChange={(value) => handleInputChange('department_id', value)}
                          disabled={isSubmitting}
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
                          value={formData.stage_id} 
                          onValueChange={(value) => handleInputChange('stage_id', value)}
                          disabled={isSubmitting}
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
                    </>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="status">ステータス</Label>
                  <Select 
                    value={formData.status} 
                    onValueChange={(value) => handleInputChange('status', value)}
                    disabled={isSubmitting || isLoadingOptions}
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
                  {isLoadingOptions ? (
                    <div className="flex gap-2">
                      <Skeleton className="h-6 w-16" />
                      <Skeleton className="h-6 w-20" />
                      <Skeleton className="h-6 w-14" />
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {user.roles.map((role) => (
                        <Badge key={role.id} variant="outline">
                          {role.name}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <DialogFooter className="gap-4">
            <Button 
              type="button"
              variant="outline" 
              onClick={onClose} 
              disabled={isSubmitting}
            >
              <X className="h-4 w-4 mr-2" />
              キャンセル
            </Button>
            <Button 
              type="submit"
              disabled={isSubmitting || isLoadingOptions}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
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