
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import Image from "next/image";

export default function SplashPage() {
  const { isAuthenticated, isLoading, isPinSet } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      if (isAuthenticated) {
        router.replace("/home");
      } else if (isPinSet) {
        router.replace("/pin-login");
      } else {
        router.replace("/login");
      }
    }
  }, [isAuthenticated, isLoading, isPinSet, router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background">
      <Image src="/logo.png" alt="AL-MUHAFIZ TRACKERS Logo" width={200} height={200} className="mb-4" style={{ objectFit: 'contain' }} priority/>
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}
