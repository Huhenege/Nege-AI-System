'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTenant } from '@/contexts/tenant-context';
import type { SaaSModule } from '@/types/company';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  LayoutDashboard,
  Users,
  Network,
  Building,
  Briefcase,
  Clock,
  Palmtree,
  UserPlus,
  UserCheck,
  UserMinus,
  GraduationCap,
  ClipboardList,
  Star,
  Handshake,
  Brain,
  Flag,
  Calendar,
  Video,
  Newspaper,
  FileText,
  Settings,
  CreditCard,
  ShieldCheck,
  PanelLeftClose,
  PanelLeft,
  type LucideIcon,
} from 'lucide-react';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  module?: SaaSModule;
  alwaysShow?: boolean;
}

const BASE_NAV: NavItem[] = [
  { href: '/dashboard', label: 'Нүүр хуудас', icon: LayoutDashboard, alwaysShow: true },
  { href: '/dashboard/employees', label: 'Ажилтнууд', icon: Users, module: 'employees', alwaysShow: true },
  { href: '/dashboard/organization', label: 'Бүтэц', icon: Network, module: 'organization', alwaysShow: true },
  { href: '/dashboard/company', label: 'Компани', icon: Building, module: 'company', alwaysShow: true },
];

const MODULE_NAV: NavItem[] = [
  { href: '/dashboard/projects', label: 'Төсөл', icon: Briefcase, module: 'projects' },
  { href: '/dashboard/attendance', label: 'Ирц', icon: Clock, module: 'attendance' },
  { href: '/dashboard/vacation', label: 'Амралт чөлөө', icon: Palmtree, module: 'vacation' },
  { href: '/dashboard/recruitment', label: 'Сонгон шалгаруулалт', icon: UserPlus, module: 'recruitment' },
  { href: '/dashboard/onboarding', label: 'Ажилд авах', icon: UserCheck, module: 'onboarding' },
  { href: '/dashboard/offboarding', label: 'Ажлаас гарах', icon: UserMinus, module: 'offboarding' },
  { href: '/dashboard/training', label: 'Сургалт', icon: GraduationCap, module: 'training' },
  { href: '/dashboard/survey', label: 'Санал асуулга', icon: ClipboardList, module: 'survey' },
  { href: '/dashboard/points', label: 'Оноо', icon: Star, module: 'points' },
  { href: '/dashboard/employment-relations', label: 'Хөдөлмөрийн харилцаа', icon: Handshake, module: 'employment_relations' },
  { href: '/dashboard/skills', label: 'Ур чадвар', icon: Brain, module: 'skills' },
  { href: '/dashboard/business-plan', label: 'Бизнес төлөвлөгөө', icon: Flag, module: 'business_plan' },
  { href: '/dashboard/calendar', label: 'Календар', icon: Calendar, module: 'calendar' },
  { href: '/dashboard/meetings', label: 'Уулзалт', icon: Video, module: 'meetings' },
];

const EXTRA_NAV: NavItem[] = [
  { href: '/dashboard/posts', label: 'Мэдээлэл', icon: Newspaper, alwaysShow: true },
  { href: '/dashboard/employee-documents', label: 'Баримт бичиг', icon: FileText, module: 'employees', alwaysShow: true },
  { href: '/dashboard/billing', label: 'Багц & Төлбөр', icon: CreditCard, alwaysShow: true },
  { href: '/dashboard/settings/audit', label: 'Аудит лог', icon: ShieldCheck, alwaysShow: true },
  { href: '/dashboard/settings/employee-code', label: 'Тохиргоо', icon: Settings, alwaysShow: true },
];

export function DashboardSidebar() {
  const pathname = usePathname();
  const { isModuleEnabled, isLoading } = useTenant();
  const [collapsed, setCollapsed] = useState(false);

  if (isLoading) return null;

  const visibleModules = MODULE_NAV.filter(
    (item) => !item.module || isModuleEnabled(item.module)
  );

  return (
    <aside
      className={cn(
        'flex-none flex flex-col border-r bg-muted/30 transition-all duration-200',
        collapsed ? 'w-14' : 'w-52'
      )}
    >
      <div className="flex-1 overflow-y-auto py-2 px-1.5 space-y-4">
        {/* Base */}
        <NavGroup items={BASE_NAV} pathname={pathname} collapsed={collapsed} />

        {/* Modules */}
        {visibleModules.length > 0 && (
          <>
            {!collapsed && (
              <div className="px-2">
                <div className="h-px bg-border" />
              </div>
            )}
            <NavGroup items={visibleModules} pathname={pathname} collapsed={collapsed} />
          </>
        )}

        {/* Extra */}
        {!collapsed && (
          <div className="px-2">
            <div className="h-px bg-border" />
          </div>
        )}
        <NavGroup items={EXTRA_NAV} pathname={pathname} collapsed={collapsed} />
      </div>

      {/* Collapse toggle */}
      <div className="border-t p-1.5">
        <Button
          variant="ghost"
          size="icon-sm"
          className="w-full h-8"
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </Button>
      </div>
    </aside>
  );
}

function NavGroup({
  items,
  pathname,
  collapsed,
}: {
  items: NavItem[];
  pathname: string;
  collapsed: boolean;
}) {
  return (
    <nav className="flex flex-col gap-0.5">
      {items.map((item) => {
        const isActive =
          item.href === '/dashboard'
            ? pathname === '/dashboard'
            : pathname.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            title={collapsed ? item.label : undefined}
            className={cn(
              'flex items-center gap-2.5 rounded-lg transition-colors',
              collapsed ? 'justify-center px-0 py-2' : 'px-2.5 py-2',
              isActive
                ? 'bg-primary/10 text-primary font-medium'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            <item.icon className="h-4 w-4 flex-none" />
            {!collapsed && <span className="text-[13px] truncate">{item.label}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
