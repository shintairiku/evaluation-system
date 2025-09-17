'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Search, Edit, Eye } from 'lucide-react';
import { toast } from 'sonner';

import type { Competency, Stage, UUID, PaginatedResponse } from '@/api/types';
import { updateCompetencyAction, deleteCompetencyAction } from '@/api/server-actions/competency-management';
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
  const [competencies, setCompetencies] = useState(initialCompetencies.data || []);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStageFilter, setSelectedStageFilter] = useState<string>('all');
  const [selectedCompetency, setSelectedCompetency] = useState<Competency | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Filter competencies by search term and stage
  const filteredCompetencies = useMemo(() => {
    let filtered = competencies;

    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
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

  // Group competencies by stage
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

  const handleCompetencyClick = (competency: Competency) => {
    setSelectedCompetency(competency);
    setIsModalOpen(true);
  };

  const handleSaveCompetency = async (
    competencyId: UUID,
    data: { name: string; description?: Record<string, string>; stageId: UUID }
  ) => {
    setIsLoading(true);
    try {
      const result = await updateCompetencyAction(competencyId, data);

      if (result.success && result.data) {
        // Update the competency in the local state
        setCompetencies(prev =>
          prev.map(comp => comp.id === competencyId ? result.data! : comp)
        );

        toast.success('コンピテンシーが正常に更新されました。');
      } else {
        throw new Error(result.error || 'Failed to update competency');
      }
    } catch (error) {
      console.error('Failed to update competency:', error);
      toast.error('コンピテンシーの更新に失敗しました。');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteCompetency = async (competencyId: UUID) => {
    setIsLoading(true);
    try {
      const result = await deleteCompetencyAction(competencyId);

      if (result.success) {
        // Remove the competency from local state
        setCompetencies(prev => prev.filter(comp => comp.id !== competencyId));

        toast.success('コンピテンシーが正常に削除されました。');
      } else {
        throw new Error(result.error || 'Failed to delete competency');
      }
    } catch (error) {
      console.error('Failed to delete competency:', error);
      toast.error('コンピテンシーの削除に失敗しました。');
    } finally {
      setIsLoading(false);
    }
  };

  const handleModalClose = () => {
    setSelectedCompetency(null);
    setIsModalOpen(false);
  };

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
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="コンピテンシーを検索..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8"
          />
        </div>

        <Select value={selectedStageFilter} onValueChange={setSelectedStageFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="ステージでフィルタ" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">すべてのステージ</SelectItem>
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
          {filteredCompetencies.length} / {competencies.length} のコンピテンシーを表示
        </span>
        {selectedStageFilter !== 'all' && (
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
          if (selectedStageFilter !== 'all' && selectedStageFilter !== stage.id) {
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
                      {selectedStageFilter === 'all' && !searchTerm
                        ? 'このステージにはコンピテンシーが設定されていません。'
                        : 'フィルタ条件に該当するコンピテンシーはありません。'
                      }
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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
                            {Object.keys(competency.description).length} つの行動例が設定されています
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