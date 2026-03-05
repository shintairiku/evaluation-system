import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { RatingBadge } from '@/components/evaluation/RatingBadge';

interface OverallRatingSummaryProps {
  selfAvgRating: string | null;
  peer1AvgRating: string | null;
  peer2AvgRating: string | null;
  supervisorAvgRating: string | null;
  overallRating: string | null;
}

export function OverallRatingSummary({
  selfAvgRating,
  peer1AvgRating,
  peer2AvgRating,
  supervisorAvgRating,
  overallRating,
}: OverallRatingSummaryProps) {
  return (
    <div className="bg-card border rounded-lg">
      <div className="p-4 border-b">
        <h3 className="text-sm font-semibold">総合評価</h3>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[80px] text-center">自己評価</TableHead>
            <TableHead className="w-[80px] text-center">同僚①</TableHead>
            <TableHead className="w-[80px] text-center">同僚②</TableHead>
            <TableHead className="w-[80px] text-center">上長</TableHead>
            <TableHead className="w-[80px] text-center">総合平均</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell className="text-center">
              <RatingBadge rating={selfAvgRating} />
            </TableCell>
            <TableCell className="text-center">
              <RatingBadge rating={peer1AvgRating} />
            </TableCell>
            <TableCell className="text-center">
              <RatingBadge rating={peer2AvgRating} />
            </TableCell>
            <TableCell className="text-center">
              <RatingBadge rating={supervisorAvgRating} />
            </TableCell>
            <TableCell className="text-center">
              <RatingBadge rating={overallRating} />
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}
