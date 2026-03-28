'use client';

import * as React from 'react';
import { isSystemUser } from '@/lib/employee-utils';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useCollection, useFirebase, useMemoFirebase, tenantCollection } from '@/firebase';
import { query, where, collectionGroup } from 'firebase/firestore';
import { format, isWithinInterval } from 'date-fns';
import { UserCheck, CalendarCheck2, UserX, Clock, FileBarChart } from 'lucide-react';
import { isActiveStatus } from '@/types';
import { ActionIconButton } from '@/components/ui/action-icon-button';

type AttendanceRecord = {
  id: string;
  employeeId: string;
  date: string;
  checkInTime: string;
  checkOutTime?: string;
};

type TimeOffRequest = {
  id: string;
  employeeId: string;
  startDate: string;
  endDate: string;
  status: string;
};

type Employee = {
  id: string;
  status?: string;
};

export function AttendanceDashboard() {
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const today = new Date();

  const employeesQuery = useMemoFirebase(
    ({ firestore, companyPath }) => (firestore ? tenantCollection(firestore, companyPath, 'employees') : null),
    []
  );
  const attendanceQuery = useMemoFirebase(
    ({ firestore, companyPath }) =>
      firestore
        ? query(
            tenantCollection(firestore, companyPath, 'attendance'),
            where('date', '==', todayStr)
          )
        : null,
    [todayStr]
  );
  const timeOffQuery = useMemoFirebase(
    ({ firestore }) =>
      firestore
        ? query(
            collectionGroup(firestore, 'timeOffRequests'),
            where('status', '==', 'Зөвшөөрсөн')
          )
        : null,
    []
  );
  const pendingRequestsQuery = useMemoFirebase(
    ({ firestore }) =>
      firestore
        ? query(
            collectionGroup(firestore, 'timeOffRequests'),
            where('status', '==', 'Хүлээгдэж буй')
          )
        : null,
    []
  );

  const { data: employees, isLoading: isLoadingEmployees } = useCollection<Employee>(employeesQuery);
  const { data: attendanceData } = useCollection<AttendanceRecord>(attendanceQuery);
  const { data: timeOffData } = useCollection<TimeOffRequest>(timeOffQuery);
  const { data: pendingRequests } = useCollection<TimeOffRequest>(pendingRequestsQuery);

  const isLoading = isLoadingEmployees;

  const metrics = React.useMemo(() => {
    if (!employees) return null;

    const activeEmployees = employees.filter((e) => !isSystemUser(e as any) && isActiveStatus(e.status));
    const total = activeEmployees.length;

    const presentIds = new Set(
      (attendanceData || []).map((r) => r.employeeId)
    );
    const presentCount = presentIds.size;

    const onLeaveIds = new Set<string>();
    (timeOffData || []).forEach((req) => {
      try {
        const start = new Date(req.startDate);
        const end = new Date(req.endDate);
        if (isWithinInterval(today, { start, end })) {
          onLeaveIds.add(req.employeeId);
        }
      } catch {
        // skip invalid dates
      }
    });
    const onLeaveCount = onLeaveIds.size;

    const absentCount = Math.max(
      0,
      total - presentCount - onLeaveCount
    );

    const pendingCount = pendingRequests?.length ?? 0;

    return {
      presentCount,
      onLeaveCount,
      absentCount,
      pendingCount,
      total,
    };
  }, [
    employees,
    attendanceData,
    timeOffData,
    pendingRequests,
  ]);

  if (isLoading || !metrics) {
    return (
      <Card className="bg-slate-900 dark:bg-slate-800 border-slate-700">
        <CardContent className="p-5 sm:p-6">
          <Skeleton className="h-5 w-32 mb-5 bg-slate-700" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-20 rounded-xl bg-slate-700" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-slate-900 dark:bg-slate-800 border-slate-700 overflow-hidden relative">
      <div className="absolute -right-6 -bottom-6 w-28 h-28 rounded-full blur-3xl bg-gradient-to-br from-violet-500/10 to-purple-500/10" />
      <CardContent className="p-5 sm:p-6 relative z-10">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-[10px] sm:text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Dashboard | Ирц
          </h3>
          <ActionIconButton
            label="Ирцийн тайлан"
            description="Ирцийн тайлангийн хуудас"
            icon={<FileBarChart className="h-4 w-4" />}
            variant="default"
            className="text-white"
            href="/dashboard/attendance/report"
          />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="rounded-xl bg-slate-800/50 dark:bg-slate-700/30 border border-slate-700/60 p-4">
            <div className="flex items-center gap-2 mb-2">
              <UserCheck className="h-3.5 w-3.5 text-emerald-400" />
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">
                Ирсэн
              </p>
            </div>
            <div className="text-2xl font-extrabold text-emerald-400 leading-none">
              {metrics.presentCount}
            </div>
            <p className="text-[10px] text-slate-500 mt-0.5">
              Өнөөдөр бүртгэлтэй
            </p>
          </div>

          <div className="rounded-xl bg-slate-800/50 dark:bg-slate-700/30 border border-slate-700/60 p-4">
            <div className="flex items-center gap-2 mb-2">
              <CalendarCheck2 className="h-3.5 w-3.5 text-blue-400" />
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">
                Чөлөөтэй
              </p>
            </div>
            <div className="text-2xl font-extrabold text-blue-400 leading-none">
              {metrics.onLeaveCount}
            </div>
            <p className="text-[10px] text-slate-500 mt-0.5">
              Зөвшөөрсөн чөлөө
            </p>
          </div>

          <div className="rounded-xl bg-slate-800/50 dark:bg-slate-700/30 border border-slate-700/60 p-4">
            <div className="flex items-center gap-2 mb-2">
              <UserX className="h-3.5 w-3.5 text-slate-400" />
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">
                Ирээгүй
              </p>
            </div>
            <div className="text-2xl font-extrabold text-white leading-none">
              {metrics.absentCount}
            </div>
            <p className="text-[10px] text-slate-500 mt-0.5">
              Бүртгэлгүй
            </p>
          </div>

          <div className="rounded-xl bg-slate-800/50 dark:bg-slate-700/30 border border-slate-700/60 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-3.5 w-3.5 text-amber-400" />
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">
                Хүлээгдэж буй
              </p>
            </div>
            <div className="text-2xl font-extrabold text-amber-400 leading-none">
              {metrics.pendingCount}
            </div>
            <p className="text-[10px] text-slate-500 mt-0.5">
              Чөлөөний хүсэлт
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
