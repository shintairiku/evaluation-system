'use client';

import { useState } from 'react';
import { Check, ChevronsUpDown, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { UserDetailResponse } from '@/api/types';

interface ReviewerSelectorProps {
  /** All users available for selection */
  users: UserDetailResponse[];
  /** Currently selected reviewer ID */
  selectedId: string | null;
  /** IDs to exclude from selection (self + other slot) */
  excludeIds: string[];
  /** Callback when reviewer is selected/cleared */
  onChange: (userId: string | null) => void;
  /** Whether the selector is disabled */
  disabled?: boolean;
}

export function ReviewerSelector({
  users,
  selectedId,
  excludeIds,
  onChange,
  disabled = false,
}: ReviewerSelectorProps) {
  const [open, setOpen] = useState(false);

  const availableUsers = users.filter(u => !excludeIds.includes(u.id));
  const selectedUser = selectedId ? users.find(u => u.id === selectedId) : null;

  return (
    <div className="flex items-center gap-1">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              'w-[180px] justify-between text-left font-normal',
              !selectedUser && 'text-muted-foreground'
            )}
            disabled={disabled}
          >
            <span className="truncate">
              {selectedUser ? selectedUser.name : '評価者を選択...'}
            </span>
            <ChevronsUpDown className="ml-1 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[250px] p-0" align="start">
          <Command>
            <CommandInput placeholder="名前で検索..." />
            <CommandList>
              <CommandEmpty>該当するユーザーが見つかりません</CommandEmpty>
              <CommandGroup>
                {availableUsers.map(user => (
                  <CommandItem
                    key={user.id}
                    value={`${user.name} ${user.department?.name ?? ''}`}
                    onSelect={() => {
                      onChange(user.id === selectedId ? null : user.id);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        user.id === selectedId ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    <div className="flex flex-col">
                      <span className="text-sm">{user.name}</span>
                      {user.department && (
                        <span className="text-xs text-muted-foreground">
                          {user.department.name}
                        </span>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {selectedUser && !disabled && (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={() => onChange(null)}
        >
          <X className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
}
