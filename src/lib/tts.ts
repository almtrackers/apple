import { Capacitor } from '@capacitor/core';

type SpeakOptions = {
  text: string;
  locale?: string;
  rate?: number;
  pitch?: number;
};

/**
 * Cross-platform TTS (Web + Native-safe).
 * NOTE: Capacitor v6 has NO official TTS plugin.
 * If you add a custom native plugin later, handle it inside the native branch.
 */
export async function speakText({
  text,
  locale,
  rate,
  pitch,
}: SpeakOptions): Promise<void> {
  const platform = Capacitor.getPlatform();

  // ────────────────
  // 1) Native side (Capacitor Android/iOS)
  // ────────────────
  if (platform !== "web") {
    // Future: you can add your own Capacitor plugin here:
    // const { NativeTTS } = await import('path-to-your-custom-plugin');
    // await NativeTTS.speak({ text, locale, rate, pitch });

    console.warn("Native TTS plugin not installed — using web fallback.");
  }

  // ────────────────
  // 2) Web Speech API
  // ────────────────
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    return new Promise((resolve) => {
      const utter = new SpeechSynthesisUtterance(text);

      if (locale) utter.lang = locale;
      if (typeof rate === "number") utter.rate = rate;
      if (typeof pitch === "number") utter.pitch = pitch;

      utter.onend = resolve;

      try {
        window.speechSynthesis.cancel();
      } catch {}

      window.speechSynthesis.speak(utter);
    });
  }

  // No TTS available
  return Promise.resolve();
}

/**
 * Build speech text for vehicle alerts
 */
export function buildVehicleAlertSpeech(params: {
  alertType?: string | null;
  vehicle?: string | null;
  message?: string | null;
  locale?: string;
}): string {
  const { alertType, vehicle, message } = params;
  const parts: string[] = [];

  if (alertType) parts.push(`Alert: ${normalizeAlertType(alertType)}.`);
  if (vehicle) parts.push(`Vehicle ${vehicle}.`);
  if (message) parts.push(message);

  return parts.join(" ");
}

/**
 * Convert alert types to TTS-friendly versions
 */
function normalizeAlertType(alertType: string): string {
  const key = alertType.toLowerCase();

  switch (key) {
    case "overspeed":
    case "over-speed":
    case "speeding":
      return "over speed";

    case "sos":
      return "S O S";

    default:
      return alertType.replace(/[-_]/g, " ");
  }
}
