import { getStagesAdminAction } from "@/api/server-actions/stages";
import { getUsersAction } from "@/api/server-actions/users";
import type { StageWithUserCount, UserDetailResponse } from "@/api/types";
import StageManagementBoard from "@/feature/stage-management/display/StageManagementBoard";

export const dynamic = "force-dynamic";

export default async function Page() {
  // Fetch admin-only stages summary; treat failure as forbidden
  const stagesRes = await getStagesAdminAction();
  if (!stagesRes.success || !stagesRes.data) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold">403 - Forbidden</h1>
        <p className="text-muted-foreground mt-2">You do not have permission to access Stage Management.</p>
      </div>
    );
  }

  // Fetch users (admin can view all). Use a high limit for admin overview
  const usersRes = await getUsersAction({ page: 1, limit: 1000 });
  if (!usersRes.success || !usersRes.data) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold">Failed to load users</h1>
        <p className="text-muted-foreground mt-2">Please try again later.</p>
      </div>
    );
  }

  const stages: StageWithUserCount[] = stagesRes.data;
  const users: UserDetailResponse[] = usersRes.data.items;

  return (
    <div className="p-4 md:p-6">
      <div className="mb-4">
        <h1 className="text-2xl font-bold">Stage Management</h1>
        <p className="text-sm text-muted-foreground">Drag and drop users between stages, then save.</p>
      </div>
      <StageManagementBoard stages={stages} users={users} />
    </div>
  );
}


