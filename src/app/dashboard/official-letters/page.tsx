'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { query, orderBy, updateDoc, Timestamp } from 'firebase/firestore';
import { useFirebase, useFetchCollection, useTenantWrite } from '@/firebase';
import { OfficialLetter, STATUS_LABELS, STATUS_COLORS } from './types';
import { PageHeader } from '@/components/patterns/page-layout';
import { AddActionButton } from '@/components/ui/add-action-button';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { FileText, Search, Archive, Eye, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { mn } from 'date-fns/locale';

export default function OfficialLettersPage() {
    const { firestore } = useFirebase();
    const { tCollection, tDoc } = useTenantWrite();
    const { toast } = useToast();
    const [search, setSearch] = React.useState('');

    const lettersQuery = useMemo(() =>
        firestore ? query(tCollection('official_letters'), orderBy('createdAt', 'desc')) : null
        , [firestore, tCollection]);

    const { data: letters, isLoading } = useFetchCollection<OfficialLetter>(lettersQuery);

    const filtered = useMemo(() => {
        if (!letters) return [];
        const q = search.trim().toLowerCase();
        if (!q) return letters;
        return letters.filter(l =>
            l.letterNumber?.toLowerCase().includes(q) ||
            l.config?.subject?.toLowerCase().includes(q) ||
            l.config?.addresseeOrg?.toLowerCase().includes(q)
        );
    }, [letters, search]);

    const handleArchive = async (id: string) => {
        try {
            await updateDoc(tDoc('official_letters', id), { status: 'ARCHIVED', updatedAt: Timestamp.now() });
            toast({ title: 'Архивлагдлаа' });
        } catch {
            toast({ title: 'Алдаа', variant: 'destructive' });
        }
    };

    const counts = useMemo(() => ({
        total: letters?.length || 0,
        draft: letters?.filter(l => l.status === 'DRAFT').length || 0,
        sent: letters?.filter(l => l.status === 'SENT').length || 0,
    }), [letters]);

    return (
        <div className="flex flex-col h-full bg-slate-50/50 p-6 md:p-8 space-y-6 overflow-y-auto pb-20">
            <PageHeader
                title="Албан бичиг"
                description="Стандартын дагуу мэргэжлийн албан бланк удирдах систем"
                showBackButton hideBreadcrumbs backButtonPlacement="inline" backBehavior="history"
                fallbackBackHref="/dashboard"
                actions={
                    <div className="flex gap-2">
                        <Button variant="outline" asChild>
                            <Link href="/dashboard/official-letters/templates">
                                <FileText className="h-4 w-4 mr-2" /> Загварууд
                            </Link>
                        </Button>
                        <AddActionButton label="Шинэ бичиг" href="/dashboard/official-letters/create" />
                    </div>
                }
            />

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
                {[
                    { label: 'Нийт', value: counts.total, color: 'text-slate-700' },
                    { label: 'Ноорог', value: counts.draft, color: 'text-amber-600' },
                    { label: 'Илгээсэн', value: counts.sent, color: 'text-emerald-600' },
                ].map(s => (
                    <Card key={s.label}>
                        <CardContent className="pt-4 pb-3 px-4">
                            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                            <p className="text-xs text-muted-foreground">{s.label}</p>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Дугаар, гарчиг, байгууллагаар хайх..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
            </div>

            {/* List */}
            {isLoading ? (
                <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-20 w-full" />)}</div>
            ) : filtered.length === 0 ? (
                <div className="text-center py-20 border-2 border-dashed rounded-2xl">
                    <FileText className="h-12 w-12 mx-auto mb-4 opacity-10" />
                    <p className="text-muted-foreground">{search ? 'Хайлтын үр дүн олдсонгүй' : 'Одоогоор бичиг байхгүй байна'}</p>
                    {!search && <Button variant="outline" className="mt-4" asChild><Link href="/dashboard/official-letters/create">Шинэ бичиг үүсгэх</Link></Button>}
                </div>
            ) : (
                <div className="space-y-2">
                    {filtered.map(letter => (
                        <Card key={letter.id} className="hover:shadow-sm transition-shadow">
                            <CardContent className="p-4 flex items-center gap-4">
                                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                                    <FileText className="h-5 w-5 text-primary" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-mono text-sm font-semibold">{letter.letterNumber || '—'}</span>
                                        <Badge className={STATUS_COLORS[letter.status]} variant="secondary">
                                            {STATUS_LABELS[letter.status]}
                                        </Badge>
                                    </div>
                                    <p className="text-sm font-medium truncate mt-0.5">{letter.config?.subject || 'Гарчиггүй'}</p>
                                    <p className="text-xs text-muted-foreground">
                                        {letter.config?.addresseeOrg} · {letter.createdAt?.toDate ? format(letter.createdAt.toDate(), 'yyyy.MM.dd', { locale: mn }) : '—'}
                                    </p>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                    <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                                        <Link href={`/dashboard/official-letters/${letter.id}`}><Eye className="h-4 w-4" /></Link>
                                    </Button>
                                    {letter.status !== 'ARCHIVED' && (
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-amber-600"
                                            onClick={() => handleArchive(letter.id)} title="Архивлах">
                                            <Archive className="h-4 w-4" />
                                        </Button>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
