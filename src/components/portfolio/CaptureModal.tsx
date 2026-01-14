import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, Upload, Check, AlertCircle, FileSpreadsheet, TrendingUp, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface CaptureModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCaptureComplete: () => void;
  availableSources: { source: string; count: number }[];
}

const ASSET_TYPES = [
  { id: 'Stock', label: 'Equities', icon: '📈' },
  { id: 'Mutual Fund', label: 'Mutual Funds', icon: '📊' },
  { id: 'US Stock', label: 'US Stocks', icon: '🇺🇸' },
  { id: 'EPF', label: 'EPF', icon: '🏦' },
  { id: 'PPF', label: 'PPF', icon: '💰' },
  { id: 'NPS', label: 'NPS', icon: '📋' },
  { id: 'Bond', label: 'Bonds', icon: '📜' },
  { id: 'SGB', label: 'Gold Bonds', icon: '🥇' },
];

export function CaptureModal({
  open,
  onOpenChange,
  onCaptureComplete,
  availableSources,
}: CaptureModalProps) {
  const [selectedSources, setSelectedSources] = useState<string[]>(
    availableSources.map(s => s.source)
  );
  const [selectedAssetTypes, setSelectedAssetTypes] = useState<string[]>(
    ASSET_TYPES.map(a => a.id)
  );
  const [isCapturing, setIsCapturing] = useState(false);
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const toggleSource = (source: string) => {
    setSelectedSources(prev =>
      prev.includes(source)
        ? prev.filter(s => s !== source)
        : [...prev, source]
    );
  };

  const toggleAssetType = (assetType: string) => {
    setSelectedAssetTypes(prev =>
      prev.includes(assetType)
        ? prev.filter(a => a !== assetType)
        : [...prev, assetType]
    );
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setExcelFile(file);
    }
  };

  const handleCapture = async () => {
    setIsCapturing(true);
    try {
      // If there's an uploaded Excel file, parse it first
      if (excelFile) {
        const formData = new FormData();
        formData.append('file', excelFile);
        
        const { error: parseError } = await supabase.functions.invoke('parse-indmoney', {
          body: formData,
        });
        
        if (parseError) {
          console.error('Excel parse error:', parseError);
          toast.error('Failed to parse Excel file');
        }
      }

      // Capture snapshot with filters
      const { data, error } = await supabase.functions.invoke('capture-snapshot', {
        body: {
          sources: selectedSources.length > 0 ? selectedSources : undefined,
          assetTypes: selectedAssetTypes.length > 0 ? selectedAssetTypes : undefined,
        },
      });

      if (error) throw error;

      if (data.success) {
        toast.success(data.message || 'Snapshot captured successfully');
        onCaptureComplete();
        onOpenChange(false);
      } else {
        toast.error(data.error || 'Failed to capture snapshot');
      }
    } catch (error: any) {
      console.error('Capture error:', error);
      toast.error(error.message || 'Failed to capture snapshot');
    } finally {
      setIsCapturing(false);
      setExcelFile(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            Capture Portfolio Snapshot
          </DialogTitle>
          <DialogDescription>
            Select sources and asset types to include in this snapshot
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Data Sources */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Data Sources</Label>
            <div className="grid grid-cols-2 gap-2">
              {availableSources.map(({ source, count }) => (
                <motion.div
                  key={source}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <div
                    className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedSources.includes(source)
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    }`}
                    onClick={() => toggleSource(source)}
                  >
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={selectedSources.includes(source)}
                        onCheckedChange={() => toggleSource(source)}
                      />
                      <span className="text-sm font-medium">{source}</span>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {count}
                    </Badge>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Asset Types */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Asset Classes</Label>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs"
                onClick={() =>
                  setSelectedAssetTypes(
                    selectedAssetTypes.length === ASSET_TYPES.length
                      ? []
                      : ASSET_TYPES.map(a => a.id)
                  )
                }
              >
                {selectedAssetTypes.length === ASSET_TYPES.length
                  ? 'Deselect All'
                  : 'Select All'}
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {ASSET_TYPES.map(asset => (
                <motion.div
                  key={asset.id}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <div
                    className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors ${
                      selectedAssetTypes.includes(asset.id)
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    }`}
                    onClick={() => toggleAssetType(asset.id)}
                  >
                    <Checkbox
                      checked={selectedAssetTypes.includes(asset.id)}
                      onCheckedChange={() => toggleAssetType(asset.id)}
                    />
                    <span className="text-lg">{asset.icon}</span>
                    <span className="text-sm">{asset.label}</span>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Excel Upload Option */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Include New Data (Optional)</Label>
            <div
              className={`flex items-center gap-3 p-3 rounded-lg border-2 border-dashed cursor-pointer transition-colors ${
                excelFile
                  ? 'border-profit bg-profit/5'
                  : 'border-border hover:border-primary/50'
              }`}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileChange}
                className="hidden"
              />
              {excelFile ? (
                <>
                  <Check className="h-5 w-5 text-profit" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{excelFile.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Will be parsed before snapshot
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <FileSpreadsheet className="h-5 w-5 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="text-sm">Upload Excel file</p>
                    <p className="text-xs text-muted-foreground">
                      Import new holdings before capture
                    </p>
                  </div>
                  <Upload className="h-4 w-4 text-muted-foreground" />
                </>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleCapture}
            disabled={isCapturing || (selectedSources.length === 0 && !excelFile)}
          >
            {isCapturing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Capturing...
              </>
            ) : (
              <>
                <Camera className="h-4 w-4 mr-2" />
                Capture Snapshot
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
