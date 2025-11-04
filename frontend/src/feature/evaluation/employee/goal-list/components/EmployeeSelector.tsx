import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Users } from 'lucide-react';
import type { GroupedGoals } from '../hooks/useGoalListData';

interface EmployeeSelectorProps {
  groupedGoals: GroupedGoals[];
  selectedEmployeeId: string;
  onSelectEmployee: (employeeId: string) => void;
}

/**
 * Employee selector component for filtering goals by employee
 * Shows employee names with goal counts as clickable buttons
 */
export function EmployeeSelector({
  groupedGoals,
  selectedEmployeeId,
  onSelectEmployee
}: EmployeeSelectorProps) {
  // Calculate total goals across all employees
  const totalGoals = groupedGoals.reduce((sum, group) => sum + group.goalCount, 0);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <Users className="h-4 w-4" />
        <span>従業員でフィルター</span>
      </div>

      <div className="flex flex-wrap gap-2">
        {/* "All" button */}
        <Button
          variant={selectedEmployeeId === '' ? 'default' : 'outline'}
          size="sm"
          onClick={() => onSelectEmployee('')}
          className="flex items-center gap-2"
        >
          <span>すべて</span>
          <Badge variant={selectedEmployeeId === '' ? 'secondary' : 'outline'} className="ml-1">
            {totalGoals}
          </Badge>
        </Button>

        {/* Individual employee buttons */}
        {groupedGoals.map((group) => (
          <Button
            key={group.employee.id}
            variant={selectedEmployeeId === group.employee.id ? 'default' : 'outline'}
            size="sm"
            onClick={() => onSelectEmployee(group.employee.id)}
            className="flex items-center gap-2"
          >
            <span>{group.employee.name}</span>
            {group.employee.roles && group.employee.roles.length > 0 && (
              <span className="text-xs text-muted-foreground hidden sm:inline">
                ({group.employee.roles[0].description || group.employee.roles[0].name})
              </span>
            )}
            <Badge
              variant={selectedEmployeeId === group.employee.id ? 'secondary' : 'outline'}
              className="ml-1"
            >
              {group.goalCount}
            </Badge>
          </Button>
        ))}
      </div>
    </div>
  );
}
