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
  calculateDynamicSpacing
} from '../utils/hierarchyLayoutUtils';

type OrganizationUser = UserDetailResponse | SimpleUser;

interface UseOrganizationLayoutParams {
  users: OrganizationUser[];
  departments: Department[];
  expandedDepartments: Set<string>;
  loadingNodes?: Set<string>;
  loadedUsers?: Map<string, OrganizationUser[]>;
  onDepartmentClick: (departmentId: string) => void;
  onUserClick?: (userId: string) => void;
}


export function useOrganizationLayout({
  users,
  departments,
  expandedDepartments,
  loadingNodes = new Set(),
  onDepartmentClick,
  onUserClick,
  loadedUsers = new Map()
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

    // Position company and departments using utils functions
    const startX = 200;
    const departmentSpacing = calculateDynamicSpacing(departments.length);
    
    // Calculate total layout dimensions
    const totalSpacing = (departmentWidths.length - 1) * departmentSpacing;
    const totalDepartmentsWidth = departmentWidths.reduce((sum, width) => sum + width, 0);
    const totalLayoutWidth = totalDepartmentsWidth + totalSpacing;
    
    const companyX = startX + (totalLayoutWidth / 2) - 128;

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

      // Add department node with loading state
      const isLoading = loadingNodes.has(department.id);
      nodeList.push({
        id: department.id,
        type: 'orgNode',
        position: { x: currentX, y: 200 },
        data: { 
          name: department.name,
          userCount,
          isDepartment: false,
          isLoading,
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

        // Layout all department users in a flat grid (no supervisor hierarchy)
        // Subordinates will be loaded and displayed dynamically via user clicks
        const { NODE_WIDTH } = LAYOUT_CONSTANTS;
        const dynamicSpacing = calculateDynamicSpacing(roots.length);
        
        if (roots.length === 1) {
          // Single user - center it
          const userX = safeCenterX - NODE_WIDTH/2;
          const userY = 450; // Standard first level position
          createFlatUserNode(roots[0], userX, userY, nodeList, loadingNodes, onUserClick);
        } else {
          // Multiple users - distribute evenly in flat layout
          const totalSpacing = (roots.length - 1) * dynamicSpacing;
          const totalWidth = (roots.length * NODE_WIDTH) + totalSpacing;
          
          const maxAvailableWidth = departmentAllocatedWidth - 250; // Adaptive padding
          const actualSpacing = totalWidth <= maxAvailableWidth 
            ? dynamicSpacing 
            : Math.max(60, (maxAvailableWidth - (roots.length * NODE_WIDTH)) / (roots.length - 1));
          
          const groupWidth = (roots.length * NODE_WIDTH) + ((roots.length - 1) * actualSpacing);
          const startX = safeCenterX - (groupWidth / 2) + (NODE_WIDTH / 2);
          const userY = 450; // Same Y level for all department users
          
          roots.forEach((user, userIndex) => {
            const userX = startX + (userIndex * (NODE_WIDTH + actualSpacing)) - NODE_WIDTH/2;
            createFlatUserNode(user, userX, userY, nodeList, loadingNodes, onUserClick);
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

        // Add subordinates for users that have been expanded (clicked)
        roots.forEach(user => {
          const subordinatesKey = `user-${user.id}`;
          const loadedSubordinates = loadedUsers.get(subordinatesKey);
          
          if (loadedSubordinates && loadedSubordinates.length > 0) {
            // Position subordinates below the user
            const userNode = nodeList.find(n => n.id === `user-${user.id}`);
            if (userNode) {
              const subordinateY = userNode.position.y + 600; // Position below user
              
              loadedSubordinates.forEach((subordinate, subIndex) => {
                const subordinateX = userNode.position.x + (subIndex - (loadedSubordinates.length - 1) / 2) * (NODE_WIDTH + 50);
                
                createFlatUserNode(subordinate, subordinateX, subordinateY, nodeList, loadingNodes, onUserClick);
                
                // Add edge from user to subordinate
                edgeList.push({
                  id: `user-${user.id}-subordinate-${subordinate.id}`,
                  source: `user-${user.id}`,
                  target: `user-${subordinate.id}`,
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
              });
            }
          }
        });
      }

      currentX += departmentWidths[index] + departmentSpacing;
    });

    return { nodes: nodeList, edges: edgeList };
  }, [departments, users, organizationStructure, expandedDepartments, loadingNodes, loadedUsers, onDepartmentClick, onUserClick]);

  return { nodes, edges };
}

// Helper function to create a flat user node (no hierarchical positioning)
function createFlatUserNode(
  user: OrganizationUser,
  x: number,
  y: number,
  nodeList: Node[],
  loadingNodes: Set<string>,
  onUserClick?: (userId: string) => void
): void {
  const isLoading = loadingNodes.has(user.id);
  
  nodeList.push({
    id: `user-${user.id}`,
    type: 'userNode',
    position: { x, y },
    data: { 
      user, 
      isLoading,
      onClick: onUserClick ? () => onUserClick(user.id) : undefined 
    }
  });
}

