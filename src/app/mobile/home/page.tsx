'use client';

import * as React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useCollection, useFirebase, useMemoFirebase, updateDocumentNonBlocking, useDoc, tenantCollection, tenantDoc, useTenantWrite } from '@/firebase';
import { useEmployeeProfile } from '@/hooks/use-employee-profile';
import { query, orderBy, doc, getDoc, where, limit } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { MessageSquare, ThumbsUp, ChevronsDown, ChevronsUp, Heart, Clock, Calendar, CheckCircle, ArrowRight, BookOpen, User, Bell, Search, Sparkles, Palmtree, ChevronRight, Star, Trophy, FolderKanban, Building, ClipboardList } from 'lucide-react';
import { format, differenceInMinutes } from 'date-fns';
import { cn } from '@/lib/utils';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Employee } from '@/app/dashboard/employees/data';
import { Badge } from '@/components/ui/badge';
import { RecognitionPost, CoreValue } from '@/types/points';
import { GivePointsDialog } from '../points/_components/give-points-dialog';
import { formatDistanceToNow } from 'date-fns';
import { mn } from 'date-fns/locale';

// --- Types ---

type ReactionType = 'like' | 'love' | 'care';

type Post = {
    id: string;
    title: string;
    content: string;
    imageUrls?: string[];
    authorName: string;
    authorId?: string; // Optimistically standardizing
    createdAt: string;
    reactions: { [userId: string]: ReactionType };
};

type AttendanceRecord = {
    id: string;
    employeeId: string;
    date: string; // yyyy-MM-dd
    checkInTime: string;
    checkOutTime?: string;
    status: 'PRESENT' | 'LEFT';
}



// --- Components ---

function ReactionIcon({ type, className }: { type: ReactionType, className?: string }) {
    if (type === 'like') return <ThumbsUp className={cn("h-5 w-5 text-white bg-blue-500 rounded-full p-1 shadow-sm", className)} />;
    if (type === 'love') return <Heart className={cn("h-5 w-5 text-white bg-red-500 rounded-full p-1 shadow-sm", className)} fill="white" />;
    if (type === 'care') return <div className={cn("h-5 w-5 rounded-full bg-amber-400 flex items-center justify-center text-[10px] shadow-sm", className)}>🤗</div>;
    return null;
}

function PostSkeleton() {
    return (
        <Card className="overflow-hidden rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] border-0 bg-white mb-4">
            <CardHeader className="flex flex-row items-center gap-3 p-4 pb-2">
                <Skeleton className="h-9 w-9 rounded-full" />
                <div className="space-y-1.5">
                    <Skeleton className="h-3.5 w-28" />
                    <Skeleton className="h-2.5 w-20" />
                </div>
            </CardHeader>
            <CardContent className="space-y-2 p-4 pt-0">
                <Skeleton className="h-3.5 w-full" />
                <Skeleton className="h-3.5 w-4/5" />
                <Skeleton className="aspect-video w-full rounded-xl" />
            </CardContent>
            <CardFooter className="p-4 pt-0">
                <Skeleton className="h-8 w-20 rounded-lg" />
            </CardFooter>
        </Card>
    )
}

