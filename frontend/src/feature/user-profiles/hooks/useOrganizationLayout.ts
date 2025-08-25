/**
 * Custom hook for managing organization chart layout logic
 */
import { useMemo } from 'react';
import type { Node, Edge } from 'reactflow';
import { MarkerType } from 'reactflow';
import type { UserDetailResponse, Department } from '@/api/types';
import { 
  calculateDepartmentWidth, 
  findRootUsers, 
  LAYOUT_CONSTANTS 
} from '../utils/hierarchyLayoutUtils';

interface UseOrganizationLayoutParams {
  users: UserDetailResponse[];
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
    const departmentUsers = new Map<string, UserDetailResponse[]>();
    
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

    // Calculate department widths
    const departmentWidths = departments.map(department => {
      const deptUsers = organizationStructure.get(department.id) || [];
      
      if (expandedDepartments.has(department.id) && deptUsers.length > 0) {
        const roots = findRootUsers(deptUsers);
        return calculateDepartmentWidth(roots, deptUsers);
      } else {
        return 280; // Collapsed department width
      }
    });

    // Position company and departments
    const startX = 200;
    const totalDepartmentsWidth = departmentWidths.reduce((sum, width) => sum + width, 0);
    const companyX = startX + (totalDepartmentsWidth / 2) - 128; // Center company above departments

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
          // Multiple users - distribute evenly
          const { NODE_WIDTH } = LAYOUT_CONSTANTS;
          const minSpacing = 50;
          const totalSpacing = (roots.length - 1) * (NODE_WIDTH + minSpacing);
          const totalWidth = (roots.length * NODE_WIDTH) + totalSpacing;
          
          const maxAvailableWidth = departmentAllocatedWidth - 100;
          const actualSpacing = totalWidth <= maxAvailableWidth 
            ? minSpacing 
            : Math.max(20, (maxAvailableWidth - (roots.length * NODE_WIDTH)) / (roots.length - 1));
          
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

      currentX += departmentWidths[index];
    });

    return { nodes: nodeList, edges: edgeList };
  }, [departments, users, organizationStructure, expandedDepartments, onDepartmentClick]);

  return { nodes, edges };
}

// Helper function to layout user hierarchies
function layoutUserHierarchy(
  user: UserDetailResponse,
  level: number,
  xCenter: number,
  departmentUsers: UserDetailResponse[],
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
  
  // Layout subordinates first
  const subordinateResults: LayoutResult[] = [];
  const totalSubordinateWidth = subordinates.reduce((sum) => {
    // Simulate subordinate width (simplified calculation)
    return sum + NODE_WIDTH;
  }, 0) + (subordinates.length - 1) * MIN_HORIZONTAL_SPACING;
  
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