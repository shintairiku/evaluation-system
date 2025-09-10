'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight, Edit, Save, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Competency } from '@/api/types/competency';

export interface CompetencyAccordionProps {
  competencies: Competency[];
  
  // Selection mode (for goal input)
  selectedCompetencyIds?: string[];
  selectedIdealActions?: Record<string, string[]>;
  onCompetencySelect?: (competencyId: string, checked: boolean) => void;
  onIdealActionSelect?: (competencyId: string, actionKey: string, checked: boolean) => void;
  
  // Edit mode (for admin management)
  editMode?: boolean;
  onCompetencyUpdate?: (competencyId: string, updates: {
    name?: string;
    description?: Record<string, string>;
  }) => void;
  
  // Display options
  showSelection?: boolean;
  showEditButtons?: boolean;
  expandedByDefault?: string[];
  className?: string;
}

interface EditingState {
  competencyId: string | null;
  name: string;
  description: Record<string, string>;
}

export function CompetencyAccordion({
  competencies,
  selectedCompetencyIds = [],
  selectedIdealActions = {},
  onCompetencySelect,
  onIdealActionSelect,
  editMode = false,
  onCompetencyUpdate,
  showSelection = true,
  showEditButtons = false,
  expandedByDefault = [],
  className = "",
}: CompetencyAccordionProps) {
  const [expandedCompetencies, setExpandedCompetencies] = useState<string[]>(expandedByDefault);
  const [editing, setEditing] = useState<EditingState>({ competencyId: null, name: '', description: {} });

  // Helper functions
  const isCompetencySelected = (competencyId: string) => selectedCompetencyIds.includes(competencyId);
  const isCompetencyExpanded = (competencyId: string) => expandedCompetencies.includes(competencyId);
  const isIdealActionSelected = (competencyId: string, actionKey: string) =>
    selectedIdealActions[competencyId]?.includes(actionKey) || false;

  const handleExpandToggle = (competencyId: string) => {
    if (expandedCompetencies.includes(competencyId)) {
      setExpandedCompetencies(prev => prev.filter(id => id !== competencyId));
    } else {
      setExpandedCompetencies(prev => [...prev, competencyId]);
    }
  };

  const handleCompetencySelectChange = (competencyId: string, checked: boolean) => {
    onCompetencySelect?.(competencyId, checked);
    
    // Auto-expand when selected in selection mode
    if (checked && showSelection && !editMode) {
      if (!expandedCompetencies.includes(competencyId)) {
        setExpandedCompetencies(prev => [...prev, competencyId]);
      }
    }
  };

  const handleIdealActionSelectChange = (competencyId: string, actionKey: string, checked: boolean) => {
    if (!selectedCompetencyIds.includes(competencyId) && showSelection) {
      return; // Can't select ideal actions if competency isn't selected
    }
    onIdealActionSelect?.(competencyId, actionKey, checked);
  };

  const startEditing = (competency: Competency) => {
    setEditing({
      competencyId: competency.id,
      name: competency.name,
      description: competency.description || {},
    });
  };

  const cancelEditing = () => {
    setEditing({ competencyId: null, name: '', description: {} });
  };

  const saveEditing = () => {
    if (editing.competencyId && onCompetencyUpdate) {
      onCompetencyUpdate(editing.competencyId, {
        name: editing.name,
        description: editing.description,
      });
    }
    cancelEditing();
  };

  const updateEditingDescription = (key: string, value: string) => {
    setEditing(prev => ({
      ...prev,
      description: {
        ...prev.description,
        [key]: value,
      },
    }));
  };

  return (
    <div className={`space-y-3 ${className}`}>
      {competencies.map((competency) => {
        const isEditing = editing.competencyId === competency.id;
        const displayName = isEditing ? editing.name : competency.name;
        const displayDescription = isEditing ? editing.description : (competency.description || {});

        return (
          <Card key={competency.id} className="border">
            <Collapsible
              open={isCompetencyExpanded(competency.id)}
              onOpenChange={() => !isEditing && handleExpandToggle(competency.id)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3 flex-1">
                    {/* Selection checkbox */}
                    {showSelection && !editMode && (
                      <Checkbox
                        id={`competency-${competency.id}`}
                        checked={isCompetencySelected(competency.id)}
                        onCheckedChange={(checked) =>
                          handleCompetencySelectChange(competency.id, checked as boolean)
                        }
                      />
                    )}

                    {/* Competency name */}
                    <div className="flex-1">
                      {isEditing ? (
                        <Input
                          value={editing.name}
                          onChange={(e) => setEditing(prev => ({ ...prev, name: e.target.value }))}
                          className="text-base font-medium"
                          placeholder="コンピテンシー名"
                        />
                      ) : (
                        <CollapsibleTrigger className="flex items-center space-x-2 flex-1 text-left">
                          <CardTitle className="text-base">{displayName}</CardTitle>
                          {isCompetencyExpanded(competency.id) ? (
                            <ChevronDown className="h-4 w-4 transition-transform" />
                          ) : (
                            <ChevronRight className="h-4 w-4 transition-transform" />
                          )}
                        </CollapsibleTrigger>
                      )}
                    </div>

                    {/* Edit buttons */}
                    {showEditButtons && !isEditing && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => startEditing(competency)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    )}

                    {/* Save/Cancel buttons */}
                    {isEditing && (
                      <div className="flex space-x-2">
                        <Button variant="ghost" size="sm" onClick={saveEditing}>
                          <Save className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={cancelEditing}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </CardHeader>

              <CollapsibleContent>
                <CardContent className="pt-0">
                  <div className="space-y-3">
                    {!editMode && showSelection && (
                      <div className="text-sm text-muted-foreground mb-3">
                        理想的行動を選択してください：
                      </div>
                    )}

                    {Object.entries(displayDescription).map(([key, action]) => (
                      <div key={key} className="flex items-start space-x-3">
                        {/* Ideal action selection checkbox */}
                        {showSelection && !editMode && (
                          <Checkbox
                            id={`action-${competency.id}-${key}`}
                            checked={isIdealActionSelected(competency.id, key)}
                            disabled={!isCompetencySelected(competency.id)}
                            onCheckedChange={(checked) =>
                              handleIdealActionSelectChange(competency.id, key, checked as boolean)
                            }
                          />
                        )}

                        {/* Ideal action content */}
                        <div className="flex-1">
                          {isEditing ? (
                            <div className="space-y-2">
                              <div className="flex items-center space-x-2">
                                <span className="font-medium text-sm">{key}.</span>
                                <Textarea
                                  value={action}
                                  onChange={(e) => updateEditingDescription(key, e.target.value)}
                                  className="text-sm"
                                  rows={2}
                                  placeholder={`理想的行動 ${key}`}
                                />
                              </div>
                            </div>
                          ) : (
                            <label
                              htmlFor={`action-${competency.id}-${key}`}
                              className={`text-sm leading-relaxed cursor-pointer ${
                                !isCompetencySelected(competency.id) && showSelection && !editMode
                                  ? 'text-muted-foreground'
                                  : ''
                              }`}
                            >
                              <span className="font-medium">{key}.</span> {action}
                            </label>
                          )}
                        </div>
                      </div>
                    ))}

                    {/* Add new ideal action in edit mode */}
                    {isEditing && (
                      <div className="pt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const nextKey = (Object.keys(editing.description).length + 1).toString();
                            if (parseInt(nextKey) <= 5) {
                              updateEditingDescription(nextKey, '');
                            }
                          }}
                          disabled={Object.keys(editing.description).length >= 5}
                        >
                          理想的行動を追加
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        );
      })}
    </div>
  );
}