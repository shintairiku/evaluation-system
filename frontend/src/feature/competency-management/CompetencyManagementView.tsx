'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Search, Edit, Eye } from 'lucide-react';

import type { Competency, Stage, PaginatedResponse } from '@/api/types';
import { useCompetencyManagement } from './hooks/useCompetencyManagement';
import { COMPETENCY_CONSTANTS, COMPETENCY_MESSAGES } from './constants';
import CompetencyModal from './components/CompetencyModal';

interface CompetencyManagementViewProps {
  /** Initial competencies data from server */
  initialCompetencies: PaginatedResponse<Competency>;
  /** Available stages */
  stages: Stage[];
  /** Whether current user has admin permissions */
  isAdmin: boolean;
}

/**
 * Main view component for competency management
 * Displays competencies in a grid layout organized by stage
 */
export default function CompetencyManagementView({
  initialCompetencies,
  stages,
  isAdmin,
}: CompetencyManagementViewProps) {
  const {
    competenciesByStage,
    searchTerm,
    selectedStageFilter,
    selectedCompetency,
    isModalOpen,
    isLoading,
    handleCompetencyClick,
    handleModalClose,
    handleSaveCompetency,
    handleDeleteCompetency,
    handleSearchChange,
    handleStageFilterChange,
    totalCompetencies,
    filteredCount,
  } = useCompetencyManagement({
    initialCompetencies,
    stages,
    isAdmin,
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">コンピテンシー管理</h1>
          <p className="text-muted-foreground">
            ステージ別のコンピテンシー項目を{isAdmin ? '管理' : '確認'}できます
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center">
        <div className={`relative flex-1 ${COMPETENCY_CONSTANTS.SEARCH.MAX_WIDTH}`}>
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={COMPETENCY_CONSTANTS.SEARCH.PLACEHOLDER}
            value={searchTerm}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-8"
          />
        </div>

        <Select value={selectedStageFilter} onValueChange={handleStageFilterChange}>
          <SelectTrigger className={COMPETENCY_CONSTANTS.STAGE_FILTER.WIDTH}>
            <SelectValue placeholder="ステージでフィルタ" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={COMPETENCY_CONSTANTS.STAGE_FILTER.ALL_VALUE}>
              {COMPETENCY_CONSTANTS.STAGE_FILTER.ALL_LABEL}
            </SelectItem>
            {stages.map((stage) => (
              <SelectItem key={stage.id} value={stage.id}>
                {stage.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Summary */}
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <span>
          {COMPETENCY_MESSAGES.STATUS.FILTERED_COUNT(filteredCount, totalCompetencies)}
        </span>
        {selectedStageFilter !== COMPETENCY_CONSTANTS.STAGE_FILTER.ALL_VALUE && (
          <Badge variant="secondary">
            {stages.find(s => s.id === selectedStageFilter)?.name}でフィルタ中
          </Badge>
        )}
      </div>

      {/* Competencies Grid by Stage */}
      <div className="space-y-8">
        {stages.map((stage) => {
          const stageData = competenciesByStage[stage.id];
          const stageCompetencies = stageData?.competencies || [];

          // Skip stages with no competencies when filtering
          if (selectedStageFilter !== COMPETENCY_CONSTANTS.STAGE_FILTER.ALL_VALUE && selectedStageFilter !== stage.id) {
            return null;
          }

          return (
            <div key={stage.id} className="space-y-4">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-semibold">{stage.name}</h2>
                <Badge variant="outline">
                  {stageCompetencies.length} 項目
                </Badge>
              </div>

              {stage.description && (
                <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-md">
                  {stage.description}
                </p>
              )}

              {stageCompetencies.length === 0 ? (
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center text-muted-foreground">
                      {selectedStageFilter === COMPETENCY_CONSTANTS.STAGE_FILTER.ALL_VALUE && !searchTerm
                        ? COMPETENCY_MESSAGES.STATUS.NO_COMPETENCIES
                        : COMPETENCY_MESSAGES.STATUS.NO_FILTERED_RESULTS
                      }
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className={`grid ${COMPETENCY_CONSTANTS.GRID.GAP} ${COMPETENCY_CONSTANTS.GRID.COLUMNS.BASE} ${COMPETENCY_CONSTANTS.GRID.COLUMNS.MD} ${COMPETENCY_CONSTANTS.GRID.COLUMNS.LG}`}>
                  {stageCompetencies.map((competency) => (
                    <Card
                      key={competency.id}
                      className="cursor-pointer transition-colors hover:bg-muted/50"
                      onClick={() => handleCompetencyClick(competency)}
                    >
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <CardTitle className="text-base">{competency.name}</CardTitle>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCompetencyClick(competency);
                            }}
                          >
                            {isAdmin ? (
                              <Edit className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </CardHeader>

                      {competency.description && Object.keys(competency.description).length > 0 && (
                        <CardContent className="pt-0">
                          <CardDescription className="text-xs">
                            {COMPETENCY_MESSAGES.STATUS.BEHAVIORS_COUNT(Object.keys(competency.description).length)}
                          </CardDescription>
                        </CardContent>
                      )}
                    </Card>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Modal */}
      <CompetencyModal
        competency={selectedCompetency}
        stages={stages}
        isOpen={isModalOpen}
        isAdmin={isAdmin}
        onClose={handleModalClose}
        onSave={handleSaveCompetency}
        onDelete={handleDeleteCompetency}
        isLoading={isLoading}
      />
    </div>
  );
}