function PostCard({ post, userId }: { post: Post, userId: string | null }) {
    const postDate = React.useMemo(() => {
        if (!post.createdAt) return new Date();
        if (typeof post.createdAt === 'object' && 'toDate' in post.createdAt) return (post.createdAt as any).toDate();
        return new Date(post.createdAt);
    }, [post.createdAt]);
    const [isExpanded, setIsExpanded] = React.useState(false);
    const [isReactionsOpen, setIsReactionsOpen] = React.useState(false);
    const [reactionDetails, setReactionDetails] = React.useState<{ employee: Employee; reaction: ReactionType }[]>([]);
    const { firestore } = useFirebase();
    const { tDoc, tCollection } = useTenantWrite();

    const reactions = post.reactions || {};
    const userReaction = userId ? reactions[userId] : null;

    const handleReaction = (reaction: ReactionType) => {
        if (!firestore || !userId) return;
        const postRef = tDoc('posts', post.id);
        const currentReaction = reactions[userId];
        const newReactions = { ...reactions };
        if (currentReaction === reaction) {
            delete newReactions[userId];
        } else {
            newReactions[userId] = reaction;
        }
        updateDocumentNonBlocking(postRef, { reactions: newReactions });
    }

    const showReactions = async () => {
        if (!firestore || Object.keys(reactions).length === 0) return;
        const employeeCol = tCollection('employees');
        const details: { employee: Employee; reaction: ReactionType }[] = [];
        for (const uid in reactions) {
            const userDoc = await getDoc(doc(employeeCol, uid));
            if (userDoc.exists()) {
                details.push({ employee: userDoc.data() as Employee, reaction: reactions[uid] });
            }
        }
        setReactionDetails(details);
        setIsReactionsOpen(true);
    };

    const reactionCounts = Object.values(reactions).reduce((acc, curr) => {
        acc[curr] = (acc[curr] || 0) + 1;
        return acc;
    }, {} as Record<ReactionType, number>);
    const totalReactions = Object.values(reactionCounts).reduce((a, b) => a + b, 0);

    return (
        <Card className="overflow-hidden rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] border-0 bg-white mb-4 animate-in fade-in slide-in-from-bottom-2">
            <Dialog open={isReactionsOpen} onOpenChange={setIsReactionsOpen}>
                <DialogContent className="rounded-2xl w-[90vw]">
                    <DialogHeader>
                        <DialogTitle>Реакцууд</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3 max-h-[50vh] overflow-y-auto">
                        {reactionDetails.map(({ employee, reaction }) => (
                            <div key={employee.id} className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-xl transition-colors">
                                <div className="flex items-center gap-3">
                                    <Avatar className="h-8 w-8">
                                        <AvatarImage src={employee.photoURL} />
                                        <AvatarFallback>{employee.firstName?.[0]}</AvatarFallback>
                                    </Avatar>
                                    <span className="text-sm font-medium">{employee.firstName} {employee.lastName}</span>
                                </div>
                                <ReactionIcon type={reaction} />
                            </div>
                        ))}
                    </div>
                </DialogContent>
            </Dialog>

            <CardHeader className="flex flex-row items-center gap-3 p-4 pb-2">
                <Avatar className="h-9 w-9 shadow-sm">
                    <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-purple-500 text-white font-semibold text-sm">
                        {post.authorName.charAt(0)}
                    </AvatarFallback>
                </Avatar>
                <div className="flex flex-col">
                    <span className="text-sm font-semibold text-slate-900">{post.authorName}</span>
                    <span className="text-[10px] text-slate-400">{format(postDate, 'yyyy.MM.dd HH:mm')}</span>
                </div>
            </CardHeader>

            <CardContent className="p-4 pt-0 space-y-2">
                <h3 className="text-sm font-semibold text-slate-800 leading-snug">{post.title}</h3>
                <div
                    className={cn("text-sm text-slate-600 leading-relaxed", !isExpanded && "line-clamp-3")}
                    dangerouslySetInnerHTML={{ __html: post.content.replace(/\n/g, '<br />') }}
                />
                {post.content.length > 200 && (
                    <button onClick={() => setIsExpanded(!isExpanded)} className="text-xs font-semibold text-primary">
                        {isExpanded ? 'Хураах' : 'Цааш унших'}
                    </button>
                )}

                {post.imageUrls && post.imageUrls.length > 0 && (
                    <div className="rounded-xl overflow-hidden mt-2">
                        <Carousel className="w-full">
                            <CarouselContent>
                                {post.imageUrls.map((url, index) => (
                                    <CarouselItem key={index}>
                                        <div className="relative aspect-video w-full bg-slate-100">
                                            <Image src={url} alt="Post" fill className="object-cover" />
                                        </div>
                                    </CarouselItem>
                                ))}
                            </CarouselContent>
                        </Carousel>
                    </div>
                )}
            </CardContent>

            <CardFooter className="p-4 pt-2 flex flex-col items-start gap-3">
                {totalReactions > 0 && (
                    <button onClick={showReactions} className="flex items-center gap-2">
                        <div className="flex -space-x-1.5">
                            {(Object.keys(reactionCounts) as ReactionType[]).map(r => (
                                <div key={r} className="ring-2 ring-white rounded-full">
                                    <ReactionIcon type={r} />
                                </div>
                            ))}
                        </div>
                        <span className="text-[11px] font-medium text-slate-500">{totalReactions}</span>
                    </button>
                )}

                <div className="flex w-full items-center justify-between border-t border-slate-50 pt-3">
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="ghost" size="sm" className={cn("flex-1 gap-2 rounded-xl h-9", userReaction && "text-primary")}>
                                {userReaction ? <ReactionIcon type={userReaction} /> : <ThumbsUp className="h-4 w-4" />}
                                <span className="text-xs">Таалагдлаа</span>
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-2 rounded-full flex gap-2" align="start">
                            <button onClick={() => handleReaction('like')} className="p-2 hover:bg-blue-50 rounded-full transition-transform hover:scale-110"><ThumbsUp className="h-5 w-5 text-blue-500" /></button>
                            <button onClick={() => handleReaction('love')} className="p-2 hover:bg-red-50 rounded-full transition-transform hover:scale-110"><Heart className="h-5 w-5 text-red-500" /></button>
                            <button onClick={() => handleReaction('care')} className="p-2 hover:bg-amber-50 rounded-full text-xl transition-transform hover:scale-110">🤗</button>
                        </PopoverContent>
                    </Popover>
                    <Button variant="ghost" size="sm" className="flex-1 gap-2 rounded-xl text-slate-400 h-9">
                        <MessageSquare className="h-4 w-4" />
                        <span className="text-xs">Сэтгэгдэл</span>
                    </Button>
                </div>
            </CardFooter>
        </Card>
    );
}

