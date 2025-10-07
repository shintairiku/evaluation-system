'use client';

import { useState, useMemo, useCallback } from 'react';
import { toast } from 'sonner';
import type { Competency, Stage, UUID, PaginatedResponse } from '@/api/types';
import { updateCompetencyAction, deleteCompetencyAction } from '@/api/server-actions/competencies';
import { COMPETENCY_MESSAGES } from '../constants';

interface UseCompetencyManagementProps {
  initialCompetencies: PaginatedResponse<Competency>;
  stages: Stage[];
  isAdmin: boolean;
}

export function useCompetencyManagement({
  initialCompetencies,
  stages,
  isAdmin,
}: UseCompetencyManagementProps) {
  // State management
  const [competencies, setCompetencies] = useState(initialCompetencies.items || []);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStageFilter, setSelectedStageFilter] = useState<string>('all');
  const [selectedCompetency, setSelectedCompetency] = useState<Competency | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Filtered competencies with memoization
  const filteredCompetencies = useMemo(() => {
    let filtered = competencies;

    // Filter by search term
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      filtered = filtered.filter(competency =>
        competency.name.toLowerCase().includes(term) ||
        (competency.description && Object.values(competency.description).some(desc =>
          desc.toLowerCase().includes(term)
        ))
      );
    }

    // Filter by stage
    if (selectedStageFilter !== 'all') {
      filtered = filtered.filter(competency => competency.stageId === selectedStageFilter);
    }

    return filtered;
  }, [competencies, searchTerm, selectedStageFilter]);

  // Group competencies by stage with memoization
  const competenciesByStage = useMemo(() => {
    const grouped: Record<string, { stage: Stage; competencies: Competency[] }> = {};

    stages.forEach(stage => {
      grouped[stage.id] = {
        stage,
        competencies: filteredCompetencies.filter(comp => comp.stageId === stage.id),
      };
    });

    return grouped;
  }, [filteredCompetencies, stages]);

  // Modal handlers
  const handleCompetencyClick = useCallback((competency: Competency) => {
    setSelectedCompetency(competency);
    setIsModalOpen(true);
  }, []);

  const handleModalClose = useCallback(() => {
    setSelectedCompetency(null);
    setIsModalOpen(false);
  }, []);

  // CRUD operations
  const handleSaveCompetency = useCallback(async (
    competencyId: UUID,
    data: { name: string; description?: Record<string, string>; stageId: UUID }
  ): Promise<void> => {
    if (!isAdmin) return;

    setIsLoading(true);
    try {
      const result = await updateCompetencyAction(competencyId, data);

      if (result.success && result.data) {
        // Optimistic update
        setCompetencies(prev =>
          prev.map(comp => comp.id === competencyId ? result.data! : comp)
        );

        toast.success(COMPETENCY_MESSAGES.SUCCESS.UPDATE);
      } else {
        throw new Error(result.error || result.errorMessage || 'Failed to update competency');
      }
    } catch (error) {
      console.error('Failed to update competency:', error);
      toast.error(COMPETENCY_MESSAGES.ERROR.UPDATE);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [isAdmin]);

  const handleDeleteCompetency = useCallback(async (competencyId: UUID): Promise<void> => {
    if (!isAdmin) return;

    setIsLoading(true);
    try {
      const result = await deleteCompetencyAction(competencyId);

      if (result.success) {
        // Optimistic update
        setCompetencies(prev => prev.filter(comp => comp.id !== competencyId));

        toast.success(COMPETENCY_MESSAGES.SUCCESS.DELETE);
      } else {
        throw new Error(result.error || 'Failed to delete competency');
      }
    } catch (error) {
      console.error('Failed to delete competency:', error);
      toast.error(COMPETENCY_MESSAGES.ERROR.DELETE);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [isAdmin]);

  // Search and filter handlers
  const handleSearchChange = useCallback((value: string) => {
    setSearchTerm(value);
  }, []);

  const handleStageFilterChange = useCallback((value: string) => {
    setSelectedStageFilter(value);
  }, []);

  return {
    // State
    competencies: filteredCompetencies,
    competenciesByStage,
    searchTerm,
    selectedStageFilter,
    selectedCompetency,
    isModalOpen,
    isLoading,

    // Handlers
    handleCompetencyClick,
    handleModalClose,
    handleSaveCompetency,
    handleDeleteCompetency,
    handleSearchChange,
    handleStageFilterChange,

    // Computed values
    totalCompetencies: competencies.length,
    filteredCount: filteredCompetencies.length,
  };
}