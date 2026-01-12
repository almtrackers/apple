
"use client";

export const dynamic = 'force-dynamic';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

const PinLoginScreen: React.FC = () => {
  const [pin, setPin] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const { toast } = useToast();
  const { loginWithPin } = useAuth();
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    const success = await loginWithPin(pin);

    if (success) {
      toast({
        title: "Login Successful",
        description: "Aap PIN ke zariye login ho gaye hain.",
      });
      router.replace('/home');
    } else {
      setError('Ghalat PIN. Dobara koshish karain.');
      toast({
        variant: "destructive",
        title: "Login Error",
        description: "Aapka PIN ghalat hai.",
      });
    }

    setIsLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-primary/10 via-background to-secondary">
      <Card className="w-full max-w-md p-8 card-mobile">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <Image src="/logo.png" alt="AL-MUHAFIZ TRACKERS Logo" width={150} height={150} style={{ objectFit: 'contain' }} priority />
          </div>
          <p className="text-muted-foreground mt-2 roman-urdu">
            Apna PIN enter karain
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          {error && (
            <Alert variant="destructive">
              <AlertDescription className="roman-urdu">{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="pin" className="roman-urdu">
              Security PIN
            </Label>
            <Input
              id="pin"
              name="pin"
              type="password"
              maxLength={8}
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="••••"
              required
              autoComplete="current-password"
              className="h-12 text-center text-2xl tracking-[0.5em]"
            />
          </div>

          <Button
            type="submit"
            disabled={isLoading || !pin}
            className="w-full h-12 btn-primary roman-urdu text-lg font-semibold"
          >
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Login'}
          </Button>
        </form>

        <div className="text-center mt-6">
          <Button variant="link" onClick={() => router.push('/login')}>
            Email aur Password se login karain
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default PinLoginScreen;
