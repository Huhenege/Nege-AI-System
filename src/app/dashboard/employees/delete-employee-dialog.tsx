// src/app/dashboard/employees/delete-employee-dialog.tsx
'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { updateDocumentNonBlocking, useTenantWrite } from '@/firebase';
import { getDoc, writeBatch, increment } from 'firebase/firestore';
import type { Employee } from './data';
import { useRouter } from 'next/navigation';

const deleteSchema = z.object({
  reason: z.enum(['Ажлаас чөлөөлөгдсөн', 'Түр чөлөөлсөн', 'Алдаатай бүртгэл']),
});

type DeleteFormValues = z.infer<typeof deleteSchema>;

interface DeleteEmployeeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: Employee | null;
}

export function DeleteEmployeeDialog({
  open,
  onOpenChange,
  employee,
}: DeleteEmployeeDialogProps) {
  const { firestore, tDoc } = useTenantWrite();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const router = useRouter();

  const form = useForm<DeleteFormValues>({
    resolver: zodResolver(deleteSchema),
  });

  const onSubmit = async (data: DeleteFormValues) => {
    if (!employee || !firestore) return;

    setIsSubmitting(true);

    let newStatus: Employee['status'];
    switch (data.reason) {
      case 'Ажлаас чөлөөлөгдсөн':
      case 'Алдаатай бүртгэл':
        newStatus = 'terminated';
        break;
      case 'Түр чөлөөлсөн':
        newStatus = 'suspended';
        break;
    }

    try {
      // NOTE: Temporarily disabling auth user update due to missing server config.
      // This will only update the Firestore record. The user can still log in.
      // const response = await fetch('/api/update-user-status', {
      //   method: 'POST',
      //   headers: {
      //     'Content-Type': 'application/json',
      //   },
      //   body: JSON.stringify({ uid: employee.id, disabled: true }),
      // });

      // if (!response.ok) {
      //   const errorData = await response.json();
      //   throw new Error(errorData.error || 'Failed to disable user account.');
      // }

      // Step 2: Update Firestore document status and position counts
      const batch = writeBatch(firestore);
      const employeeDocRef = tDoc('employees', employee.id);

      batch.update(employeeDocRef, {
        status: newStatus,
        terminationDate: new Date().toISOString()
      });

      // 3. Decrement position filled count if employee was assigned
      if (employee.positionId && newStatus === 'terminated') {
        const posRef = tDoc('positions', employee.positionId);
        const posSnap = await getDoc(posRef);
        if (posSnap.exists()) {
          const currentFilled = posSnap.data().filled || 0;
          batch.update(posRef, { filled: Math.max(0, currentFilled - 1) });
        }
      }

      await batch.commit();

      toast({
        title: 'Ажилтан идэвхгүйжлээ',
        description: `${employee.firstName} ${employee.lastName}-н төлөв шинэчлэгдлээ.`,
      });
      onOpenChange(false);
      form.reset();
      // Force a refresh of the current route to reflect changes
      router.refresh();


    } catch (error: any) {
      console.error("Error deactivating employee:", error);
      toast({
        variant: 'destructive',
        title: 'Алдаа гарлаа',
        description: error.message || 'Ажилтныг идэвхгүй болгоход алдаа гарлаа.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <DialogHeader>
              <DialogTitle>Ажилтныг идэвхгүй болгох</DialogTitle>
              <DialogDescription>
                {employee?.firstName} {employee?.lastName}-г идэвхгүй болгох гэж байна. Шалтгаанаа сонгоно уу. Энэ үйлдэл нь ажилтны нэвтрэх эрхийг хаах болно.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <FormField
                control={form.control}
                name="reason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Шалтгаан</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Шалтгаан сонгоно уу..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Ажлаас чөлөөлөгдсөн">Ажлаас чөлөөлөгдсөн</SelectItem>
                        <SelectItem value="Түр чөлөөлсөн">Түр чөлөөлсөн</SelectItem>
                        <SelectItem value="Алдаатай бүртгэл">Алдаатай бүртгэл</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Цуцлах
              </Button>
              <Button type="submit" variant="destructive" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Идэвхгүй болгох
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
