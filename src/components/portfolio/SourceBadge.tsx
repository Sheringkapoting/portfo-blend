import { cn } from '@/lib/utils';
import { Source } from '@/types/portfolio';

interface SourceBadgeProps {
  source: Source;
  className?: string;
}

export function SourceBadge({ source, className }: SourceBadgeProps) {
  const label = source;
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium",
        label === 'Zerodha' && "bg-zerodha/10 text-zerodha",
        label === 'INDMoney' && "bg-indmoney/10 text-indmoney",
        className
      )}
    >
      {label}
    </span>
  );
}
