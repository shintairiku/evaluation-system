"use client";

import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Search, X } from "lucide-react";
import type { UserDetailResponse } from '@/api/types';

interface FilterBarProps {
  users: UserDetailResponse[];
}

export default function FilterBar({ users }: FilterBarProps) {
  // フィルター用の選択肢を生成（UIのみ）
  const departments = Array.from(new Set(users.map(user => user.department?.name).filter(Boolean))) as string[];
  const stages = Array.from(new Set(users.map(user => user.stage?.name).filter(Boolean))) as string[];
  const roles = Array.from(new Set(users.flatMap(user => user.roles.map(role => role.name))));
  const statuses = Array.from(new Set(users.map(user => user.status)));

  return (
    <div className="flex flex-wrap items-center gap-4 p-4 bg-card rounded-lg border">
      {/* 検索入力 */}
      <div className="relative flex-1 min-w-[300px]">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
        <Input
          placeholder="名前・従業員コード・メールアドレスで検索..."
          className="pl-10"
        />
      </div>

      {/* 部署フィルタ */}
      <Select defaultValue="all">
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="部署を選択" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">すべての部署</SelectItem>
          {departments.map((dept) => (
            <SelectItem key={dept} value={dept}>
              {dept}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* ステージフィルタ */}
      <Select defaultValue="all">
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="ステージを選択" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">すべてのステージ</SelectItem>
          {stages.map((stage) => (
            <SelectItem key={stage} value={stage}>
              {stage}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* ロールフィルタ */}
      <Select defaultValue="all">
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="ロールを選択" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">すべてのロール</SelectItem>
          {roles.map((role) => (
            <SelectItem key={role} value={role}>
              {role}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* ステータスフィルタ */}
      <Select defaultValue="all">
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="ステータスを選択" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">すべてのステータス</SelectItem>
          {statuses.map((status) => (
            <SelectItem key={status} value={status}>
              {status === 'active' && 'アクティブ'}
              {status === 'inactive' && '非アクティブ'}
              {status === 'pending_approval' && '承認待ち'}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* フィルタクリアボタン（UIのみ） */}
      <Button 
        variant="outline" 
        size="sm" 
        className="flex items-center gap-2"
      >
        <X className="w-4 h-4" />
        クリア
      </Button>
    </div>
  );
}