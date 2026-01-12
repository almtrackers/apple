
"use client";

import {
  createContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import apiClient from "@/lib/api";
import axios from "axios";

interface User {
  id: number;
  name: string;
  email: string;
  phone?: string;
  attributes: {
    [key: string]: any;
  };
}

interface Device {
  id: number;
  name: string;
  uniqueId: string;
  status: string;
  attributes: {
    devicePassword?: string;
    [key: string]: any;
  };
  position?: {
    latitude: number;
    longitude: number;
  };
}

// Storage keys - using session storage for better subdomain isolation
const AUTH_LOCAL_STORAGE_KEY = "authCredentials_local";
const AUTH_SESSION_STORAGE_KEY = "authCredentials_session";
const AUTH_PIN_SETUP_KEY = "pin_setup";

// Get current subdomain for isolation
function getCurrentSubdomain(): string | null {
  if (typeof window === 'undefined') return null;

  const hostname = window.location.hostname;
  if (hostname.includes('localhost') || hostname.includes('127.0.0.1')) {
    return null;
  }

  const parts = hostname.split('.');
  if (parts.length >= 3 && parts[parts.length - 2] === 'almtrace' && parts[parts.length - 1] === 'com') {
    return parts[0];
  }

  return null;
}

// Encrypted PIN vault (PBKDF2 + AES-GCM)
const AUTH_PIN_VAULT_KEY = "authPinVault_v1";

type PinVaultPayload = {
  saltB64: string;
  ivB64: string;
  ciphertextB64: string;
};

const te = new TextEncoder();
const td = new TextDecoder();

function b64FromBytes(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function bytesFromB64(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function getRandomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

async function deriveAesKeyFromPin(pin: string, salt: Uint8Array): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey("raw", te.encode(pin), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt, iterations: 150000, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

async function encryptCredentialsWithPin(credentialsB64: string, pin: string): Promise<PinVaultPayload> {
  const salt = getRandomBytes(16);
  const iv = getRandomBytes(12);
  const key = await deriveAesKeyFromPin(pin, salt);
  const plaintext = te.encode(credentialsB64);
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv }, key, plaintext);
  return { saltB64: b64FromBytes(salt), ivB64: b64FromBytes(iv), ciphertextB64: b64FromBytes(ciphertext) };
}

async function decryptCredentialsWithPin(payload: PinVaultPayload, pin: string): Promise<string | null> {
  try {
    const salt = bytesFromB64(payload.saltB64);
    const iv = bytesFromB64(payload.ivB64);
    const key = await deriveAesKeyFromPin(pin, salt);
    const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv: iv }, key, bytesFromB64(payload.ciphertextB64));
    return td.decode(decrypted);
  } catch {
    return null;
  }
}

function extractCredentialsFromAuthHeader(): string | null {
  const header = apiClient.defaults.headers.common["Authorization"];
  if (typeof header === "string" && header.startsWith("Basic ")) {
    return header.slice(6);
  }
  return null;
}

