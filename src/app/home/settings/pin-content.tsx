
"use client";

import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Lock, Loader2, ShieldCheck, ShieldOff } from "lucide-react";

export default function PinContentPage() {
    const { isPinSet, setPin, clearPin } = useAuth();
    const { toast } = useToast();
    const [newPin, setNewPin] = useState('');
    const [confirmPin, setConfirmPin] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSetPin = async () => {
        if (newPin.length < 4) {
            toast({ variant: "destructive", title: "Error", description: "PIN must be at least 4 digits." });
            return;
        }
        if (newPin !== confirmPin) {
            toast({ variant: "destructive", title: "Error", description: "PINs do not match." });
            return;
        }
        setIsLoading(true);
        const success = await setPin(newPin);
        if (success) {
            toast({ title: "Success", description: "Your PIN has been set successfully." });
            setNewPin('');
            setConfirmPin('');
        } else {
            toast({ variant: "destructive", title: "Error", description: "Failed to set PIN. Make sure you are logged in." });
        }
        setIsLoading(false);
    };

    const handleClearPin = () => {
        clearPin();
        toast({ title: "Success", description: "Your PIN has been removed." });
    };

    return (
        <div className="space-y-6 p-6 pt-0">
            <Card>
                <CardHeader>
                    <CardTitle>PIN Settings</CardTitle>
                    <CardDescription>
                        {isPinSet
                            ? "Change or remove your secure login PIN."
                            : "Set up a secure PIN for faster access to your account."
                        }
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {isPinSet ? (
                        <div className="space-y-4">
                             <Alert variant="default" className="border-green-500 text-green-700">
                                <ShieldCheck className="h-4 w-4 !text-green-500" />
                                <AlertTitle>PIN is Active</AlertTitle>
                                <AlertDescription>
                                    Your account is secured with a PIN. You can now change it below or remove it.
                                </AlertDescription>
                            </Alert>
                             <h3 className="font-medium">Change PIN</h3>
                             <div className="space-y-2">
                                <Label htmlFor="new-pin">New PIN</Label>
                                <Input
                                    id="new-pin"
                                    type="password"
                                    maxLength={8}
                                    value={newPin}
                                    onChange={(e) => setNewPin(e.target.value)}
                                    placeholder="Enter new 4-8 digit PIN"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="confirm-new-pin">Confirm New PIN</Label>
                                <Input
                                    id="confirm-new-pin"
                                    type="password"
                                    maxLength={8}
                                    value={confirmPin}
                                    onChange={(e) => setConfirmPin(e.target.value)}
                                    placeholder="Confirm new PIN"
                                />
                            </div>
                            <div className="flex flex-col sm:flex-row gap-2">
                                <Button onClick={handleSetPin} disabled={isLoading || !newPin || !confirmPin}>
                                    {isLoading ? <Loader2 className="animate-spin" /> : <Lock />}
                                    Update PIN
                                </Button>
                                <Button variant="destructive" onClick={handleClearPin}>
                                    <ShieldOff />
                                    Remove PIN
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <Alert>
                                <Lock className="h-4 w-4" />
                                <AlertTitle>Set a Login PIN</AlertTitle>
                                <AlertDescription>
                                    Create a PIN to log in to your account without needing your password every time. Your credentials will be encrypted using this PIN.
                                </AlertDescription>
                            </Alert>
                             <div className="space-y-2">
                                <Label htmlFor="pin">New PIN</Label>
                                <Input
                                    id="pin"
                                    type="password"
                                    maxLength={8}
                                    value={newPin}
                                    onChange={(e) => setNewPin(e.target.value)}
                                    placeholder="Enter a 4-8 digit PIN"
                                    autoComplete="new-password"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="confirm-pin">Confirm PIN</Label>
                                <Input
                                    id="confirm-pin"
                                    type="password"
                                    maxLength={8}
                                    value={confirmPin}
                                    onChange={(e) => setConfirmPin(e.target.value)}
                                    placeholder="Confirm your PIN"
                                    autoComplete="new-password"
                                />
                            </div>
                            <Button onClick={handleSetPin} disabled={isLoading || !newPin || !confirmPin}>
                                {isLoading ? <Loader2 className="animate-spin" /> : <ShieldCheck />}
                                Set Secure PIN
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
