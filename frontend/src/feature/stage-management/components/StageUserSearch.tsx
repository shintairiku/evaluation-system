'use client';

import { useState, useEffect } from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, X } from "lucide-react";

import type { UserDetailResponse } from '@/api/types';
import { useDebounce } from '../hooks/useDebounce';
import { SEARCH_CONFIG } from '../constants';

interface StageUserSearchProps {
  users: UserDetailResponse[];
  onFilteredUsers: (filteredUsers: UserDetailResponse[]) => void;
  className?: string;
}

/**
 * Search component for Stage Management
 * Filters users by name or employee code
 * Fixed positioning for consistent access during scrolling
 */
export default function StageUserSearch({ 
  users, 
  onFilteredUsers, 
  className = "" 
}: StageUserSearchProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, SEARCH_CONFIG.DEBOUNCE_DELAY);

  // Execute search when debounced query changes
  useEffect(() => {
    if (!debouncedSearchQuery.trim()) {
      onFilteredUsers(users);
      return;
    }

    const searchTerm = debouncedSearchQuery.toLowerCase().trim();
    const filtered = users.filter(user => 
      user.name.toLowerCase().includes(searchTerm) ||
      user.employee_code.toLowerCase().includes(searchTerm) ||
      user.email.toLowerCase().includes(searchTerm)
    );

    onFilteredUsers(filtered);
  }, [debouncedSearchQuery, users, onFilteredUsers]);

  // Clear search
  const handleClearSearch = () => {
    setSearchQuery('');
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className={`relative ${SEARCH_CONFIG.MAX_WIDTH}`}>
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
        <Input
          type="text"
          placeholder={SEARCH_CONFIG.PLACEHOLDER}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 pr-10"
        />
        {searchQuery && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearSearch}
            className="absolute right-1 top-1/2 transform -translate-y-1/2 p-1 h-auto"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
      
      {/* Search results count */}
      {searchQuery && (
        <div className="text-sm text-muted-foreground whitespace-nowrap">
          {users.filter(user => 
            user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            user.employee_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
            user.email.toLowerCase().includes(searchQuery.toLowerCase())
          ).length} 件
        </div>
      )}
    </div>
  );
}