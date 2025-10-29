'use client';

import { Badge } from '@/components/ui/badge';
import type { UserStatus } from '@/api/types';

const STATUS_LABELS: Record<UserStatus, string> = {
  pending_approval: '承認待ち',
  active: 'アクティブ',
  inactive: '無効',
};

const STATUS_STYLES: Record<UserStatus, string> = {
  pending_approval: 'bg-amber-100 text-amber-800 border-amber-200',
  active: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  inactive: 'bg-slate-200 text-slate-700 border-slate-300',
};

interface StatusBadgeProps {
  status: UserStatus;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={`${STATUS_STYLES[status]} ${className ?? ''}`.trim()}
    >
      {STATUS_LABELS[status]}
    </Badge>
  );
}
