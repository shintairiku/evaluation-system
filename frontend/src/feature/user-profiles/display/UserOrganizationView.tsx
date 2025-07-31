"use client";

import { useMemo, useTransition, useEffect } from 'react';
import { useActionState } from 'react';
import type { UserDetailResponse } from '@/api/types';
import { AlertCircle, Users } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { useProfileOptions } from '@/context/ProfileOptionsContext';
import { useOrganizationFlow } from '../hooks/useOrganizationFlow';
import { getUsersAction, getHierarchyDataAction } from '@/api/server-actions/users';
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
  console.log('🎯 UserOrganizationView - Props users:', users?.length || 0);
  
  const { options, isLoading: isLoadingOptions, error: optionsError } = useProfileOptions();
  const [isPending, startTransition] = useTransition();

  // Use useActionState for organization data fetching
  const [organizationState, organizationAction, isPendingAction] = useActionState(
    async (_prevState: unknown, _formData: FormData) => {
      return await getUsersAction({ page: 1, limit: 50 });
    },
    null
  );

  // Use useActionState for hierarchy data fetching
  const [hierarchyState, hierarchyAction, isPendingHierarchy] = useActionState(
    async (_prevState: unknown, _formData: FormData) => {
      return await getHierarchyDataAction();
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

  // Fetch hierarchy data on component mount
  useEffect(() => {
    if (!hierarchyState) {
      startTransition(() => {
        const formData = new FormData();
        hierarchyAction(formData);
      });
    }
  }, [hierarchyState, hierarchyAction, startTransition]);

  // Use organization data if available, otherwise fall back to props
  const organizationUsers = organizationState?.success && organizationState.data 
    ? organizationState.data.items 
    : users;

  // Use hierarchy data if available
  const hierarchyData = hierarchyState?.success && hierarchyState.data 
    ? hierarchyState.data.hierarchy 
    : undefined;

  console.log('🎯 UserOrganizationView - organizationUsers:', organizationUsers?.length || 0);
  console.log('🎯 UserOrganizationView - hierarchyData:', hierarchyData);

  // Use React Flow hook for hierarchy management
  const { nodes, edges, onNodesChange, onEdgesChange, onConnect } = useOrganizationFlow({ 
    users: organizationUsers,
    hierarchyData: hierarchyData
  });

  console.log('🎯 UserOrganizationView - ReactFlow nodes/edges:', { nodes: nodes.length, edges: edges.length });

  // Build hierarchy for empty state check
  const hierarchy = useMemo(() => {
    return buildHierarchyFromUsers(organizationUsers, options);
  }, [organizationUsers, options]);

  // Node types for React Flow - memoized to prevent recreation
  const nodeTypes = useMemo(() => ({
    organizationNode: OrganizationNode,
  }), []);

  // Loading state while profile options or organization data are being fetched
  if (isLoadingOptions || isPending || isPendingAction || isPendingHierarchy) {
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

  // Error state for hierarchy data
  if (hierarchyState && !hierarchyState.success) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          エラー: {hierarchyState.error || '階層データの取得に失敗しました'}
        </AlertDescription>
      </Alert>
    );
  }

  // Debug: Show data without ReactFlow
  return (
    <div className="p-4">
      <h2 className="text-lg font-semibold mb-4">組織図 (Debug)</h2>
      <div className="mb-4">
        <p>Users: {organizationUsers?.length || 0}</p>
        <p>Hierarchy Data: {hierarchyData ? 'Available' : 'Not available'}</p>
        <p>Nodes: {nodes.length}</p>
        <p>Edges: {edges.length}</p>
      </div>
      
      {organizationUsers && organizationUsers.length > 0 && (
        <div className="mb-4">
          <h3 className="font-medium mb-2">Users:</h3>
          <ul className="list-disc pl-4">
            {organizationUsers.map(user => (
              <li key={user.id}>{user.name} ({user.email})</li>
            ))}
          </ul>
        </div>
      )}
      
      {hierarchyData && (
        <div className="mb-4">
          <h3 className="font-medium mb-2">Hierarchy:</h3>
          <pre className="bg-gray-100 p-2 rounded text-sm">
            {JSON.stringify(hierarchyData, null, 2)}
          </pre>
        </div>
      )}
      
      {/* ReactFlow Component */}
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
            <Background />
            
            {/* Controls */}
            <Controls />
            
            {/* Mini map */}
            <MiniMap />
            
            {/* Panel for additional controls */}
            <Panel position="top-right">
              <div className="bg-white p-2 rounded shadow">
                <p className="text-sm">Nodes: {nodes.length}</p>
                <p className="text-sm">Edges: {edges.length}</p>
              </div>
            </Panel>
          </ReactFlow>
        </ReactFlowProvider>
      </div>
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