function RecognitionPostCard({ post, userId }: { post: RecognitionPost, userId: string | null }) {
    const { firestore } = useFirebase();
    const { tDoc, tCollection } = useTenantWrite();
    const [sender, setSender] = React.useState<any>(null);
    const [receivers, setReceivers] = React.useState<any[]>([]);
    const [valueData, setValueData] = React.useState<CoreValue | null>(null);
    const [isReactionsOpen, setIsReactionsOpen] = React.useState(false);
    const [reactionDetails, setReactionDetails] = React.useState<{ employee: Employee; reaction: ReactionType }[]>([]);

    const postDate = React.useMemo(() => {
        if (!post.createdAt) return new Date();
        if (typeof post.createdAt === 'object' && 'toDate' in post.createdAt) return (post.createdAt as any).toDate();
        return new Date(post.createdAt);
    }, [post.createdAt]);
    const reactions = post.reactions || {};
    const userReaction = userId ? reactions[userId] : null;

    React.useEffect(() => {
        if (!firestore) return;
        getDoc(tDoc('employees', post.fromUserId)).then(s => setSender(s.data()));
        Promise.all(post.toUserId.map(id => getDoc(tDoc('employees', id)))).then(snaps => {
            setReceivers(snaps.map(s => s.data()));
        });
        getDoc(tDoc('company', 'branding', 'values', post.valueId)).then(v => setValueData({ id: v.id, ...v.data() } as CoreValue));
    }, [post, firestore, tDoc]);

    const handleReaction = (reaction: ReactionType) => {
        if (!firestore || !userId) return;
        const postRef = tDoc('recognition_posts', post.id);
        const currentReaction = reactions[userId];
        const newReactions = { ...reactions };
        if (currentReaction === reaction) {
            delete newReactions[userId];
        } else {
            newReactions[userId] = reaction;
        }
        updateDocumentNonBlocking(postRef, { reactions: newReactions });
    }

    const showReactions = async () => {
        if (!firestore || Object.keys(reactions).length === 0) return;
        const employeeCol = tCollection('employees');
        const details: { employee: Employee; reaction: ReactionType }[] = [];
        for (const uid in reactions) {
            const userDoc = await getDoc(doc(employeeCol, uid));
            if (userDoc.exists()) {
                details.push({ employee: userDoc.data() as Employee, reaction: reactions[uid] });
            }
        }
        setReactionDetails(details);
        setIsReactionsOpen(true);
    };

    const reactionCounts = Object.values(reactions).reduce((acc, curr) => {
        acc[curr] = (acc[curr] || 0) + 1;
        return acc;
    }, {} as Record<ReactionType, number>);
    const totalReactions = Object.values(reactionCounts).reduce((a, b) => a + b, 0);

    if (!sender || receivers.length === 0) return null;

    const receiverNames = receivers.map(r => `${r?.lastName?.[0]}. ${r?.firstName}`).join(', ');

    return (
        <Card className="overflow-hidden rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] border-0 bg-white mb-4 animate-in fade-in slide-in-from-bottom-2">
            <Dialog open={isReactionsOpen} onOpenChange={setIsReactionsOpen}>
                <DialogContent className="rounded-2xl w-[90vw]">
                    <DialogHeader>
                        <DialogTitle>Реакцууд</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3 max-h-[50vh] overflow-y-auto">
                        {reactionDetails.map(({ employee, reaction }) => (
                            <div key={employee.id} className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-xl transition-colors">
                                <div className="flex items-center gap-3">
                                    <Avatar className="h-8 w-8">
                                        <AvatarImage src={employee.photoURL} />
                                        <AvatarFallback>{employee.firstName?.[0]}</AvatarFallback>
                                    </Avatar>
                                    <span className="text-sm font-medium">{employee.firstName} {employee.lastName}</span>
                                </div>
                                <ReactionIcon type={reaction} />
                            </div>
                        ))}
                    </div>
                </DialogContent>
            </Dialog>

            <CardHeader className="flex flex-row items-center justify-between p-4 pb-2">
                <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9 shadow-sm">
                        <AvatarImage src={sender.photoURL} />
                        <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-purple-500 text-white font-semibold text-sm">
                            {sender.firstName?.[0]}
                        </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                        <div className="flex items-center gap-1 text-sm font-semibold">
                            <span className="text-slate-900">{sender.firstName}</span>
                            <span className="text-primary mx-0.5">→</span>
                            <span className="text-slate-900 line-clamp-1">{receiverNames}</span>
                        </div>
                        <span className="text-[10px] text-slate-400">{formatDistanceToNow(postDate, { addSuffix: true, locale: mn })}</span>
                    </div>
                </div>
                <Badge variant="secondary" className="font-semibold text-xs text-amber-600 bg-amber-50 border-0">
                    +{post.pointAmount} ⭐
                </Badge>
            </CardHeader>

            <CardContent className="p-4 pt-0 space-y-2">
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-semibold inline-flex uppercase tracking-tight"
                    style={{ color: valueData?.color || '#666', backgroundColor: `${valueData?.color}10` }}>
                    <span>{valueData?.emoji}</span> {valueData?.title}
                </div>
                <p className="text-sm text-slate-600 leading-relaxed">
                    "{post.message}"
                </p>
            </CardContent>

            <CardFooter className="p-4 pt-2 flex flex-col items-start gap-3">
                {totalReactions > 0 && (
                    <button onClick={showReactions} className="flex items-center gap-2">
                        <div className="flex -space-x-1.5">
                            {(Object.keys(reactionCounts) as ReactionType[]).map(r => (
                                <div key={r} className="ring-2 ring-white rounded-full">
                                    <ReactionIcon type={r} />
                                </div>
                            ))}
                        </div>
                        <span className="text-[11px] font-medium text-slate-500">{totalReactions}</span>
                    </button>
                )}

                <div className="flex w-full items-center justify-between border-t border-slate-50 pt-3">
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="ghost" size="sm" className={cn("flex-1 gap-2 rounded-xl h-9", userReaction && "text-primary")}>
                                {userReaction ? <ReactionIcon type={userReaction} /> : <ThumbsUp className="h-4 w-4" />}
                                <span className="text-xs">Таалагдлаа</span>
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-2 rounded-full flex gap-2" align="start">
                            <button onClick={() => handleReaction('like')} className="p-2 hover:bg-blue-50 rounded-full transition-transform hover:scale-110"><ThumbsUp className="h-5 w-5 text-blue-500" /></button>
                            <button onClick={() => handleReaction('love')} className="p-2 hover:bg-red-50 rounded-full transition-transform hover:scale-110"><Heart className="h-5 w-5 text-red-500" /></button>
                            <button onClick={() => handleReaction('care')} className="p-2 hover:bg-amber-50 rounded-full text-xl transition-transform hover:scale-110">🤗</button>
                        </PopoverContent>
                    </Popover>
                    <Button variant="ghost" size="sm" className="flex-1 gap-2 rounded-xl text-slate-400 h-9">
                        <MessageSquare className="h-4 w-4" />
                        <span className="text-xs">Сэтгэгдэл</span>
                    </Button>
                </div>
            </CardFooter>
        </Card>
    );
}

