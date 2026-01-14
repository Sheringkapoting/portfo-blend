import { cn } from '@/lib/utils';
import { Recommendation } from '@/types/portfolio';

interface RecommendationBadgeProps {
  recommendation: Recommendation;
  className?: string;
}

const recommendationStyles: Record<Recommendation, { bg: string; text: string }> = {
  'HOLD': { bg: 'bg-hold/15', text: 'text-hold' },
  'ACCUMULATE': { bg: 'bg-accumulate/15', text: 'text-accumulate' },
  'TRIM / PROFIT': { bg: 'bg-trim/15', text: 'text-trim' },
  'RIDE TREND': { bg: 'bg-ride/15', text: 'text-ride' },
  'REVIEW': { bg: 'bg-review/15', text: 'text-review' }
};

export function RecommendationBadge({ recommendation, className }: RecommendationBadgeProps) {
  const styles = recommendationStyles[recommendation];
  
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold uppercase tracking-wide",
        styles.bg,
        styles.text,
        className
      )}
    >
      {recommendation}
    </span>
  );
}
