"use client";

import { useAuth } from '@clerk/nextjs';
import { useEffect, useState } from 'react';
import { getProfileOptionsAction } from '@/api/server-actions/auth';
import ClerkInfoCard from '@/components/display/ClerkInfoCard';
import ProfileForm from '@/feature/setup/display/ProfileForm';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import type { ProfileOptionsResponse } from '@/api/types';

export default function SetupPageClient() {
  const { orgId, isLoaded } = useAuth();
  const [profileOptions, setProfileOptions] = useState<ProfileOptionsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchProfileOptions() {
      if (!isLoaded || !orgId) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        console.log('Fetching profile options for orgId:', orgId);
        const result = await getProfileOptionsAction(orgId);
        console.log('Profile options result:', result);

        if (result.success && result.data) {
          setProfileOptions(result.data);
        } else {
          setError(result.error || 'Failed to fetch profile options');
        }
      } catch (err) {
        console.error('Error fetching profile options:', err);
        setError('An unexpected error occurred');
      } finally {
        setIsLoading(false);
      }
    }

    fetchProfileOptions();
  }, [orgId, isLoaded]);

  if (!isLoaded || isLoading) {
    return (
      <div className="container mx-auto max-w-2xl py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold mb-2">プロフィール設定</h1>
          <p className="text-gray-600">
            システムを利用するために必要な情報を入力してください。
          </p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <LoadingSpinner
            size="lg"
            text="プロフィール設定を読み込み中..."
            className="py-8"
          />
        </div>
      </div>
    );
  }

  if (!orgId) {
    return (
      <div className="container mx-auto max-w-2xl py-8">
        <div className="text-center py-8">
          <h2 className="text-xl font-bold text-red-600 mb-4">エラー</h2>
          <p className="text-gray-600 mb-4">
            組織のコンテキストが見つかりません。
          </p>
          <div className="mt-4">
            <a
              href="/org"
              className="inline-block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              組織を選択
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto max-w-2xl py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold mb-2">プロフィール設定</h1>
          <p className="text-gray-600">
            システムを利用するために必要な情報を入力してください。
          </p>
        </div>

        <div className="text-center py-8">
          <h2 className="text-xl font-bold text-red-600 mb-4">エラー</h2>
          <p className="text-gray-600 mb-4">
            プロフィール設定に必要な情報の取得に失敗しました。
          </p>
          <p className="text-sm text-gray-500">
            エラー: {error}
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
      </div>
    );
  }

  if (!profileOptions) {
    return (
      <div className="container mx-auto max-w-2xl py-8">
        <div className="text-center py-8">
          <p className="text-gray-600">データが見つかりません。</p>
        </div>
      </div>
    );
  }

  const { departments, stages, roles, users } = profileOptions;

  return (
    <div className="container mx-auto max-w-2xl py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">プロフィール設定</h1>
        <p className="text-gray-600">
          システムを利用するために必要な情報を入力してください。
        </p>
      </div>

      <div>
        <ClerkInfoCard />
        <ProfileForm
          departments={departments}
          stages={stages}
          roles={roles}
          users={users}
        />
      </div>
    </div>
  );
}