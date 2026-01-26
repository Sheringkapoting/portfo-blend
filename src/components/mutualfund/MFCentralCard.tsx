import { useState } from 'react';
import { motion } from 'framer-motion';
import { Building2, Info, CheckCircle2, RefreshCw, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useMFCASSync } from '@/hooks/useMFCASSync';
import { MFCentralSyncModal } from './MFCentralSyncModal';

export function MFCentralCard() {
  const {
    latestSync,
    isLoadingSync,
    mfHoldings,
  } = useMFCASSync();

  const [showModal, setShowModal] = useState(false);
  const [showSetup, setShowSetup] = useState(false);

  const isCompleted = latestSync?.sync_status === 'completed';
  const isSynced = isCompleted && mfHoldings.length > 0;

  if (isLoadingSync) {
    return (
      <Card className="border-border bg-card/50 backdrop-blur-sm">
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-6 bg-muted rounded w-1/3"></div>
            <div className="h-4 bg-muted rounded w-2/3"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="border-border bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Building2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">Sync Mutual Funds</CardTitle>
                <CardDescription>Connect via MFCentral CAS API</CardDescription>
              </div>
            </div>
            {isSynced ? (
              <Badge className="bg-profit/20 text-profit border-profit/30">Synced</Badge>
            ) : (
              <Badge variant="outline" className="text-muted-foreground">Not synced</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {isSynced ? (
            <>
              <div className="text-sm text-muted-foreground space-y-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-profit" />
                  <span>{mfHoldings.length} mutual fund holdings synced</span>
                </div>
                {latestSync?.last_synced_at && (
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>Last synced: {new Date(latestSync.last_synced_at).toLocaleString('en-IN')}</span>
                  </div>
                )}
              </div>
              
              <Button
                onClick={() => setShowModal(true)}
                className="w-full bg-primary hover:bg-primary/90"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Sync Again
              </Button>
            </>
          ) : (
            <>
              <Alert className="border-primary/20 bg-primary/5">
                <Building2 className="h-4 w-4 text-primary" />
                <AlertTitle className="text-sm">Fetch All MF Holdings</AlertTitle>
                <AlertDescription className="text-xs text-muted-foreground">
                  Sync all your mutual fund holdings across all AMCs using your PAN number.
                </AlertDescription>
              </Alert>

              <Button
                onClick={() => setShowModal(true)}
                className="w-full bg-primary hover:bg-primary/90"
              >
                <Building2 className="h-4 w-4 mr-2" />
                Connect MFCentral CAS
              </Button>
            </>
          )}

          <Button
            variant="ghost"
            size="sm"
            className="w-full text-muted-foreground"
            onClick={() => setShowSetup(!showSetup)}
          >
            <Info className="h-4 w-4 mr-2" />
            {showSetup ? 'Hide' : 'Show'} How it Works
          </Button>

          {showSetup && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="space-y-3 pt-2"
            >
              <Alert>
                <AlertTitle className="text-sm font-medium">How it Works</AlertTitle>
                <AlertDescription className="text-xs space-y-2 mt-2">
                  <ul className="list-disc list-inside space-y-1">
                    <li>Enter your PAN number to fetch all MF holdings across AMCs</li>
                    <li>Verify via OTP sent to your registered phone/email</li>
                    <li>All transactions, folios, and current holdings will be synced</li>
                    <li>Data is fetched from MFCentral's Consolidated Account Statement (CAS)</li>
                  </ul>
                </AlertDescription>
              </Alert>
            </motion.div>
          )}
        </CardContent>
      </Card>

      {showModal && (
        <MFCentralSyncModal onClose={() => setShowModal(false)} />
      )}
    </>
  );
}
