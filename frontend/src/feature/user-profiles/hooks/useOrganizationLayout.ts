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
  departmentUserCounts?: Map<string, number>;
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
  loadedUsers = new Map(),
  // Optional total counts per department; when provided, display total even if showing only top users
  departmentUserCounts = new Map<string, number>()
}: UseOrganizationLayoutParams) {
  
  // Generate nodes and edges for the organization chart
  const { nodes, edges } = useMemo(() => {
    const nodeList: Node[] = [];
    const edgeList: Edge[] = [];

    // Calculate department widths with normalization for better spacing
    const departmentWidths = departments.map(department => {
      // Prefer loadedUsers cache (filtered top users) when department is expanded
      const cacheKey = `dept-${department.id}`;
      const cachedUsers = loadedUsers.get(cacheKey);
      const isExpanded = expandedDepartments.has(department.id);
      // Use cached filtered users if available for expanded departments; otherwise fall back to global users
      const currentDeptUsers = isExpanded && cachedUsers ? cachedUsers : users.filter(u => u.department?.id === department.id);
      
      if (expandedDepartments.has(department.id) && currentDeptUsers.length > 0) {
        const roots = findRootUsers(currentDeptUsers);
        const calculatedWidth = calculateDepartmentWidth(roots, currentDeptUsers);
        
        // Normalize expanded department widths to reduce extreme variations
        // This prevents some departments from being much wider than others
        const userCount = currentDeptUsers.length;
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
      // Use cached filtered users for expanded departments if available
      const cacheKey = `dept-${department.id}`;
      const cachedUsers = loadedUsers.get(cacheKey);
      const isExpanded = expandedDepartments.has(department.id);
      const currentDeptUsers = isExpanded && cachedUsers ? cachedUsers : users.filter(u => u.department?.id === department.id);
      const userCount = currentDeptUsers.length;

      // Add department node with loading state
      const isLoading = loadingNodes.has(department.id);
      nodeList.push({
        id: department.id,
        type: 'orgNode',
        position: { x: currentX, y: 200 },
        data: { 
          name: department.name,
          userCount: departmentUserCounts.get(department.id) ?? userCount,
          isDepartment: false,
          isLoading,
          onClick: () => onDepartmentClick(department.id)
        }
      });

      // Add company to department edge (keep this single structural edge)
      if (!edgeList.some(e => e.id === `company-${department.id}`)) {
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
      }

      // Add user nodes if department is expanded
      if (expandedDepartments.has(department.id) && currentDeptUsers.length > 0) {
        // This ensures we show only the top user initially, not all department users
        const roots = findRootUsers(currentDeptUsers);
        const departmentCenterX = currentX + 128; // Center of department card
        const departmentAllocatedWidth = departmentWidths[index];
        const allocatedSpaceCenter = currentX + (departmentAllocatedWidth / 2);
        
        // Choose centering strategy based on available space
        const safeCenterX = departmentAllocatedWidth > 400 ? departmentCenterX : allocatedSpaceCenter;

        // Layout department users with proper hierarchy and subordinate expansion
        const { NODE_WIDTH } = LAYOUT_CONSTANTS;
        const dynamicSpacing = calculateDynamicSpacing(roots.length);
        
        if (roots.length === 1) {
          // Single user - center it and build hierarchy
          layoutUserHierarchy(roots[0], 0, safeCenterX, currentDeptUsers, nodeList, edgeList, loadingNodes, onUserClick);
        } else {
          // Multiple users - distribute evenly with hierarchy support
          const totalSpacing = (roots.length - 1) * dynamicSpacing;
          const totalWidth = (roots.length * NODE_WIDTH) + totalSpacing;
          
          const maxAvailableWidth = departmentAllocatedWidth - 250; // Adaptive padding
          const actualSpacing = totalWidth <= maxAvailableWidth 
            ? dynamicSpacing 
            : Math.max(60, (maxAvailableWidth - (roots.length * NODE_WIDTH)) / (roots.length - 1));
          
          const groupWidth = (roots.length * NODE_WIDTH) + ((roots.length - 1) * actualSpacing);
          const startX = safeCenterX - (groupWidth / 2) + (NODE_WIDTH / 2);
          
          roots.forEach((user, userIndex) => {
            const userX = startX + (userIndex * (NODE_WIDTH + actualSpacing));
            layoutUserHierarchy(user, 0, userX, currentDeptUsers, nodeList, edgeList, loadingNodes, onUserClick);
          });
        }

        // Draw department → user root edges with safe routing and dedupe
        roots.forEach((rootUser) => {
          const edgeType = 'smoothstep';
          const edgeId = `${department.id}-user-${rootUser.id}`;
          if (!edgeList.some(e => e.id === edgeId)) {
            edgeList.push({
              id: edgeId,
              source: department.id,
              target: `user-${rootUser.id}`,
              sourceHandle: 'bottom',
              targetHandle: 'top',
              type: edgeType,
              pathOptions: { offset: 60, borderRadius: 12 },
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
        });

        // Add dynamically loaded subordinates for users that have been clicked
        addDynamicSubordinates(nodeList, edgeList, loadedUsers, loadingNodes, onUserClick);
      }

      currentX += departmentWidths[index] + departmentSpacing;
    });

    return { nodes: nodeList, edges: edgeList };
  }, [departments, users, expandedDepartments, loadingNodes, loadedUsers, onDepartmentClick, onUserClick]);

  return { nodes, edges };
}

// Helper function to add dynamically loaded subordinates
function addDynamicSubordinates(
  nodeList: Node[],
  edgeList: Edge[],
  loadedUsers: Map<string, OrganizationUser[]>,
  loadingNodes: Set<string>,
  onUserClick?: (userId: string) => void
): void {
  const { NODE_WIDTH, VERTICAL_SPACING } = LAYOUT_CONSTANTS;
  
  // Process each user that has loaded subordinates via API
  loadedUsers.forEach((subordinates, cacheKey) => {
    if (!cacheKey.startsWith('user-') || subordinates.length === 0) return;
    
    const userId = cacheKey.replace('user-', '');
    const parentNode = nodeList.find(n => n.id === `user-${userId}`);
    
    if (parentNode && subordinates.length > 0) {
      // Constrain edges to internal hierarchy only (same department as parent if available)
      // Determine parent department by inspecting existing user node's data
      const parentUser: any = (parentNode as any).data?.user;
      const parentDeptId: string | undefined = parentUser?.department?.id;
      const internalSubs = parentDeptId ? subordinates.filter(s => (s as any)?.department?.id === parentDeptId) : subordinates;
      if (internalSubs.length === 0) return;
      
      // Position subordinates directly one level below parent for stable layout
      const dynamicSubordinateY = parentNode.position.y + VERTICAL_SPACING;
      
      // Position subordinates horizontally around parent
      const subordinateSpacing = calculateDynamicSpacing(internalSubs.length);
      const totalWidth = (internalSubs.length * NODE_WIDTH) + ((internalSubs.length - 1) * subordinateSpacing);
      const startX = parentNode.position.x + (NODE_WIDTH / 2) - (totalWidth / 2) + (NODE_WIDTH / 2);
      
      internalSubs.forEach((subordinate, index) => {
        const subX = startX + (index * (NODE_WIDTH + subordinateSpacing)) - NODE_WIDTH/2;
        
        // Add subordinate node
        const isLoading = loadingNodes.has(subordinate.id);
        const subNodeId = `user-${subordinate.id}`;
        if (!nodeList.some(n => n.id === subNodeId)) {
          nodeList.push({
            id: subNodeId,
            type: 'userNode',
            position: { x: subX, y: dynamicSubordinateY },
            data: { 
              user: subordinate, 
              isLoading,
              onClick: onUserClick ? () => onUserClick(subordinate.id) : undefined 
            }
          });
        }
        
        // Add edge from parent to subordinate using standard blue style in read-only mode
        const dynEdgeId = `dynamic-${userId}-${subordinate.id}`;
        if (!edgeList.some(e => e.id === dynEdgeId)) {
          edgeList.push({
            id: dynEdgeId,
            source: `user-${userId}`,
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
        }
      });
    }
  });
}

// Helper function to layout user hierarchies with dynamic subordinate expansion
function layoutUserHierarchy(
  user: OrganizationUser,
  level: number,
  xCenter: number,
  departmentUsers: OrganizationUser[],
  nodeList: Node[],
  edgeList: Edge[],
  loadingNodes: Set<string> = new Set(),
  onUserClick?: (userId: string) => void
): void {
  const { NODE_WIDTH, VERTICAL_SPACING } = LAYOUT_CONSTANTS;
  const userY = 450 + level * VERTICAL_SPACING;
  
  // Find internal subordinates (within department users)
  const internalSubordinates = departmentUsers.filter(u => u.supervisor?.id === user.id);
  
  // Create user node
  const isLoading = loadingNodes.has(user.id);
  nodeList.push({
    id: `user-${user.id}`,
    type: 'userNode',
    position: { x: xCenter - NODE_WIDTH/2, y: userY },
    data: { 
      user, 
      isLoading,
      onClick: onUserClick ? () => onUserClick(user.id) : undefined 
    }
  });
  
  // Layout internal subordinates if any exist
  if (internalSubordinates.length > 0) {
    const subordinateSpacing = calculateDynamicSpacing(internalSubordinates.length);
    const totalWidth = (internalSubordinates.length * NODE_WIDTH) + ((internalSubordinates.length - 1) * subordinateSpacing);
    const startX = xCenter - (totalWidth / 2) + (NODE_WIDTH / 2);
    
    internalSubordinates.forEach((subordinate, index) => {
      const subX = startX + (index * (NODE_WIDTH + subordinateSpacing));
      layoutUserHierarchy(subordinate, level + 1, subX, departmentUsers, nodeList, edgeList, loadingNodes, onUserClick);
      
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

