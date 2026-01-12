
"use client";

export const dynamic = 'force-dynamic';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Eye, EyeOff, Loader2, KeyRound, AlertTriangle, ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import apiClient from '@/lib/api';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

const LoginScreen: React.FC = () => {
  const [emailOrPhone, setEmailOrPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPinDialog, setShowPinDialog] = useState(false);
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [isSettingPin, setIsSettingPin] = useState(false);
  const [showExpirationDialog, setShowExpirationDialog] = useState(false);
  const [expiredDevices, setExpiredDevices] = useState<Array<{id: number; name: string}>>([]);
  const [nearExpireDevices, setNearExpireDevices] = useState<Array<{id: number; name: string; daysRemaining: number}>>([]);
  const [isLoadingDevices, setIsLoadingDevices] = useState(false);
  const { toast } = useToast();
  const { login, isPinSet, setPin: setPinVault } = useAuth();
  const router = useRouter();

  // Helper function to validate phone number format
  const isValidPhoneNumber = (value: string): boolean => {
    // Phone number should be 11 digits starting with 0
    const phoneRegex = /^0\d{10}$/;
    return phoneRegex.test(value);
  };

  // Helper function to detect if input is email or phone
  const isEmail = (value: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    // Validate input
    if (!emailOrPhone || !password) {
      setIsLoading(false);
      setError('Email aur password zaroori hai');
      toast({ variant: 'destructive', title: 'Validation Error', description: 'Email aur password zaroori hai' });
      return;
    }

    // Validate phone number format if it's not an email
    if (!isEmail(emailOrPhone) && !isValidPhoneNumber(emailOrPhone)) {
      setIsLoading(false);
      setError('Sahi email ya phone number enter karain (03001234567 format)');
      toast({ variant: 'destructive', title: 'Validation Error', description: 'Sahi email ya phone number enter karain' });
      return;
    }

    // Quick offline check before calling API
    if (!navigator.onLine) {
      setIsLoading(false);
      setError('Internet connection nahi hai. Barae meharbani internet check karain.');
      toast({ variant: 'destructive', title: 'No Internet', description: 'Please check your connection.' });
      return;
    }

    const success = await login(emailOrPhone, password);

    if (success) {
      // Always show PIN dialog after successful login
      // This allows setting new PIN or updating existing PIN
      setShowPinDialog(true);
    } else {
      // Show more helpful error if likely a network problem
      if (!navigator.onLine) {
        setError('Internet connection nahi hai. Barae meharbani internet check karain.');
        toast({ variant: 'destructive', title: 'No Internet', description: 'Please check your connection.' });
      } else {
        setError('Ghalat email/phone number ya password');
        toast({ variant: "destructive", title: "Login Error", description: "Ghalat email/phone number ya password" });
      }
    }

    setIsLoading(false);
  };

  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate PIN
    if (!pin || pin.length < 4) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "PIN kam se kam 4 digits ka hona chahiye",
      });
      return;
    }

    if (pin !== confirmPin) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "PINs match nahi kar rahe. Dobara check karain.",
      });
      return;
    }

    setIsSettingPin(true);
    try {
      // setPin will clear old PIN vault if exists and create new one with current credentials
      const success = await setPinVault(pin);
      
      if (success) {
        toast({
          title: "Success",
          description: isPinSet ? "PIN update ho gaya hai" : "PIN set ho gaya hai",
        });
        setShowPinDialog(false);
        setPin('');
        setConfirmPin('');
        // Check for expired/near-expire devices before navigating
        await checkDeviceExpiration();
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: "PIN set karne mein error aaya",
        });
      }
    } catch (error) {
      console.error("Failed to set PIN:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "PIN set karne mein error aaya",
      });
    } finally {
      setIsSettingPin(false);
    }
  };

  const handleSkipPin = async () => {
    // Skip PIN setup and proceed to home
    setShowPinDialog(false);
    setPin('');
    setConfirmPin('');
    toast({
      title: "Login Successful",
      description: "Aap successfully login ho gaye hain",
    });
    // Check for expired/near-expire devices before navigating
    await checkDeviceExpiration();
  };

  const checkDeviceExpiration = async () => {
    setIsLoadingDevices(true);
    try {
      const response = await apiClient.get('/devices');
      const devices = response.data as Array<{id: number; name: string; expirationTime?: string}>;
      
      const now = Date.now();
      const expired: Array<{id: number; name: string}> = [];
      const nearExpire: Array<{id: number; name: string; daysRemaining: number}> = [];
      
      // 30 days threshold for near-expire
      const NEAR_EXPIRE_THRESHOLD_MS = 30 * 24 * 60 * 60 * 1000;
      
      devices.forEach((device) => {
        if (!device.expirationTime) return;
        
        const expirationTime = Date.parse(device.expirationTime);
        if (Number.isNaN(expirationTime)) return;
        
        const timeUntilExpiration = expirationTime - now;
        
        if (timeUntilExpiration <= 0) {
          // Device is expired
          expired.push({ id: device.id, name: device.name });
        } else if (timeUntilExpiration <= NEAR_EXPIRE_THRESHOLD_MS) {
          // Device is near expiration (within 30 days)
          const daysRemaining = Math.ceil(timeUntilExpiration / (24 * 60 * 60 * 1000));
          nearExpire.push({ id: device.id, name: device.name, daysRemaining });
        }
      });
      
      setExpiredDevices(expired);
      setNearExpireDevices(nearExpire);
      
      // Show dialog if there are expired or near-expire devices
      if (expired.length > 0 || nearExpire.length > 0) {
        setShowExpirationDialog(true);
      } else {
        // No expired devices, proceed to home
        router.push('/home');
      }
    } catch (error) {
      console.error("Failed to check device expiration:", error);
      // If check fails, proceed to home anyway
      router.push('/home');
    } finally {
      setIsLoadingDevices(false);
    }
  };

  const handleRenewDevice = (deviceName: string) => {
    const msg = encodeURIComponent(`how can i pay for ${deviceName}`);
    const url = `https://wa.me/923234402200?text=${msg}`;
    window.open(url, '_blank');
  };

  const handleContinueToHome = () => {
    setShowExpirationDialog(false);
    router.push('/home');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-primary/10 via-background to-secondary">
      <Card className="w-full max-w-md p-8 card-mobile">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <Image src="/logo.png" alt="AL-MUHAFIZ TRACKERS Logo" width={150} height={150} style={{ objectFit: 'contain' }} priority />
          </div>
          <p className="text-muted-foreground mt-2" style={{ fontFamily: "'Noto Naskh Arabic', serif", fontSize: '1.1rem' }}>
            جہاں اعتماد، وہاں المحافظ ٹریکرز
          </p>
        </div>

        {isPinSet && (
          <Button variant="outline" className="w-full h-12 mb-4 text-lg" onClick={() => router.push('/pin-login')}>
            <KeyRound className="mr-2 h-5 w-5" />
            Use PIN Login
          </Button>
        )}

        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-6">
          {error && (
            <Alert variant="destructive">
              <AlertDescription className="roman-urdu">
                {error}
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="emailOrPhone" className="roman-urdu">
              Email ya Phone Number
            </Label>
            <Input
              id="emailOrPhone"
              name="emailOrPhone"
              type="text"
              autoComplete="username"
              value={emailOrPhone}
              onChange={(e) => setEmailOrPhone(e.target.value)}
              placeholder="example@email.com ya 03001234567"
              required
              className="h-12"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="roman-urdu">
              Password
            </Label>
            <div className="relative">
              <Input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="h-12 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          

          <Button
            type="submit"
            disabled={isLoading || !emailOrPhone || !password}
            className="w-full h-12 btn-primary roman-urdu text-lg font-semibold"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Login ho rahe hain...
              </>
            ) : (
              'Login karain'
            )}
          </Button>
        </form>

        <div className="relative my-4 flex items-center">
            <div className="flex-grow border-t border-muted-foreground/20"></div>
            <span className="flex-shrink mx-4 text-xs text-muted-foreground uppercase">Or</span>
            <div className="flex-grow border-t border-muted-foreground/20"></div>
        </div>

        <Link href="https://wa.me/923234402200?text=%D8%A7%D9%84%D8%B3%D9%84%D8%A7%D9%85%20%D8%B9%D9%84%D9%8A%D9%83%D9%85%20%D9%85%D9%8A%DA%BA%20%D9%B9%D8%B1%D9%8A%DA%A9%D8%B1%20%D9%84%DA%AF%D9%88%D8%A7%D9%86%D8%A7%20%DA%86%D8%A7%DB%81%D8%AA%D8%A7%20%DB%81%D9%88%DA%BA" target="_blank" rel="noopener noreferrer" className="w-full">
            <Button variant="outline" className="w-full h-12 text-lg">
                Apply Connection
            </Button>
        </Link>
        

        {/* Footer */}
        <div className="text-center mt-6 text-sm text-muted-foreground roman-urdu">
          AL-MUHAFIZ | Secure Vehicle Tracking
        </div>
      </Card>

      {/* PIN Dialog - Always shown after successful login */}
      <Dialog open={showPinDialog} onOpenChange={(open) => {
        if (!open && !isSettingPin) {
          handleSkipPin();
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="roman-urdu">
              {isPinSet ? 'PIN Update Karain' : 'PIN Set Karain'}
            </DialogTitle>
            <DialogDescription className="roman-urdu">
              {isPinSet 
                ? 'Agli baar asani se login karne ke liye apna naya PIN enter karain. Purana PIN clear ho jayega.'
                : 'Agli baar asani se login karne ke liye apna PIN set karain.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handlePinSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pin" className="roman-urdu">
                Security PIN
              </Label>
              <Input
                id="pin"
                type="password"
                maxLength={8}
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="••••"
                required
                autoComplete="new-password"
                className="h-12 text-center text-2xl tracking-[0.5em]"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-pin" className="roman-urdu">
                PIN Dobara Enter Karain
              </Label>
              <Input
                id="confirm-pin"
                type="password"
                maxLength={8}
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value)}
                placeholder="••••"
                required
                autoComplete="new-password"
                className="h-12 text-center text-2xl tracking-[0.5em]"
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleSkipPin}
                disabled={isSettingPin}
              >
                Skip
              </Button>
              <Button
                type="submit"
                disabled={isSettingPin || !pin || pin.length < 4 || pin !== confirmPin}
              >
                {isSettingPin ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Setting...
                  </>
                ) : (
                  isPinSet ? 'Update' : 'Set PIN'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Device Expiration Warning Dialog */}
      <AlertDialog open={showExpirationDialog} onOpenChange={(open) => {
        if (!open && !isLoadingDevices) {
          handleContinueToHome();
        }
      }}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Device Expiration Warning
            </AlertDialogTitle>
            <AlertDialogDescription>
              Aap ke kuch devices expire ho chuke hain ya jald expire honge. Inhe renew karne ke liye WhatsApp par contact karein.
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <div className="space-y-4 max-h-[400px] overflow-y-auto">
            {expiredDevices.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-semibold text-destructive text-sm">Expired Devices ({expiredDevices.length}):</h4>
                <div className="space-y-2">
                  {expiredDevices.map((device) => (
                    <div key={device.id} className="flex items-center justify-between p-2 bg-red-50 dark:bg-red-950/20 rounded-md border border-red-200 dark:border-red-800">
                      <span className="text-sm font-medium text-foreground">{device.name}</span>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-7"
                        onClick={() => handleRenewDevice(device.name)}
                      >
                        Renew
                        <ExternalLink className="ml-1 h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {nearExpireDevices.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-semibold text-yellow-600 dark:text-yellow-500 text-sm">
                  Near to Expire ({nearExpireDevices.length}):
                </h4>
                <div className="space-y-2">
                  {nearExpireDevices.map((device) => (
                    <div key={device.id} className="flex items-center justify-between p-2 bg-yellow-50 dark:bg-yellow-950/20 rounded-md border border-yellow-200 dark:border-yellow-800">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-foreground">{device.name}</span>
                        <span className="text-xs text-muted-foreground">{device.daysRemaining} days remaining</span>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-7"
                        onClick={() => handleRenewDevice(device.name)}
                      >
                        Renew
                        <ExternalLink className="ml-1 h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLoadingDevices}>Later</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleContinueToHome}
              disabled={isLoadingDevices}
              className="bg-primary text-primary-foreground"
            >
              Continue to Home
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default LoginScreen;
