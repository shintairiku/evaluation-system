import { Badge } from '@/components/ui/badge';
import { TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { UserDetailResponse, GoalResponse } from '@/api/types';

interface GroupedGoals {
  employee: UserDetailResponse;
  goals: GoalResponse[];
  pendingCount: number;
}

interface EmployeeTabNavigationProps {
  groupedGoals: GroupedGoals[];
}

export function EmployeeTabNavigation({
  groupedGoals
}: EmployeeTabNavigationProps) {
  return (
    <TabsList className="w-full justify-start overflow-x-auto h-auto p-1">
      {groupedGoals.map((group) => (
        <TabsTrigger
          key={group.employee.id}
          value={group.employee.id}
          className="flex items-center gap-2 whitespace-nowrap px-3 py-2 min-w-fit"
        >
          <span className="flex items-center gap-1">
            <span className="font-medium">{group.employee.name}</span>
            {group.employee.roles && group.employee.roles.length > 0 && (
              <span className="text-muted-foreground text-xs hidden sm:inline">
                ({group.employee.roles[0].name})
              </span>
            )}
          </span>
          <Badge variant="secondary" className="ml-1 text-xs">
            {group.pendingCount}
          </Badge>
        </TabsTrigger>
      ))}
    </TabsList>
  );
}