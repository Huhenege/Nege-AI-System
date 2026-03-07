'use client';

import * as React from 'react';
import Link from 'next/link';
import { ChevronRight, LogOut, User, Bell, Lock, HelpCircle, Sparkles, FileText, ClipboardCheck } from 'lucide-react';
import { useEmployeeProfile } from '@/hooks/use-employee-profile';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { signOut } from 'firebase/auth';
import { useAuth, useFirebase, useTenantWrite } from '@/firebase';
import { query, where, getDocs } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Badge } from '@/components/ui/badge';
import { ChangePasswordDialog } from '@/components/change-password-dialog';

// Components
import { UserWalletCard } from './components/user-wallet-card';

function SettingsItem({
  icon: Icon,
  label,
  href,
  badge,
  onClick
}: {
  icon: React.ElementType;
  label: string;
  href?: string;
  badge?: string;
  onClick?: () => void;
}) {
  const content = (
    <div className="flex w-full items-center justify-between rounded-2xl bg-white p-4 text-left transition-all hover:shadow-md border border-slate-100 active:scale-[0.99] mb-3 cursor-pointer group">
      <div className="flex items-center gap-4">
        <div className="h-10 w-10 rounded-full bg-slate-50 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
          <Icon className="h-5 w-5 text-slate-500 group-hover:text-primary transition-colors" />
        </div>
        <span className="font-semibold text-slate-700">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        {badge && <Badge variant="secondary" className="bg-red-100 text-red-600">{badge}</Badge>}
        <ChevronRight className="h-5 w-5 text-slate-300 group-hover:text-primary/50 transition-colors" />
      </div>
    </div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }

  return <div onClick={onClick}>{content}</div>;
}

function PageSkeleton() {
  return (
    <div className="p-6 space-y-8 bg-slate-50 min-h-screen">
      <div className="flex flex-col items-center gap-4 pt-8">
        <Skeleton className="h-24 w-24 rounded-full" />
        <div className="space-y-2 text-center">
          <Skeleton className="h-6 w-40 mx-auto" />
          <Skeleton className="h-4 w-32 mx-auto" />
        </div>
      </div>
      <div className="space-y-3">
        <Skeleton className="h-16 w-full rounded-2xl" />
        <Skeleton className="h-16 w-full rounded-2xl" />
        <Skeleton className="h-16 w-full rounded-2xl" />
      </div>
    </div>
  )
}

