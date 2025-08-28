import type { UserDetailResponse, Role } from '@/api/types';

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

/**
 * Role hierarchy mapping for role-based restrictions.
 * Lower numbers represent higher authority levels.
 */
export function getRoleHierarchyLevel(roleName: string): number {
  const hierarchyMap: Record<string, number> = {
    'admin': 1,      // 管理者 - highest authority
    'manager': 2,    // 部門マネジャー
    'supervisor': 3, // 上司・チームリーダー  
    'employee': 4,   // 従業員
    'viewer': 5,     // 閲覧者
    'parttime': 6    // パートタイム - lowest authority
  };
  return hierarchyMap[roleName.toLowerCase()] || 999;
}

/**
 * Get the highest hierarchy level (lowest number) from a list of roles.
 */
export function getHighestRoleHierarchyLevel(roles: Role[]): number {
  if (roles.length === 0) return 999;
  
  const hierarchyLevels = roles.map(role => getRoleHierarchyLevel(role.name));
  return Math.min(...hierarchyLevels);
}

/**
 * Role-based potential supervisors for setup context.
 * Applies role hierarchy rules in addition to basic hierarchy rules.
 */
export function getRoleBasedPotentialSupervisors(
  allUsers: UserDetailResponse[],
  userId: string,
  currentUserRoles: Role[]
): UserDetailResponse[] {
  const currentUserHierarchy = getHighestRoleHierarchyLevel(currentUserRoles);
  
  // Admin users cannot have supervisors (top level)
  if (currentUserHierarchy === 1) return [];
  
  // Get base potential supervisors
  const baseSupervisors = getPotentialSupervisors(allUsers, userId);
  
  // Apply role-based filtering
  return baseSupervisors.filter(potentialSupervisor => {
    if (!potentialSupervisor.roles || potentialSupervisor.roles.length === 0) return false;
    
    const supervisorHierarchy = getHighestRoleHierarchyLevel(potentialSupervisor.roles);
    
    // Only users with higher or equal hierarchy can be supervisors
    return supervisorHierarchy <= currentUserHierarchy;
  });
}

/**
 * Role-based potential subordinates for setup context.
 * Applies role hierarchy rules in addition to basic hierarchy rules.
 */
export function getRoleBasedPotentialSubordinates(
  allUsers: UserDetailResponse[],
  userId: string,
  currentUserRoles: Role[]
): UserDetailResponse[] {
  const currentUserHierarchy = getHighestRoleHierarchyLevel(currentUserRoles);
  
  // Employee/Viewer/Parttime users cannot have subordinates (bottom level)
  if (currentUserHierarchy >= 4) return [];
  
  // Get base potential subordinates
  const baseSubordinates = getPotentialSubordinates(allUsers, userId);
  
  // Apply role-based filtering
  return baseSubordinates.filter(potentialSubordinate => {
    if (!potentialSubordinate.roles || potentialSubordinate.roles.length === 0) return false;
    
    const subordinateHierarchy = getHighestRoleHierarchyLevel(potentialSubordinate.roles);
    
    // Only users with lower hierarchy can be subordinates
    return subordinateHierarchy > currentUserHierarchy;
  });
}

