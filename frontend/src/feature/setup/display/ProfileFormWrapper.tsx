"use client";

import { useState, useEffect } from 'react';
import ProfileForm from './ProfileForm';
import ClerkInfoCard from '@/components/display/ClerkInfoCard';
import { getProfileOptionsAction } from '@/api/server-actions/auth';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { FormSkeleton } from '@/components/ui/loading-skeleton';
import type { ProfileOptionsResponse } from '@/api/types/user';

interface ProfileFormWrapperProps {
  orgId?: string | null;
}

export default function ProfileFormWrapper({ orgId }: ProfileFormWrapperProps) {
  const [options, setOptions] = useState<ProfileOptionsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchOptions() {
      try {
        const result = await getProfileOptionsAction(orgId || undefined);

        if (result.success && result.data) {
          setOptions(result.data);
          setError(null);
        } else {
          setError(result.error || 'Failed to fetch profile options');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch profile options');
      } finally {
        setIsLoading(false);
      }
    }

    fetchOptions();
  }, [orgId]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="mb-6">
          <ClerkInfoCard />
        </div>
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <LoadingSpinner 
            size="lg" 
            text="プロフィール設定を読み込み中..." 
            className="py-8"
          />
          <div className="mt-6">
            <FormSkeleton />
          </div>
        </div>
      </div>
    );
  }

  if (error || !options) {
    return (
      <div className="text-center py-8">
        <h2 className="text-xl font-bold text-red-600 mb-4">エラー</h2>
        <p className="text-gray-600 mb-4">
          プロフィール設定に必要な情報の取得に失敗しました。
        </p>
        <p className="text-sm text-gray-500">
          エラー: {error || 'Unknown error'}
        </p>
        <div className="mt-4">
          <button 
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            再試行
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <ClerkInfoCard />
      <ProfileForm 
        departments={options.departments}
        stages={options.stages}
        roles={options.roles}
        users={options.users}
      />
    </div>
  );
} 