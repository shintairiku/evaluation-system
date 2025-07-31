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
} from 'reactflow';
// @ts-ignore
import 'reactflow/dist/style.css';
import type { UserDetailResponse } from '@/api/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Building2, Users, User } from 'lucide-react';


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

  const getAvatarStyle = () => {
    if (user.status === 'pending_approval') {
      return 'bg-orange-100 text-orange-700';
    }
    if (user.roles?.some((role: any) => role.name.toLowerCase().includes('admin'))) {
      return 'bg-blue-100 text-blue-700';
    }
    if (user.roles?.some((role: any) => role.name.toLowerCase().includes('manager'))) {
      return 'bg-green-100 text-green-700';
    }
    if (user.roles?.some((role: any) => role.name.toLowerCase().includes('supervisor'))) {
      return 'bg-purple-100 text-purple-700';
    }
    return 'bg-gray-100 text-gray-700';
  };

  return (
    <Card className={`w-72 shadow-xl border-2 hover:shadow-2xl transition-all duration-300 ${getCardStyle()}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <Avatar className="h-12 w-12">
            <AvatarFallback className={`font-bold text-sm ${getAvatarStyle()}`}>
              {user.name.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base font-bold truncate text-gray-900">
              {user.name}
            </CardTitle>
            <p className="text-sm text-gray-600 font-mono">
              {user.employee_code}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        {user.job_title && (
          <div className="bg-gray-50 rounded-lg p-2">
            <p className="text-sm font-medium text-gray-800 truncate">
              {user.job_title}
            </p>
          </div>
        )}
        
        <div className="grid grid-cols-1 gap-2">
          {user.department && (
            <div className="flex items-center gap-2 bg-blue-50 rounded-lg p-2">
              <Building2 className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-800 truncate">
                {user.department.name}
              </span>
            </div>
          )}
          
          {user.stage && (
            <div className="flex items-center gap-2 bg-green-50 rounded-lg p-2">
              <Users className="h-4 w-4 text-green-600" />
              <span className="text-sm font-medium text-green-800 truncate">
                {user.stage.name}
              </span>
            </div>
          )}
        </div>
        
        {user.roles && user.roles.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {user.roles.slice(0, 3).map((role: any) => (
              <Badge 
                key={role.id} 
                variant="secondary" 
                className="text-xs px-2 py-1 font-medium"
              >
                {role.name}
              </Badge>
            ))}
            {user.roles.length > 3 && (
              <Badge variant="outline" className="text-xs px-2 py-1">
                +{user.roles.length - 3}
              </Badge>
            )}
          </div>
        )}
        
        {user.status === 'pending_approval' && (
          <Badge variant="destructive" className="text-xs px-2 py-1 font-medium">
            承認待ち
          </Badge>
        )}
      </CardContent>
    </Card>
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
      if (user.supervisor) {
        edgeList.push({
          id: `${user.supervisor.id}-${user.id}`,
          source: user.supervisor.id,
          target: user.id,
          type: 'smoothstep',
          style: { 
            stroke: '#3b82f6', 
            strokeWidth: 3,
            strokeDasharray: '5,5',
            opacity: 0.7
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
    
    const layoutNodes = (user: UserDetailResponse, level: number, xOffset: number) => {
      if (visited.has(user.id)) return { width: 0, center: 0 };
      visited.add(user.id);
      
      const node = nodeMap.get(user.id);
      if (!node) return { width: 0, center: 0 };
      
      // Get subordinates
      const subordinates = users.filter(u => u.supervisor?.id === user.id);
      
      // Improved spacing and layout
      const nodeWidth = 288; // w-72 = 288px
      const verticalSpacing = 320; // Increased from 250
      const horizontalSpacing = 50; // Spacing between nodes at same level
      
      if (subordinates.length === 0) {
        // Leaf node
        node.position = {
          x: xOffset,
          y: level * verticalSpacing,
        };
        return { width: nodeWidth + horizontalSpacing, center: xOffset + (nodeWidth / 2) };
      }
      
      // Parent node - layout subordinates first
      let totalWidth = 0;
      let minX = xOffset;
      
      subordinates.forEach((subordinate, index) => {
        const result = layoutNodes(subordinate, level + 1, xOffset + totalWidth);
        totalWidth += result.width;
        if (index < subordinates.length - 1) {
          totalWidth += horizontalSpacing; // Add spacing between children
        }
      });
      
      // Position parent node at center of children
      const centerX = minX + (totalWidth / 2);
      node.position = {
        x: centerX - (nodeWidth / 2), // Center the node
        y: level * verticalSpacing,
      };
      
      return { width: Math.max(totalWidth, nodeWidth), center: centerX };
    };
    
    // Layout each root user with better spacing
    let currentX = 0;
    rootUsers.forEach((rootUser, index) => {
      const result = layoutNodes(rootUser, 0, currentX);
      currentX += result.width + 150; // Increased spacing between root users
    });
    
    return {
      nodes: Array.from(nodeMap.values()),
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
      <div className="w-full h-[700px] border-2 border-gray-200 rounded-xl overflow-hidden bg-gradient-to-br from-gray-50 to-white shadow-lg">
        <ReactFlow
          nodes={nodesState}
          edges={edgesState}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ 
            padding: 0.3,
            includeHiddenNodes: false,
            minZoom: 0.5,
            maxZoom: 1.2
          }}
          minZoom={0.3}
          maxZoom={1.5}
          defaultViewport={{ x: 0, y: 0, zoom: 0.9 }}
          proOptions={{ hideAttribution: true }}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          panOnDrag={true}
          zoomOnScroll={true}
          zoomOnPinch={true}
          zoomOnDoubleClick={false}
          preventScrolling={true}
        >
          <Background 
            color="#e2e8f0" 
            gap={30}
            size={1}
            className="opacity-50"
          />
          <Controls 
            showZoom={true}
            showFitView={true}
            showInteractive={false}
            position="bottom-left"
          />
        </ReactFlow>
      </div>
    </div>
  );
}
