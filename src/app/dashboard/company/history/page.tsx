'use client';

import * as React from 'react';
import Link from 'next/link';
import { useFirebase, useFetchCollection, useMemoFirebase, tenantCollection, useTenantWrite } from '@/firebase';
import { query, orderBy, deleteDoc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/patterns/page-layout';
import { AddActionButton } from '@/components/ui/add-action-button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronLeft, PlusCircle, MoreHorizontal, Pencil, Trash2, History, Calendar, Image, Video, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { CompanyHistoryEvent } from '@/types/company-history';
import { EventDialog } from './event-dialog';
import { format } from 'date-fns';
import { mn } from 'date-fns/locale';

function PageSkeleton() {
    return (
        <div className="space-y-4">
            {[1, 2, 3].map(i => (
                <Card key={i}>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-4">
                            <Skeleton className="h-16 w-16 rounded-lg" />
                            <div className="flex-1 space-y-2">
                                <Skeleton className="h-5 w-48" />
                                <Skeleton className="h-4 w-32" />
                            </div>
                            <Skeleton className="h-8 w-8" />
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}

function EventCard({ 
    event, 
    onEdit, 
    onDelete 
}: { 
    event: CompanyHistoryEvent; 
    onEdit: () => void;
    onDelete: () => void;
}) {
    const startYear = event.startDate ? new Date(event.startDate).getFullYear() : null;
    const endYear = event.endDate ? new Date(event.endDate).getFullYear() : null;
    const dateDisplay = endYear && startYear !== endYear 
        ? `${startYear} - ${endYear}` 
        : startYear?.toString() || 'Огноогүй';

    return (
        <Card className="group hover:shadow-md transition-all">
            <CardContent className="p-4">
                <div className="flex items-start gap-4">
                    {/* Thumbnail */}
                    <div className="h-16 w-16 rounded-lg bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center flex-shrink-0 overflow-hidden">
                        {event.imageUrls && event.imageUrls.length > 0 ? (
                            <img 
                                src={event.imageUrls[0]} 
                                alt={event.title}
                                className="h-full w-full object-cover"
                            />
                        ) : (
                            <History className="h-6 w-6 text-primary/60" />
                        )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                            <div>
                                <h3 className="font-semibold text-sm truncate">{event.title}</h3>
                                <div className="flex items-center gap-2 mt-1">
                                    <Badge variant="outline" className="text-xs font-medium">
                                        <Calendar className="h-3 w-3 mr-1" />
                                        {dateDisplay}
                                    </Badge>
                                    {!event.isActive && (
                                        <Badge variant="secondary" className="text-xs">
                                            Идэвхгүй
                                        </Badge>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Stats */}
                        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                            {event.imageUrls && event.imageUrls.length > 0 && (
                                <span className="flex items-center gap-1">
                                    <Image className="h-3 w-3" />
                                    {event.imageUrls.length} зураг
                                </span>
                            )}
                            {event.videoUrls && event.videoUrls.length > 0 && (
                                <span className="flex items-center gap-1">
                                    <Video className="h-3 w-3" />
                                    {event.videoUrls.length} видео
                                </span>
                            )}
                        </div>

                        {event.description && (
                            <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                                {event.description}
                            </p>
                        )}
                    </div>

                    {/* Actions */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                                <MoreHorizontal className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={onEdit}>
                                <Pencil className="h-4 w-4 mr-2" />
                                Засах
                            </DropdownMenuItem>
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive">
                                        <Trash2 className="h-4 w-4 mr-2" />
                                        Устгах
                                    </DropdownMenuItem>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle className="flex items-center gap-2">
                                            <AlertCircle className="h-5 w-5 text-destructive" />
                                            Устгахдаа итгэлтэй байна уу?
                                        </AlertDialogTitle>
                                        <AlertDialogDescription>
                                            "{event.title}" үйл явдлыг устгаснаар дахин сэргээх боломжгүй.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Цуцлах</AlertDialogCancel>
                                        <AlertDialogAction
                                            onClick={onDelete}
                                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                        >
                                            Устгах
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </CardContent>
        </Card>
    );
}

export default function CompanyHistoryPage() {
    const { firestore } = useFirebase();
    const { tDoc } = useTenantWrite();
    const { toast } = useToast();
    const [dialogOpen, setDialogOpen] = React.useState(false);
    const [editingEvent, setEditingEvent] = React.useState<CompanyHistoryEvent | null>(null);

    const historyQuery = useMemoFirebase(
        ({ firestore, companyPath }) => firestore ? query(tenantCollection(firestore, companyPath, 'companyHistory'), orderBy('startDate', 'desc')) : null,
        []
    );

    const { data: events, isLoading, refetch } = useFetchCollection<CompanyHistoryEvent>(historyQuery);

    const handleEdit = (event: CompanyHistoryEvent) => {
        setEditingEvent(event);
        setDialogOpen(true);
    };

    const handleDelete = async (event: CompanyHistoryEvent) => {
        if (!firestore) return;
        
        try {
            const eventRef = tDoc('companyHistory', event.id);
            await deleteDoc(eventRef);
            toast({
                title: 'Амжилттай устгалаа',
                description: `"${event.title}" үйл явдал устгагдлаа.`,
            });
            refetch();
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Алдаа',
                description: 'Устгахад алдаа гарлаа.',
            });
        }
    };

    const handleDialogClose = () => {
        setDialogOpen(false);
        setEditingEvent(null);
    };

    const handleAddNew = () => {
        setEditingEvent(null);
        setDialogOpen(true);
    };

    // Sort events by startDate
    const sortedEvents = React.useMemo(() => {
        if (!events) return [];
        return [...events].sort((a, b) => {
            const dateA = a.startDate ? new Date(a.startDate).getTime() : 0;
            const dateB = b.startDate ? new Date(b.startDate).getTime() : 0;
            return dateB - dateA; // Newest first
        });
    }, [events]);

    return (
        <div className="flex flex-col h-full overflow-hidden">
            <div className="flex-1 overflow-y-auto p-6 md:p-8 scroll-smooth">
                {/* Header */}
                <div className="bg-white border-b sticky top-0 z-20 -mx-6 md:-mx-8 -mt-6 md:-mt-8 mb-6">
                    <div className="px-6 md:px-8 py-4">
                        <PageHeader
                            title="Түүхэн үйл явдал"
                            description="Компанийн түүх, чухал үйл явдлууд"
                            showBackButton
                            hideBreadcrumbs
                            backButtonPlacement="inline"
                            backBehavior="history"
                            fallbackBackHref="/dashboard/company"
                            actions={
                                <AddActionButton
                                    label="Үйл явдал нэмэх"
                                    description="Шинэ түүхэн үйл явдал нэмэх"
                                    onClick={handleAddNew}
                                />
                            }
                        />
                    </div>
                </div>

                {/* Content */}
                {isLoading ? (
                    <PageSkeleton />
                ) : sortedEvents.length === 0 ? (
                    <Card className="border-dashed">
                        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                            <div className="h-16 w-16 rounded-full bg-gradient-to-br from-amber-50 to-orange-50 flex items-center justify-center mb-4">
                                <History className="h-8 w-8 text-amber-500" />
                            </div>
                            <h3 className="font-semibold text-slate-700 mb-1">Түүхэн үйл явдал хоосон байна</h3>
                            <p className="text-sm text-muted-foreground mb-6 max-w-sm">
                                Компанийн түүх, онцлох үйл явдлуудыг нэмж, ажилтнуудад танилцуулна уу.
                            </p>
                            <Button onClick={handleAddNew}>
                                <PlusCircle className="h-4 w-4 mr-2" />
                                Эхний үйл явдал нэмэх
                            </Button>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="space-y-3">
                        {sortedEvents.map((event) => (
                            <EventCard
                                key={event.id}
                                event={event}
                                onEdit={() => handleEdit(event)}
                                onDelete={() => handleDelete(event)}
                            />
                        ))}
                    </div>
                )}

                {/* Dialog */}
                <EventDialog
                    open={dialogOpen}
                    onOpenChange={handleDialogClose}
                    event={editingEvent}
                    onSaved={refetch}
                />
            </div>
        </div>
    );
}
