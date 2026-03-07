'use client';

import * as React from 'react';
import { useTenant } from '@/contexts/tenant-context';
import {
  useFirebase,
  useUser,
  useCollection,
  tenantCollection,
} from '@/firebase';
import { query, orderBy, limit, collection } from 'firebase/firestore';
import { getJsonAuthHeaders } from '@/lib/api/client-auth';
import type { AppNotification } from '@/types/notification';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Bell,
  CheckCheck,
  Info,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  ClipboardList,
  Users,
  FolderKanban,
  Palmtree,
  Clock,
  UserPlus,
  Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { mn } from 'date-fns/locale';

const TYPE_ICONS: Record<string, React.ElementType> = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  error: AlertCircle,
  task: ClipboardList,
  employee: Users,
  project: FolderKanban,
  vacation: Palmtree,
  attendance: Clock,
  recruitment: UserPlus,
  system: Settings,
};

const TYPE_COLORS: Record<string, string> = {
  info: 'text-blue-500 bg-blue-50',
  success: 'text-emerald-500 bg-emerald-50',
  warning: 'text-amber-500 bg-amber-50',
  error: 'text-red-500 bg-red-50',
  task: 'text-violet-500 bg-violet-50',
  employee: 'text-sky-500 bg-sky-50',
  project: 'text-indigo-500 bg-indigo-50',
  vacation: 'text-teal-500 bg-teal-50',
  attendance: 'text-orange-500 bg-orange-50',
  recruitment: 'text-pink-500 bg-pink-50',
  system: 'text-gray-500 bg-gray-50',
};

export function NotificationCenter() {
  const { user } = useUser();
  const { firestore } = useFirebase();
  const { companyId } = useTenant();
  const [open, setOpen] = React.useState(false);

  const notifQuery = React.useMemo(() => {
    if (!firestore || !companyId || !user?.uid) return null;
    const col = collection(
      firestore,
      `companies/${companyId}/employees/${user.uid}/notifications`
    );
    return query(col, orderBy('createdAt', 'desc'), limit(30));
  }, [firestore, companyId, user?.uid]);

  const { data: notifications } = useCollection<AppNotification>(notifQuery);

  const unreadCount = React.useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

  const markAllRead = async () => {
    if (unreadCount === 0) return;
    try {
      const headers = await getJsonAuthHeaders();
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ all: true }),
      });
    } catch (e) {
      console.error('Failed to mark all read:', e);
    }
  };

  const markRead = async (id: string) => {
    try {
      const headers = await getJsonAuthHeaders();
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ ids: [id] }),
      });
    } catch (e) {
      console.error('Failed to mark read:', e);
    }
  };

  const formatTime = (n: AppNotification) => {
    try {
      const date = n.createdAt?.toDate?.() ?? new Date();
      return formatDistanceToNow(date, { addSuffix: true, locale: mn });
    } catch {
      return '';
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon-sm" className="relative">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
          <span className="sr-only">Мэдэгдэл</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0 sm:w-96">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h3 className="text-sm font-semibold">Мэдэгдэл</h3>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 text-xs text-muted-foreground"
              onClick={markAllRead}
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Бүгдийг уншсан
            </Button>
          )}
        </div>

        <ScrollArea className="max-h-[400px]">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Bell className="h-8 w-8 text-muted-foreground/30 mb-2" />
              <p className="text-sm text-muted-foreground">Мэдэгдэл байхгүй</p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((n) => {
                const Icon = TYPE_ICONS[n.type] || Info;
                const colorClass = TYPE_COLORS[n.type] || TYPE_COLORS.info;
                return (
                  <button
                    key={n.id}
                    className={cn(
                      'flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50',
                      !n.read && 'bg-blue-50/50 dark:bg-blue-950/20'
                    )}
                    onClick={() => {
                      if (!n.read) markRead(n.id);
                      if (n.link) {
                        window.location.href = n.link;
                        setOpen(false);
                      }
                    }}
                  >
                    <div
                      className={cn(
                        'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                        colorClass
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p
                          className={cn(
                            'text-sm leading-tight',
                            !n.read ? 'font-semibold text-foreground' : 'text-muted-foreground'
                          )}
                        >
                          {n.title}
                        </p>
                        {!n.read && (
                          <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-blue-500" />
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                        {n.body}
                      </p>
                      <p className="mt-1 text-[11px] text-muted-foreground/70">
                        {formatTime(n)}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
