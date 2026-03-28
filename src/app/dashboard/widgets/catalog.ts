// src/app/dashboard/widgets/catalog.ts
// Widget catalog for dashboard KPI cards

import { 
    Network, 
    Users,
    UserCheck, 
    Palmtree, 
    Newspaper, 
    Handshake, 
    Sparkles, 
    FolderKanban,
    GraduationCap,
    DoorOpen,
    Award,
    BarChart3,
    ClipboardList,
    CreditCard,
    Building,
    Calendar,
    FileText,
    Settings,
    LucideIcon
} from 'lucide-react';
import type { SaaSModule } from '@/types/company';

export type WidgetId = 
    | 'projects'
    | 'employees'
    | 'structure' 
    | 'attendance' 
    | 'vacation' 
    | 'posts' 
    | 'recruitment' 
    | 'points' 
    | 'er'
    | 'training'
    | 'meetings'
    | 'skills'
    | 'business-plan'
    | 'survey'
    | 'billing'
    | 'company'
    | 'calendar'
    | 'documents'
    | 'settings';

export type WidgetSize = 'normal' | 'compact';

export interface WidgetConfig {
    id: WidgetId;
    label: string;
    description: string;
    href?: string;
    size: WidgetSize;
    icon: LucideIcon;
    requiredData: string[];
    category: 'core' | 'kpi';
    module?: SaaSModule;
}

// Default order — анхны 8 үндсэн widget (хэт олон widget нүүр харагдахаас сэргийлнэ)
// Бусад нь "Widget нэмэх" + дарж нэмнэ
export const DEFAULT_ORDER: WidgetId[] = [
    'employees',
    'attendance',
    'projects',
    'recruitment',
    'er',
    'meetings',
    'points',
    'posts',
];

