import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ExternalLink, CheckCircle2, AlertCircle, RefreshCw, Info, CloudDownload, LogOut, Clock, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { useKiteSession } from '@/hooks/useKiteSession';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface KiteConnectCardProps {
  onSyncZerodha: () => Promise<void>;
  isSyncing: boolean;
  zerodhaStatus?: {
    status: string;
    holdings_count: number | null;
    error_message: string | null;
  };
}

export function KiteConnectCard({ onSyncZerodha, isSyncing, zerodhaStatus }: KiteConnectCardProps) {
  const {
    session,
    isLoading,
    isSessionValid,
    loginUrl,
    loginUrlError,
    disconnectSession,
    isDisconnecting,
    sessionExpiresIn,
  } = useKiteSession();
  
  const [showSetup, setShowSetup] = useState(false);

  const handleLogin = () => {
    if (loginUrl) {
      window.location.href = loginUrl;
    }
  };

  if (isLoading) {
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
    <Card className="border-border bg-card/50 backdrop-blur-sm">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-orange-500/10">
              <CloudDownload className="h-5 w-5 text-orange-500" />
            </div>
            <div>
              <CardTitle className="text-lg">Zerodha Kite</CardTitle>
              <CardDescription>Connect via Kite Connect API</CardDescription>
            </div>
          </div>
          {isSessionValid ? (
            <Badge className="bg-profit/20 text-profit border-profit/30">Connected</Badge>
          ) : session ? (
            <Badge variant="destructive">Expired</Badge>
          ) : (
            <Badge variant="outline" className="text-muted-foreground">Not connected</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isSessionValid ? (
          <>
            <div className="text-sm text-muted-foreground space-y-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-profit" />
                <span>Session active</span>
              </div>
              {sessionExpiresIn && (
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span>Expires in {sessionExpiresIn}</span>
                </div>
              )}
              {zerodhaStatus?.status === 'success' && (
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-profit" />
                  <span>{zerodhaStatus.holdings_count} holdings synced</span>
                </div>
              )}
            </div>
            
            <div className="flex gap-2">
              <Button
                onClick={onSyncZerodha}
                disabled={isSyncing}
                className="flex-1 bg-orange-500 hover:bg-orange-600"
              >
                {isSyncing ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Sync Holdings
              </Button>
              
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    disabled={isDisconnecting}
                    className="shrink-0"
                  >
                    {isDisconnecting ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <LogOut className="h-4 w-4" />
                    )}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Disconnect Zerodha?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will terminate your Zerodha session. Your synced holdings will remain, but you'll need to reconnect to sync again.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={disconnectSession}>
                      Disconnect
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>

            <Alert className="border-muted bg-muted/20">
              <Shield className="h-4 w-4 text-muted-foreground" />
              <AlertDescription className="text-xs text-muted-foreground">
                Your Zerodha credentials are never stored. The session token expires daily for security.
              </AlertDescription>
            </Alert>
          </>
        ) : (
          <>
            {loginUrlError ? (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle className="text-sm">Configuration Error</AlertTitle>
                <AlertDescription className="text-xs">
                  {loginUrlError}
                </AlertDescription>
              </Alert>
            ) : (
              <Alert className="border-orange-500/20 bg-orange-500/5">
                <AlertCircle className="h-4 w-4 text-orange-500" />
                <AlertTitle className="text-sm">Daily Login Required</AlertTitle>
                <AlertDescription className="text-xs text-muted-foreground">
                  Kite tokens expire daily for security. Click below to connect your Zerodha account securely.
                </AlertDescription>
              </Alert>
            )}
            
            <Button
              onClick={handleLogin}
              disabled={!loginUrl}
              className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              {loginUrl ? 'Connect Zerodha' : 'Loading...'}
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="w-full text-muted-foreground"
              onClick={() => setShowSetup(!showSetup)}
            >
              <Info className="h-4 w-4 mr-2" />
              {showSetup ? 'Hide' : 'Show'} Setup Instructions
            </Button>

            {showSetup && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="space-y-3 pt-2"
              >
                <Alert>
                  <AlertTitle className="text-sm font-medium">Kite Connect Setup</AlertTitle>
                  <AlertDescription className="text-xs space-y-2 mt-2">
                    <ol className="list-decimal list-inside space-y-1">
                      <li>Go to <a href="https://developers.kite.trade/" target="_blank" rel="noopener noreferrer" className="text-primary underline">developers.kite.trade</a></li>
                      <li>Create a new app (₹2000/month subscription required)</li>
                      <li>Set Redirect URL to:<br/>
                        <code className="text-xs bg-muted px-1 py-0.5 rounded break-all">
                          {import.meta.env.VITE_SUPABASE_URL}/functions/v1/kite-callback
                        </code>
                      </li>
                      <li>Copy your API Key and API Secret</li>
                      <li>Add them to project secrets as KITE_API_KEY and KITE_API_SECRET</li>
                    </ol>
                  </AlertDescription>
                </Alert>
              </motion.div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

