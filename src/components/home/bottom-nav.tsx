
'use client';

import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, Map, Bell, Wrench } from 'lucide-react';
import { cn } from '@/lib/utils';
import React from 'react';

const SupportIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg 
        xmlns="http://www.w3.org/2000/svg" 
        width="28" 
        height="28" 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor" 
        strokeWidth="1.5" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        {...props}
    >
        <path d="M18 18.5a6 6 0 1 0-12 0" />
        <path d="M16 13a4 4 0 1 1-8 0" />
        <path d="M12 13v-2" />
        <path d="M19 13h-1a6 6 0 0 0-6-6v0a6 6 0 0 0-6 6H5" />
        <path d="M4 14v4" />
        <path d="M20 14v4" />
    </svg>
);

const menuItems = [
  { href: '/home/dashboard', label: 'Devices', icon: LayoutDashboard, from: '#ffab00', to: '#ff6a00' },
  { href: '/home/map', label: 'Map', icon: Map, from: '#b833ff', to: '#ff2bb3' },
  { href: '/home/events', label: 'Events', icon: Bell, from: '#01c3b5', to: '#1ed1c0' },
  { href: '/home/maintenance', label: 'Maintenance', icon: Wrench, from: '#00a8ff', to: '#0076ff' },
  { href: '/home/support', label: 'Support', icon: SupportIcon, from: '#10b981', to: '#34d399' },
];

export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <nav className="chain-nav" aria-label="Bottom navigation">
      {menuItems.map((item, index) => {
        const isActive = pathname.startsWith(item.href);
        const nextItem = menuItems[index + 1];
        
        return (
          <React.Fragment key={item.href}>
            <button
              className={cn("node", isActive && "active")}
              aria-label={item.label}
              style={{ '--from': item.from, '--to': item.to } as React.CSSProperties}
              onClick={() => router.push(item.href)}
            >
              <item.icon aria-hidden="true" />
              <span className="label">{item.label}</span>
            </button>

            {nextItem && (
              <svg className="bridge" viewBox="0 0 260 60" preserveAspectRatio="none" aria-hidden="true" 
                   style={{ '--from': item.to, '--to': nextItem.from } as React.CSSProperties}>
                <defs>
                  <linearGradient id={`grad-${index}`} x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="var(--from)" />
                    <stop offset="100%" stopColor="var(--to)" />
                  </linearGradient>
                </defs>
                <path d="M0,15 C86,23 174,23 260,15 L260,45 C174,37 86,37 0,45 Z" fill={`url(#grad-${index})`} />
              </svg>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}
