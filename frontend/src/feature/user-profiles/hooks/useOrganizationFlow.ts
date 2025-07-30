"use client";

import { useMemo, useCallback } from 'react';
import { Node, Edge } from 'reactflow';
import * as dagre from 'dagre';
import type { UserDetailResponse } from '@/api/types';

interface UseOrganizationFlowProps {
  users: UserDetailResponse[];
}

interface UseOrganizationFlowReturn {
  nodes: Node[];
  edges: Edge[];
  onNodesChange: (changes: any) => void;
  onEdgesChange: (changes: any) => void;
  onConnect: (params: any) => void;
}

export function useOrganizationFlow({ users }: UseOrganizationFlowProps): UseOrganizationFlowReturn {
  
  // Build hierarchy and create React Flow nodes/edges
  const { nodes, edges } = useMemo(() => {
    if (!users || users.length === 0) {
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

    // Create edges from supervisor relationships
    users.forEach(user => {
      if (user.supervisor) {
        // Only create edge if supervisor is in the current user list
        const supervisorInList = users.find(u => u.id === user.supervisor?.id);
        if (supervisorInList) {
          flowEdges.push({
            id: `${user.supervisor.id}-${user.id}`,
            source: user.supervisor.id,
            target: user.id,
            type: 'smoothstep',
            animated: false,
            style: { stroke: '#64748b', strokeWidth: 2 },
          });
        }
      }
    });

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

    return { nodes: flowNodes, edges: flowEdges };
  }, [users]);

  // Handle node changes (drag, etc.)
  const onNodesChange = useCallback((changes: any) => {
    // For now, just log changes - in future could save positions
    console.log('Nodes changed:', changes);
  }, []);

  // Handle edge changes
  const onEdgesChange = useCallback((changes: any) => {
    // For now, just log changes
    console.log('Edges changed:', changes);
  }, []);

  // Handle new connections (not used in organization view, but required by React Flow)
  const onConnect = useCallback((params: any) => {
    // For now, just log connections - in future could create new supervisor relationships
    console.log('New connection:', params);
  }, []);

  return {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
  };
} 