'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useUser, useFirebase } from '@/firebase';
import { useTenant } from '@/contexts/tenant-context';
import { TenantProvider } from '@/contexts/tenant-context';
import { FirebaseClientProvider } from '@/firebase';
import {
  Loader2,
  ShieldAlert,
  LayoutDashboard,
  Building2,
  CreditCard,
  LogOut,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { signOut } from 'firebase/auth';
import { clearSessionCookie } from '@/lib/session';

const NAV_ITEMS = [
  { href: '/super-admin', label: 'Хяналтын самбар', icon: LayoutDashboard, exact: true },
  { href: '/super-admin/companies', label: 'Байгууллагууд', icon: Building2 },
  { href: '/super-admin/billing', label: 'Төлбөр', icon: CreditCard },
];

function SuperAdminShell({ children }: { children: React.ReactNode }) {
  const { user, isUserLoading } = useUser();
  const { auth } = useFirebase();
  const { role, isLoading: isTenantLoading } = useTenant();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.replace('/login');
    }
  }, [user, isUserLoading, router]);

  const isFullyLoading = isUserLoading || isTenantLoading;

  if (isFullyLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (role !== 'super_admin') {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-slate-950 text-slate-400">
        <ShieldAlert className="h-10 w-10" />
        <p className="font-medium">Хандах эрхгүй</p>
        <Button variant="link" className="text-slate-500" onClick={() => router.replace('/dashboard')}>
          Dashboard руу буцах
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100">
      {/* Sidebar */}
      <aside className="w-60 flex-none flex flex-col border-r border-slate-800 bg-slate-900">
        {/* Logo / Brand */}
        <div className="flex items-center gap-2.5 px-5 py-4 border-b border-slate-800">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-600">
            <ShieldAlert className="h-4 w-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-white">Nege Platform</p>
            <p className="text-[10px] text-slate-500">Super Admin</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 flex flex-col gap-0.5 p-3">
          {NAV_ITEMS.map((item) => {
            const isActive = item.exact
              ? pathname === item.href
              : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition-all',
                  isActive
                    ? 'bg-slate-800 text-white font-medium'
                    : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                )}
              >
                <item.icon className="h-4 w-4 flex-none" />
                {item.label}
                {isActive && <ChevronRight className="h-3 w-3 ml-auto text-slate-600" />}
              </Link>
            );
          })}
        </nav>

        {/* Bottom */}
        <div className="border-t border-slate-800 p-3 space-y-2">
          <button
            onClick={() => { clearSessionCookie(); auth && signOut(auth).then(() => router.replace('/login')); }}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-slate-500 hover:bg-red-900/20 hover:text-red-400 transition-colors"
          >
            <LogOut className="h-3 w-3" />
            Гарах
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto bg-slate-950">
        <div className="mx-auto max-w-6xl">
          {children}
        </div>
      </main>
    </div>
  );
}

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <FirebaseClientProvider>
      <TenantProvider>
        <SuperAdminShell>{children}</SuperAdminShell>
      </TenantProvider>
    </FirebaseClientProvider>
  );
}
