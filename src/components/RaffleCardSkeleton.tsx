import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const RaffleCardSkeleton = ({ className }: { className?: string }) => {
  return (
    <Card className={`w-full bg-gradient-card border-card-border overflow-hidden ${className ?? ""}`}>
      <div className="relative h-64 overflow-hidden">
        <Skeleton className="w-full h-full" />
      </div>
      <div className="p-6 space-y-4">
        <div className="space-y-2">
          <Skeleton className="h-7 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </div>
        <Skeleton className="h-6 w-40" />
        <div className="space-y-1.5">
          <div className="flex justify-end">
            <Skeleton className="h-3 w-16" />
          </div>
          <Skeleton className="h-3 w-full rounded-full" />
        </div>
        <Skeleton className="h-12 w-full rounded-lg" />
      </div>
    </Card>
  );
};

export default RaffleCardSkeleton;
