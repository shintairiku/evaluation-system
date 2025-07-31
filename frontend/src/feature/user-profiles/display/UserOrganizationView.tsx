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
  
  return (
    <Card className="w-64 shadow-lg border-2 hover:border-primary/50 transition-colors">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10">
            <AvatarFallback className="bg-primary/10 text-primary font-semibold">
              {user.name.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <CardTitle className="text-sm font-semibold truncate">
              {user.name}
            </CardTitle>
            <p className="text-xs text-muted-foreground truncate">
              {user.employee_code}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-2">
          {user.job_title && (
            <p className="text-xs text-muted-foreground truncate">
              {user.job_title}
            </p>
          )}
          
          {user.department && (
            <div className="flex items-center gap-1">
              <Building2 className="h-3 w-3 text-muted-foreground" />
              <span className="text-xs text-muted-foreground truncate">
                {user.department.name}
              </span>
            </div>
          )}
          
          {user.stage && (
            <div className="flex items-center gap-1">
              <Users className="h-3 w-3 text-muted-foreground" />
              <span className="text-xs text-muted-foreground truncate">
                {user.stage.name}
              </span>
            </div>
          )}
          
          {user.roles && user.roles.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {user.roles.slice(0, 2).map((role: any) => (
                <Badge key={role.id} variant="secondary" className="text-xs px-1 py-0">
                  {role.name}
                </Badge>
              ))}
              {user.roles.length > 2 && (
                <Badge variant="outline" className="text-xs px-1 py-0">
                  +{user.roles.length - 2}
                </Badge>
              )}
            </div>
          )}
          
          {user.status === 'pending_approval' && (
            <Badge variant="destructive" className="text-xs">
              承認待ち
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

// Custom node types
const nodeTypes: NodeTypes = {
  userNode: UserNode,
};

export default function UserOrganizationView({ users, onUserUpdate }: UserOrganizationViewProps) {
  // Debug: Log users data to check hierarchy
  useEffect(() => {
    console.log('UserOrganizationView - Users data:', users);
    console.log('UserOrganizationView - Users with supervisors:', users.filter(u => u.supervisor));
    console.log('UserOrganizationView - Users with subordinates:', users.filter(u => u.subordinates && u.subordinates.length > 0));
  }, [users]);
  
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
          style: { stroke: '#64748b', strokeWidth: 2 },
          animated: false,
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
      
      if (subordinates.length === 0) {
        // Leaf node
        node.position = {
          x: xOffset,
          y: level * 250,
        };
        return { width: 300, center: xOffset + 150 };
      }
      
      // Parent node - layout subordinates first
      let totalWidth = 0;
      let minX = xOffset;
      
      subordinates.forEach((subordinate) => {
        const result = layoutNodes(subordinate, level + 1, xOffset + totalWidth);
        totalWidth += result.width;
      });
      
      // Position parent node at center of children
      const centerX = minX + (totalWidth / 2);
      node.position = {
        x: centerX - 150, // Center the node (300px width)
        y: level * 250,
      };
      
      return { width: Math.max(totalWidth, 300), center: centerX };
    };
    
    // Layout each root user
    let currentX = 0;
    rootUsers.forEach((rootUser) => {
      const result = layoutNodes(rootUser, 0, currentX);
      currentX += result.width + 100; // Add spacing between root users
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">組織図</h3>
          <p className="text-sm text-muted-foreground">
            {users.length}人のユーザーを階層構造で表示
          </p>
        </div>
        <div className="text-xs text-muted-foreground">
          <p>ズーム: マウスホイール</p>
          <p>移動: ドラッグ</p>
        </div>
      </div>
      
      <div className="w-full h-[600px] border rounded-lg overflow-hidden bg-background">
        <ReactFlow
          nodes={nodesState}
          edges={edgesState}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.1}
          maxZoom={2}
          defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
          proOptions={{ hideAttribution: true }}
        >
          <Background color="#f1f5f9" gap={20} />
          <Controls />
        </ReactFlow>
      </div>
    </div>
  );
}
