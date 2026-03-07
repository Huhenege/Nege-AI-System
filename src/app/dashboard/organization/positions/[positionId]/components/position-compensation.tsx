'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { AddActionButton } from '@/components/ui/add-action-button';
import { Input } from '@/components/ui/input';
import {
    X,
    Zap,
    LayoutGrid,
    CheckCircle2,
    AlertCircle,
    Banknote
} from 'lucide-react';
import { Position, SalaryRangeVersion } from '../../../types';
import { doc, collection, addDoc } from 'firebase/firestore';
import { useFirebase, updateDocumentNonBlocking, useCollection, useTenantWrite } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { CurrencyInput } from './currency-input';
import { FieldCard, LabeledInput } from '@/components/organization/field-card';

interface PositionCompensationProps {
    position: Position;
}

export function PositionCompensation({
    position
}: PositionCompensationProps) {
    const { firestore } = useFirebase();
    const { tDoc } = useTenantWrite();
    const { toast } = useToast();

    // Helper to normalize salary steps from any previous format
    const normalizeSteps = (pos: Position) => {
        if (pos.salarySteps?.items) return pos.salarySteps;
        const oldValues = (pos.salarySteps as any)?.values || [0];
        return {
            items: oldValues.map((v: number, i: number) => ({
                name: `Шатлал ${i + 1}`,
                value: v
            })),
            activeIndex: pos.salarySteps?.activeIndex ?? 0,
            currency: pos.salarySteps?.currency || 'MNT',
        };
    };

    // Edit states
    const [editSalarySteps, setEditSalarySteps] = useState(normalizeSteps(position));
    const [editIncentives, setEditIncentives] = useState<any[]>(position.incentives || []);

    // Sync when position changes
    React.useEffect(() => {
        setEditSalarySteps(normalizeSteps(position));
        setEditIncentives(position.incentives || []);
    }, [position]);

    const activeItem = editSalarySteps.items[editSalarySteps.activeIndex] || { name: 'Тодорхойгүй', value: 0 };

    // Salary steps handlers
    const handleStepCountChange = (count: number) => {
        const currentItems = [...editSalarySteps.items];
        let newItems = [];
        if (count > currentItems.length) {
            newItems = [
                ...currentItems,
                ...Array(count - currentItems.length).fill(0).map((_, i) => ({
                    name: `Шатлал ${currentItems.length + i + 1}`,
                    value: 0
                }))
            ];
        } else {
            newItems = currentItems.slice(0, count);
        }
        setEditSalarySteps(prev => ({
            ...prev,
            items: newItems,
            activeIndex: Math.min(prev.activeIndex, newItems.length - 1)
        }));
    };

    const updateStepValue = (index: number, value: number) => {
        const newItems = [...editSalarySteps.items];
        newItems[index] = { ...newItems[index], value };
        setEditSalarySteps(prev => ({ ...prev, items: newItems }));
    };

    const updateStepName = (index: number, name: string) => {
        const newItems = [...editSalarySteps.items];
        newItems[index] = { ...newItems[index], name };
        setEditSalarySteps(prev => ({ ...prev, items: newItems }));
    };

    const activateStep = (index: number) => {
        setEditSalarySteps(prev => ({ ...prev, activeIndex: index }));
    };

    // Incentive handlers
    const handleAddIncentive = () => {
        setEditIncentives(prev => [...prev, { type: '', description: '', amount: 0, currency: 'MNT', unit: '%', frequency: 'Сар бүр' }]);
    };

    const removeIncentive = (index: number) => {
        setEditIncentives(prev => prev.filter((_, i) => i !== index));
    };

    const updateIncentive = (index: number, field: string, value: any) => {
        setEditIncentives(prev => {
            const newList = [...prev];
            newList[index] = { ...newList[index], [field]: value };
            return newList;
        });
    };

    // Save helpers
    const saveSalarySteps = async () => {
        if (!firestore) return;
        if (editSalarySteps.items.some((item: any) => item.value < 0)) {
            toast({ title: "Алдаа", description: "Цалингийн дүн 0-ээс бага байж болохгүй", variant: "destructive" });
            return;
        }

        const values = editSalarySteps.items.map((i: any) => i.value);
        const min = Math.min(...values);
        const max = Math.max(...values);

        await updateDocumentNonBlocking(tDoc('positions', position.id), {
            salarySteps: editSalarySteps,
            salaryRange: {
                min,
                max,
                currency: editSalarySteps.currency || 'MNT',
            },
            updatedAt: new Date().toISOString(),
        });
        toast({ title: 'Цалингийн шатлал хадгалагдлаа' });
    };

    const saveIncentives = async () => {
        if (!firestore) return;
        await updateDocumentNonBlocking(tDoc('positions', position.id), {
            incentives: editIncentives.filter(inc => inc.type),
            updatedAt: new Date().toISOString(),
        });
        toast({ title: 'Урамшуулал хадгалагдлаа' });
    };

    return (
        <div className="space-y-6">
            {position.isApproved && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3 text-amber-800">
                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                    <p className="text-sm font-medium">Батлагдсан ажлын байр тул цалин, урамшууллын мэдээллийг өөрчлөх боломжгүй.</p>
                </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Үндсэн цалин */}
                <FieldCard
                    icon={Banknote}
                    title="Үндсэн цалин"
                    value={
                        activeItem.value > 0
                            ? `${activeItem.value.toLocaleString()}₮`
                            : 'Тодорхойгүй'
                    }
                    isEmpty={activeItem.value <= 0}
                    isLocked={position.isApproved}
                    className="lg:col-span-2"
                    editContent={
                        <div className="space-y-4">
                            <LabeledInput label="Шатлалын тоо">
                                <Select
                                    value={editSalarySteps.items.length.toString()}
                                    onValueChange={(val) => handleStepCountChange(parseInt(val))}
                                >
                                    <SelectTrigger className="h-11 rounded-xl">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                                            <SelectItem key={n} value={n.toString()}>{n} шатлал</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </LabeledInput>

                            <div className="max-h-[300px] overflow-y-auto space-y-2 rounded-xl border bg-slate-50 dark:bg-slate-800 p-2">
                                {editSalarySteps.items.map((item: any, i: number) => (
                                    <div
                                        key={i}
                                        className={`
                                            p-3 rounded-xl border bg-white dark:bg-slate-700 shadow-sm
                                            ${editSalarySteps.activeIndex === i ? 'border-primary ring-1 ring-primary/15' : ''}
                                        `}
                                    >
                                        {/* Row 1: Step + Name + Active */}
                                        <div className="flex items-center gap-3 mb-3">
                                            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                                                <span className="text-xs font-bold text-primary">{i + 1}</span>
                                            </div>
                                            <Input
                                                value={item.name}
                                                onChange={(e) => updateStepName(i, e.target.value)}
                                                className="h-8 border-slate-200 dark:border-slate-600 rounded-lg text-sm font-medium flex-1"
                                                placeholder={`Шатлал ${i + 1}`}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => activateStep(i)}
                                                className={`
                                                    h-8 px-3 rounded-lg text-xs font-semibold transition-colors shrink-0
                                                    ${editSalarySteps.activeIndex === i
                                                        ? 'bg-primary text-primary-foreground'
                                                        : 'bg-slate-100 dark:bg-slate-600 text-muted-foreground hover:bg-primary/10 hover:text-primary'}
                                                `}
                                            >
                                                {editSalarySteps.activeIndex === i ? (
                                                    <span className="flex items-center gap-1">
                                                        <CheckCircle2 className="w-3 h-3" />
                                                        Идэвхтэй
                                                    </span>
                                                ) : 'Сонгох'}
                                            </button>
                                        </div>

                                        {/* Row 2: Amount */}
                                        <div className="pl-11">
                                            <CurrencyInput
                                                value={item.value}
                                                onValueChange={(val) => updateStepValue(i, val)}
                                                className="h-9 rounded-lg text-sm"
                                                placeholder="Цалингийн дүн"
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    }
                    onSave={saveSalarySteps}
                />

                {/* Урамшуулал */}
                <FieldCard
                    icon={Zap}
                    title="Урамшуулал & Нэмэгдэл"
                    value={
                        position.incentives?.length
                            ? `${position.incentives.length} урамшуулал`
                            : 'Бүртгэгдээгүй'
                    }
                    isEmpty={!position.incentives?.length}
                    isLocked={position.isApproved}
                    editContent={
                        <div className="space-y-3">
                            <div className="max-h-[300px] overflow-y-auto space-y-2 rounded-xl border bg-slate-50 dark:bg-slate-800 p-2">
                                {editIncentives.map((inc, i) => (
                                    <div key={i} className="p-3 rounded-xl border bg-white dark:bg-slate-700 shadow-sm">
                                        {/* Row 1: Name */}
                                        <div className="flex items-center gap-3 mb-3">
                                            <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                                                <Zap className="w-4 h-4 text-amber-500" />
                                            </div>
                                            <Input
                                                value={inc.type}
                                                onChange={(e) => updateIncentive(i, 'type', e.target.value)}
                                                className="h-8 border-slate-200 dark:border-slate-600 rounded-lg text-sm font-medium flex-1"
                                                placeholder="Урамшууллын нэр"
                                            />
                                            <button
                                                onClick={() => removeIncentive(i)}
                                                className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                        {/* Row 2: Amount & Unit & Frequency */}
                                        <div className="flex gap-2 pl-11">
                                            {inc.unit === '₮' ? (
                                                <CurrencyInput
                                                    value={inc.amount}
                                                    onValueChange={(val) => updateIncentive(i, 'amount', val)}
                                                    className="h-9 rounded-lg flex-1 text-sm"
                                                    placeholder="Дүн"
                                                />
                                            ) : (
                                                <Input
                                                    type="number"
                                                    value={inc.amount}
                                                    onChange={(e) => updateIncentive(i, 'amount', Number(e.target.value))}
                                                    className="h-9 rounded-lg flex-1 text-sm"
                                                    placeholder="Хувь"
                                                />
                                            )}
                                            <Select
                                                value={inc.unit}
                                                onValueChange={(val) => updateIncentive(i, 'unit', val)}
                                            >
                                                <SelectTrigger className="w-16 h-9 rounded-lg font-medium">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="%">%</SelectItem>
                                                    <SelectItem value="₮">₮</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <Select
                                                value={inc.frequency || 'Сар бүр'}
                                                onValueChange={(val) => updateIncentive(i, 'frequency', val)}
                                            >
                                                <SelectTrigger className="w-[100px] h-9 rounded-lg text-xs font-medium">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="Өдөр бүр">Өдөр бүр</SelectItem>
                                                    <SelectItem value="Сар бүр">Сар бүр</SelectItem>
                                                    <SelectItem value="Улирал бүр">Улирал</SelectItem>
                                                    <SelectItem value="Хагас жил тутам">Хагас жил</SelectItem>
                                                    <SelectItem value="Жил бүр">Жил бүр</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                ))}
                                {editIncentives.length === 0 && (
                                    <p className="text-xs text-muted-foreground italic py-4 text-center">Урамшуулал нэмээгүй</p>
                                )}
                            </div>
                            <div className="flex justify-end">
                                <AddActionButton
                                    label="Урамшуулал нэмэх"
                                    description="Шинэ урамшууллын мөр нэмэх"
                                    onClick={handleAddIncentive}
                                />
                            </div>
                        </div>
                    }
                    onSave={saveIncentives}
                />
            </div>
        </div>
    );
}
