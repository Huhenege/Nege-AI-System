'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { AddActionButton } from '@/components/ui/add-action-button';
import { Input } from '@/components/ui/input';
import {
    X,
    Coffee,
    Smartphone,
    Car,
    Laptop,
    Gift,
    Shield,
    AlertCircle
} from 'lucide-react';
import { Position } from '../../../types';
import { doc } from 'firebase/firestore';
import { useFirebase, updateDocumentNonBlocking, useTenantWrite } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { CurrencyInput } from './currency-input';
import { FieldCard } from '@/components/organization/field-card';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

interface PositionBenefitsProps {
    position: Position;
}

const PERIOD_LABELS: Record<string, string> = {
    once: 'Нэг удаа',
    daily: 'Өдөр бүр',
    monthly: 'Сар бүр',
    quarterly: 'Улирал бүр',
    'semi-annually': 'Хагас жил',
    yearly: 'Жил бүр'
};

export function PositionBenefits({
    position
}: PositionBenefitsProps) {
    const { firestore } = useFirebase();
    const { tDoc } = useTenantWrite();
    const { toast } = useToast();

    const [editAllowances, setEditAllowances] = useState<any[]>(position.allowances || []);

    // Sync when position changes
    React.useEffect(() => {
        setEditAllowances(position.allowances || []);
    }, [position]);

    const handleAddAllowance = () => {
        setEditAllowances(prev => [...prev, { type: '', amount: 0, currency: 'MNT', period: 'monthly' }]);
    };

    const removeAllowance = (index: number) => {
        setEditAllowances(prev => prev.filter((_, i) => i !== index));
    };

    const updateAllowance = (index: number, field: string, value: any) => {
        setEditAllowances(prev => {
            const newList = [...prev];
            newList[index] = { ...newList[index], [field]: value };
            return newList;
        });
    };

    const saveAllowances = async () => {
        if (!firestore) return;
        if (editAllowances.some((al) => (typeof al?.amount === 'number' ? al.amount : Number(al?.amount)) < 0)) {
            toast({ title: 'Алдаа', description: 'Хангамжийн дүн 0-ээс бага байж болохгүй', variant: 'destructive' });
            return;
        }
        await updateDocumentNonBlocking(tDoc('positions', position.id), {
            allowances: editAllowances.filter(al => al.type),
            updatedAt: new Date().toISOString(),
        });
        toast({ title: 'Хангамж хадгалагдлаа' });
    };

    const getIcon = (type: string) => {
        const t = type.toLowerCase();
        if (t.includes('утас') || t.includes('phone')) return Smartphone;
        if (t.includes('хоол') || t.includes('meal') || t.includes('food')) return Coffee;
        if (t.includes('бензин') || t.includes('car') || t.includes('transport') || t.includes('унаа')) return Car;
        if (t.includes('компьютер') || t.includes('laptop')) return Laptop;
        return Gift;
    };

    // Calculate total monthly value
    const totalMonthly = editAllowances.reduce((sum, al) => {
        const raw = typeof al?.amount === 'number' ? al.amount : Number(al?.amount);
        const amount = Number.isFinite(raw) ? Math.max(0, raw) : 0;
        if (al.period === 'monthly') return sum + amount;
        if (al.period === 'daily') return sum + amount * 22;
        if (al.period === 'quarterly') return sum + amount / 3;
        if (al.period === 'semi-annually') return sum + amount / 6;
        if (al.period === 'yearly') return sum + amount / 12;
        return sum;
    }, 0);

    return (
        <div className="space-y-6">
            {position.isApproved && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3 text-amber-800">
                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                    <p className="text-sm font-medium">Батлагдсан ажлын байр тул хангамжийн мэдээллийг өөрчлөх боломжгүй.</p>
                </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Хангамж карт */}
                <FieldCard
                    icon={Shield}
                    title="Хангамж & Тэтгэмж"
                    value={
                        position.allowances?.length
                            ? `${position.allowances.length} хангамж`
                            : 'Бүртгэгдээгүй'
                    }
                    isEmpty={!position.allowances?.length}
                    isLocked={position.isApproved}
                    className="lg:col-span-2"
                    editContent={
                        <div className="space-y-3">
                            <div className="max-h-[300px] overflow-y-auto space-y-2 rounded-xl border bg-slate-50 dark:bg-slate-800 p-2">
                                {editAllowances.map((al, i) => {
                                    const IconComponent = getIcon(al.type);
                                    return (
                                        <div key={i} className="p-3 rounded-xl border bg-white dark:bg-slate-700 shadow-sm">
                                            {/* Row 1: Name */}
                                            <div className="flex items-center gap-3 mb-3">
                                                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                                                    <IconComponent className="w-4 h-4 text-primary" />
                                                </div>
                                                <Input
                                                    value={al.type}
                                                    onChange={(e) => updateAllowance(i, 'type', e.target.value)}
                                                    className="h-8 border-slate-200 dark:border-slate-600 rounded-lg text-sm font-medium flex-1"
                                                    placeholder="Хангамжийн нэр"
                                                />
                                                <button
                                                    onClick={() => removeAllowance(i)}
                                                    className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </div>
                                            {/* Row 2: Amount & Period */}
                                            <div className="flex gap-2 pl-11">
                                                <CurrencyInput
                                                    value={al.amount}
                                                    onValueChange={(val) => updateAllowance(i, 'amount', val)}
                                                    className="h-9 rounded-lg flex-1 text-sm"
                                                    placeholder="Дүн"
                                                />
                                                <Select
                                                    value={al.period}
                                                    onValueChange={(val) => updateAllowance(i, 'period', val)}
                                                >
                                                    <SelectTrigger className="w-[110px] h-9 rounded-lg text-xs font-medium">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="once">Нэг удаа</SelectItem>
                                                        <SelectItem value="daily">Өдөр бүр</SelectItem>
                                                        <SelectItem value="monthly">Сар бүр</SelectItem>
                                                        <SelectItem value="quarterly">Улирал</SelectItem>
                                                        <SelectItem value="semi-annually">Хагас жил</SelectItem>
                                                        <SelectItem value="yearly">Жил бүр</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                    );
                                })}
                                {editAllowances.length === 0 && (
                                    <p className="text-xs text-muted-foreground italic py-4 text-center">Хангамж нэмээгүй</p>
                                )}
                            </div>
                            <div className="flex justify-end">
                                <AddActionButton
                                    label="Хангамж нэмэх"
                                    description="Шинэ хангамжийн мөр нэмэх"
                                    onClick={handleAddAllowance}
                                />
                            </div>
                        </div>
                    }
                    onSave={saveAllowances}
                />

                {/* Сарын нийт хангамж */}
                <FieldCard
                    icon={Gift}
                    title="Сарын нийт хангамж"
                    subtitle="Өдөрөөр тооцсон (өдөр бүрийн дүнг 22 ажлын өдрөөр үржүүлсэн)"
                    value={
                        totalMonthly > 0
                            ? `~${Math.round(totalMonthly).toLocaleString()}₮`
                            : 'Тодорхойгүй'
                    }
                    isEmpty={totalMonthly <= 0}
                    editable={false}
                />
            </div>
        </div>
    );
}
