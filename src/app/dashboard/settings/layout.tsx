'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
    Hash,
    FileText,
    Clock,
    MapPin,
    Shield,
    ScrollText
} from 'lucide-react';
import { PageHeader } from '@/components/patterns/page-layout';

interface SettingsLayoutProps {
    children: React.ReactNode;
}

const settingsNavItems = [
    {
        title: "Кодчлол",
        href: "/dashboard/settings/employee-code",
        icon: Hash,
    },
    {
        title: "Цаг & Чөлөө",
        href: "/dashboard/settings/time-off",
        icon: Clock,
    },
    {
        title: "Байршил",
        href: "/dashboard/settings/attendance",
        icon: MapPin,
    },
    {
        title: "Анкет",
        href: "/dashboard/settings/questionnaire",
        icon: FileText,
    },
    {
        title: "НДШТ лавлах",
        href: "/dashboard/settings/insurance-types",
        icon: Shield,
    },
    {
        title: "Аудит лог",
        href: "/dashboard/settings/audit",
        icon: ScrollText,
    },
];

export default function SettingsLayout({ children }: SettingsLayoutProps) {
    const pathname = usePathname();

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="bg-white border-b sticky top-0 z-20">
                <div className="px-page py-4">
                    <PageHeader
                        title="Тохиргоо"
                        description="Системийн тохиргоо"
                        showBackButton={true}
                        hideBreadcrumbs={true}
                        backButtonPlacement="inline"
                        backBehavior="history"
                        fallbackBackHref="/dashboard"
                    />

                    {/* Navigation Tabs */}
                    <div className="flex items-center gap-1 overflow-x-auto no-scrollbar -mb-px mt-4">
                        {settingsNavItems.map((item) => {
                            const isActive = pathname.startsWith(item.href);
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={cn(
                                        "flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
                                        isActive
                                            ? "border-primary text-primary"
                                            : "border-transparent text-muted-foreground hover:text-foreground hover:border-slate-300"
                                    )}
                                >
                                    <item.icon className="h-4 w-4" />
                                    {item.title}
                                </Link>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto">
                <div className="p-6 md:p-8 pb-32">
                    {children}
                </div>
            </div>
        </div>
    );
}