function EmployeeCarousel() {
    const { firestore } = useFirebase();
    const { employeeProfile } = useEmployeeProfile();
    const employeesQuery = useMemoFirebase(({ companyPath }) => firestore ? tenantCollection(firestore, companyPath, 'employees') : null, [firestore]);
    const { data: employees, isLoading } = useCollection<Employee>(employeesQuery);

    const isViewerAdmin = employeeProfile?.role === 'company_super_admin' || employeeProfile?.role === 'admin';
    const visibleEmployees = React.useMemo(() => {
        if (!employees) return [];
        if (isViewerAdmin) return employees;

        // Hide the initial system admin account from non-admin employees.
        return employees.filter((e) => {
            const isInitialAdmin =
                (e.role === 'company_super_admin' || e.role === 'admin') &&
                e.firstName === 'Admin' &&
                e.lastName === 'User';
            return !isInitialAdmin;
        });
    }, [employees, isViewerAdmin]);

    if (isLoading) {
        return (
            <div className="flex gap-3 overflow-hidden px-5 pb-4">
                {[1, 2, 3, 4, 5].map(i => (
                    <Skeleton key={i} className="h-14 w-14 rounded-xl shrink-0" />
                ))}
            </div>
        )
    }

    if (!visibleEmployees || visibleEmployees.length === 0) return null;

    return (
        <div className="w-full overflow-x-auto pb-4 px-5 scrollbar-hide">
            <div className="flex gap-3 w-max">
                {visibleEmployees.map((employee) => (
                    <Link href="/mobile/employees" key={employee.id} className="group relative">
                        <div className="flex flex-col items-center gap-1.5">
                            <div className="relative">
                                <Avatar className="w-14 h-14 rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.06)] group-hover:shadow-[0_4px_12px_rgba(0,0,0,0.1)] transition-all group-active:scale-95">
                                    <AvatarImage src={employee.photoURL} alt={employee.firstName} className="object-cover" />
                                    <AvatarFallback className="rounded-xl bg-gradient-to-br from-slate-50 to-slate-100 text-slate-600 font-semibold text-sm">
                                        {employee.firstName?.charAt(0)}
                                    </AvatarFallback>
                                </Avatar>
                                {/* Online indicator */}
                                <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 border-2 border-white rounded-full" />
                            </div>
                            <span className="text-[11px] font-medium text-slate-500 max-w-[56px] truncate text-center">
                                {employee.firstName}
                            </span>
                        </div>
                    </Link>
                ))}
            </div>
        </div>
    );
}

