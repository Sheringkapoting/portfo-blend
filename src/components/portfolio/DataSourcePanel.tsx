import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Upload, FileSpreadsheet, CheckCircle2, XCircle, Clock, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { KiteConnectCard } from './KiteConnectCard';
import { BrokerCSVUpload, SUPPORTED_BROKERS } from './BrokerCSVUpload';
import { KiteLoginModal } from './KiteLoginModal';
import { useKiteSession } from '@/hooks/useKiteSession';

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
  onUploadBrokerCSV: (file: File, broker: string) => Promise<void>;
  isSyncing: boolean;
  syncStatus: SyncStatus[];
  lastSync: Date | null;
  showMandatoryKiteLogin?: boolean;
  syncProgress?: SyncProgress;
}

export function DataSourcePanel({
  onSyncZerodha,
  onUploadINDMoney,
  onUploadBrokerCSV,
  isSyncing,
  syncStatus,
  lastSync,
  showMandatoryKiteLogin = false,
  syncProgress,
}: DataSourcePanelProps) {
  const [dragActive, setDragActive] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'processing' | 'complete' | 'error'>('idle');
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

  const handleUploadWithProgress = async (file: File) => {
    setIsUploading(true);
    setUploadStatus('uploading');
    setUploadProgress(10);

    try {
      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev < 40) return prev + 10;
          return prev;
        });
      }, 200);

      setUploadProgress(50);
      setUploadStatus('processing');

      await onUploadINDMoney(file);

      clearInterval(progressInterval);
      setUploadProgress(100);
      setUploadStatus('complete');

      // Reset after showing completion
      setTimeout(() => {
        setIsUploading(false);
        setUploadProgress(0);
        setUploadStatus('idle');
      }, 2000);
    } catch (error) {
      setUploadStatus('error');
      setTimeout(() => {
        setIsUploading(false);
        setUploadProgress(0);
        setUploadStatus('idle');
      }, 3000);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = e.dataTransfer.files;
    if (files && files[0]) {
      await handleUploadWithProgress(files[0]);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files[0]) {
      await handleUploadWithProgress(files[0]);
    }
  };

  const getLatestStatus = (source: string) => {
    return syncStatus.find(s => s.source === source);
  };

  const zerodhaStatus = getLatestStatus('Zerodha');
  const indmoneyStatus = getLatestStatus('INDMoney');

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
                  <div className="p-2 rounded-lg bg-primary/10">
                    <FileSpreadsheet className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">INDMoney</CardTitle>
                    <CardDescription>Upload Holdings Report Excel</CardDescription>
                  </div>
                </div>
                <StatusBadge status={indmoneyStatus} isUploading={isUploading} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Upload Progress Indicator */}
                {isUploading && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2 text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {uploadStatus === 'uploading' && 'Uploading file...'}
                        {uploadStatus === 'processing' && 'Processing holdings...'}
                        {uploadStatus === 'complete' && 'Import complete!'}
                        {uploadStatus === 'error' && 'Upload failed'}
                      </span>
                      <span className="text-muted-foreground">{uploadProgress}%</span>
                    </div>
                    <Progress value={uploadProgress} className="h-2" />
                  </div>
                )}

                {!isUploading && indmoneyStatus && (
                  <div className="text-sm text-muted-foreground">
                    {indmoneyStatus.status === 'success' ? (
                      <span className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-profit" />
                        {indmoneyStatus.holdings_count} holdings imported
                      </span>
                    ) : (
                      <span className="flex items-center gap-2 text-loss">
                        <XCircle className="h-4 w-4" />
                        {indmoneyStatus.error_message}
                      </span>
                    )}
                  </div>
                )}
                
                <div
                  className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                    isUploading 
                      ? 'border-muted bg-muted/5 cursor-not-allowed opacity-50' 
                      : dragActive
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50 cursor-pointer'
                  }`}
                  onDragEnter={!isUploading ? handleDrag : undefined}
                  onDragLeave={!isUploading ? handleDrag : undefined}
                  onDragOver={!isUploading ? handleDrag : undefined}
                  onDrop={!isUploading ? handleDrop : undefined}
                  onClick={() => !isUploading && fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleFileChange}
                    className="hidden"
                    disabled={isUploading}
                  />
                  {isUploading ? (
                    <Loader2 className="h-8 w-8 mx-auto mb-2 text-muted-foreground animate-spin" />
                  ) : (
                    <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  )}
                  <p className="text-sm text-muted-foreground">
                    {isUploading 
                      ? 'Processing your file...'
                      : dragActive
                        ? 'Drop the file here'
                        : 'Drag & drop or click to upload'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Indmoney-HoldingsReport*.xlsx
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Other Brokers - CSV Import */}
        <div className="mt-8">
          <div className="mb-4">
            <h3 className="text-md font-medium text-muted-foreground">Other Brokers</h3>
            <p className="text-sm text-muted-foreground/70">Import holdings from other brokers via CSV/Excel export</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {SUPPORTED_BROKERS.map((brokerId, index) => (
              <BrokerCSVUpload
                key={brokerId}
                brokerId={brokerId}
                onUpload={onUploadBrokerCSV}
                delay={0.1 + index * 0.05}
                syncStatus={getLatestStatus(brokerId === 'angel' ? 'Angel One' : 'Groww')}
              />
            ))}
          </div>
        </div>
      </motion.div>
    </>
  );
}

function StatusBadge({ status, isUploading }: { status?: SyncStatus; isUploading?: boolean }) {
  if (isUploading) {
    return (
      <Badge className="bg-primary/20 text-primary border-primary/30">
        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
        Syncing
      </Badge>
    );
  }

  if (!status) {
    return <Badge variant="outline" className="text-muted-foreground">Not synced</Badge>;
  }

  if (status.status === 'success') {
    return <Badge className="bg-profit/20 text-profit border-profit/30">Synced</Badge>;
  }

  return <Badge variant="destructive">Error</Badge>;
}
