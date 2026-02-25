'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ChevronRight, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// ============================================
// BREADCRUMB TYPES & COMPONENTS
// ============================================

interface Breadcrumb {
  label: string;
  href?: string;
}

interface BreadcrumbsProps {
  items: Breadcrumb[];
  className?: string;
}

export function Breadcrumbs({ items, className }: BreadcrumbsProps) {
  return (
    <nav className={cn("flex items-center gap-1 text-caption", className)}>
      {items.map((item, index) => (
        <React.Fragment key={index}>
          {index > 0 && (
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />
          )}
          {item.href ? (
            <Link
              href={item.href}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              {item.label}
            </Link>
          ) : (
            <span className="text-foreground font-medium">{item.label}</span>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
}

// ============================================
// PAGE HEADER
// ============================================

interface PageHeaderProps {
  title: string;
  description?: string;
  breadcrumbs?: Breadcrumb[];
  showBackButton?: boolean;
  hideBreadcrumbs?: boolean;
  /** Where to render the back button (default: top row) */
  backButtonPlacement?: 'top' | 'inline';
  /** How the back button should navigate */
  backBehavior?: 'href' | 'history';
  backHref?: string;
  /** Used when backBehavior='history' but there is no history entry */
  fallbackBackHref?: string;
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  description,
  breadcrumbs,
  showBackButton = false,
  hideBreadcrumbs = false,
  backButtonPlacement = 'top',
  backBehavior = 'href',
  backHref,
  fallbackBackHref,
  actions,
  className,
}: PageHeaderProps) {
  const pathname = usePathname();
  const router = useRouter();

  // Auto-generate breadcrumbs if not provided
  const generatedBreadcrumbs = React.useMemo(() => {
    if (breadcrumbs) return breadcrumbs;

    const paths = pathname.split('/').filter(Boolean);
    const crumbs: Breadcrumb[] = [{ label: 'Нүүр', href: '/dashboard' }];

    // Mongolian label map
    const labelMap: Record<string, string> = {
      'dashboard': 'Хянах самбар',
      'employees': 'Ажилтнууд',
      'attendance': 'Цаг ба Ирц',
      'report': 'Ирцийн тайлан',
      'settings': 'Тохиргоо',
      'organization': 'Бүтэц',
      'onboarding': 'Дасан зохицох',
      'posts': 'Нийтлэл',
      'company': 'Компани',
      'add': 'Нэмэх',
      'edit': 'Засах',
      'questionnaire': 'Анкет',
      'documents': 'Бичиг баримт',
      'profile': 'Профайл',
      'requests': 'Хүсэлтүүд',
      'time-off': 'Чөлөө',
      'policies': 'Журам',
      'branding': 'Брэндинг',
      'employment-relations': 'Хөдөлмөрийн харилцаа',
      'vacation': 'Амралт',
      'recruitment': 'Бүрдүүлэлт',
      'points': 'Оноо',
      'videos': 'Видео',
      'mission': 'Эрхэм зорилго',
      'projects': 'Төслүүд',
      'meetings': 'Хурлын өрөө',
      'rooms': 'Өрөөнүүд',
      'business-plan': 'Бизнес төлөвлөгөө',
      'survey': 'Санал асуулга',
      'create': 'Үүсгэх',
      'results': 'Дүн',
    };

    let currentPath = '';
    paths.forEach((path, index) => {
      if (path === 'dashboard') {
        currentPath = '/dashboard';
        return;
      }

      currentPath += `/${path}`;
      const label = labelMap[path] || path.charAt(0).toUpperCase() + path.slice(1);
      
      crumbs.push({
        label,
        href: index < paths.length - 1 ? currentPath : undefined,
      });
    });

    return crumbs;
  }, [pathname, breadcrumbs]);

  const effectiveBackHref = React.useMemo(() => {
    if (backHref) return backHref;
    if (generatedBreadcrumbs.length > 1) {
      const parentCrumb = generatedBreadcrumbs[generatedBreadcrumbs.length - 2];
      return parentCrumb.href || '/dashboard';
    }
    return '/dashboard';
  }, [backHref, generatedBreadcrumbs]);

  const effectiveFallbackHref = fallbackBackHref || effectiveBackHref || '/dashboard';

  const onBack = React.useCallback(() => {
    if (backBehavior !== 'history') return;
    if (typeof window === 'undefined') {
      router.push(effectiveFallbackHref);
      return;
    }

    // Next.js sets history.state.idx in App Router. Prefer that when available.
    const idx = (window.history.state as any)?.idx;
    const hasIdxHistory = typeof idx === 'number' ? idx > 0 : false;

    let sameOriginReferrer = false;
    try {
      if (document.referrer) {
        sameOriginReferrer = new URL(document.referrer).origin === window.location.origin;
      }
    } catch {
      sameOriginReferrer = false;
    }

    // Fallback: some environments don't expose idx/referrer reliably.
    const canGoBack = hasIdxHistory || sameOriginReferrer || window.history.length > 1;
    if (canGoBack) router.back();
    else router.push(effectiveFallbackHref);
  }, [backBehavior, router, effectiveFallbackHref]);

  const showBreadcrumbs = !hideBreadcrumbs && generatedBreadcrumbs.length > 1;
  const showBackInTopRow = showBackButton && backButtonPlacement === 'top';
  const showBackInline = showBackButton && backButtonPlacement === 'inline';

  const backButton = backBehavior === 'history' ? (
    <Button variant="ghost" size="icon-sm" onClick={onBack} aria-label="Back">
      <ArrowLeft className="h-4 w-4" />
    </Button>
  ) : (
    <Button variant="ghost" size="icon-sm" asChild aria-label="Back">
      <Link href={effectiveBackHref}>
        <ArrowLeft className="h-4 w-4" />
      </Link>
    </Button>
  );

  return (
    <div className={cn("space-y-4", className)}>
      {/* Breadcrumbs & Back Button */}
      {(showBackInTopRow || showBreadcrumbs) && (
        <div className="flex items-center gap-2">
          {showBackInTopRow ? backButton : null}
          {showBreadcrumbs && (
            <Breadcrumbs items={generatedBreadcrumbs.slice(1)} />
          )}
        </div>
      )}

      {/* Title & Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-2">
          {showBackInline ? backButton : null}
          <div className="space-y-1">
            <h1 className="text-title tracking-tight">{title}</h1>
            {description && (
              <p className="text-body text-muted-foreground">{description}</p>
            )}
          </div>
        </div>
        {actions && (
          <div className="flex items-center gap-2 shrink-0">{actions}</div>
        )}
      </div>
    </div>
  );
}

// ============================================
// PAGE LAYOUT
// ============================================

interface PageLayoutProps {
  children: React.ReactNode;
  header?: React.ReactNode;
  className?: string;
}

export function PageLayout({ children, header, className }: PageLayoutProps) {
  return (
    <div className={cn("flex flex-col min-h-full", className)}>
      {header && (
        <div className="sticky top-0 z-30 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
          <div className="p-page">{header}</div>
        </div>
      )}
      <div className="flex-1 p-page">{children}</div>
    </div>
  );
}

// ============================================
// PAGE SECTION
// ============================================

interface PageSectionProps {
  title?: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function PageSection({
  title,
  description,
  actions,
  children,
  className,
}: PageSectionProps) {
  return (
    <section className={cn("space-y-4", className)}>
      {(title || actions) && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          {title && (
            <div className="space-y-1">
              <h2 className="text-subtitle font-semibold tracking-tight">{title}</h2>
              {description && (
                <p className="text-caption text-muted-foreground">{description}</p>
              )}
            </div>
          )}
          {actions && (
            <div className="flex items-center gap-2 shrink-0">{actions}</div>
          )}
        </div>
      )}
      {children}
    </section>
  );
}
