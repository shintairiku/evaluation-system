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
  MIN_HORIZONTAL_SPACING: 25, // Minimum spacing between user cards
  VERTICAL_SPACING: 500, // Vertical spacing between hierarchy levels
  DEPARTMENT_PADDING: 150, // Padding around department content
  MIN_DEPARTMENT_WIDTH: 500, // Minimum department width
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
  
  // Multiple users - calculate compact layout
  const minSpacing = 30;
  const totalSpacing = (rootUsers.length - 1) * (NODE_WIDTH + minSpacing);
  const totalWidth = (rootUsers.length * NODE_WIDTH) + totalSpacing;
  const requiredWidth = totalWidth + 100; // Minimal padding
  
  return Math.max(MIN_DEPARTMENT_WIDTH, requiredWidth);
}

/**
 * Finds root users (users without supervisors within the department)
 */
export function findRootUsers(departmentUsers: OrganizationUser[]): OrganizationUser[] {
  return departmentUsers.filter(user => 
    !user.supervisor || !departmentUsers.find(u => u.id === user.supervisor?.id)
  );
}