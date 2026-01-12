import { registerPlugin } from '@capacitor/core';

export interface FakeCallPlugin {
  startFakeCall(options: {
    callerName: string;
    callerNumber: string;
    alertType: string;
    deviceName: string;
    message: string;
  }): Promise<{ success: boolean }>;
}

export const FakeCallWeb = registerPlugin<FakeCallPlugin>('FakeCall', {
  web: () => import('./fake-call-service').then(m => ({
    startFakeCall: async (options) => {
      // Web fallback - use JavaScript fake call
      const { fakeCallService } = await import('./fake-call-service');
      fakeCallService.startCall({
        callerName: options.callerName,
        callerNumber: options.callerNumber,
        alertType: options.alertType as any,
        deviceName: options.deviceName,
        message: options.message,
      });
      return { success: true };
    },
  })),
});

