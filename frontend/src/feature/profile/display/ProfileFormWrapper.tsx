"use client";

import { useState, useEffect } from 'react';
import ProfileForm from './ProfileForm';
import ClerkInfoCard from '@/components/display/ClerkInfoCard';
import type { ProfileOptionsResponse } from '@/api/types/user';
import { getProfileOptionsAction } from '@/api/server-actions/users';

export default function ProfileFormWrapper() {
  const [options, setOptions] = useState<ProfileOptionsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        console.log('ProfileFormWrapper: Starting server action...');
        const result = await getProfileOptionsAction();
        console.log('ProfileFormWrapper: Server action result:', result);
        
        if (!result.success || !result.data) {
          console.error('ProfileFormWrapper: Server action failed:', result.error);
          throw new Error(result.error || 'Failed to fetch profile options');
        }
        
        console.log('ProfileFormWrapper: Data received:', result.data);
        setOptions(result.data);
      } catch (err) {
        console.error('ProfileFormWrapper: Error:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch profile options');
      } finally {
        setLoading(false);
      }
    };

    fetchOptions();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">プロフィール設定を読み込み中...</p>
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