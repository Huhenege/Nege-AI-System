'use client';

import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useCollection, useFirebase, useMemoFirebase, tenantCollection } from '@/firebase';
import { JobApplication, Vacancy } from '@/types/recruitment';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { Users, CheckCircle, Clock, TrendingUp, XCircle } from 'lucide-react';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

export function RecruitmentStats() {
    const { firestore } = useFirebase();

    // Fetch all applications
    const applicationsQuery = useMemoFirebase(
        ({ firestore, companyPath }) => (firestore ? tenantCollection(firestore, companyPath, 'applications') : null),
        [firestore]
    );
    const { data: applications } = useCollection<JobApplication>(applicationsQuery as any);

    // Fetch all vacancies
    const vacanciesQuery = useMemoFirebase(
        ({ firestore, companyPath }) => (firestore ? tenantCollection(firestore, companyPath, 'vacancies') : null),
        [firestore]
    );
    const { data: vacancies } = useCollection<Vacancy>(vacanciesQuery as any);

    // Calculate Stats
    const stats = useMemo(() => {
        if (!applications || !vacancies) return null;

        const totalApplications = applications.length;
        const totalVacancies = vacancies.filter(v => v.status === 'OPEN').length;

        // Амжилттай хаагдсан: status === 'HIRED'
        const hiredApplications = applications.filter(a => a.status === 'HIRED');
        const hiredCount = hiredApplications.length;
        const now = new Date();
        const startOfQuarter = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
        const hiredCountThisQuarter = hiredApplications.filter(a => {
            const t = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
            return t >= startOfQuarter.getTime();
        }).length;

        // Дундаж хугацаа (Time to Hire): appliedAt -> updatedAt for HIRED, in days
        const timeToHireDays: number[] = [];
        hiredApplications.forEach(a => {
            const applied = a.appliedAt ? new Date(a.appliedAt).getTime() : NaN;
            const updated = a.updatedAt ? new Date(a.updatedAt).getTime() : NaN;
            if (!Number.isNaN(applied) && !Number.isNaN(updated) && updated >= applied) {
                timeToHireDays.push((updated - applied) / (1000 * 60 * 60 * 24));
            }
        });
        const averageTimeToHireDays =
            timeToHireDays.length > 0
                ? Math.round(timeToHireDays.reduce((s, d) => s + d, 0) / timeToHireDays.length)
                : null;

        // Applications by Stage
        const stageCounts: Record<string, number> = {};
        applications.forEach(app => {
            const stage = app.currentStageId || 'Unknown';
            stageCounts[stage] = (stageCounts[stage] || 0) + 1;
        });

        const funnelData = [
            { name: 'Анкет', value: (stageCounts['applied'] || 0) + (stageCounts['screen'] || 0) },
            { name: 'Ярилцлага 1', value: stageCounts['interview'] || 0 },
            { name: 'Ярилцлага 2', value: stageCounts['tech-interview'] || 0 },
            { name: 'Offer', value: stageCounts['offer'] || 0 },
            { name: 'Hired', value: stageCounts['hired'] || 0 },
        ].filter(d => d.value > 0);

        const finalFunnelData = funnelData.length > 0 ? funnelData : [
            { name: 'Анкет', value: 0 },
            { name: 'Шүүлт', value: 0 },
            { name: 'Ярилцлага', value: 0 },
            { name: 'Санал', value: 0 },
            { name: 'Ажилд авсан', value: 0 },
        ];

        const sourceData = [
            { name: 'Linkedin', value: 400 },
            { name: 'Facebook', value: 300 },
            { name: 'Direct', value: 300 },
            { name: 'Referral', value: 200 },
        ];

        const rejectedApps = applications.filter(a => a.status === 'REJECTED');
        const rejectedTotal = rejectedApps.length;
        const rejectedByEmployer = rejectedApps.filter(a => a.rejectionType === 'employer').length;
        const rejectedByCandidate = rejectedApps.filter(a => a.rejectionType === 'candidate').length;
        const rejectedUnknown = rejectedTotal - rejectedByEmployer - rejectedByCandidate;
        const rejectionTypeData = [
            ...(rejectedByEmployer > 0 ? [{ name: 'Ажил олгогчоос', value: rejectedByEmployer }] : []),
            ...(rejectedByCandidate > 0 ? [{ name: 'Горилогчоос', value: rejectedByCandidate }] : []),
            ...(rejectedUnknown > 0 ? [{ name: 'Тодорхойгүй', value: rejectedUnknown }] : []),
        ];

        return {
            totalApplications,
            totalVacancies,
            hiredCount,
            hiredCountThisQuarter,
            averageTimeToHireDays,
            funnelData: finalFunnelData,
            sourceData,
            rejectedTotal,
            rejectedByEmployer,
            rejectedByCandidate,
            rejectionTypeData,
        };
    }, [applications, vacancies]);

    if (!stats) return <div className="p-8 text-center text-muted-foreground">Өгөгдөл ачааллаж байна...</div>;

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* KPI Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Нийт Анкет</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.totalApplications || 0}</div>
                        <p className="text-xs text-muted-foreground">+20.1% өмнөх сараас</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Нээлттэй Ажлын Байр</CardTitle>
                        <BriefcaseIcon className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.totalVacancies || 0}</div>
                        <p className="text-xs text-muted-foreground">3 шинээр нэмэгдсэн</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Дундаж Хугацаа (Time to Hire)</CardTitle>
                        <Clock className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {stats.averageTimeToHireDays != null ? `${stats.averageTimeToHireDays} өдөр` : '—'}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {stats.averageTimeToHireDays != null ? 'Ажилд авсан өргөдлүүдээс' : 'Ажилд авсан өргөдөл байхгүй'}
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Амжилттай Хаагдсан</CardTitle>
                        <CheckCircle className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.hiredCount}</div>
                        <p className="text-xs text-muted-foreground">
                            Энэ улиралд {stats.hiredCountThisQuarter}
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Rejection Stats */}
            {stats.rejectedTotal > 0 && (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                    <Card className="col-span-4">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <XCircle className="h-4 w-4 text-red-500" />
                                Татгалзсан анкетууд
                            </CardTitle>
                            <CardDescription>Нийт {stats.rejectedTotal} — Ажил олгогчоос: {stats.rejectedByEmployer}, Горилогчоос: {stats.rejectedByCandidate}</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="h-[200px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={stats.rejectionTypeData}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={50}
                                            outerRadius={70}
                                            paddingAngle={5}
                                            dataKey="value"
                                            label={({ name, value }) => `${name}: ${value}`}
                                        >
                                            {stats.rejectionTypeData.map((_, index) => (
                                                <Cell key={`rej-${index}`} fill={['#ef4444', '#f97316', '#94a3b8'][index % 3]} />
                                            ))}
                                        </Pie>
                                        <Tooltip />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="col-span-3">
                        <CardHeader>
                            <CardTitle>Татгалзсан харьцаа</CardTitle>
                            <CardDescription>Аль тал татгалзсан бэ?</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4 pt-2">
                                <div>
                                    <div className="flex justify-between text-sm mb-1">
                                        <span>Ажил олгогч талаас</span>
                                        <span className="font-semibold">{stats.rejectedByEmployer}</span>
                                    </div>
                                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                        <div className="h-full bg-red-500 rounded-full" style={{ width: `${stats.rejectedTotal > 0 ? (stats.rejectedByEmployer / stats.rejectedTotal) * 100 : 0}%` }} />
                                    </div>
                                </div>
                                <div>
                                    <div className="flex justify-between text-sm mb-1">
                                        <span>Горилогч өөрөө</span>
                                        <span className="font-semibold">{stats.rejectedByCandidate}</span>
                                    </div>
                                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                        <div className="h-full bg-orange-500 rounded-full" style={{ width: `${stats.rejectedTotal > 0 ? (stats.rejectedByCandidate / stats.rejectedTotal) * 100 : 0}%` }} />
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                {/* Funnel Chart */}
                <Card className="col-span-4">
                    <CardHeader>
                        <CardTitle>Сонгон шалгаруулалтын юүлүүр</CardTitle>
                        <CardDescription>Үе шат бүрээр горилогчдын тоо</CardDescription>
                    </CardHeader>
                    <CardContent className="pl-2">
                        <div className="h-[300px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={stats.funnelData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                                    <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}`} />
                                    <Tooltip
                                        cursor={{ fill: 'transparent' }}
                                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    />
                                    <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={50} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                {/* Source Chart */}
                <Card className="col-span-3">
                    <CardHeader>
                        <CardTitle>Эх сурвалж</CardTitle>
                        <CardDescription>Горилогчид хаанаас ирсэн бэ?</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[300px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={stats.sourceData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {stats.sourceData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="flex justify-center gap-4 text-xs text-muted-foreground mt-4">
                                {stats.sourceData.map((entry, index) => (
                                    <div key={entry.name} className="flex items-center gap-1">
                                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                                        {entry.name}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

function BriefcaseIcon(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <rect width="20" height="14" x="2" y="7" rx="2" ry="2" />
            <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
        </svg>
    )
}