function AttendanceStatusWidget() {
    const { employeeProfile } = useEmployeeProfile();
    const { firestore } = useFirebase();
    const router = useRouter();
    const [currentTime, setCurrentTime] = React.useState(new Date());

    React.useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000 * 60);
        return () => clearInterval(timer);
    }, []);

    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const attendanceQuery = useMemoFirebase(({ companyPath }) => employeeProfile ? query(
        tenantCollection(firestore, companyPath, 'attendance'),
        where('employeeId', '==', employeeProfile.id),
        where('date', '==', todayStr)
    ) : null, [firestore, employeeProfile, todayStr]);

    const { data: attendanceRecords, isLoading } = useCollection<AttendanceRecord>(attendanceQuery);
    const todayRecord = attendanceRecords?.[0];

    const isCheckedIn = !!todayRecord && !todayRecord.checkOutTime;
    const isCheckedOut = !!todayRecord?.checkOutTime;

    const durationText = React.useMemo(() => {
        if (!todayRecord?.checkInTime) return null;
        const start = new Date(todayRecord.checkInTime);
        const end = todayRecord.checkOutTime ? new Date(todayRecord.checkOutTime) : currentTime;
        const diff = differenceInMinutes(end, start);
        const hours = Math.floor(diff / 60);
        const mins = diff % 60;
        return `${hours}ц ${mins}м`;
    }, [todayRecord, currentTime]);

    if (isLoading) return <div className="px-5"><Skeleton className="h-28 w-full rounded-2xl" /></div>;

    return (
        <div className="px-5">
            <Card className="rounded-2xl border-0 shadow-[0_2px_12px_rgba(99,102,241,0.15)] bg-gradient-to-br from-indigo-600 to-violet-600 text-white overflow-hidden relative group cursor-pointer transition-all active:scale-[0.98]" onClick={() => router.push('/mobile/attendance')}>
                {/* Decorative shapes */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-black/10 rounded-full blur-2xl translate-y-1/2 -translate-x-1/2" />

                <CardContent className="p-4 relative z-10 flex items-center justify-between">
                    <div>
                        <div className="flex items-center gap-1.5 mb-1 opacity-80">
                            <Clock className="w-3.5 h-3.5" />
                            <span className="text-[10px] font-semibold tracking-wide uppercase">Өнөөдрийн ирц</span>
                        </div>

                        <div className="flex items-baseline gap-2 mb-1.5">
                            {todayRecord ? (
                                <span className="text-2xl font-bold tracking-tight">
                                    {todayRecord.checkInTime ? format(new Date(todayRecord.checkInTime), 'HH:mm') : '--:--'}
                                </span>
                            ) : (
                                <span className="text-xl font-semibold opacity-90">Бүртгэлгүй</span>
                            )}
                        </div>

                        {durationText ? (
                            <span className="text-xs font-medium text-white/80">
                                ⏱ {durationText} ажилласан
                            </span>
                        ) : (
                            <span className="text-xs font-medium text-white/80">
                                Ирц бүртгүүлэх бол дарна уу
                            </span>
                        )}
                    </div>

                    <div className="h-11 w-11 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center">
                        {isCheckedIn ? <CheckCircle className="w-5 h-5 text-white" /> : <ArrowRight className="w-5 h-5 text-white" />}
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}



function QuickActions() {
    const router = useRouter();

    const actions = [
        { label: 'Ирц', icon: Clock, color: 'text-indigo-600', bg: 'bg-indigo-50', onClick: () => router.push('/mobile/attendance') },
        { label: 'Судалгаа', icon: ClipboardList, color: 'text-rose-600', bg: 'bg-rose-50', onClick: () => router.push('/mobile/survey') },
        { label: 'Төсөл', icon: FolderKanban, color: 'text-violet-600', bg: 'bg-violet-50', onClick: () => router.push('/mobile/projects') },
        { label: 'Амралт', icon: Palmtree, color: 'text-emerald-600', bg: 'bg-emerald-50', onClick: () => router.push('/mobile/vacation') },
        { label: 'Оноо', icon: Star, color: 'text-amber-500', bg: 'bg-amber-50', onClick: () => router.push('/mobile/points') },
    ];

    return (
        <div className="px-5">
            <div className="grid grid-cols-5 gap-3">
                {actions.map((action, i) => (
                    <div key={i} className="flex flex-col items-center gap-2 cursor-pointer group active:scale-95 transition-transform" onClick={action.onClick}>
                        <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center transition-all shadow-[0_2px_8px_rgba(0,0,0,0.04)] bg-white", action.color)}>
                            <action.icon className="w-6 h-6" />
                        </div>
                        <span className="text-[11px] font-semibold text-slate-500 text-center">{action.label}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

// Time-based greeting helper
function getGreeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'Өглөөний мэнд';
    if (hour < 18) return 'Өдрийн мэнд';
    return 'Оройн мэнд';
}

export default function MobileHomePage() {
    const { firestore } = useFirebase();
    const { employeeProfile } = useEmployeeProfile();
    const [logoFailed, setLogoFailed] = React.useState(false);

    const postsQuery = useMemoFirebase(
        ({ companyPath }) => firestore ? query(tenantCollection(firestore, companyPath, 'posts'), orderBy('createdAt', 'desc'), limit(15)) : null,
        [firestore]
    );
    const recognitionQuery = useMemoFirebase(
        ({ companyPath }) => firestore ? query(tenantCollection(firestore, companyPath, 'recognition_posts'), orderBy('createdAt', 'desc'), limit(15)) : null,
        [firestore]
    );

    const { data: posts, isLoading: isPostsLoading } = useCollection<Post>(postsQuery);
    const { data: recPosts, isLoading: isRecLoading } = useCollection<RecognitionPost>(recognitionQuery);

    const unifiedFeed = React.useMemo(() => {
        if (!posts && !recPosts) return [];
        const combined = [
            ...(posts?.map(p => ({ ...p, feedType: 'post' as const })) || []),
            ...(recPosts?.map(p => ({ ...p, feedType: 'recognition' as const })) || [])
        ];

        return combined.sort((a, b) => {
            const dateA = a.createdAt instanceof Object && 'toDate' in a.createdAt ? a.createdAt.toDate().getTime() : new Date(a.createdAt).getTime();
            const dateB = b.createdAt instanceof Object && 'toDate' in b.createdAt ? b.createdAt.toDate().getTime() : new Date(b.createdAt).getTime();
            return dateB - dateA;
        });
    }, [posts, recPosts]);

    const isLoading = isPostsLoading || isRecLoading;

    const { data: companyProfile } = useDoc<any>(
        useMemoFirebase(({ companyPath }) => (firestore ? tenantDoc(firestore, companyPath, 'company', 'profile') : null), [firestore])
    );

    // Format today's date in Mongolian
    const todayFormatted = format(new Date(), 'M сарын d, EEEE', { locale: mn });

    React.useEffect(() => {
        setLogoFailed(false);
    }, [companyProfile?.logoUrl]);

    return (
        <div className="min-h-screen bg-slate-50/50 pb-20 font-sans">
            {/* Sticky Header with Blur - iOS Style */}
            <header className="sticky top-0 z-30 border-b border-slate-200/60 bg-white/75 backdrop-blur-xl shadow-[0_1px_3px_rgba(0,0,0,0.04)] supports-[backdrop-filter]:bg-white/60">
                <div className="px-5 pb-3 pt-[calc(env(safe-area-inset-top)+14px)]">
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3.5 min-w-0">
                            <div className="relative h-11 w-11 shrink-0 rounded-2xl bg-white overflow-hidden ring-[3px] ring-primary/5 shadow-sm">
                                {companyProfile?.logoUrl && !logoFailed ? (
                                    <Image
                                        src={companyProfile.logoUrl}
                                        alt={companyProfile?.name || 'Logo'}
                                        fill
                                        sizes="44px"
                                        onError={() => setLogoFailed(true)}
                                        className="object-contain p-0 scale-[1.12]"
                                    />
                                ) : (
                                    <div className="h-full w-full flex items-center justify-center bg-primary/10">
                                        <Building className="h-5 w-5 text-primary" />
                                    </div>
                                )}
                            </div>

                            <div className="min-w-0">
                                <h1 className="text-[18px] font-semibold tracking-tight text-slate-900 leading-tight truncate">
                                    {employeeProfile ? (
                                        <>
                                            {getGreeting()},{' '}
                                            <span className="font-bold">{employeeProfile.firstName}</span>
                                        </>
                                    ) : (
                                        getGreeting()
                                    )}
                                </h1>
                                <p className="mt-1 text-[12px] font-medium text-slate-500 truncate">
                                    {companyProfile?.name ? (
                                        <>
                                            {companyProfile.name}
                                            <span className="mx-1.5 text-slate-300">•</span>
                                        </>
                                    ) : null}
                                    <span className="capitalize">{todayFormatted}</span>
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="rounded-2xl bg-white/70 hover:bg-white text-slate-600 ring-1 ring-slate-200/70 h-10 w-10 transition-colors"
                            >
                                <Search className="h-[18px] w-[18px]" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="rounded-2xl bg-white/70 hover:bg-white text-slate-600 ring-1 ring-slate-200/70 h-10 w-10 relative transition-colors"
                            >
                                <Bell className="h-[18px] w-[18px]" />
                                <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white" />
                            </Button>
                        </div>
                    </div>
                </div>
            </header>

            <main className="space-y-6 pt-5 animate-in fade-in-30 slide-in-from-bottom-5">
                {/* Attendance Card */}
                <AttendanceStatusWidget />

                {/* Quick Actions Grid */}
                <QuickActions />



                {/* Team Section */}
                <div className="space-y-3">
                    <div className="px-5 flex items-center justify-between">
                        <h2 className="text-base font-semibold text-slate-900">Хамт олон</h2>
                        <Link href="/mobile/employees" className="text-sm font-medium text-primary">Бүгд</Link>
                    </div>
                    <EmployeeCarousel />
                </div>

                {/* News Feed */}
                <div className="space-y-3">
                    <h2 className="text-base font-semibold text-slate-900 px-5">Шинэ мэдээ</h2>

                    {isLoading && (
                        <div className="px-5">
                            <PostSkeleton />
                            <PostSkeleton />
                        </div>
                    )}

                    {!isLoading && unifiedFeed.length > 0 && (
                        <div className="px-5 pb-4">
                            {unifiedFeed.map(item => (
                                item.feedType === 'post' ? (
                                    <PostCard key={item.id} post={item as Post} userId={employeeProfile?.id || null} />
                                ) : (
                                    <RecognitionPostCard key={item.id} post={item as RecognitionPost} userId={employeeProfile?.id || null} />
                                )
                            ))}
                        </div>
                    )}

                    {!isLoading && unifiedFeed.length === 0 && (
                        <div className="px-5">
                            <Card className="bg-slate-50/50 border-dashed border-2 border-slate-200 p-10 text-center rounded-2xl">
                                <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                    <MessageSquare className="w-6 h-6 text-slate-400" />
                                </div>
                                <h3 className="text-slate-900 font-semibold text-sm">Одоогоор мэдээ алга</h3>
                                <p className="text-slate-500 text-xs mt-1">Шинэ мэдээлэл орохоор энд харагдах болно.</p>
                            </Card>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
