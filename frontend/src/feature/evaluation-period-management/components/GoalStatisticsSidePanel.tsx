'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import SidePanel from '@/components/ui/side-panel';
import {
  BarChart3,
  Users,
  Search,
  Calendar,
  User,
  Building,
  Clock,
  Target
} from 'lucide-react';
import { formatDateForDisplay } from '@/lib/evaluation-period-utils';
import type { GoalStatisticsSidePanelProps, UserActivityTableProps } from '../types';

function UserActivityTable({ goalStats, onUserClick }: UserActivityTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'department' | 'goals' | 'lastActivity'>('name');
  const [filterDepartment, setFilterDepartment] = useState<string>('all');

  // Get unique departments for filter
  const departments = Array.from(
    new Set(goalStats.user_activities.map(user => user.department_name))
  ).sort();

  // Filter and sort users
  const filteredAndSortedUsers = goalStats.user_activities
    .filter(user => {
      const matchesSearch = user.user_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           user.employee_code.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesDepartment = filterDepartment === 'all' || user.department_name === filterDepartment;
      return matchesSearch && matchesDepartment;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.user_name.localeCompare(b.user_name);
        case 'department':
          return a.department_name.localeCompare(b.department_name);
        case 'goals':
          return b.goal_count - a.goal_count;
        case 'lastActivity':
          const aDate = a.last_goal_submission ? new Date(a.last_goal_submission) : new Date(0);
          const bDate = b.last_goal_submission ? new Date(b.last_goal_submission) : new Date(0);
          return bDate.getTime() - aDate.getTime();
        default:
          return 0;
      }
    });

  return (
    <div className="space-y-4 p-6">
      {/* Filters and Search */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
            <Input
              placeholder="ユーザー名または社員番号で検索..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <div>
          <Select value={filterDepartment} onValueChange={setFilterDepartment}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部門</SelectItem>
              {departments.map(dept => (
                <SelectItem key={dept} value={dept}>{dept}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Select value={sortBy} onValueChange={(value: 'name' | 'department' | 'goals' | 'lastActivity') => setSortBy(value)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name">名前順</SelectItem>
              <SelectItem value="department">部門順</SelectItem>
              <SelectItem value="goals">目標数順</SelectItem>
              <SelectItem value="lastActivity">最終活動順</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* User Activity Table - Optimized for wider layout */}
      <div className="border rounded-lg overflow-hidden">
        <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 400px)' }}>
          <table className="w-full">
            <thead className="bg-gray-50 sticky top-0">
              <tr className="text-left">
                <th className="p-4 font-medium text-gray-900">ユーザー情報</th>
                <th className="p-4 font-medium text-gray-900">部門・役職</th>
                <th className="p-4 font-medium text-gray-900">関係</th>
                <th className="p-4 font-medium text-gray-900">最終活動</th>
                <th className="p-4 font-medium text-gray-900 text-right">目標統計</th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSortedUsers.map(user => (
                <tr
                  key={user.user_id}
                  className={`border-b hover:bg-gray-50 ${
                    onUserClick ? 'cursor-pointer' : ''
                  }`}
                  onClick={() => onUserClick?.(user.user_id)}
                >
                  {/* User Basic Info */}
                  <td className="p-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <User size={16} className="text-gray-400" />
                        <span className="font-medium text-gray-900">{user.user_name}</span>
                      </div>
                      <div className="text-sm text-gray-500">({user.employee_code})</div>
                    </div>
                  </td>

                  {/* Department & Role */}
                  <td className="p-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Building size={14} />
                        <span>{user.department_name}</span>
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {user.user_role}
                      </Badge>
                    </div>
                  </td>

                  {/* Relationships */}
                  <td className="p-4">
                    <div className="space-y-1 text-sm text-gray-600">
                      {user.supervisor_name && (
                        <div>上司: {user.supervisor_name}</div>
                      )}
                      {user.subordinate_name && (
                        <div>部下: {user.subordinate_name}</div>
                      )}
                      {!user.supervisor_name && !user.subordinate_name && (
                        <span className="text-gray-400">-</span>
                      )}
                    </div>
                  </td>

                  {/* Last Activity */}
                  <td className="p-4">
                    <div className="space-y-1 text-sm text-gray-600">
                      {user.last_goal_submission && (
                        <div className="flex items-center gap-1">
                          <Target size={12} />
                          <span>目標: {formatDateForDisplay(user.last_goal_submission)}</span>
                        </div>
                      )}
                      {user.last_review_submission && (
                        <div className="flex items-center gap-1">
                          <Clock size={12} />
                          <span>評価: {formatDateForDisplay(user.last_review_submission)}</span>
                        </div>
                      )}
                      {!user.last_goal_submission && !user.last_review_submission && (
                        <span className="text-gray-400">未実施</span>
                      )}
                    </div>
                  </td>

                  {/* Goal Statistics */}
                  <td className="p-4 text-right">
                    <div className="space-y-2">
                      <div className="text-lg font-semibold text-gray-900">
                        {user.goal_count} 目標
                      </div>
                      <div className="flex flex-wrap gap-1 justify-end">
                        {Object.entries(user.goal_statuses).map(([status, count]) => (
                          <Badge
                            key={status}
                            variant="outline"
                            className="text-xs"
                          >
                            {status}: {count}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Results Summary */}
      <div className="text-sm text-gray-600 text-center py-4">
        {filteredAndSortedUsers.length} / {goalStats.user_activities.length} ユーザー表示
      </div>

      {/* Empty State */}
      {filteredAndSortedUsers.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <Users size={48} className="mx-auto mb-4 text-gray-300" />
          <p>条件に一致するユーザーが見つかりません</p>
        </div>
      )}
    </div>
  );
}

export default function GoalStatisticsSidePanel({
  isOpen,
  onClose,
  period,
  goalStats,
  isLoading
}: GoalStatisticsSidePanelProps) {
  return (
    <SidePanel
      isOpen={isOpen}
      onClose={onClose}
      title={`目標統計 - ${period.name}`}
      defaultWidth={85}
      minWidth={60}
      maxWidth={95}
      persistWidthKey="goalStatistics"
      className="overflow-y-auto"
    >
      <div className="space-y-6 p-6">
        {/* Period Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Calendar size={18} />
              評価期間情報
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 lg:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-gray-600">期間:</span>
              <p className="font-medium">{formatDateForDisplay(period.start_date)} ～ {formatDateForDisplay(period.end_date)}</p>
            </div>
            <div>
              <span className="text-gray-600">目標提出期限:</span>
              <p className="font-medium">{formatDateForDisplay(period.goal_submission_deadline)}</p>
            </div>
            <div>
              <span className="text-gray-600">評価期限:</span>
              <p className="font-medium">{formatDateForDisplay(period.evaluation_deadline)}</p>
            </div>
          </CardContent>
        </Card>

        {/* Loading State */}
        {isLoading && (
          <Card>
            <CardHeader>
              <CardTitle>統計情報を読み込み中...</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-8 w-full" />
                  </div>
                ))}
              </div>
              <Skeleton className="h-32 w-full" />
            </CardContent>
          </Card>
        )}

        {/* Goal Statistics Summary */}
        {goalStats && !isLoading && (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target size={18} />
                  目標統計サマリー
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <div className="text-2xl font-bold text-blue-700">{goalStats.total}</div>
                    <div className="text-sm text-blue-600">総目標数</div>
                  </div>
                  {Object.entries(goalStats.by_status).map(([status, count]) => (
                    <div key={status} className="text-center p-4 bg-gray-50 rounded-lg">
                      <div className="text-2xl font-bold text-gray-700">{count}</div>
                      <div className="text-sm text-gray-600">{status}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {/* Error State */}
        {!goalStats && !isLoading && (
          <Card>
            <CardContent className="text-center py-8">
              <BarChart3 size={48} className="mx-auto mb-4 text-gray-300" />
              <p className="text-gray-500 mb-2">統計データを取得できませんでした</p>
              <Button
                variant="outline"
                onClick={() => window.location.reload()}
              >
                再試行
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* User Activity Table - Outside the padding container for full width */}
      {goalStats && !isLoading && (
        <div className="border-t bg-gray-50">
          <div className="p-6 border-b bg-white">
            <h3 className="flex items-center gap-2 text-lg font-semibold">
              <Users size={18} />
              ユーザー活動詳細 ({goalStats.user_activities.length}人)
            </h3>
          </div>
          <UserActivityTable
            goalStats={goalStats}
            onUserClick={(userId) => {
              // TODO: Navigate to user detail or goal list
              console.log('User clicked:', userId);
            }}
          />
        </div>
      )}
    </SidePanel>
  );
}