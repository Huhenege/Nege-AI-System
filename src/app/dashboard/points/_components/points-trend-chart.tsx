'use client';

import { useMemo } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, Legend, LineChart, Line, ReferenceLine,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { TrendingUp } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PointTx {
    amount: number;
    type: string;
    projectId?: string;
    createdAt?: { toDate?: () => Date } | string;
}

interface MonthlyData {
    month: string;       // "2025/01"
    recognition: number; // GIVEN (personal allowance)
    project: number;     // RECEIVED + projectId
    redeemed: number;    // REDEEMED
    net: number;         // received - redeemed
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const MONTH_LABELS: Record<string, string> = {
    '01': '1-р сар', '02': '2-р сар', '03': '3-р сар', '04': '4-р сар',
    '05': '5-р сар', '06': '6-р сар', '07': '7-р сар', '08': '8-р сар',
    '09': '9-р сар', '10': '10-р сар', '11': '11-р сар', '12': '12-р сар',
};

function getDate(created: any): Date | null {
    if (!created) return null;
    try {
        return typeof created === 'object' && 'toDate' in created
            ? created.toDate()
            : new Date(created as string);
    } catch { return null; }
}

function getMonthKey(d: Date): string {
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label }: any) {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-3 text-xs space-y-1.5 min-w-[160px]">
            <p className="font-semibold text-slate-700 border-b pb-1.5 mb-1.5">{label}</p>
            {payload.map((p: any) => (
                <div key={p.dataKey} className="flex justify-between gap-4">
                    <span style={{ color: p.color }}>{p.name}</span>
                    <span className="font-semibold text-slate-800">{Number(p.value).toLocaleString()}</span>
                </div>
            ))}
        </div>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface Props {
    transactions: PointTx[];
    year?: number;
}

export function PointsTrendChart({ transactions, year }: Props) {
    const targetYear = year ?? new Date().getFullYear();

    const monthlyData = useMemo((): MonthlyData[] => {
        // Жилийн 12 сарын skeleton
        const map = new Map<string, MonthlyData>();
        for (let m = 1; m <= 12; m++) {
            const key = `${targetYear}/${String(m).padStart(2, '0')}`;
            map.set(key, { month: MONTH_LABELS[String(m).padStart(2, '0')], recognition: 0, project: 0, redeemed: 0, net: 0 });
        }

        for (const tx of transactions) {
            const d = getDate(tx.createdAt);
            if (!d || d.getFullYear() !== targetYear) continue;

            const key = getMonthKey(d);
            const row = map.get(key);
            if (!row) continue;

            const abs = Math.abs(Number(tx.amount));

            if (tx.type === 'GIVEN') {
                row.recognition += abs;
            } else if (tx.type === 'RECEIVED' && tx.projectId) {
                row.project += abs;
                row.net += abs;
            } else if (tx.type === 'RECEIVED') {
                row.net += abs;
            } else if (tx.type === 'REDEEMED') {
                row.redeemed += abs;
                row.net -= abs;
            }
        }

        return Array.from(map.values());
    }, [transactions, targetYear]);

    // Өгөгдөл огт байхгүй бол харуулахгүй
    const hasData = monthlyData.some(d => d.recognition > 0 || d.project > 0 || d.redeemed > 0);

    // Нийт summary
    const totals = useMemo(() => ({
        recognition: monthlyData.reduce((s, d) => s + d.recognition, 0),
        project: monthlyData.reduce((s, d) => s + d.project, 0),
        redeemed: monthlyData.reduce((s, d) => s + d.redeemed, 0),
    }), [monthlyData]);

    if (!hasData) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                        <TrendingUp className="w-4 h-4 text-primary" />
                        {targetYear} оны сарын оноо
                    </CardTitle>
                    <CardDescription>Гүйлгээ бүртгэгдэхэд тренд харагдана.</CardDescription>
                </CardHeader>
            </Card>
        );
    }

    return (
        <div className="space-y-4">
            {/* Bar chart — талархал + төсөл + зарцуулалт */}
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-base">
                        <TrendingUp className="w-4 h-4 text-primary" />
                        {targetYear} оны сарын оноо
                    </CardTitle>
                    <CardDescription>
                        Талархал: <span className="font-semibold text-blue-600">{totals.recognition.toLocaleString()}</span>
                        {' · '}Төсөл: <span className="font-semibold text-emerald-600">{totals.project.toLocaleString()}</span>
                        {' · '}Зарцуулсан: <span className="font-semibold text-rose-500">{totals.redeemed.toLocaleString()}</span>
                    </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                    <ResponsiveContainer width="100%" height={240}>
                        <BarChart data={monthlyData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }} barGap={3}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                            <XAxis
                                dataKey="month"
                                tick={{ fontSize: 11, fill: '#94a3b8' }}
                                tickFormatter={v => v.replace('-р сар', '')}
                                axisLine={false}
                                tickLine={false}
                            />
                            <YAxis
                                tick={{ fontSize: 11, fill: '#94a3b8' }}
                                axisLine={false}
                                tickLine={false}
                                tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}
                            />
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
                            <Legend
                                iconType="circle"
                                iconSize={8}
                                wrapperStyle={{ fontSize: 11, paddingTop: 12 }}
                            />
                            <Bar dataKey="recognition" name="Талархал" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={32} />
                            <Bar dataKey="project"     name="Төсөл"    fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={32} />
                            <Bar dataKey="redeemed"    name="Зарцуулсан" fill="#f43f5e" radius={[4, 4, 0, 0]} maxBarSize={32} />
                        </BarChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>

            {/* Line chart — net оноо (хуримтлалын тренд) */}
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-base text-sm font-medium text-muted-foreground">Сарын цэвэр оноо (хүлээн авсан − зарцуулсан)</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                    <ResponsiveContainer width="100%" height={160}>
                        <LineChart data={monthlyData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                            <XAxis
                                dataKey="month"
                                tick={{ fontSize: 11, fill: '#94a3b8' }}
                                tickFormatter={v => v.replace('-р сар', '')}
                                axisLine={false}
                                tickLine={false}
                            />
                            <YAxis
                                tick={{ fontSize: 11, fill: '#94a3b8' }}
                                axisLine={false}
                                tickLine={false}
                                tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}
                            />
                            <Tooltip content={<CustomTooltip />} />
                            <ReferenceLine y={0} stroke="#e2e8f0" />
                            <Line
                                type="monotone"
                                dataKey="net"
                                name="Цэвэр оноо"
                                stroke="#8b5cf6"
                                strokeWidth={2}
                                dot={{ r: 3, fill: '#8b5cf6' }}
                                activeDot={{ r: 5 }}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>
        </div>
    );
}
