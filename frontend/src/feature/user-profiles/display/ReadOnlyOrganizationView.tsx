"use client";

import React, { useState, useEffect, useMemo } from 'react';
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
import { Building2, Users, User } from 'lucide-react';
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
    users?: UserDetailResponse[];
  };
}) => {
  const { name, userCount, isDepartment = false, users = [] } = data;
  
  const getNodeStyle = () => {
    if (isDepartment) {
      return 'bg-blue-500 text-white border-blue-600';
    } else {
      return 'bg-blue-100 text-blue-900 border-blue-300';
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
      <Card className={`w-48 transition-all duration-200 ${getNodeStyle()}`}>
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
        
        {/* Show users in the node for smaller teams/departments */}
        {!isDepartment && users.length > 0 && users.length <= 3 && (
          <CardContent className="pt-0 pb-2">
            <div className="space-y-1">
              {users.map((user) => (
                <div key={user.id} className="text-xs flex items-center gap-1">
                  <User className="w-3 h-3" />
                  <span className="truncate">{user.name}</span>
                </div>
              ))}
            </div>
          </CardContent>
        )}
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
};

export default function ReadOnlyOrganizationView({ users }: ReadOnlyOrganizationViewProps) {
  const [departments, setDepartments] = useState<Department[]>([]);

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

    // Add company root node
    const companyName = '株式会社新大陸';
    nodeList.push({
      id: 'company-root',
      type: 'orgNode',
      position: { x: 400, y: 0 },
      data: { 
        name: companyName,
        userCount: users.length,
        isDepartment: true
      }
    });

    // Add department nodes
    departments.forEach((department, index) => {
      const deptUsers = organizationStructure.get(department.id) || [];
      const userCount = deptUsers.length;
      
      // Position departments horizontally below company
      const xPosition = (index * 250) + (400 - ((departments.length - 1) * 125));
      
      nodeList.push({
        id: department.id,
        type: 'orgNode',
        position: { x: xPosition, y: 150 },
        data: { 
          name: department.name,
          userCount,
          isDepartment: false,
          users: deptUsers
        }
      });
      
      // Add edge from company to department
      edgeList.push({
        id: `company-${department.id}`,
        source: 'company-root',
        target: department.id,
        type: 'smoothstep',
        style: { 
          stroke: '#3b82f6', 
          strokeWidth: 2,
          opacity: 0.8
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 15,
          height: 15,
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

    return { nodes: nodeList, edges: edgeList };
  }, [departments, users, organizationStructure]);

  const [nodesState, setNodes] = useNodesState(nodes);
  const [edgesState] = useEdgesState(edges);

  // Update nodes when organization changes
  useEffect(() => {
    setNodes(nodes);
  }, [nodes, setNodes]);

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
          <p>🏢 会社の組織構造を階層的に表示しています</p>
        </div>
      </div>
      
      {/* Organization Chart */}
      <div className="w-full h-[700px] border-2 border-gray-200 rounded-xl overflow-hidden bg-gradient-to-br from-gray-50 to-white shadow-lg">
        <ReactFlow
          nodes={nodesState}
          edges={edgesState}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ 
            padding: 0.1,
            includeHiddenNodes: false,
            minZoom: 0.4,
            maxZoom: 1.2
          }}
          minZoom={0.3}
          maxZoom={1.5}
          defaultViewport={{ x: 0, y: 0, zoom: 0.7 }}
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