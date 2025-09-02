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
  const { NODE_WIDTH, MIN_DEPARTMENT_WIDTH, DEPARTMENT_PADDING, MIN_HORIZONTAL_SPACING } = LAYOUT_CONSTANTS;
  
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
 * Finds root users (users without supervisors within the department)
 */
export function findRootUsers(departmentUsers: OrganizationUser[]): OrganizationUser[] {
  return departmentUsers.filter(user => 
    !user.supervisor || !departmentUsers.find(u => u.id === user.supervisor?.id)
  );
}

/**
 * Calculates dynamic spacing based on user count to prevent overlap
 * Adapts spacing based on density for better scalability
 */
export function calculateDynamicSpacing(userCount: number): number {
  if (userCount <= 3) return 120;        // Few users: comfortable spacing
  if (userCount <= 6) return 100;        // Medium quantity: moderate spacing
  if (userCount <= 10) return 80;        // Many users: compact spacing
  if (userCount <= 15) return 60;        // Very many users: tight spacing
  return 40;                             // Extremely many users: minimal spacing
}

/**
 * Calculates adaptive department width based on user count
 * Ensures adequate space for different department sizes
 */
export function calculateAdaptiveDepartmentWidth(
  userCount: number,
  baseWidth: number = LAYOUT_CONSTANTS.MIN_DEPARTMENT_WIDTH
): number {
  if (userCount <= 3) return baseWidth;
  if (userCount <= 6) return baseWidth + 200;
  if (userCount <= 10) return baseWidth + 400;
  if (userCount <= 15) return baseWidth + 600;
  return baseWidth + 800; // For very large departments
}

/**
 * Determines optimal layout strategy based on user count
 * Provides different layout approaches for scalability
 */
export function getOptimalLayoutStrategy(userCount: number): 'horizontal' | 'grid-2' | 'grid-3' | 'compact' {
  if (userCount <= 4) return 'horizontal';      // Single row layout
  if (userCount <= 8) return 'grid-2';          // 2-column grid
  if (userCount <= 12) return 'grid-3';         // 3-column grid
  return 'compact';                              // Compact layout for many users
}