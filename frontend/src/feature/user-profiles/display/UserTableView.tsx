"use client";

import { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, Edit, MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { UserDetailResponse } from '@/api/types';
import UserEditViewModal from './UserEditViewModal';

interface UserTableViewProps {
  users: UserDetailResponse[];
}

export default function UserTableView({ users }: UserTableViewProps) {
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

  return (
    <>
      <Card>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>名前</TableHead>
                <TableHead>従業員コード</TableHead>
                <TableHead>メールアドレス</TableHead>
                <TableHead>部署</TableHead>
                <TableHead>ステージ</TableHead>
                <TableHead>ロール</TableHead>
                <TableHead>ステータス</TableHead>
                <TableHead className="text-right">アクション</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center">
                    該当するユーザーが見つかりませんでした。
                  </TableCell>
                </TableRow>
              ) : (
                users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">
                      <div>
                        <div className="font-semibold">{user.name}</div>
                        {user.job_title && (
                          <div className="text-sm text-muted-foreground">{user.job_title}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{user.employee_code}</TableCell>
                    <TableCell className="text-sm">{user.email}</TableCell>
                    <TableCell>
                      {user.department ? (
                        <Badge variant="outline">{user.department.name}</Badge>
                      ) : (
                        <span className="text-muted-foreground">未設定</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {user.stage ? (
                        <Badge variant="secondary">{user.stage.name}</Badge>
                      ) : (
                        <span className="text-muted-foreground">未設定</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {user.roles.length > 0 ? (
                          user.roles.map((role) => (
                            <Badge key={role.id} variant="outline" className="text-xs">
                              {role.name}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-muted-foreground">未設定</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(user.status)}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">メニューを開く</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEditUser(user.id)}>
                            <Edit className="mr-2 h-4 w-4" />
                            編集
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* ユーザー編集モーダル */}
      <UserEditViewModal
        user={selectedUser}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
      />
    </>
  );
}