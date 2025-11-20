import { Badge } from '@/components/ui/badge';
import { TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { UserDetailResponse } from '@/api/types';
import type { BucketDecision } from '@/api/types';

export interface GroupedReviews {
  employee: UserDetailResponse;
  reviewId: string;
  bucketDecisions: BucketDecision[];
  pendingCount: number;
}

interface EmployeeTabNavigationProps {
  groupedReviews: GroupedReviews[];
}

/**
 * Employee tab navigation component for self-assessment review
 * Displays subordinates as tabs with pending count badges
 * Example: "Silva Isaac (管理者) 2"
 */
export function EmployeeTabNavigation({
  groupedReviews
}: EmployeeTabNavigationProps) {
  return (
    <TabsList className="w-full justify-start overflow-x-auto h-auto p-1">
      {groupedReviews.map((group) => (
        <TabsTrigger
          key={group.employee.id}
          value={group.employee.id}
          className="flex items-center gap-2 whitespace-nowrap px-3 py-2 min-w-fit"
        >
          {/* Name and Role */}
          <span className="flex items-center gap-1">
            <span className="font-medium">{group.employee.name}</span>
            {group.employee.roles && group.employee.roles.length > 0 && (
              <span className="text-muted-foreground text-xs hidden sm:inline">
                ({group.employee.roles[0].description || group.employee.roles[0].name})
              </span>
            )}
          </span>

          {/* Pending count badge */}
          <Badge variant="secondary" className="ml-1 text-xs">
            {group.pendingCount}
          </Badge>
        </TabsTrigger>
      ))}
    </TabsList>
  );
}
