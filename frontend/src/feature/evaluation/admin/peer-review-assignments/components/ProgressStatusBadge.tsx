interface ProgressStatusBadgeProps {
  status: string | null;
  hasEvaluator: boolean;
}

const STATUS_CONFIG: Record<string, { label: string; dotColor: string; textColor: string }> = {
  submitted: {
    label: '提出済',
    dotColor: 'bg-green-500',
    textColor: 'text-green-700',
  },
  approved: {
    label: '提出済',
    dotColor: 'bg-green-500',
    textColor: 'text-green-700',
  },
  draft: {
    label: '保存中',
    dotColor: 'bg-orange-400',
    textColor: 'text-orange-700',
  },
  incomplete: {
    label: '保存中',
    dotColor: 'bg-orange-400',
    textColor: 'text-orange-700',
  },
};

export function ProgressStatusBadge({ status, hasEvaluator }: ProgressStatusBadgeProps) {
  // No evaluator assigned
  if (!hasEvaluator) {
    return <span className="text-xs text-muted-foreground">未割当</span>;
  }

  // Evaluator assigned but no evaluation started
  if (status === null) {
    return (
      <span className="inline-flex items-center gap-1 text-xs">
        <span className="h-2 w-2 rounded-full bg-red-500" />
        <span className="text-red-700">未着手</span>
      </span>
    );
  }

  const config = STATUS_CONFIG[status];
  if (!config) {
    return <span className="text-xs text-muted-foreground">{status}</span>;
  }

  return (
    <span className="inline-flex items-center gap-1 text-xs">
      <span className={`h-2 w-2 rounded-full ${config.dotColor}`} />
      <span className={config.textColor}>{config.label}</span>
    </span>
  );
}
