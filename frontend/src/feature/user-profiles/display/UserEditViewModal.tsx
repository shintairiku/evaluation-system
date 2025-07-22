"use client";

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/ui/loading-button";
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
import type { UserDetailResponse } from '@/api/types';
import { useLoading } from '@/hooks/useLoading';

interface UserEditViewModalProps {
  user: UserDetailResponse | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function UserEditViewModal({ 
  user, 
  isOpen, 
  onClose
}: UserEditViewModalProps) {
  const { isLoading, withLoading } = useLoading('user-edit');
  const [formData, setFormData] = useState({
    name: '',
    employee_code: '',
    email: '',
    job_title: '',
    department: '',
    stage: '',
    status: ''
  });

  // Initialize form data when user changes
  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name,
        employee_code: user.employee_code,
        email: user.email,
        job_title: user.job_title || '',
        department: user.department?.name || '',
        stage: user.stage?.name || '',
        status: user.status
      });
    }
  }, [user]);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSave = async () => {
    if (!user) return;

    await withLoading(async () => {
      try {
        // Simulate API call for user update
        console.log('Updating user:', user.id, formData);
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // TODO: Replace with actual API call
        // const result = await updateUserAction(user.id, formData);
        // if (!result.success) throw new Error(result.error);
        
        console.log('User updated successfully');
        onClose();
      } catch (error) {
        console.error('Failed to update user:', error);
        throw error; // Re-throw to let withLoading handle it
      }
    }, {
      onError: (error) => {
        console.error('User update loading error:', error);
      }
    });
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
                    disabled={isLoading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="employee_code">従業員コード</Label>
                  <Input
                    id="employee_code"
                    value={formData.employee_code}
                    onChange={(e) => handleInputChange('employee_code', e.target.value)}
                    placeholder="従業員コードを入力"
                    disabled={isLoading}
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
                    disabled={isLoading}
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
                  disabled={isLoading}
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
                    value={formData.department} 
                    onValueChange={(value) => handleInputChange('department', value)}
                    disabled={isLoading}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="部署を選択" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">未設定</SelectItem>
                      <SelectItem value="開発部">開発部</SelectItem>
                      <SelectItem value="人事部">人事部</SelectItem>
                      <SelectItem value="営業部">営業部</SelectItem>
                      <SelectItem value="経理部">経理部</SelectItem>
                      <SelectItem value="品質管理部">品質管理部</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="stage">ステージ</Label>
                  <Select 
                    value={formData.stage} 
                    onValueChange={(value) => handleInputChange('stage', value)}
                    disabled={isLoading}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="ステージを選択" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">未設定</SelectItem>
                      <SelectItem value="ジュニア">ジュニア</SelectItem>
                      <SelectItem value="ミドル">ミドル</SelectItem>
                      <SelectItem value="シニア">シニア</SelectItem>
                      <SelectItem value="エキスパート">エキスパート</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">ステータス</Label>
                <Select 
                  value={formData.status} 
                  onValueChange={(value) => handleInputChange('status', value)}
                  disabled={isLoading}
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
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            <X className="h-4 w-4 mr-2" />
            キャンセル
          </Button>
          <LoadingButton 
            onClick={handleSave}
            loading={isLoading}
            loadingText="保存中..."
          >
            <Save className="h-4 w-4 mr-2" />
            保存
          </LoadingButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}