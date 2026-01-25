import { useState } from 'react';
import { motion } from 'framer-motion';
import { Building2, Phone, Mail, Lock, CheckCircle2, Loader2, TrendingUp, X, Shield } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useMFCASSync } from '@/hooks/useMFCASSync';

interface MFCentralSyncModalProps {
  onClose: () => void;
}

export function MFCentralSyncModal({ onClose }: MFCentralSyncModalProps) {
  const {
    latestSync,
    requestOTP,
    isRequestingOTP,
    verifyOTP,
    isVerifyingOTP,
    fetchCAS,
    isFetchingCAS,
    mfHoldings,
  } = useMFCASSync();

  const [pan, setPan] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [otpMethod, setOtpMethod] = useState<'phone' | 'email'>('phone');
  const [otp, setOtp] = useState('');
  const [nickname, setNickname] = useState('');
  const [otpReference, setOtpReference] = useState('');

  const handleRequestOTP = () => {
    if (!pan || pan.length !== 10) {
      return;
    }

    if (otpMethod === 'phone' && !phone) {
      return;
    }

    if (otpMethod === 'email' && !email) {
      return;
    }

    requestOTP({
      pan: pan.toUpperCase(),
      phone: otpMethod === 'phone' ? phone : undefined,
      email: otpMethod === 'email' ? email : undefined,
      otp_method: otpMethod,
      time_period: 'since_last_update',
      nickname: nickname || undefined,
    });
  };

  const handleVerifyOTP = () => {
    if (!otp || !otpReference) {
      return;
    }

    verifyOTP({
      pan: pan.toUpperCase(),
      otp,
      otp_reference: otpReference,
    });
  };

  const handleFetchCAS = () => {
    if (!otpReference) {
      return;
    }

    fetchCAS({
      pan: pan.toUpperCase(),
      otp_reference: otpReference,
      time_period: 'since_last_update',
    });
  };

  const handleReset = () => {
    setPan('');
    setPhone('');
    setEmail('');
    setOtp('');
    setOtpReference('');
    setNickname('');
  };

  const syncStatus = latestSync?.sync_status;
  const isOTPSent = syncStatus === 'otp_sent';
  const isVerified = syncStatus === 'verified';
  const isSyncing = syncStatus === 'syncing';
  const isCompleted = syncStatus === 'completed';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        className="w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto"
      >
        <Card className="border-border bg-card shadow-2xl">
          <CardHeader className="relative">
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-4 top-4"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-primary/10">
                <Building2 className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-xl">Connect MFCentral CAS</CardTitle>
                <CardDescription>
                  Sync all your mutual fund holdings
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Step 1: Enter PAN and Request OTP */}
            {!isOTPSent && !isVerified && !isCompleted && !isSyncing && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <Label htmlFor="pan">PAN Number</Label>
                  <Input
                    id="pan"
                    placeholder="ABCDE1234F"
                    value={pan}
                    onChange={(e) => setPan(e.target.value.toUpperCase())}
                    maxLength={10}
                    className="uppercase"
                  />
                </div>

                <div className="space-y-2">
                  <Label>OTP via</Label>
                  <RadioGroup value={otpMethod} onValueChange={(value) => setOtpMethod(value as 'phone' | 'email')}>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="phone" id="modal-phone" />
                      <Label htmlFor="modal-phone" className="flex items-center gap-2 cursor-pointer">
                        <Phone className="h-4 w-4" />
                        Phone
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="email" id="modal-email" />
                      <Label htmlFor="modal-email" className="flex items-center gap-2 cursor-pointer">
                        <Mail className="h-4 w-4" />
                        Email
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                {otpMethod === 'phone' && (
                  <div className="space-y-2">
                    <Label htmlFor="modal-phone-input">Phone Number</Label>
                    <Input
                      id="modal-phone-input"
                      placeholder="Enter 10-digit mobile number"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      maxLength={10}
                    />
                  </div>
                )}

                {otpMethod === 'email' && (
                  <div className="space-y-2">
                    <Label htmlFor="modal-email-input">Email Address</Label>
                    <Input
                      id="modal-email-input"
                      type="email"
                      placeholder="your@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="modal-nickname">Add Nickname (Optional)</Label>
                  <Input
                    id="modal-nickname"
                    placeholder="My Portfolio"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                  />
                </div>

                <Alert className="border-primary/20 bg-primary/5">
                  <Shield className="h-4 w-4 text-primary" />
                  <AlertTitle className="text-sm">Secure Connection</AlertTitle>
                  <AlertDescription className="text-xs text-muted-foreground">
                    Your PAN is used only to fetch MF holdings via MFCentral's official API.
                  </AlertDescription>
                </Alert>

                <Button
                  onClick={handleRequestOTP}
                  disabled={isRequestingOTP || !pan || (otpMethod === 'phone' ? !phone : !email)}
                  className="w-full"
                >
                  {isRequestingOTP ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Requesting OTP...
                    </>
                  ) : (
                    'Request OTP'
                  )}
                </Button>
              </motion.div>
            )}

            {/* Step 2: Verify OTP */}
            {isOTPSent && !isVerified && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                <div className="p-4 bg-primary/10 rounded-lg border border-primary/20">
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <span>OTP sent to your {otpMethod === 'phone' ? 'phone' : 'email'}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="modal-otp">Enter OTP</Label>
                  <Input
                    id="modal-otp"
                    placeholder="Enter 6-digit OTP"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    maxLength={6}
                  />
                </div>

                <Button
                  onClick={handleVerifyOTP}
                  disabled={isVerifyingOTP || !otp}
                  className="w-full"
                >
                  {isVerifyingOTP ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    <>
                      <Lock className="h-4 w-4 mr-2" />
                      Verify OTP
                    </>
                  )}
                </Button>
              </motion.div>
            )}

            {/* Step 3: Fetch CAS Data */}
            {isVerified && !isCompleted && !isSyncing && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                <div className="p-4 bg-profit/10 rounded-lg border border-profit/20">
                  <div className="flex items-center gap-2 text-sm text-profit">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>OTP verified successfully!</span>
                  </div>
                </div>

                <Button
                  onClick={handleFetchCAS}
                  disabled={isFetchingCAS}
                  className="w-full"
                >
                  {isFetchingCAS ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Syncing Mutual Funds...
                    </>
                  ) : (
                    <>
                      <TrendingUp className="h-4 w-4 mr-2" />
                      Fetch Mutual Fund Data
                    </>
                  )}
                </Button>
              </motion.div>
            )}

            {/* Syncing State */}
            {isSyncing && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-6 text-center"
              >
                <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-3" />
                <h3 className="font-semibold text-lg mb-2">Syncing Mutual Funds...</h3>
                <p className="text-sm text-muted-foreground">
                  Please wait while we fetch your mutual fund data from MFCentral
                </p>
              </motion.div>
            )}

            {/* Completed State */}
            {isCompleted && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                <div className="p-6 bg-profit/10 rounded-lg border border-profit/20 text-center">
                  <CheckCircle2 className="h-12 w-12 text-profit mx-auto mb-3" />
                  <h3 className="font-semibold text-lg mb-2">Sync Completed!</h3>
                  <p className="text-sm text-muted-foreground">
                    Successfully synced {mfHoldings.length} mutual fund holdings
                  </p>
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={() => {
                      handleReset();
                    }}
                    variant="outline"
                    className="flex-1"
                  >
                    Sync Another PAN
                  </Button>
                  <Button onClick={onClose} className="flex-1">
                    Done
                  </Button>
                </div>
              </motion.div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
