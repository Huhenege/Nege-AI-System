'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
    Ticket, Plus, RefreshCw, Pencil, Trash2, Check, X,
    Users, Calendar, Tag, BarChart3, Power,
} from 'lucide-react';
import { useSuperAdminApi } from '../components/use-super-admin-api';
import type { Coupon, CompanyPlan } from '@/types/company';
import { COMPANY_PLAN_LABELS } from '@/types/company';
import { cn } from '@/lib/utils';

const PLAN_OPTIONS: CompanyPlan[] = ['free', 'starter', 'pro', 'enterprise'];

function formatDate(d: string | null | undefined): string {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('mn-MN', { year: 'numeric', month: 'short', day: 'numeric' });
}

function CouponBadge({ coupon }: { coupon: Coupon }) {
    const now = new Date();
    const expired = coupon.validUntil && new Date(coupon.validUntil) < now;
    const exhausted = coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses;

    if (!coupon.isActive) return <Badge className="bg-slate-700 text-slate-400">Идэвхгүй</Badge>;
    if (expired) return <Badge className="bg-red-900/50 text-red-400 border-red-800">Хугацаа дууссан</Badge>;
    if (exhausted) return <Badge className="bg-amber-900/50 text-amber-400 border-amber-800">Дуусгавар</Badge>;
    return <Badge className="bg-emerald-900/50 text-emerald-400 border-emerald-800">Идэвхтэй</Badge>;
}

const EMPTY_FORM: Partial<Coupon> = {
    code: '',
    type: 'percent',
    value: 20,
    description: '',
    maxUses: null,
    validFrom: new Date().toISOString().slice(0, 10),
    validUntil: null,
    applicablePlans: null,
};

