import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { User, IdCard, Briefcase } from 'lucide-react';
import type { UserDetailResponse } from '@/api/types';

interface EmployeeInfoCardProps {
  employee: UserDetailResponse;
}

/**
 * Employee information card component
 * Displays detailed employee information with avatar and role badges
 *
 * Shared component used across evaluation features:
 * - Employee goal-list view
 * - Supervisor goal-review view
 */
export function EmployeeInfoCard({ employee }: EmployeeInfoCardProps) {
  const primaryRole = employee.roles?.[0];

  return (
    <Card className="p-4 md:p-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        {/* Avatar */}
        <Avatar className="h-12 w-12 sm:h-16 sm:w-16">
          <AvatarImage src="" alt={employee.name} />
          <AvatarFallback className="text-lg">
            {employee.name.slice(0, 2)}
          </AvatarFallback>
        </Avatar>

        {/* Employee Information */}
        <div className="flex-1 space-y-2 min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
            <h2 className="text-xl sm:text-2xl font-semibold truncate">{employee.name}</h2>
            <Badge variant="outline" className="flex items-center gap-1 w-fit">
              <User className="h-3 w-3" />
              {employee.status}
            </Badge>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4 text-sm text-muted-foreground">
            {/* Employee Code */}
            <div className="flex items-center gap-2">
              <IdCard className="h-4 w-4" />
              <span>社員ID: {employee.employee_code}</span>
            </div>

            {/* Job Title */}
            {employee.job_title && (
              <div className="flex items-center gap-2">
                <Briefcase className="h-4 w-4" />
                <span className="truncate">{employee.job_title}</span>
              </div>
            )}

            {/* Department */}
            {employee.department && (
              <div className="flex items-center gap-2">
                <span className="truncate">部署: {employee.department.name}</span>
              </div>
            )}

            {/* Role */}
            {primaryRole && (
              <div className="flex items-center gap-2">
                <span className="truncate">役割: {primaryRole.description || primaryRole.name}</span>
              </div>
            )}
          </div>

          {/* Email */}
          <div className="text-sm text-muted-foreground">
            <span className="break-all">{employee.email}</span>
          </div>
        </div>
      </div>
    </Card>
  );
}
