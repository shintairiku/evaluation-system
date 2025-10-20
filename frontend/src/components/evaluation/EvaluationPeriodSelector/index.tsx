import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Calendar } from 'lucide-react';
import type { EvaluationPeriod } from '@/api/types';

interface EvaluationPeriodSelectorProps {
  /** All available evaluation periods */
  periods: EvaluationPeriod[];
  /** Currently selected period ID */
  selectedPeriodId: string;
  /** ID of the current (active) period */
  currentPeriodId: string | null;
  /** Callback when period selection changes */
  onPeriodChange: (periodId: string) => void;
  /** Loading state */
  isLoading?: boolean;
}

/**
 * Evaluation Period Selector Component
 *
 * Allows users to select which evaluation period to view.
 * Displays all available periods with a visual indicator for the current period.
 *
 * Shared component used across evaluation features:
 * - Employee goal-list view (目標一覧)
 * - Supervisor goal-review view (目標承認)
 *
 * @example
 * ```tsx
 * <EvaluationPeriodSelector
 *   periods={allPeriods}
 *   selectedPeriodId={selectedId}
 *   currentPeriodId={currentId}
 *   onPeriodChange={handlePeriodChange}
 * />
 * ```
 */
export function EvaluationPeriodSelector({
  periods,
  selectedPeriodId,
  currentPeriodId,
  onPeriodChange,
  isLoading = false,
}: EvaluationPeriodSelectorProps) {
  // Find the selected period to display its name
  const selectedPeriod = periods.find(p => p.id === selectedPeriodId);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2">
        <Calendar className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">評価期間:</span>
        <div className="h-9 w-48 bg-gray-200 rounded animate-pulse"></div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Calendar className="h-4 w-4 text-muted-foreground" />
      <span className="text-sm font-medium">評価期間:</span>
      <Select value={selectedPeriodId} onValueChange={onPeriodChange}>
        <SelectTrigger className="w-[280px]">
          <SelectValue>
            {selectedPeriod ? (
              <div className="flex items-center gap-2">
                <span>{selectedPeriod.name}</span>
                {selectedPeriod.id === currentPeriodId && (
                  <Badge variant="default" className="ml-1 bg-green-600 hover:bg-green-700">
                    現在
                  </Badge>
                )}
              </div>
            ) : (
              '期間を選択'
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {periods.length === 0 ? (
            <div className="px-2 py-6 text-center text-sm text-muted-foreground">
              評価期間が見つかりません
            </div>
          ) : (
            periods.map((period) => (
              <SelectItem key={period.id} value={period.id}>
                <div className="flex items-center gap-2">
                  <span>{period.name}</span>
                  {period.id === currentPeriodId && (
                    <Badge variant="default" className="ml-1 bg-green-600 hover:bg-green-700">
                      現在
                    </Badge>
                  )}
                </div>
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>
    </div>
  );
}
