"use client";

import { useCallback, useMemo, useState, useEffect } from 'react';
// @ts-ignore
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  EdgeTypes,
  NodeTypes,
  Handle,
  Position,
} from 'reactflow';
// @ts-ignore
import 'reactflow/dist/style.css';
import type { UserDetailResponse } from '@/api/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Building2, Users, User, Mail } from 'lucide-react';


interface UserOrganizationViewProps {
  users: UserDetailResponse[];
  onUserUpdate?: (user: UserDetailResponse) => void;
}

// Custom node component for user cards
const UserNode = ({ data }: { data: any }) => {
  const { user } = data;
  
  // Determine card styling based on user role and status
  const getCardStyle = () => {
    if (user.status === 'pending_approval') {
      return 'border-orange-300 bg-orange-50/50';
    }
    if (user.roles?.some((role: any) => role.name.toLowerCase().includes('admin'))) {
      return 'border-blue-400 bg-blue-50/50';
    }
    if (user.roles?.some((role: any) => role.name.toLowerCase().includes('manager'))) {
      return 'border-green-400 bg-green-50/50';
    }
    if (user.roles?.some((role: any) => role.name.toLowerCase().includes('supervisor'))) {
      return 'border-purple-400 bg-purple-50/50';
    }
    return 'border-gray-200 bg-white';
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
      <Card className={`w-72 group hover:shadow-md transition-shadow ${getCardStyle()}`}>
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
                user.roles.map((role: any) => (
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

// Custom node types
const nodeTypes: NodeTypes = {
  userNode: UserNode,
};

export default function UserOrganizationView({ users, onUserUpdate }: UserOrganizationViewProps) {
  // Build hierarchy from users data
  const { nodes, edges } = useMemo(() => {
    const nodeMap = new Map<string, Node>();
    const edgeList: Edge[] = [];
    
    // Create nodes for all users
    users.forEach((user) => {
      nodeMap.set(user.id, {
        id: user.id,
        type: 'userNode',
        position: { x: 0, y: 0 }, // Will be calculated by layout
        data: { user },
      });
    });
    
    // Create edges for supervisor-subordinate relationships
    users.forEach((user) => {
      if (user.supervisor && user.supervisor.id && user.id) {
        edgeList.push({
          id: `${user.supervisor.id}-${user.id}`,
          source: user.supervisor.id,
          target: user.id,
          sourceHandle: 'bottom',
          targetHandle: 'top',
          type: 'smoothstep',
          style: { 
            stroke: '#3b82f6', 
            strokeWidth: 3,
            opacity: 0.8
          },
          animated: false,
          markerEnd: {
            type: 'arrowclosed',
            width: 20,
            height: 20,
            color: '#3b82f6',
          },
        });
      }
    });
    
    // Auto-layout: Find root nodes (users without supervisors)
    const rootUsers = users.filter(user => !user.supervisor);
    const visited = new Set<string>();
    
    const layoutNodes = (user: UserDetailResponse, level: number, xOffset: number): { width: number, center: number } => {
      // Check if user exists in filtered set
      if (!nodeMap.has(user.id)) return { width: 0, center: 0 };
      if (visited.has(user.id)) return { width: 0, center: 0 };
      visited.add(user.id);
      
      const node = nodeMap.get(user.id);
      if (!node) return { width: 0, center: 0 };
      
      // Get subordinates that exist in the filtered users
      const subordinates = users.filter(u => u.supervisor?.id === user.id && nodeMap.has(u.id));
      
      // Improved spacing and layout for better visualization
      const nodeWidth = 288; // w-72 = 288px
      const verticalSpacing = 450; // Increased for better line visibility
      const horizontalSpacing = 120; // Further increased to prevent overlaps
      const minNodeSpacing = 50; // Minimum spacing to prevent overlaps
      
      if (subordinates.length === 0) {
        // Leaf node
        node.position = {
          x: xOffset,
          y: level * verticalSpacing,
        };
        return { width: nodeWidth + minNodeSpacing, center: xOffset + (nodeWidth / 2) };
      }
      
      // Parent node - layout subordinates first
      let totalWidth = 0;
      let childrenCenters: number[] = [];
      
      subordinates.forEach((subordinate) => {
        const result = layoutNodes(subordinate, level + 1, xOffset + totalWidth);
        if (result.width > 0) { // Only add if node exists
          childrenCenters.push(result.center);
          totalWidth += result.width;
          // Add spacing between children
          totalWidth += horizontalSpacing;
        }
      });
      
      // Remove extra spacing from the last child
      if (childrenCenters.length > 0) {
        totalWidth -= horizontalSpacing;
      }
      
      // Ensure minimum width for proper spacing
      const actualWidth = Math.max(totalWidth, nodeWidth + minNodeSpacing);
      
      // Position parent node at center of children, or at current offset if no children
      const centerX = childrenCenters.length > 0 
        ? (childrenCenters[0] + childrenCenters[childrenCenters.length - 1]) / 2
        : xOffset + (nodeWidth / 2);
        
      node.position = {
        x: Math.max(xOffset, centerX - (nodeWidth / 2)), // Ensure minimum position
        y: level * verticalSpacing,
      };
      
      return { width: actualWidth, center: centerX };
    };
    
    // Layout each root user with better spacing
    let currentX = 0;
    const minRootSpacing = 300; // Minimum spacing between root hierarchies
    
    rootUsers.forEach((rootUser) => {
      if (nodeMap.has(rootUser.id)) { // Only layout if root user exists in filtered set
        const result = layoutNodes(rootUser, 0, currentX);
        if (result.width > 0) {
          currentX += result.width + minRootSpacing; // Consistent spacing between root users
        }
      }
    });
    
    // Post-process to fix any remaining overlaps
    const allNodes = Array.from(nodeMap.values());
    const nodesByLevel = new Map<number, Node[]>();
    
    // Group nodes by level
    allNodes.forEach(node => {
      const level = Math.round(node.position.y / 450); // verticalSpacing = 450
      if (!nodesByLevel.has(level)) {
        nodesByLevel.set(level, []);
      }
      nodesByLevel.get(level)!.push(node);
    });
    
    // Fix overlaps within each level
    nodesByLevel.forEach(levelNodes => {
      levelNodes.sort((a, b) => a.position.x - b.position.x);
      
      for (let i = 1; i < levelNodes.length; i++) {
        const prevNode = levelNodes[i - 1];
        const currentNode = levelNodes[i];
        const minDistance = 288 + 80; // nodeWidth + minSpacing
        
        if (currentNode.position.x < prevNode.position.x + minDistance) {
          currentNode.position.x = prevNode.position.x + minDistance;
        }
      }
    });
    
    return {
      nodes: allNodes,
      edges: edgeList,
    };
  }, [users]);
  
  const [nodesState, setNodes, onNodesChange] = useNodesState(nodes);
  const [edgesState, setEdges, onEdgesChange] = useEdgesState(edges);
  
  const onConnect = useCallback(
    (params: Connection) => setEdges((eds: any) => addEdge(params, eds)),
    [setEdges]
  );
  
  // Update nodes and edges when users change
  useMemo(() => {
    setNodes(nodes);
    setEdges(edges);
  }, [nodes, edges, setNodes, setEdges]);
  
  if (users.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 border-2 border-dashed border-muted-foreground/25 rounded-lg">
        <div className="text-center">
          <User className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold text-muted-foreground">組織図が表示できません</h3>
          <p className="text-sm text-muted-foreground mt-2">
            ユーザーデータがありません。
          </p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      {/* Header with statistics */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6 border border-blue-200">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <h3 className="text-2xl font-bold text-gray-900">組織図</h3>
            <p className="text-gray-600">
              {users.length}人のユーザーを階層構造で表示
            </p>
            <div className="flex gap-4 text-sm text-gray-600">
              <span>• 管理者: {users.filter(u => u.roles?.some(r => r.name.toLowerCase().includes('admin'))).length}人</span>
              <span>• マネージャー: {users.filter(u => u.roles?.some(r => r.name.toLowerCase().includes('manager'))).length}人</span>
              <span>• 承認待ち: {users.filter(u => u.status === 'pending_approval').length}人</span>
            </div>
          </div>
          <div className="text-right text-sm text-gray-600 space-y-1">
            <p className="font-medium">操作方法:</p>
            <p>🔍 ズーム: マウスホイール</p>
            <p>🖱️ 移動: ドラッグ</p>
            <p>📱 リセット: ダブルクリック</p>
          </div>
        </div>
      </div>
      
      {/* React Flow Container */}
      <div className="w-full h-[900px] border-2 border-gray-200 rounded-xl overflow-hidden bg-gradient-to-br from-gray-50 to-white shadow-lg">
        <ReactFlow
          nodes={nodesState}
          edges={edgesState}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
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
          defaultViewport={{ x: 0, y: 0, zoom: 0.6 }}
          proOptions={{ hideAttribution: true }}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={true}
          panOnDrag={true}
          zoomOnScroll={true}
          zoomOnPinch={true}
          zoomOnDoubleClick={true}
          preventScrolling={true}
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
            position="bottom-left"
            className="bg-white/90 border border-gray-200 rounded-lg shadow-sm"
          />
        </ReactFlow>
      </div>
    </div>
  );
}
