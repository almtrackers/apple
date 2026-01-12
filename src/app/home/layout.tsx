
'use client';

import { ProtectedRoute } from '@/components/protected-route';
import BottomNav from '@/components/home/bottom-nav';
import { useAuth } from '@/hooks/use-auth';
import { Settings, LogOut, ChevronDown } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ThemeToggleSimple } from '@/components/ui/theme-toggle';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import Image from 'next/image';
import { WebSocketProvider } from '@/contexts/websocket-context';
import { cn } from '@/lib/utils';
import { useLocationIgnitionAlert } from '@/hooks/use-location-ignition-alert';

// Inner component that uses WebSocket context
function HomeLayoutContent({ children }: { children: React.ReactNode }) {
  // Initialize location-based ignition alerts (mobile only)
  // This hook is called inside WebSocketProvider, so it's safe
  useLocationIgnitionAlert();
  
  return <>{children}</>;
}

export default function HomeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const getInitials = (name: string = '') => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('');
  };

  const isMapPage = pathname === '/home/map';

  const handleLogoClick = () => {
    router.push('/home/dashboard');
  }

  return (
    <ProtectedRoute>
      <WebSocketProvider>
        <HomeLayoutContent>
        <div className="flex flex-col min-h-screen">
            {!isMapPage && (
              <header className="w-full greeting-header py-2 relative z-10">
                <div className="orb" aria-hidden="true"></div>
                <div className="orb2" aria-hidden="true"></div>
                
                <div className="max-w-5xl mx-auto px-4">
                  <div className="flex items-center justify-between gap-2">
                    {/* Logo - Always visible */}
                    <div className="flex-shrink-0">
                      <button onClick={handleLogoClick} className="cursor-pointer">
                        <Image 
                          src="/logo.png" 
                          alt="AL-MUHAFIZ Logo" 
                          width={60} 
                          height={60} 
                          className="sm:w-[70px] sm:h-[70px]"
                          style={{ objectFit: 'contain' }}
                        />
                      </button>
                    </div>
                    
                    {/* Company Info - Responsive display */}
                    <div className="text-center text-white flex-1">
                        {/* Full company name - hidden on very small screens */}
                        <div className="hidden xs:block">
                          <div className="font-semibold text-sm sm:text-base whitespace-nowrap">AL-Muhafiz Trackers (PVT) LTD</div>
                          <a href="https://www.almtrace.com" target="_blank" rel="noopener noreferrer" className="text-xs text-white/70 hover:underline">
                            www.almtrace.com
                          </a>
                        </div>
                        {/* Compact version for very small screens */}
                        <div className="xs:hidden">
                          <div className="font-semibold text-xs whitespace-nowrap">AL-MUHAFIZ TRACKERS</div>
                          <div className="text-xs text-white/70">(PVT) LTD</div>
                        </div>
                      </div>
                      
                    {/* User Menu - Always visible */}
                    <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                      <ThemeToggleSimple />
                      <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          className="flex items-center gap-2 text-white hover:bg-white/10 hover:text-white"
                        >
                          <Avatar className="h-8 w-8">
                            <AvatarFallback>{getInitials(user?.name)}</AvatarFallback>
                          </Avatar>
                          <div className="text-left hidden md:block">
                              <p className="text-sm font-medium">{user?.name}</p>
                              <p className="text-xs text-white/70">
                                {user?.phone || 'No contact'}
                              </p>
                            </div>
                          <ChevronDown className="h-4 w-4 text-white/70" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="w-56" align="end">
                        <DropdownMenuLabel>My Account</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => router.push('/home/settings')}>
                          <Settings className="mr-2 h-4 w-4" />
                          <span>Settings</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={logout}>
                          <LogOut className="mr-2 h-4 w-4" />
                          <span>Log out</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    </div>
                  </div>

                  <div className={cn(
                      "transition-all duration-300 ease-in-out overflow-hidden max-h-40 mt-2"
                  )}>
                      <section className="greeting-card rounded-xl p-3" role="group" aria-label="Arabic Greeting">
                          <h1 className="greeting-headline" dir="rtl">
                              ٱلسَّلَامُ عَلَيْكُمْ، <span className="gold">مَرْحَبًا</span>
                          </h1>
                          <div className="greeting-divider"></div>
                          <p className="greeting-sub">Assalāmu ʿAlaykum — Marḥaban (Welcome)</p>
                      </section>
                  </div>
                </div>
              </header>
            )}
          
          <main className="flex-1 relative">
             <div className={cn("h-full", isMapPage ? 'absolute inset-0' : 'p-4 pb-24')}>
                {children}
             </div>
          </main>
          
          {!isMapPage && <BottomNav />}
        </div>
        </HomeLayoutContent>
      </WebSocketProvider>
    </ProtectedRoute>
  );
}
