"use client";

import React, { useCallback, useMemo, useState, useEffect } from 'react';
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
import { Building2, Users, User, Mail, RefreshCw, Undo2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { updateUserAction } from '@/api/server-actions/users';
import { validateHierarchyChange as validateHierarchyChangeUtil } from '@/utils/hierarchy';


interface UserOrganizationViewProps {
  users: UserDetailResponse[];
  onUserUpdate?: (user: UserDetailResponse) => void;
}

// Custom node component for user cards
const UserNode = ({ data, selected, dragging }: { data: { user: UserDetailResponse; hasPendingChange?: boolean }; selected?: boolean; dragging?: boolean }) => {
  const { user, hasPendingChange } = data;
  
  // Determine card styling based on user role, status, and drag state
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
    
    // Add drag feedback and pending changes indicator
    if (dragging) {
      baseStyle += ' opacity-70 shadow-2xl scale-105 z-50';
    } else if (selected) {
      baseStyle += ' ring-2 ring-blue-400';
    } else if (hasPendingChange) {
      baseStyle += ' ring-2 ring-red-400 shadow-lg';
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
              <div className="flex items-center gap-2">
                <CardTitle className="text-lg">{user.name}</CardTitle>
                {hasPendingChange && (
                  <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" title="Mudança pendente" />
                )}
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

// Custom node types
const nodeTypes: NodeTypes = {
  userNode: UserNode,
};

// Pending change interface for local state
interface PendingChange {
  userId: string;
  newSupervisorId: string | null;
  originalSupervisorId: string | null;
  timestamp: number;
}

export default function UserOrganizationView({ users, onUserUpdate }: UserOrganizationViewProps) {
  
  // State for drag-and-drop functionality
  const [isDragging, setIsDragging] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [pendingChanges, setPendingChanges] = useState<PendingChange[]>([]);
  const [layoutKey, setLayoutKey] = useState(0); // Force layout recalculation
  
  // Build hierarchy from users data
  const { nodes, edges } = useMemo(() => {
    const nodeMap = new Map<string, Node>();
    const edgeList: Edge[] = [];
    
    // Helper: effective supervisor id considering pending changes
    const getEffectiveSupervisorId = (u: UserDetailResponse): string | undefined => {
      const pending = pendingChanges.find((c) => c.userId === u.id);
      if (pending) {
        return pending.newSupervisorId || undefined;
      }
      return u.supervisor?.id;
    };
    
    // Create nodes for all users
    users.forEach((user) => {
      const hasPendingChange = pendingChanges.some(change => change.userId === user.id);
      
      nodeMap.set(user.id, {
        id: user.id,
        type: 'userNode',
        position: { x: 0, y: 0 }, // Will be calculated by layout
        data: { user, hasPendingChange },
      });
    });
    
    // Create edges for supervisor-subordinate relationships using effective supervisor id
    users.forEach((user) => {
      const effectiveSupervisorId = getEffectiveSupervisorId(user);
      if (effectiveSupervisorId && user.id) {
        // Check if this user has pending changes
        const hasPendingChange = pendingChanges.some(change => change.userId === user.id);
        
        // Use red color for users with pending changes, blue for normal
        const edgeColor = hasPendingChange ? '#ef4444' : '#3b82f6'; // red-500 : blue-500
        const edgeOpacity = hasPendingChange ? 0.9 : 0.8;
        const strokeWidth = hasPendingChange ? 4 : 3;
        
        edgeList.push({
          id: `${effectiveSupervisorId}-${user.id}`,
          source: effectiveSupervisorId,
          target: user.id,
          sourceHandle: 'bottom',
          targetHandle: 'top',
          type: 'smoothstep',
          style: { 
            stroke: edgeColor, 
            strokeWidth: strokeWidth,
            opacity: edgeOpacity
          },
          animated: hasPendingChange, // Animate pending changes for extra visibility
          markerEnd: {
            type: MarkerType.ArrowClosed,
            width: 20,
            height: 20,
            color: edgeColor,
          },
        });
      }
    });
    
    // Auto-layout: Find root nodes (users without effective supervisors)
    const rootUsers = users.filter(user => !getEffectiveSupervisorId(user));
    const visited = new Set<string>();
    
    const layoutNodes = (user: UserDetailResponse, level: number, xOffset: number): { width: number, center: number } => {
      // Check if user exists in filtered set
      if (!nodeMap.has(user.id)) return { width: 0, center: 0 };
      if (visited.has(user.id)) return { width: 0, center: 0 };
      visited.add(user.id);
      
      const node = nodeMap.get(user.id);
      if (!node) return { width: 0, center: 0 };
      
      // Get subordinates by effective relationship and that exist in the filtered set
      const subordinates = users.filter(
        (u) => getEffectiveSupervisorId(u) === user.id && nodeMap.has(u.id)
      );
      
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
  }, [users, pendingChanges]);
  
  const [nodesState, setNodes, onNodesChange] = useNodesState(nodes);
  const [edgesState, setEdges, onEdgesChange] = useEdgesState(edges);
  
  const onConnect = useCallback(
    (params: Connection) => setEdges((eds: Edge[]) => addEdge(params, eds)),
    [setEdges]
  );
  
  // Validation functions
  const validateHierarchyChange = useCallback(
    (userId: string, newSupervisorId: string | null): string | null =>
      validateHierarchyChangeUtil(users, userId, newSupervisorId),
    [users]
  );
  
  // Handle supervisor change (now only adds pending changes)
  const handleSupervisorChange = useCallback((userId: string, newSupervisorId: string | null) => {
    
    const user = users.find(u => u.id === userId);
    if (!user) return;
    
    // Get the current supervisor (considering pending changes)
    const existingPendingChange = pendingChanges.find(change => change.userId === userId);
    const currentSupervisorId = existingPendingChange 
      ? existingPendingChange.newSupervisorId 
      : user.supervisor?.id || null;
    
    // Skip if no change
    if (currentSupervisorId === newSupervisorId) return;
    
    // Validate the change
    const validationError = validateHierarchyChange(userId, newSupervisorId);
    if (validationError) {
      toast.error("階層変更エラー", {
        description: validationError,
      });
      return;
    }
    
    // Add or update pending change
    const originalSupervisorId = user.supervisor?.id || null;
    const pendingChange: PendingChange = {
      userId,
      newSupervisorId,
      originalSupervisorId,
      timestamp: Date.now(),
    };
    
    setPendingChanges(prev => {
      // Remove existing pending change for this user if any
      const filtered = prev.filter(change => change.userId !== userId);
      
      // If the new supervisor is the same as original, don't add to pending
      if (newSupervisorId === originalSupervisorId) {
        return filtered;
      }
      
      // Add the new pending change
      return [...filtered, pendingChange];
    });
    
    // Force layout recalculation to show visual changes
    setLayoutKey(prev => prev + 1);
    
    const supervisorName = newSupervisorId 
      ? users.find(u => u.id === newSupervisorId)?.name || '不明'
      : 'なし';
    
    toast.info("変更待機中", {
      description: `${user.name}の上司を${supervisorName}に変更予定。赤い線で表示されます。「保存」をクリックして確定してください。`,
    });
  }, [users, pendingChanges, validateHierarchyChange]);
  
  // Handle undo last pending change
  const handleUndo = useCallback(() => {
    if (pendingChanges.length === 0) return;
    
    // Remove the last pending change
    setPendingChanges(prev => prev.slice(0, -1));
    
    // Force layout recalculation
    setLayoutKey(prev => prev + 1);
    
    toast.success("変更を取り消しました", {
      description: "最後の保留中の変更が取り消されました",
    });
  }, [pendingChanges]);
  
  // Handle save all pending changes
  const handleSaveChanges = useCallback(async () => {
    if (pendingChanges.length === 0) return;
    
    setIsSaving(true);
    const successfulChanges: PendingChange[] = [];
    let hasErrors = false;
    
    // Optimistic update: Clear pending changes immediately for better UX
    const changesToProcess = [...pendingChanges];
    setPendingChanges([]);
    setLayoutKey(prev => prev + 1);
    
    try {
      // Determine final target supervisors map
      const finalSupervisorMap = new Map<string, string | null>();
      users.forEach(u => finalSupervisorMap.set(u.id, u.supervisor?.id || null));
      changesToProcess.forEach(change => {
        finalSupervisorMap.set(change.userId, change.newSupervisorId);
      });

      // Compute depths in final tree (roots depth 0)
      const computeDepths = () => {
        const depths = new Map<string, number>();
        // Identify roots (users whose final supervisor is null or missing)
        const roots = users
          .map(u => u.id)
          .filter(id => !finalSupervisorMap.get(id));

        const childrenByParent = new Map<string, string[]>();
        users.forEach(u => {
          const sup = finalSupervisorMap.get(u.id);
          if (sup) {
            if (!childrenByParent.has(sup)) childrenByParent.set(sup, []);
            childrenByParent.get(sup)!.push(u.id);
          }
        });

        const queue: Array<{ id: string; depth: number }> = roots.map(id => ({ id, depth: 0 }));
        const visited = new Set<string>();
        while (queue.length) {
          const { id, depth } = queue.shift()!;
          if (visited.has(id)) continue;
          visited.add(id);
          depths.set(id, depth);
          const children = childrenByParent.get(id) || [];
          children.forEach(childId => queue.push({ id: childId, depth: depth + 1 }));
        }
        return depths;
      };

      const depths = computeDepths();

      // Sort changes so that higher-level nodes are processed first (shallower depth first)
      changesToProcess.sort((a, b) => {
        const da = depths.get(a.userId) ?? Number.MAX_SAFE_INTEGER;
        const db = depths.get(b.userId) ?? Number.MAX_SAFE_INTEGER;
        // If one is becoming root (newSupervisorId null), process earlier
        if (a.newSupervisorId === null && b.newSupervisorId !== null) return -1;
        if (a.newSupervisorId !== null && b.newSupervisorId === null) return 1;
        return da - db;
      });

      // Process each pending change
      for (const pendingChange of changesToProcess) {
        try {
          const result = await updateUserAction(
            pendingChange.userId, 
            { supervisor_id: pendingChange.newSupervisorId || undefined }
          );
          
          if (result.success && result.data) {
            // Add to successful changes
            successfulChanges.push(pendingChange);
            
            // Update the user data
            if (onUserUpdate) {
              onUserUpdate(result.data);
            }
          } else {
            hasErrors = true;
            const user = users.find(u => u.id === pendingChange.userId);
            toast.error("保存エラー", {
              description: `${user?.name || '不明なユーザー'}の変更保存に失敗しました`,
            });
            
            // Revert this change on error
            setPendingChanges(prev => [...prev, pendingChange]);
          }
        } catch (error) {
          hasErrors = true;
          const user = users.find(u => u.id === pendingChange.userId);
          console.error('Error saving change for user:', pendingChange.userId, error);
          toast.error("保存エラー", {
            description: `${user?.name || '不明なユーザー'}の変更保存中にエラーが発生しました`,
          });
          
          // Revert this change on error
          setPendingChanges(prev => [...prev, pendingChange]);
        }
      }
      
      // Show success/warning messages
      if (successfulChanges.length > 0) {
        // Force final layout recalculation after all updates
        setLayoutKey(prev => prev + 1);
        
        if (!hasErrors) {
          toast.success("変更保存完了", {
            description: `${successfulChanges.length}件の階層変更が正常に保存されました`,
          });
        } else {
          toast.warning("一部保存完了", {
            description: `${successfulChanges.length}件中一部の変更が保存されました`,
          });
        }
      } else if (hasErrors) {
        // All changes failed, show error and force layout update
        setLayoutKey(prev => prev + 1);
      }
    } catch (error) {
      console.error('Error saving changes:', error);
      toast.error("保存エラー", {
        description: "変更の保存中に予期しないエラーが発生しました",
      });
      
      // Revert all changes on unexpected error
      setPendingChanges(changesToProcess);
      setLayoutKey(prev => prev + 1);
    } finally {
      setIsSaving(false);
    }
  }, [pendingChanges, users, onUserUpdate]);
  
  // Handle node drag start
  const onNodeDragStart: NodeDragHandler = useCallback(() => {
    setIsDragging(true);
  }, []);
  
  // Handle node drag stop
  const onNodeDragStop: NodeDragHandler = useCallback(async (event, node) => {
    setIsDragging(false);
    
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
  }, [handleSupervisorChange, nodes, edges, setNodes, setEdges]);
  
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
            <>
              <p>👆 階層変更: ユーザーをドラッグして上司の下にドロップ</p>
              <p>🎯 ドロップゾーン: 上司の上または下の近くにドロップ</p>
              <p>🔴 赤線: 保存待ちの変更 (アニメーション付き)</p>
              <p>💾 保存: 左上の「保存」ボタンで確定</p>
            </>
          </div>
        </div>
      </div>
      
      {/* React Flow Container */}
      <div className="w-full h-[900px] sm:h-[700px] md:h-[800px] lg:h-[900px] border-2 border-gray-200 rounded-xl overflow-hidden bg-gradient-to-br from-gray-50 to-white shadow-lg relative">
        {/* Save and Undo Buttons - appear in top-left when there are pending changes */}
        {pendingChanges.length > 0 && (
          <div className="absolute top-4 left-4 z-50 flex gap-2">
            <Button
              onClick={handleSaveChanges}
              disabled={isSaving}
              variant="default"
              size="sm"
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white shadow-lg transition-all duration-200"
            >
              {isSaving ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              保存 ({pendingChanges.length}件)
            </Button>
            <Button
              onClick={handleUndo}
              disabled={isSaving}
              variant="secondary"
              size="sm"
              className="flex items-center gap-2 bg-white/90 backdrop-blur-sm shadow-lg border border-gray-200 hover:bg-white/95 transition-all duration-200"
            >
              <Undo2 className="w-4 h-4" />
              元に戻す ({pendingChanges.length}件)
            </Button>
          </div>
        )}
        
        {/* Loading indicator - appears in top-right when saving */}
        {isSaving && (
          <div className="absolute top-4 right-4 z-50">
            <div className="flex items-center gap-2 text-sm text-blue-600 bg-white/90 backdrop-blur-sm shadow-lg border border-gray-200 rounded-md px-3 py-2">
              <RefreshCw className="w-4 h-4 animate-spin" />
              保存中...
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