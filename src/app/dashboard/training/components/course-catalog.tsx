// src/app/dashboard/training/components/course-catalog.tsx
'use client';

import React, { useState, useMemo } from 'react';
import { collection, doc } from 'firebase/firestore';
import { useFirebase, useCollection, addDocumentNonBlocking, updateDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AddActionButton } from '@/components/ui/add-action-button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyState } from '@/components/patterns/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, BookOpen, Pencil, Archive, Trash2 } from 'lucide-react';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { CreateCourseDialog } from './create-course-dialog';
import {
    TrainingCourse,
    TrainingCourseFormValues,
    TrainingCategory,
    COURSE_STATUS_LABELS,
    COURSE_TYPE_LABELS,
    SKILL_LEVEL_LABELS,
    PROVIDER_TYPE_LABELS,
} from '../types';

interface SkillItem {
    id: string;
    name: string;
    category?: string;
}

interface CourseCatalogProps {
    courses: TrainingCourse[];
    skills: SkillItem[];
    categories: TrainingCategory[];
    isLoading: boolean;
}

export function CourseCatalog({ courses, skills, categories, isLoading }: CourseCatalogProps) {
    const { firestore, user } = useFirebase();
    const { toast } = useToast();
    const [searchQuery, setSearchQuery] = useState('');
    const [categoryFilter, setCategoryFilter] = useState<string>('all');
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingCourse, setEditingCourse] = useState<TrainingCourse | null>(null);
    const [courseToDelete, setCourseToDelete] = useState<TrainingCourse | null>(null);

    const skillMap = useMemo(() => {
        const map = new Map<string, string>();
        skills.forEach(s => map.set(s.id, s.name));
        return map;
    }, [skills]);

    const categoryMap = useMemo(() => {
        const map = new Map<string, string>();
        categories.forEach(c => map.set(c.id, c.name));
        return map;
    }, [categories]);

    const filteredCourses = useMemo(() => {
        return courses.filter(course => {
            const matchesSearch =
                course.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                course.providerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                course.description.toLowerCase().includes(searchQuery.toLowerCase());

            return matchesSearch;
        });
    }, [courses, searchQuery]);

    const handleCreate = (values: TrainingCourseFormValues) => {
        if (!firestore || !user) return;
        const data = {
            ...values,
            createdAt: new Date().toISOString(),
            createdBy: user.uid,
        };
        addDocumentNonBlocking(collection(firestore, 'training_courses'), data);
        toast({ title: 'Сургалт үүсгэлээ', description: values.title });
    };

    const handleEdit = (values: TrainingCourseFormValues) => {
        if (!firestore || !editingCourse) return;
        updateDocumentNonBlocking(doc(firestore, 'training_courses', editingCourse.id), values);
        toast({ title: 'Сургалт шинэчлэгдлээ', description: values.title });
        setEditingCourse(null);
    };

    const handleArchive = (course: TrainingCourse) => {
        if (!firestore) return;
        updateDocumentNonBlocking(doc(firestore, 'training_courses', course.id), { status: 'archived' });
        toast({ title: 'Архивлагдлаа', description: course.title });
    };

    const handleDelete = (course: TrainingCourse) => {
        if (!firestore) return;
        deleteDocumentNonBlocking(doc(firestore, 'training_courses', course.id));
        toast({ title: 'Сургалт устгагдлаа', description: course.title });
        setCourseToDelete(null);
    };

    const statusColor: Record<string, string> = {
        active: 'bg-emerald-100 text-emerald-700',
        draft: 'bg-slate-100 text-slate-600',
        archived: 'bg-orange-100 text-orange-700',
    };

    return (
        <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="flex flex-1 w-full gap-3">
                    <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Сургалт хайх..."
                            className="pl-9 bg-white border shadow-sm h-11 rounded-xl"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    {/* Ангилал одоо төлөвлөгөөнд хамаарна */}
                </div>
                <AddActionButton
                    label="Шинэ сургалт"
                    description="Шинэ сургалт үүсгэх"
                    onClick={() => {
                        setEditingCourse(null);
                        setDialogOpen(true);
                    }}
                />
            </div>

            {/* Table */}
            {isLoading ? (
                <div className="space-y-3">
                    {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
                </div>
            ) : filteredCourses.length === 0 ? (
                <EmptyState
                    icon={BookOpen}
                    title="Сургалт олдсонгүй"
                    description={courses.length === 0
                        ? 'Эхний сургалтаа үүсгэнэ үү.'
                        : 'Хайлтын үр дүн олдсонгүй.'}
                    action={courses.length === 0 ? {
                        label: 'Сургалт үүсгэх',
                        onClick: () => setDialogOpen(true),
                    } : undefined}
                />
            ) : (
                <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Нэр</TableHead>
                                <TableHead>Хэлбэр</TableHead>
                                <TableHead>Түвшин</TableHead>
                                <TableHead>Хугацаа</TableHead>
                                <TableHead>Ур чадвар</TableHead>
                                <TableHead>Төлөв</TableHead>
                                <TableHead className="w-[80px]"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredCourses.map(course => (
                                <TableRow key={course.id} className="hover:bg-muted/30">
                                    <TableCell>
                                        <div>
                                            <p className="font-medium text-sm">{course.title}</p>
                                            <p className="text-xs text-muted-foreground truncate max-w-[220px]">
                                                {PROVIDER_TYPE_LABELS[course.providerType] || course.providerType} · {course.providerName}
                                            </p>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <span className="text-sm">{COURSE_TYPE_LABELS[course.type]}</span>
                                    </TableCell>
                                    <TableCell>
                                        <span className="text-sm">{SKILL_LEVEL_LABELS[course.targetLevel]}</span>
                                    </TableCell>
                                    <TableCell>
                                        <span className="text-sm">{course.duration} цаг</span>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-wrap gap-1 max-w-[180px]">
                                            {course.skillIds.slice(0, 2).map(sid => (
                                                <Badge key={sid} variant="outline" className="text-[10px]">
                                                    {skillMap.get(sid) || sid}
                                                </Badge>
                                            ))}
                                            {course.skillIds.length > 2 && (
                                                <Badge variant="outline" className="text-[10px]">
                                                    +{course.skillIds.length - 2}
                                                </Badge>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="secondary" className={statusColor[course.status] || ''}>
                                            {COURSE_STATUS_LABELS[course.status]}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-1">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8"
                                                onClick={() => {
                                                    setEditingCourse(course);
                                                    setDialogOpen(true);
                                                }}
                                                title="Засах"
                                            >
                                                <Pencil className="h-3.5 w-3.5" />
                                            </Button>
                                            {course.status !== 'archived' && (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8"
                                                    onClick={() => handleArchive(course)}
                                                    title="Архивлах"
                                                >
                                                    <Archive className="h-3.5 w-3.5" />
                                                </Button>
                                            )}
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-rose-600 hover:bg-rose-50"
                                                onClick={() => setCourseToDelete(course)}
                                                title="Устгах"
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            )}

            <AlertDialog open={!!courseToDelete} onOpenChange={(open) => { if (!open) setCourseToDelete(null); }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Сургалтыг устгах уу?</AlertDialogTitle>
                        <AlertDialogDescription>
                            &quot;{courseToDelete?.title}&quot; сургалтыг сангаас бүрмөсөн устгана. Энэ үйлдлийг буцааж болохгүй. Энэ сургалтад холбоотой төлөвлөгөөнүүд үлдэнэ.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Цуцлах</AlertDialogCancel>
                        <AlertDialogAction
                            variant="destructive"
                            onClick={() => courseToDelete && handleDelete(courseToDelete)}
                        >
                            Устгах
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Dialog */}
            <CreateCourseDialog
                open={dialogOpen}
                onOpenChange={(open) => {
                    setDialogOpen(open);
                    if (!open) setEditingCourse(null);
                }}
                onSubmit={editingCourse ? handleEdit : handleCreate}
                editingCourse={editingCourse}
                skills={skills}
                categories={categories}
            />
        </div>
    );
}
