"use client";

import { useMemo, useTransition, useEffect } from 'react';
import { useActionState } from 'react';
import type { UserDetailResponse } from '@/api/types';
import { AlertCircle, Users } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { useProfileOptions } from '@/context/ProfileOptionsContext';
import { useOrganizationFlow } from '../hooks/useOrganizationFlow';
import { getUsersHierarchyAction } from '@/api/server-actions/users';
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
  const [isPending, startTransition] = useTransition();

  // Use useActionState for organization data fetching
  const [organizationState, organizationAction, isPendingAction] = useActionState(
    async (_prevState: unknown, _formData: FormData) => {
      return await getUsersHierarchyAction({ page: 1, limit: 50 });
    },
    null
  );

  // Fetch organization data on component mount
  useEffect(() => {
    if (!organizationState) {
      startTransition(() => {
        const formData = new FormData();
        organizationAction(formData);
      });
    }
  }, [organizationState, organizationAction, startTransition]);

  // Use organization data if available, otherwise fall back to props
  const organizationUsers = organizationState?.success && organizationState.data 
    ? organizationState.data.items 
    : users;

  // Use React Flow hook for hierarchy management
  const { nodes, edges, onNodesChange, onEdgesChange, onConnect } = useOrganizationFlow({ 
    users: organizationUsers 
  });

  // Build hierarchy for empty state check
  const hierarchy = useMemo(() => {
    return buildHierarchyFromUsers(organizationUsers, options);
  }, [organizationUsers, options]);

  // Node types for React Flow - memoized to prevent recreation
  const nodeTypes = useMemo(() => ({
    organizationNode: OrganizationNode,
  }), []);

  // Loading state while profile options or organization data are being fetched
  if (isLoadingOptions || isPending || isPendingAction) {
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

  // Error state for organization data
  if (organizationState && !organizationState.success) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          エラー: {organizationState.error || '組織図データの取得に失敗しました'}
        </AlertDescription>
      </Alert>
    );
  }

  // Empty state
  if (!hierarchy || hierarchy.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[600px] border rounded-lg bg-gray-50">
        <Users className="h-12 w-12 text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">組織図がありません</h3>
        <p className="text-gray-500 text-center max-w-md">
          ユーザーデータまたは階層関係が設定されていないため、組織図を表示できません。
        </p>
      </div>
    );
  }

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
          <Panel position="top-left" className="bg-white/90 backdrop-blur-sm rounded-lg p-3 shadow-sm">
            <div className="text-sm text-gray-600">
              <div className="font-medium">組織図</div>
              <div>{organizationUsers.length} ユーザー</div>
            </div>
          </Panel>
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
