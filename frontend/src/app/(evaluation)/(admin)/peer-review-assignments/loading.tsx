import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-10 w-48" />
      </div>

      {/* Tabs */}
      <div className="space-y-6">
        <div className="flex gap-2">
          <Skeleton className="h-9 w-24 rounded-md" />
          <Skeleton className="h-9 w-24 rounded-md" />
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-card border rounded-lg p-4 space-y-2">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-8 w-12" />
            </div>
          ))}
        </div>

        {/* Filter Bar */}
        <div className="flex flex-wrap gap-4 items-center p-4 bg-card rounded-lg border">
          <Skeleton className="h-10 flex-1 min-w-[200px]" />
          <Skeleton className="h-10 w-[180px]" />
          <Skeleton className="h-10 w-36" />
          <Skeleton className="h-10 w-28" />
        </div>

        {/* Table */}
        <div className="bg-card border rounded-lg">
          <div className="w-full">
            {/* Header */}
            <div className="flex items-center border-b px-4 py-3">
              <Skeleton className="h-4 w-32 mr-8" />
              <Skeleton className="h-4 w-24 mr-8" />
              <Skeleton className="h-4 w-24 mr-8" />
              <Skeleton className="h-4 w-40 mr-8" />
              <Skeleton className="h-4 w-40 mr-8" />
              <Skeleton className="h-4 w-16" />
            </div>
            {/* Rows */}
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="flex items-center border-b px-4 py-3">
                <Skeleton className="h-4 w-32 mr-8" />
                <Skeleton className="h-4 w-24 mr-8" />
                <Skeleton className="h-4 w-24 mr-8" />
                <Skeleton className="h-8 w-40 mr-8" />
                <Skeleton className="h-8 w-40 mr-8" />
                <Skeleton className="h-6 w-16 rounded-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
