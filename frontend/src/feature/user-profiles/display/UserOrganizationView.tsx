"use client";

import { useMemo } from 'react';
import type { UserDetailResponse } from '@/api/types';
import { AlertCircle, Users } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { useProfileOptions } from '@/context/ProfileOptionsContext';
import { useOrganizationFlow } from '../hooks/useOrganizationFlow';
import OrganizationNode from './components/OrganizationNode';
import ReactFlow, { 
  Background, 
  Controls, 
  MiniMap,
  ReactFlowProvider,
  Panel
} from 'reactflow';
import 'reactflow/dist/style.css';

interface UserOrganizationViewProps {
  users: UserDetailResponse[];
  onUserUpdate?: (user: UserDetailResponse) => void;
}

export default function UserOrganizationView({ users }: UserOrganizationViewProps) {
  const { options, isLoading: isLoadingOptions, error: optionsError } = useProfileOptions();

  // Use React Flow hook for hierarchy management
  const { nodes, edges, onNodesChange, onEdgesChange, onConnect } = useOrganizationFlow({ users });

  // Build hierarchy for empty state check
  const hierarchy = useMemo(() => {
    return buildHierarchyFromUsers(users, options);
  }, [users, options]);

  // Loading state while profile options are being fetched
  if (isLoadingOptions) {
    return <OrganizationViewSkeleton />;
  }

  // Error state for profile options
  if (optionsError) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          エラー: {optionsError}
        </AlertDescription>
      </Alert>
    );
  }

  // Node types for React Flow
  const nodeTypes = {
    organizationNode: OrganizationNode,
  };

  return (
    <div className="h-[600px] w-full border rounded-lg">
      <ReactFlowProvider>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          attributionPosition="bottom-left"
          proOptions={{ hideAttribution: true }}
          minZoom={0.1}
          maxZoom={2}
          defaultViewport={{ x: 0, y: 0, zoom: 1 }}
        >
          {/* Background grid */}
          <Background 
            color="#64748b" 
            gap={20} 
            size={1}
            variant="dots"
          />
          
          {/* Controls for zoom/pan */}
          <Controls 
            showZoom={true}
            showFitView={true}
            showInteractive={true}
            position="bottom-right"
          />
          
          {/* Mini map for navigation */}
          <MiniMap 
            nodeColor="#64748b"
            nodeStrokeColor="#1e293b"
            nodeStrokeWidth={2}
            maskColor="rgba(0, 0, 0, 0.1)"
            position="top-right"
            size={150}
          />
          
          {/* Info panel */}
          <Panel position="top-left" className="bg-background/80 backdrop-blur-sm border rounded-lg p-2">
            <div className="text-xs text-muted-foreground">
              <div>組織図 ({users.length}件のユーザー)</div>
              <div className="flex items-center gap-2">
                <span>部署: {options.departments.length}件</span>
                <span>•</span>
                <span>ステージ: {options.stages.length}件</span>
              </div>
            </div>
          </Panel>

          {/* Empty state overlay */}
          {hierarchy.length === 0 && (
            <Panel position="center" className="bg-background/90 backdrop-blur-sm border rounded-lg p-6">
              <div className="text-center">
                <Users className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold text-muted-foreground">組織図データがありません</h3>
                <p className="text-sm text-muted-foreground mt-2">
                  ユーザー間の上司-部下関係が設定されていません。
                </p>
              </div>
            </Panel>
          )}
        </ReactFlow>
      </ReactFlowProvider>
    </div>
  );
}

// Loading skeleton for organization view
function OrganizationViewSkeleton() {
  return (
    <div className="h-[600px] w-full border rounded-lg p-4">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-24" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-3 border rounded-lg">
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
              <div className="flex gap-1">
                <Skeleton className="h-5 w-16" />
                <Skeleton className="h-5 w-20" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Function to build hierarchy from users data with enhanced options
function buildHierarchyFromUsers(
  users: UserDetailResponse[], 
  options: {
    departments: any[];
    stages: any[];
    roles: any[];
  }
): UserDetailResponse[] {
  // Find root users (users without supervisors or whose supervisors are not in the list)
  const rootUsers = users.filter(user => {
    if (!user.supervisor) return true;
    return !users.find(u => u.id === user.supervisor?.id);
  });

  return rootUsers;
}
