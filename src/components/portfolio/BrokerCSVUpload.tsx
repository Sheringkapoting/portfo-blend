import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Building2, Upload, FileSpreadsheet, CheckCircle2, XCircle, Loader2, Info } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface BrokerInfo {
  name: string;
  description: string;
  color: string;
  exportInstructions: string[];
  acceptedFormats: string;
}

const BROKERS: Record<string, BrokerInfo> = {
  'angel': {
    name: 'Angel One',
    description: 'Import from Angel One portfolio export',
    color: 'text-red-400',
    exportInstructions: [
      'Login to Angel One app or website',
      'Go to Portfolio → Holdings',
      'Click Export/Download button',
      'Select CSV or Excel format',
      'Upload the downloaded file here',
    ],
    acceptedFormats: '.csv,.xlsx,.xls',
  },
  'groww': {
    name: 'Groww',
    description: 'Import from Groww portfolio export',
    color: 'text-emerald-400',
    exportInstructions: [
      'Login to Groww app or website',
      'Go to Investments → Stocks',
      'Click on Download Report',
      'Select Portfolio Statement',
      'Upload the downloaded file here',
    ],
    acceptedFormats: '.csv,.xlsx,.xls',
  },
};

interface BrokerCSVUploadProps {
  brokerId: keyof typeof BROKERS;
  onUpload: (file: File, broker: string) => Promise<void>;
  delay?: number;
  syncStatus?: {
    status: string;
    holdings_count: number | null;
    error_message: string | null;
  };
}

export function BrokerCSVUpload({ brokerId, onUpload, delay = 0, syncStatus }: BrokerCSVUploadProps) {
  const broker = BROKERS[brokerId];
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showInstructions, setShowInstructions] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  if (!broker) return null;

  const handleUpload = async (file: File) => {
    setIsUploading(true);
    setUploadProgress(20);

    try {
      setUploadProgress(50);
      await onUpload(file, broker.name);
      setUploadProgress(100);
      
      setTimeout(() => {
        setIsUploading(false);
        setUploadProgress(0);
      }, 2000);
    } catch (error) {
      console.error('Upload error:', error);
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

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
      await handleUpload(files[0]);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files[0]) {
      await handleUpload(files[0]);
    }
  };

  return (
    <TooltipProvider>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay }}
      >
        <Card className="border-border bg-card/50 backdrop-blur-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Building2 className={`h-5 w-5 ${broker.color}`} />
                </div>
                <div>
                  <CardTitle className="text-lg">{broker.name}</CardTitle>
                  <CardDescription>{broker.description}</CardDescription>
                </div>
              </div>
              {isUploading ? (
                <Badge className="bg-primary/20 text-primary border-primary/30">
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  Importing
                </Badge>
              ) : syncStatus?.status === 'success' ? (
                <Badge className="bg-profit/20 text-profit border-profit/30">Synced</Badge>
              ) : syncStatus?.status === 'error' ? (
                <Badge variant="destructive">Error</Badge>
              ) : (
                <Badge variant="outline" className="text-muted-foreground">Manual Import</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Upload Progress */}
            {isUploading && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Importing holdings...
                  </span>
                  <span className="text-muted-foreground">{uploadProgress}%</span>
                </div>
                <Progress value={uploadProgress} className="h-2" />
              </div>
            )}

            {/* Status Display */}
            {!isUploading && syncStatus && (
              <div className="text-sm text-muted-foreground">
                {syncStatus.status === 'success' ? (
                  <span className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-profit" />
                    {syncStatus.holdings_count} holdings imported
                  </span>
                ) : (
                  <span className="flex items-center gap-2 text-loss">
                    <XCircle className="h-4 w-4" />
                    {syncStatus.error_message}
                  </span>
                )}
              </div>
            )}

            {/* Drag & Drop Zone */}
            <div
              className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors ${
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
                accept={broker.acceptedFormats}
                onChange={handleFileChange}
                className="hidden"
                disabled={isUploading}
              />
              {isUploading ? (
                <Loader2 className="h-6 w-6 mx-auto mb-2 text-muted-foreground animate-spin" />
              ) : (
                <Upload className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
              )}
              <p className="text-sm text-muted-foreground">
                {isUploading 
                  ? 'Processing...'
                  : dragActive
                    ? 'Drop the file here'
                    : 'Upload portfolio CSV/Excel'}
              </p>
            </div>

            {/* Instructions Toggle */}
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-muted-foreground"
              onClick={() => setShowInstructions(!showInstructions)}
            >
              <Info className="h-4 w-4 mr-2" />
              {showInstructions ? 'Hide' : 'Show'} Export Instructions
            </Button>

            {showInstructions && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
              >
                <Alert>
                  <AlertDescription className="text-xs space-y-2">
                    <ol className="list-decimal list-inside space-y-1">
                      {broker.exportInstructions.map((step, i) => (
                        <li key={i}>{step}</li>
                      ))}
                    </ol>
                  </AlertDescription>
                </Alert>
              </motion.div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </TooltipProvider>
  );
}

export const SUPPORTED_BROKERS = Object.keys(BROKERS) as Array<keyof typeof BROKERS>;
