'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useFirebase, useMemoFirebase, useDoc, tenantDoc } from '@/firebase';
import { Loader2 } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { RoleChoiceDialog } from '@/components/role-choice-dialog';

export default function Home() {
  const { user, isUserLoading } = useUser();
  const { firestore } = useFirebase();
  const router = useRouter();
  const [showRoleChoice, setShowRoleChoice] = React.useState(false);
  const [isCheckingRole, setIsCheckingRole] = React.useState(false);
  const [isNavigating, setIsNavigating] = React.useState(false);
  const hasCheckedRole = React.useRef(false);

  // Fetch company profile for dialog
  const companyProfileRef = useMemoFirebase(
    ({ firestore, companyPath }) => (firestore ? tenantDoc(firestore, companyPath, 'company', 'profile') : null),
    []
  );
  const { data: companyProfile } = useDoc(companyProfileRef);

  React.useEffect(() => {
    // Prevent multiple checks
    if (hasCheckedRole.current || isCheckingRole || isNavigating) return;

    if (isUserLoading) {
      return; // Wait until user status is resolved
    }

    if (!user) {
      router.replace('/login');
      return;
    }

    // User is logged in, fetch their role and redirect
    const checkUserRoleAndRedirect = async () => {
      if (!firestore) {
        return;
      }
      
      hasCheckedRole.current = true;
      setIsCheckingRole(true);
      
      const userDocRef = doc(firestore, 'employees', user.uid);
      
      try {
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists()) {
          const userData = userDoc.data();
          
          if (userData.role === 'admin') {
            // Admin user - show role choice dialog
            setShowRoleChoice(true);
          } else {
            // Regular employee - redirect directly
            setIsNavigating(true);
            router.replace('/mobile/home');
          }
        } else {
          // Fallback if doc doesn't exist
          router.replace('/login');
        }
      } catch (error) {
        console.error("[Home] Error fetching user role", error);
        router.replace('/login');
      } finally {
        setIsCheckingRole(false);
      }
    };

    checkUserRoleAndRedirect();

  }, [isUserLoading, user, router, firestore, isCheckingRole, isNavigating]);

  const handleChooseAdmin = React.useCallback(() => {
    setIsNavigating(true);
    router.replace('/dashboard');
  }, [router]);

  const handleChooseEmployee = React.useCallback(() => {
    setIsNavigating(true);
    router.replace('/mobile/home');
  }, [router]);

  // Don't close dialog from outside - only via button clicks
  const handleOpenChange = React.useCallback((open: boolean) => {
    // Only allow opening, not closing from outside
    if (open) {
      setShowRoleChoice(true);
    }
  }, []);

  return (
    <div className="flex h-screen items-center justify-center bg-background">
      {!showRoleChoice && (
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      )}
      
      <RoleChoiceDialog
        open={showRoleChoice}
        onOpenChange={handleOpenChange}
        onChooseAdmin={handleChooseAdmin}
        onChooseEmployee={handleChooseEmployee}
        companyName={companyProfile?.name}
      />
    </div>
  );
}
