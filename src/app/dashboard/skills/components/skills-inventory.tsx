// src/app/dashboard/skills/components/skills-inventory.tsx
'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { getDocs, writeBatch, doc } from 'firebase/firestore';
import { useFirebase, useTenantWrite } from '@/firebase';
import { Card, CardContent } from '@/components/ui/card';
import { Award, RefreshCw, Search, ChevronRight, LayoutGrid, List } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/patterns/empty-state';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Employee } from '@/types';
import { Position } from '@/app/dashboard/organization/types';
import {
    SkillInventoryItem,
    SkillTypeItem,
    SKILL_LEVEL_VALUE,
    SKILL_STATUSES,
    SKILL_STATUS_LABELS,
    SKILL_STATUS_COLORS,
    getTypeColorClasses,
    buildTypeMap,
} from '../types';
import type { SkillAssessment, SkillStatus } from '../types';

interface SkillsInventoryProps {
    skills: SkillInventoryItem[];
    skillTypes: SkillTypeItem[];
    assessments: SkillAssessment[];
    employees: Employee[];
    positions: Position[];
    isLoading: boolean;
}

interface SkillKPI {
    skill: SkillInventoryItem;
    positionsRequiring: number;
    employeesAssessed: number;
    avgLevel: number;
    gapCount: number;
    levelDistribution: Record<string, number>;
}

