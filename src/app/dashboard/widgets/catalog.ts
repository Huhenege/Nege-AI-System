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
    LucideIcon
} from 'lucide-react';

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
    | 'survey';

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
}

// Default order for widgets (initial 9 cards)
export const DEFAULT_ORDER: WidgetId[] = [
    'projects',
    'employees',
    'structure',
    'attendance',
    'vacation',
    'posts',
    'recruitment',
    'points',
    'er',
    'training',
    'meetings',
    'skills',
    'business-plan',
    'survey'
];

// Widget catalog with all available widgets
export const WIDGET_CATALOG: Record<WidgetId, WidgetConfig> = {
    // Core widgets (default 9)
    projects: {
        id: 'projects',
        label: 'Төслүүд',
        description: 'Идэвхтэй төслүүд болон таскууд',
        href: '/dashboard/projects',
        size: 'normal',
        icon: FolderKanban,
        requiredData: ['projects'],
        category: 'core'
    },
    employees: {
        id: 'employees',
        label: 'Хамт олон',
        description: 'Нийт ажилтнууд',
        href: '/dashboard/employees',
        size: 'normal',
        icon: Users,
        requiredData: ['employees'],
        category: 'core'
    },
    structure: {
        id: 'structure',
        label: 'Бүтэц',
        description: 'Нэгж болон ажлын байрны тоо',
        href: '/dashboard/organization',
        size: 'normal',
        icon: Network,
        requiredData: ['departments', 'positions'],
        category: 'core'
    },
    attendance: {
        id: 'attendance',
        label: 'Ирц ба цаг',
        description: 'Ажил дээрээ байгаа болон чөлөөтэй ажилтнууд',
        href: '/dashboard/attendance',
        size: 'normal',
        icon: UserCheck,
        requiredData: ['attendance', 'timeOff'],
        category: 'core'
    },
    vacation: {
        id: 'vacation',
        label: 'Ээлжийн амралт',
        description: 'Амарч байгаа ажилтнуудын тоо',
        href: '/dashboard/vacation',
        size: 'normal',
        icon: Palmtree,
        requiredData: ['vacationRequests'],
        category: 'core'
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
        category: 'core'
    },
    points: {
        id: 'points',
        label: 'Пойнт Модул',
        description: 'Recognition System',
        href: '/dashboard/points',
        size: 'compact',
        icon: Sparkles,
        requiredData: [],
        category: 'core'
    },
    er: {
        id: 'er',
        label: 'Хөдөлмөрийн харилцаа',
        description: 'Гэрээ, протокол, баримт',
        href: '/dashboard/employment-relations',
        size: 'compact',
        icon: Handshake,
        requiredData: [],
        category: 'core'
    },
    training: {
        id: 'training',
        label: 'Сургалт хөгжил',
        description: 'Сургалт, хөгжлийн хөтөлбөрүүд',
        href: '/dashboard/training',
        size: 'compact',
        icon: GraduationCap,
        requiredData: [],
        category: 'core'
    },
    meetings: {
        id: 'meetings',
        label: 'Хурлын өрөө',
        description: 'Хурлын өрөөний захиалга',
        href: '/dashboard/meetings',
        size: 'compact',
        icon: DoorOpen,
        requiredData: [],
        category: 'core'
    },
    skills: {
        id: 'skills',
        label: 'Ур чадвар',
        description: 'Ур чадварын сан, матриц, зөрүү шинжилгээ',
        href: '/dashboard/skills',
        size: 'compact',
        icon: Award,
        requiredData: [],
        category: 'core'
    },
    'business-plan': {
        id: 'business-plan',
        label: 'Бизнес төлөвлөгөө',
        description: 'Бизнес төлөвлөлт, стратеги',
        href: '/dashboard/business-plan',
        size: 'compact',
        icon: BarChart3,
        requiredData: [],
        category: 'core'
    },
    survey: {
        id: 'survey',
        label: 'Санал асуулга',
        description: 'Ажилтнуудын санал асуулга, судалгаа',
        href: '/dashboard/survey',
        size: 'compact',
        icon: ClipboardList,
        requiredData: [],
        category: 'core'
    }
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
