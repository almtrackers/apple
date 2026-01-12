/**
 * Fake Call Overlay Component
 * Displays a realistic phone call UI overlay
 */

"use client";

import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { fakeCallService, FakeCallConfig } from '@/lib/fake-call-service';
import { Phone, PhoneOff, Volume2, Power } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useWebSocketSafe } from '@/contexts/websocket-context';
import { useToast } from '@/hooks/use-toast';
import PasswordDialog from '@/components/home/password-dialog';

export default function FakeCallOverlay() {
  const [activeCall, setActiveCall] = useState<FakeCallConfig | null>(null);
  const [isAnswering, setIsAnswering] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  
  // Safely get WebSocket context - may not be available in root layout
  const wsContext = useWebSocketSafe();
  const devices = wsContext?.devices || {};
  
  const { toast } = useToast();

  // Check platform after mount (avoid SSR issues)
  useEffect(() => {
    setIsMobile(Capacitor.getPlatform() !== 'web');
    console.log('[FakeCallOverlay] Platform:', Capacitor.getPlatform());
  }, []);

  // Set up subscription - must be called unconditionally (Rules of Hooks)
  useEffect(() => {
    // Only set up subscription on mobile devices
    if (!isMobile) {
      return;
    }

    console.log('[FakeCallOverlay] Setting up subscription');
    
    // Get initial call state
    const initialCall = fakeCallService.getActiveCall();
    if (initialCall) {
      console.log('[FakeCallOverlay] Found initial active call:', initialCall);
      setActiveCall(initialCall);
    }
    
    const unsubscribe = fakeCallService.subscribe((call) => {
      console.log('[FakeCallOverlay] Received call update:', call);
      setActiveCall(call);
      setIsAnswering(false);
    });

    console.log('[FakeCallOverlay] Subscription set up');

    return unsubscribe;
  }, [isMobile]);

  // Only render on mobile devices - moved after all hooks
  if (!isMobile) {
    return null;
  }

  const handleEngineStop = () => {
    if (!activeCall?.deviceId) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Device information not available",
      });
      return;
    }

    const device = devices[activeCall.deviceId];
    if (!device) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Device not found",
      });
      return;
    }

    setIsAnswering(true);
    fakeCallService.answerCall();
    setShowPasswordDialog(true);
  };

  const handleDecline = () => {
    fakeCallService.declineCall();
  };

  const handlePasswordDialogClose = () => {
    setShowPasswordDialog(false);
    // End call after password dialog closes
    setTimeout(() => {
      fakeCallService.endCall();
      setIsAnswering(false);
    }, 500);
  };

  if (!activeCall) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[9999] bg-black/95 flex items-center justify-center">
      <Card className="w-full max-w-sm mx-4 bg-gradient-to-b from-gray-900 to-black text-white border-gray-800">
        <div className="p-8 text-center space-y-6">
          {/* Caller Avatar */}
          <div className="flex justify-center">
            <div className="w-32 h-32 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-4xl font-bold shadow-lg">
              {activeCall.callerName.charAt(0).toUpperCase()}
            </div>
          </div>

          {/* Caller Info */}
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold">{activeCall.callerName}</h2>
            <p className="text-gray-400 text-lg">{activeCall.callerNumber}</p>
            {activeCall.deviceName && (
              <p className="text-sm text-gray-500 mt-2">{activeCall.deviceName}</p>
            )}
          </div>

          {/* Status */}
          {isAnswering ? (
            <div className="space-y-2">
              <p className="text-green-400 font-medium">Engine Stop Command</p>
              {activeCall.message && (
                <p className="text-sm text-gray-300">{activeCall.message}</p>
              )}
              <p className="text-xs text-gray-400 mt-2">Enter device password to confirm</p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-blue-400 font-medium animate-pulse">Incoming Call</p>
              <div className="flex items-center justify-center gap-2 text-sm text-gray-400">
                <Volume2 className="h-4 w-4 animate-pulse" />
                <span>Ringing...</span>
              </div>
            </div>
          )}

          {/* Alert Type Badge */}
          <div className="pt-4">
            <span className="inline-block px-3 py-1 text-xs font-medium rounded-full bg-red-500/20 text-red-300 border border-red-500/30">
              {activeCall.alertType === 'batteryCutoff' && '🔋 Battery Cutoff Alert'}
              {activeCall.alertType === 'geofenceExit' && '📍 Geofence Exit Alert'}
              {activeCall.alertType === 'proximity' && '📍 Proximity Alert'}
            </span>
          </div>

          {/* Action Buttons */}
          {!isAnswering && (
            <div className="flex justify-center gap-6 pt-6">
              {/* Decline Button */}
              <Button
                onClick={handleDecline}
                className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 text-white shadow-lg"
                size="icon"
              >
                <PhoneOff className="h-6 w-6" />
              </Button>

              {/* Engine Stop Button */}
              <Button
                onClick={handleEngineStop}
                className="w-16 h-16 rounded-full bg-orange-500 hover:bg-orange-600 text-white shadow-lg animate-pulse"
                size="icon"
              >
                <Power className="h-6 w-6" />
              </Button>
            </div>
          )}

        </div>
      </Card>

      {/* Password Dialog for Engine Stop */}
      {activeCall?.deviceId && devices[activeCall.deviceId] && (
        <PasswordDialog
          open={showPasswordDialog}
          onOpenChange={handlePasswordDialogClose}
          commandType="engineStop"
          device={devices[activeCall.deviceId]}
        />
      )}
    </div>
  );
}

