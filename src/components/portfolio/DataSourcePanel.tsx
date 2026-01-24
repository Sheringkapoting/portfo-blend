import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, FileSpreadsheet, CheckCircle2, XCircle, Clock, Building2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { KiteConnectCard } from './KiteConnectCard';
import { BrokerPlaceholderCard, AVAILABLE_BROKERS } from './BrokerPlaceholderCard';
import { UploadProgressIndicator, UploadStep } from './UploadProgressIndicator';
import { useKiteSession } from '@/hooks/useKiteSession';
import { MFCASSyncPanel } from '@/components/mutualfund/MFCASSyncPanel';

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
  onUploadINDMoney: (file: File) => Promise<{ success: boolean; holdings_count?: number; error?: string }>;
  isSyncing: boolean;
  syncStatus: SyncStatus[];
  lastSync: Date | null;
  syncProgress?: SyncProgress;
}

export function DataSourcePanel({
  onSyncZerodha,
  onUploadINDMoney,
  isSyncing,
  syncStatus,
  lastSync,
  syncProgress,
}: DataSourcePanelProps) {
  const [dragActive, setDragActive] = useState(false);
  const [uploadStep, setUploadStep] = useState<UploadStep>('idle');
  const [uploadMessage, setUploadMessage] = useState('');
  const [uploadedHoldingsCount, setUploadedHoldingsCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleUpload = async (file: File) => {
    try {
      // Step 1: Uploading
      setUploadStep('uploading');
      setUploadMessage(`Uploading ${file.name}...`);
      
      // Small delay to show the uploading state
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Step 2: Parsing
      setUploadStep('parsing');
      setUploadMessage('Parsing Excel file...');
      
      // Step 3: Syncing (this is where the actual upload happens)
      setUploadStep('syncing');
      setUploadMessage('Syncing holdings to database...');
      
      const result = await onUploadINDMoney(file);
      
      if (result.success) {
        setUploadStep('complete');
        setUploadedHoldingsCount(result.holdings_count || 0);
        setUploadMessage(`Successfully imported ${result.holdings_count || 0} holdings!`);
        
        // Reset after 3 seconds
        setTimeout(() => {
          setUploadStep('idle');
          setUploadMessage('');
        }, 3000);
      } else {
        setUploadStep('error');
        setUploadMessage(result.error || 'Failed to import holdings');
        
        // Reset after 5 seconds
        setTimeout(() => {
          setUploadStep('idle');
          setUploadMessage('');
        }, 5000);
      }
    } catch (error: any) {
      setUploadStep('error');
      setUploadMessage(error.message || 'Upload failed');
      
      setTimeout(() => {
        setUploadStep('idle');
        setUploadMessage('');
      }, 5000);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = e.dataTransfer.files;
    if (files && files[0]) {
      await handleUpload(files[0]);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files[0]) {
      await handleUpload(files[0]);
    }
    // Reset the input so the same file can be uploaded again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const getLatestStatus = (source: string) => {
    return syncStatus.find(s => s.source === source);
  };

  const zerodhaStatus = getLatestStatus('Zerodha');
  const indmoneyStatus = getLatestStatus('INDMoney');

  const isUploading = uploadStep !== 'idle' && uploadStep !== 'complete' && uploadStep !== 'error';

  return (
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
                <StatusBadge status={indmoneyStatus} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Show upload progress or status */}
                <AnimatePresence mode="wait">
                  {uploadStep !== 'idle' ? (
                    <UploadProgressIndicator 
                      step={uploadStep} 
                      message={uploadMessage}
                      holdingsCount={uploadedHoldingsCount}
                    />
                  ) : indmoneyStatus ? (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-sm text-muted-foreground"
                    >
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
                    </motion.div>
                  ) : null}
                </AnimatePresence>

                <div
                  className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${
                    isUploading ? 'opacity-50 pointer-events-none' :
                    dragActive
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  }`}
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
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
              </div>
            </CardContent>
          </Card>

          {/* Mutual Fund CAS Sync Card */}
          <div className="md:col-span-2 lg:col-span-1">
            <MFCASSyncPanel />
          </div>
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
  );
}

function StatusBadge({ status }: { status?: SyncStatus }) {
  if (!status) {
    return <Badge variant="outline" className="text-muted-foreground">Not synced</Badge>;
  }

  if (status.status === 'success') {
    return <Badge className="bg-profit/20 text-profit border-profit/30">Synced</Badge>;
  }

  return <Badge variant="destructive">Error</Badge>;
}
