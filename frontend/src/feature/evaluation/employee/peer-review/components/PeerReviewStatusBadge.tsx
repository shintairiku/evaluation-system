import { Badge } from '@/components/ui/badge';
import { CheckCircle } from 'lucide-react';
import type { PeerReviewEvaluation } from '@/api/types';

interface PeerReviewStatusBadgeProps {
  evaluation: PeerReviewEvaluation;
}

/**
 * Determines the display status for a peer review evaluation:
 * - 提出済み: submitted
 * - 下書き: draft with some data (scores or comment)
 * - 未評価: draft with no data
 */
function getStatus(evaluation: PeerReviewEvaluation) {
  if (evaluation.status === 'submitted') {
    return 'submitted' as const;
  }

  const hasScores =
    evaluation.scores !== null && Object.keys(evaluation.scores).length > 0;
  const hasComment =
    evaluation.comment !== null && evaluation.comment.trim().length > 0;

  if (hasScores || hasComment) {
    return 'draft' as const;
  }

  return 'not_started' as const;
}

export function PeerReviewStatusBadge({ evaluation }: PeerReviewStatusBadgeProps) {
  const status = getStatus(evaluation);

  switch (status) {
    case 'submitted':
      return (
        <Badge className="bg-green-100 text-green-800 border-green-200 hover:bg-green-100">
          <CheckCircle className="h-3 w-3 mr-1" />
          提出済み
        </Badge>
      );
    case 'draft':
      return (
        <Badge className="bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-100">
          下書き
        </Badge>
      );
    case 'not_started':
      return (
        <Badge className="bg-red-100 text-red-800 border-red-200 hover:bg-red-100">
          未評価
        </Badge>
      );
  }
}
