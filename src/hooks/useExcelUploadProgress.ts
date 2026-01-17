import { useState, useCallback } from 'react';

export type UploadStep = 
  | 'idle'
  | 'validating'
  | 'uploading'
  | 'parsing'
  | 'processing'
  | 'syncing'
  | 'reconciling'
  | 'complete'
  | 'partial'
  | 'error';

export interface UploadProgress {
  step: UploadStep;
  message: string;
  progress: number;
  error: string | null;
  warnings: string[];
  details?: {
    totalRows?: number;
    processedRows?: number;
    insertedCount?: number;
    skippedCount?: number;
    source?: string;
  };
}

const STEP_PROGRESS: Record<UploadStep, number> = {
  idle: 0,
  validating: 10,
  uploading: 25,
  parsing: 40,
  processing: 60,
  syncing: 80,
  reconciling: 90,
  complete: 100,
  partial: 100,
  error: 100,
};

const STEP_MESSAGES: Record<UploadStep, string> = {
  idle: 'Ready to upload',
  validating: 'Validating file...',
  uploading: 'Uploading file...',
  parsing: 'Parsing Excel data...',
  processing: 'Processing holdings...',
  syncing: 'Syncing to database...',
  reconciling: 'Reconciling with analytics...',
  complete: 'Import completed successfully!',
  partial: 'Import completed with warnings',
  error: 'Import failed',
};

export function useExcelUploadProgress() {
  const [progress, setProgress] = useState<UploadProgress>({
    step: 'idle',
    message: STEP_MESSAGES.idle,
    progress: 0,
    error: null,
    warnings: [],
  });

  const reset = useCallback(() => {
    setProgress({
      step: 'idle',
      message: STEP_MESSAGES.idle,
      progress: 0,
      error: null,
      warnings: [],
    });
  }, []);

  const updateStep = useCallback((
    step: UploadStep, 
    options?: { 
      message?: string; 
      error?: string; 
      warnings?: string[];
      details?: UploadProgress['details'];
    }
  ) => {
    setProgress(prev => ({
      step,
      message: options?.message || STEP_MESSAGES[step],
      progress: STEP_PROGRESS[step],
      error: options?.error || null,
      warnings: options?.warnings || prev.warnings,
      details: options?.details || prev.details,
    }));
  }, []);

  const setError = useCallback((errorMessage: string) => {
    setProgress(prev => ({
      ...prev,
      step: 'error',
      message: errorMessage,
      progress: 100,
      error: errorMessage,
    }));
  }, []);

  const addWarning = useCallback((warning: string) => {
    setProgress(prev => ({
      ...prev,
      warnings: [...prev.warnings, warning],
    }));
  }, []);

  const isActive = progress.step !== 'idle' && progress.step !== 'complete' && progress.step !== 'partial' && progress.step !== 'error';
  const isComplete = progress.step === 'complete' || progress.step === 'partial';
  const hasError = progress.step === 'error';
  const hasWarnings = progress.warnings.length > 0;

  return {
    progress,
    reset,
    updateStep,
    setError,
    addWarning,
    isActive,
    isComplete,
    hasError,
    hasWarnings,
  };
}
