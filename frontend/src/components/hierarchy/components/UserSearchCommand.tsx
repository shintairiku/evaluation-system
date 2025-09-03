"use client";

import React from 'react';
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { 
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import type { UserDetailResponse } from '@/api/types/user';

interface UserSearchCommandProps {
  placeholder: string;
  emptyMessage: string;
  users: UserDetailResponse[];
  onUserSelect: (userId: string) => void;
  showRemoveOption?: boolean;
  removeOptionLabel?: string;
  onRemove?: () => void;
}

export default function UserSearchCommand({
  placeholder,
  emptyMessage,
  users,
  onUserSelect,
  showRemoveOption = false,
  removeOptionLabel = "なし",
  onRemove
}: UserSearchCommandProps) {
  
  const getUserInitials = (name: string) => {
    return name.split(' ').map(part => part[0]).join('').toUpperCase();
  };

  return (
    <Command>
      <CommandInput placeholder={placeholder} />
      <CommandList>
        <CommandEmpty>{emptyMessage}</CommandEmpty>
        <CommandGroup>
          {showRemoveOption && onRemove && (
            <CommandItem onSelect={onRemove}>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                  <span className="text-xs text-gray-500">×</span>
                </div>
                <span>{removeOptionLabel}</span>
              </div>
            </CommandItem>
          )}
          {users.map((user) => (
            <CommandItem
              key={user.id}
              value={`${user.name} ${user.employee_code} ${user.job_title || ''}`}
              onSelect={() => onUserSelect(user.id)}
            >
              <div className="flex items-center gap-3 w-full">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-blue-100 text-blue-700 text-xs">
                    {getUserInitials(user.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col flex-1">
                  <span className="font-medium text-sm">{user.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {user.employee_code}
                    {user.job_title && ` • ${user.job_title}`}
                  </span>
                </div>
              </div>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </Command>
  );
}