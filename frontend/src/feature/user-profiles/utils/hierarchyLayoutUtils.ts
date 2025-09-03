/**
 * Utility functions for calculating hierarchy layouts in organization charts
 */
import type { UserDetailResponse, SimpleUser } from '@/api/types';

type OrganizationUser = UserDetailResponse | SimpleUser;

export interface HierarchyDimensions {
  width: number;
  leftBound: number;
  rightBound: number;
}

export interface LayoutConstants {
  NODE_WIDTH: number;
  MIN_HORIZONTAL_SPACING: number;
  VERTICAL_SPACING: number;
  DEPARTMENT_PADDING: number;
  MIN_DEPARTMENT_WIDTH: number;
}

export const LAYOUT_CONSTANTS: LayoutConstants = {
  NODE_WIDTH: 288, // w-72 user card width
  MIN_HORIZONTAL_SPACING: 100, // Increased minimum spacing between user cards to prevent overlap
  VERTICAL_SPACING: 500, // Vertical spacing between hierarchy levels
  DEPARTMENT_PADDING: 250, // Increased padding around department content
  MIN_DEPARTMENT_WIDTH: 700, // Increased minimum department width for better spacing
} as const;

/**
 * Calculates the width needed for a user hierarchy
 */
export function calculateHierarchyWidth(
  user: OrganizationUser,
  departmentUsers: OrganizationUser[]
): HierarchyDimensions {
  const { NODE_WIDTH, MIN_HORIZONTAL_SPACING } = LAYOUT_CONSTANTS;
  
  // Find subordinates within the department
  const subordinates = departmentUsers.filter(u => u.supervisor?.id === user.id);
  
  if (subordinates.length === 0) {
    // Leaf node
    return {
      width: NODE_WIDTH,
      leftBound: 0,
      rightBound: NODE_WIDTH
    };
  }
  
  // Calculate total width of all subordinates
  let totalSubordinateWidth = 0;
  subordinates.forEach(subordinate => {
    const result = calculateHierarchyWidth(subordinate, departmentUsers);
    totalSubordinateWidth += result.width;
  });
  
  // Add spacing between subordinates
  totalSubordinateWidth += (subordinates.length - 1) * MIN_HORIZONTAL_SPACING;
  
  return {
    width: Math.max(NODE_WIDTH, totalSubordinateWidth),
    leftBound: 0,
    rightBound: Math.max(NODE_WIDTH, totalSubordinateWidth)
  };
}

/**
 * Calculates the required width for a department based on its user hierarchies
 */
export function calculateDepartmentWidth(
  rootUsers: OrganizationUser[],
  departmentUsers: OrganizationUser[]
): number {
  const { NODE_WIDTH, MIN_DEPARTMENT_WIDTH, DEPARTMENT_PADDING } = LAYOUT_CONSTANTS;
  
  if (rootUsers.length === 0) {
    return 320; // Minimal width for empty departments
  }
  
  if (rootUsers.length === 1) {
    // Single user - calculate hierarchy width
    const rootWidth = calculateHierarchyWidth(rootUsers[0], departmentUsers);
    return Math.max(MIN_DEPARTMENT_WIDTH, rootWidth.width + DEPARTMENT_PADDING);
  }
  
  // Multiple users - calculate layout with dynamic spacing
  const dynamicSpacing = calculateDynamicSpacing(rootUsers.length);
  const totalSpacing = (rootUsers.length - 1) * (NODE_WIDTH + dynamicSpacing);
  const totalWidth = (rootUsers.length * NODE_WIDTH) + totalSpacing;
  const requiredWidth = totalWidth + 250; // Adaptive padding based on user count
  
  return Math.max(MIN_DEPARTMENT_WIDTH, requiredWidth);
}

/**
 * Returns all department users for flat layout display
 * In the new approach, we don't use supervisor-subordinate relationships for initial layout
 * All users in a department are shown at the same level initially
 * Hierarchy is built dynamically via click actions and API calls
 */
export function findRootUsers(departmentUsers: OrganizationUser[]): OrganizationUser[] {
  // Return ALL users in the department for flat layout
  // Hierarchy will be built dynamically through user clicks and API calls
  return departmentUsers;
}

/**
 * Calculates dynamic spacing based on item count to prevent overlap
 * Adapts spacing based on density for better scalability
 * Can be used for both users and departments
 */
export function calculateDynamicSpacing(itemCount: number): number {
  if (itemCount <= 3) return 150;        // Few items: comfortable spacing
  if (itemCount <= 6) return 120;        // Medium quantity: moderate spacing
  if (itemCount <= 10) return 100;       // Many items: compact spacing
  if (itemCount <= 15) return 80;        // Very many items: tight spacing
  return 60;                             // Extremely many items: minimal spacing
}

/**
 * Gets all top users from department based on role hierarchy
 * Priority: Admin → Manager → Supervisor → Employee → Part-time
 * Returns ALL users of the highest priority level found in the department
 * Example: If department has 2 admins and 3 managers, returns the 2 admins
 */
export function getTopUsersByRole(departmentUsers: OrganizationUser[]): OrganizationUser[] {
  if (!departmentUsers || departmentUsers.length === 0) {
    return [];
  }

  // Role hierarchy from highest to lowest priority
  const rolePriority = ['admin', 'manager', 'supervisor', 'employee', 'part-time'];
  
  // Search for users by role priority and return ALL users of the first matching level
  for (const roleType of rolePriority) {
    const usersWithRole = departmentUsers.filter(user => 
      user.roles?.some(role => 
        role.name.toLowerCase().includes(roleType)
      )
    );
    
    // If we found users with this role, return ALL of them
    if (usersWithRole.length > 0) {
      return usersWithRole;
    }
  }
  
  // Fallback: return only the first user if no specific role found
  return departmentUsers.length > 0 ? [departmentUsers[0]] : [];
}

/**
 * Gets the top user from department based on role hierarchy (legacy single user version)
 * Priority: Admin → Manager → Supervisor → Employee → Part-time
 * Returns the first user of the highest priority level found in the department
 */
export function getTopUserByRole(departmentUsers: OrganizationUser[]): OrganizationUser | null {
  const topUsers = getTopUsersByRole(departmentUsers);
  return topUsers.length > 0 ? topUsers[0] : null;
}

