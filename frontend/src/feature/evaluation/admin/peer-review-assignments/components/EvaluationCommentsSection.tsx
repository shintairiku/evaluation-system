import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { EvaluationSourceComment } from '@/api/types';

interface EvaluationCommentsSectionProps {
  comments: EvaluationSourceComment[];
}

const SOURCE_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  self: { label: '本人', color: 'bg-blue-100 text-blue-800' },
  peer1: { label: '同僚①', color: 'bg-purple-100 text-purple-800' },
  peer2: { label: '同僚②', color: 'bg-purple-100 text-purple-800' },
  supervisor: { label: '上長', color: 'bg-green-100 text-green-800' },
};

export function EvaluationCommentsSection({ comments }: EvaluationCommentsSectionProps) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">コメント</h3>
      {comments.map(c => {
        const typeInfo = SOURCE_TYPE_LABELS[c.sourceType] || { label: c.sourceType, color: '' };
        return (
          <Card key={c.sourceType}>
            <CardHeader className="pb-2 pt-3 px-4">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Badge variant="outline" className={`text-xs ${typeInfo.color}`}>
                  {typeInfo.label}
                </Badge>
                <span className="text-muted-foreground">{c.sourceLabel}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              {c.comment ? (
                <p className="text-sm whitespace-pre-wrap">{c.comment}</p>
              ) : (
                <p className="text-sm text-muted-foreground">コメントなし</p>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
