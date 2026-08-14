import { Skeleton } from "@/components/ui/skeleton";

export function TaskRowSkeleton() {
  return (
    <div className="flex items-center gap-3 rounded-xl border py-3 pl-4 pr-3">
      <Skeleton className="size-7 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-3/5" />
        <Skeleton className="h-3 w-2/5" />
      </div>
      <Skeleton className="size-9 rounded-lg" />
    </div>
  );
}

export function TaskListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }, (_, i) => (
        <TaskRowSkeleton key={i} />
      ))}
    </div>
  );
}

export function HomeSkeleton() {
  return (
    <div className="space-y-6" data-testid="home-skeleton">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-32" />
        </div>
        <Skeleton className="h-9 w-32 rounded-lg" />
      </div>
      <Skeleton className="h-20 w-full rounded-xl" />
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <Skeleton className="h-6 w-36" />
          <Skeleton className="h-2 flex-1 rounded-full" />
        </div>
        <TaskListSkeleton />
      </div>
      <div className="space-y-3">
        <Skeleton className="h-6 w-28" />
        <TaskListSkeleton rows={2} />
      </div>
    </div>
  );
}

export function HabitsSkeleton() {
  return (
    <div className="space-y-6" data-testid="habits-skeleton">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-9 w-36 rounded-lg" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="space-y-3 rounded-xl border p-4">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-2 w-full rounded-full" />
            <Skeleton className="h-24 w-full rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}
