'use client';

import { useEffect, useState, useCallback } from 'react';
import { getJsonAuthHeaders } from '@/lib/api/client-auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, FileText, RefreshCw } from 'lucide-react';

interface AuditEntry {
  id: string;
  action: string;
  resource: string;
  resourceId?: string;
  resourceName?: string;
  actorId: string;
  actorName?: string;
  actorRole?: string;
  description: string;
  metadata?: Record<string, unknown>;
  createdAt: { _seconds: number } | string;
}

const ACTION_LABELS: Record<string, string> = {
  create: 'Үүсгэсэн',
  update: 'Засварласан',
  delete: 'Устгасан',
  login: 'Нэвтэрсэн',
  logout: 'Гарсан',
  export: 'Экспорт',
  invite: 'Урисан',
  approve: 'Зөвшөөрсөн',
  reject: 'Татгалзсан',
  assign: 'Томилсон',
  upload: 'Байршуулсан',
  settings_change: 'Тохиргоо',
};

const RESOURCE_LABELS: Record<string, string> = {
  employee: 'Ажилтан',
  project: 'Төсөл',
  task: 'Даалгавар',
  department: 'Хэлтэс',
  position: 'Албан тушаал',
  vacation: 'Амралт',
  attendance: 'Ирц',
  document: 'Баримт',
  er_document: 'ХХ Баримт',
  training: 'Сургалт',
  recruitment: 'Сонгон шалгаруулалт',
  company: 'Компани',
  billing: 'Төлбөр',
  settings: 'Тохиргоо',
  user: 'Хэрэглэгч',
};

const ACTION_COLORS: Record<string, string> = {
  create: 'bg-emerald-100 text-emerald-700',
  update: 'bg-blue-100 text-blue-700',
  delete: 'bg-red-100 text-red-700',
  login: 'bg-gray-100 text-gray-700',
  logout: 'bg-gray-100 text-gray-500',
  export: 'bg-violet-100 text-violet-700',
  invite: 'bg-sky-100 text-sky-700',
  approve: 'bg-emerald-100 text-emerald-700',
  reject: 'bg-red-100 text-red-700',
  assign: 'bg-indigo-100 text-indigo-700',
  upload: 'bg-amber-100 text-amber-700',
  settings_change: 'bg-orange-100 text-orange-700',
};

function formatDate(val: { _seconds: number } | string | undefined): string {
  if (!val) return '-';
  const d =
    typeof val === 'string'
      ? new Date(val)
      : new Date((val as { _seconds: number })._seconds * 1000);
  return d.toLocaleString('mn-MN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [resource, setResource] = useState<string>('all');

  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    try {
      const headers = await getJsonAuthHeaders();
      const params = new URLSearchParams({ limit: '100' });
      if (resource !== 'all') params.set('resource', resource);
      const res = await fetch(`/api/audit?${params}`, { headers });
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
      }
    } catch (e) {
      console.error('Failed to fetch audit logs:', e);
    } finally {
      setIsLoading(false);
    }
  }, [resource]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Үйлдлийн бүртгэл</h2>
          <p className="text-sm text-muted-foreground">
            Системийн бүх үйлдлийн түүх
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchLogs} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Шинэчлэх
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <Select value={resource} onValueChange={setResource}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Бүх нөөц" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Бүгд</SelectItem>
            {Object.entries(RESOURCE_LABELS).map(([key, label]) => (
              <SelectItem key={key} value={key}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Үйлдлийн түүх
            <Badge variant="secondary" className="ml-auto">
              {logs.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Аудит бүртгэл олдсонгүй</p>
            </div>
          ) : (
            <div className="divide-y">
              {logs.map((log) => (
                <div key={log.id} className="flex items-start gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge
                        variant="secondary"
                        className={ACTION_COLORS[log.action] || 'bg-gray-100 text-gray-700'}
                      >
                        {ACTION_LABELS[log.action] || log.action}
                      </Badge>
                      <Badge variant="outline">
                        {RESOURCE_LABELS[log.resource] || log.resource}
                      </Badge>
                      {log.actorName && (
                        <span className="text-xs text-muted-foreground">
                          {log.actorName}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm">{log.description}</p>
                    {log.resourceName && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {log.resourceName}
                      </p>
                    )}
                  </div>
                  <time className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatDate(log.createdAt)}
                  </time>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
