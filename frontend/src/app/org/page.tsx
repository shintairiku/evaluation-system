'use client';

import { OrganizationSwitcher, OrganizationProfile } from '@clerk/nextjs';
import { useAuth } from '@clerk/nextjs';
import { useState } from 'react';

export default function OrgPage() {
  const { orgId } = useAuth();
  const [view, setView] = useState<'switcher' | 'profile'>('switcher');

  return (
    <div className="flex flex-col items-center gap-8 p-10">
      {view === 'switcher' ? (
        <>
          <h1 className="text-2xl font-semibold">組織を選択</h1>
          <OrganizationSwitcher
            afterSelectOrganizationUrl="/"
            afterCreateOrganizationUrl="/"
            hidePersonal
          />
          {orgId && (
            <button
              onClick={() => setView('profile')}
              className="mt-4 px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors"
            >
              組織設定を管理
            </button>
          )}
          <p className="text-sm text-muted-foreground">組織アカウントのみサポートされています。</p>
        </>
      ) : (
        <>
          <div className="flex items-center gap-4 mb-4">
            <button
              onClick={() => setView('switcher')}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
            >
              ← 戻る
            </button>
            <h1 className="text-2xl font-semibold">組織設定</h1>
          </div>
          <OrganizationProfile
            afterLeaveOrganizationUrl="/org"
          />
        </>
      )}
    </div>
  );
}


