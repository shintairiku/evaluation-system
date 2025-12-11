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
import { Edit, MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { UserDetailResponse } from '@/api/types';
import UserEditViewModal from './UserEditViewModal';
import { EmptyState } from '@/components/ui/empty-state';
import { MESSAGES } from '@/components/constants/messages';

interface UserTableViewProps {
  users: UserDetailResponse[];
  allUsers: UserDetailResponse[];
  onUserUpdate?: (updatedUser: UserDetailResponse) => void;
}

export default function UserTableView({ users, allUsers, onUserUpdate }: UserTableViewProps) {
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
                    <EmptyState title={MESSAGES.users.emptyTitle} description={MESSAGES.users.emptyDescription} />
                  </TableCell>
                </TableRow>
              ) : (
                users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium max-w-[180px]">
                      <div className="truncate">
                        <div className="font-semibold truncate">{user.name}</div>
                        {user.job_title && (
                          user.job_title.length > 20 ? (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="text-sm text-muted-foreground truncate cursor-help">
                                    {user.job_title}
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>{user.job_title}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          ) : (
                            <div className="text-sm text-muted-foreground truncate">
                              {user.job_title}
                            </div>
                          )
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{user.employee_code}</TableCell>
                    <TableCell className="text-sm">{user.email}</TableCell>
                    <TableCell className="max-w-[150px]">
                      {user.department ? (
                        user.department.name.length > 15 ? (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="cursor-help">
                                  <Badge variant="outline" className="max-w-full block">
                                    <span className="truncate block">{user.department.name}</span>
                                  </Badge>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{user.department.name}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        ) : (
                          <Badge variant="outline">
                            {user.department.name}
                          </Badge>
                        )
                      ) : (
                        <span className="text-muted-foreground">未設定</span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-[180px]">
                      {user.stage ? (
                        user.stage.name.length > 15 ? (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="cursor-help">
                                  <Badge variant="secondary" className="max-w-full block">
                                    <span className="truncate block">{user.stage.name}</span>
                                  </Badge>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{user.stage.name}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        ) : (
                          <Badge variant="secondary">
                            {user.stage.name}
                          </Badge>
                        )
                      ) : (
                        <span className="text-muted-foreground">未設定</span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-[180px]">
                      {user.roles.length > 0 ? (
                        user.roles.length > 2 ? (
                          // 3+ roles: Show first role + "+N" badge with tooltip
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex gap-1 cursor-help">
                                  <Badge variant="outline" className="text-xs max-w-[120px] block">
                                    <span className="truncate block">{user.roles[0].description || user.roles[0].name}</span>
                                  </Badge>
                                  <Badge variant="outline" className="text-xs whitespace-nowrap">
                                    +{user.roles.length - 1}
                                  </Badge>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <div className="flex flex-col gap-1">
                                  {user.roles.map((role) => (
                                    <div key={role.id}>{role.description || role.name}</div>
                                  ))}
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        ) : (
                          // 1-2 roles: Show badges stacked vertically
                          <div className="flex flex-col gap-1">
                            {user.roles.map((role) => (
                              <Badge key={role.id} variant="outline" className="text-xs max-w-full block">
                                <span className="truncate block">{role.description || role.name}</span>
                              </Badge>
                            ))}
                          </div>
                        )
                      ) : (
                        <span className="text-muted-foreground">未設定</span>
                      )}
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
        allUsers={allUsers}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onUserUpdate={onUserUpdate}
      />
    </>
  );
}
