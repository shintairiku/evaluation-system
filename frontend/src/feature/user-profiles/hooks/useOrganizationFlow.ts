"use client";

import { useMemo, useCallback } from 'react';
import { Node, Edge } from 'reactflow';
import * as dagre from 'dagre';
import type { UserDetailResponse } from '@/api/types';

interface UseOrganizationFlowProps {
  users: UserDetailResponse[];
  hierarchyData?: Record<string, string>;
}

interface UseOrganizationFlowReturn {
  nodes: Node[];
  edges: Edge[];
  onNodesChange: (changes: any) => void;
  onEdgesChange: (changes: any) => void;
  onConnect: (params: any) => void;
}

export function useOrganizationFlow({ users, hierarchyData }: UseOrganizationFlowProps): UseOrganizationFlowReturn {
  
  // Build hierarchy and create React Flow nodes/edges
  const { nodes, edges } = useMemo(() => {
    console.log('🔍 useOrganizationFlow - Users received:', users?.length || 0);
    console.log('🔍 useOrganizationFlow - Hierarchy data:', hierarchyData);
    
    if (!users || users.length === 0) {
      console.log('⚠️ No users provided to useOrganizationFlow');
      return { nodes: [], edges: [] };
    }

    const flowNodes: Node[] = [];
    const flowEdges: Edge[] = [];

    // Create nodes from users
    users.forEach((user) => {
      flowNodes.push({
        id: user.id,
        type: 'organizationNode',
        position: { x: 0, y: 0 }, // Will be calculated by dagre
        data: { user },
        draggable: true, // Enable drag functionality
      });
    });

    console.log(`📊 Created ${flowNodes.length} nodes`);

    // Create edges from hierarchy data
    if (hierarchyData) {
      Object.entries(hierarchyData).forEach(([userId, supervisorId]) => {
        console.log(`🔗 Creating edge from hierarchy data: ${supervisorId} -> ${userId}`);
        
        // Only create edge if both users are in the current user list
        const supervisorInList = users.find(u => u.id === supervisorId);
        const userInList = users.find(u => u.id === userId);
        
        if (supervisorInList && userInList) {
          flowEdges.push({
            id: `${supervisorId}-${userId}`,
            source: supervisorId,
            target: userId,
            type: 'smoothstep',
            animated: false,
            style: { stroke: '#64748b', strokeWidth: 2 },
          });
          console.log(`✅ Edge created: ${supervisorInList.name} -> ${userInList.name}`);
        } else {
          console.log(`⚠️ Users not found in list: supervisor=${supervisorId}, user=${userId}`);
        }
      });
    } else {
      console.log('⚠️ No hierarchy data provided');
    }

    console.log(`📊 Created ${flowNodes.length} nodes and ${flowEdges.length} edges`);

    // Apply dagre layout for automatic positioning
    const dagreGraph = new dagre.graphlib.Graph();
    dagreGraph.setDefaultEdgeLabel(() => ({}));
    dagreGraph.setGraph({ 
      rankdir: 'TB', 
      nodesep: 80, 
      ranksep: 120,
      align: 'DL',
      acyclicer: 'greedy',
    });

    // Set node dimensions
    flowNodes.forEach(node => {
      dagreGraph.setNode(node.id, { width: 256, height: 140 });
    });

    // Add edges to dagre graph
    flowEdges.forEach(edge => {
      dagreGraph.setEdge(edge.source, edge.target);
    });

    // Calculate layout
    dagre.layout(dagreGraph);

    // Update node positions
    flowNodes.forEach(node => {
      const nodeWithPosition = dagreGraph.node(node.id);
      node.position = {
        x: nodeWithPosition.x - nodeWithPosition.width / 2,
        y: nodeWithPosition.y - nodeWithPosition.height / 2,
      };
    });

    console.log('🎯 Final nodes and edges:', { nodes: flowNodes.length, edges: flowEdges.length });
    return { nodes: flowNodes, edges: flowEdges };
  }, [users, hierarchyData]);

  // Handle node changes (drag, etc.)
  const onNodesChange = useCallback((changes: any) => {
    // For now, just handle changes silently - in future could save positions
    // console.log('Nodes changed:', changes);
  }, []);

  // Handle edge changes
  const onEdgesChange = useCallback((changes: any) => {
    // For now, just handle changes silently
    // console.log('Edges changed:', changes);
  }, []);

  // Handle new connections (not used in organization view, but required by React Flow)
  const onConnect = useCallback((params: any) => {
    // For now, just handle connections silently - in future could create new supervisor relationships
    // console.log('New connection:', params);
  }, []);

  return {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
  };
} 