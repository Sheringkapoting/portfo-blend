import { motion } from 'framer-motion';
import { ExternalLink, AlertCircle, Shield, CloudDownload, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface KiteLoginModalProps {
  loginUrl: string | null;
  loginUrlError: string | null;
  isLoading: boolean;
}

export function KiteLoginModal({ loginUrl, loginUrlError, isLoading }: KiteLoginModalProps) {
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
        className="w-full max-w-md mx-4"
      >
        <Card className="border-border bg-card shadow-2xl">
          <CardHeader className="text-center space-y-4">
            <div className="mx-auto p-4 rounded-2xl bg-orange-500/10 w-fit">
              <CloudDownload className="h-10 w-10 text-orange-500" />
            </div>
            <div>
              <CardTitle className="text-2xl">Connect Zerodha Kite</CardTitle>
              <CardDescription className="mt-2">
                Link your Zerodha account to sync your portfolio holdings automatically
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Features list */}
            <div className="space-y-3">
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

            <p className="text-center text-xs text-muted-foreground">
              You'll be redirected to Zerodha's login page
            </p>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
