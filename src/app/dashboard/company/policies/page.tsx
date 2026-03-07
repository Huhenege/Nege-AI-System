'use client';

import * as React from 'react';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Input } from '@/components/ui/input';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { MoreHorizontal, PlusCircle, Pencil, Trash2, FileText, ExternalLink, Search, ArrowUpDown, Filter, Video, Calendar, Users, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { useCollection, useFirebase, useMemoFirebase, deleteDocumentNonBlocking, tenantCollection, useTenantWrite } from '@/firebase';
import { query, orderBy } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { AddPolicyDialog, POLICY_TYPES } from './add-policy-dialog';
import { PageHeader } from '@/components/patterns/page-layout';

import { CompanyPolicy } from './types';

interface DepartmentOption {
    id: string;
    name: string;
}

interface PositionOption {
    id: string;
    title: string;
}

export default function CompanyPoliciesPage() {
    const [isDialogOpen, setIsDialogOpen] = React.useState(false);
    const [editingPolicy, setEditingPolicy] = React.useState<CompanyPolicy | null>(null);
    const [searchQuery, setSearchQuery] = React.useState('');
    const [filterType, setFilterType] = React.useState('all');
    const [sortBy, setSortBy] = React.useState('newest');

    const { firestore } = useFirebase();
    const { tDoc } = useTenantWrite();
    const { toast } = useToast();

    const policiesQuery = useMemoFirebase(({ firestore, companyPath }) => (firestore ? query(tenantCollection(firestore, companyPath, 'companyPolicies'), orderBy('uploadDate', 'desc')) : null), []);
    const departmentsQuery = useMemoFirebase(({ firestore, companyPath }) => (firestore ? tenantCollection(firestore, companyPath, 'departments') : null), []);
    const positionsQuery = useMemoFirebase(({ firestore, companyPath }) => (firestore ? tenantCollection(firestore, companyPath, 'positions') : null), []);

    const { data: policies, isLoading: isLoadingPolicies } = useCollection<CompanyPolicy>(policiesQuery);
    const { data: departments, isLoading: isLoadingDepartments } = useCollection<DepartmentOption>(departmentsQuery);
    const { data: positions, isLoading: isLoadingPositions } = useCollection<PositionOption>(positionsQuery);

    const departmentMap = React.useMemo(() => {
        if (!departments) return new Map<string, string>();
        return new Map(departments.map(d => [d.id, d.name]));
    }, [departments]);

    const positionMap = React.useMemo(() => {
        if (!positions) return new Map<string, string>();
        return new Map(positions.map(p => [p.id, p.title]));
    }, [positions]);

    const handleAddNew = () => {
        setEditingPolicy(null);
        setIsDialogOpen(true);
    };

    const handleEdit = (policy: CompanyPolicy) => {
        setEditingPolicy(policy);
        setIsDialogOpen(true);
    };

    const handleDelete = (policy: CompanyPolicy) => {
        if (!firestore) return;
        deleteDocumentNonBlocking(tDoc('companyPolicies', policy.id));
        toast({
            title: 'Амжилттай устгагдлаа',
            description: `"${policy.title}" дүрэм устгагдлаа.`,
            variant: 'destructive',
        });
    };

    const isLoading = isLoadingPolicies || isLoadingDepartments || isLoadingPositions;

    const filteredPolicies = React.useMemo(() => {
        if (!policies) return [];
        const result = policies.filter(policy => {
            const matchesSearch = policy.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                policy.description?.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesType = filterType === 'all' || policy.type === filterType;
            return matchesSearch && matchesType;
        });

        // Sorting
        result.sort((a, b) => {
            if (sortBy === 'newest') {
                const dateB = new Date(b.effectiveDate || b.uploadDate || 0).getTime();
                const dateA = new Date(a.effectiveDate || a.uploadDate || 0).getTime();
                return (isNaN(dateB) ? 0 : dateB) - (isNaN(dateA) ? 0 : dateA);
            }
            if (sortBy === 'oldest') {
                const dateB = new Date(b.effectiveDate || b.uploadDate || 0).getTime();
                const dateA = new Date(a.effectiveDate || a.uploadDate || 0).getTime();
                return (isNaN(dateA) ? 0 : dateA) - (isNaN(dateB) ? 0 : dateB);
            }
            if (sortBy === 'title_asc') {
                return a.title.localeCompare(b.title);
            }
            if (sortBy === 'title_desc') {
                return b.title.localeCompare(a.title);
            }
            return 0;
        });

        return result;
    }, [policies, searchQuery, filterType, sortBy]);

    return (
        <div className="flex flex-col h-full overflow-hidden">
            <AddPolicyDialog
                open={isDialogOpen}
                onOpenChange={setIsDialogOpen}
                editingPolicy={editingPolicy}
                departments={departments || []}
                positions={positions || []}
            />
            <div className="flex-1 overflow-y-auto p-6 md:p-8 pt-0 md:pt-0 space-y-6 pb-32">
                <PageHeader
                    title="Мөрдөгдөж буй баримт бичиг"
                    showBackButton={true}
                    hideBreadcrumbs={true}
                    backHref="/dashboard/company"
                    actions={
                        <Button onClick={handleAddNew} size="icon">
                            <PlusCircle className="h-4 w-4" />
                        </Button>
                    }
                />

                {/* Search and Filters */}
                <Card className="border shadow-sm">
                    <CardContent className="p-4">
                        <div className="space-y-4">
                            {/* Search Bar */}
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Журмын нэр, тайлбар эсвэл төрлөөр хайх..."
                                    className="pl-9 pr-9 h-11"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                                {searchQuery && (
                                    <button
                                        onClick={() => setSearchQuery('')}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                )}
                            </div>

                            {/* Filters Row */}
                            <div className="flex flex-wrap gap-3">
                                <div className="flex items-center gap-2 flex-1 min-w-[140px]">
                                    <Filter className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                    <Select value={filterType} onValueChange={setFilterType}>
                                        <SelectTrigger className="h-10">
                                            <SelectValue placeholder="Төрөл" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">Бүх төрөл</SelectItem>
                                            {POLICY_TYPES.map(type => (
                                                <SelectItem key={type} value={type}>{type}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="flex items-center gap-2 flex-1 min-w-[140px]">
                                    <ArrowUpDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                    <Select value={sortBy} onValueChange={setSortBy}>
                                        <SelectTrigger className="h-10">
                                            <SelectValue placeholder="Эрэмбэлэх" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="newest">Шинэ нь эхэндээ</SelectItem>
                                            <SelectItem value="oldest">Хуучин нь эхэндээ</SelectItem>
                                            <SelectItem value="title_asc">Нэр (А-Я)</SelectItem>
                                            <SelectItem value="title_desc">Нэр (Я-А)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            {/* Active Filters Display */}
                            {(searchQuery || filterType !== 'all') && (
                                <div className="flex flex-wrap gap-2 items-center pt-2 border-t">
                                    <span className="text-sm text-muted-foreground">Идэвхтэй шүүлт:</span>
                                    {searchQuery && (
                                        <Badge variant="secondary" className="gap-1">
                                            Хайлт: "{searchQuery}"
                                            <button onClick={() => setSearchQuery('')} className="ml-1 hover:bg-muted rounded-full p-0.5">
                                                <X className="h-3 w-3" />
                                            </button>
                                        </Badge>
                                    )}
                                    {filterType !== 'all' && (
                                        <Badge variant="secondary" className="gap-1">
                                            Төрөл: {filterType}
                                            <button onClick={() => setFilterType('all')} className="ml-1 hover:bg-muted rounded-full p-0.5">
                                                <X className="h-3 w-3" />
                                            </button>
                                        </Badge>
                                    )}
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Policies Grid */}
                {isLoading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <Card key={i} className="border shadow-sm">
                                <CardHeader>
                                    <Skeleton className="h-6 w-3/4 mb-2" />
                                    <Skeleton className="h-4 w-1/2" />
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    <Skeleton className="h-4 w-full" />
                                    <Skeleton className="h-4 w-2/3" />
                                    <div className="flex gap-2">
                                        <Skeleton className="h-6 w-20" />
                                        <Skeleton className="h-6 w-20" />
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                ) : filteredPolicies.length === 0 ? (
                    <Card className="border shadow-sm">
                        <CardContent className="p-12">
                            <div className="flex flex-col items-center justify-center gap-4 text-center">
                                <div className="rounded-full bg-muted p-4">
                                    <FileText className="h-8 w-8 text-muted-foreground" />
                                </div>
                                <div className="space-y-2">
                                    <h3 className="text-lg font-semibold">Журам олдсонгүй</h3>
                                    <p className="text-sm text-muted-foreground max-w-sm">
                                        {searchQuery || filterType !== 'all' 
                                            ? 'Таны хайлтын шүүлттэй тохирох журам олдсонгүй. Шүүлтээ өөрчлөөд дахин оролдоно уу.'
                                            : 'Одоогоор журам бүртгэгдээгүй байна. Шинэ журам нэмэхийн тулд дээрх товч дараарай.'}
                                    </p>
                                </div>
                                {!searchQuery && filterType === 'all' && (
                                    <Button onClick={handleAddNew} size="icon" variant="outline">
                                        <PlusCircle className="h-4 w-4" />
                                    </Button>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredPolicies.map((policy) => {
                            const effectiveDate = policy.effectiveDate 
                                ? (() => {
                                    try {
                                        const date = new Date(policy.effectiveDate);
                                        if (isNaN(date.getTime())) return null;
                                        return format(date, 'yyyy.MM.dd');
                                    } catch (e) {
                                        return null;
                                    }
                                })()
                                : null;

                            return (
                                <Card key={policy.id} className="border shadow-sm hover:shadow-md transition-shadow group">
                                    <CardHeader className="pb-3">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex items-start gap-3 flex-1 min-w-0">
                                                <div className="rounded-lg bg-primary/10 p-2 flex-shrink-0 mt-0.5">
                                                    <FileText className="h-4 w-4 text-primary" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <CardTitle className="text-base font-semibold line-clamp-2 group-hover:text-primary transition-colors">
                                                        {policy.title}
                                                    </CardTitle>
                                                    <div className="mt-2">
                                                        <Badge variant="outline" className="text-xs font-normal">
                                                            {policy.type || 'Тодорхойгүй'}
                                                        </Badge>
                                                    </div>
                                                </div>
                                            </div>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0">
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    {policy.documentUrl && (
                                                        <DropdownMenuItem asChild>
                                                            <a href={policy.documentUrl} target="_blank" rel="noopener noreferrer" className="w-full">
                                                                <ExternalLink className="mr-2 h-4 w-4" /> Баримт харах
                                                            </a>
                                                        </DropdownMenuItem>
                                                    )}
                                                    {policy.videoUrl && (
                                                        <DropdownMenuItem asChild>
                                                            <a href={policy.videoUrl} target="_blank" rel="noopener noreferrer" className="w-full">
                                                                <Video className="mr-2 h-4 w-4" /> Видео үзэх
                                                            </a>
                                                        </DropdownMenuItem>
                                                    )}
                                                    {(policy.documentUrl || policy.videoUrl) && <div className="my-1 h-px bg-border" />}
                                                    <DropdownMenuItem onClick={() => handleEdit(policy)}>
                                                        <Pencil className="mr-2 h-4 w-4" /> Засах
                                                    </DropdownMenuItem>
                                                    <AlertDialog>
                                                        <AlertDialogTrigger asChild>
                                                            <DropdownMenuItem onSelect={e => e.preventDefault()} className="text-destructive focus:text-destructive">
                                                                <Trash2 className="mr-2 h-4 w-4" /> Устгах
                                                            </DropdownMenuItem>
                                                        </AlertDialogTrigger>
                                                        <AlertDialogContent>
                                                            <AlertDialogHeader>
                                                                <AlertDialogTitle>Та итгэлтэй байна уу?</AlertDialogTitle>
                                                                <AlertDialogDescription>
                                                                    Энэ үйлдлийг буцаах боломжгүй. Та "{policy.title}" журмыг устгах гэж байна.
                                                                </AlertDialogDescription>
                                                            </AlertDialogHeader>
                                                            <AlertDialogFooter>
                                                                <AlertDialogCancel>Цуцлах</AlertDialogCancel>
                                                                <AlertDialogAction onClick={() => handleDelete(policy)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                                                    Тийм, устгах
                                                                </AlertDialogAction>
                                                            </AlertDialogFooter>
                                                        </AlertDialogContent>
                                                    </AlertDialog>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        {policy.description && (
                                            <p className="text-sm text-muted-foreground line-clamp-2">
                                                {policy.description}
                                            </p>
                                        )}

                                        <div className="space-y-2">
                                            <div className="flex items-center gap-2 text-sm">
                                                <Users className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                                <div className="flex-1 min-w-0">
                                                    {policy.appliesToAll ? (
                                                        <Badge variant="secondary" className="text-xs">Бүх ажилтан</Badge>
                                                    ) : (() => {
                                                        const selectionType = policy.selectionType || (policy.applicableDepartmentIds?.length ? 'departments' : 'positions');
                                                        
                                                        if (selectionType === 'departments' && policy.applicableDepartmentIds && policy.applicableDepartmentIds.length > 0) {
                                                            return (
                                                                <div className="flex flex-wrap gap-1">
                                                                    {Array.from(new Set(policy.applicableDepartmentIds)).slice(0, 2).map(id => (
                                                                        <Badge key={id} variant="outline" className="text-xs">
                                                                            {departmentMap.get(id) || 'Тодорхойгүй'}
                                                                        </Badge>
                                                                    ))}
                                                                    {policy.applicableDepartmentIds.length > 2 && (
                                                                        <Badge variant="outline" className="text-xs">
                                                                            +{policy.applicableDepartmentIds.length - 2}
                                                                        </Badge>
                                                                    )}
                                                                </div>
                                                            );
                                                        } else if (selectionType === 'positions' && policy.applicablePositionIds && policy.applicablePositionIds.length > 0) {
                                                            return (
                                                                <div className="flex flex-wrap gap-1">
                                                                    {Array.from(new Set(policy.applicablePositionIds)).slice(0, 2).map(id => (
                                                                        <Badge key={id} variant="outline" className="text-xs">
                                                                            {positionMap.get(id) || 'Тодорхойгүй'}
                                                                        </Badge>
                                                                    ))}
                                                                    {policy.applicablePositionIds.length > 2 && (
                                                                        <Badge variant="outline" className="text-xs">
                                                                            +{policy.applicablePositionIds.length - 2}
                                                                        </Badge>
                                                                    )}
                                                                </div>
                                                            );
                                                        } else {
                                                            // Legacy fallback - show old applicablePositionIds if exists
                                                            if (policy.applicablePositionIds && policy.applicablePositionIds.length > 0) {
                                                                return (
                                                                    <Badge variant="outline" className="text-xs opacity-75">Ажлын байрнууд (хуучин)</Badge>
                                                                );
                                                            }
                                                            return (
                                                                <span className="text-xs text-muted-foreground">Тохируулаагүй</span>
                                                            );
                                                        }
                                                    })()}
                                                </div>
                                            </div>

                                            {effectiveDate && (
                                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                    <Calendar className="h-4 w-4 flex-shrink-0" />
                                                    <span>Батлагдсан: {effectiveDate}</span>
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex flex-wrap gap-2 pt-2 border-t">
                                            {policy.documentUrl && (
                                                <Badge variant="outline" className="text-xs text-emerald-600 bg-emerald-50 border-emerald-200 hover:bg-emerald-100">
                                                    <FileText className="h-3 w-3 mr-1" /> Баримт
                                                </Badge>
                                            )}
                                            {policy.videoUrl && (
                                                <Badge variant="outline" className="text-xs text-blue-600 bg-blue-50 border-blue-200 hover:bg-blue-100">
                                                    <Video className="h-3 w-3 mr-1" /> Видео
                                                </Badge>
                                            )}
                                            {!policy.documentUrl && !policy.videoUrl && (
                                                <span className="text-xs text-muted-foreground italic">Хавсралт байхгүй</span>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
