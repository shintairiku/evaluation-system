'use client';

import type { ReactNode } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { BulkUserStatusUpdateResponse } from '@/api/types';

interface OrgManagementViewProps {
  activeTab: 'users' | 'departments' | 'roles';
  onTabChange: (tab: 'users' | 'departments' | 'roles') => void;
  totalUsers: number;
  totalDepartments: number;
  totalRoles: number;
  usersTab: ReactNode;
  departmentsTab: ReactNode;
  rolesTab: ReactNode;
  bulkSummary: BulkUserStatusUpdateResponse | null;
}

export function OrgManagementView({
  activeTab,
  onTabChange,
  totalUsers,
  totalDepartments,
  totalRoles,
  usersTab,
  departmentsTab,
  rolesTab,
  bulkSummary,
}: OrgManagementViewProps) {
  return (
    <div className="space-y-8">
      {/* Page Title */}
      <h1 className="text-2xl font-bold">組織管理</h1>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-base font-semibold">ユーザー</CardTitle>
            <p className="text-xs text-muted-foreground">組織内のアクティブメンバー数</p>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{totalUsers.toLocaleString()} 名</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-base font-semibold">部門</CardTitle>
            <p className="text-xs text-muted-foreground">部門モジュール内で管理中</p>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{totalDepartments.toLocaleString()} 件</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-base font-semibold">ロール</CardTitle>
            <p className="text-xs text-muted-foreground">権限ロールとユーザー割当</p>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{totalRoles.toLocaleString()} 種類</p>
          </CardContent>
        </Card>
      </div>

      {bulkSummary && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-muted-foreground">
          <span className="font-medium text-primary">最新の一括ステータス結果</span>
          <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 border-emerald-200">
            成功 {bulkSummary.successCount}
          </Badge>
          <Badge variant="secondary" className="bg-amber-100 text-amber-700 border-amber-200">
            失敗 {bulkSummary.failureCount}
          </Badge>
        </div>
      )}

      <Tabs
        value={activeTab}
        onValueChange={(value) => onTabChange(value as 'users' | 'departments' | 'roles')}
        className="space-y-6"
      >
        <TabsList className="grid w-full max-w-xl grid-cols-3">
          <TabsTrigger value="users">ユーザー</TabsTrigger>
          <TabsTrigger value="departments">部門</TabsTrigger>
          <TabsTrigger value="roles">ロール</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="mt-6 space-y-6">
          {usersTab}
        </TabsContent>

        <TabsContent value="departments" className="mt-6 space-y-6">
          {departmentsTab}
        </TabsContent>

        <TabsContent value="roles" className="mt-6 space-y-6">
          {rolesTab}
        </TabsContent>
      </Tabs>
    </div>
  );
}
