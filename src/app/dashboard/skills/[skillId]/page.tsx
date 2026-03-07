// src/app/dashboard/skills/[skillId]/page.tsx
'use client';

import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { collection, doc, query, where } from 'firebase/firestore';
import { useFirebase, useCollection, useDoc, updateDocumentNonBlocking, useTenantWrite } from '@/firebase';
import { PageHeader } from '@/components/patterns/page-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/patterns/empty-state';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import {
    Award,
    Briefcase,
    AlertTriangle,
    BarChart3,
    ClipboardCheck,
    Target,
    History,
    Pencil,
    Save,
    X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Employee, Department, isActiveStatus } from '@/types';
import { Position } from '@/app/dashboard/organization/types';
import {
    SkillInventoryItem,
    SkillTypeItem,
    SKILL_LEVEL_LABELS,
    SKILL_LEVEL_VALUE,
    SKILL_LEVELS,
    ASSESSMENT_SOURCE_LABELS,
    SKILL_STATUSES,
    SKILL_STATUS_LABELS,
    SKILL_STATUS_COLORS,
    getTypeColorClasses,
} from '../types';
import type { SkillAssessment, SkillLevel, AssessmentSource, SkillStatus } from '../types';

// ── Level visual config ──
const LEVEL_COLORS: Record<string, string> = {
    beginner: 'bg-slate-300 text-slate-700',
    intermediate: 'bg-blue-500 text-white',
    advanced: 'bg-emerald-500 text-white',
    expert: 'bg-purple-500 text-white',
};

const LEVEL_BAR_COLORS: Record<string, string> = {
    beginner: 'bg-slate-300',
    intermediate: 'bg-blue-500',
    advanced: 'bg-emerald-500',
    expert: 'bg-purple-500',
};

