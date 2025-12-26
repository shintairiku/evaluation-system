import { Suspense } from 'react';
import UserProfilesDataLoader from './UserProfilesDataLoader';
import { ProfilePageSkeleton, DelayedSkeleton } from '@/components/ui/loading-skeleton';

interface UserProfilesRouteProps {
  page: number;
  limit: number;
}

export default function UserProfilesRoute({ page, limit }: UserProfilesRouteProps) {
  return (
    <div className="container mx-auto p-6">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">ユーザー管理</h1>
          <p className="text-muted-foreground">
            組織内のユーザーを検索し、プロフィール情報を管理します
          </p>
        </div>

        <Suspense
          fallback={
            <DelayedSkeleton delay={300}>
              <ProfilePageSkeleton />
            </DelayedSkeleton>
          }
        >
          <UserProfilesDataLoader page={page} limit={limit} />
        </Suspense>
      </div>
    </div>
  );
}

