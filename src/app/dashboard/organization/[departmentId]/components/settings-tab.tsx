'use client';

import { getJsonAuthHeaders } from '@/lib/api/client-auth';
import React, { useState, useEffect } from 'react';
import { X, Edit3, Save, Loader2, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { mn } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { useFirebase, updateDocumentNonBlocking, useCollection, useMemoFirebase, tenantCollection, useTenantWrite } from '@/firebase';
import { useRouter } from 'next/navigation';
import { Department, DepartmentType } from '@/app/dashboard/organization/types';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface SettingsTabProps {
    department: Department;
    onSuccess?: () => void;
    hideBasicInfo?: boolean;
}

function InfoItem({ label, value }: { label: string, value: React.ReactNode }) {
    return (
        <div className="flex flex-col gap-1 p-4 rounded-xl border bg-card hover:bg-accent/50 transition-all duration-200">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
            <div className="text-sm font-semibold text-foreground truncate">
                {value || '-'}
            </div>
        </div>
    )
}


export const SettingsTab = ({ department, onSuccess, hideBasicInfo }: SettingsTabProps) => {
    const { firestore } = useFirebase();
    const { tDoc } = useTenantWrite();
    const { toast } = useToast();
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);

    // Queries for dropdowns
    const typesQuery = useMemoFirebase(({ firestore, companyPath }) => (firestore ? tenantCollection(firestore, companyPath, 'departmentTypes') : null), [firestore]);
    const deptsQuery = useMemoFirebase(({ firestore, companyPath }) => (firestore ? tenantCollection(firestore, companyPath, 'departments') : null), [firestore]);

    const { data: departmentTypes } = useCollection<DepartmentType>(typesQuery);
    const { data: allDepartments } = useCollection<Department>(deptsQuery);

    // Local state for form fields - initialize directly from prop
    const [formData, setFormData] = useState({
        name: department.name || '',
        code: department.code || '',
        status: (department.status as 'active' | 'inactive') || 'active',
        typeId: department.typeId || '',
        parentId: department.parentId || '',
        color: department.color || '#000000',
        description: department.description || '', // Чиг үүрэг
        vision: department.vision || '',      // Зорилго
    });

    // Sync local state with department prop when it changes
    useEffect(() => {
        const source = department;

        setFormData({
            name: source.name || '',
            code: source.code || '',
            status: source.status || 'active',
            typeId: source.typeId || '',
            parentId: source.parentId || '',
            color: source.color || '#000000',
            description: source.description || '',
            vision: source.vision || '',
        });
    }, [department]);

    const handleSave = async () => {
        if (!firestore) return;

        setIsLoading(true);
        try {
            const docRef = tDoc('departments', department.id);
            const dataToSave = {
                name: formData.name,
                code: formData.code,
                status: formData.status as 'active' | 'inactive',
                typeId: formData.typeId,
                parentId: formData.parentId === "root" ? "" : formData.parentId,
                color: formData.color,
                description: formData.description,
                vision: formData.vision,
            };

            await updateDocumentNonBlocking(docRef, dataToSave);

            toast({
                title: 'Амжилттай хадгалагдлаа',
                description: 'Нэгжийн мэдээлэл шинэчлэгдлээ.',
            });
            setIsEditing(false);
            onSuccess?.();
        } catch (error) {
            console.error("Error updating department:", error);
            toast({
                title: 'Алдаа гарлаа',
                description: 'Мэдээллийг хадгалж чадсангүй.',
                variant: 'destructive',
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleCancel = () => {
        // Reset form data to original values
        const source = department;
        setFormData({
            name: source.name || '',
            code: source.code || '',
            status: source.status || 'active',
            typeId: source.typeId || '',
            parentId: source.parentId || '',
            color: source.color || '#000000',
            description: source.description || '',
            vision: source.vision || '',
        });
        setIsEditing(false);
    };

    const handleAIGenerate = async () => {
        if (!formData.name) {
            toast({
                title: 'Анхааруулга',
                description: 'Нэгжийн нэр оруулсны дараа AI үүсгэх боломжтой',
                variant: 'destructive'
            });
            return;
        }

        setIsGenerating(true);
        try {
            const typeName = departmentTypes?.find(t => t.id === formData.typeId)?.name;
            const parentName = allDepartments?.find(d => d.id === formData.parentId)?.name;

            const response = await fetch('/api/generate-department-details', {
                method: 'POST',
                headers: await getJsonAuthHeaders(),
                body: JSON.stringify({
                    departmentName: formData.name,
                    departmentType: typeName,
                    parentDepartment: parentName
                }),
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'AI үүсгэхэд алдаа гарлаа');
            }

            setFormData(prev => ({
                ...prev,
                vision: result.data.vision || prev.vision,
                description: result.data.description || prev.description
            }));

            setIsEditing(true);
            toast({
                title: 'AI үүсгэлт амжилттай',
                description: 'Зорилго болон чиг үүргийг шалгаад хадгалаарай'
            });
        } catch (error) {
            console.error('AI generation error:', error);
            toast({
                title: 'Алдаа',
                description: error instanceof Error ? error.message : 'AI үүсгэхэд алдаа гарлаа',
                variant: 'destructive',
            });
        } finally {
            setIsGenerating(false);
        }
    };

    const typeName = departmentTypes?.find(t => t.id === formData.typeId)?.name || 'Нэгж';
    const parentName = allDepartments?.find(d => d.id === formData.parentId)?.name || 'Үндсэн нэгж';

    return (
        <div className="space-y-8">
            <Card className="overflow-hidden border bg-card shadow-sm rounded-xl">
                <CardContent className="p-6">
                    <div className="flex flex-col gap-6">
                        <div className="flex items-center justify-end">
                            {isEditing ? (
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={handleCancel}
                                        className="font-bold border-border/50 bg-background/50 hover:bg-background transition-all"
                                    >
                                        <X className="w-4 h-4 mr-2" />
                                        Болих
                                    </Button>
                                    <Button
                                        size="sm"
                                        onClick={handleSave}
                                        disabled={isLoading}
                                        className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-lg shadow-primary/20"
                                    >
                                        {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                                        Хадгалах
                                    </Button>
                                </div>
                            ) : (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setIsEditing(true)}
                                    className="font-bold border-border/50 bg-background/50 hover:bg-background transition-all px-4"
                                >
                                    <Edit3 className="w-4 h-4 mr-2" />
                                    Засах
                                </Button>
                            )}
                        </div>

                        {!hideBasicInfo && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {isEditing ? (
                                    <>
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Нэгжийн нэр</Label>
                                            <Input
                                                value={formData.name || ''}
                                                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                                className="h-10 bg-muted/30 focus-visible:bg-background"
                                                placeholder="Нэгжийн нэр..."
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Нэгжийн код</Label>
                                            <Input
                                                placeholder="HR-001"
                                                value={formData.code || ''}
                                                onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value }))}
                                                className="h-10 bg-muted/30 focus-visible:bg-background"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Харьяалагдах нэгж</Label>
                                            <Select
                                                value={formData.parentId || "root"}
                                                onValueChange={(val) => setFormData(prev => ({ ...prev, parentId: val === "root" ? "" : val }))}
                                            >
                                                <SelectTrigger className="h-10 bg-muted/30 focus-visible:bg-background">
                                                    <SelectValue placeholder="Харьяалагдах нэгж сонгох" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="root">(Үндсэн нэгж - Харьяалагдах нэгжгүй)</SelectItem>
                                                    {allDepartments?.filter(d => d.id !== department.id).map(d => (
                                                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Төрөл</Label>
                                            <Select
                                                value={formData.typeId || ""}
                                                onValueChange={(val) => setFormData(prev => ({ ...prev, typeId: val }))}
                                            >
                                                <SelectTrigger className="h-10 bg-muted/30 focus-visible:bg-background">
                                                    <SelectValue placeholder="Төрөл сонгох" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {departmentTypes?.map(t => (
                                                        <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Төлөв</Label>
                                            <Select
                                                value={formData.status || 'active'}
                                                onValueChange={(val) => setFormData(prev => ({ ...prev, status: val as 'active' | 'inactive' }))}
                                            >
                                                <SelectTrigger className="h-10 bg-muted/30 focus-visible:bg-background">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="active">Идэвхтэй</SelectItem>
                                                    <SelectItem value="inactive">Идэвхгүй</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <InfoItem label="Нэгжийн нэр" value={formData.name} />
                                        <InfoItem label="Нэгжийн код" value={formData.code} />
                                        <InfoItem label="Харьяалагдах нэгж" value={parentName} />
                                        <InfoItem label="Төрөл" value={typeName} />
                                        <InfoItem label="Төлөв" value={
                                            <Badge variant="outline" className={cn(
                                                "font-medium",
                                                formData.status === 'active' ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-slate-50 text-slate-600 border-slate-100"
                                            )}>
                                                {formData.status === 'active' ? 'Идэвхтэй' : 'Идэвхгүй'}
                                            </Badge>
                                        } />
                                    </>
                                )}
                            </div>
                        )}

                        <div className="mt-2 pt-8 border-t space-y-4">
                            <div className="flex items-center justify-between">
                                <h4 className="text-sm font-semibold text-foreground uppercase tracking-widest">Зорилго & Чиг үүрэг</h4>
                                {!isEditing && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={handleAIGenerate}
                                        disabled={isGenerating || !formData.name}
                                        className="h-8 gap-2 bg-gradient-to-r from-violet-50 to-indigo-50 border-violet-200 hover:from-violet-100 hover:to-indigo-100 text-violet-700"
                                    >
                                        {isGenerating ? (
                                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        ) : (
                                            <Sparkles className="w-3.5 h-3.5" />
                                        )}
                                        AI-р үүсгэх
                                    </Button>
                                )}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label className="text-xs text-muted-foreground">Зорилго</Label>
                                    <AnimatePresence mode="wait">
                                        {isEditing ? (
                                            <motion.div
                                                initial={{ opacity: 0, scale: 0.98 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                exit={{ opacity: 0, scale: 0.98 }}
                                                key="edit-vision"
                                            >
                                                <Textarea
                                                    placeholder="Нэгжийн хэтийн зорилго..."
                                                    className="min-h-[120px] resize-none bg-muted/30 border border-border/50 rounded-xl text-sm"
                                                    value={formData.vision || ''}
                                                    onChange={(e) => setFormData(prev => ({ ...prev, vision: e.target.value }))}
                                                />
                                            </motion.div>
                                        ) : (
                                            <motion.div
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                key="view-vision"
                                                className="p-4 rounded-xl bg-muted/30 border border-border/50 min-h-[120px]"
                                            >
                                                <p className="text-sm leading-relaxed text-muted-foreground italic font-medium">
                                                    {formData.vision || 'Зорилго бүртгэгдээгүй байна...'}
                                                </p>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-xs text-muted-foreground">Чиг үүрэг</Label>
                                    <AnimatePresence mode="wait">
                                        {isEditing ? (
                                            <motion.div
                                                initial={{ opacity: 0, scale: 0.98 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                exit={{ opacity: 0, scale: 0.98 }}
                                                key="edit-desc"
                                            >
                                                <Textarea
                                                    placeholder="Нэгжийн үндсэн чиг үүрэг..."
                                                    className="min-h-[120px] resize-none bg-muted/30 border border-border/50 rounded-xl text-sm"
                                                    value={formData.description || ''}
                                                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                                                />
                                            </motion.div>
                                        ) : (
                                            <motion.div
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                key="view-desc"
                                                className="p-4 rounded-xl bg-muted/30 border border-border/50 min-h-[120px]"
                                            >
                                                <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap font-medium">
                                                    {formData.description || 'Чиг үүрэг бүртгэгдээгүй байна...'}
                                                </p>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};