export default function MobileUserPage() {
  const { employeeProfile, isProfileLoading, user, isUserLoading, error } = useEmployeeProfile();
  const { firestore } = useFirebase();
  const { tCollection } = useTenantWrite();
  const auth = useAuth();
  const router = useRouter();
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = React.useState(false);
  const [pendingEvalCount, setPendingEvalCount] = React.useState(0);

  React.useEffect(() => {
    if (!firestore || !user?.uid) return;
    let cancelled = false;

    const load = async () => {
      const seen = new Set<string>();

      const countPending = (snap: any) => {
        snap.docs.forEach((d: any) => {
          if (!seen.has(d.id) && d.data().status === 'pending') seen.add(d.id);
        });
      };

      // 1) Email-ээр хайх
      if (user.email) {
        try {
          const byEmail = query(tCollection('evaluation_requests'), where('assignedToEmail', '==', user.email));
          countPending(await getDocs(byEmail));
        } catch (_) { /* index may not exist yet */ }
      }

      // 2) Auth UID-аар хайх
      try {
        const byUid = query(tCollection('evaluation_requests'), where('assignedTo', '==', user.uid));
        countPending(await getDocs(byUid));
      } catch (_) { /* ignore */ }

      // 3) Employee doc ID-аар хайх
      if (user.email) {
        try {
          const empQ = query(tCollection('employees'), where('email', '==', user.email));
          const empSnap = await getDocs(empQ);
          const empIds = empSnap.docs.map(d => d.id).filter(id => id !== user.uid);
          if (empIds.length > 0) {
            const byEmpId = query(tCollection('evaluation_requests'), where('assignedTo', 'in', empIds));
            countPending(await getDocs(byEmpId));
          }
        } catch (_) { /* ignore */ }
      }

      if (!cancelled) setPendingEvalCount(seen.size);
    };

    load();
    return () => { cancelled = true; };
  }, [firestore, user?.uid, user?.email]);

  const handleLogout = async () => {
    if (!auth) return;
    await signOut(auth);
    router.push('/login');
  };

  // If not logged in, redirect to login
  React.useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/login');
    }
  }, [isUserLoading, user, router]);

  if (isUserLoading || isProfileLoading) {
    return <PageSkeleton />;
  }

  if (error) {
    return (
      <div className="p-6 space-y-4 bg-slate-50 min-h-screen flex flex-col items-center justify-center">
        <p className="text-red-500">Алдаа гарлаа: {error.message}</p>
        <button onClick={() => router.push('/login')} className="text-blue-500 underline">
          Дахин нэвтрэх
        </button>
      </div>
    );
  }

  if (!employeeProfile) {
    return (
      <div className="p-6 space-y-4 bg-slate-50 min-h-screen flex flex-col items-center justify-center">
        <p className="text-muted-foreground">Хэрэглэгчийн мэдээлэл олдсонгүй</p>
        <button onClick={() => router.push('/login')} className="text-blue-500 underline">
          Дахин нэвтрэх
        </button>
      </div>
    );
  }

  const { firstName, lastName, jobTitle, photoURL } = employeeProfile;
  const fullName = `${lastName} ${firstName}`;

  return (
    <div className="min-h-screen bg-slate-50/50 flex flex-col pb-24">
      {/* Header Profile Section */}
      <div className="bg-white pt-10 pb-6 shadow-sm border-b border-slate-100 px-6 relative overflow-hidden">
        {/* Background Decor */}
        <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-r from-blue-500 to-indigo-600 opacity-10" />
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-primary/20 rounded-full blur-3xl" />

        <div className="flex items-center gap-5 relative z-10">
          <div className="relative">
            <Avatar className="h-20 w-20 border-4 border-white shadow-xl ring-2 ring-primary/10">
              <AvatarImage src={photoURL} alt={fullName} className="object-cover" />
              <AvatarFallback className="text-2xl bg-slate-200 text-slate-500">
                {firstName?.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <div className="absolute bottom-1 right-1 bg-green-500 border-4 border-white w-5 h-5 rounded-full shadow-sm" />
          </div>

          <div className="flex-1">
            <h1 className="text-xl font-semibold text-slate-900 leading-tight">{fullName}</h1>
            <p className="text-sm font-medium text-slate-500">{jobTitle || 'Ажилтан'}</p>
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="outline" className="border-blue-200 text-blue-700 bg-blue-50 px-2 py-0.5 text-xs">
                <Sparkles className="w-3 h-3 mr-1" /> Баталгаажсан
              </Badge>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 px-6 space-y-6 pt-4">

        {/* 1. Wallet Card (Navigation to detailed culture page) */}
        <Link href="/mobile/points" className="block outline-none">
          <UserWalletCard />
        </Link>

        {/* 2. Settings Groups */}
        <div>
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 px-2">Ажил</h3>
          <SettingsItem icon={FileText} label="Бичиг баримт хянах" href="/mobile/document-review" />
          <SettingsItem icon={ClipboardCheck} label="Сонгон шалгаруулалт" href="/mobile/evaluations" badge={pendingEvalCount > 0 ? String(pendingEvalCount) : undefined} />
        </div>

        <div>
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 px-2">Хувийн мэдээлэл</h3>
          <SettingsItem icon={User} label="Анкет засах" href="/mobile/profile/edit" />
        </div>

        <div>
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 px-2">Тохиргоо</h3>
          <SettingsItem icon={Bell} label="Мэдэгдэл" href="#" />
          <SettingsItem icon={Lock} label="Нууц үг солих" onClick={() => setIsPasswordDialogOpen(true)} />
        </div>

        <div>
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 px-2">Бусад</h3>
          <SettingsItem icon={HelpCircle} label="Тусламж" href="#" />

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button className="w-full flex items-center justify-between p-4 rounded-2xl bg-red-50 border border-red-100 text-red-600 hover:bg-red-100 transition-colors active:scale-[0.98]">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center">
                    <LogOut className="h-5 w-5" />
                  </div>
                  <span className="font-semibold">Системээс гарах</span>
                </div>
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent className="rounded-2xl">
              <AlertDialogHeader>
                <AlertDialogTitle>Та системээс гарахдаа итгэлтэй байна уу?</AlertDialogTitle>
                <AlertDialogDescription>
                  Таны сессшн дуусгавар болох ба дахин нэвтрэх шаардлагатай болно.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="rounded-xl">Цуцлах</AlertDialogCancel>
                <AlertDialogAction onClick={handleLogout} className="bg-red-600 hover:bg-red-700 rounded-xl">Тийм, гарах</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
        <div className="text-center pb-6">
          <p className="text-xs text-slate-400">Хувилбар 2.2.0 (Direct Wallet Link)</p>
        </div>
      </div>

      <ChangePasswordDialog open={isPasswordDialogOpen} onOpenChange={setIsPasswordDialogOpen} />
    </div>
  );
}