export default function SkillDetailPage() {
    const params = useParams();
    const skillId = Array.isArray(params.skillId) ? params.skillId[0] : params.skillId;
    const { firestore } = useFirebase();
    const { tDoc } = useTenantWrite();

    // ── Queries ──
    const skillRef = useMemo(() =>
        firestore && skillId ? doc(firestore, 'skills_inventory', skillId) : null,
        [firestore, skillId]
    );
    const { data: skill, isLoading: skillLoading } = useDoc<SkillInventoryItem>(skillRef);

    const skillTypesQuery = useMemo(() =>
        firestore ? collection(firestore, 'skill_types') : null,
        [firestore]
    );
    const { data: skillTypes } = useCollection<SkillTypeItem>(skillTypesQuery);

    const assessmentsQuery = useMemo(() =>
        firestore && skill ? query(collection(firestore, 'skill_assessments'), where('skillName', '==', skill.name)) : null,
        [firestore, skill]
    );
    const { data: allAssessments, isLoading: assessmentsLoading } = useCollection<SkillAssessment>(assessmentsQuery);

    const employeesQuery = useMemo(() =>
        firestore ? collection(firestore, 'employees') : null,
        [firestore]
    );
    const { data: employees } = useCollection<Employee>(employeesQuery);

    const positionsQuery = useMemo(() =>
        firestore ? collection(firestore, 'positions') : null,
        [firestore]
    );
    const { data: positions } = useCollection<Position>(positionsQuery);

    const departmentsQuery = useMemo(() =>
        firestore ? collection(firestore, 'departments') : null,
        [firestore]
    );
    const { data: departments } = useCollection<Department>(departmentsQuery);

    const isLoading = skillLoading || assessmentsLoading;

    // ── Computed KPIs ──

    // Latest assessment per employee
    const latestAssessments = useMemo(() => {
        const map = new Map<string, SkillAssessment>();
        for (const a of allAssessments) {
            const existing = map.get(a.employeeId);
            if (!existing || a.assessedAt > existing.assessedAt) {
                map.set(a.employeeId, a);
            }
        }
        return Array.from(map.values());
    }, [allAssessments]);

    // Positions requiring this skill
    const requiringPositions = useMemo(() => {
        if (!skill) return [];
        return positions.filter(p => p.skills?.some(s => s.name === skill.name));
    }, [positions, skill]);

    // Active employees in those positions
    const activeEmployees = useMemo(() =>
        employees.filter(e => isActiveStatus(e.status)),
        [employees]
    );

    // Department map
    const departmentMap = useMemo(() =>
        new Map(departments.map(d => [d.id, d])),
        [departments]
    );

    const positionMap = useMemo(() =>
        new Map(positions.map(p => [p.id, p])),
        [positions]
    );

    // KPI: Level distribution
    const levelDistribution = useMemo(() => {
        const dist: Record<string, number> = { beginner: 0, intermediate: 0, advanced: 0, expert: 0 };
        for (const a of latestAssessments) {
            if (dist[a.currentLevel] !== undefined) dist[a.currentLevel]++;
        }
        return dist;
    }, [latestAssessments]);

    // KPI: Assessment source breakdown
    const sourceBreakdown = useMemo(() => {
        const dist: Record<string, number> = { self: 0, manager: 0, training_completion: 0 };
        for (const a of latestAssessments) {
            if (dist[a.source] !== undefined) dist[a.source]++;
        }
        return dist;
    }, [latestAssessments]);

    // Required level distribution from positions
    const requiredLevelDistribution = useMemo(() => {
        const dist: Record<string, number> = { beginner: 0, intermediate: 0, advanced: 0, expert: 0 };
        for (const p of requiringPositions) {
            const ps = p.skills?.find(s => s.name === skill?.name);
            if (ps && dist[ps.level] !== undefined) dist[ps.level]++;
        }
        return dist;
    }, [requiringPositions, skill]);

    // Recent assessment history (all, not just latest)
    const recentHistory = useMemo(() =>
        [...allAssessments].sort((a, b) => b.assessedAt.localeCompare(a.assessedAt)).slice(0, 10),
        [allAssessments]
    );

    // Employees with gap (for the gap table)
    const employeesWithGap = useMemo(() => {
        return latestAssessments
            .filter(a => a.requiredLevel && SKILL_LEVEL_VALUE[a.requiredLevel] > SKILL_LEVEL_VALUE[a.currentLevel])
            .map(a => {
                const emp = activeEmployees.find(e => e.id === a.employeeId);
                const pos = emp?.positionId ? positionMap.get(emp.positionId) : null;
                const dept = emp ? departmentMap.get(emp.departmentId) : null;
                return { assessment: a, employee: emp, position: pos, department: dept };
            })
            .sort((a, b) => {
                const gapA = SKILL_LEVEL_VALUE[a.assessment.requiredLevel!] - SKILL_LEVEL_VALUE[a.assessment.currentLevel];
                const gapB = SKILL_LEVEL_VALUE[b.assessment.requiredLevel!] - SKILL_LEVEL_VALUE[b.assessment.currentLevel];
                return gapB - gapA;
            });
    }, [latestAssessments, activeEmployees, positionMap, departmentMap]);

    const skillTypeItem = useMemo(() => {
        if (!skill?.type) return undefined;
        return skillTypes.find(t => t.id === skill.type);
    }, [skill, skillTypes]);

    // ── Edit state ──
    const { toast } = useToast();
    const [isEditing, setIsEditing] = useState(false);
    const [editCode, setEditCode] = useState('');
    const [editName, setEditName] = useState('');
    const [editType, setEditType] = useState('');
    const [editDescription, setEditDescription] = useState('');
    const [editStatus, setEditStatus] = useState<string>('active');

    useEffect(() => {
        if (skill) {
            setEditCode(skill.code || '');
            setEditName(skill.name || '');
            setEditType(skill.type || '');
            setEditDescription(skill.description || '');
            setEditStatus(skill.status || 'active');
        }
    }, [skill]);

    const handleStartEdit = useCallback(() => {
        if (skill) {
            setEditCode(skill.code || '');
            setEditName(skill.name || '');
            setEditType(skill.type || '');
            setEditDescription(skill.description || '');
            setEditStatus(skill.status || 'active');
            setIsEditing(true);
        }
    }, [skill]);

    const handleCancelEdit = useCallback(() => {
        setIsEditing(false);
    }, []);

    const handleSave = useCallback(() => {
        if (!firestore || !skillId) return;
        if (!editName.trim()) {
            toast({ title: 'Ур чадварын нэр оруулна уу', variant: 'destructive' });
            return;
        }
        updateDocumentNonBlocking(tDoc('skills_inventory', skillId), {
            code: editCode.trim() || null,
            name: editName.trim(),
            type: editType || null,
            description: editDescription.trim() || null,
            status: editStatus || 'active',
        });
        toast({ title: 'Амжилттай хадгалагдлаа' });
        setIsEditing(false);
    }, [firestore, skillId, editCode, editName, editType, editDescription, editStatus, toast]);

    if (isLoading) {
        return (
            <div className="flex flex-col h-full overflow-hidden bg-slate-50/50">
                <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 pb-32">
                    <Skeleton className="h-12 w-64" />
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
                    </div>
                    <Skeleton className="h-[300px] rounded-xl" />
                </div>
            </div>
        );
    }

    if (!skill) {
        return (
            <div className="flex flex-col h-full overflow-hidden bg-slate-50/50">
                <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 pb-32">
                    <EmptyState icon={Award} title="Ур чадвар олдсонгүй" description="Энэ ID-тай ур чадвар бүртгэлд олдсонгүй." />
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full overflow-hidden bg-slate-50/50">
            <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 pb-32">
                {/* Header */}
                <PageHeader
                    title={skill.name}
                    description={skill.description || 'Ур чадварын дэлгэрэнгүй мэдээлэл'}
                    showBackButton
                    hideBreadcrumbs
                    backButtonPlacement="inline"
                    backBehavior="history"
                    fallbackBackHref="/dashboard/skills"
                />

                {/* ── Skill Info Card (editable) ── */}
                <Card>
                    <CardHeader className="pb-3 flex flex-row items-center justify-between">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <Award className="h-4 w-4 text-muted-foreground" />
                            Ур чадварын мэдээлэл
                        </CardTitle>
                        {!isEditing ? (
                            <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={handleStartEdit}>
                                <Pencil className="h-3.5 w-3.5" />
                                Засах
                            </Button>
                        ) : (
                            <div className="flex items-center gap-2">
                                <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={handleCancelEdit}>
                                    <X className="h-3.5 w-3.5" />
                                    Болих
                                </Button>
                                <Button size="sm" className="h-8 gap-1.5 text-xs" onClick={handleSave}>
                                    <Save className="h-3.5 w-3.5" />
                                    Хадгалах
                                </Button>
                            </div>
                        )}
                    </CardHeader>
                    <CardContent>
                        {isEditing ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-medium text-muted-foreground">Код</Label>
                                    <Input
                                        value={editCode}
                                        onChange={e => setEditCode(e.target.value)}
                                        placeholder="SKL-001"
                                        className="h-9"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-medium text-muted-foreground">Нэр <span className="text-red-500">*</span></Label>
                                    <Input
                                        value={editName}
                                        onChange={e => setEditName(e.target.value)}
                                        placeholder="Ур чадварын нэр"
                                        className="h-9"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-medium text-muted-foreground">Төрөл</Label>
                                    <Select value={editType || '__none__'} onValueChange={v => setEditType(v === '__none__' ? '' : v)}>
                                        <SelectTrigger className="h-9">
                                            <SelectValue placeholder="Төрөл сонгох" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="__none__">Төрөлгүй</SelectItem>
                                            {skillTypes.map(t => (
                                                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-medium text-muted-foreground">Төлөв</Label>
                                    <Select value={editStatus} onValueChange={setEditStatus}>
                                        <SelectTrigger className="h-9">
                                            <SelectValue placeholder="Төлөв сонгох" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {SKILL_STATUSES.map(s => (
                                                <SelectItem key={s} value={s}>{SKILL_STATUS_LABELS[s]}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1.5 md:col-span-2">
                                    <Label className="text-xs font-medium text-muted-foreground">Тодорхойлолт</Label>
                                    <Textarea
                                        value={editDescription}
                                        onChange={e => setEditDescription(e.target.value)}
                                        placeholder="Ур чадварын тодорхойлолт..."
                                        rows={3}
                                        className="resize-none"
                                    />
                                </div>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
                                <div className="space-y-0.5">
                                    <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Код</div>
                                    <div className="text-sm font-medium text-slate-800">{skill.code || <span className="text-muted-foreground italic">—</span>}</div>
                                </div>
                                <div className="space-y-0.5">
                                    <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Нэр</div>
                                    <div className="text-sm font-medium text-slate-800">{skill.name}</div>
                                </div>
                                <div className="space-y-0.5">
                                    <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Төрөл</div>
                                    <div>
                                        {skillTypeItem ? (
                                            <Badge variant="outline" className={cn('text-[10px] px-2 py-0.5 rounded-md font-bold', getTypeColorClasses(skillTypeItem.color))}>
                                                {skillTypeItem.name}
                                            </Badge>
                                        ) : (
                                            <span className="text-sm text-muted-foreground italic">—</span>
                                        )}
                                    </div>
                                </div>
                                <div className="space-y-0.5">
                                    <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Төлөв</div>
                                    <div>
                                        {skill.status ? (
                                            <Badge variant="outline" className={cn('text-[10px] px-2 py-0.5 rounded-md font-bold', SKILL_STATUS_COLORS[skill.status])}>
                                                {SKILL_STATUS_LABELS[skill.status]}
                                            </Badge>
                                        ) : (
                                            <Badge variant="outline" className={cn('text-[10px] px-2 py-0.5 rounded-md font-bold', SKILL_STATUS_COLORS.active)}>
                                                {SKILL_STATUS_LABELS.active}
                                            </Badge>
                                        )}
                                    </div>
                                </div>
                                <div className="space-y-0.5 md:col-span-2">
                                    <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Тодорхойлолт</div>
                                    <div className="text-sm text-slate-700">{skill.description || <span className="text-muted-foreground italic">—</span>}</div>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* ── Level Distribution ── */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm flex items-center gap-2">
                                <BarChart3 className="h-4 w-4 text-muted-foreground" />
                                Одоогийн түвшний тархалт
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {SKILL_LEVELS.map(level => {
                                const count = levelDistribution[level] || 0;
                                const total = latestAssessments.length;
                                const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                                return (
                                    <div key={level} className="space-y-1">
                                        <div className="flex items-center justify-between text-sm">
                                            <div className="flex items-center gap-2">
                                                <div className={cn('w-6 h-6 rounded text-[10px] flex items-center justify-center font-bold', LEVEL_COLORS[level])}>
                                                    {level.charAt(0).toUpperCase()}
                                                </div>
                                                <span className="font-medium">{SKILL_LEVEL_LABELS[level]}</span>
                                            </div>
                                            <span className="text-muted-foreground">{count} ({pct}%)</span>
                                        </div>
                                        <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                                            <div className={cn('h-full rounded-full transition-all', LEVEL_BAR_COLORS[level])} style={{ width: `${pct}%` }} />
                                        </div>
                                    </div>
                                );
                            })}
                            {latestAssessments.length === 0 && (
                                <p className="text-sm text-muted-foreground text-center py-4">Үнэлгээ хийгдээгүй байна</p>
                            )}
                        </CardContent>
                    </Card>

                    {/* ── Required Level from Positions ── */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm flex items-center gap-2">
                                <Target className="h-4 w-4 text-muted-foreground" />
                                Ажлын байрны шаардлагын түвшин
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {SKILL_LEVELS.map(level => {
                                const count = requiredLevelDistribution[level] || 0;
                                const total = requiringPositions.length;
                                const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                                return (
                                    <div key={level} className="space-y-1">
                                        <div className="flex items-center justify-between text-sm">
                                            <div className="flex items-center gap-2">
                                                <div className={cn('w-6 h-6 rounded text-[10px] flex items-center justify-center font-bold', LEVEL_COLORS[level])}>
                                                    {level.charAt(0).toUpperCase()}
                                                </div>
                                                <span className="font-medium">{SKILL_LEVEL_LABELS[level]}</span>
                                            </div>
                                            <span className="text-muted-foreground">{count} ажлын байр</span>
                                        </div>
                                        <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                                            <div className={cn('h-full rounded-full transition-all', LEVEL_BAR_COLORS[level])} style={{ width: `${pct}%` }} />
                                        </div>
                                    </div>
                                );
                            })}
                            {requiringPositions.length === 0 && (
                                <p className="text-sm text-muted-foreground text-center py-4">Ажлын байрны шаардлага тодорхойлогдоогүй</p>
                            )}
                        </CardContent>
                    </Card>

                    {/* ── Assessment Source Breakdown ── */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm flex items-center gap-2">
                                <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
                                Үнэлгээний эх сурвалж
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {latestAssessments.length === 0 ? (
                                <p className="text-sm text-muted-foreground text-center py-4">Үнэлгээ хийгдээгүй</p>
                            ) : (
                                <div className="space-y-3">
                                    {(Object.entries(sourceBreakdown) as [AssessmentSource, number][]).map(([source, count]) => {
                                        const pct = latestAssessments.length > 0 ? Math.round((count / latestAssessments.length) * 100) : 0;
                                        return (
                                            <div key={source} className="flex items-center justify-between">
                                                <span className="text-sm font-medium">{ASSESSMENT_SOURCE_LABELS[source]}</span>
                                                <div className="flex items-center gap-2">
                                                    <div className="w-24 h-2 rounded-full bg-slate-100 overflow-hidden">
                                                        <div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${pct}%` }} />
                                                    </div>
                                                    <span className="text-xs text-muted-foreground w-16 text-right">{count} ({pct}%)</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* ── Requiring Positions ── */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm flex items-center gap-2">
                                <Briefcase className="h-4 w-4 text-muted-foreground" />
                                Шаарддаг ажлын байрууд ({requiringPositions.length})
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {requiringPositions.length === 0 ? (
                                <p className="text-sm text-muted-foreground text-center py-4">Ажлын байр олдсонгүй</p>
                            ) : (
                                <div className="space-y-2 max-h-[240px] overflow-y-auto">
                                    {requiringPositions.map(pos => {
                                        const posSkill = pos.skills?.find(s => s.name === skill.name);
                                        const dept = departmentMap.get(pos.departmentId);
                                        return (
                                            <div key={pos.id} className="flex items-center justify-between rounded-lg border px-3 py-2.5 hover:bg-muted/50 transition-colors">
                                                <div>
                                                    <p className="text-sm font-medium">{pos.title}</p>
                                                    {dept && <p className="text-[10px] text-muted-foreground">{dept.name}</p>}
                                                </div>
                                                <Select
                                                    value={posSkill?.level || 'beginner'}
                                                    onValueChange={(newLevel) => {
                                                        if (!firestore) return;
                                                        const updatedSkills = (pos.skills || []).map(s =>
                                                            s.name === skill.name ? { ...s, level: newLevel } : s
                                                        );
                                                        updateDocumentNonBlocking(tDoc('positions', pos.id), { skills: updatedSkills });
                                                        toast({ title: `${pos.title} — түвшин хадгалагдлаа` });
                                                    }}
                                                >
                                                    <SelectTrigger className="w-[130px] h-7 text-[11px] font-semibold border-0 bg-transparent hover:bg-slate-100 transition-colors rounded-md px-2 gap-1">
                                                        <Badge className={cn('text-[10px] font-bold pointer-events-none', LEVEL_COLORS[posSkill?.level || 'beginner'])}>
                                                            {SKILL_LEVEL_LABELS[(posSkill?.level || 'beginner') as SkillLevel]}
                                                        </Badge>
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {SKILL_LEVELS.map(lvl => (
                                                            <SelectItem key={lvl} value={lvl}>
                                                                <div className="flex items-center gap-2">
                                                                    <div className={cn('w-5 h-5 rounded text-[9px] flex items-center justify-center font-bold', LEVEL_COLORS[lvl])}>
                                                                        {lvl.charAt(0).toUpperCase()}
                                                                    </div>
                                                                    <span className="text-xs">{SKILL_LEVEL_LABELS[lvl]}</span>
                                                                </div>
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* ── Employees with Gap ── */}
                {employeesWithGap.length > 0 && (
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm flex items-center gap-2">
                                <AlertTriangle className="h-4 w-4 text-amber-500" />
                                Зөрүүтэй ажилтнууд ({employeesWithGap.length})
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b">
                                            <th className="text-left px-3 py-2 font-semibold text-slate-600">Ажилтан</th>
                                            <th className="text-left px-3 py-2 font-semibold text-slate-600">Албан тушаал</th>
                                            <th className="text-left px-3 py-2 font-semibold text-slate-600">Нэгж</th>
                                            <th className="text-center px-3 py-2 font-semibold text-slate-600">Шаардлага</th>
                                            <th className="text-center px-3 py-2 font-semibold text-slate-600">Одоогийн</th>
                                            <th className="text-center px-3 py-2 font-semibold text-slate-600">Зөрүү</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {employeesWithGap.map(({ assessment, employee, position, department }) => {
                                            const gap = SKILL_LEVEL_VALUE[assessment.requiredLevel!] - SKILL_LEVEL_VALUE[assessment.currentLevel];
                                            return (
                                                <tr key={assessment.id} className="border-b hover:bg-slate-50/50">
                                                    <td className="px-3 py-2.5 font-medium">{assessment.employeeName}</td>
                                                    <td className="px-3 py-2.5 text-muted-foreground text-xs">{position?.title || '-'}</td>
                                                    <td className="px-3 py-2.5 text-muted-foreground text-xs">{department?.name || '-'}</td>
                                                    <td className="text-center px-3 py-2.5">
                                                        <Badge className={cn('text-[10px] font-bold', LEVEL_COLORS[assessment.requiredLevel!])}>
                                                            {SKILL_LEVEL_LABELS[assessment.requiredLevel!]}
                                                        </Badge>
                                                    </td>
                                                    <td className="text-center px-3 py-2.5">
                                                        <Badge className={cn('text-[10px] font-bold', LEVEL_COLORS[assessment.currentLevel])}>
                                                            {SKILL_LEVEL_LABELS[assessment.currentLevel]}
                                                        </Badge>
                                                    </td>
                                                    <td className="text-center px-3 py-2.5">
                                                        <Badge variant="secondary" className="bg-amber-100 text-amber-700 text-[10px] font-bold">
                                                            -{gap} түвшин
                                                        </Badge>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* ── Recent Assessment History ── */}
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <History className="h-4 w-4 text-muted-foreground" />
                            Сүүлийн үнэлгээний түүх
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {recentHistory.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-4">Үнэлгээний түүх байхгүй</p>
                        ) : (
                            <div className="space-y-2">
                                {recentHistory.map(a => (
                                    <div key={a.id} className="flex items-center justify-between rounded-lg border px-4 py-3 hover:bg-muted/50 transition-colors">
                                        <div className="space-y-0.5">
                                            <p className="text-sm font-medium">{a.employeeName}</p>
                                            <p className="text-[10px] text-muted-foreground">
                                                {ASSESSMENT_SOURCE_LABELS[a.source]} · {a.assessedByName}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="text-xs text-muted-foreground">
                                                {new Date(a.assessedAt).toLocaleDateString('mn-MN')}
                                            </span>
                                            <Badge className={cn('text-[10px] font-bold', LEVEL_COLORS[a.currentLevel])}>
                                                {SKILL_LEVEL_LABELS[a.currentLevel]}
                                            </Badge>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