// Widget catalog with all available widgets
export const WIDGET_CATALOG: Record<WidgetId, WidgetConfig> = {
    billing: {
        id: 'billing',
        label: 'Багц & Төлбөр',
        description: 'Идэвхтэй багц, хязгаарлалт, төлбөрийн мэдээлэл',
        href: '/dashboard/billing',
        size: 'normal',
        icon: CreditCard,
        requiredData: [],
        category: 'core'
    },
    projects: {
        id: 'projects',
        label: 'Төслүүд',
        description: 'Идэвхтэй төслүүд болон таскууд',
        href: '/dashboard/projects',
        size: 'normal',
        icon: FolderKanban,
        requiredData: ['projects'],
        category: 'core',
        module: 'projects',
    },
    employees: {
        id: 'employees',
        label: 'Хамт олон',
        description: 'Нийт ажилтнууд',
        href: '/dashboard/employees',
        size: 'normal',
        icon: Users,
        requiredData: ['employees'],
        category: 'core',
        module: 'employees',
    },
    structure: {
        id: 'structure',
        label: 'Бүтэц',
        description: 'Нэгж болон ажлын байрны тоо',
        href: '/dashboard/organization',
        size: 'normal',
        icon: Network,
        requiredData: ['departments', 'positions'],
        category: 'core',
        module: 'organization',
    },
    attendance: {
        id: 'attendance',
        label: 'Ирц ба цаг',
        description: 'Ажил дээрээ байгаа болон чөлөөтэй ажилтнууд',
        href: '/dashboard/attendance',
        size: 'normal',
        icon: UserCheck,
        requiredData: ['attendance', 'timeOff'],
        category: 'core',
        module: 'attendance',
    },
    vacation: {
        id: 'vacation',
        label: 'Ээлжийн амралт',
        description: 'Амарч байгаа ажилтнуудын тоо',
        href: '/dashboard/vacation',
        size: 'normal',
        icon: Palmtree,
        requiredData: ['vacationRequests'],
        category: 'core',
        module: 'vacation',
    },
    posts: {
        id: 'posts',
        label: 'Мэдээлэл',
        description: 'Нийтлэлийн тоо',
        href: '/dashboard/posts',
        size: 'normal',
        icon: Newspaper,
        requiredData: ['posts'],
        category: 'core'
    },
    recruitment: {
        id: 'recruitment',
        label: 'Бүрдүүлэлт',
        description: 'Сонгон шалгаруулалтын хэсэг',
        href: '/dashboard/recruitment',
        size: 'normal',
        icon: Handshake,
        requiredData: [],
        category: 'core',
        module: 'recruitment',
    },
    points: {
        id: 'points',
        label: 'Пойнт Модул',
        description: 'Recognition System',
        href: '/dashboard/points',
        size: 'compact',
        icon: Sparkles,
        requiredData: [],
        category: 'core',
        module: 'points',
    },
    er: {
        id: 'er',
        label: 'Хөдөлмөрийн харилцаа',
        description: 'Гэрээ, протокол, баримт',
        href: '/dashboard/employment-relations',
        size: 'compact',
        icon: Handshake,
        requiredData: [],
        category: 'core',
        module: 'employment_relations',
    },
    training: {
        id: 'training',
        label: 'Сургалт хөгжил',
        description: 'Сургалт, хөгжлийн хөтөлбөрүүд',
        href: '/dashboard/training',
        size: 'compact',
        icon: GraduationCap,
        requiredData: [],
        category: 'core',
        module: 'training',
    },
    meetings: {
        id: 'meetings',
        label: 'Хурлын өрөө',
        description: 'Хурлын өрөөний захиалга',
        href: '/dashboard/meetings',
        size: 'compact',
        icon: DoorOpen,
        requiredData: [],
        category: 'core',
        module: 'meetings',
    },
    skills: {
        id: 'skills',
        label: 'Ур чадвар',
        description: 'Ур чадварын сан, матриц, зөрүү шинжилгээ',
        href: '/dashboard/skills',
        size: 'compact',
        icon: Award,
        requiredData: [],
        category: 'core',
        module: 'skills',
    },
    'business-plan': {
        id: 'business-plan',
        label: 'Бизнес төлөвлөгөө',
        description: 'Бизнес төлөвлөлт, стратеги',
        href: '/dashboard/business-plan',
        size: 'compact',
        icon: BarChart3,
        requiredData: [],
        category: 'core',
        module: 'business_plan',
    },
    survey: {
        id: 'survey',
        label: 'Санал асуулга',
        description: 'Ажилтнуудын санал асуулга, судалгаа',
        href: '/dashboard/survey',
        size: 'compact',
        icon: ClipboardList,
        requiredData: [],
        category: 'core',
        module: 'survey',
    },
    company: {
        id: 'company',
        label: 'Компани',
        description: 'Байгууллагын мэдээлэл, бодлого',
        href: '/dashboard/company',
        size: 'compact',
        icon: Building,
        requiredData: [],
        category: 'core',
        module: 'company',
    },
    calendar: {
        id: 'calendar',
        label: 'Календар',
        description: 'Үйл явдлын хуанли',
        href: '/dashboard/calendar',
        size: 'compact',
        icon: Calendar,
        requiredData: [],
        category: 'core',
        module: 'calendar',
    },
    documents: {
        id: 'documents',
        label: 'Баримт бичиг',
        description: 'Баримт бичгийн удирдлага',
        href: '/dashboard/employee-documents',
        size: 'compact',
        icon: FileText,
        requiredData: [],
        category: 'core'
    },
    settings: {
        id: 'settings',
        label: 'Тохиргоо',
        description: 'Системийн тохиргоо',
        href: '/dashboard/settings/employee-code',
        size: 'compact',
        icon: Settings,
        requiredData: [],
        category: 'core'
    },
};

// Get widget config by ID
export function getWidgetConfig(id: WidgetId): WidgetConfig | undefined {
    return WIDGET_CATALOG[id];
}

// Get all widget IDs
export function getAllWidgetIds(): WidgetId[] {
    return Object.keys(WIDGET_CATALOG) as WidgetId[];
}

// Get widgets by category
export function getWidgetsByCategory(category: 'core' | 'kpi'): WidgetConfig[] {
    return Object.values(WIDGET_CATALOG).filter(w => w.category === category);
}
