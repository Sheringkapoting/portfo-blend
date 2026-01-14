import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Upload, RefreshCw, CloudDownload, FileSpreadsheet, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface SyncStatus {
  source: string;
  status: string;
  holdings_count: number | null;
  error_message: string | null;
  created_at: string;
}

interface DataSourcePanelProps {
  onSyncZerodha: () => Promise<void>;
  onUploadINDMoney: (file: File) => Promise<void>;
  isSyncing: boolean;
  syncStatus: SyncStatus[];
  lastSync: Date | null;
}

export function DataSourcePanel({
  onSyncZerodha,
  onUploadINDMoney,
  isSyncing,
  syncStatus,
  lastSync,
}: DataSourcePanelProps) {
  const [dragActive, setDragActive] = useState(false);
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

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = e.dataTransfer.files;
    if (files && files[0]) {
      await onUploadINDMoney(files[0]);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files[0]) {
      await onUploadINDMoney(files[0]);
    }
  };

  const getLatestStatus = (source: string) => {
    return syncStatus.find(s => s.source === source);
  };

  const zerodhaStatus = getLatestStatus('Zerodha');
  const indmoneyStatus = getLatestStatus('INDMoney');

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="grid grid-cols-1 md:grid-cols-2 gap-6"
    >
      {/* Zerodha Sync Card */}
      <Card className="border-border bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-500/10">
                <CloudDownload className="h-5 w-5 text-orange-500" />
              </div>
              <div>
                <CardTitle className="text-lg">Zerodha Kite</CardTitle>
                <CardDescription>Sync holdings via Kite API</CardDescription>
              </div>
            </div>
            <StatusBadge status={zerodhaStatus} />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {zerodhaStatus && (
              <div className="text-sm text-muted-foreground">
                {zerodhaStatus.status === 'success' ? (
                  <span className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-profit" />
                    {zerodhaStatus.holdings_count} holdings synced
                  </span>
                ) : (
                  <span className="flex items-center gap-2 text-loss">
                    <XCircle className="h-4 w-4" />
                    {zerodhaStatus.error_message}
                  </span>
                )}
              </div>
            )}
            <Button
              onClick={onSyncZerodha}
              disabled={isSyncing}
              className="w-full bg-orange-500 hover:bg-orange-600"
            >
              {isSyncing ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Sync from Zerodha
            </Button>
          </div>
        </CardContent>
      </Card>

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
            {indmoneyStatus && (
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
              className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${
                dragActive
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/50'
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileChange}
                className="hidden"
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

      {/* Last Sync Info */}
      {lastSync && (
        <div className="md:col-span-2 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-4 w-4" />
          Last synced: {lastSync.toLocaleString('en-IN')}
        </div>
      )}
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
