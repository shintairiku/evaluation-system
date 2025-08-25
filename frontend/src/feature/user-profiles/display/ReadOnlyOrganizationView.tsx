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
      return 'bg-blue-500 text-white border-blue-600';
    } else {
      return 'bg-blue-100 text-blue-900 border-blue-300 hover:bg-blue-200 cursor-pointer';
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
          width: 8,
          height: 8,
          border: '2px solid #ffffff',
          borderRadius: '50%'
        }}
      />
      <Card className={`w-64 transition-all duration-200 ${getNodeStyle()}`} onClick={onClick}>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            <div className="text-center flex-1">
              <CardTitle className="text-sm font-bold">{name}</CardTitle>
              <CardDescription className={`text-xs mt-1 ${isDepartment ? 'text-blue-100' : 'text-blue-700'}`}>
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
          width: 8,
          height: 8,
          border: '2px solid #ffffff',
          borderRadius: '50%'
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
      baseStyle = 'border-orange-300 bg-orange-50/50';
    } else if (user.roles?.some((role) => role.name.toLowerCase().includes('admin'))) {
      baseStyle = 'border-blue-400 bg-blue-50/50';
    } else if (user.roles?.some((role) => role.name.toLowerCase().includes('manager'))) {
      baseStyle = 'border-green-400 bg-green-50/50';
    } else if (user.roles?.some((role) => role.name.toLowerCase().includes('supervisor'))) {
      baseStyle = 'border-purple-400 bg-purple-50/50';
    } else {
      baseStyle = 'border-gray-200 bg-white';
    }
    
    return baseStyle;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="default" className="bg-green-100 text-green-800">アクティブ</Badge>;
      case 'inactive':
        return <Badge variant="secondary" className="bg-red-100 text-red-800">非アクティブ</Badge>;
      case 'pending_approval':
        return <Badge variant="outline" className="bg-yellow-100 text-yellow-800">承認待ち</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
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
          width: 8,
          height: 8,
          border: '2px solid #ffffff',
          borderRadius: '50%'
        }}
      />
      <Card className={`w-72 sm:w-64 md:w-72 group hover:shadow-md transition-all duration-200 ${getCardStyle()}`}>
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <CardTitle className="text-lg">{user.name}</CardTitle>
              </div>
              <CardDescription className="flex items-center gap-1 mt-1">
                <User className="w-3 h-3" />
                {user.employee_code}
              </CardDescription>
              {user.job_title && (
                <CardDescription className="mt-1 font-medium">
                  {user.job_title}
                </CardDescription>
              )}
            </div>
            {getStatusBadge(user.status)}
          </div>
        </CardHeader>
        
        <CardContent className="space-y-3">
          {/* メールアドレス */}
          <div className="flex items-center gap-2 text-sm">
            <Mail className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <span className="truncate" title={user.email}>
              {user.email}
            </span>
          </div>

          {/* 部署 */}
          <div className="flex items-center gap-2 text-sm">
            <Building2 className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            {user.department ? (
              <Badge variant="outline" className="text-xs">
                {user.department.name}
              </Badge>
            ) : (
              <span className="text-muted-foreground">部署未設定</span>
            )}
          </div>

          {/* ステージ */}
          <div className="flex items-center gap-2 text-sm">
            <Users className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            {user.stage ? (
              <Badge variant="secondary" className="text-xs">
                {user.stage.name}
              </Badge>
            ) : (
              <span className="text-muted-foreground">ステージ未設定</span>
            )}
          </div>

          {/* ロール */}
          <div className="space-y-1">
            <div className="text-xs font-medium text-muted-foreground">ロール</div>
            <div className="flex flex-wrap gap-1">
              {user.roles && user.roles.length > 0 ? (
                user.roles.map((role) => (
                  <Badge key={role.id} variant="outline" className="text-xs">
                    {role.name}
                  </Badge>
                ))
              ) : (
                <span className="text-xs text-muted-foreground">ロール未設定</span>
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
          width: 8,
          height: 8,
          border: '2px solid #ffffff',
          borderRadius: '50%'
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
            const minHorizontalSpacing = 60; // spacing between siblings
            
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
          
          // Calculate total width needed for all root hierarchies
          let totalDepartmentWidth = 256; // Department card width (w-64)
          
          if (roots.length === 1) {
            const rootWidth = simulateHierarchyWidth(roots[0]);
            totalDepartmentWidth = Math.max(totalDepartmentWidth, rootWidth.width + 100); // Extra padding
          } else {
            // Multiple roots - calculate combined width
            let combinedWidth = 0;
            roots.forEach((rootUser, index) => {
              const rootWidth = simulateHierarchyWidth(rootUser);
              combinedWidth += rootWidth.width;
              if (index > 0) combinedWidth += 200; // Space between root hierarchies
            });
            totalDepartmentWidth = Math.max(totalDepartmentWidth, combinedWidth + 100);
          }
          
          departmentWidths.push(totalDepartmentWidth);
        } else {
          // Collapsed department needs minimal width
          departmentWidths.push(280); // Just department width
        }
      });
      
      return departmentWidths;
    };
    
    const departmentWidths = calculateDepartmentSpacing();
    
    // Calculate company position to center above departments
    const totalWidth = departmentWidths.reduce((sum, width) => sum + width, 0);
    const companyX = Math.max(400, totalWidth / 2);

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
    let currentX = 200; // Start position
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
            const verticalSpacing = 400; // Keep vertical spacing
            const minHorizontalSpacing = 60; // Reduce horizontal spacing between siblings
            const userY = 350 + level * verticalSpacing;
            
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
            
            // Layout subordinates first with improved spacing
            const subordinateResults: Array<{ width: number, leftBound: number, rightBound: number }> = [];
            let currentSubordinateX = xCenter;
            
            // First pass: calculate all subordinate layouts
            subordinates.forEach((subordinate) => {
              const subResult = layoutHierarchy(subordinate, level + 1, currentSubordinateX);
              subordinateResults.push(subResult);
              
              // Position next subordinate to the right with spacing
              currentSubordinateX = subResult.rightBound + minHorizontalSpacing;
            });
            
            // Calculate total width needed
            const totalSubordinateWidth = subordinateResults.length > 0 
              ? subordinateResults[subordinateResults.length - 1].rightBound - subordinateResults[0].leftBound
              : nodeWidth;
            
            // Calculate final position for parent
            const leftmostChild = subordinateResults[0].leftBound;
            const rightmostChild = subordinateResults[subordinateResults.length - 1].rightBound;
            const childrenCenter = (leftmostChild + rightmostChild) / 2;
            
            // Position parent centered above children
            const parentX = Math.max(xCenter - nodeWidth/2, childrenCenter - nodeWidth/2);
            
            nodeList.push({
              id: `user-${user.id}`,
              type: 'userNode',
              position: { x: parentX, y: userY },
              data: { user }
            });
            
            return {
              width: Math.max(nodeWidth, totalSubordinateWidth),
              leftBound: Math.min(parentX, leftmostChild),
              rightBound: Math.max(parentX + nodeWidth, rightmostChild)
            };
          };
          
          // Layout users within the allocated department width
          const departmentCenterX = xPosition + 128; // Center of w-64 department card (256/2 = 128)
          const departmentAllocatedWidth = departmentWidths[index]; // Width allocated for this department
          const departmentLeftBound = xPosition;
          const departmentRightBound = xPosition + departmentAllocatedWidth;
          
          if (roots.length === 1) {
            // Single root user - center it within department bounds
            const userCenterX = departmentCenterX;
            layoutHierarchy(roots[0], 0, userCenterX);
          } else {
            // Multiple roots - distribute within department bounds
            const availableWidth = departmentAllocatedWidth - 256; // Subtract department card width
            const totalRootsWidth = roots.reduce((sum, root) => {
              const rootSimulation = simulateHierarchyWidth(root);
              return sum + rootSimulation.width;
            }, 0);
            const spacingBetweenRoots = Math.max(100, (availableWidth - totalRootsWidth) / (roots.length + 1));
            
            let currentX = departmentLeftBound + spacingBetweenRoots;
            roots.forEach((rootUser) => {
              const rootSimulation = simulateHierarchyWidth(rootUser);
              layoutHierarchy(rootUser, 0, currentX + rootSimulation.width/2);
              currentX += rootSimulation.width + spacingBetweenRoots;
            });
          }
          
          // Simulate hierarchy width function (moved here to be accessible)
          function simulateHierarchyWidth(user: UserDetailResponse): { width: number, leftBound: number, rightBound: number } {
            const nodeWidth = 288;
            const minHorizontalSpacing = 60;
            
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
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6 border border-blue-200">
        <div className="space-y-2">
          <h3 className="text-2xl font-bold text-gray-900">組織図</h3>
          <p className="text-gray-600">
            {departments.length}部署 • {users.length}人のユーザー
          </p>
          <div className="flex gap-4 text-sm text-gray-600">
            <span>• 管理者: {users.filter(u => u.roles?.some(r => r.name.toLowerCase().includes('admin'))).length}人</span>
            <span>• マネージャー: {users.filter(u => u.roles?.some(r => r.name.toLowerCase().includes('manager'))).length}人</span>
            <span>• 承認待ち: {users.filter(u => u.status === 'pending_approval').length}人</span>
          </div>
        </div>
        
        <div className="mt-4 text-sm text-gray-600">
          <p>🏢 部署をクリックしてメンバーを表示・非表示できます</p>
        </div>
      </div>
      
      {/* Organization Chart */}
      <div className="w-full h-[1400px] border-2 border-gray-200 rounded-xl overflow-hidden bg-gradient-to-br from-gray-50 to-white shadow-lg">
        <ReactFlow
          nodes={nodesState}
          edges={edgesState}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ 
            padding: 0.02,
            includeHiddenNodes: false,
            minZoom: 0.05,
            maxZoom: 1.0
          }}
          minZoom={0.02}
          maxZoom={1.2}
          defaultViewport={{ x: 0, y: 0, zoom: 0.4 }}
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
            gap={30}
            size={1}
            className="opacity-20"
          />
          <Controls 
            showZoom={true}
            showFitView={true}
            showInteractive={false}
            position="top-right"
            className="bg-white/90 border border-gray-200 rounded-lg shadow-sm"
          />
        </ReactFlow>
      </div>
    </div>
  );
}