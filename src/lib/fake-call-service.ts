/**
 * Fake Call Service
 * Simulates incoming phone calls for critical alerts
 * ONLY WORKS ON MOBILE DEVICES (Capacitor)
 */

import { Capacitor } from '@capacitor/core';

export interface FakeCallConfig {
  callerName: string;
  callerNumber: string;
  alertType: 'batteryCutoff' | 'geofenceExit' | 'proximity';
  deviceName?: string;
  deviceId?: number;
  message?: string;
}

class FakeCallService {
  private static instance: FakeCallService;
  private activeCall: FakeCallConfig | null = null;
  private listeners: Set<(call: FakeCallConfig | null) => void> = new Set();
  private ringtoneAudio: HTMLAudioElement | null = null;
  private isRinging = false;
  private declinedCooldowns: Map<number, number> = new Map(); // deviceId -> timestamp
  private autoAnswerTimeout: NodeJS.Timeout | null = null;

  private constructor() {
    // Only initialize ringtone in browser environment
    if (typeof window !== 'undefined') {
      // Preload ringtone (optional - can use system sound)
      this.initializeRingtone();
    }
  }

  static getInstance(): FakeCallService {
    if (!FakeCallService.instance) {
      FakeCallService.instance = new FakeCallService();
    }
    return FakeCallService.instance;
  }

  private initializeRingtone() {
    // Only initialize in browser environment
    if (typeof window === 'undefined' || typeof Audio === 'undefined') {
      return;
    }
    
    try {
      // Try to load a ringtone file, fallback to system beep
      this.ringtoneAudio = new Audio();
      this.ringtoneAudio.loop = true;
      this.ringtoneAudio.volume = 0.8;
      // You can add a ringtone.mp3 file in public folder
      // this.ringtoneAudio.src = '/ringtone.mp3';
    } catch (error) {
      console.warn('[FakeCall] Could not initialize ringtone:', error);
    }
  }

  /**
   * Start a fake call
   * Only works on mobile devices (Capacitor)
   */
  startCall(config: FakeCallConfig): void {
    // Only work on mobile devices
    const platform = Capacitor.getPlatform();
    if (platform === 'web') {
      console.log('[FakeCall] Fake calls only work on mobile devices. Current platform:', platform);
      return;
    }

    // Check cooldown if deviceId is provided
    if (config.deviceId) {
      const lastDeclined = this.declinedCooldowns.get(config.deviceId);
      if (lastDeclined) {
        const cooldownMs = 15 * 60 * 1000; // 15 minutes
        const timeSinceDeclined = Date.now() - lastDeclined;
        if (timeSinceDeclined < cooldownMs) {
          const remainingMinutes = Math.ceil((cooldownMs - timeSinceDeclined) / 60000);
          console.log(`[FakeCall] Call declined recently for device ${config.deviceId}, cooldown active. Remaining: ${remainingMinutes} minutes`);
          return;
        }
        // Cooldown expired, remove it
        this.declinedCooldowns.delete(config.deviceId);
      }
    }

    console.log('[FakeCall] Starting fake call:', {
      platform,
      callerName: config.callerName,
      alertType: config.alertType,
      deviceName: config.deviceName,
      deviceId: config.deviceId,
    });

    // Don't start if there's already an active call
    if (this.activeCall) {
      console.log('[FakeCall] Call already in progress, ignoring new call');
      return;
    }

    // Clear any existing auto-answer timeout
    if (this.autoAnswerTimeout) {
      clearTimeout(this.autoAnswerTimeout);
      this.autoAnswerTimeout = null;
    }

    this.activeCall = config;
    console.log('[FakeCall] Call state set, notifying listeners. Active call:', this.activeCall);
    console.log('[FakeCall] Config received:', JSON.stringify(config, null, 2));
    console.log('[FakeCall] this.activeCall after assignment:', this.activeCall);
    this.notifyListeners();
    this.startRinging();
  }

  /**
   * Answer the call (now triggers engine stop command externally)
   */
  answerCall(): void {
    if (!this.activeCall) return;
    this.stopRinging();
    // Don't auto-end the call - let user manually end it after engine stop
  }

  /**
   * Decline the call
   */
  declineCall(): void {
    if (!this.activeCall) return;
    
    // Set cooldown for this device (15 minutes)
    if (this.activeCall.deviceId) {
      this.declinedCooldowns.set(this.activeCall.deviceId, Date.now());
      console.log(`[FakeCall] Call declined for device ${this.activeCall.deviceId}, cooldown set for 15 minutes`);
    }
    
    this.stopRinging();
    this.endCall();
  }

  /**
   * End the call
   */
  endCall(): void {
    this.stopRinging();
    this.activeCall = null;
    this.notifyListeners();
  }

  /**
   * Get current active call
   */
  getActiveCall(): FakeCallConfig | null {
    return this.activeCall;
  }

