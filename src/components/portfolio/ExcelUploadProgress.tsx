import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, AlertCircle, AlertTriangle, Loader2, FileSpreadsheet, Database, RefreshCw } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { UploadProgress, UploadStep } from '@/hooks/useExcelUploadProgress';

interface ExcelUploadProgressProps {
  progress: UploadProgress;
  onReset?: () => void;
  onRetry?: () => void;
}

const STEP_ICONS: Record<UploadStep, React.ReactNode> = {
  idle: <FileSpreadsheet className="h-4 w-4" />,
  validating: <Loader2 className="h-4 w-4 animate-spin" />,
  uploading: <Loader2 className="h-4 w-4 animate-spin" />,
  parsing: <FileSpreadsheet className="h-4 w-4" />,
  processing: <Loader2 className="h-4 w-4 animate-spin" />,
  syncing: <Database className="h-4 w-4" />,
  reconciling: <RefreshCw className="h-4 w-4 animate-spin" />,
  complete: <CheckCircle2 className="h-4 w-4 text-profit" />,
  partial: <AlertTriangle className="h-4 w-4 text-warning" />,
  error: <AlertCircle className="h-4 w-4 text-loss" />,
};

export function ExcelUploadProgress({ progress, onReset, onRetry }: ExcelUploadProgressProps) {
  const isActive = progress.step !== 'idle';
  const isInProgress = ['validating', 'uploading', 'parsing', 'processing', 'syncing', 'reconciling'].includes(progress.step);
  const isComplete = progress.step === 'complete';
  const isPartial = progress.step === 'partial';
  const isError = progress.step === 'error';

  if (!isActive) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="space-y-3"
      >
        {/* Progress Bar Section */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              {STEP_ICONS[progress.step]}
              <span className={
                isComplete ? 'text-profit font-medium' :
                isPartial ? 'text-warning font-medium' :
                isError ? 'text-loss font-medium' :
                'text-muted-foreground'
              }>
                {progress.message}
              </span>
            </div>
            <span className="text-muted-foreground font-mono text-xs">
              {progress.progress}%
            </span>
          </div>
          
          <Progress 
            value={progress.progress} 
            className={`h-2 ${
              isComplete ? '[&>div]:bg-profit' :
              isPartial ? '[&>div]:bg-warning' :
              isError ? '[&>div]:bg-loss' :
              ''
            }`}
          />
        </div>

        {/* Details Section */}
        {progress.details && isInProgress && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-wrap gap-3 text-xs text-muted-foreground"
          >
            {progress.details.totalRows !== undefined && (
              <span>Total rows: {progress.details.totalRows}</span>
            )}
            {progress.details.processedRows !== undefined && (
              <span>Processed: {progress.details.processedRows}</span>
            )}
            {progress.details.insertedCount !== undefined && (
              <span>Inserted: {progress.details.insertedCount}</span>
            )}
            {progress.details.skippedCount !== undefined && progress.details.skippedCount > 0 && (
              <span className="text-warning">Skipped: {progress.details.skippedCount}</span>
            )}
          </motion.div>
        )}

        {/* Success Alert */}
        {isComplete && (
          <Alert className="border-profit/30 bg-profit/5">
            <CheckCircle2 className="h-4 w-4 text-profit" />
            <AlertTitle className="text-profit">Sync Complete</AlertTitle>
            <AlertDescription className="text-sm">
              {progress.details?.insertedCount !== undefined 
                ? `Successfully imported ${progress.details.insertedCount} holdings.`
                : 'All holdings have been synced successfully.'}
              {onReset && (
                <Button variant="ghost" size="sm" onClick={onReset} className="ml-2 h-6 px-2">
                  Dismiss
                </Button>
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* Partial Success Alert */}
        {isPartial && (
          <Alert className="border-warning/30 bg-warning/5">
            <AlertTriangle className="h-4 w-4 text-warning" />
            <AlertTitle className="text-warning">Partial Sync</AlertTitle>
            <AlertDescription className="text-sm space-y-2">
              <p>Import completed with some warnings:</p>
              {progress.warnings.length > 0 && (
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  {progress.warnings.slice(0, 5).map((warning, i) => (
                    <li key={i} className="text-xs">{warning}</li>
                  ))}
                  {progress.warnings.length > 5 && (
                    <li className="text-xs">...and {progress.warnings.length - 5} more</li>
                  )}
                </ul>
              )}
              {onReset && (
                <Button variant="ghost" size="sm" onClick={onReset} className="h-6 px-2">
                  Dismiss
                </Button>
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* Error Alert */}
        {isError && (
          <Alert variant="destructive" className="border-loss/30 bg-loss/5">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Sync Failed</AlertTitle>
            <AlertDescription className="text-sm space-y-2">
              <p>{progress.error || 'An unknown error occurred during import.'}</p>
              <div className="flex gap-2 mt-2">
                {onRetry && (
                  <Button variant="outline" size="sm" onClick={onRetry} className="h-7">
                    <RefreshCw className="h-3 w-3 mr-1" />
                    Retry
                  </Button>
                )}
                {onReset && (
                  <Button variant="ghost" size="sm" onClick={onReset} className="h-7">
                    Dismiss
                  </Button>
                )}
              </div>
            </AlertDescription>
          </Alert>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
