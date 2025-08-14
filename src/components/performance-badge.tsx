import { CheckCircle2, XCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

type PerformanceBadgeProps = {
  isMatch: boolean;
  value: string;
};

export default function PerformanceBadge({ isMatch, value }: PerformanceBadgeProps) {
  const Icon = isMatch ? CheckCircle2 : XCircle;
  const color = isMatch ? 'text-green-600' : 'text-red-600';

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-2">
            <Icon className={`h-5 w-5 ${color}`} />
            <span className="truncate max-w-xs">{value}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>{value}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