  /**
   * Check if there's an active call
   */
  hasActiveCall(): boolean {
    return this.activeCall !== null;
  }

  /**
   * Subscribe to call state changes
   */
  subscribe(listener: (call: FakeCallConfig | null) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    console.log('[FakeCall] Notifying listeners. Count:', this.listeners.size, 'Active call:', this.activeCall);
    this.listeners.forEach((listener, index) => {
      try {
        console.log(`[FakeCall] Calling listener ${index}`);
        listener(this.activeCall);
      } catch (error) {
        console.error(`[FakeCall] Listener ${index} error:`, error);
      }
    });
  }

  private startRinging(): void {
    if (this.isRinging) return;
    this.isRinging = true;

    // Play ringtone
    if (this.ringtoneAudio && this.ringtoneAudio.src) {
      this.ringtoneAudio.play().catch(error => {
        console.warn('[FakeCall] Could not play ringtone:', error);
        this.playSystemRingtone();
      });
    } else {
      this.playSystemRingtone();
    }

    // Vibrate if available (mobile)
    if ('vibrate' in navigator) {
      const vibratePattern = [200, 100, 200, 100, 200]; // Vibrate pattern
      navigator.vibrate(vibratePattern);
    }
  }

  private stopRinging(): void {
    if (!this.isRinging) return;
    this.isRinging = false;

    if (this.ringtoneAudio) {
      this.ringtoneAudio.pause();
      this.ringtoneAudio.currentTime = 0;
    }

    // Stop vibration
    if ('vibrate' in navigator) {
      navigator.vibrate(0);
    }
  }

  private playSystemRingtone(): void {
    // Only play in browser environment
    if (typeof window === 'undefined' || (typeof window.AudioContext === 'undefined' && typeof (window as any).webkitAudioContext === 'undefined')) {
      return;
    }
    
    // Fallback: Create a simple beep pattern
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = 800; // Frequency in Hz
      oscillator.type = 'sine';

      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);

      // Repeat every 2 seconds while ringing
      if (this.isRinging) {
        setTimeout(() => this.playSystemRingtone(), 2000);
      }
    } catch (error) {
      console.warn('[FakeCall] Could not play system ringtone:', error);
    }
  }

  /**
   * Generate caller name and number based on alert type
   */
  static generateCallerInfo(alertType: string, deviceName?: string): { name: string; number: string } {
    const randomNumber = () => Math.floor(Math.random() * 9000) + 1000;

    switch (alertType) {
      case 'batteryCutoff':
        return {
          name: deviceName ? `${deviceName} Alert` : 'Vehicle Alert',
          number: `+92-300-${randomNumber()}-${randomNumber()}`,
        };
      case 'geofenceExit':
        return {
          name: deviceName ? `${deviceName} Security` : 'Security Alert',
          number: `+92-321-${randomNumber()}-${randomNumber()}`,
        };
      case 'proximity':
        return {
          name: deviceName ? `${deviceName} Proximity` : 'Proximity Alert',
          number: `+92-333-${randomNumber()}-${randomNumber()}`,
        };
      default:
        return {
          name: 'Alert Service',
          number: `+92-300-${randomNumber()}-${randomNumber()}`,
        };
    }
  }
}

// Lazy initialization to avoid SSR issues
let _fakeCallServiceInstance: FakeCallService | null = null;

const getFakeCallService = () => {
  if (typeof window === 'undefined') {
    // Return a mock service for SSR that does nothing
    return {
      startCall: () => {},
      answerCall: () => {},
      declineCall: () => {},
      endCall: () => {},
      getActiveCall: () => null,
      hasActiveCall: () => false,
      subscribe: () => () => {},
    } as any;
  }
  
  if (!_fakeCallServiceInstance) {
    _fakeCallServiceInstance = FakeCallService.getInstance();
  }
  return _fakeCallServiceInstance;
};

// Use a Proxy to ensure lazy initialization and proper method binding
export const fakeCallService = new Proxy({} as FakeCallService, {
  get(_target, prop) {
    const instance = getFakeCallService();
    const value = instance[prop as keyof FakeCallService];
    // Bind methods to maintain 'this' context
    if (typeof value === 'function') {
      return value.bind(instance);
    }
    return value;
  }
});
export { FakeCallService };

// Expose test function for debugging (can be called from browser console)
if (typeof window !== 'undefined') {
  (window as any).testFakeCall = (alertType: 'batteryCutoff' | 'geofenceExit' | 'proximity' = 'batteryCutoff') => {
    console.log('[FakeCall] Test function called with alertType:', alertType);
    const callerInfo = FakeCallService.generateCallerInfo(alertType, 'Test Vehicle');
    getFakeCallService().startCall({
      callerName: callerInfo.name,
      callerNumber: callerInfo.number,
      alertType: alertType,
      deviceName: 'Test Vehicle',
      message: `Test ${alertType} alert`,
    });
  };
}

