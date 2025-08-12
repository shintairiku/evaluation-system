import type { UserDetailResponse } from '@/api/types';

/**
 * Returns a set of all subordinate ids (transitive) for a given user id.
 */
function collectSubordinateIds(allUsers: UserDetailResponse[], userId: string): Set<string> {
  const subordinateIds = new Set<string>();

  const collect = (currentUserId: string) => {
    allUsers.forEach((u) => {
      if (u.supervisor?.id === currentUserId) {
        if (!subordinateIds.has(u.id)) {
          subordinateIds.add(u.id);
          collect(u.id);
        }
      }
    });
  };

  collect(userId);
  return subordinateIds;
}

/**
 * Checks if assigning `potentialSubordinateId` somewhere under `supervisorId` would create a cycle.
 * This walks up the supervisor chain starting at `supervisorId` to see if it reaches `potentialSubordinateId`.
 */
export function wouldCreateCircularHierarchy(
  allUsers: UserDetailResponse[],
  supervisorId: string,
  potentialSubordinateId: string
): boolean {
  let currentId: string | undefined = supervisorId;
  const visited = new Set<string>();

  while (currentId && !visited.has(currentId)) {
    if (currentId === potentialSubordinateId) {
      return true;
    }
    visited.add(currentId);
    const currentUserData = allUsers.find((u) => u.id === currentId);
    currentId = currentUserData?.supervisor?.id;
  }

  return false;
}

/**
 * Validate a hierarchy change for a target user.
 * - Cannot be own supervisor
 * - Prevent circular hierarchy
 * Returns localized error message or null if valid.
 */
export function validateHierarchyChange(
  allUsers: UserDetailResponse[],
  targetUserId: string,
  newSupervisorId: string | null
): string | null {
  if (targetUserId === newSupervisorId) {
    return 'ユーザーは自分自身の上司になることはできません';
  }

  if (newSupervisorId) {
    const hasCycle = wouldCreateCircularHierarchy(allUsers, newSupervisorId, targetUserId);
    if (hasCycle) {
      return 'この変更は循環参照を作成するため許可されません';
    }
  }

  return null;
}

/**
 * Potential supervisors for `userId`.
 * - Excludes self
 * - Excludes any of user's (transitive) subordinates
 * - Only active users
 */
export function getPotentialSupervisors(
  allUsers: UserDetailResponse[],
  userId: string
): UserDetailResponse[] {
  const subordinateIds = collectSubordinateIds(allUsers, userId);

  return allUsers.filter(
    (u) => u.id !== userId && !subordinateIds.has(u.id) && u.status === 'active'
  );
}

/**
 * Potential subordinates for `userId`.
 * - Excludes self
 * - Excludes users already supervised by userId
 * - Only active users
 * - Prevents circular hierarchy
 */
export function getPotentialSubordinates(
  allUsers: UserDetailResponse[],
  userId: string
): UserDetailResponse[] {
  return allUsers.filter((u) =>
    u.id !== userId &&
    u.supervisor?.id !== userId &&
    u.status === 'active' &&
    !wouldCreateCircularHierarchy(allUsers, userId, u.id)
  );
}


