'use client';

import * as React from 'react';
import { z } from 'zod';
import { useFirebase, useDoc, useMemoFirebase, useFetchCollection, tenantDoc, tenantCollection } from '@/firebase';
import { doc, collection } from 'firebase/firestore';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Building, Rocket, Eye, Users2, Phone, Mail,
    MapPin, ScrollText, Briefcase, Globe, ChevronRight, Info, Hash, User, Quote, Calendar, FileText, History, Play, Image as ImageIcon
} from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import {
    Carousel,
    CarouselContent,
    CarouselItem,
    CarouselApi
} from '@/components/ui/carousel';

// Types
import { CoreValue } from '@/types/points';
import { CompanyHistoryEvent } from '@/types/company-history';

const videoSchema = z.object({
    title: z.string(),
    description: z.string().optional(),
    url: z.string(),
});

const companyProfileSchema = z.object({
    name: z.string(),
    logoUrl: z.string().optional(),
    mission: z.string().optional(),
    vision: z.string().optional(),
    videos: z.array(videoSchema).optional(),
    phoneNumber: z.string().optional(),
    contactEmail: z.string().email().optional().or(z.literal('')),
    address: z.string().optional(),
    website: z.string().optional(),
    employeeCount: z.string().optional(),
    industry: z.string().optional(),
    legalName: z.string().optional(),
    registrationNumber: z.string().optional(),
    taxId: z.string().optional(),
    ceo: z.string().optional(),
    introduction: z.string().optional(),
    establishedDate: z.string().optional(),
    coverUrls: z.array(z.string()).optional(),
});

type CompanyProfileValues = z.infer<typeof companyProfileSchema>;

function PageSkeleton() {
    return (
        <div className="bg-background min-h-screen space-y-8">
            <div className="h-64 bg-muted animate-pulse" />
            <div className="px-6 -mt-12 space-y-6">
                <div className="flex flex-col items-center">
                    <Skeleton className="h-24 w-24 rounded-2xl shadow-lg" />
                    <Skeleton className="h-8 w-48 mt-4" />
                    <Skeleton className="h-4 w-32 mt-2" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <Skeleton className="h-24 rounded-xl" />
                    <Skeleton className="h-24 rounded-xl" />
                </div>
            </div>
        </div>
    );
}

