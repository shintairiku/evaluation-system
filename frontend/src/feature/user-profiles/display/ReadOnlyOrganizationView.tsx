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
import { Building2, Users, User, Mail, ArrowLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { 
  getDepartmentManagersAction, 
  getDepartmentSupervisorsAction, 
  getSubordinatesAction, 
  getProfileOptionsAction 
} from '@/api/server-actions/users';

interface ReadOnlyOrganizationViewProps {
  users: UserDetailResponse[];
}

// Navigation state types for task #168
type NavigationLevel = 'departments' | 'managers' | 'subordinates';

interface NavigationState {
  level: NavigationLevel;
  currentDepartment?: Department;
  currentSupervisor?: UserDetailResponse;
  breadcrumb: string[];
}

// Custom node component for department blocks (Task #168)
const DepartmentNode = ({ 
  data
}: { 
  data: { department: Department; userCount: number; onDepartmentClick: (departmentId: string) => void };
}) => {
  const { department, userCount, onDepartmentClick } = data;
  
  return (
    <Card 
      className="w-80 cursor-pointer hover:shadow-lg transition-all duration-200 border-blue-300 bg-blue-50/80"
      onClick={() => onDepartmentClick(department.id)}
    >
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center">
              <Building2 className="w-6 h-6 text-white" />
            </div>
            <div>
              <CardTitle className="text-lg">{department.name}</CardTitle>
              <CardDescription className="flex items-center gap-1 mt-1">
                <Users className="w-3 h-3" />
                {userCount}人
              </CardDescription>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-blue-500" />
        </div>
      </CardHeader>
    </Card>
  );
};

// Custom node component for managers/supervisors (Task #168)
const ManagerNode = ({ 
  data
}: { 
  data: { user: UserDetailResponse; onManagerClick?: (userId: string) => void };
}) => {
  const { user, onManagerClick } = data;
  
  const getCardStyle = () => {
    if (user.roles?.some((role) => role.name.toLowerCase().includes('admin'))) {
      return 'border-blue-400 bg-blue-50/50';
    } else if (user.roles?.some((role) => role.name.toLowerCase().includes('manager'))) {
      return 'border-green-400 bg-green-50/50';
    } else if (user.roles?.some((role) => role.name.toLowerCase().includes('supervisor'))) {
      return 'border-purple-400 bg-purple-50/50';
    } else {
      return 'border-gray-200 bg-white';
    }
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
    <Card 
      className={`w-72 ${onManagerClick ? 'cursor-pointer hover:shadow-lg' : ''} transition-all duration-200 ${getCardStyle()}`}
      onClick={() => onManagerClick?.(user.id)}
    >
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <CardTitle className="text-lg">{user.name}</CardTitle>
              <ChevronRight className="w-4 h-4 text-gray-400" />
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
  );
};

// Custom node component for subordinates (Task #168)
const SubordinateNode = ({ data }: { data: { user: UserDetailResponse } }) => {
  const { user } = data;
  
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
      <Card className="w-64 border-gray-200 bg-white">
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="text-lg">{user.name}</CardTitle>
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
          <div className="flex items-center gap-2 text-sm">
            <Mail className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <span className="truncate" title={user.email}>
              {user.email}
            </span>
          </div>

          {/* ステージ */}
          {user.stage && (
            <div className="flex items-center gap-2 text-sm">
              <Users className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <Badge variant="secondary" className="text-xs">
                {user.stage.name}
              </Badge>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

// Node types for different navigation levels
const nodeTypes: NodeTypes = {
  departmentNode: DepartmentNode,
  managerNode: ManagerNode,
  subordinateNode: SubordinateNode,
};

export default function ReadOnlyOrganizationView({ users }: ReadOnlyOrganizationViewProps) {
  // Task #168: Navigation state for drill-down functionality
  const [navigationState, setNavigationState] = useState<NavigationState>({
    level: 'departments',
    breadcrumb: ['部署一覧']
  });
  
  const [currentUsers, setCurrentUsers] = useState<UserDetailResponse[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(false);

  // Load departments on mount
  useEffect(() => {
    const loadDepartments = async () => {
      try {
        const result = await getProfileOptionsAction();
        if (result.success && result.data) {
          setDepartments(result.data.departments);
        }
      } catch (error) {
        console.error('Error loading departments:', error);
      }
    };
    
    loadDepartments();
  }, []);

  // Task #168: Handle department click - show managers/supervisors
  const handleDepartmentClick = useCallback(async (departmentId: string) => {
    setLoading(true);
    try {
      const department = departments.find(d => d.id === departmentId);
      if (!department) return;

      // Get both managers and supervisors for this department
      const [managersResult, supervisorsResult] = await Promise.all([
        getDepartmentManagersAction(departmentId),
        getDepartmentSupervisorsAction(departmentId)
      ]);

      const managers = managersResult.success ? managersResult.data?.items || [] : [];
      const supervisors = supervisorsResult.success ? supervisorsResult.data?.items || [] : [];
      
      // Combine and deduplicate users
      const allLeaders = [...managers, ...supervisors];
      const uniqueLeaders = allLeaders.filter((user, index, self) => 
        index === self.findIndex(u => u.id === user.id)
      );

      setCurrentUsers(uniqueLeaders);
      setNavigationState({
        level: 'managers',
        currentDepartment: department,
        breadcrumb: ['部署一覧', department.name]
      });
    } catch (error) {
      console.error('Error loading department managers:', error);
    } finally {
      setLoading(false);
    }
  }, [departments]);

  // Task #168: Handle manager/supervisor click - show subordinates
  const handleManagerClick = useCallback(async (userId: string) => {
    setLoading(true);
    try {
      const manager = currentUsers.find(u => u.id === userId);
      if (!manager) return;

      const subordinatesResult = await getSubordinatesAction(userId);
      const subordinates = subordinatesResult.success ? subordinatesResult.data?.items || [] : [];

      setCurrentUsers(subordinates);
      setNavigationState(prev => ({
        level: 'subordinates',
        currentDepartment: prev.currentDepartment,
        currentSupervisor: manager,
        breadcrumb: [...prev.breadcrumb, manager.name, '部下一覧']
      }));
    } catch (error) {
      console.error('Error loading subordinates:', error);
    } finally {
      setLoading(false);
    }
  }, [currentUsers]);

  // Handle navigation back
  const handleBack = useCallback(() => {
    if (navigationState.level === 'subordinates') {
      // Go back to managers level
      handleDepartmentClick(navigationState.currentDepartment!.id);
    } else if (navigationState.level === 'managers') {
      // Go back to departments level
      setNavigationState({
        level: 'departments',
        breadcrumb: ['部署一覧']
      });
      setCurrentUsers([]);
    }
  }, [navigationState.level, navigationState.currentDepartment, handleDepartmentClick]);

  // Memoized functions to avoid infinite loops
  const memoizedHandleDepartmentClick = useMemo(() => handleDepartmentClick, [handleDepartmentClick]);
  const memoizedHandleManagerClick = useMemo(() => handleManagerClick, [handleManagerClick]);

  // Generate nodes and edges based on current navigation level
  const { nodes, edges } = useMemo(() => {
    const nodeList: Node[] = [];
    const edgeList: Edge[] = [];

    if (navigationState.level === 'departments') {
      // Show department blocks
      departments.forEach((department, index) => {
        const userCount = users.filter(u => u.department?.id === department.id).length;
        
        nodeList.push({
          id: department.id,
          type: 'departmentNode',
          position: { x: (index % 3) * 350, y: Math.floor(index / 3) * 200 },
          data: { 
            department, 
            userCount,
            onDepartmentClick: memoizedHandleDepartmentClick
          }
        });
      });
    } else if (navigationState.level === 'managers') {
      // Show managers/supervisors in grid layout
      currentUsers.forEach((user, index) => {
        nodeList.push({
          id: user.id,
          type: 'managerNode',
          position: { x: (index % 3) * 300, y: Math.floor(index / 3) * 220 },
          data: { 
            user,
            onManagerClick: memoizedHandleManagerClick
          }
        });
      });
    } else if (navigationState.level === 'subordinates') {
      // Show subordinates in hierarchical layout
      const supervisor = navigationState.currentSupervisor;
      
      if (supervisor) {
        // Add supervisor node at top
        nodeList.push({
          id: supervisor.id,
          type: 'managerNode',
          position: { x: Math.max(0, (currentUsers.length - 1) * 150), y: 0 },
          data: { 
            user: supervisor
            // No onManagerClick for subordinates view
          }
        });
        
        // Add subordinates below
        currentUsers.forEach((user, index) => {
          nodeList.push({
            id: user.id,
            type: 'subordinateNode',
            position: { x: index * 300, y: 250 },
            data: { user }
          });
          
          // Add edge from supervisor to subordinate
          edgeList.push({
            id: `${supervisor.id}-${user.id}`,
            source: supervisor.id,
            target: user.id,
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

    return { nodes: nodeList, edges: edgeList };
  }, [navigationState, departments, currentUsers, users, memoizedHandleDepartmentClick, memoizedHandleManagerClick]);

  const [nodesState, setNodes] = useNodesState(nodes);
  const [edgesState] = useEdgesState(edges);

  // Update nodes when navigation changes
  useEffect(() => {
    setNodes(nodes);
  }, [nodes, setNodes]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with breadcrumb navigation */}
      <div className="bg-gradient-to-r from-green-50 to-teal-50 rounded-lg p-6 border border-green-200">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <h3 className="text-2xl font-bold text-gray-900">組織構造ナビゲーション</h3>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              {navigationState.breadcrumb.map((item, index) => (
                <React.Fragment key={index}>
                  <span className={index === navigationState.breadcrumb.length - 1 ? 'font-semibold text-gray-900' : ''}>
                    {item}
                  </span>
                  {index < navigationState.breadcrumb.length - 1 && (
                    <ChevronRight className="w-4 h-4" />
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>
          
          {/* Back button */}
          {navigationState.level !== 'departments' && (
            <Button
              onClick={handleBack}
              variant="outline"
              className="flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              戻る
            </Button>
          )}
        </div>
        
        <div className="mt-4 text-sm text-gray-600">
          {navigationState.level === 'departments' && (
            <p>🏢 部署をクリックして、その部署の管理者・監督者を表示</p>
          )}
          {navigationState.level === 'managers' && (
            <p>👥 管理者・監督者をクリックして、その部下を表示</p>
          )}
          {navigationState.level === 'subordinates' && (
            <p>👤 {navigationState.currentSupervisor?.name} の部下一覧</p>
          )}
        </div>
      </div>
      
      {/* React Flow Container */}
      <div className="w-full h-[600px] border-2 border-gray-200 rounded-xl overflow-hidden bg-gradient-to-br from-gray-50 to-white shadow-lg">
        <ReactFlow
          nodes={nodesState}
          edges={edgesState}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ 
            padding: 0.2,
            includeHiddenNodes: false,
            minZoom: 0.3,
            maxZoom: 1.0
          }}
          minZoom={0.2}
          maxZoom={1.5}
          defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
          proOptions={{ hideAttribution: true }}
          nodesDraggable={false}  // Read-only: no dragging
          nodesConnectable={false}  // Read-only: no connections
          elementsSelectable={true}
          panOnDrag={true}
          zoomOnScroll={true}
          zoomOnPinch={true}
          zoomOnDoubleClick={true}
        >
          <Background 
            color="#e2e8f0" 
            gap={40}
            size={1.5}
            className="opacity-30"
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