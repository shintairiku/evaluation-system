import { Suspense } from 'react';
import UserProfilesDataLoader from "@/feature/user-profiles/display/UserProfilesDataLoader";
import { ProfilePageSkeleton, DelayedSkeleton } from '@/components/ui/loading-skeleton';

interface UserProfilesPageProps {
  searchParams: {
    page?: string;
    limit?: string;
  };
}

export default async function UserProfilesPage({ searchParams }: UserProfilesPageProps) {
  // Await searchParams for Next.js 15 compatibility
  const resolvedSearchParams = await searchParams;
  
  // Parse pagination parameters from URL
  const page = parseInt(resolvedSearchParams.page || '1', 10);
  const limit = parseInt(resolvedSearchParams.limit || '50', 10);
  
  return (
    <div className="container mx-auto p-6">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">ユーザー管理</h1>
          <p className="text-muted-foreground">
            組織内のユーザーを検索し、プロフィール情報を管理します
          </p>
        </div>
        
        <Suspense fallback={
          <DelayedSkeleton delay={300}>
            <ProfilePageSkeleton />
          </DelayedSkeleton>
        }>
          <UserProfilesDataLoader page={page} limit={limit} />
        </Suspense>
      </div>
    </div>
  );
}