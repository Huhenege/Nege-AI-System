'use client';

import * as React from 'react';
import { Clock, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import { mn } from 'date-fns/locale';
import { useFirebase, useCollection, useMemoFirebase, tenantCollection } from '@/firebase';
import { collection, query, where, orderBy, limit } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { calculateDuration } from '@/lib/attendance';
import { cn } from '@/lib/utils';
import type { AttendanceRecord } from '@/types/attendance';

interface RecentActivityListProps {
    employeeId: string;
}

export function RecentActivityList({ employeeId }: RecentActivityListProps) {
    const { firestore } = useFirebase();
    
    const attendanceLogQuery = useMemoFirebase(({ companyPath }) => employeeId ? query(
        tenantCollection(firestore, companyPath, 'attendance'),
        where('employeeId', '==', employeeId),
        orderBy('date', 'desc'),
        limit(5)
    ) : null, [firestore, employeeId]);

    const { data: logs, isLoading } = useCollection<AttendanceRecord>(attendanceLogQuery);

    if (isLoading) {
        return (
            <div className="space-y-3">
                <Skeleton className="h-14 w-full rounded-xl" />
                <Skeleton className="h-14 w-full rounded-xl" />
            </div>
        );
    }
    
    if (!logs || logs.length === 0) {
        return (
            <div className="text-center text-sm text-muted-foreground py-8 bg-muted/30 rounded-xl">
                Ирцийн бүртгэл байхгүй
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {logs.map(log => (
                <div 
                    key={log.id} 
                    className="bg-card rounded-xl border p-3 flex items-center justify-between shadow-sm hover:shadow-md transition-shadow"
                >
                    <div className="flex items-center gap-3">
                        <div className={cn(
                            "h-10 w-10 rounded-full flex items-center justify-center",
                            log.checkOutTime 
                                ? "bg-green-100 text-green-600" 
                                : "bg-blue-100 text-blue-600"
                        )}>
                            {log.checkOutTime ? <CheckCircle className="h-5 w-5" /> : <Clock className="h-5 w-5" />}
                        </div>
                        <div>
                            <p className="font-medium text-sm">
                                {format(new Date(log.date), 'MM/dd, EEEE', { locale: mn })}
                            </p>
                            <p className="text-xs text-muted-foreground">
                                {format(new Date(log.checkInTime), 'HH:mm')}
                                {log.checkOutTime ? ` - ${format(new Date(log.checkOutTime), 'HH:mm')}` : ' - ...'}
                            </p>
                        </div>
                    </div>
                    <div className="text-right">
                        <span className={cn(
                            "text-xs font-semibold px-2 py-1 rounded-full",
                            log.checkOutTime 
                                ? "bg-green-50 text-green-700" 
                                : "bg-blue-50 text-blue-700"
                        )}>
                            {log.checkOutTime 
                                ? calculateDuration(log.checkInTime, log.checkOutTime) 
                                : 'Ажиллаж байна'
                            }
                        </span>
                    </div>
                </div>
            ))}
        </div>
    );
}
