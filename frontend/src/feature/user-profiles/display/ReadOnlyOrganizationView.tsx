"use client";

import React, { useState, useEffect, useCallback } from 'react';
import ReactFlow, {
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  NodeTypes,
} from 'reactflow';
import 'reactflow/dist/style.css';
import type { UserDetailResponse, SimpleUser, Department } from '@/api/types';
import { Building2 } from 'lucide-react';
import { getProfileOptionsAction, getUsersForOrgChartAction } from '@/api/server-actions/users';
import { getTopUsersByRole } from '../utils/hierarchyLayoutUtils';
import { OrgNode, UserNode } from '../components/OrganizationNodes';
import { useOrganizationLayout } from '../hooks/useOrganizationLayout';

interface ReadOnlyOrganizationViewProps {
  users?: UserDetailResponse[] | SimpleUser[]; // Make optional for backward compatibility
}

// Node types for React Flow
const nodeTypes: NodeTypes = {
  orgNode: OrgNode,
  userNode: UserNode,
};

export default function ReadOnlyOrganizationView({ users = [] }: ReadOnlyOrganizationViewProps) {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [expandedDepartments, setExpandedDepartments] = useState<Set<string>>(new Set());
  const [loadedUsers, setLoadedUsers] = useState<Map<string, SimpleUser[]>>(new Map()); // Cache loaded users by key
  const [departmentUserCounts, setDepartmentUserCounts] = useState<Map<string, number>>(new Map()); // Total users per department
  const [loadingNodes, setLoadingNodes] = useState<Set<string>>(new Set()); // Track loading states
  const [allUsers, setAllUsers] = useState<(UserDetailResponse | SimpleUser)[]>(users); // Current users to display

  // Load initial data on mount
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        // Load departments first
        const result = await getProfileOptionsAction();
        if (result && result.success && result.data && result.data.departments) {
          setDepartments(result.data.departments);
        }

        // If no users provided, load top-level users (users without supervisor)
        if (users.length === 0) {
          setLoadingNodes(prev => new Set(prev).add('initial'));
          const topLevelResult = await getUsersForOrgChartAction({
            supervisor_id: undefined // Load users without supervisor
          });
          
          if (topLevelResult.success && topLevelResult.data) {
            setAllUsers(topLevelResult.data);
            setLoadedUsers(prev => new Map(prev).set('top-level', topLevelResult.data!));
          }
          setLoadingNodes(prev => {
            const newSet = new Set(prev);
            newSet.delete('initial');
            return newSet;
          });
        } else {
          // Use provided users (backward compatibility)
          setAllUsers(users);
        }
      } catch (error) {
        console.error('Error loading initial organization data:', error);
        setLoadingNodes(prev => {
          const newSet = new Set(prev);
          newSet.delete('initial');
          return newSet;
        });
      }
    };
    
    loadInitialData();
  }, [users]);

  // Handle department click to dynamically load and expand department users
  const handleDepartmentClick = useCallback(async (departmentId: string) => {
    const isCurrentlyExpanded = expandedDepartments.has(departmentId);
    
    if (isCurrentlyExpanded) {
      // Collapse - just remove from expanded set
      setExpandedDepartments(prev => {
        const newSet = new Set(prev);
        newSet.delete(departmentId);
        return newSet;
      });
    } else {
      // Expand - check if we need to load users for this department
      const cacheKey = `dept-${departmentId}`;
      const cached = loadedUsers.get(cacheKey);
      
      if (cached) {
        // Use cached data
        setExpandedDepartments(prev => new Set(prev).add(departmentId));
      } else {
        // Load users for this department
        setLoadingNodes(prev => new Set(prev).add(departmentId));
        
        try {
          const result = await getUsersForOrgChartAction({
            department_ids: [departmentId]
          });
          
          if (result.success && result.data) {
            // Filter to show only top users by role hierarchy
            const topUsers = getTopUsersByRole(result.data) as SimpleUser[];
            // Save total user count for the department
            setDepartmentUserCounts(prev => new Map(prev).set(departmentId, result.data.length));
            
            // Cache the filtered top users
            setLoadedUsers(prev => new Map(prev).set(cacheKey, topUsers));
            setExpandedDepartments(prev => new Set(prev).add(departmentId));
          }
        } catch (error) {
          console.error('Error loading department users:', error);
        } finally {
          setLoadingNodes(prev => {
            const newSet = new Set(prev);
            newSet.delete(departmentId);
            return newSet;
          });
        }
      }
    }
  }, [expandedDepartments, loadedUsers]);

  // Add user click handler for loading subordinates  
  const handleUserClick = useCallback(async (userId: string) => {
    const cacheKey = `user-${userId}`;
    const cached = loadedUsers.get(cacheKey);
    
    if (cached) {
      // Already loaded subordinates - could implement expand/collapse UI here
      return;
    }
    
    setLoadingNodes(prev => new Set(prev).add(userId));
    
    try {
      const result = await getUsersForOrgChartAction({
        supervisor_id: userId
      });
      
      if (result.success && result.data && result.data.length > 0) {
        // Cache the loaded subordinates
        setLoadedUsers(prev => new Map(prev).set(cacheKey, result.data!));
        
        // Add subordinates to current users list
        setAllUsers(prev => {
          const existingIds = new Set(prev.map(u => u.id));
          const newUsers = result.data!.filter(u => !existingIds.has(u.id));
          return [...prev, ...newUsers];
        });
      }
    } catch (error) {
      console.error('Error loading subordinates:', error);
    } finally {
      setLoadingNodes(prev => {
        const newSet = new Set(prev);
        newSet.delete(userId);
        return newSet;
      });
    }
  }, [loadedUsers]);

  // Get layout from custom hook
  const { nodes, edges } = useOrganizationLayout({
    users: allUsers,
    departments,
    expandedDepartments,
    loadingNodes,
    loadedUsers,
    departmentUserCounts,
    onDepartmentClick: handleDepartmentClick,
    onUserClick: handleUserClick
  });

  const [nodesState, setNodes] = useNodesState(nodes);
  const [edgesState, setEdges] = useEdgesState(edges);

  // Update nodes and edges when organization changes
  useEffect(() => {
    setNodes(nodes);
    setEdges(edges);
  }, [nodes, edges, setNodes, setEdges]);

  // Calculate statistics for header
  const stats = {
    departments: departments.length,
    totalUsers: allUsers.length,
    adminsAndManagers: allUsers.filter(u => 
      u.roles?.some(r => 
        r.name.toLowerCase().includes('admin') || 
        r.name.toLowerCase().includes('manager')
      )
    ).length,
    pendingApproval: allUsers.filter(u => u.status === 'pending_approval').length
  };

  return (
    <div className="space-y-6">
      {/* Enhanced Header */}
      <div className="bg-gradient-to-r from-slate-800 via-slate-900 to-slate-950 rounded-xl p-6 border border-slate-700 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                <Building2 className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-white">組織図</h3>
                <p className="text-blue-100 text-sm">Organization Chart</p>
              </div>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white/10 rounded-lg p-3">
                <div className="text-white font-bold text-lg">{stats.departments}</div>
                <div className="text-blue-100 text-xs">部署</div>
              </div>
              <div className="bg-white/10 rounded-lg p-3">
                <div className="text-white font-bold text-lg">{stats.totalUsers}</div>
                <div className="text-blue-100 text-xs">ユーザー</div>
              </div>
              <div className="bg-white/10 rounded-lg p-3">
                <div className="text-white font-bold text-lg">{stats.adminsAndManagers}</div>
                <div className="text-blue-100 text-xs">管理者・マネージャー</div>
              </div>
              <div className="bg-white/10 rounded-lg p-3">
                <div className="text-white font-bold text-lg">{stats.pendingApproval}</div>
                <div className="text-blue-100 text-xs">承認待ち</div>
              </div>
            </div>
          </div>
          
          <div className="hidden md:block">
            <div className="bg-white/10 rounded-lg p-4 text-center">
              <div className="text-white font-bold text-sm mb-2">操作ガイド</div>
              <div className="text-blue-100 text-xs space-y-1">
                <div>🏢 部署をクリック</div>
                <div>👥 メンバー表示・非表示</div>
                <div>🔍 ズーム・パン操作</div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Organization Chart */}
      <div className="w-full h-[800px] border-2 border-gray-200 rounded-xl overflow-hidden bg-gradient-to-br from-gray-50 to-white shadow-xl">
        <ReactFlow
          nodes={nodesState}
          edges={edgesState}
          nodeTypes={nodeTypes}
          fitView={false}
          minZoom={0.1}
          maxZoom={1.2}
          defaultViewport={{ x: 150, y: 50, zoom: 0.85 }}
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
            gap={40}
            size={1}
            className="opacity-30"
          />
          <Controls 
            position="top-right"
            className="bg-white/90 backdrop-blur-sm border border-gray-200 rounded-lg shadow-lg z-10"
            showZoom={true}
            showFitView={true}
            showInteractive={false}
          />
        </ReactFlow>
      </div>
    </div>
  );
}