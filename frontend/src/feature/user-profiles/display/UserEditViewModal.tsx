"use client";

import { useState, useEffect, useActionState, useCallback } from 'react';
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
  Loader2,
  Undo2
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { UserDetailResponse, UserUpdate, UserStatus } from '@/api/types';
import type { UUID } from '@/api/types/common';
import { updateUserAction, getUserByIdAction } from '@/api/server-actions/users';
import { useProfileOptions } from '@/context/ProfileOptionsContext';
import { HierarchyEditCard } from '@/components/hierarchy';

interface UserEditViewModalProps {
  user: UserDetailResponse | null;
  allUsers: UserDetailResponse[];
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
  allUsers,
  isOpen, 
  onClose,
  onUserUpdate
}: UserEditViewModalProps) {
  // Form action wrapper for useActionState
  const updateUserWrapper = async (prevState: { success: boolean; error?: string; data?: UserDetailResponse } | null, formData: FormData) => {
    if (!user) return { success: false, error: 'ユーザー情報が見つかりません' };
    
    try {
      // Save hierarchy changes first if there are any pending
      if (hierarchyPendingChanges && hierarchySaveHandler) {
        try {
          await hierarchySaveHandler();
          // Reset hierarchy state after successful save
          setHierarchyPendingChanges(false);
          setHierarchySaveHandler(null);
          setHierarchyUndoHandler(null);
        } catch {
          toast.error('階層変更の保存に失敗しました。プロフィール更新を続行します。');
          // Continue with profile save even if hierarchy fails
        }
      }
      const userData: UserUpdate = {
        name: formData.get('name') as string,
        email: formData.get('email') as string,
        employee_code: formData.get('employee_code') as string,
        job_title: formData.get('job_title') as string || '',
        department_id: formData.get('department_id') === 'unset' ? undefined : formData.get('department_id') as UUID,
        stage_id: formData.get('stage_id') === 'unset' ? undefined : formData.get('stage_id') as UUID,
        status: formData.get('status') as UserStatus,
        // subordinate_ids: [], // REMOVED - This was causing subordinates to be deleted!
      };

      // Filter out empty values
      Object.keys(userData).forEach(key => {
        if (userData[key as keyof UserUpdate] === '' || userData[key as keyof UserUpdate] === null) {
          delete userData[key as keyof UserUpdate];
        }
      });

      const result = await updateUserAction(user.id, userData);

      if (result.success && result.data) {
        // Check if hierarchy-related fields changed
        const hierarchyFields = ['department_id', 'stage_id'];
        const hasHierarchyChange = hierarchyFields.some(field => 
          userData[field as keyof UserUpdate] !== undefined
        );
        
        if (hasHierarchyChange) {
          // Invalidate cache for current user and potentially affected users
          const affectedUsers = [user.id];
          
          // If department changed, also invalidate supervisor/subordinates
          if (userData.department_id && user.supervisor) {
            affectedUsers.push(user.supervisor.id);
          }
          if (user.subordinates) {
            affectedUsers.push(...user.subordinates.map(sub => sub.id));
          }
          
          invalidateHierarchyCache(affectedUsers);
        }
        
        toast.success('プロフィールが正常に更新されました');
        onUserUpdate?.(result.data);
        onClose();
        return { success: true, data: result.data };
      } else {
        toast.error(result.error || 'プロフィールの更新に失敗しました');
        return { success: false, error: result.error || 'プロフィールの更新に失敗しました' };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'プロフィールの更新中にエラーが発生しました';
      toast.error(errorMessage);
      return { success: false, error: errorMessage };
    }
  };

  const [, formAction, isPending] = useActionState(updateUserWrapper, null);
  
  // Use cached profile options
  const { options, isLoading: isLoadingOptions, error: optionsError } = useProfileOptions();

  // State for detailed user data with hierarchy
  const [detailedUser, setDetailedUser] = useState<UserDetailResponse | null>(null);
  const [isLoadingUserData, setIsLoadingUserData] = useState(false);
  
  // Simple cache for user hierarchy data (5 minute TTL)
  const [userCache] = useState(() => new Map<string, { data: UserDetailResponse; timestamp: number }>());
  
  // Function to invalidate cache when hierarchy changes
  const invalidateHierarchyCache = (affectedUserIds: string[]) => {
    affectedUserIds.forEach(userId => {
      userCache.delete(userId);
    });
  };
  
  // Function to force refresh hierarchy data
  const forceRefreshHierarchyData = async (userId: string) => {
    userCache.delete(userId);
    if (user && userId === user.id && isOpen) {
      setIsLoadingUserData(true);
      try {
        const result = await getUserByIdAction(userId);
        if (result.success && result.data) {
          setDetailedUser(result.data);
          userCache.set(userId, {
            data: result.data,
            timestamp: Date.now()
          });
        }
      } catch (error) {
        console.error('Error force refreshing hierarchy data:', error);
      } finally {
        setIsLoadingUserData(false);
      }
    }
  };

  const [formData, setFormData] = useState({
    name: '',
    employee_code: '',
    email: '',
    job_title: '',
    department_id: '',
    stage_id: '',
    status: ''
  });

  // Hierarchy card state
  const [hierarchyPendingChanges, setHierarchyPendingChanges] = useState(false);
  const [hierarchySaveHandler, setHierarchySaveHandler] = useState<(() => Promise<void>) | null>(null);
  const [hierarchyUndoHandler, setHierarchyUndoHandler] = useState<(() => void) | null>(null);

  // Fetch detailed user data when modal opens
  useEffect(() => {
    const fetchDetailedUserData = async () => {
      if (user && isOpen) {
        // Check cache first (5 minute TTL)
        const cacheKey = user.id;
        const cached = userCache.get(cacheKey);
        const now = Date.now();
        const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
        
        if (cached && (now - cached.timestamp) < CACHE_TTL) {
          setDetailedUser(cached.data);
          return;
        }
        
        setIsLoadingUserData(true);
        
        try {
          const result = await getUserByIdAction(user.id);
          
          if (result.success && result.data) {
            setDetailedUser(result.data);
            
            // Cache the result
            userCache.set(cacheKey, {
              data: result.data,
              timestamp: now
            });
            
          } else {
            // Fallback to the basic user data
            setDetailedUser(user);
          }
        } catch (error) {
          console.error(`[UserEditModal] Error loading user data:`, error);
          // Fallback to the basic user data
          setDetailedUser(user);
        } finally {
          setIsLoadingUserData(false);
        }
      } else if (!isOpen) {
        // Reset when modal closes
        setDetailedUser(null);
      }
    };

    fetchDetailedUserData();
  }, [user, isOpen, userCache]);

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


  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Handle hierarchy pending changes
  const handleHierarchyPendingChanges = useCallback((
    hasPendingChanges: boolean,
    saveHandler?: () => Promise<void>,
    undoHandler?: () => void
  ) => {
    setHierarchyPendingChanges(hasPendingChanges);
    setHierarchySaveHandler(() => saveHandler || null);
    setHierarchyUndoHandler(() => undoHandler || null);
  }, []);

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
      <DialogContent className="sm:max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <User className="h-5 w-5" />
            ユーザー編集
            {isLoadingOptions && (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </DialogTitle>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
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
                      disabled={isPending || isLoadingOptions}
                      name="name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="employee_code">従業員コード</Label>
                    <Input
                      id="employee_code"
                      value={formData.employee_code}
                      onChange={(e) => handleInputChange('employee_code', e.target.value)}
                      placeholder="従業員コードを入力"
                      disabled={isPending || isLoadingOptions}
                      name="employee_code"
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
                      disabled={isPending || isLoadingOptions}
                      name="email"
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
                    disabled={isPending || isLoadingOptions}
                    name="job_title"
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
                          disabled={isPending}
                          name="department_id"
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
                          disabled={isPending}
                          name="stage_id"
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
                    disabled={isPending || isLoadingOptions}
                    name="status"
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

            {/* 階層関係カード */}
            <HierarchyEditCard 
              user={detailedUser || user} 
              allUsers={allUsers}
              isLoading={isLoadingOptions || isLoadingUserData}
              onUserUpdate={onUserUpdate}
              onPendingChanges={handleHierarchyPendingChanges}
            />
          </div>

          <DialogFooter className="gap-4">
            <Button 
              type="button"
              variant="outline" 
              onClick={onClose} 
              disabled={isPending}
            >
              <X className="h-4 w-4 mr-2" />
              キャンセル
            </Button>
            <div className="flex items-center gap-2">
              {hierarchyPendingChanges && hierarchyUndoHandler && (
                <Button 
                  type="button"
                  variant="outline"
                  onClick={hierarchyUndoHandler}
                  disabled={isPending}
                >
                  <Undo2 className="h-4 w-4 mr-2" />
                  階層変更を元に戻す
                </Button>
              )}
              <Button 
                type="submit"
                disabled={isPending || isLoadingOptions}
              >
                {isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    保存中...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    変更を保存
                    {hierarchyPendingChanges && (
                      <Badge variant="secondary" className="ml-2 text-xs">
                        階層変更含む
                      </Badge>
                    )}
                  </>
                )}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}