export function SkillsInventory({
    skills,
    skillTypes,
    assessments,
    employees,
    positions,
    isLoading,
}: SkillsInventoryProps) {
    const { firestore } = useFirebase();
    const { tCollection } = useTenantWrite();
    const { toast } = useToast();
    const [isSyncing, setIsSyncing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterType, setFilterType] = useState<string>('all');
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

    const typeMap = useMemo(() => buildTypeMap(skillTypes), [skillTypes]);

    // Compute KPIs per skill
    const skillKPIs = useMemo(() => {
        const kpiMap = new Map<string, SkillKPI>();

        for (const skill of skills) {
            // Positions requiring this skill
            const posCount = positions.filter(p =>
                p.skills?.some(s => s.name === skill.name)
            ).length;

            // Assessments for this skill
            const skillAssessments = assessments.filter(a => a.skillName === skill.name);

            // Latest assessment per employee
            const latestByEmployee = new Map<string, SkillAssessment>();
            for (const a of skillAssessments) {
                const existing = latestByEmployee.get(a.employeeId);
                if (!existing || a.assessedAt > existing.assessedAt) {
                    latestByEmployee.set(a.employeeId, a);
                }
            }

            const latestAssessments = Array.from(latestByEmployee.values());

            // Average level
            let totalLevel = 0;
            const levelDist: Record<string, number> = { beginner: 0, intermediate: 0, advanced: 0, expert: 0 };
            for (const a of latestAssessments) {
                totalLevel += SKILL_LEVEL_VALUE[a.currentLevel] || 0;
                if (levelDist[a.currentLevel] !== undefined) {
                    levelDist[a.currentLevel]++;
                }
            }
            const avgLevel = latestAssessments.length > 0 ? totalLevel / latestAssessments.length : 0;

            // Gap count
            let gapCount = 0;
            for (const a of latestAssessments) {
                if (a.requiredLevel && SKILL_LEVEL_VALUE[a.requiredLevel] > SKILL_LEVEL_VALUE[a.currentLevel]) {
                    gapCount++;
                }
            }

            kpiMap.set(skill.id, {
                skill,
                positionsRequiring: posCount,
                employeesAssessed: latestAssessments.length,
                avgLevel,
                gapCount,
                levelDistribution: levelDist,
            });
        }

        return kpiMap;
    }, [skills, assessments, positions]);

    // Filter
    const filteredSkills = useMemo(() => {
        let result = skills;
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            result = result.filter(s =>
                s.name?.toLowerCase().includes(q) ||
                s.description?.toLowerCase().includes(q)
            );
        }
        if (filterType !== 'all') {
            result = result.filter(s => s.type === filterType);
        }
        if (filterStatus !== 'all') {
            result = result.filter(s => (s.status || 'active') === filterStatus);
        }
        return result;
    }, [skills, searchQuery, filterType, filterStatus]);

    const handleSyncFromPositions = async () => {
        if (!firestore) return;
        setIsSyncing(true);
        try {
            const positionsSnap = await getDocs(tCollection('positions'));
            const allUniqueSkillNames = new Set<string>();
            positionsSnap.forEach(pDoc => {
                const data = pDoc.data();
                if (data.skills && Array.isArray(data.skills)) {
                    data.skills.forEach((s: any) => {
                        if (s.name) allUniqueSkillNames.add(s.name.trim());
                    });
                }
            });
            if (allUniqueSkillNames.size === 0) {
                toast({ title: 'Бүртгэлтэй ур чадвар олдсонгүй' });
                return;
            }
            const inventorySnap = await getDocs(tCollection('skills_inventory'));
            const existingNames = new Set(inventorySnap.docs.map(d => d.data().name?.trim().toLowerCase()));
            const batch = writeBatch(firestore);
            let count = 0;
            allUniqueSkillNames.forEach(skillName => {
                if (!existingNames.has(skillName.toLowerCase())) {
                    const newDocRef = doc(tCollection('skills_inventory'));
                    batch.set(newDocRef, {
                        name: skillName,
                        createdAt: new Date().toISOString(),
                    });
                    count++;
                }
            });
            if (count > 0) {
                await batch.commit();
                toast({ title: 'Амжилттай синк хийгдлээ', description: `${count} шинэ ур чадвар нэмэгдлээ.` });
            } else {
                toast({ title: 'Бүх ур чадварууд санд бүртгэлтэй байна' });
            }
        } catch (error) {
            console.error('Sync error:', error);
            toast({ title: 'Алдаа гарлаа', variant: 'destructive' });
        } finally {
            setIsSyncing(false);
        }
    };

    // Level bar mini component
    const LevelBar = ({ distribution, total }: { distribution: Record<string, number>; total: number }) => {
        if (total === 0) return <div className="h-1.5 rounded-full bg-slate-100 w-full" />;
        return (
            <div className="flex h-1.5 rounded-full overflow-hidden w-full bg-slate-100">
                {distribution.expert > 0 && <div className="bg-purple-500 transition-all" style={{ width: `${(distribution.expert / total) * 100}%` }} />}
                {distribution.advanced > 0 && <div className="bg-emerald-500 transition-all" style={{ width: `${(distribution.advanced / total) * 100}%` }} />}
                {distribution.intermediate > 0 && <div className="bg-blue-500 transition-all" style={{ width: `${(distribution.intermediate / total) * 100}%` }} />}
                {distribution.beginner > 0 && <div className="bg-slate-300 transition-all" style={{ width: `${(distribution.beginner / total) * 100}%` }} />}
            </div>
        );
    };

    const getAvgLevelLabel = (avg: number): { label: string; color: string } => {
        if (avg === 0) return { label: '-', color: 'text-slate-400' };
        if (avg >= 3.5) return { label: 'Мэргэжилтэн', color: 'text-purple-600' };
        if (avg >= 2.5) return { label: 'Ахисан', color: 'text-emerald-600' };
        if (avg >= 1.5) return { label: 'Дунд', color: 'text-blue-600' };
        return { label: 'Анхан', color: 'text-slate-600' };
    };

    if (isLoading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-10 w-full" />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-48 w-full rounded-xl" />)}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Toolbar */}
            <div className="flex justify-end">
                <Button
                    variant="outline"
                    size="sm"
                    className="h-9 rounded-xl border-indigo-100 bg-white text-indigo-600 hover:bg-indigo-50 transition-all font-bold gap-2 px-4 shadow-sm"
                    onClick={handleSyncFromPositions}
                    disabled={isSyncing}
                >
                    <RefreshCw className={cn('h-4 w-4', isSyncing && 'animate-spin')} />
                    Ажлын байрнаас татах
                </Button>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Ур чадвар хайх..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="pl-9 h-10 rounded-xl"
                    />
                </div>
                <Select value={filterType} onValueChange={setFilterType}>
                    <SelectTrigger className="w-[180px] h-10 rounded-xl">
                        <SelectValue placeholder="Төрөл" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Бүх төрөл</SelectItem>
                        {skillTypes.map(t => (
                            <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="w-[180px] h-10 rounded-xl">
                        <SelectValue placeholder="Төлөв" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Бүх төлөв</SelectItem>
                        {SKILL_STATUSES.map(s => (
                            <SelectItem key={s} value={s}>{SKILL_STATUS_LABELS[s]}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <div className="flex items-center gap-1 ml-auto border rounded-xl p-0.5 bg-white">
                    <Button
                        variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                        size="icon"
                        className="h-8 w-8 rounded-lg"
                        onClick={() => setViewMode('grid')}
                    >
                        <LayoutGrid className="h-4 w-4" />
                    </Button>
                    <Button
                        variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                        size="icon"
                        className="h-8 w-8 rounded-lg"
                        onClick={() => setViewMode('list')}
                    >
                        <List className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {/* Active filter badges */}
            {(filterType !== 'all' || filterStatus !== 'all') && (
                <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-muted-foreground">Шүүлтүүр:</span>
                    {filterType !== 'all' && (
                        <Badge variant="outline" className="cursor-pointer text-xs" onClick={() => setFilterType('all')}>
                            {typeMap.get(filterType)?.name || filterType} &times;
                        </Badge>
                    )}
                    {filterStatus !== 'all' && (
                        <Badge variant="outline" className={cn('cursor-pointer text-xs', SKILL_STATUS_COLORS[filterStatus as SkillStatus])} onClick={() => setFilterStatus('all')}>
                            {SKILL_STATUS_LABELS[filterStatus as SkillStatus]} &times;
                        </Badge>
                    )}
                </div>
            )}

            {/* Results count */}
            <div className="text-xs text-muted-foreground">
                {filteredSkills.length} ур чадвар {filteredSkills.length !== skills.length && `(нийт ${skills.length})`}
            </div>

            {filteredSkills.length === 0 ? (
                <EmptyState
                    icon={Award}
                    title="Ур чадвар олдсонгүй"
                    description="Шүүлтүүр тохиргоог өөрчлөх эсвэл шинэ ур чадвар нэмнэ үү."
                />
            ) : viewMode === 'grid' ? (
                /* ── Grid View ── */
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredSkills.map(skill => {
                        const kpi = skillKPIs.get(skill.id);
                        const avgInfo = getAvgLevelLabel(kpi?.avgLevel || 0);
                        const skillTypeItem = skill.type ? typeMap.get(skill.type) : undefined;

                        return (
                            <Link key={skill.id} href={`/dashboard/skills/${skill.id}`}>
                                <Card className="h-full hover:shadow-lg hover:border-indigo-200 transition-all cursor-pointer group bg-white">
                                    <CardContent className="p-5 flex flex-col h-full">
                                        {/* Top: name + type */}
                                        <div className="flex items-start justify-between mb-3">
                                            <div className="flex items-center gap-2.5 min-w-0">
                                                <div className="h-9 w-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0 group-hover:bg-indigo-100 transition-colors">
                                                    <Award className="h-4.5 w-4.5" />
                                                </div>
                                                <div className="min-w-0">
                                                    <h3 className="font-semibold text-sm text-slate-800 truncate group-hover:text-indigo-700 transition-colors">
                                                        {skill.name}
                                                    </h3>
                                                </div>
                                            </div>
                                            <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-indigo-400 transition-colors flex-shrink-0 mt-1" />
                                        </div>

                                        {/* Type + Status badges */}
                                        <div className="flex items-center gap-1.5 mb-3 flex-wrap">
                                            {skillTypeItem && (
                                                <Badge variant="outline" className={cn('text-[10px] px-2 py-0.5 rounded-md font-bold', getTypeColorClasses(skillTypeItem.color))}>
                                                    {skillTypeItem.name}
                                                </Badge>
                                            )}
                                            <Badge variant="outline" className={cn('text-[10px] px-2 py-0.5 rounded-md font-bold', SKILL_STATUS_COLORS[(skill.status || 'active') as SkillStatus])}>
                                                {SKILL_STATUS_LABELS[(skill.status || 'active') as SkillStatus]}
                                            </Badge>
                                        </div>

                                        {/* Description */}
                                        {skill.description && (
                                            <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{skill.description}</p>
                                        )}

                                        {/* KPI Grid */}
                                        <div className="grid grid-cols-3 gap-2 mt-auto pt-3 border-t border-slate-100">
                                            <div className="text-center">
                                                <div className="text-lg font-bold text-slate-700">{kpi?.positionsRequiring || 0}</div>
                                                <div className="text-[9px] text-muted-foreground uppercase tracking-wide">Ажлын байр</div>
                                            </div>
                                            <div className="text-center">
                                                <div className="text-lg font-bold text-slate-700">{kpi?.employeesAssessed || 0}</div>
                                                <div className="text-[9px] text-muted-foreground uppercase tracking-wide">Үнэлэгдсэн</div>
                                            </div>
                                            <div className="text-center">
                                                <div className={cn('text-lg font-bold', kpi?.gapCount ? 'text-amber-600' : 'text-emerald-600')}>
                                                    {kpi?.gapCount || 0}
                                                </div>
                                                <div className="text-[9px] text-muted-foreground uppercase tracking-wide">Зөрүү</div>
                                            </div>
                                        </div>

                                        {/* Level distribution bar */}
                                        <div className="mt-3 space-y-1">
                                            <LevelBar distribution={kpi?.levelDistribution || {}} total={kpi?.employeesAssessed || 0} />
                                            <div className="flex items-center justify-between">
                                                <span className="text-[9px] text-muted-foreground">Түвшний тархалт</span>
                                                <span className={cn('text-[10px] font-semibold', avgInfo.color)}>
                                                    {kpi?.employeesAssessed ? `Дундаж: ${avgInfo.label}` : ''}
                                                </span>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </Link>
                        );
                    })}
                </div>
            ) : (
                /* ── List View ── */
                <Card className="overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b bg-slate-50/80">
                                    <th className="text-left px-4 py-3 font-semibold text-slate-700">Ур чадвар</th>
                                    <th className="text-left px-4 py-3 font-semibold text-slate-700">Төрөл</th>
                                    <th className="text-left px-4 py-3 font-semibold text-slate-700">Төлөв</th>
                                    <th className="text-center px-4 py-3 font-semibold text-slate-700">Ажлын байр</th>
                                    <th className="text-center px-4 py-3 font-semibold text-slate-700">Үнэлэгдсэн</th>
                                    <th className="text-center px-4 py-3 font-semibold text-slate-700">Зөрүү</th>
                                    <th className="text-center px-4 py-3 font-semibold text-slate-700">Дундаж</th>
                                    <th className="px-4 py-3 w-[120px]">Тархалт</th>
                                    <th className="w-8" />
                                </tr>
                            </thead>
                            <tbody>
                                {filteredSkills.map(skill => {
                                    const kpi = skillKPIs.get(skill.id);
                                    const avgInfo = getAvgLevelLabel(kpi?.avgLevel || 0);
                                    const listTypeItem = skill.type ? typeMap.get(skill.type) : undefined;

                                    return (
                                        <Link key={skill.id} href={`/dashboard/skills/${skill.id}`} legacyBehavior>
                                            <tr className="border-b hover:bg-slate-50/50 transition-colors cursor-pointer group">
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-2">
                                                        <div className="h-8 w-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0">
                                                            <Award className="h-4 w-4" />
                                                        </div>
                                                        <span className="font-semibold text-slate-800 group-hover:text-indigo-700 transition-colors">{skill.name}</span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3">
                                                    {listTypeItem ? (
                                                        <Badge variant="outline" className={cn('text-[10px] px-2 py-0.5 rounded-md font-bold', getTypeColorClasses(listTypeItem.color))}>
                                                            {listTypeItem.name}
                                                        </Badge>
                                                    ) : <span className="text-xs text-muted-foreground">-</span>}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <Badge variant="outline" className={cn('text-[10px] px-2 py-0.5 rounded-md font-bold', SKILL_STATUS_COLORS[(skill.status || 'active') as SkillStatus])}>
                                                        {SKILL_STATUS_LABELS[(skill.status || 'active') as SkillStatus]}
                                                    </Badge>
                                                </td>
                                                <td className="text-center px-4 py-3 font-medium">{kpi?.positionsRequiring || 0}</td>
                                                <td className="text-center px-4 py-3 font-medium">{kpi?.employeesAssessed || 0}</td>
                                                <td className="text-center px-4 py-3">
                                                    <span className={cn('font-medium', kpi?.gapCount ? 'text-amber-600' : 'text-emerald-600')}>
                                                        {kpi?.gapCount || 0}
                                                    </span>
                                                </td>
                                                <td className="text-center px-4 py-3">
                                                    <span className={cn('text-xs font-semibold', avgInfo.color)}>{avgInfo.label}</span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <LevelBar distribution={kpi?.levelDistribution || {}} total={kpi?.employeesAssessed || 0} />
                                                </td>
                                                <td className="px-2 py-3">
                                                    <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-indigo-400 transition-colors" />
                                                </td>
                                            </tr>
                                        </Link>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </Card>
            )}
        </div>
    );
}