export default function CouponsPage() {
    const { fetchApi } = useSuperAdminApi();
    const [coupons, setCoupons] = useState<Coupon[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
    const [form, setForm] = useState<Partial<Coupon>>(EMPTY_FORM);
    const [isSaving, setIsSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);

    const loadCoupons = useCallback(async () => {
        setIsLoading(true);
        try {
            const data = await fetchApi<{ coupons: Coupon[] }>('/coupons');
            setCoupons(data.coupons);
        } finally {
            setIsLoading(false);
        }
    }, [fetchApi]);

    useEffect(() => { loadCoupons(); }, [loadCoupons]);

    const openCreate = () => {
        setEditingCoupon(null);
        setForm(EMPTY_FORM);
        setSaveError(null);
        setIsDialogOpen(true);
    };

    const openEdit = (c: Coupon) => {
        setEditingCoupon(c);
        setForm({ ...c });
        setSaveError(null);
        setIsDialogOpen(true);
    };

    const handleSave = async () => {
        setSaveError(null);
        setIsSaving(true);
        try {
            if (editingCoupon) {
                await fetchApi(`/coupons/${editingCoupon.code}`, {
                    method: 'PATCH',
                    body: JSON.stringify(form),
                });
            } else {
                await fetchApi('/coupons', {
                    method: 'POST',
                    body: JSON.stringify(form),
                });
            }
            setIsDialogOpen(false);
            loadCoupons();
        } catch (e: any) {
            setSaveError(e?.message || 'Алдаа гарлаа');
        } finally {
            setIsSaving(false);
        }
    };

    const handleToggle = async (c: Coupon) => {
        try {
            await fetchApi(`/coupons/${c.code}`, {
                method: 'PATCH',
                body: JSON.stringify({ isActive: !c.isActive }),
            });
            loadCoupons();
        } catch { /* ignore */ }
    };

    const handleDelete = async (c: Coupon) => {
        if (!confirm(`'${c.code}' кодыг устгах уу?`)) return;
        try {
            await fetchApi(`/coupons/${c.code}`, { method: 'DELETE' });
            loadCoupons();
        } catch { /* ignore */ }
    };

    const updateForm = (key: keyof Coupon, value: any) => setForm(prev => ({ ...prev, [key]: value }));

    const togglePlan = (plan: CompanyPlan) => {
        const current = form.applicablePlans ?? [];
        const next = current.includes(plan)
            ? current.filter(p => p !== plan)
            : [...current, plan];
        updateForm('applicablePlans', next.length === 0 ? null : next);
    };

    return (
        <div className="p-8 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white">Хөнгөлтийн код</h1>
                    <p className="text-slate-500 text-sm mt-1">Байгууллагуудад хөнгөлтийн код үүсгэж удирдана</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={loadCoupons} disabled={isLoading}
                        className="border-slate-700 text-slate-300 hover:bg-slate-800">
                        <RefreshCw className={cn('h-4 w-4 mr-2', isLoading && 'animate-spin')} />
                        Шинэчлэх
                    </Button>
                    <Button size="sm" onClick={openCreate} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                        <Plus className="h-4 w-4 mr-2" />
                        Шинэ код
                    </Button>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
                {[
                    { label: 'Нийт код', value: coupons.length, icon: Ticket, color: 'text-blue-400' },
                    { label: 'Идэвхтэй', value: coupons.filter(c => c.isActive).length, icon: Check, color: 'text-emerald-400' },
                    { label: 'Нийт хэрэглэсэн', value: coupons.reduce((s, c) => s + c.usedCount, 0), icon: Users, color: 'text-amber-400' },
                ].map(({ label, value, icon: Icon, color }) => (
                    <Card key={label} className="bg-slate-900 border-slate-800">
                        <CardContent className="pt-4 pb-3 px-4 flex items-center gap-3">
                            <Icon className={cn('h-5 w-5 shrink-0', color)} />
                            <div>
                                <p className="text-2xl font-bold text-white">{value}</p>
                                <p className="text-xs text-slate-500">{label}</p>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Table */}
            <Card className="bg-slate-900 border-slate-800">
                <CardHeader className="pb-3">
                    <CardTitle className="text-base text-white">Бүх кодууд</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    {isLoading ? (
                        <div className="p-6 space-y-3">
                            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12 bg-slate-800" />)}
                        </div>
                    ) : coupons.length === 0 ? (
                        <div className="text-center py-16 text-slate-500">
                            <Ticket className="h-10 w-10 mx-auto mb-3 opacity-30" />
                            <p>Хөнгөлтийн код байхгүй байна</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-slate-800 text-slate-500 text-xs">
                                        <th className="text-left px-6 py-3 font-medium">Код</th>
                                        <th className="text-left px-4 py-3 font-medium">Хөнгөлт</th>
                                        <th className="text-left px-4 py-3 font-medium">Хэрэглэсэн</th>
                                        <th className="text-left px-4 py-3 font-medium">Хугацаа</th>
                                        <th className="text-left px-4 py-3 font-medium">Төлөв</th>
                                        <th className="text-right px-6 py-3 font-medium">Үйлдэл</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {coupons.map(c => (
                                        <tr key={c.code} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                                            <td className="px-6 py-3">
                                                <div className="font-mono font-bold text-white">{c.code}</div>
                                                <div className="text-xs text-slate-500 truncate max-w-[200px]">{c.description}</div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={cn(
                                                    'font-semibold',
                                                    c.type === 'percent' ? 'text-emerald-400' : 'text-cyan-400'
                                                )}>
                                                    {c.type === 'percent' ? `${c.value}%` : `₮${c.value.toLocaleString()}`}
                                                </span>
                                                {c.applicablePlans && (
                                                    <div className="text-[10px] text-slate-600 mt-0.5">
                                                        {c.applicablePlans.map(p => COMPANY_PLAN_LABELS[p]).join(', ')}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-white font-medium">{c.usedCount}</span>
                                                    {c.maxUses !== null && (
                                                        <span className="text-slate-500">/ {c.maxUses}</span>
                                                    )}
                                                </div>
                                                {c.maxUses !== null && (
                                                    <div className="h-1 w-16 bg-slate-700 rounded-full mt-1 overflow-hidden">
                                                        <div className="h-full bg-emerald-500 rounded-full"
                                                            style={{ width: `${Math.min(100, (c.usedCount / c.maxUses) * 100)}%` }} />
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-slate-400 text-xs">
                                                <div className="flex items-center gap-1">
                                                    <Calendar className="h-3 w-3" />
                                                    {c.validUntil ? formatDate(c.validUntil) : 'Хязгааргүй'}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <CouponBadge coupon={c} />
                                            </td>
                                            <td className="px-6 py-3">
                                                <div className="flex items-center justify-end gap-1">
                                                    <Button variant="ghost" size="icon"
                                                        className="h-7 w-7 text-slate-400 hover:text-white hover:bg-slate-800"
                                                        onClick={() => handleToggle(c)}
                                                        title={c.isActive ? 'Идэвхгүй болгох' : 'Идэвхжүүлэх'}>
                                                        <Power className="h-3.5 w-3.5" />
                                                    </Button>
                                                    <Button variant="ghost" size="icon"
                                                        className="h-7 w-7 text-slate-400 hover:text-white hover:bg-slate-800"
                                                        onClick={() => openEdit(c)}>
                                                        <Pencil className="h-3.5 w-3.5" />
                                                    </Button>
                                                    <Button variant="ghost" size="icon"
                                                        className="h-7 w-7 text-slate-400 hover:text-red-400 hover:bg-slate-800"
                                                        onClick={() => handleDelete(c)}>
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Create / Edit Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="bg-slate-900 border-slate-800 text-slate-100 max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="text-white flex items-center gap-2">
                            <Ticket className="h-5 w-5 text-emerald-400" />
                            {editingCoupon ? `'${editingCoupon.code}' засах` : 'Шинэ хөнгөлтийн код'}
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                        {/* Code */}
                        {!editingCoupon && (
                            <div className="space-y-1.5">
                                <Label className="text-slate-400">Код <span className="text-xs text-slate-600">(үсэг, тоо, зураас)</span></Label>
                                <Input
                                    placeholder="NEGE50, LAUNCH2026 ..."
                                    value={form.code ?? ''}
                                    onChange={e => updateForm('code', e.target.value.toUpperCase())}
                                    className="bg-slate-800 border-slate-700 text-white font-mono"
                                />
                            </div>
                        )}

                        {/* Description */}
                        <div className="space-y-1.5">
                            <Label className="text-slate-400">Тайлбар</Label>
                            <Input
                                placeholder="Нээлтийн хөнгөлт 50%"
                                value={form.description ?? ''}
                                onChange={e => updateForm('description', e.target.value)}
                                className="bg-slate-800 border-slate-700 text-white"
                            />
                        </div>

                        {/* Type + Value */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label className="text-slate-400">Хөнгөлтийн төрөл</Label>
                                <Select value={form.type ?? 'percent'} onValueChange={v => updateForm('type', v)}>
                                    <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-slate-800 border-slate-700">
                                        <SelectItem value="percent">Хувь (%)</SelectItem>
                                        <SelectItem value="fixed">Тогтмол дүн (₮)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-slate-400">
                                    {form.type === 'percent' ? 'Хувь (1-100)' : 'Дүн (₮)'}
                                </Label>
                                <Input
                                    type="number"
                                    min={form.type === 'percent' ? 1 : 1}
                                    max={form.type === 'percent' ? 100 : undefined}
                                    value={form.value ?? ''}
                                    onChange={e => updateForm('value', Number(e.target.value))}
                                    className="bg-slate-800 border-slate-700 text-white"
                                />
                            </div>
                        </div>

                        {/* Max uses */}
                        <div className="space-y-1.5">
                            <Label className="text-slate-400">Хэрэглэх хязгаар <span className="text-xs text-slate-600">(хоосон = хязгааргүй)</span></Label>
                            <Input
                                type="number"
                                min={1}
                                placeholder="Хязгааргүй"
                                value={form.maxUses ?? ''}
                                onChange={e => updateForm('maxUses', e.target.value ? Number(e.target.value) : null)}
                                className="bg-slate-800 border-slate-700 text-white"
                            />
                        </div>

                        {/* Valid dates */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label className="text-slate-400">Эхлэх огноо</Label>
                                <Input
                                    type="date"
                                    value={form.validFrom?.slice(0, 10) ?? ''}
                                    onChange={e => updateForm('validFrom', e.target.value)}
                                    className="bg-slate-800 border-slate-700 text-white"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-slate-400">Дуусах огноо <span className="text-xs text-slate-600">(хоосон = хязгааргүй)</span></Label>
                                <Input
                                    type="date"
                                    value={form.validUntil?.slice(0, 10) ?? ''}
                                    onChange={e => updateForm('validUntil', e.target.value || null)}
                                    className="bg-slate-800 border-slate-700 text-white"
                                />
                            </div>
                        </div>

                        {/* Applicable plans */}
                        <div className="space-y-2">
                            <Label className="text-slate-400">Хамрах багц <span className="text-xs text-slate-600">(хоосон = бүгд)</span></Label>
                            <div className="flex flex-wrap gap-2">
                                {PLAN_OPTIONS.map(plan => {
                                    const selected = form.applicablePlans?.includes(plan) ?? false;
                                    return (
                                        <button
                                            key={plan}
                                            type="button"
                                            onClick={() => togglePlan(plan)}
                                            className={cn(
                                                'px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors',
                                                selected
                                                    ? 'bg-emerald-600 border-emerald-500 text-white'
                                                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700',
                                            )}
                                        >
                                            {COMPANY_PLAN_LABELS[plan]}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* isActive toggle (edit only) */}
                        {editingCoupon && (
                            <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-slate-800">
                                <span className="text-sm text-slate-300">Идэвхтэй эсэх</span>
                                <Switch
                                    checked={form.isActive ?? true}
                                    onCheckedChange={v => updateForm('isActive', v)}
                                />
                            </div>
                        )}

                        {saveError && (
                            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-900/30 border border-red-800 text-red-400 text-sm">
                                <X className="h-4 w-4 shrink-0" />
                                {saveError}
                            </div>
                        )}
                    </div>

                    <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)}
                            className="border-slate-700 text-slate-400">
                            Болих
                        </Button>
                        <Button onClick={handleSave} disabled={isSaving}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white">
                            {isSaving ? <RefreshCw className="h-4 w-4 animate-spin mr-1" /> : <Check className="h-4 w-4 mr-1" />}
                            {editingCoupon ? 'Хадгалах' : 'Үүсгэх'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
