import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Info } from 'lucide-react';
import { RatingBadge } from '@/components/evaluation/RatingBadge';
import type { CoreValueItemScore } from '@/api/types';

/** The 平均/総合平均 are the average of the 3 others (excluding self). */
export const CORE_VALUE_AVERAGE_NOTE = '自分を除く3人（同僚①・同僚②・上長）の平均です';

export function AverageNoteTooltip() {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Info className="inline h-3.5 w-3.5 text-muted-foreground cursor-help align-text-bottom" />
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[220px]">
          <p className="text-xs">{CORE_VALUE_AVERAGE_NOTE}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

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
            <TableHead className="w-[90px] text-center">
              <span className="inline-flex items-center gap-1">
                平均
                <AverageNoteTooltip />
              </span>
            </TableHead>
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
