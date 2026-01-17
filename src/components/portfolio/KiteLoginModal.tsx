import { motion } from 'framer-motion';
import { ExternalLink, AlertCircle, Shield, CloudDownload, CheckCircle2, X, FileSpreadsheet, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface KiteLoginModalProps {
  loginUrl: string | null;
  loginUrlError: string | null;
  isLoading: boolean;
  onDismiss?: () => void;
  onSkipToExcel?: () => void;
}

export function KiteLoginModal({ loginUrl, loginUrlError, isLoading, onDismiss, onSkipToExcel }: KiteLoginModalProps) {
  const handleLogin = () => {
    if (loginUrl) {
      window.location.href = loginUrl;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        className="w-full max-w-md mx-4 relative"
      >
        {/* Dismiss button */}
        {onDismiss && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onDismiss}
            className="absolute -top-2 -right-2 z-10 rounded-full bg-muted hover:bg-muted/80"
          >
            <X className="h-4 w-4" />
          </Button>
        )}

        <Card className="border-border bg-card shadow-2xl">
          <CardHeader className="text-center space-y-4">
            <div className="mx-auto p-4 rounded-2xl bg-orange-500/10 w-fit">
              <CloudDownload className="h-10 w-10 text-orange-500" />
            </div>
            <div>
              <CardTitle className="text-2xl">Connect Your Portfolio</CardTitle>
              <CardDescription className="mt-2">
                Choose how you'd like to import your portfolio holdings
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Zerodha Option */}
            <div className="space-y-4">
              <div className="text-sm font-medium text-foreground">Option 1: Zerodha Kite (Recommended)</div>
              <div className="space-y-2 pl-4 border-l-2 border-orange-500/30">
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <CheckCircle2 className="h-4 w-4 text-profit shrink-0" />
                  <span>Real-time portfolio sync</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <CheckCircle2 className="h-4 w-4 text-profit shrink-0" />
                  <span>Automatic P&L calculations</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <CheckCircle2 className="h-4 w-4 text-profit shrink-0" />
                  <span>Daily session refresh for security</span>
                </div>
              </div>

              {/* Security note */}
              <Alert className="border-primary/20 bg-primary/5">
                <Shield className="h-4 w-4 text-primary" />
                <AlertTitle className="text-sm">Secure Connection</AlertTitle>
                <AlertDescription className="text-xs text-muted-foreground">
                  We use Zerodha's official OAuth 2.0 API. Your credentials are never stored on our servers.
                </AlertDescription>
              </Alert>

              {/* Error state */}
              {loginUrlError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle className="text-sm">Configuration Error</AlertTitle>
                  <AlertDescription className="text-xs">
                    {loginUrlError}
                  </AlertDescription>
                </Alert>
              )}

              {/* Login button */}
              <Button
                onClick={handleLogin}
                disabled={!loginUrl || isLoading}
                className="w-full h-12 text-lg bg-orange-500 hover:bg-orange-600 disabled:opacity-50"
              >
                {isLoading ? (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    className="h-5 w-5 border-2 border-white border-t-transparent rounded-full"
                  />
                ) : (
                  <>
                    <ExternalLink className="h-5 w-5 mr-2" />
                    Connect with Zerodha
                  </>
                )}
              </Button>
            </div>

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">or</span>
              </div>
            </div>

            {/* Alternative Options */}
            <div className="space-y-3">
              <div className="text-sm font-medium text-foreground">Option 2: Upload Excel File</div>
              
              <Button
                variant="outline"
                onClick={onSkipToExcel}
                className="w-full h-12 gap-2"
              >
                <FileSpreadsheet className="h-5 w-5 text-green-500" />
                Upload INDMoney / Kite Excel
              </Button>
              
              <p className="text-xs text-muted-foreground text-center">
                Import holdings from INDMoney, Kite, or other brokers via Excel export
              </p>
            </div>

            {/* Skip option */}
            {onDismiss && (
              <Button
                variant="ghost"
                onClick={onDismiss}
                className="w-full text-muted-foreground hover:text-foreground"
              >
                Skip for now - I'll explore the demo first
              </Button>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
