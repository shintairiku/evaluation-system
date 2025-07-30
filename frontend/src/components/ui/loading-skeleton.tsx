"use client";

import { cn } from "@/lib/utils";
import { Skeleton } from "./skeleton";
import { useState, useEffect } from 'react';

export interface LoadingSkeletonProps {
  className?: string;
}

// DelayedSkeleton to prevent flashing on fast loads
interface DelayedSkeletonProps {
  children: React.ReactNode;
  delay?: number;
  fallback?: React.ReactNode;
}

export function DelayedSkeleton({ 
  children, 
  delay = 300, 
  fallback = null 
}: DelayedSkeletonProps) {
  const [showSkeleton, setShowSkeleton] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSkeleton(true);
    }, delay);

    return () => clearTimeout(timer);
  }, [delay]);

  if (!showSkeleton) {
    return fallback;
  }

  return <>{children}</>;
}

export function UserProfileSkeleton({ className }: LoadingSkeletonProps) {
  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center space-x-4">
        <Skeleton className="h-16 w-16 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    </div>
  );
}

export function UserListSkeleton({ className }: LoadingSkeletonProps) {
  return (
    <div className={cn("space-y-4", className)}>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center space-x-4 p-4 border rounded-lg">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-1/4" />
          </div>
          <Skeleton className="h-8 w-16" />
        </div>
      ))}
    </div>
  );
}

export function FormSkeleton({ className }: LoadingSkeletonProps) {
  return (
    <div className={cn("space-y-6", className)}>
      <div className="space-y-2">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-10 w-full" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-10 w-full" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-24 w-full" />
      </div>
      <div className="flex space-x-4">
        <Skeleton className="h-10 w-20" />
        <Skeleton className="h-10 w-20" />
      </div>
    </div>
  );
}

export function TableSkeleton({ 
  rows = 5, 
  columns = 4, 
  className 
}: LoadingSkeletonProps & { rows?: number; columns?: number }) {
  return (
    <div className={cn("space-y-2", className)}>
      {/* Header */}
      <div className="flex space-x-4 p-4 border-b">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} className="h-4 flex-1" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex space-x-4 p-4">
          {Array.from({ length: columns }).map((_, colIndex) => (
            <Skeleton key={colIndex} className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function GoalInputSkeleton({ className }: LoadingSkeletonProps) {
  return (
    <div className={cn("space-y-8", className)}>
      {/* Step indicator */}
      <div className="flex justify-center space-x-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-8 rounded-full" />
        ))}
      </div>
      
      {/* Form content */}
      <div className="space-y-6">
        <div className="space-y-4">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
        
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="space-y-4 p-4 border rounded-lg">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ))}
        
        <div className="flex justify-between">
          <Skeleton className="h-10 w-20" />
          <Skeleton className="h-10 w-20" />
        </div>
      </div>
    </div>
  );
}

export function ProfilePageSkeleton({ className }: LoadingSkeletonProps) {
  return (
    <div className={cn("space-y-6 animate-pulse", className)}>
      {/* View Mode Selector */}
      <div className="flex space-x-2">
        <Skeleton className="h-10 w-20" />
        <Skeleton className="h-10 w-20" />
        <Skeleton className="h-10 w-20" />
      </div>

      {/* Search and Filters */}
      <div className="flex space-x-4">
        <Skeleton className="h-10 flex-1" />
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-10 w-24" />
      </div>

      {/* Results count */}
      <Skeleton className="h-4 w-32" />

      {/* User list/table with staggered animation */}
      <div className="space-y-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div 
            key={i} 
            className="flex items-center space-x-4 p-4 border rounded-lg opacity-0 animate-fadeIn"
            style={{ animationDelay: `${i * 100}ms` }}
          >
            <Skeleton className="h-12 w-12 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-1/4" />
            </div>
            <div className="space-x-2 flex">
              <Skeleton className="h-6 w-16" />
              <Skeleton className="h-6 w-16" />
            </div>
            <Skeleton className="h-8 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}

// Enhanced skeleton for search results
export function SearchResultsSkeleton({ count = 3, className }: LoadingSkeletonProps & { count?: number }) {
  return (
    <div className={cn("space-y-3", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div 
          key={i} 
          className="flex items-center space-x-4 p-3 border rounded-lg bg-muted/30 animate-pulse"
          style={{ animationDelay: `${i * 150}ms` }}
        >
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-1">
            <Skeleton className="h-3 w-2/3" />
            <Skeleton className="h-2 w-1/2" />
          </div>
          <Skeleton className="h-6 w-12" />
        </div>
      ))}
    </div>
  );
}