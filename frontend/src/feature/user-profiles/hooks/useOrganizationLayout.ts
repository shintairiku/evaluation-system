/**
 * Custom hook for managing organization chart layout logic
 */
import { useMemo } from 'react';
import type { Node, Edge } from 'reactflow';
import { MarkerType } from 'reactflow';
import type { UserDetailResponse, SimpleUser, Department } from '@/api/types';
import { 
  calculateDepartmentWidth, 
  findRootUsers, 
  LAYOUT_CONSTANTS,
  calculateDynamicSpacing,
  getOptimalLayoutStrategy
} from '../utils/hierarchyLayoutUtils';

type OrganizationUser = UserDetailResponse | SimpleUser;

interface UseOrganizationLayoutParams {
  users: OrganizationUser[];
  departments: Department[];
  expandedDepartments: Set<string>;
  onDepartmentClick: (departmentId: string) => void;
}

interface LayoutResult {
  width: number;
  leftBound: number;
  rightBound: number;
}

export function useOrganizationLayout({
  users,
  departments,
  expandedDepartments,
  onDepartmentClick
}: UseOrganizationLayoutParams) {
  
  // Group users by department
  const organizationStructure = useMemo(() => {
    const departmentUsers = new Map<string, OrganizationUser[]>();
    
    departments.forEach(dept => {
      const deptUsers = users.filter(u => u.department?.id === dept.id);
      departmentUsers.set(dept.id, deptUsers);
    });
    
    return departmentUsers;
  }, [users, departments]);

  // Generate nodes and edges for the organization chart
  const { nodes, edges } = useMemo(() => {
    const nodeList: Node[] = [];
    const edgeList: Edge[] = [];

    // Calculate department widths with normalization for better spacing
    const departmentWidths = departments.map(department => {
      const deptUsers = organizationStructure.get(department.id) || [];
      
      if (expandedDepartments.has(department.id) && deptUsers.length > 0) {
        const roots = findRootUsers(deptUsers);
        const calculatedWidth = calculateDepartmentWidth(roots, deptUsers);
        
        // Normalize expanded department widths to reduce extreme variations
        // This prevents some departments from being much wider than others
        const userCount = deptUsers.length;
        if (userCount <= 3) return Math.min(calculatedWidth, 1000);  // Cap small departments
        if (userCount <= 6) return Math.min(calculatedWidth, 1400);  // Cap medium departments  
        if (userCount <= 10) return Math.min(calculatedWidth, 1800); // Cap large departments
        return Math.min(calculatedWidth, 2200); // Cap very large departments
      } else {
        return 280; // Collapsed department width
      }
    });

    // Position company and departments with adaptive spacing
    const startX = 200;
    
    // Calculate adaptive spacing based on department count and expansion state
    const expandedCount = departments.filter(dept => expandedDepartments.has(dept.id)).length;
    const DEPARTMENT_SPACING = expandedCount > 2 ? 100 : 150; // Reduce spacing when many expanded
    
    // Calculate total width including consistent spacing
    const totalSpacing = (departmentWidths.length - 1) * DEPARTMENT_SPACING;
    const totalDepartmentsWidth = departmentWidths.reduce((sum, width) => sum + width, 0);
    const totalLayoutWidth = totalDepartmentsWidth + totalSpacing;
    
    const companyX = startX + (totalLayoutWidth / 2) - 128; // Center company above departments

    // Add company node
    nodeList.push({
      id: 'company-root',
      type: 'orgNode',
      position: { x: companyX, y: 0 },
      data: { 
        name: '株式会社新大陸',
        userCount: users.length,
        isDepartment: true
      }
    });

    // Add department nodes and user hierarchies
    let currentX = startX;
    departments.forEach((department, index) => {
      const deptUsers = organizationStructure.get(department.id) || [];
      const userCount = deptUsers.length;

      // Add department node
      nodeList.push({
        id: department.id,
        type: 'orgNode',
        position: { x: currentX, y: 200 },
        data: { 
          name: department.name,
          userCount,
          isDepartment: false,
          onClick: () => onDepartmentClick(department.id)
        }
      });

      // Add company to department edge
      edgeList.push({
        id: `company-${department.id}`,
        source: 'company-root',
        target: department.id,
        sourceHandle: 'bottom',
        targetHandle: 'top',
        type: 'smoothstep',
        style: { 
          stroke: '#3b82f6', 
          strokeWidth: 3,
          opacity: 0.8
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 20,
          height: 20,
          color: '#3b82f6',
        },
      });

      // Add user nodes if department is expanded
      if (expandedDepartments.has(department.id) && deptUsers.length > 0) {
        const roots = findRootUsers(deptUsers);
        const departmentCenterX = currentX + 128; // Center of department card
        const departmentAllocatedWidth = departmentWidths[index];
        const allocatedSpaceCenter = currentX + (departmentAllocatedWidth / 2);
        
        // Choose centering strategy based on available space
        const safeCenterX = departmentAllocatedWidth > 400 ? departmentCenterX : allocatedSpaceCenter;

        if (roots.length === 1) {
          // Single user - center it
          layoutUserHierarchy(roots[0], 0, safeCenterX, deptUsers, nodeList, edgeList);
        } else {
          // Multiple users - distribute evenly with dynamic spacing
          const { NODE_WIDTH } = LAYOUT_CONSTANTS;
          const dynamicSpacing = calculateDynamicSpacing(roots.length);
          const totalSpacing = (roots.length - 1) * dynamicSpacing;
          const totalWidth = (roots.length * NODE_WIDTH) + totalSpacing;
          
          const maxAvailableWidth = departmentAllocatedWidth - 250; // Adaptive padding
          const actualSpacing = totalWidth <= maxAvailableWidth 
            ? dynamicSpacing 
            : Math.max(60, (maxAvailableWidth - (roots.length * NODE_WIDTH)) / (roots.length - 1));
          
          const groupWidth = (roots.length * NODE_WIDTH) + ((roots.length - 1) * actualSpacing);
          const startX = safeCenterX - (groupWidth / 2) + (NODE_WIDTH / 2);
          
          roots.forEach((rootUser, rootIndex) => {
            const userX = startX + (rootIndex * (NODE_WIDTH + actualSpacing));
            layoutUserHierarchy(rootUser, 0, userX, deptUsers, nodeList, edgeList);
          });
        }

        // Add department to root user edges
        roots.forEach((rootUser) => {
          const edgeType = roots.length === 1 ? 'straight' : 'smoothstep';
          
          edgeList.push({
            id: `${department.id}-user-${rootUser.id}`,
            source: department.id,
            target: `user-${rootUser.id}`,
            sourceHandle: 'bottom',
            targetHandle: 'top',
            type: edgeType,
            style: { 
              stroke: '#3b82f6', 
              strokeWidth: 3,
              opacity: 0.8
            },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              width: 20,
              height: 20,
              color: '#3b82f6',
            },
          });
        });

        // Add supervisor-subordinate edges
        deptUsers.forEach(user => {
          if (user.supervisor) {
            const supervisor = deptUsers.find(u => u.id === user.supervisor?.id);
            if (supervisor) {
              edgeList.push({
                id: `user-${supervisor.id}-user-${user.id}`,
                source: `user-${supervisor.id}`,
                target: `user-${user.id}`,
                sourceHandle: 'bottom',
                targetHandle: 'top',
                type: 'smoothstep',
                style: { 
                  stroke: '#3b82f6', 
                  strokeWidth: 3,
                  opacity: 0.8
                },
                markerEnd: {
                  type: MarkerType.ArrowClosed,
                  width: 20,
                  height: 20,
                  color: '#3b82f6',
                },
              });
            }
          }
        });
      }

      currentX += departmentWidths[index] + DEPARTMENT_SPACING;
    });

    return { nodes: nodeList, edges: edgeList };
  }, [departments, users, organizationStructure, expandedDepartments, onDepartmentClick]);

  return { nodes, edges };
}

