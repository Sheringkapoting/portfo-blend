import { useState } from 'react';
import { motion } from 'framer-motion';
import { Building2, Phone, Mail, Lock, CheckCircle2, Loader2, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useMFCASSync } from '@/hooks/useMFCASSync';
import { Badge } from '@/components/ui/badge';

export function MFCASSyncPanel() {
  const {
    latestSync,
    isLoadingSync,
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

  const syncStatus = latestSync?.sync_status;
  const isOTPSent = syncStatus === 'otp_sent';
  const isVerified = syncStatus === 'verified';
  const isSyncing = syncStatus === 'syncing';
  const isCompleted = syncStatus === 'completed';

  if (isLoadingSync) {
    return (
      <Card className="bg-card/50">
        <CardContent className="p-8 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="bg-card/50 border-primary/20">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle>Sync Mutual Funds</CardTitle>
              <CardDescription>
                Connect via MFCentral CAS API
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Step 1: Enter PAN and Request OTP */}
          {!isOTPSent && !isVerified && !isCompleted && (
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
                    <RadioGroupItem value="phone" id="phone" />
                    <Label htmlFor="phone" className="flex items-center gap-2 cursor-pointer">
                      <Phone className="h-4 w-4" />
                      Phone
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="email" id="email" />
                    <Label htmlFor="email" className="flex items-center gap-2 cursor-pointer">
                      <Mail className="h-4 w-4" />
                      Email
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {otpMethod === 'phone' && (
                <div className="space-y-2">
                  <Label htmlFor="phone-input">Phone Number</Label>
                <Input
                    id="phone-input"
                    placeholder="Enter 10-digit mobile number"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    maxLength={10}
                  />
                </div>
              )}

              {otpMethod === 'email' && (
                <div className="space-y-2">
                  <Label htmlFor="email-input">Email Address</Label>
                  <Input
                    id="email-input"
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="nickname">Add Nickname (Optional)</Label>
                <Input
                  id="nickname"
                  placeholder="My Portfolio"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                />
              </div>

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
                <Label htmlFor="otp">Enter OTP</Label>
                <Input
                  id="otp"
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
          {isVerified && !isCompleted && (
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
                <p className="text-sm text-muted-foreground mb-4">
                  Successfully synced {mfHoldings.length} mutual fund holdings
                </p>
                <Badge variant="outline" className="bg-background">
                  Last synced: {latestSync?.last_synced_at ? new Date(latestSync.last_synced_at).toLocaleString('en-IN') : 'Just now'}
                </Badge>
              </div>

              <Button
                onClick={() => {
                  setPan('');
                  setPhone('');
                  setEmail('');
                  setOtp('');
                  setOtpReference('');
                  setNickname('');
                }}
                variant="outline"
                className="w-full"
              >
                Sync Another PAN
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
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="bg-muted/30">
        <CardContent className="p-4">
          <h4 className="font-medium text-sm mb-2">How it works</h4>
          <ul className="text-xs text-muted-foreground space-y-1">
            <li>• Enter your PAN number to fetch all MF holdings across AMCs</li>
            <li>• Verify via OTP sent to your registered phone/email</li>
            <li>• All transactions, folios, and current holdings will be synced</li>
            <li>• Data is fetched from MFCentral's Consolidated Account Statement (CAS)</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
