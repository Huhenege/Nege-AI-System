'use client';

import * as React from 'react';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Shield, ShieldOff, Loader2 } from 'lucide-react';
import { useTenantWrite } from '@/firebase';
import { updateDoc, query, where, getDocs } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Employee } from '@/types';
import { getJsonAuthHeaders } from '@/lib/api/client-auth';
import { useTenant } from '@/contexts/tenant-context';
import { useUser } from '@/firebase';

interface MakeAdminDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    employee: Employee;
    currentUserId: string;
    onSuccess?: () => void;
}

export function MakeAdminDialog({
    open,
    onOpenChange,
    employee,
    currentUserId,
    onSuccess,
}: MakeAdminDialogProps) {
    const { firestore, tDoc, tCollection } = useTenantWrite();
    const { companyId } = useTenant();
    const { toast } = useToast();
    const { user: firebaseUser } = useUser();
    const [isLoading, setIsLoading] = React.useState(false);

    const isCurrentlyAdmin = employee.role === 'admin' || employee.role === 'company_super_admin';
    const isCompanySuperAdmin = employee.role === 'company_super_admin';
    const isSelf = employee.id === currentUserId;

    const handleConfirm = async () => {
        if (!firestore) return;

        // company_super_admin role cannot be changed
        if (isCompanySuperAdmin) {
            toast({
                variant: 'destructive',
                title: 'Үйлдэл хийх боломжгүй',
                description: 'Байгууллагын ерөнхий админы эрхийг өөрчлөх боломжгүй.',
            });
            return;
        }

        setIsLoading(true);

        try {
            // If removing admin, check if this is the last admin
            if (isCurrentlyAdmin) {
                const employeesRef = tCollection('employees');
                const adminQuery = query(employeesRef, where('role', 'in', ['admin', 'company_super_admin']));
                const adminSnapshot = await getDocs(adminQuery);
                
                if (adminSnapshot.size <= 1) {
                    toast({
                        variant: 'destructive',
                        title: 'Үйлдэл хийх боломжгүй',
                        description: 'Системд дор хаяж нэг админ байх ёстой.',
                    });
                    setIsLoading(false);
                    return;
                }
            }

            const newRole = isCurrentlyAdmin ? 'employee' : 'admin';

            // Set Firebase Custom Claims FIRST (auth gate) — if this fails, don't update Firestore
            const claimsRes = await fetch('/api/admin/set-tenant-claims', {
                method: 'POST',
                headers: await getJsonAuthHeaders(),
                body: JSON.stringify({
                    targetUid: employee.id,
                    role: newRole,
                    companyId,
                }),
            });

            if (!claimsRes.ok) {
                const errText = await claimsRes.text().catch(() => 'Unknown error');
                toast({
                    variant: 'destructive',
                    title: 'Эрх өөрчлөх амжилтгүй',
                    description: `Firebase эрх шинэчлэхэд алдаа гарлаа: ${errText}`,
                });
                setIsLoading(false);
                return;
            }

            // Claims succeeded — now update Firestore document
            const employeeRef = tDoc('employees', employee.id);
            await updateDoc(employeeRef, { role: newRole });

            // Force refresh current user's token so Firestore rules pick up any claim changes
            try {
                await firebaseUser?.getIdToken(true);
            } catch { /* ignore */ }

            toast({
                title: 'Амжилттай',
                description: isCurrentlyAdmin
                    ? `${employee.firstName} ажилтны админ эрхийг цуцаллаа.`
                    : `${employee.firstName} ажилтныг админ болголоо.`,
            });

            onOpenChange(false);
            onSuccess?.();
        } catch (error) {
            console.error('Error updating admin role:', error);
            toast({
                variant: 'destructive',
                title: 'Алдаа гарлаа',
                description: 'Админ эрх өөрчлөхөд алдаа гарлаа.',
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <div className="flex items-center gap-3 mb-2">
                        {isCurrentlyAdmin ? (
                            <div className="p-2 rounded-full bg-orange-100">
                                <ShieldOff className="h-5 w-5 text-orange-600" />
                            </div>
                        ) : (
                            <div className="p-2 rounded-full bg-blue-100">
                                <Shield className="h-5 w-5 text-blue-600" />
                            </div>
                        )}
                        <AlertDialogTitle>
                            {isCurrentlyAdmin ? 'Админ эрх цуцлах' : 'Админ болгох'}
                        </AlertDialogTitle>
                    </div>
                    <AlertDialogDescription className="text-left">
                        {isCompanySuperAdmin ? (
                            <span className="text-destructive">
                                Байгууллагын ерөнхий админы эрхийг өөрчлөх боломжгүй.
                            </span>
                        ) : isSelf ? (
                            <span className="text-destructive">
                                Та өөрийгөө админаас хасах боломжгүй.
                            </span>
                        ) : isCurrentlyAdmin ? (
                            <>
                                <strong>{employee.lastName} {employee.firstName}</strong> ажилтны админ эрхийг цуцлах гэж байна.
                                <br />
                                <br />
                                Энэ ажилтан системийн удирдлагын хуудас руу нэвтрэх боломжгүй болно.
                            </>
                        ) : (
                            <>
                                <strong>{employee.lastName} {employee.firstName}</strong> ажилтныг системийн админ болгох гэж байна.
                                <br />
                                <br />
                                Админ эрхтэй хэрэглэгч системийн бүх тохиргоо, ажилтнуудын мэдээлэл болон бусад чухал өгөгдөлд хандах боломжтой болно.
                            </>
                        )}
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={isLoading}>Буцах</AlertDialogCancel>
                    <AlertDialogAction
                        onClick={handleConfirm}
                        disabled={isLoading || isSelf || isCompanySuperAdmin}
                        className={isCurrentlyAdmin ? 'bg-orange-600 hover:bg-orange-700' : ''}
                    >
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {isCurrentlyAdmin ? 'Админ эрх цуцлах' : 'Админ болгох'}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