// Helper function to layout user hierarchies
function layoutUserHierarchy(
  user: OrganizationUser,
  level: number,
  xCenter: number,
  departmentUsers: OrganizationUser[],
  nodeList: Node[],
  edgeList: Edge[]
): LayoutResult {
  const { NODE_WIDTH, MIN_HORIZONTAL_SPACING, VERTICAL_SPACING } = LAYOUT_CONSTANTS;
  const userY = 450 + level * VERTICAL_SPACING;
  
  // Find subordinates
  const subordinates = departmentUsers.filter(u => u.supervisor?.id === user.id);
  
  if (subordinates.length === 0) {
    // Leaf node
    nodeList.push({
      id: `user-${user.id}`,
      type: 'userNode',
      position: { x: xCenter - NODE_WIDTH/2, y: userY },
      data: { user }
    });
    
    return { 
      width: NODE_WIDTH, 
      leftBound: xCenter - NODE_WIDTH/2, 
      rightBound: xCenter + NODE_WIDTH/2 
    };
  }
  
  // Layout subordinates first with dynamic spacing
  const subordinateResults: LayoutResult[] = [];
  
  // Calculate total width needed for subordinates including dynamic spacing
  const dynamicSpacing = calculateDynamicSpacing(subordinates.length);
  const totalSubordinateWidth = subordinates.reduce((sum, _, index) => {
    return sum + NODE_WIDTH + (index > 0 ? dynamicSpacing : 0);
  }, 0);
  
  const subordinatesStartX = xCenter - (totalSubordinateWidth / 2);
  let currentSubordinateX = subordinatesStartX;
  
  subordinates.forEach((subordinate) => {
    const subCenterX = currentSubordinateX + (NODE_WIDTH / 2);
    const subResult = layoutUserHierarchy(subordinate, level + 1, subCenterX, departmentUsers, nodeList, edgeList);
    subordinateResults.push(subResult);
    currentSubordinateX += NODE_WIDTH + MIN_HORIZONTAL_SPACING;
  });
  
  // Position parent
  const parentX = xCenter - NODE_WIDTH/2;
  nodeList.push({
    id: `user-${user.id}`,
    type: 'userNode',
    position: { x: parentX, y: userY },
    data: { user }
  });
  
  const leftmostChild = subordinateResults.length > 0 ? subordinateResults[0].leftBound : parentX;
  const rightmostChild = subordinateResults.length > 0 ? subordinateResults[subordinateResults.length - 1].rightBound : parentX + NODE_WIDTH;
  
  return {
    width: Math.max(NODE_WIDTH, totalSubordinateWidth),
    leftBound: Math.min(parentX, leftmostChild),
    rightBound: Math.max(parentX + NODE_WIDTH, rightmostChild)
  };
}