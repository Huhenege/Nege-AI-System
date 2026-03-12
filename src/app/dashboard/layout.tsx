'use client';

import * as React from 'react';
import { useUser, useMemoFirebase, useFetchDoc, tenantDoc } from '@/firebase';
import { usePathname } from 'next/navigation';
import { useTenant } from '@/contexts/tenant-context';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, Home, Building, Settings, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { UserNav } from '@/components/user-nav';
import { NotificationCenter } from '@/components/notification-center';
import { ImplementationGuideWidget } from './components/implementation-guide-widget';
import { ActionIconButton } from '@/components/ui/action-icon-button';
import { FloatingAssistant } from '@/components/assistant/floating-assistant';

interface CompanyProfile {
  name?: string;
  logoUrl?: string;
}

function AdminDashboard({ children }: { children: React.ReactNode }) {
  const { user, isUserLoading } = useUser();
  const { companyId, company, isLoading: isTenantLoading, role, isCompanyActive } = useTenant();
  const router = useRouter();
  const pathname = usePathname();

  const companyProfileRef = useMemoFirebase(({ firestore, companyPath }) => (firestore ? tenantDoc(firestore, companyPath, 'company', 'profile') : null), []);
  const { data: companyProfile, isLoading: isLoadingProfile } = useFetchDoc<CompanyProfile>(companyProfileRef);

  React.useEffect(() => {
    if (!isUserLoading && !user) {
      router.replace('/login');
    }
  }, [user, isUserLoading, router]);

  // Redirect to setup wizard if not completed (skip for super_admin and setup page itself)
  React.useEffect(() => {
    if (
      !isTenantLoading &&
      companyId &&
      company &&
      role !== 'super_admin' &&
      !company.setupComplete &&
      !pathname.startsWith('/dashboard/setup')
    ) {
      router.replace('/dashboard/setup');
    }
  }, [isTenantLoading, companyId, company, role, pathname, router]);

  const isFullyLoading = isUserLoading || isTenantLoading;

  if (isFullyLoading || !user) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <p className="text-caption text-muted-foreground">
          {isUserLoading ? 'Нэвтрэлт шалгаж байна...' : 'Байгууллага ачаалж байна...'}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background">
      {/* Global Header */}
      <header className="flex-none sticky top-0 z-40 w-full border-b bg-background">
        <div className="flex h-14 items-center justify-between gap-4 px-page">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon-sm" asChild>
              <Link href="/dashboard">
                <Home className="h-4 w-4" />
                <span className="sr-only">Нүүр хуудас</span>
              </Link>
            </Button>
            <div className="h-4 w-px bg-border" />
            <Link href="/dashboard/company" className="inline-flex items-center gap-2 transition-opacity hover:opacity-80">
              {isLoadingProfile ? (
                <>
                  <Skeleton className="h-7 w-7 rounded-md" />
                  <Skeleton className="h-4 w-20" />
                </>
              ) : (
                <>
                  <Avatar className="h-7 w-7 rounded-md border">
                    <AvatarImage src={companyProfile?.logoUrl} className="object-contain" />
                    <AvatarFallback className="rounded-md bg-muted text-micro">
                      <Building className="h-3.5 w-3.5" />
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-body-medium">{companyProfile?.name || 'Компани'}</span>
                </>
              )}
            </Link>
          </div>

          <div className="flex items-center gap-1">
            <NotificationCenter />
            <ImplementationGuideWidget />
            <ActionIconButton
              label="Тохиргоо"
              description="Системийн тохиргоо"
              href="/dashboard/settings/employee-code"
              icon={<Settings className="h-4 w-4" />}
              variant="ghost"
              size="icon-sm"
            />
            <UserNav />
          </div>
        </div>
      </header>

      {/* Subscription expiry banner */}
      {!isCompanyActive && role !== 'super_admin' && company && (
        <div className="flex-none bg-destructive/10 border-b border-destructive/20 px-page py-2">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              <span>
                {company.status === 'suspended' || company.status === 'cancelled'
                  ? 'Таны бүртгэл түр зогссон байна.'
                  : 'Таны багцын хугацаа дууссан байна. Зарим модулууд хязгаарлагдсан.'
                }
              </span>
            </div>
            <Button size="sm" variant="destructive" asChild>
              <Link href="/dashboard/billing">Багц сунгах</Link>
            </Button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 w-full max-w-[1920px] mx-auto flex flex-col overflow-y-auto">
        {children}
      </main>

      {/* Floating AI Assistant */}
      <FloatingAssistant />
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminDashboard>{children}</AdminDashboard>;
}
