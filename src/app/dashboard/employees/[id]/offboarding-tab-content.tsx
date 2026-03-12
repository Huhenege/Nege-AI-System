'use client';

import React from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useFetchCollection, useMemoFirebase, updateDocumentNonBlocking, tenantCollection, useTenantWrite } from '@/firebase';
import { getDocs, query, Timestamp, where } from 'firebase/firestore';
import { Project, Task } from '@/types/project';
import { FileText, LogOut, Loader2 } from 'lucide-react';

import { Employee } from '../data';
import type { ERDocument, DocumentStatus } from '../../employment-relations/types';
import { DOCUMENT_STATUSES } from '../../employment-relations/types';

function formatActionLabel(actionId?: string) {
  if (!actionId) return 'Чөлөөлөх';
  if (actionId === 'release_company') return 'Компанийн санаачилгаар';
  if (actionId === 'release_employee') return 'Ажилтны санаачилгаар';
  if (actionId === 'release_temporary') return 'Түр чөлөөлөлт';
  return actionId;
}

function extractReleaseDate(docData?: ERDocument | null): string | null {
  const ci: any = docData?.customInputs || {};
  const raw = ci.releaseDate || ci['Ажлаас чөлөөлөх огноо'] || null;
  if (typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  return null;
}

export function OffboardingTabContent({ employeeId, employee }: { employeeId: string; employee: Employee }) {
  const { firestore, tDoc, tCollection } = useTenantWrite();

  // --- 1) ER documents (release/offboarding paperwork progress) ---
  const erDocsQuery = useMemoFirebase(({ firestore, companyPath }) => {
    if (!firestore || !employeeId) return null;
    return query(tenantCollection(firestore, companyPath, 'er_documents'), where('employeeId', '==', employeeId));
  }, [employeeId]);
  const { data: erDocs, isLoading: erDocsLoading } = useFetchCollection<ERDocument>(erDocsQuery as any);

  const releaseDocs = React.useMemo(() => {
    const list = erDocs || [];
    const filtered = list.filter((d) => String((d as any)?.metadata?.actionId || '').startsWith('release_'));
    // Sort client-side to avoid composite index requirements
    return filtered.sort((a: any, b: any) => {
      const ad = a?.createdAt?.toDate?.()?.getTime?.() || 0;
      const bd = b?.createdAt?.toDate?.()?.getTime?.() || 0;
      return bd - ad;
    });
  }, [erDocs]);

  // Finalize employee when release doc is approved/signed
  const finalizedRef = React.useRef(false);
  React.useEffect(() => {
    if (!firestore || !employeeId || !employee) return;
    if (finalizedRef.current) return;
    if (!releaseDocs || releaseDocs.length === 0) return;

    const finalDoc = releaseDocs.find((d) => d.status === 'APPROVED' || d.status === 'SIGNED');
    if (!finalDoc) return;

    // If already finalized, do nothing
    if ((employee.status === 'terminated' || employee.status === 'on_leave') && (employee.lifecycleStage === 'alumni' || employee.lifecycleStage === 'retention')) {
      finalizedRef.current = true;
      return;
    }

    const terminationDate = extractReleaseDate(finalDoc);
    finalizedRef.current = true;

    const actionId = String((finalDoc as any)?.metadata?.actionId || '');
    if (actionId === 'release_temporary') {
      // Түр чөлөөлөлт: Түр эзгүй статус, retention lifecycle
      updateDocumentNonBlocking(tDoc('employees', employeeId), {
        status: 'on_leave',
        lifecycleStage: 'retention',
        updatedAt: Timestamp.now(),
      });
    } else {
      // Бүрэн чөлөөлөлт: Ажлаас гарсан статус, alumni lifecycle
      updateDocumentNonBlocking(tDoc('employees', employeeId), {
        status: 'terminated',
        lifecycleStage: 'alumni',
        ...(terminationDate ? { terminationDate } : {}),
        updatedAt: Timestamp.now(),
      });
    }
  }, [firestore, employeeId, employee, releaseDocs]);

  // --- 2) Offboarding projects progress ---
  const projectsQuery = useMemoFirebase(({ firestore, companyPath }) => {
    if (!firestore || !employeeId) return null;
    return query(
      tenantCollection(firestore, companyPath, 'projects'),
      where('type', '==', 'offboarding'),
      where('offboardingEmployeeId', '==', employeeId)
    );
  }, [employeeId]);

  const { data: projects, isLoading } = useFetchCollection<Project>(projectsQuery as any);
  const [taskCounts, setTaskCounts] = React.useState<Record<string, { total: number; completed: number }>>({});

  React.useEffect(() => {
    async function fetchCounts() {
      if (!firestore || !projects || projects.length === 0) return;
      const counts: Record<string, { total: number; completed: number }> = {};
      for (const p of projects) {
        const snap = await getDocs(tCollection('projects', p.id, 'tasks'));
        const tasks = snap.docs.map(d => d.data() as Task);
        counts[p.id] = { total: tasks.length, completed: tasks.filter(t => t.status === 'DONE').length };
      }
      setTaskCounts(counts);
    }
    fetchCounts();
  }, [firestore, projects]);

  const sortedProjects = React.useMemo(() => {
    return [...(projects || [])].sort((a, b) => (a.stageOrder || 0) - (b.stageOrder || 0));
  }, [projects]);

  const overall = React.useMemo(() => {
    let total = 0;
    let done = 0;
    sortedProjects.forEach(p => {
      const c = taskCounts[p.id];
      if (!c) return;
      total += c.total;
      done += c.completed;
    });
    const percent = total > 0 ? Math.round((done / total) * 100) : 0;
    return { total, done, percent };
  }, [sortedProjects, taskCounts]);

  if (isLoading || erDocsLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
      </div>
    );
  }

  if (!sortedProjects.length && releaseDocs.length === 0) {
    return (
      <Card className="border-none shadow-sm bg-white rounded-2xl overflow-hidden">
        <CardContent className="p-12 text-center space-y-6">
          <div className="h-20 w-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto text-slate-400">
            <LogOut className="h-10 w-10" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">Offboarding мэдээлэл байхгүй</h3>
            <p className="text-slate-500 text-sm max-w-sm mx-auto">
              Энэ ажилтанд offboarding төслүүд болон чөлөөлөх баримт бичиг одоогоор байхгүй байна.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Release paperwork progress */}
      <Card className="border-none shadow-sm bg-white rounded-2xl overflow-hidden">
        <CardHeader className="p-6 border-b border-slate-50">
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle className="text-lg font-bold text-slate-800">Чөлөөлөх баримт бичиг</CardTitle>
              <CardDescription className="text-slate-400 text-sm">Чөлөөлөх үйл явцын баталгаажуулалтын явц</CardDescription>
            </div>
            <div className="h-10 w-10 rounded-xl bg-amber-50 flex items-center justify-center">
              <FileText className="h-5 w-5 text-amber-600" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6 space-y-3">
          {releaseDocs.length === 0 ? (
            <div className="text-sm text-slate-500">
              Энэ ажилтанд чөлөөлөх ER баримт үүсээгүй байна.
            </div>
          ) : (
            <div className="space-y-2">
              {releaseDocs.slice(0, 5).map((d: any) => {
                const statusKey = ((d?.status as DocumentStatus) || 'DRAFT') as DocumentStatus;
                const statusCfg = DOCUMENT_STATUSES[statusKey] || { label: String(d.status), color: 'bg-slate-100 text-slate-700' };
                const actionId = d?.metadata?.actionId as string | undefined;
                const createdAt = d?.createdAt?.toDate?.()?.toLocaleDateString?.() || '—';
                return (
                  <div key={d.id} className="p-3 rounded-xl border bg-white flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="font-semibold text-sm truncate">
                          {d?.metadata?.templateName || 'Чөлөөлөх баримт'}
                        </div>
                        <Badge className={`text-[10px] ${statusCfg.color}`}>{statusCfg.label}</Badge>
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {formatActionLabel(actionId)} • {createdAt}
                      </div>
                    </div>
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/dashboard/employment-relations/${d.id}`}>Нээх</Link>
                    </Button>
                  </div>
                );
              })}
            </div>
          )}

          {(employee.status === 'terminated' || employee.lifecycleStage === 'alumni') && (
            <div className="pt-2 text-[11px] text-slate-500">
              Баримт батлагдсаны дараа ажилтан **“Ажлаас гарсан”** болж, lifecycle нь **“Төгсөгч (alumni)”** болж шинэчлэгдэнэ.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Offboarding projects progress */}
      <Card className="border-none shadow-sm bg-white rounded-2xl overflow-hidden">
        <CardHeader className="p-6 border-b border-slate-50">
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle className="text-lg font-bold text-slate-800">Offboarding явц</CardTitle>
              <CardDescription className="text-slate-400 text-sm">Төслийн систем дээрх offboarding таскууд</CardDescription>
            </div>
            <div className="text-right">
              <p className="text-2xl font-black text-amber-600 leading-none">{overall.percent}%</p>
              <p className="text-[10px] font-bold text-slate-300 uppercase mt-1">Нийт явц</p>
            </div>
          </div>
          <div className="mt-4">
            <Progress value={overall.percent} className="h-2 bg-slate-100 [&>div]:bg-amber-500" />
          </div>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-slate-600 font-medium">
              Нийт таск: <span className="font-bold">{overall.done}/{overall.total}</span>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href={`/dashboard/offboarding/${employeeId}`}>Төслүүд рүү очих</Link>
            </Button>
          </div>

          <div className="space-y-2">
            {sortedProjects.map(p => {
              const c = taskCounts[p.id] || { total: 0, completed: 0 };
              const pct = c.total > 0 ? Math.round((c.completed / c.total) * 100) : 0;
              return (
                <div key={p.id} className="p-3 rounded-xl border bg-white flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="font-semibold text-sm truncate">{p.name}</div>
                    <div className="text-[10px] text-muted-foreground">{c.completed}/{c.total} таск • {pct}%</div>
                  </div>
                  <Button asChild variant="ghost" size="sm">
                    <Link href={`/dashboard/projects/${p.id}`}>Нээх</Link>
                  </Button>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

