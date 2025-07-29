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
import type { UserDetailResponse, UserUpdate, UserStatus } from '@/api/types';
import type { UUID } from '@/api/types/common';
import { updateUserAction } from '@/api/server-actions/users';
import { useProfileOptions } from '@/context/ProfileOptionsContext';

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

export default function UserEditViewModal({ 
  user, 
  isOpen, 
  onClose,
  onUserUpdate
}: UserEditViewModalProps) {
  // State for form handling
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [lastError, setLastError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  
  // Use cached profile options
  const { options, isLoading: isLoadingOptions, error: optionsError } = useProfileOptions();

  const [formData, setFormData] = useState({
    name: '',
    employee_code: '',
    email: '',
    job_title: '',
    department_id: '',
    stage_id: '',
    status: ''
  });

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

  // Show error if profile options failed to load
  useEffect(() => {
    if (optionsError && isOpen) {
      toast.error(`部署・ステージの選択肢の読み込みに失敗しました: ${optionsError}`);
    }
  }, [optionsError, isOpen]);

  // Retry logic for failed submissions
  const handleRetry = async () => {
    if (retryCount >= 3 || !user) return;
    
    setRetryCount(prev => prev + 1);
    await performSubmission();
  };

  // Validate all fields before submission
  const validateAllFields = (): boolean => {
    const errors: Record<string, string> = {};
    
    // Validate all required fields
    const nameError = validateField('name', formData.name);
    if (nameError) errors.name = nameError;
    
    const emailError = validateField('email', formData.email);
    if (emailError) errors.email = emailError;
    
    const employeeCodeError = validateField('employee_code', formData.employee_code);
    if (employeeCodeError) errors.employee_code = employeeCodeError;
    
    const jobTitleError = validateField('job_title', formData.job_title);
    if (jobTitleError) errors.job_title = jobTitleError;
    
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Core submission logic (extracted for retry)
  const performSubmission = async () => {
    if (!user || isSubmitting) return;
    
    // Validate all fields before submission
    if (!validateAllFields()) {
      toast.error('入力内容に誤りがあります。確認してください。');
      return;
    }
    
    setIsSubmitting(true);
    setLastError(null);
    
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
        setRetryCount(0); // Reset retry count on success
        setLastError(null);
        onUserUpdate?.(result.data);
        onClose();
      } else {
        const errorMessage = result.error || 'プロフィールの更新に失敗しました';
        setLastError(errorMessage);
        
        // Show toast with retry option if under retry limit
        if (retryCount < 3) {
          toast.error(errorMessage, {
            action: {
              label: '再試行',
              onClick: handleRetry
            },
            description: `試行回数: ${retryCount + 1}/3`
          });
        } else {
          toast.error(`${errorMessage}（最大試行回数に達しました）`);
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'プロフィールの更新中にエラーが発生しました';
      setLastError(errorMessage);
      
      // Show toast with retry option if under retry limit
      if (retryCount < 3) {
        toast.error(errorMessage, {
          action: {
            label: '再試行',
            onClick: handleRetry
          },
          description: `試行回数: ${retryCount + 1}/3`
        });
      } else {
        toast.error(`${errorMessage}（最大試行回数に達しました）`);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Form submission handler
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    await performSubmission();
  };

  // Field validation function
  const validateField = (field: string, value: string): string | null => {
    switch (field) {
      case 'name':
        if (!value.trim()) return '名前は必須です';
        if (value.trim().length < 2) return '名前は2文字以上で入力してください';
        if (value.trim().length > 50) return '名前は50文字以下で入力してください';
        return null;
        
      case 'email':
        if (!value.trim()) return 'メールアドレスは必須です';
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) return 'メールアドレスの形式が正しくありません';
        return null;
        
      case 'employee_code':
        if (!value.trim()) return '従業員コードは必須です';
        if (value.trim().length < 3) return '従業員コードは3文字以上で入力してください';
        return null;
        
      case 'job_title':
        if (value.trim().length > 100) return '役職は100文字以下で入力してください';
        return null;
        
      default:
        return null;
    }
  };

  // Clear field error when field becomes valid
  const clearFieldError = (field: string) => {
    setFieldErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[field];
      return newErrors;
    });
  };

  // Set field error
  const setFieldError = (field: string, error: string) => {
    setFieldErrors(prev => ({
      ...prev,
      [field]: error
    }));
  };

  const handleInputChange = (field: string, value: string) => {
    // Update form data
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));

    // Validate field in real-time
    const error = validateField(field, value);
    if (error) {
      setFieldError(field, error);
    } else {
      clearFieldError(field);
    }
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
                      className={fieldErrors.name ? 'border-destructive focus-visible:ring-destructive' : ''}
                    />
                    {fieldErrors.name && (
                      <p className="text-sm text-destructive">{fieldErrors.name}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="employee_code">従業員コード</Label>
                    <Input
                      id="employee_code"
                      value={formData.employee_code}
                      onChange={(e) => handleInputChange('employee_code', e.target.value)}
                      placeholder="従業員コードを入力"
                      disabled={isSubmitting || isLoadingOptions}
                      className={fieldErrors.employee_code ? 'border-destructive focus-visible:ring-destructive' : ''}
                    />
                    {fieldErrors.employee_code && (
                      <p className="text-sm text-destructive">{fieldErrors.employee_code}</p>
                    )}
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
                      className={fieldErrors.email ? 'border-destructive focus-visible:ring-destructive' : ''}
                    />
                  </div>
                  {fieldErrors.email && (
                    <p className="text-sm text-destructive">{fieldErrors.email}</p>
                  )}
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
                            {options.departments.map((dept) => (
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
                            {options.stages.map((stage) => (
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