interface AuthContextType {
  isAuthenticated: boolean;
  user: User | null;
  isLoading: boolean;
  isPinSet: boolean;
  login: (emailOrPhone: string, password: string) => Promise<boolean>;
  logout: () => void;
  selectedDeviceForMap: Device | null;
  selectDeviceForMap: (device: Device) => void;
  clearSelectedDeviceForMap: () => void;
  // PIN login
  setPin: (pin: string) => Promise<boolean>;
  loginWithPin: (pin: string) => Promise<boolean>;
  clearPin: () => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPinSet, setIsPinSet] = useState(false);
  const [selectedDeviceForMap, setSelectedDeviceForMap] = useState<Device | null>(null);
  const router = useRouter();

  // Clear full session
  const clearSession = useCallback(() => {
    setUser(null);
    localStorage.removeItem(AUTH_LOCAL_STORAGE_KEY);
    sessionStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
    sessionStorage.removeItem('session_token'); // Clear session token
    delete apiClient.defaults.headers.common['Authorization'];
  }, []);

   const loginWithCredentials = useCallback(async (credentials: string): Promise<boolean> => {
    try {
      const decodedCreds = atob(credentials).split(':');
      const emailOrPhone = decodedCreds[0];
      const password = decodedCreds[1];

      // Helper function to detect if input is email
      const isEmail = (value: string): boolean => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(value);
      };

      const params = new URLSearchParams();
      params.append('password', password);
      
      // Determine if it's email or phone number and send appropriate parameter
      if (isEmail(emailOrPhone)) {
        params.append('email', emailOrPhone);
      } else {
        // It's a phone number, send as phone parameter (or email if backend accepts both)
        // Try both for compatibility
        params.append('phone', emailOrPhone);
        params.append('email', emailOrPhone); // Fallback
      }

      const response = await axios.post('https://app.almtrace.com/api/session', params, {
        withCredentials: true,
      });

      if (response.status === 200) {
        setUser(response.data);
        apiClient.defaults.headers.common['Authorization'] = `Basic ${credentials}`;
        return true;
      }
    } catch (error) {
        console.error("Login with credentials failed:", error);
    }
    return false;
  }, []);

  // Set or update PIN: encrypt Basic credentials and store as vault
  // This will clear any existing PIN vault and create a new one with current credentials
  const setPin = useCallback(async (pin: string): Promise<boolean> => {
    try {
      const credentials =
        localStorage.getItem(AUTH_LOCAL_STORAGE_KEY) ||
        sessionStorage.getItem(AUTH_SESSION_STORAGE_KEY) ||
        extractCredentialsFromAuthHeader();

      if (!credentials) {
        console.warn("No credentials available to secure with PIN.");
        return false;
      }

      // Clear old PIN vault if exists (overwrite with new one)
      localStorage.removeItem(AUTH_PIN_VAULT_KEY);
      
      // Create new PIN vault with current credentials
      const payload = await encryptCredentialsWithPin(credentials, pin);
      localStorage.setItem(AUTH_PIN_VAULT_KEY, JSON.stringify(payload));
      localStorage.setItem(AUTH_PIN_SETUP_KEY, "true");
      setIsPinSet(true);

      // Remove plaintext credentials at rest; keep sessionStorage for current session
      localStorage.removeItem(AUTH_LOCAL_STORAGE_KEY);
      console.log("[Auth] PIN vault updated/created with new credentials");
      return true;
    } catch (e) {
      console.error("Failed to set PIN", e);
      return false;
    }
  }, []);

  const loginWithPin = useCallback(async (pin: string): Promise<boolean> => {
    setIsLoading(true);
    try {
      const payloadStr = localStorage.getItem(AUTH_PIN_VAULT_KEY);
      if (!payloadStr) return false;

      const payload: PinVaultPayload = JSON.parse(payloadStr);
      const credentials = await decryptCredentialsWithPin(payload, pin);
      if (!credentials) return false;

      const success = await loginWithCredentials(credentials);
      return success;
    } catch (e) {
      console.error("PIN login failed", e);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [loginWithCredentials]);

  const clearPin = useCallback(() => {
    localStorage.removeItem(AUTH_PIN_VAULT_KEY);
    localStorage.removeItem(AUTH_PIN_SETUP_KEY);
    setIsPinSet(false);
  }, []);


  // Check session on app load
  const checkSession = useCallback(async () => {
    setIsLoading(true);
    const pinIsSetup = localStorage.getItem(AUTH_PIN_SETUP_KEY) === 'true';
    setIsPinSet(pinIsSetup);

    const localCredentials = localStorage.getItem(AUTH_LOCAL_STORAGE_KEY);
    const sessionCredentials = sessionStorage.getItem(AUTH_SESSION_STORAGE_KEY);
    const credentials = localCredentials || sessionCredentials;

    if (!credentials) {
      if (!pinIsSetup) { // Only clear if no PIN is set either
        clearSession();
      }
      setIsLoading(false);
      return;
    }

    try {
      apiClient.defaults.headers.common['Authorization'] = `Basic ${credentials}`;
      const sessionRes = await apiClient.get<User>('/session');
      if (sessionRes.status === 200 && sessionRes.data) {
        setUser(sessionRes.data);
      } else {
        clearSession();
      }
    } catch (error: any) {
      if (error.response && error.response.status === 401) {
        console.log("No active session found, user is logged out.");
      } else {
        console.error("Session check failed", error);
      }
      clearSession();
    } finally {
      setIsLoading(false);
    }
  }, [clearSession]);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  // Logout
  const logout = useCallback(async () => {
    setIsLoading(true);
    try {
      await axios.delete('https://app.almtrace.com/api/session', {
        headers: {
          'Authorization': apiClient.defaults.headers.common['Authorization']
        },
        withCredentials: true,
      });
    } catch (error) {
      console.error("Logout failed", error);
    } finally {
      clearSession();
      // Do not clear PIN on logout, user might want to log in again
      setIsLoading(false);
      if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
        router.push("/login");
      }
    }
  }, [router, clearSession]);

  // Email or phone/password login - always use session storage for session-based authentication and subdomain isolation
  const login = async (emailOrPhone: string, password: string): Promise<boolean> => {
    setIsLoading(true);
    const credentials = btoa(`${emailOrPhone}:${password}`);
    const success = await loginWithCredentials(credentials);

    if (success) {
      // Always use session storage for session-based authentication and better subdomain isolation
      sessionStorage.setItem(AUTH_SESSION_STORAGE_KEY, credentials);
      localStorage.removeItem(AUTH_LOCAL_STORAGE_KEY); // Remove any existing localStorage credentials
      
      // Generate a new session token for WebSocket authentication
      try {
        const shortExpiration = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour
        const tokenResponse = await apiClient.post('/session/token', 
          new URLSearchParams(`expiration=${shortExpiration}`)
        );
        
        if (tokenResponse.data) {
          const sessionToken = typeof tokenResponse.data === 'string' ? tokenResponse.data : tokenResponse.data.token;
          if (sessionToken) {
            // Store session token in session storage (not localStorage for security)
            sessionStorage.setItem('session_token', sessionToken);
            console.log("Generated new session token for WebSocket authentication");
          }
        }
      } catch (error) {
        console.error("Failed to generate session token:", error);
        // Continue with login even if token generation fails
      }
    } else {
        clearSession();
    }
    
    setIsLoading(false);
    return success;
  };

  // Device map selection
  const selectDeviceForMap = (deviceToSelect: Device) => setSelectedDeviceForMap(deviceToSelect);
  const clearSelectedDeviceForMap = () => setSelectedDeviceForMap(null);

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated: !!user,
        user,
        isLoading,
        isPinSet,
        login,
        logout,
        selectedDeviceForMap,
        selectDeviceForMap,
        clearSelectedDeviceForMap,
        setPin,
        loginWithPin,
        clearPin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
