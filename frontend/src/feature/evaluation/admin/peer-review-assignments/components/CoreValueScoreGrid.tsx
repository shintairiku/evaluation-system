import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { RatingBadge } from '@/components/evaluation/RatingBadge';
import type { CoreValueItemScore } from '@/api/types';

interface CoreValueScoreGridProps {
  coreValues: CoreValueItemScore[];
}

export function CoreValueScoreGrid({ coreValues }: CoreValueScoreGridProps) {
  return (
    <div className="bg-card border rounded-lg">
      <div className="p-4 border-b">
        <h3 className="text-sm font-semibold">コアバリュー評価</h3>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[180px]">コアバリュー</TableHead>
            <TableHead className="w-[80px] text-center">自己評価</TableHead>
            <TableHead className="w-[80px] text-center">同僚①</TableHead>
            <TableHead className="w-[80px] text-center">同僚②</TableHead>
            <TableHead className="w-[80px] text-center">上長</TableHead>
            <TableHead className="w-[80px] text-center">平均</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {coreValues.map(cv => (
            <TableRow key={cv.definitionId}>
              <TableCell className="font-medium text-sm">{cv.name}</TableCell>
              <TableCell className="text-center">
                <RatingBadge rating={cv.selfRating} />
              </TableCell>
              <TableCell className="text-center">
                <RatingBadge rating={cv.peer1Rating} />
              </TableCell>
              <TableCell className="text-center">
                <RatingBadge rating={cv.peer2Rating} />
              </TableCell>
              <TableCell className="text-center">
                <RatingBadge rating={cv.supervisorRating} />
              </TableCell>
              <TableCell className="text-center">
                <RatingBadge rating={cv.averageRating} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
