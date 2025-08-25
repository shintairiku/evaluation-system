"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  NodeTypes,
  Handle,
  Position,
  MarkerType,
} from 'reactflow';
import 'reactflow/dist/style.css';
import type { UserDetailResponse, Department } from '@/api/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Building2, Users, User, Mail } from 'lucide-react';
import { 
  getProfileOptionsAction
} from '@/api/server-actions/users';

interface ReadOnlyOrganizationViewProps {
  users: UserDetailResponse[];
}


// Organization node component - represents departments or teams
const OrgNode = ({ 
  data
}: { 
  data: { 
    name: string; 
    userCount: number; 
    isDepartment?: boolean;
    onClick?: () => void;
  };
}) => {
  const { name, userCount, isDepartment = false, onClick } = data;
  
  const getNodeStyle = () => {
    if (isDepartment) {
      return 'bg-gradient-to-br from-blue-600 to-blue-700 text-white border-blue-800 shadow-lg';
    } else {
      return 'bg-gradient-to-br from-blue-50 to-blue-100 text-blue-900 border-blue-300 hover:from-blue-100 hover:to-blue-200 cursor-pointer shadow-md hover:shadow-lg transition-all duration-300';
    }
  };
  
  return (
    <div className="relative">
      <Handle
        type="target"
        position={Position.Top}
        id="top"
        style={{ 
          background: '#3b82f6',
          width: 10,
          height: 10,
          border: '3px solid #ffffff',
          borderRadius: '50%',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}
      />
      <Card className={`w-64 transition-all duration-300 ${getNodeStyle()}`} onClick={onClick}>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${isDepartment ? 'bg-blue-500/20' : 'bg-blue-200/50'}`}>
              <Building2 className={`w-6 h-6 ${isDepartment ? 'text-white' : 'text-blue-700'}`} />
            </div>
            <div className="text-center flex-1">
              <CardTitle className={`text-base font-bold ${isDepartment ? 'text-white' : 'text-blue-900'}`}>
                {name}
              </CardTitle>
              <CardDescription className={`text-sm mt-1 font-medium ${isDepartment ? 'text-blue-100' : 'text-blue-700'}`}>
                {userCount}人
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom"
        style={{ 
          background: '#3b82f6',
          width: 10,
          height: 10,
          border: '3px solid #ffffff',
          borderRadius: '50%',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}
      />
    </div>
  );
};

// User card node component matching hierarchy edit view style
const UserNode = ({ data }: { data: { user: UserDetailResponse } }) => {
  const { user } = data;
  
  // Determine card styling based on user role and status
  const getCardStyle = () => {
    let baseStyle = '';
    
    if (user.status === 'pending_approval') {
      baseStyle = 'border-orange-300 bg-orange-50/50 shadow-md hover:shadow-lg';
    } else if (user.roles?.some((role) => role.name.toLowerCase().includes('admin'))) {
      baseStyle = 'border-blue-400 bg-blue-50/50 shadow-md hover:shadow-lg';
    } else if (user.roles?.some((role) => role.name.toLowerCase().includes('manager'))) {
      baseStyle = 'border-green-400 bg-green-50/50 shadow-md hover:shadow-lg';
    } else if (user.roles?.some((role) => role.name.toLowerCase().includes('supervisor'))) {
      baseStyle = 'border-purple-400 bg-purple-50/50 shadow-md hover:shadow-lg';
    } else {
      baseStyle = 'border-gray-200 bg-white shadow-md hover:shadow-lg';
    }
    
    return baseStyle;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="default" className="bg-green-100 text-green-800 font-medium px-2 py-1">アクティブ</Badge>;
      case 'inactive':
        return <Badge variant="secondary" className="bg-red-100 text-red-800 font-medium px-2 py-1">非アクティブ</Badge>;
      case 'pending_approval':
        return <Badge variant="outline" className="bg-yellow-100 text-yellow-800 font-medium px-2 py-1">承認待ち</Badge>;
      default:
        return <Badge variant="secondary" className="font-medium px-2 py-1">{status}</Badge>;
    }
  };

  return (
    <div className="relative">
      <Handle
        type="target"
        position={Position.Top}
        id="top"
        style={{ 
          background: '#3b82f6',
          width: 10,
          height: 10,
          border: '3px solid #ffffff',
          borderRadius: '50%',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}
      />
      <Card className={`w-72 sm:w-64 md:w-72 group hover:shadow-xl transition-all duration-300 ${getCardStyle()}`}>
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center">
                  <User className="w-4 h-4 text-white" />
                </div>
                <CardTitle className="text-lg font-bold text-gray-900">{user.name}</CardTitle>
              </div>
              <CardDescription className="flex items-center gap-1 mt-2 text-sm font-medium text-gray-600">
                <span className="bg-gray-100 px-2 py-1 rounded text-xs font-mono">{user.employee_code}</span>
              </CardDescription>
              {user.job_title && (
                <CardDescription className="mt-2 font-semibold text-gray-700 bg-gray-50 px-3 py-1 rounded-lg">
                  {user.job_title}
                </CardDescription>
              )}
            </div>
            <div className="ml-2">
              {getStatusBadge(user.status)}
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* メールアドレス */}
          <div className="flex items-center gap-3 text-sm bg-white/50 p-2 rounded-lg">
            <Mail className="w-4 h-4 text-gray-500 flex-shrink-0" />
            <span className="truncate font-medium text-gray-700" title={user.email}>
              {user.email}
            </span>
          </div>

          {/* 部署 */}
          <div className="flex items-center gap-3 text-sm">
            <Building2 className="w-4 h-4 text-gray-500 flex-shrink-0" />
            {user.department ? (
              <Badge variant="outline" className="text-xs font-medium bg-blue-50 text-blue-700 border-blue-200">
                {user.department.name}
              </Badge>
            ) : (
              <span className="text-gray-500 text-sm">部署未設定</span>
            )}
          </div>

          {/* ステージ */}
          <div className="flex items-center gap-3 text-sm">
            <Users className="w-4 h-4 text-gray-500 flex-shrink-0" />
            {user.stage ? (
              <Badge variant="secondary" className="text-xs font-medium bg-gray-100 text-gray-700">
                {user.stage.name}
              </Badge>
            ) : (
              <span className="text-gray-500 text-sm">ステージ未設定</span>
            )}
          </div>

          {/* ロール */}
          <div className="space-y-2">
            <div className="text-xs font-bold text-gray-700 uppercase tracking-wide">ロール</div>
            <div className="flex flex-wrap gap-1.5">
              {user.roles && user.roles.length > 0 ? (
                user.roles.map((role) => (
                  <Badge key={role.id} variant="outline" className="text-xs font-medium bg-white/70 border-gray-300 text-gray-700">
                    {role.name}
                  </Badge>
                ))
              ) : (
                <span className="text-xs text-gray-500">ロール未設定</span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom"
        style={{ 
          background: '#3b82f6',
          width: 10,
          height: 10,
          border: '3px solid #ffffff',
          borderRadius: '50%',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}
      />
    </div>
  );
};

// Node types for organization chart
const nodeTypes: NodeTypes = {
  orgNode: OrgNode,
  userNode: UserNode,
};

export default function ReadOnlyOrganizationView({ users }: ReadOnlyOrganizationViewProps) {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [expandedDepartments, setExpandedDepartments] = useState<Set<string>>(new Set());

  // Load departments on mount
  useEffect(() => {
    const loadDepartments = async () => {
      try {
        const result = await getProfileOptionsAction();
        if (result && result.success && result.data && result.data.departments) {
          setDepartments(result.data.departments);
        } else {
          console.warn('Failed to load departments:', result);
          // Fallback: extract departments from users
          const uniqueDepartments = users
            .filter(user => user.department)
            .map(user => user.department!)
            .filter((dept, index, self) => 
              index === self.findIndex(d => d.id === dept.id)
            );
          setDepartments(uniqueDepartments);
        }
      } catch (error) {
        console.error('Error loading departments:', error);
        // Fallback: extract departments from users
        const uniqueDepartments = users
          .filter(user => user.department)
          .map(user => user.department!)
          .filter((dept, index, self) => 
            index === self.findIndex(d => d.id === dept.id)
          );
        setDepartments(uniqueDepartments);
      }
    };
    
    loadDepartments();
  }, [users]);

  // Handle department click to expand/collapse user cards - individual toggle
  const handleDepartmentClick = useCallback((departmentId: string) => {
    setExpandedDepartments(prev => {
      const newSet = new Set(prev);
      if (newSet.has(departmentId)) {
        newSet.delete(departmentId); // Close if already open
      } else {
        newSet.add(departmentId); // Open if closed
      }
      return newSet;
    });
  }, []);

  // Build organization hierarchy structure
  const organizationStructure = useMemo(() => {
    // Group users by department
    const departmentUsers = new Map<string, UserDetailResponse[]>();
    
    departments.forEach(dept => {
      const deptUsers = users.filter(u => u.department?.id === dept.id);
      departmentUsers.set(dept.id, deptUsers);
    });
    
    return departmentUsers;
  }, [users, departments]);

  // Generate organization chart nodes and edges
  const { nodes, edges } = useMemo(() => {
    const nodeList: Node[] = [];
    const edgeList: Edge[] = [];

    // Calculate dynamic spacing for departments based on expanded content
    const calculateDepartmentSpacing = () => {
      const departmentWidths: number[] = [];
      
      departments.forEach((department) => {
        const deptUsers = organizationStructure.get(department.id) || [];
        
        if (expandedDepartments.has(department.id) && deptUsers.length > 0) {
          // Calculate exact width needed by simulating the hierarchy layout
          const roots = deptUsers.filter(user => 
            !user.supervisor || !deptUsers.find(u => u.id === user.supervisor?.id)
          );
          
          // Simulate the hierarchy layout algorithm to get actual width needed
          const simulateHierarchyWidth = (user: UserDetailResponse): { width: number, leftBound: number, rightBound: number } => {
            const nodeWidth = 288; // w-72 user card actual width
            const minHorizontalSpacing = 100; // spacing between siblings
            
            // Find subordinates
            const subordinates = deptUsers.filter(u => u.supervisor?.id === user.id);
            
            if (subordinates.length === 0) {
              // Leaf node
              return { 
                width: nodeWidth, 
                leftBound: 0, 
                rightBound: nodeWidth 
              };
            }
            
            // Calculate subordinate widths
            let totalSubordinateWidth = 0;
            subordinates.forEach(subordinate => {
              const result = simulateHierarchyWidth(subordinate);
              totalSubordinateWidth += result.width;
            });
            
            // Add spacing between subordinates
            totalSubordinateWidth += (subordinates.length - 1) * minHorizontalSpacing;
            
            return {
              width: Math.max(nodeWidth, totalSubordinateWidth),
              leftBound: 0,
              rightBound: Math.max(nodeWidth, totalSubordinateWidth)
            };
          };
          
          // Width calculation with better spacing for overlap prevention
          if (roots.length === 0) {
            // No users - minimal width
            departmentWidths.push(320);
          } else if (roots.length === 1) {
            // Single user - enough space for hierarchy, minimum to allow visual centering
            const rootWidth = simulateHierarchyWidth(roots[0]);
            departmentWidths.push(Math.max(500, rootWidth.width + 150));
          } else {
            // Multiple users - calculate exact width needed to prevent overlaps
            const nodeWidth = 288; // w-72 user card width
            const minSpacing = 50; // Minimum spacing between cards
            const totalSpacing = (roots.length - 1) * (nodeWidth + minSpacing);
            const totalWidth = (roots.length * nodeWidth) + totalSpacing;
            
            // Add extra padding for visual comfort
            const requiredWidth = totalWidth + 200; // Extra padding
            departmentWidths.push(Math.max(600, requiredWidth));
          }
        } else {
          // Collapsed department needs minimal width
          departmentWidths.push(280); // Just department width
        }
      });
      
      return departmentWidths;
    };
    
    const departmentWidths = calculateDepartmentSpacing();
    
    // Calculate department layout positions
    const startX = 200; // Start position for departments
    const totalDepartmentsWidth = departmentWidths.reduce((sum, width) => sum + width, 0);
    
    // Calculate company position to center above all departments
    const companyX = startX + (totalDepartmentsWidth / 2) - 128; // Center company above departments (128 = half of company card width)

    // Add company root node
    const companyName = '株式会社新大陸';
    nodeList.push({
      id: 'company-root',
      type: 'orgNode',
      position: { x: companyX, y: 0 },
      data: { 
        name: companyName,
        userCount: users.length,
        isDepartment: true
      }
    });
    
    // Position departments with dynamic spacing
    let currentX = startX;
    const departmentPositions: { [key: string]: number } = {};
    
    // Add department nodes with calculated positions
    departments.forEach((department, index) => {
      const deptUsers = organizationStructure.get(department.id) || [];
      const userCount = deptUsers.length;
      
      // Store position for this department
      departmentPositions[department.id] = currentX;
      const xPosition = currentX;
      
      nodeList.push({
        id: department.id,
        type: 'orgNode',
        position: { x: xPosition, y: 200 },
        data: { 
          name: department.name,
          userCount,
          isDepartment: false,
          onClick: () => handleDepartmentClick(department.id)
        }
      });
      
      // Move to next position for next department
      currentX += departmentWidths[index];
      
      // Add user nodes if department is expanded - arranged in hierarchy
      if (expandedDepartments.has(department.id) && deptUsers.length > 0) {
        // Build hierarchy within department using improved spacing algorithm
        const buildUserHierarchy = (users: UserDetailResponse[]) => {
          // Find root users (no supervisor within this department or supervisor outside department)
          const roots = users.filter(user => 
            !user.supervisor || !users.find(u => u.id === user.supervisor?.id)
          );
          
          // Function to recursively layout users in hierarchy with better spacing
          const layoutHierarchy = (user: UserDetailResponse, level: number, xCenter: number): { 
            width: number, 
            leftBound: number, 
            rightBound: number 
          } => {
            const nodeWidth = 288; // w-72 user card actual width
            const verticalSpacing = 500; // Increased vertical spacing between levels
            const minHorizontalSpacing = 100; // Increased horizontal spacing to prevent overlap
            const userY = 450 + level * verticalSpacing; // Increased starting position for more space from department
            
            // Find subordinates first to calculate positioning
            const subordinates = users.filter(u => u.supervisor?.id === user.id);
            
            if (subordinates.length === 0) {
              // Leaf node - position at xCenter
              nodeList.push({
                id: `user-${user.id}`,
                type: 'userNode',
                position: { x: xCenter - nodeWidth/2, y: userY },
                data: { user }
              });
              
              return { 
                width: nodeWidth, 
                leftBound: xCenter - nodeWidth/2, 
                rightBound: xCenter + nodeWidth/2 
              };
            }
            
            // Calculate total width needed for all subordinates first
            const subordinateWidths = subordinates.map(sub => {
              return simulateHierarchyWidth(sub);
            });
            
            const totalSubordinateWidth = subordinateWidths.reduce((sum, sub) => sum + sub.width, 0) + 
                                        (subordinates.length - 1) * minHorizontalSpacing;
            
            // Start position for subordinates (centered under parent)
            const subordinatesStartX = xCenter - (totalSubordinateWidth / 2);
            
            // Layout subordinates with proper spacing
            const subordinateResults: Array<{ width: number, leftBound: number, rightBound: number }> = [];
            let currentSubordinateX = subordinatesStartX;
            
            subordinates.forEach((subordinate, subIndex) => {
              const subWidth = subordinateWidths[subIndex];
              const subCenterX = currentSubordinateX + (subWidth.width / 2);
              const subResult = layoutHierarchy(subordinate, level + 1, subCenterX);
              subordinateResults.push(subResult);
              
              // Move to next subordinate position
              currentSubordinateX += subWidth.width + minHorizontalSpacing;
            });
            
            // Calculate final position for parent (center above children)
            const leftmostChild = subordinateResults.length > 0 ? subordinateResults[0].leftBound : xCenter - nodeWidth/2;
            const rightmostChild = subordinateResults.length > 0 ? subordinateResults[subordinateResults.length - 1].rightBound : xCenter + nodeWidth/2;
            
            // Position parent at the provided xCenter
            const parentX = xCenter - nodeWidth/2;
            const finalTotalWidth = Math.max(nodeWidth, totalSubordinateWidth);
            
            nodeList.push({
              id: `user-${user.id}`,
              type: 'userNode',
              position: { x: parentX, y: userY },
              data: { user }
            });
            
            return {
              width: finalTotalWidth,
              leftBound: Math.min(parentX, leftmostChild),
              rightBound: Math.max(parentX + nodeWidth, rightmostChild)
            };
          };
          
          // Hybrid approach: Center users within the allocated space while respecting boundaries
          const departmentCenterX = xPosition + 128; // Visual center of department card
          const departmentAllocatedWidth = departmentWidths[index]; // Space allocated for this department
          const allocatedSpaceCenter = xPosition + (departmentAllocatedWidth / 2); // Center of allocated space
          
          // Choose the best centering point: prefer visual center but respect boundaries
          const safeCenterX = departmentAllocatedWidth > 400 ? departmentCenterX : allocatedSpaceCenter;
          
          if (roots.length === 1) {
            // Single root user - center it at the safe center point
            layoutHierarchy(roots[0], 0, safeCenterX);
          } else {
            // Multiple roots - ensure proper spacing to prevent overlaps
            const nodeWidth = 288; // w-72 user card width
            const minSpacing = 50; // Minimum spacing between cards
            const totalSpacing = (roots.length - 1) * (nodeWidth + minSpacing);
            
            // Calculate the total width needed for all root users
            const totalWidth = (roots.length * nodeWidth) + totalSpacing;
            
            // Ensure we don't exceed the allocated department width
            const maxAvailableWidth = departmentAllocatedWidth - 100; // Leave some padding
            const actualSpacing = totalWidth <= maxAvailableWidth 
              ? minSpacing 
              : Math.max(20, (maxAvailableWidth - (roots.length * nodeWidth)) / (roots.length - 1));
            
            // Calculate starting position to center the group
            const groupWidth = (roots.length * nodeWidth) + ((roots.length - 1) * actualSpacing);
            const startX = safeCenterX - (groupWidth / 2) + (nodeWidth / 2);
            
            // Position each root user with proper spacing
            roots.forEach((rootUser, rootIndex) => {
              const userX = startX + (rootIndex * (nodeWidth + actualSpacing));
              layoutHierarchy(rootUser, 0, userX);
            });
          }
          
          // Create edges for all roots
          roots.forEach((rootUser) => {
            
            // Add edge from department to root user
            // Use straight line when user is centered, smoothstep for others
            const edgeType = (roots.length === 1) ? 'straight' : 'smoothstep';
            
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
          
          // Simulate hierarchy width function (moved here to be accessible)
          function simulateHierarchyWidth(user: UserDetailResponse): { width: number, leftBound: number, rightBound: number } {
            const nodeWidth = 288;
            const minHorizontalSpacing = 100;
            
            const subordinates = deptUsers.filter(u => u.supervisor?.id === user.id);
            
            if (subordinates.length === 0) {
              return { 
                width: nodeWidth, 
                leftBound: 0, 
                rightBound: nodeWidth 
              };
            }
            
            let totalSubordinateWidth = 0;
            subordinates.forEach(subordinate => {
              const result = simulateHierarchyWidth(subordinate);
              totalSubordinateWidth += result.width;
            });
            
            totalSubordinateWidth += (subordinates.length - 1) * minHorizontalSpacing;
            
            return {
              width: Math.max(nodeWidth, totalSubordinateWidth),
              leftBound: 0,
              rightBound: Math.max(nodeWidth, totalSubordinateWidth)
            };
          }
          
        };
        
        buildUserHierarchy(deptUsers);
      }
      
      // Add edge from company to department (matching edit view style)
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
      
      // Group users by teams/supervisors within department if there are many users
      if (deptUsers.length > 5) {
        // Group by supervisor
        const supervisorGroups = new Map<string, UserDetailResponse[]>();
        const noSupervisorUsers: UserDetailResponse[] = [];
        
        deptUsers.forEach(user => {
          if (user.supervisor) {
            const supervisorId = user.supervisor.id;
            if (!supervisorGroups.has(supervisorId)) {
              supervisorGroups.set(supervisorId, []);
            }
            supervisorGroups.get(supervisorId)!.push(user);
          } else {
            noSupervisorUsers.push(user);
          }
        });
        
        // Add team nodes for groups with supervisors
        Array.from(supervisorGroups.entries()).forEach(([supervisorId, teamMembers], teamIndex) => {
          const supervisor = users.find(u => u.id === supervisorId);
          if (supervisor) {
            const teamName = `${supervisor.name}チーム`;
            const teamNodeId = `${department.id}-team-${supervisorId}`;
            
            nodeList.push({
              id: teamNodeId,
              type: 'orgNode',
              position: { 
                x: xPosition + (teamIndex * 150) - ((supervisorGroups.size - 1) * 75), 
                y: 300 
              },
              data: { 
                name: teamName,
                userCount: teamMembers.length + 1, // +1 for supervisor
                isDepartment: false,
                users: [supervisor, ...teamMembers]
              }
            });
            
            // Add edge from department to team
            edgeList.push({
              id: `${department.id}-${teamNodeId}`,
              source: department.id,
              target: teamNodeId,
              type: 'smoothstep',
              style: { 
                stroke: '#3b82f6', 
                strokeWidth: 2,
                opacity: 0.6
              },
              markerEnd: {
                type: MarkerType.ArrowClosed,
                width: 12,
                height: 12,
                color: '#3b82f6',
              },
            });
          }
        });
      }
    });


    // Add edges between supervisors and subordinates for all expanded departments
    expandedDepartments.forEach(expandedDeptId => {
      const expandedDeptUsers = organizationStructure.get(expandedDeptId) || [];
      expandedDeptUsers.forEach(user => {
        if (user.supervisor) {
          const supervisor = expandedDeptUsers.find(u => u.id === user.supervisor?.id);
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
    });

    return { nodes: nodeList, edges: edgeList };
  }, [departments, users, organizationStructure, expandedDepartments, handleDepartmentClick]);

  const [nodesState, setNodes] = useNodesState(nodes);
  const [edgesState, setEdges] = useEdgesState(edges);

  // Update nodes and edges when organization changes
  useEffect(() => {
    setNodes(nodes);
    setEdges(edges);
  }, [nodes, edges, setNodes, setEdges]);

  return (
    <div className="space-y-6">
      {/* Enhanced Header */}
      <div className="bg-gradient-to-r from-slate-800 via-slate-900 to-slate-950 rounded-xl p-6 border border-slate-700 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                <Building2 className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-white">組織図</h3>
                <p className="text-blue-100 text-sm">Organization Chart</p>
              </div>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white/10 rounded-lg p-3">
                <div className="text-white font-bold text-lg">{departments.length}</div>
                <div className="text-blue-100 text-xs">部署</div>
              </div>
              <div className="bg-white/10 rounded-lg p-3">
                <div className="text-white font-bold text-lg">{users.length}</div>
                <div className="text-blue-100 text-xs">ユーザー</div>
              </div>
              <div className="bg-white/10 rounded-lg p-3">
                <div className="text-white font-bold text-lg">
                  {users.filter(u => u.roles?.some(r => r.name.toLowerCase().includes('admin') || r.name.toLowerCase().includes('manager'))).length}
                </div>
                <div className="text-blue-100 text-xs">管理者・マネージャー</div>
              </div>
              <div className="bg-white/10 rounded-lg p-3">
                <div className="text-white font-bold text-lg">
                  {users.filter(u => u.status === 'pending_approval').length}
                </div>
                <div className="text-blue-100 text-xs">承認待ち</div>
              </div>
            </div>
          </div>
          
          <div className="hidden md:block">
            <div className="bg-white/10 rounded-lg p-4 text-center">
              <div className="text-white font-bold text-sm mb-2">操作ガイド</div>
              <div className="text-blue-100 text-xs space-y-1">
                <div>🏢 部署をクリック</div>
                <div>👥 メンバー表示・非表示</div>
                <div>🔍 ズーム・パン操作</div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Organization Chart */}
      <div className="w-full h-[800px] border-2 border-gray-200 rounded-xl overflow-hidden bg-gradient-to-br from-gray-50 to-white shadow-xl">
        <ReactFlow
          nodes={nodesState}
          edges={edgesState}
          nodeTypes={nodeTypes}
          fitView={false}
          minZoom={0.1}
          maxZoom={1.2}
          defaultViewport={{ x: 200, y: 50, zoom: 0.8 }}
          proOptions={{ hideAttribution: true }}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={true}
          panOnDrag={true}
          zoomOnScroll={true}
          zoomOnPinch={true}
          zoomOnDoubleClick={true}
        >
          <Background 
            color="#e2e8f0" 
            gap={40}
            size={1}
            className="opacity-30"
          />
          <Controls 
            position="top-right"
            className="bg-white/90 backdrop-blur-sm border border-gray-200 rounded-lg shadow-lg z-10"
            showZoom={true}
            showFitView={true}
            showInteractive={false}
          />
        </ReactFlow>
      </div>
    </div>
  );
}