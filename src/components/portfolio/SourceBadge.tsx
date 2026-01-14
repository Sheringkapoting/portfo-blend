import { cn } from '@/lib/utils';
import { Source } from '@/types/portfolio';

interface SourceBadgeProps {
  source: Source;
  className?: string;
}

export function SourceBadge({ source, className }: SourceBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium",
        source === 'Zerodha' && "bg-zerodha/10 text-zerodha",
        source === 'INDMoney' && "bg-indmoney/10 text-indmoney",
        className
      )}
    >
      {source}
    </span>
  );
}
