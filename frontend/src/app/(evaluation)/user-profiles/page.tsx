import UserProfilesRoute from '@/feature/user-profiles/display/UserProfilesRoute';

interface UserProfilesPageProps {
  searchParams: Promise<{
    page?: string;
    limit?: string;
  }>;
}

export default async function UserProfilesPage({ searchParams }: UserProfilesPageProps) {
  const resolvedSearchParams = await searchParams;

  const page = parseInt(resolvedSearchParams.page || '1', 10);
  const limit = parseInt(resolvedSearchParams.limit || '50', 10);

  return <UserProfilesRoute page={page} limit={limit} />;
}
