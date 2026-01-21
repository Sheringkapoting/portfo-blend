import { motion } from 'framer-motion';
import { Loader2, CheckCircle2, XCircle, Upload, FileSpreadsheet, Database } from 'lucide-react';
import { cn } from '@/lib/utils';

export type UploadStep = 'idle' | 'uploading' | 'parsing' | 'syncing' | 'complete' | 'error';

interface UploadProgressIndicatorProps {
  step: UploadStep;
  message?: string;
  holdingsCount?: number;
}

const STEPS = [
  { key: 'uploading', label: 'Uploading', icon: Upload },
  { key: 'parsing', label: 'Parsing', icon: FileSpreadsheet },
  { key: 'syncing', label: 'Syncing', icon: Database },
  { key: 'complete', label: 'Complete', icon: CheckCircle2 },
];

export function UploadProgressIndicator({ 
  step, 
  message,
  holdingsCount 
}: UploadProgressIndicatorProps) {
  if (step === 'idle') return null;

  const currentStepIndex = STEPS.findIndex(s => s.key === step);
  const isError = step === 'error';
  const isComplete = step === 'complete';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-4"
    >
      {/* Progress Steps */}
      <div className="flex items-center justify-between">
        {STEPS.map((s, index) => {
          const isActive = s.key === step;
          const isPast = currentStepIndex > index || isComplete;
          const Icon = s.icon;

          return (
            <div key={s.key} className="flex items-center">
              <div className="flex flex-col items-center">
                <div className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300",
                  isActive && !isError && "bg-primary text-primary-foreground",
                  isPast && "bg-profit text-white",
                  !isActive && !isPast && "bg-muted text-muted-foreground",
                  isError && isActive && "bg-loss text-white"
                )}>
                  {isActive && !isComplete && !isError ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : isError && isActive ? (
                    <XCircle className="h-5 w-5" />
                  ) : (
                    <Icon className="h-5 w-5" />
                  )}
                </div>
                <span className={cn(
                  "text-xs mt-1 font-medium",
                  (isActive || isPast) ? "text-foreground" : "text-muted-foreground"
                )}>
                  {s.label}
                </span>
              </div>
              {index < STEPS.length - 1 && (
                <div className={cn(
                  "w-12 h-0.5 mx-2 transition-all duration-300",
                  isPast ? "bg-profit" : "bg-muted"
                )} />
              )}
            </div>
          );
        })}
      </div>

      {/* Status Message */}
      <div className={cn(
        "text-center py-3 px-4 rounded-lg",
        isError ? "bg-loss/10 text-loss" : 
        isComplete ? "bg-profit/10 text-profit" : 
        "bg-primary/10 text-primary"
      )}>
        <p className="text-sm font-medium">
          {message || (isComplete 
            ? `Successfully imported ${holdingsCount || 0} holdings!` 
            : 'Processing...')}
        </p>
      </div>
    </motion.div>
  );
}
