import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Upload, FileSpreadsheet, CheckCircle2, XCircle, Clock, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { KiteConnectCard } from './KiteConnectCard';
import { BrokerPlaceholderCard, AVAILABLE_BROKERS } from './BrokerPlaceholderCard';
import { KiteLoginModal } from './KiteLoginModal';
import { ExcelUploadProgress } from './ExcelUploadProgress';
import { useKiteSession } from '@/hooks/useKiteSession';
import { UploadProgress } from '@/hooks/useExcelUploadProgress';

interface SyncStatus {
  source: string;
  status: string;
  holdings_count: number | null;
  error_message: string | null;
  created_at: string;
}

interface SyncProgress {
  step: 'idle' | 'connecting' | 'verifying' | 'syncing' | 'complete' | 'error';
  message: string;
}

interface DataSourcePanelProps {
  onSyncZerodha: () => Promise<void>;
  onUploadINDMoney: (file: File) => Promise<void>;
  isSyncing: boolean;
  syncStatus: SyncStatus[];
  lastSync: Date | null;
  showMandatoryKiteLogin?: boolean;
  syncProgress?: SyncProgress;
  uploadProgress?: UploadProgress;
  onResetUploadProgress?: () => void;
}

export function DataSourcePanel({
  onSyncZerodha,
  onUploadINDMoney,
  isSyncing,
  syncStatus,
  lastSync,
  showMandatoryKiteLogin = false,
  syncProgress,
  uploadProgress,
  onResetUploadProgress,
}: DataSourcePanelProps) {
  const [dragActive, setDragActive] = useState(false);
  const [lastUploadedFile, setLastUploadedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { isSessionValid, loginUrl, loginUrlError, isLoading: isKiteLoading } = useKiteSession();

  // Check if we need to show the mandatory Kite login
  const shouldShowKiteModal = showMandatoryKiteLogin && !isSessionValid && !isKiteLoading;

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = e.dataTransfer.files;
    if (files && files[0]) {
      setLastUploadedFile(files[0]);
      await onUploadINDMoney(files[0]);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files[0]) {
      setLastUploadedFile(files[0]);
      await onUploadINDMoney(files[0]);
    }
    // Reset input to allow re-uploading the same file
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRetry = async () => {
    if (lastUploadedFile) {
      await onUploadINDMoney(lastUploadedFile);
    }
  };

  const getLatestStatus = (source: string) => {
    return syncStatus.find(s => s.source === source);
  };

  const zerodhaStatus = getLatestStatus('Zerodha');
  const indmoneyStatus = getLatestStatus('INDMoney');

  // Check if upload is in progress
  const isUploadActive = uploadProgress && uploadProgress.step !== 'idle';
  const isUploadInProgress = uploadProgress && 
    !['idle', 'complete', 'partial', 'error'].includes(uploadProgress.step);

  return (
    <>
      {/* Mandatory Kite Login Modal */}
      {shouldShowKiteModal && (
        <KiteLoginModal
          loginUrl={loginUrl}
          loginUrlError={loginUrlError}
          isLoading={isKiteLoading}
        />
      )}

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="space-y-6"
      >
        {/* Section Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Connected Brokers</h2>
            <p className="text-sm text-muted-foreground">Sync your portfolio from multiple sources</p>
          </div>
          {lastSync && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              Last synced: {lastSync.toLocaleString('en-IN')}
            </div>
          )}
        </div>

        {/* Active Brokers Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Zerodha Kite Connect Card */}
          <KiteConnectCard
            onSyncZerodha={onSyncZerodha}
            isSyncing={isSyncing}
            zerodhaStatus={zerodhaStatus}
            syncProgress={syncProgress}
          />

          {/* INDMoney Upload Card */}
          <Card className="border-border bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-500/10">
                    <FileSpreadsheet className="h-5 w-5 text-blue-500" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">INDMoney</CardTitle>
                    <CardDescription>Upload Holdings Report Excel</CardDescription>
                  </div>
                </div>
                <StatusBadge 
                  status={indmoneyStatus} 
                  isUploading={isUploadInProgress}
                  uploadProgress={uploadProgress}
                />
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Upload Progress Indicator */}
                {uploadProgress && (
                  <ExcelUploadProgress
                    progress={uploadProgress}
                    onReset={onResetUploadProgress}
                    onRetry={lastUploadedFile ? handleRetry : undefined}
                  />
                )}

                {/* Previous sync status (show when not actively uploading) */}
                {!isUploadActive && indmoneyStatus && (
                  <div className="text-sm text-muted-foreground">
                    {indmoneyStatus.status === 'success' ? (
                      <span className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-profit" />
                        {indmoneyStatus.holdings_count} holdings imported
                      </span>
                    ) : indmoneyStatus.status === 'partial' ? (
                      <span className="flex items-center gap-2 text-warning">
                        <AlertTriangle className="h-4 w-4" />
                        {indmoneyStatus.holdings_count} holdings imported with warnings
                      </span>
                    ) : (
                      <span className="flex items-center gap-2 text-loss">
                        <XCircle className="h-4 w-4" />
                        {indmoneyStatus.error_message}
                      </span>
                    )}
                  </div>
                )}

                {/* Drop zone (hide during active upload) */}
                {!isUploadInProgress && (
                  <div
                    className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${
                      dragActive
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    } ${isSyncing ? 'opacity-50 pointer-events-none' : ''}`}
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                    onClick={() => !isSyncing && fileInputRef.current?.click()}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={handleFileChange}
                      className="hidden"
                      disabled={isSyncing}
                    />
                    <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      {dragActive
                        ? 'Drop the file here'
                        : 'Drag & drop or click to upload'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Indmoney-HoldingsReport*.xlsx
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Coming Soon Brokers */}
        <div className="mt-8">
          <div className="mb-4">
            <h3 className="text-md font-medium text-muted-foreground">Coming Soon</h3>
            <p className="text-sm text-muted-foreground/70">More broker integrations are on the way</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {AVAILABLE_BROKERS.map((brokerId, index) => (
              <BrokerPlaceholderCard
                key={brokerId}
                brokerId={brokerId}
                delay={0.1 + index * 0.05}
              />
            ))}
          </div>
        </div>
      </motion.div>
    </>
  );
}

interface StatusBadgeProps {
  status?: SyncStatus;
  isUploading?: boolean;
  uploadProgress?: UploadProgress;
}

function StatusBadge({ status, isUploading, uploadProgress }: StatusBadgeProps) {
  // Show uploading state
  if (isUploading) {
    return <Badge variant="outline" className="text-primary border-primary/30 animate-pulse">Uploading...</Badge>;
  }

  // Show based on upload progress completion state
  if (uploadProgress) {
    if (uploadProgress.step === 'complete') {
      return <Badge className="bg-profit/20 text-profit border-profit/30">Synced</Badge>;
    }
    if (uploadProgress.step === 'partial') {
      return <Badge className="bg-warning/20 text-warning border-warning/30">Partial</Badge>;
    }
    if (uploadProgress.step === 'error') {
      return <Badge variant="destructive">Error</Badge>;
    }
  }

  // Fall back to status from sync_logs
  if (!status) {
    return <Badge variant="outline" className="text-muted-foreground">Not synced</Badge>;
  }

  if (status.status === 'success') {
    return <Badge className="bg-profit/20 text-profit border-profit/30">Synced</Badge>;
  }

  if (status.status === 'partial') {
    return <Badge className="bg-warning/20 text-warning border-warning/30">Partial</Badge>;
  }

  return <Badge variant="destructive">Error</Badge>;
}
