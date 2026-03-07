'use client';

import { useUser, useDoc, useFirebase, useMemoFirebase, tenantDoc } from '@/firebase';
import { doc } from 'firebase/firestore';

import { Employee } from '@/types';

export type EmployeeProfile = Employee & {
  role: 'admin' | 'employee';
};

export const useEmployeeProfile = () => {
  const { user, isUserLoading, userError } = useUser();

  const employeeDocRef = useMemoFirebase(
    ({ firestore, user: memoizedUser, companyPath }) => (firestore && memoizedUser ? tenantDoc(firestore, companyPath, 'employees', memoizedUser.uid) : null),
    []
  );

  const {
    data: employeeProfile,
    isLoading: isProfileLoading,
    error: profileError,
  } = useDoc<EmployeeProfile>(employeeDocRef);

  return {
    user,
    employeeProfile,
    isUserLoading,
    isProfileLoading,
    error: userError || profileError,
  };
};
