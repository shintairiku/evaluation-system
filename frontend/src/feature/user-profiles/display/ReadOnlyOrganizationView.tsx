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
import type { UserDetailResponse, Department } from '@/api/types';
import { Building2 } from 'lucide-react';
import { getProfileOptionsAction } from '@/api/server-actions/users';
import { OrgNode, UserNode } from '../components/OrganizationNodes';
import { useOrganizationLayout } from '../hooks/useOrganizationLayout';

interface ReadOnlyOrganizationViewProps {
  users: UserDetailResponse[];
}

// Node types for React Flow
const nodeTypes: NodeTypes = {
  orgNode: OrgNode,
  userNode: UserNode,
};

export default function ReadOnlyOrganizationView({ users }: ReadOnlyOrganizationViewProps) {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [expandedDepartments, setExpandedDepartments] = useState<Set<string>>(new Set());

  // Load departments on mount
  useEffect(() => {
    const loadDepartments = async () => {
      // First, immediately extract departments from users for instant display
      const userDepartments = users
        .filter(user => user.department)
        .map(user => user.department!)
        .filter((dept, index, self) => 
          index === self.findIndex(d => d.id === dept.id)
        );
      
      // Set departments immediately from users
      setDepartments(userDepartments);
      
      // Then try to load additional departments from API in background
      try {
        const result = await getProfileOptionsAction();
        if (result && result.success && result.data && result.data.departments) {
          // Merge API departments with user departments
          const apiDepartments = result.data.departments;
          const allDepartments = [...userDepartments];
          
          apiDepartments.forEach(apiDept => {
            if (!allDepartments.find(userDept => userDept.id === apiDept.id)) {
              allDepartments.push(apiDept);
            }
          });
          
          setDepartments(allDepartments);
        }
      } catch (error) {
        console.error('Error loading departments from API:', error);
        // Keep the user departments that were set immediately
      }
    };
    
    loadDepartments();
  }, [users]);

  // Handle department click to expand/collapse user cards
  const handleDepartmentClick = useCallback((departmentId: string) => {
    setExpandedDepartments(prev => {
      const newSet = new Set(prev);
      if (newSet.has(departmentId)) {
        newSet.delete(departmentId);
      } else {
        newSet.add(departmentId);
      }
      return newSet;
    });
  }, []);

  // Get layout from custom hook
  const { nodes, edges } = useOrganizationLayout({
    users,
    departments,
    expandedDepartments,
    onDepartmentClick: handleDepartmentClick
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
    totalUsers: users.length,
    adminsAndManagers: users.filter(u => 
      u.roles?.some(r => 
        r.name.toLowerCase().includes('admin') || 
        r.name.toLowerCase().includes('manager')
      )
    ).length,
    pendingApproval: users.filter(u => u.status === 'pending_approval').length
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