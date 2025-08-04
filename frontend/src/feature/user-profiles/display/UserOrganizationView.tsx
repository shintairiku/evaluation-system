"use client";

import { useCallback, useMemo, useState, useEffect } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  NodeTypes,
  Handle,
  Position,
  NodeDragHandler,
  MarkerType,
} from 'reactflow';
import 'reactflow/dist/style.css';
import type { UserDetailResponse } from '@/api/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Building2, Users, User, Mail, RefreshCw, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { updateUserSupervisorAction } from '@/api/server-actions/users';


interface UserOrganizationViewProps {
  users: UserDetailResponse[];
  onUserUpdate?: (user: UserDetailResponse) => void;
}

// Custom node component for user cards
const UserNode = ({ data, selected, dragging }: { data: { user: UserDetailResponse }; selected?: boolean; dragging?: boolean }) => {
  const { user } = data;
  
  // Determine card styling based on user role, status, and drag state
  const getCardStyle = () => {
    let baseStyle = '';
    
    if (user.status === 'pending_approval') {
      baseStyle = 'border-orange-300 bg-orange-50/50';
    } else if (user.roles?.some((role: any) => role.name.toLowerCase().includes('admin'))) {
      baseStyle = 'border-blue-400 bg-blue-50/50';
    } else if (user.roles?.some((role: any) => role.name.toLowerCase().includes('manager'))) {
      baseStyle = 'border-green-400 bg-green-50/50';
    } else if (user.roles?.some((role: any) => role.name.toLowerCase().includes('supervisor'))) {
      baseStyle = 'border-purple-400 bg-purple-50/50';
    } else {
      baseStyle = 'border-gray-200 bg-white';
    }
    
    // Add drag feedback
    if (dragging) {
      baseStyle += ' opacity-70 shadow-2xl scale-105 z-50';
    } else if (selected) {
      baseStyle += ' ring-2 ring-blue-400';
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
      <Card className={`w-72 sm:w-64 md:w-72 group hover:shadow-md transition-all duration-200 cursor-grab active:cursor-grabbing ${getCardStyle()}`}>
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

// Change history interface
interface HierarchyChange {
  userId: string;
  oldSupervisorId: string | null;
  newSupervisorId: string | null;
  timestamp: number;
}

export default function UserOrganizationView({ users, onUserUpdate }: UserOrganizationViewProps) {
  // State for drag-and-drop functionality
  const [isDragging, setIsDragging] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [changeHistory, setChangeHistory] = useState<HierarchyChange[]>([]);
  const [layoutKey, setLayoutKey] = useState(0); // Force layout recalculation
  
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
            type: MarkerType.Arrow,
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
      const nodeWidth = 288; // w-72 = 288px (sm:w-64 = 256px on mobile)
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
      const childrenCenters: number[] = [];
      
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
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );
  
  // Validation functions
  const validateHierarchyChange = useCallback((userId: string, newSupervisorId: string | null): string | null => {
    // Cannot be supervisor of self
    if (userId === newSupervisorId) {
      return "ユーザーは自分自身の上司になることはできません";
    }
    
    // Check for circular hierarchy (would create infinite loop)
    if (newSupervisorId) {
      const wouldCreateCircle = (checkUserId: string, targetSupervisorId: string): boolean => {
        const user = users.find(u => u.id === checkUserId);
        if (!user?.supervisor?.id) return false;
        if (user.supervisor.id === targetSupervisorId) return true;
        return wouldCreateCircle(user.supervisor.id, targetSupervisorId);
      };
      
      if (wouldCreateCircle(newSupervisorId, userId)) {
        return "この変更は循環参照を作成するため許可されません";
      }
    }
    
    return null;
  }, [users]);
  
  // Handle supervisor change
  const handleSupervisorChange = useCallback(async (userId: string, newSupervisorId: string | null) => {
    const user = users.find(u => u.id === userId);
    if (!user) return;
    
    const oldSupervisorId = user.supervisor?.id || null;
    
    // Skip if no change
    if (oldSupervisorId === newSupervisorId) return;
    
    // Validate the change
    const validationError = validateHierarchyChange(userId, newSupervisorId);
    if (validationError) {
      toast.error("階層変更エラー", {
        description: validationError,
      });
      return;
    }
    
    setIsUpdating(true);
    
    try {
      const result = await updateUserSupervisorAction(userId, newSupervisorId);
      
      if (result.success && result.data) {
        // Add to change history
        const change: HierarchyChange = {
          userId,
          oldSupervisorId,
          newSupervisorId,
          timestamp: Date.now(),
        };
        setChangeHistory(prev => [...prev, change]);
        
        // Update the user data and trigger re-render
        if (onUserUpdate) {
          onUserUpdate(result.data);
        }
        
        // Force recalculation of layout
        setLayoutKey(prev => prev + 1);
        
        toast.success("階層更新完了", {
          description: `${user.name}の上司が正常に更新されました`,
        });
      } else {
        throw new Error(result.error || "更新に失敗しました");
      }
    } catch (error) {
      console.error('Error updating supervisor:', error);
      toast.error("更新エラー", {
        description: "上司の更新中にエラーが発生しました",
      });
    } finally {
      setIsUpdating(false);
    }
  }, [users, validateHierarchyChange, onUserUpdate]);
  
  // Handle undo last change
  const handleUndo = useCallback(async () => {
    if (changeHistory.length === 0) return;
    
    const lastChange = changeHistory[changeHistory.length - 1];
    setIsUpdating(true);
    
    try {
      const result = await updateUserSupervisorAction(lastChange.userId, lastChange.oldSupervisorId);
      
      if (result.success && result.data) {
        // Remove from history
        setChangeHistory(prev => prev.slice(0, -1));
        
        // Update the user data
        if (onUserUpdate) {
          onUserUpdate(result.data);
        }
        
        // Force recalculation of layout
        setLayoutKey(prev => prev + 1);
        
        toast.success("変更を元に戻しました", {
          description: "最後の階層変更が取り消されました",
        });
      } else {
        throw new Error(result.error || "元に戻す操作に失敗しました");
      }
    } catch (error) {
      console.error('Error undoing change:', error);
      toast.error("元に戻すエラー", {
        description: "変更を元に戻す際にエラーが発生しました",
      });
    } finally {
      setIsUpdating(false);
    }
  }, [changeHistory, onUserUpdate]);
  
  // Handle node drag start
  const onNodeDragStart: NodeDragHandler = useCallback((_event, _node) => {
    setIsDragging(true);
  }, []);
  
  // Handle node drag stop
  const onNodeDragStop: NodeDragHandler = useCallback(async (event, node) => {
    setIsDragging(false);
    
    if (isUpdating) return;
    
    // Get drop coordinates
    const dropX = event.clientX;
    const dropY = event.clientY;
    
    // Find the closest node to become supervisor
    let closestSupervisor: string | null = null;
    let closestDistance = Infinity;
    
    // Check all nodes in the React Flow
    const reactFlowWrapper = document.querySelector('.react-flow');
    if (reactFlowWrapper) {
      const allNodes = reactFlowWrapper.querySelectorAll('.react-flow__node');
      
      allNodes.forEach(nodeElement => {
        const nodeId = nodeElement.getAttribute('data-id');
        if (nodeId && nodeId !== node.id) {
          const nodeRect = nodeElement.getBoundingClientRect();
          const nodeCenterX = nodeRect.left + nodeRect.width / 2;
          const nodeCenterY = nodeRect.top + nodeRect.height / 2;
          
          // Calculate distance from drop point to node center
          const distance = Math.sqrt(
            Math.pow(dropX - nodeCenterX, 2) + Math.pow(dropY - nodeCenterY, 2)
          );
          
          // Define drop zones
          const DROP_ZONE_RADIUS = 150; // pixels
          const BELOW_ZONE_HEIGHT = 100; // Height of area below node to consider as "subordinate zone"
          
          // Check if dropped within reasonable distance
          if (distance < DROP_ZONE_RADIUS) {
            // Check if dropped below the node (subordinate position)
            const isDroppedBelow = dropY > nodeRect.bottom && 
                                  dropY < nodeRect.bottom + BELOW_ZONE_HEIGHT &&
                                  dropX > nodeRect.left - 50 && 
                                  dropX < nodeRect.right + 50;
            
            // Check if dropped directly on the node (any position)
            const isDroppedOnNode = dropX >= nodeRect.left && 
                                   dropX <= nodeRect.right && 
                                   dropY >= nodeRect.top && 
                                   dropY <= nodeRect.bottom;
            
            if (isDroppedBelow || isDroppedOnNode) {
              if (distance < closestDistance) {
                closestDistance = distance;
                closestSupervisor = nodeId;
              }
            }
          }
        }
      });
    }
    
    // If found a potential supervisor, make the connection
    if (closestSupervisor) {
      await handleSupervisorChange(node.id, closestSupervisor);
      return; // Don't reset position if we're processing a change
    }
    
    // If not dropped near any node, reset to original position
    setNodes(nodes);
    setEdges(edges);
  }, [isUpdating, handleSupervisorChange, nodes, edges, setNodes, setEdges]);
  
  // Update nodes and edges when users change or layout is forced
  useEffect(() => {
    setNodes(nodes);
    setEdges(edges);
  }, [nodes, edges, setNodes, setEdges, layoutKey]);
  
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
            <p>👆 階層変更: ユーザーをドラッグして上司の下にドロップ</p>
            <p>🎯 ドロップゾーン: 上司の上または下の近くにドロップ</p>
            <p>📱 リセット: ダブルクリック</p>
          </div>
        </div>
      </div>
      
      {/* React Flow Container */}
      <div className="w-full h-[900px] sm:h-[700px] md:h-[800px] lg:h-[900px] border-2 border-gray-200 rounded-xl overflow-hidden bg-gradient-to-br from-gray-50 to-white shadow-lg relative">
        {/* Undo Button - appears in top-left when there are changes */}
        {changeHistory.length > 0 && (
          <div className="absolute top-4 left-4 z-50">
            <Button
              onClick={handleUndo}
              disabled={isUpdating}
              variant="secondary"
              size="sm"
              className="flex items-center gap-2 bg-white/90 backdrop-blur-sm shadow-lg border border-gray-200 hover:bg-white/95 transition-all duration-200"
            >
              <Undo2 className="w-4 h-4" />
              元に戻す ({changeHistory.length})
            </Button>
          </div>
        )}
        
        {/* Loading indicator - appears in top-right when updating */}
        {isUpdating && (
          <div className="absolute top-4 right-4 z-50">
            <div className="flex items-center gap-2 text-sm text-blue-600 bg-white/90 backdrop-blur-sm shadow-lg border border-gray-200 rounded-md px-3 py-2">
              <RefreshCw className="w-4 h-4 animate-spin" />
              更新中...
            </div>
          </div>
        )}
        
        {/* Drop zone indicators - only show during drag */}
        {isDragging && (
          <style jsx>{`
            .react-flow__node {
              position: relative;
            }
            .react-flow__node::before {
              content: '';
              position: absolute;
              top: -20px;
              left: -10px;
              right: -10px;
              bottom: -60px;
              border: 2px dashed #3b82f6;
              border-radius: 8px;
              background: rgba(59, 130, 246, 0.1);
              opacity: 0.7;
              pointer-events: none;
              z-index: 1000;
            }
          `}</style>
        )}
        <ReactFlow
          nodes={nodesState}
          edges={edgesState}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeDragStart={onNodeDragStart}
          onNodeDragStop={onNodeDragStop}
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
          nodesDraggable={true}
          nodesConnectable={false}
          elementsSelectable={true}
          panOnDrag={!isDragging}
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
            position="top-right"
            className="bg-white/90 border border-gray-200 rounded-lg shadow-sm"
          />
        </ReactFlow>
      </div>
    </div>
  );
}
