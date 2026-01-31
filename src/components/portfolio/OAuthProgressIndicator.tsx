import { motion } from 'framer-motion';
import { CheckCircle2, Circle, Loader2, XCircle, Wifi, ShieldCheck, RefreshCw, PartyPopper } from 'lucide-react';
import { cn } from '@/lib/utils';

export type OAuthStep = 'idle' | 'connecting' | 'verifying' | 'syncing' | 'complete' | 'error';

interface OAuthProgressIndicatorProps {
  step: OAuthStep;
  message: string;
}

const STEPS = [
  { key: 'connecting', label: 'Connecting', description: 'Redirecting to Zerodha', icon: Wifi },
  { key: 'verifying', label: 'Verifying', description: 'Validating session', icon: ShieldCheck },
  { key: 'syncing', label: 'Syncing', description: 'Importing holdings', icon: RefreshCw },
  { key: 'complete', label: 'Complete', description: 'All done!', icon: PartyPopper },
] as const;

function getStepIndex(step: OAuthStep): number {
  const index = STEPS.findIndex(s => s.key === step);
  return index >= 0 ? index : -1;
}

function getStepStatus(stepKey: string, currentStep: OAuthStep): 'pending' | 'active' | 'complete' | 'error' {
  if (currentStep === 'error') {
    const currentIndex = getStepIndex(currentStep);
    const stepIndex = STEPS.findIndex(s => s.key === stepKey);
    if (stepIndex <= currentIndex) return 'error';
    return 'pending';
  }
  
  const currentIndex = getStepIndex(currentStep);
  const stepIndex = STEPS.findIndex(s => s.key === stepKey);
  
  if (stepIndex < currentIndex) return 'complete';
  if (stepIndex === currentIndex) return 'active';
  return 'pending';
}

export function OAuthProgressIndicator({ step, message }: OAuthProgressIndicatorProps) {
  if (step === 'idle') return null;

  const currentStepIndex = getStepIndex(step);
  const progressPercent = step === 'complete' ? 100 : step === 'error' ? (currentStepIndex / STEPS.length) * 100 : ((currentStepIndex + 0.5) / STEPS.length) * 100;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-4 p-4 rounded-lg border border-border bg-card/80 backdrop-blur-sm"
    >
      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-foreground">
            {step === 'error' ? 'Connection Failed' : step === 'complete' ? 'Connected!' : 'Connecting to Zerodha'}
          </span>
          <span className="text-muted-foreground">{Math.round(progressPercent)}%</span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <motion.div
            className={cn(
              "h-full rounded-full",
              step === 'error' ? 'bg-destructive' : step === 'complete' ? 'bg-profit' : 'bg-primary'
            )}
            initial={{ width: 0 }}
            animate={{ width: `${progressPercent}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </div>
      </div>

      {/* Steps */}
      <div className="flex items-center justify-between">
        {STEPS.map((stepConfig, index) => {
          const status = getStepStatus(stepConfig.key, step);
          const Icon = stepConfig.icon;
          
          return (
            <div key={stepConfig.key} className="flex flex-col items-center gap-1.5 flex-1">
              {/* Step Icon */}
              <div className={cn(
                "relative flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all duration-300",
                status === 'complete' && "border-profit bg-profit/10",
                status === 'active' && "border-primary bg-primary/10",
                status === 'pending' && "border-muted bg-muted/30",
                status === 'error' && "border-destructive bg-destructive/10"
              )}>
                {status === 'complete' ? (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                  >
                    <CheckCircle2 className="h-5 w-5 text-profit" />
                  </motion.div>
                ) : status === 'active' ? (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  >
                    <Loader2 className="h-5 w-5 text-primary" />
                  </motion.div>
                ) : status === 'error' ? (
                  <XCircle className="h-5 w-5 text-destructive" />
                ) : (
                  <Icon className="h-5 w-5 text-muted-foreground/50" />
                )}
              </div>
              
              {/* Step Label */}
              <span className={cn(
                "text-xs font-medium transition-colors",
                status === 'complete' && "text-profit",
                status === 'active' && "text-primary",
                status === 'pending' && "text-muted-foreground/50",
                status === 'error' && "text-destructive"
              )}>
                {stepConfig.label}
              </span>
              
              {/* Connector Line (except for last step) */}
              {index < STEPS.length - 1 && (
                <div className="absolute top-5 left-[calc(50%+20px)] w-[calc(100%-40px)] h-0.5 -z-10">
                  {/* This would need absolute positioning on parent */}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Current Status Message */}
      <motion.div
        key={message}
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          "text-center text-sm py-2 px-3 rounded-md",
          step === 'error' && "bg-destructive/10 text-destructive",
          step === 'complete' && "bg-profit/10 text-profit",
          step !== 'error' && step !== 'complete' && "bg-muted/50 text-muted-foreground"
        )}
      >
        {message}
      </motion.div>
    </motion.div>
  );
}