export default function MobileCompanyPage() {
    const { firestore } = useFirebase();

    // Queries
    const companyProfileRef = useMemoFirebase(
        ({ companyPath }) => (firestore ? tenantDoc(firestore, companyPath, 'company', 'profile') : null),
        [firestore]
    );
    const valuesQuery = useMemoFirebase(
        ({ firestore, companyPath }) => {
            if (!firestore) return null;
            const base = companyPath ? `${companyPath}/company` : 'company';
            return collection(firestore, base, 'branding', 'values');
        },
        []
    );
    const historyQuery = useMemoFirebase(
        ({ companyPath }) => firestore ? tenantCollection(firestore, companyPath, 'companyHistory') : null,
        [firestore]
    );

    // Data Fetching
    const { data: companyProfile, isLoading: isLoadingProfile } = useDoc<CompanyProfileValues>(companyProfileRef as any);
    const { data: coreValues } = useFetchCollection<CoreValue>(valuesQuery);
    const { data: historyEvents } = useFetchCollection<CompanyHistoryEvent>(historyQuery);

    const [api, setApi] = React.useState<CarouselApi>();
    const [selectedValue, setSelectedValue] = React.useState<CoreValue | null>(null);
    const [selectedHistoryVideo, setSelectedHistoryVideo] = React.useState<{ url: string; title: string } | null>(null);

    // Helper function to get YouTube embed URL
    const getYouTubeEmbedUrl = (url: string) => {
        // Handle various YouTube URL formats
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
        const match = url.match(regExp);
        const videoId = match && match[2].length === 11 ? match[2] : null;
        if (videoId) {
            return `https://www.youtube.com/embed/${videoId}`;
        }
        // Return original URL if not YouTube (might be direct video file)
        return url;
    };

    React.useEffect(() => {
        if (!api) return;

        const intervalId = setInterval(() => {
            api.scrollNext();
        }, 5000);

        return () => clearInterval(intervalId);
    }, [api]);

    if (isLoadingProfile) return <PageSkeleton />;

    if (!companyProfile) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] p-6 text-center text-muted-foreground">
                <Building className="h-12 w-12 mb-4 opacity-20" />
                <p>Компанийн мэдээлэл олдсонгүй.</p>
            </div>
        )
    }


    return (
        <div className="min-h-screen bg-slate-50/50">
            {/* Hero Section with Cover */}
            {companyProfile.coverUrls && companyProfile.coverUrls.length > 0 ? (
                <div className="relative w-full">
                    <Carousel setApi={setApi} className="w-full" opts={{ loop: true }}>
                        <CarouselContent className="-ml-0">
                            {companyProfile.coverUrls.map((url, index) => (
                                <CarouselItem key={index} className="pl-0">
                                    <div className="relative w-full">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img 
                                            src={url} 
                                            alt={`Cover ${index + 1}`}
                                            className="w-full h-auto max-h-[280px] object-cover object-top"
                                        />
                                        {/* Gradient overlay */}
                                        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/20" />
                                    </div>
                                </CarouselItem>
                            ))}
                        </CarouselContent>
                    </Carousel>
                </div>
            ) : (
                <div className="relative h-40 bg-gradient-to-br from-indigo-600 via-primary to-violet-600 overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
                    <div className="absolute bottom-0 left-0 w-48 h-48 bg-black/10 rounded-full translate-y-1/2 -translate-x-1/2 blur-2xl" />
                </div>
            )}

            {/* Main Content */}
            <div className="px-5 -mt-12 relative z-20 space-y-6 pb-8">
                {/* Logo & Company Name Card */}
                <Card className="rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.08)] border-0 bg-white overflow-hidden">
                    <CardContent className="p-5">
                        <div className="flex items-center gap-4">
                            <div className="h-16 w-16 rounded-xl bg-slate-50 p-1.5 shadow-sm flex items-center justify-center flex-shrink-0">
                                <Avatar className="h-full w-full rounded-lg">
                                    <AvatarImage src={companyProfile.logoUrl} className="object-contain" />
                                    <AvatarFallback className="rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-bold text-lg">
                                        {companyProfile.name?.charAt(0)}
                                    </AvatarFallback>
                                </Avatar>
                            </div>
                            <div className="flex-1 min-w-0">
                                <h1 className="text-lg font-bold text-slate-900 leading-tight">{companyProfile.name}</h1>
                                {companyProfile.industry && (
                                    <p className="text-sm text-slate-500 mt-0.5">{companyProfile.industry}</p>
                                )}
                                {companyProfile.website && (
                                    <a href={companyProfile.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary mt-1.5 font-medium">
                                        <Globe className="h-3 w-3" />
                                        {new URL(companyProfile.website).hostname}
                                    </a>
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* CEO Card - if available */}
                {companyProfile.ceo && (
                    <Card className="rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] border-0 bg-white">
                        <CardContent className="p-4">
                            <div className="flex items-center gap-4">
                                <div className="h-12 w-12 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
                                    <User className="h-6 w-6 text-slate-500" />
                                </div>
                                <div className="flex-1">
                                    <p className="text-xs text-slate-400 font-medium">Гүйцэтгэх захирал</p>
                                    <p className="text-base font-semibold text-slate-900">{companyProfile.ceo}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Mission & Vision */}
                {(companyProfile.mission || companyProfile.vision) && (
                    <div className="space-y-3">
                        <h2 className="text-base font-semibold text-slate-900 px-1">Бидний тухай</h2>
                        <div className="space-y-3">
                            {companyProfile.mission && (
                                <Card className="rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] border-0 bg-gradient-to-br from-blue-50 to-white overflow-hidden">
                                    <CardContent className="p-4">
                                        <div className="flex items-start gap-3">
                                            <div className="h-10 w-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0">
                                                <Rocket className="h-5 w-5" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h3 className="font-semibold text-slate-800 text-sm">Эрхэм зорилго</h3>
                                                <p className="text-sm text-slate-600 leading-relaxed mt-1">
                                                    {companyProfile.mission}
                                                </p>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            )}

                            {companyProfile.vision && (
                                <Card className="rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] border-0 bg-gradient-to-br from-purple-50 to-white overflow-hidden">
                                    <CardContent className="p-4">
                                        <div className="flex items-start gap-3">
                                            <div className="h-10 w-10 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center flex-shrink-0">
                                                <Eye className="h-5 w-5" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h3 className="font-semibold text-slate-800 text-sm">Алсын хараа</h3>
                                                <p className="text-sm text-slate-600 leading-relaxed mt-1">
                                                    {companyProfile.vision}
                                                </p>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            )}
                        </div>
                    </div>
                )}

                {/* Introduction Quote */}
                {companyProfile.introduction && (
                    <Card className="rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] border-0 bg-white">
                        <CardContent className="p-5">
                            <div className="relative">
                                <Quote className="h-6 w-6 text-slate-200 absolute -top-1 -left-1" />
                                <p className="text-sm text-slate-600 leading-relaxed italic pl-5 pr-2">
                                    {companyProfile.introduction}
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Values Section */}
                {coreValues && coreValues.filter(v => v.isActive !== false).length > 0 && (
                    <div className="space-y-3">
                        <h2 className="text-base font-semibold text-slate-900 px-1">Үнэт зүйлс</h2>
                        <div className="flex overflow-x-auto pb-2 gap-3 -mx-5 px-5 snap-x snap-mandatory scrollbar-hide">
                            {coreValues
                                .filter(v => v.isActive !== false)
                                .sort((a, b) => {
                                    const getTime = (val: any) => {
                                        if (!val) return 0;
                                        if (typeof val.toDate === 'function') return val.toDate().getTime();
                                        if (val instanceof Date) return val.getTime();
                                        return new Date(val).getTime() || 0;
                                    };
                                    return getTime(a.createdAt) - getTime(b.createdAt);
                                })
                                .map((value, index) => (
                                    <div 
                                        key={value.id || index} 
                                        className="snap-center min-w-[160px] max-w-[160px] bg-white rounded-xl p-4 shadow-[0_2px_8px_rgba(0,0,0,0.04)] flex flex-col gap-2 cursor-pointer active:scale-95 transition-transform"
                                        onClick={() => setSelectedValue(value)}
                                    >
                                        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-2xl" style={{ backgroundColor: `${value.color}15` }}>
                                            {value.emoji || '⭐'}
                                        </div>
                                        <div>
                                            <h4 className="font-semibold text-sm text-slate-800">{value.title}</h4>
                                            <p className="text-xs text-slate-500 line-clamp-3 leading-relaxed mt-0.5">{value.description}</p>
                                        </div>
                                    </div>
                                ))}
                        </div>
                    </div>
                )}

                {/* Value Detail Dialog */}
                <Dialog open={!!selectedValue} onOpenChange={(open) => !open && setSelectedValue(null)}>
                    <DialogContent className="rounded-2xl w-[90vw] max-w-sm p-0 overflow-hidden">
                        {selectedValue && (
                            <>
                                {/* Header with color */}
                                <div 
                                    className="p-6 pb-4 text-center"
                                    style={{ backgroundColor: `${selectedValue.color}15` }}
                                >
                                    <div 
                                        className="w-16 h-16 rounded-2xl flex items-center justify-center text-4xl mx-auto mb-3 bg-white shadow-sm"
                                        style={{ color: selectedValue.color }}
                                    >
                                        {selectedValue.emoji || '⭐'}
                                    </div>
                                    <DialogTitle className="text-lg font-bold text-slate-900">
                                        {selectedValue.title}
                                    </DialogTitle>
                                </div>
                                {/* Description */}
                                <div className="p-6 pt-4">
                                    <p className="text-sm text-slate-600 leading-relaxed">
                                        {selectedValue.description}
                                    </p>
                                </div>
                            </>
                        )}
                    </DialogContent>
                </Dialog>

                {/* Videos Section - Inline Players */}
                {companyProfile.videos && companyProfile.videos.length > 0 && (
                    <div className="space-y-3">
                        <h2 className="text-base font-semibold text-slate-900 px-1">Видео</h2>
                        <div className="space-y-4">
                            {companyProfile.videos.map((video, index) => (
                                <Card key={index} className="rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] border-0 bg-white overflow-hidden">
                                    {/* Video Player - Inline */}
                                    <div className="relative aspect-video bg-black">
                                        <iframe
                                            src={getYouTubeEmbedUrl(video.url)}
                                            title={video.title}
                                            className="w-full h-full"
                                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                            allowFullScreen
                                        />
                                    </div>
                                    {/* Video Info */}
                                    <CardContent className="p-4">
                                        <h4 className="font-semibold text-sm text-slate-900">{video.title}</h4>
                                        {video.description && (
                                            <p className="text-xs text-slate-500 mt-1 leading-relaxed">{video.description}</p>
                                        )}
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </div>
                )}

                {/* Policies Link Card */}
                <div className="space-y-3">
                    <h2 className="text-base font-semibold text-slate-900 px-1">Бодлого, журам</h2>
                    <Link href="/mobile/company/policies">
                        <Card className="rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] border-0 bg-white hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] transition-all active:scale-[0.98] cursor-pointer group">
                            <CardContent className="p-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="h-11 w-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                                            <FileText className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <p className="font-semibold text-slate-900 text-sm">Дүрэм, журам</p>
                                            <p className="text-xs text-slate-500">Компанийн бодлого, журмууд</p>
                                        </div>
                                    </div>
                                    <ChevronRight className="h-5 w-5 text-slate-300 group-hover:text-slate-400 transition-colors" />
                                </div>
                            </CardContent>
                        </Card>
                    </Link>
                </div>

                {/* Company Info */}
                <div className="space-y-3">
                    <h2 className="text-base font-semibold text-slate-900 px-1">Ерөнхий мэдээлэл</h2>
                    <Card className="rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] border-0 bg-white overflow-hidden">
                        <CardContent className="p-0 divide-y divide-slate-50">
                            {companyProfile.legalName && (
                                <div className="p-4 flex items-center gap-3">
                                    <Info className="h-4 w-4 text-slate-400 flex-shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[11px] text-slate-400">Хуулийн нэр</p>
                                        <p className="text-sm font-medium text-slate-700">{companyProfile.legalName}</p>
                                    </div>
                                </div>
                            )}
                            {companyProfile.registrationNumber && (
                                <div className="p-4 flex items-center gap-3">
                                    <Hash className="h-4 w-4 text-slate-400 flex-shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[11px] text-slate-400">Регистрийн дугаар</p>
                                        <p className="text-sm font-medium text-slate-700">{companyProfile.registrationNumber}</p>
                                    </div>
                                </div>
                            )}
                            {companyProfile.establishedDate && (
                                <div className="p-4 flex items-center gap-3">
                                    <Calendar className="h-4 w-4 text-slate-400 flex-shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[11px] text-slate-400">Байгуулагдсан</p>
                                        <p className="text-sm font-medium text-slate-700">{companyProfile.establishedDate}</p>
                                    </div>
                                </div>
                            )}
                            {companyProfile.employeeCount && (
                                <div className="p-4 flex items-center gap-3">
                                    <Users2 className="h-4 w-4 text-slate-400 flex-shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[11px] text-slate-400">Ажилтны тоо</p>
                                        <p className="text-sm font-medium text-slate-700">{companyProfile.employeeCount}</p>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Contact */}
                <div className="space-y-3">
                    <h2 className="text-base font-semibold text-slate-900 px-1">Холбоо барих</h2>
                    <Card className="rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] border-0 bg-white overflow-hidden">
                        <CardContent className="p-0 divide-y divide-slate-50">
                            {companyProfile.phoneNumber && (
                                <a href={`tel:+976${companyProfile.phoneNumber}`} className="p-4 flex items-center gap-3 active:bg-slate-50">
                                    <Phone className="h-4 w-4 text-slate-400 flex-shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[11px] text-slate-400">Утас</p>
                                        <p className="text-sm font-medium text-slate-700">+976 {companyProfile.phoneNumber}</p>
                                    </div>
                                </a>
                            )}
                            {companyProfile.contactEmail && (
                                <a href={`mailto:${companyProfile.contactEmail}`} className="p-4 flex items-center gap-3 active:bg-slate-50">
                                    <Mail className="h-4 w-4 text-slate-400 flex-shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[11px] text-slate-400">Имэйл</p>
                                        <p className="text-sm font-medium text-slate-700">{companyProfile.contactEmail}</p>
                                    </div>
                                </a>
                            )}
                            {companyProfile.address && (
                                <div className="p-4 flex items-center gap-3">
                                    <MapPin className="h-4 w-4 text-slate-400 flex-shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[11px] text-slate-400">Хаяг</p>
                                        <p className="text-sm font-medium text-slate-700">{companyProfile.address}</p>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* History Timeline Section */}
                {historyEvents && historyEvents.filter(e => e.isActive !== false).length > 0 && (
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 px-1">
                            <History className="h-5 w-5 text-amber-600" />
                            <h2 className="text-base font-semibold text-slate-900">Манай түүх</h2>
                        </div>
                        
                        <div className="relative">
                            {/* Vertical Timeline Line */}
                            <div className="absolute left-[18px] top-6 bottom-6 w-0.5 bg-gradient-to-b from-primary via-primary/50 to-emerald-500" />
                            
                            {/* Timeline Events */}
                            <div className="space-y-6">
                                {historyEvents
                                    .filter(e => e.isActive !== false)
                                    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
                                    .map((event, index) => {
                                        const year = event.startDate ? new Date(event.startDate).getFullYear() : '';
                                        const endYear = event.endDate ? new Date(event.endDate).getFullYear() : null;
                                        const yearDisplay = endYear && endYear !== year ? `${year} - ${endYear}` : year.toString();
                                        
                                        return (
                                            <div key={event.id} className="relative pl-12">
                                                {/* Year Dot */}
                                                <div className="absolute left-0 top-0">
                                                    <div className="relative">
                                                        <div className="w-[38px] h-[38px] rounded-full bg-gradient-to-br from-primary to-violet-600 flex items-center justify-center shadow-lg">
                                                            <span className="text-[10px] font-bold text-white">{year}</span>
                                                        </div>
                                                        {/* Pulse effect */}
                                                        <div className="absolute inset-0 w-[38px] h-[38px] rounded-full bg-primary/20 animate-ping opacity-50" />
                                                    </div>
                                                </div>

                                                {/* Event Card */}
                                                <Card className="rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.06)] border-0 bg-white overflow-hidden">
                                                    {/* Images Carousel */}
                                                    {event.imageUrls && event.imageUrls.length > 0 && (
                                                        <div className="relative">
                                                            <Carousel className="w-full" opts={{ loop: true }}>
                                                                <CarouselContent className="-ml-0">
                                                                    {event.imageUrls.map((url, imgIndex) => (
                                                                        <CarouselItem key={imgIndex} className="pl-0">
                                                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                                                            <img 
                                                                                src={url}
                                                                                alt={`${event.title} - ${imgIndex + 1}`}
                                                                                className="w-full h-40 object-cover"
                                                                            />
                                                                        </CarouselItem>
                                                                    ))}
                                                                </CarouselContent>
                                                            </Carousel>
                                                            {/* Image count badge */}
                                                            {event.imageUrls.length > 1 && (
                                                                <div className="absolute bottom-2 right-2 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1">
                                                                    <ImageIcon className="h-3 w-3" />
                                                                    {event.imageUrls.length}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}

                                                    <CardContent className="p-4">
                                                        {/* Date Badge */}
                                                        <Badge 
                                                            variant="secondary" 
                                                            className="mb-2 bg-primary/10 text-primary text-[10px] font-semibold"
                                                        >
                                                            {yearDisplay}
                                                        </Badge>
                                                        
                                                        {/* Title */}
                                                        <h3 className="font-bold text-slate-900 text-sm leading-tight">
                                                            {event.title}
                                                        </h3>
                                                        
                                                        {/* Description */}
                                                        {event.description && (
                                                            <p className="text-xs text-slate-500 mt-2 leading-relaxed line-clamp-3">
                                                                {event.description}
                                                            </p>
                                                        )}

                                                        {/* Video Buttons */}
                                                        {event.videoUrls && event.videoUrls.length > 0 && (
                                                            <div className="flex flex-wrap gap-2 mt-3">
                                                                {event.videoUrls.map((videoUrl, vidIndex) => (
                                                                    <button
                                                                        key={vidIndex}
                                                                        onClick={() => setSelectedHistoryVideo({ 
                                                                            url: videoUrl, 
                                                                            title: `${event.title} - Видео ${vidIndex + 1}` 
                                                                        })}
                                                                        className="inline-flex items-center gap-1.5 text-xs font-medium text-primary bg-primary/10 px-3 py-1.5 rounded-full hover:bg-primary/20 active:scale-95 transition-all"
                                                                    >
                                                                        <Play className="h-3 w-3 fill-current" />
                                                                        Видео {event.videoUrls!.length > 1 ? vidIndex + 1 : ''} үзэх
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </CardContent>
                                                </Card>
                                            </div>
                                        );
                                    })}

                                {/* End Point - "Одоо" */}
                                <div className="relative pl-12">
                                    <div className="absolute left-0 top-0">
                                        <div className="w-[38px] h-[38px] rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-lg">
                                            <span className="text-[9px] font-bold text-white">Одоо</span>
                                        </div>
                                    </div>
                                    <div className="py-3">
                                        <p className="text-sm font-semibold text-emerald-600">
                                            Бид өнөөдөр
                                        </p>
                                        <p className="text-xs text-slate-500 mt-0.5">
                                            Хамтдаа ирээдүйг бүтээж байна
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Video Dialog for History Timeline */}
                <Dialog open={!!selectedHistoryVideo} onOpenChange={(open) => !open && setSelectedHistoryVideo(null)}>
                    <DialogContent className="w-[95vw] max-w-xl p-0 rounded-2xl overflow-hidden">
                        {selectedHistoryVideo && (
                            <>
                                <DialogHeader className="p-4 pb-2">
                                    <DialogTitle className="text-base font-semibold">
                                        {selectedHistoryVideo.title}
                                    </DialogTitle>
                                </DialogHeader>
                                <div className="aspect-video bg-black">
                                    <iframe
                                        src={getYouTubeEmbedUrl(selectedHistoryVideo.url)}
                                        title={selectedHistoryVideo.title}
                                        className="w-full h-full"
                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                        allowFullScreen
                                    />
                                </div>
                            </>
                        )}
                    </DialogContent>
                </Dialog>

                {/* Footer */}
                <div className="text-center pt-4 pb-4">
                    <p className="text-[11px] text-slate-400">
                        © {new Date().getFullYear()} {companyProfile.name}
                    </p>
                </div>
            </div>
        </div>
    );
}
