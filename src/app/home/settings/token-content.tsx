
"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Info } from "lucide-react";

const TOKEN_STORAGE_KEY = 'traccar_websocket_token';

export default function TokenContentPage() {
  const { toast } = useToast();
  const [token, setToken] = useState('');
  const [savedToken, setSavedToken] = useState<string | null>(null);

  useEffect(() => {
    const storedToken = localStorage.getItem(TOKEN_STORAGE_KEY);
    setSavedToken(storedToken);
  }, []);

  const handleSaveToken = () => {
    if (!token) {
        toast({
            variant: "destructive",
            title: "Error",
            description: "Token cannot be empty."
        });
        return;
    }
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
    setSavedToken(token);
    setToken('');
    toast({
        title: "Success",
        description: "WebSocket token has been saved. The app will use this new token on the next refresh."
    });
  }

  const handleClearToken = () => {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    setSavedToken(null);
    toast({
        title: "Success",
        description: "WebSocket token has been cleared."
    });
  }

  const getMaskedToken = (t: string | null) => {
    if (!t) return "Not set";
    return t.substring(0, 4) + '...'.repeat(Math.min(3, t.length - 8)) + t.substring(t.length - 4);
  }

  return (
    <div className="space-y-6 p-6 pt-0">
        <Card>
            <CardHeader>
                <CardTitle>WebSocket API Token</CardTitle>
                <CardDescription>
                    Manually enter a token from your Traccar server to be used for WebSocket connections.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                 <Alert>
                    <Info className="h-4 w-4" />
                    <AlertTitle>Information</AlertTitle>
                    <AlertDescription>
                        This token will ONLY be used for the real-time WebSocket connection. All other app functions will continue to use your login credentials. You may need to refresh the application for the change to take effect.
                    </AlertDescription>
                </Alert>

                <div className="space-y-2">
                    <Label htmlFor="token-input">New Token</Label>
                    <div className="flex gap-2">
                        <Input 
                            id="token-input"
                            type="text"
                            placeholder="Enter your Traccar token"
                            value={token}
                            onChange={(e) => setToken(e.target.value)}
                        />
                        <Button onClick={handleSaveToken}>Save</Button>
                    </div>
                </div>

                <div className="space-y-2">
                    <Label>Currently Saved Token</Label>
                    <div className="flex items-center justify-between p-3 rounded-md bg-muted text-muted-foreground">
                        <span className="font-mono text-sm">{getMaskedToken(savedToken)}</span>
                        {savedToken && (
                             <Button variant="destructive" size="sm" onClick={handleClearToken}>Clear</Button>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    </div>
  );
}

    