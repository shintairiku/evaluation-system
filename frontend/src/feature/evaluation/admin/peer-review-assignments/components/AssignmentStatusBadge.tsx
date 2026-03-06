import { Badge } from '@/components/ui/badge';

type AssignmentStatus = 'assigned' | 'partial' | 'unassigned';

interface AssignmentStatusBadgeProps {
  reviewer1Id: string | null;
  reviewer2Id: string | null;
}

function getStatus(reviewer1Id: string | null, reviewer2Id: string | null): AssignmentStatus {
  if (reviewer1Id && reviewer2Id) return 'assigned';
  if (reviewer1Id || reviewer2Id) return 'partial';
  return 'unassigned';
}

const STATUS_CONFIG: Record<AssignmentStatus, { label: string; className: string }> = {
  assigned: {
    label: '割当済',
    className: 'bg-green-100 text-green-800 hover:bg-green-100',
  },
  partial: {
    label: '一部割当',
    className: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100',
  },
  unassigned: {
    label: '未割当',
    className: 'bg-red-100 text-red-800 hover:bg-red-100',
  },
};

export function AssignmentStatusBadge({ reviewer1Id, reviewer2Id }: AssignmentStatusBadgeProps) {
  const status = getStatus(reviewer1Id, reviewer2Id);
  const config = STATUS_CONFIG[status];

  return (
    <Badge variant="secondary" className={config.className}>
      {config.label}
    </Badge>
  );
}
