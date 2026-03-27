'use client';

import * as React from 'react';
import Link from 'next/link';
import { useCollection, useFirebase, useMemoFirebase, tenantCollection } from '@/firebase';
import { query, orderBy } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import {
  Briefcase,
  Calendar,
  FileText,
  PlusCircle,
  Award,
  History,
  UserCheck,
  UserPlus,
  UserX,
  Archive,
  AlertTriangle,
  ArrowRight,
  Clock,
  ExternalLink
} from 'lucide-react';
import { AddHistoryEventDialog } from './AddHistoryEventDialog';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

type EmploymentHistoryEvent = {
  id: string;
  eventType: string;
  eventDate: string;
  notes?: string;
  documentUrl?: string;
  documentId?: string;
};

const eventTypeConfig: { [key: string]: { icon: React.ElementType; color: string; bg: string } } = {
  'Ажилд авсан': { icon: UserPlus, color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-100' },
  'Туршилтын хугацаа эхэлсэн': { icon: Calendar, color: 'text-blue-600', bg: 'bg-blue-50 border-blue-100' },
  'Үндсэн ажилтан болгосон': { icon: UserCheck, color: 'text-indigo-600', bg: 'bg-indigo-50 border-indigo-100' },
  'Албан тушаал дэвшсэн': { icon: Award, color: 'text-purple-600', bg: 'bg-purple-50 border-purple-100' },
  'Шилжүүлэн томилсон': { icon: ArrowRight, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-100' },
  'Урт хугацааны чөлөө': { icon: Archive, color: 'text-slate-600', bg: 'bg-slate-50 border-slate-100' },
  'Сахилгын шийтгэл': { icon: AlertTriangle, color: 'text-rose-600', bg: 'bg-rose-50 border-rose-100' },
  'Ажлаас чөлөөлсөн': { icon: UserX, color: 'text-rose-700', bg: 'bg-rose-100 border-rose-200' },
  'Эд хөрөнгө хариуцуулсан': { icon: Briefcase, color: 'text-slate-700', bg: 'bg-slate-100 border-slate-200' },
  Бусад: { icon: FileText, color: 'text-slate-500', bg: 'bg-slate-50 border-slate-100' },
};

function TimelineItem({
  event,
  isLast,
}: {
  event: EmploymentHistoryEvent;
  isLast: boolean;
}) {
  const config = eventTypeConfig[event.eventType] || eventTypeConfig['Бусад'];
  const Icon = config.icon;
  const eventDate = format(new Date(event.eventDate), 'yyyy.MM.dd');

  return (
    <li className="relative flex items-start pb-10 group last:pb-0">
      {!isLast && (
        <div className="absolute left-6 top-10 h-full w-0.5 bg-slate-100 transition-colors group-hover:bg-indigo-100" />
      )}
      <div className={cn(
        "relative flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl border transition-all shadow-sm group-hover:scale-110",
        config.bg,
        config.color
      )}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="ml-6 flex-grow">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1 block">Үйл явдал</label>
            <h4 className="text-base font-bold text-slate-800">{event.eventType}</h4>
          </div>
          <div className="flex items-center gap-2 px-3 py-1 bg-slate-50 rounded-lg border border-slate-100 self-start sm:self-center">
            <Clock className="h-3 w-3 text-slate-400" />
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">{eventDate}</span>
          </div>
        </div>

        {(event.notes || event.documentId || event.documentUrl) && (
          <div className="p-4 rounded-2xl bg-white border border-slate-100 shadow-sm transition-all hover:shadow-md hover:border-indigo-100">
            {event.notes && (
              <p className="text-xs font-medium text-slate-500 leading-relaxed italic">"{event.notes}"</p>
            )}

            {(event.documentId || event.documentUrl) && (
              <div className={cn("flex gap-3", event.notes ? "mt-4 pt-4 border-t border-slate-50" : "")}>
                {event.documentId ? (
                  <Button asChild variant="ghost" className="h-8 px-3 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 font-bold text-[10px] uppercase tracking-wider">
                    <Link href={`/dashboard/employee-documents/${event.documentId}`}>
                      <FileText className="mr-2 h-3.5 w-3.5" />
                      Баримт бичиг
                    </Link>
                  </Button>
                ) : (
                  <Button asChild variant="ghost" className="h-8 px-3 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 font-bold text-[10px] uppercase tracking-wider">
                    <a href={event.documentUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="mr-2 h-3.5 w-3.5" />
                      Файл татах
                    </a>
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </li>
  );
}

function TimelineSkeleton() {
  return (
    <div className="space-y-10">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex items-start">
          <Skeleton className="h-12 w-12 rounded-2xl" />
          <div className="ml-6 flex-grow space-y-4">
            <div className="flex justify-between">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-6 w-24" />
            </div>
            <Skeleton className="h-20 w-full rounded-2xl" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function EmploymentHistoryTimeline({ employeeId }: { employeeId: string }) {
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const { firestore } = useFirebase();

  const historyQuery = useMemoFirebase(
    ({ firestore, companyPath }) =>
      firestore && employeeId
        ? query(
          tenantCollection(firestore, companyPath, `employees/${employeeId}/employmentHistory`),
          orderBy('eventDate', 'desc')
        )
        : null,
    [employeeId]
  );

  const {
    data: history,
    isLoading,
    error,
  } = useCollection<EmploymentHistoryEvent>(historyQuery);

  return (
    <div className="space-y-10">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400">
            <History className="h-5 w-5" />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Түүхчилсэн бүртгэл</label>
            <h3 className="text-lg font-bold text-slate-800">Process Management</h3>
          </div>
        </div>
        <Button
          size="sm"
          onClick={() => setIsDialogOpen(true)}
          className="h-10 px-5 bg-indigo-600 hover:bg-indigo-700 rounded-xl font-bold text-[10px] uppercase tracking-wider transition-all active:scale-95 shadow-md shadow-indigo-100"
        >
          <PlusCircle className="mr-2 h-4 w-4" />
          Шинэ үйл явдал
        </Button>
      </div>

      <AddHistoryEventDialog
        employeeId={employeeId}
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
      />

      <div className="relative min-h-[400px]">
        {isLoading && <TimelineSkeleton />}
        {error && (
          <div className="text-center py-20 px-6 rounded-3xl border-2 border-dashed border-rose-100 bg-rose-50/30">
            <AlertTriangle className="mx-auto h-10 w-10 text-rose-300 mb-4" />
            <p className="text-sm font-bold text-rose-600 uppercase tracking-widest">Түүхийг ачаалахад алдаа гарлаа</p>
          </div>
        )}
        {!isLoading && !error && history && history.length > 0 && (
          <ul className="space-y-0">
            {history.map((event, index) => (
              <TimelineItem
                key={`${event.id}-${index}`}
                event={event}
                isLast={index === history.length - 1}
              />
            ))}
          </ul>
        )}
        {!isLoading && !error && (!history || history.length === 0) && (
          <div className="py-24 text-center rounded-[2.5rem] border-2 border-dashed border-slate-100 flex flex-col items-center justify-center">
            <div className="h-20 w-20 rounded-3xl bg-slate-50 flex items-center justify-center text-slate-200 mb-6">
              <Briefcase className="h-10 w-10" />
            </div>
            <h4 className="text-sm font-bold text-slate-400 uppercase tracking-[0.2em] mb-2">Түүх хоосон байна</h4>
            <p className="text-xs font-semibold text-slate-300">Үйл ажиллагааны ямар нэгэн түүх бүртгэгдээгүй байна.</p>
          </div>
        )}
      </div>
    </div>
  );
}


