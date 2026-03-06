import { Badge } from '@/components/ui/badge';
import { getRatingColor } from '@/utils/rating';

interface RatingBadgeProps {
  rating: string | null;
}

export function RatingBadge({ rating }: RatingBadgeProps) {
  return (
    <Badge variant="outline" className={`text-xs font-medium ${getRatingColor(rating)}`}>
      {rating ?? '−'}
    </Badge>
  );
}
